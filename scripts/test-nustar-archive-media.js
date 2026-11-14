/**
 * NuSTAR Latest 1,000 Archive Media Availability Test
 *
 * Independent diagnostic that:
 *  - Selects the latest 1,000 unique 11-digit ObsIDs from the NUMASTER
 *    product-candidates CSV (sorted by observation time descending)
 *  - Retains all statuses (processed, archived, issue-flagged, etc.)
 *  - Builds the HEASARC public archive path
 *  - Lists actual archive directories (does not assume event_cl only)
 *  - Discovers GIF/PNG/JPEG/WebP files
 *  - Validates image signatures via small HTTP Range requests
 *  - Never downloads FITS or large science products
 *
 * Does NOT write to Cloudflare KV, use production secrets, modify the
 * production NuSTAR adapter, or touch frontend code.
 *
 * Run: node scripts/test-nustar-archive-media.js
 */

import fs from "node:fs/promises";
import path from "node:path";

const CANDIDATES_CSV =
  process.env.NUSTAR_CANDIDATES_CSV ||
  path.resolve("results/numaster-product-candidates.csv");

const OUTPUT_DIR =
  process.env.NUSTAR_OUTPUT_DIR ||
  path.resolve("results/nustar-archive-test");

const MAX_OBS = Number(process.env.NUSTAR_MAX_OBS || 1000);
const CONCURRENCY = Math.min(
  5,
  Math.max(3, Number(process.env.NUSTAR_CONCURRENCY || 4))
);
const REQUEST_TIMEOUT_MS = Number(process.env.NUSTAR_TIMEOUT_MS || 25000);
const MAX_RETRIES = 1;
const USER_AGENT =
  "AstronomicalTime-NuSTAR-archive-media-test/1.0 (+https://github.com/tolifeonline/test-repository)";

const IMAGE_EXTENSIONS = new Set([".gif", ".png", ".jpg", ".jpeg", ".webp"]);

const IMAGE_SIGNATURES = [
  { name: "GIF", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { name: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47] }, // \x89PNG
  { name: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { name: "WEBP", bytes: [0x52, 0x49, 0x46, 0x46] } // RIFF (WebP has WEBP later)
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("CSV contains no data rows or is empty.");
  }

  const headers = rows[0].map((h) => h.trim().replace(/^"|"$/g, ""));
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(records, columns) {
  return (
    [
      columns.map(csvCell).join(","),
      ...records.map((r) => columns.map((c) => csvCell(r[c])).join(","))
    ].join("\n") + "\n"
  );
}

function countBy(records, field) {
  const counts = {};
  for (const r of records) {
    const v = String(r[field] ?? "MISSING");
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1])
  );
}

/**
 * Derive HEASARC public archive base path from 11-digit ObsID.
 * Path: https://heasarc.gsfc.nasa.gov/FTP/nustar/data/obs/YY/T/ObsID/
 * YY = characters 2–3 (0-based indices 1–2), T = first digit.
 */
function archiveBaseUrl(obsid) {
  const id = String(obsid).trim();
  if (!/^\d{11}$/.test(id)) {
    throw new Error(`Invalid ObsID (must be 11 digits): ${obsid}`);
  }
  const T = id[0];
  const YY = id.slice(1, 3);
  return `https://heasarc.gsfc.nasa.gov/FTP/nustar/data/obs/${YY}/${T}/${id}/`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "*/*",
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithRetry(url, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: "GET" });
      if (res.status === 404) {
        return { ok: false, status: 404, text: null };
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      return { ok: true, status: res.status, text };
    } catch (err) {
      lastError = err;
      const transient =
        err.name === "AbortError" ||
        /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|HTTP 5\d\d/i.test(
          String(err.message)
        );
      if (attempt < retries && transient) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Validate image signature with a small Range request.
 * Reads only the first few bytes and cancels the body.
 */
async function validateImageSignature(url, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: { Range: "bytes=0-15" }
      });

      if (res.status === 404) {
        return { valid: false, reason: "not_found", contentType: null };
      }
      if (res.status !== 200 && res.status !== 206) {
        return {
          valid: false,
          reason: `http_${res.status}`,
          contentType: res.headers.get("content-type")
        };
      }

      // Read only the first chunk then cancel
      const reader = res.body?.getReader();
      if (!reader) {
        return { valid: false, reason: "no_body", contentType: null };
      }

      const { value } = await reader.read();
      await reader.cancel().catch(() => {});

      if (!value || value.length < 3) {
        return { valid: false, reason: "too_short", contentType: null };
      }

      const bytes = Array.from(value.slice(0, 16));
      for (const sig of IMAGE_SIGNATURES) {
        if (sig.bytes.every((b, i) => bytes[i] === b)) {
          // Extra check for WebP: bytes 8-11 should be WEBP when possible
          if (sig.name === "WEBP" && value.length >= 12) {
            const fourCC = String.fromCharCode(
              value[8],
              value[9],
              value[10],
              value[11]
            );
            if (fourCC !== "WEBP") {
              continue;
            }
          }
          return {
            valid: true,
            format: sig.name,
            contentType: res.headers.get("content-type"),
            sizeHint: res.headers.get("content-length") || res.headers.get("content-range")
          };
        }
      }

      return {
        valid: false,
        reason: "unknown_signature",
        contentType: res.headers.get("content-type"),
        headHex: bytes
          .slice(0, 8)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      };
    } catch (err) {
      lastError = err;
      const transient =
        err.name === "AbortError" ||
        /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(
          String(err.message)
        );
      if (attempt < retries && transient) {
        await sleep(600 * (attempt + 1));
        continue;
      }
      return {
        valid: false,
        reason: `error:${err.name || "unknown"}`,
        message: String(err.message || err).slice(0, 200)
      };
    }
  }
  return {
    valid: false,
    reason: `error:${lastError?.name || "unknown"}`,
    message: String(lastError?.message || lastError).slice(0, 200)
  };
}

/**
 * Parse Apache-style directory index HTML into list of hrefs.
 */
function parseDirectoryListing(html, baseUrl) {
  const entries = [];
  const hrefRe = /href\s*=\s*"([^"]+)"/gi;
  let match;
  while ((match = hrefRe.exec(html)) !== null) {
    let href = match[1];
    if (!href || href === "../" || href === "/" || href.startsWith("?")) continue;
    if (href.startsWith("http")) continue;
    // Decode basic entities
    href = href.replace(/&amp;/g, "&");
    const isDir = href.endsWith("/");
    const name = decodeURIComponent(href.replace(/\/$/, ""));
    if (name === "Parent Directory" || name === "..") continue;
    const fullUrl = new URL(href, baseUrl).href;
    entries.push({ name, href, isDir, url: fullUrl });
  }
  return entries;
}

function classifyMedia(filename) {
  const lower = filename.toLowerCase();
  const categories = [];

  if (/_im\.gif$|_im\.png$|_im\.jpe?g$|_im\.webp$/i.test(lower)) {
    categories.push("image");
  }
  if (/_lc\.gif$|_lc\.png$|_lc\.jpe?g$|_lc\.webp$/i.test(lower)) {
    categories.push("light_curve");
  }
  if (/_ph\.gif$|_ph\.png$|_ph\.jpe?g$|_ph\.webp$/i.test(lower)) {
    categories.push("spectrum");
  }
  if (/fpma|nu\d+A/i.test(filename)) categories.push("FPMA");
  if (/fpmb|nu\d+B/i.test(filename)) categories.push("FPMB");

  // Generic image if extension matches but no specific product suffix
  const ext = path.extname(lower);
  if (IMAGE_EXTENSIONS.has(ext) && categories.length === 0) {
    categories.push("other_image");
  }

  return categories.length ? categories : ["unknown"];
}

async function listDirectoryRecursive(baseUrl, maxDepth = 2, currentDepth = 0) {
  const result = {
    accessible: false,
    status: null,
    error: null,
    directories: [],
    files: []
  };

  try {
    const { ok, status, text } = await fetchTextWithRetry(baseUrl);
    result.status = status;
    if (!ok || !text) {
      result.error = status === 404 ? "not_found" : `http_${status}`;
      return result;
    }
    result.accessible = true;

    const entries = parseDirectoryListing(text, baseUrl);
    for (const entry of entries) {
      if (entry.isDir) {
        result.directories.push({
          name: entry.name,
          url: entry.url
        });
        if (currentDepth < maxDepth) {
          // Only recurse into known interesting subdirs to stay light
          const interesting = /^(event_cl|event_uf|auxil|hk|products|quicklook|ql)$/i.test(
            entry.name
          );
          if (interesting) {
            const sub = await listDirectoryRecursive(
              entry.url,
              maxDepth,
              currentDepth + 1
            );
            if (sub.accessible) {
              for (const f of sub.files) {
                result.files.push(f);
              }
              for (const d of sub.directories) {
                result.directories.push(d);
              }
            }
          }
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        result.files.push({
          name: entry.name,
          url: entry.url,
          ext,
          isImageCandidate: IMAGE_EXTENSIONS.has(ext)
        });
      }
    }
  } catch (err) {
    result.error = String(err.message || err).slice(0, 300);
  }

  return result;
}

async function processObservation(record) {
  const obsid = String(record.obsid || "").trim();
  const out = {
    obsid,
    name: record.name || "",
    status: record.status || "",
    observation_mode: record.observation_mode || "",
    obs_type: record.obs_type || "",
    time: record.time || "",
    end_time: record.end_time || "",
    public_date: record.public_date || "",
    exposure_a: record.exposure_a || "",
    exposure_b: record.exposure_b || "",
    issue_flag: record.issue_flag || "",
    title: record.title || "",
    archive_url: null,
    archive_accessible: false,
    archive_status: null,
    archive_error: null,
    media_found: false,
    media_count: 0,
    validated_media_count: 0,
    media_files: [],
    category_counts: {
      image: 0,
      light_curve: 0,
      spectrum: 0,
      FPMA: 0,
      FPMB: 0,
      other_image: 0,
      unknown: 0
    },
    subdirectories_seen: []
  };

  if (!/^\d{11}$/.test(obsid)) {
    out.archive_error = "invalid_obsid";
    return out;
  }

  const baseUrl = archiveBaseUrl(obsid);
  out.archive_url = baseUrl;

  const listing = await listDirectoryRecursive(baseUrl, 2, 0);
  out.archive_accessible = listing.accessible;
  out.archive_status = listing.status;
  out.archive_error = listing.error;
  out.subdirectories_seen = listing.directories.map((d) => d.name);

  const imageCandidates = listing.files.filter((f) => f.isImageCandidate);

  for (const file of imageCandidates) {
    const categories = classifyMedia(file.name);
    const validation = await validateImageSignature(file.url);

    const mediaEntry = {
      filename: file.name,
      url: file.url,
      categories,
      signature_valid: validation.valid,
      format: validation.format || null,
      validation_reason: validation.reason || null,
      content_type: validation.contentType || null
    };

    out.media_files.push(mediaEntry);

    if (validation.valid) {
      out.validated_media_count += 1;
      for (const cat of categories) {
        if (out.category_counts[cat] !== undefined) {
          out.category_counts[cat] += 1;
        } else {
          out.category_counts.unknown += 1;
        }
      }
    }
  }

  out.media_count = out.media_files.length;
  out.media_found = out.validated_media_count > 0;

  return out;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }

  const workers = Array.from({ length: concurrency }, () => runner());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log("NuSTAR Latest 1,000 Archive Media Availability Test");
  console.log(`Candidates CSV: ${CANDIDATES_CSV}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Max observations: ${MAX_OBS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Timeout: ${REQUEST_TIMEOUT_MS} ms`);
  console.log("");

  const csvText = await fs.readFile(CANDIDATES_CSV, "utf8");
  const allRecords = parseCsv(csvText);

  // Verify expected columns exist
  const sample = allRecords[0] || {};
  const required = ["obsid", "time", "status"];
  for (const col of required) {
    if (!(col in sample)) {
      throw new Error(
        `CSV is missing required column "${col}". Found: ${Object.keys(sample).join(", ")}`
      );
    }
  }

  // Unique 11-digit ObsIDs, sorted by time descending
  const byObsid = new Map();
  for (const r of allRecords) {
    const id = String(r.obsid || "").trim();
    if (!/^\d{11}$/.test(id)) continue;
    const time = Number(r.time);
    const existing = byObsid.get(id);
    if (!existing || (Number.isFinite(time) && time > Number(existing.time))) {
      byObsid.set(id, r);
    }
  }

  const unique = Array.from(byObsid.values()).sort((a, b) => {
    const ta = Number(a.time) || 0;
    const tb = Number(b.time) || 0;
    return tb - ta;
  });

  const selected = unique.slice(0, MAX_OBS);

  console.log(`Total CSV rows: ${allRecords.length}`);
  console.log(`Unique 11-digit ObsIDs: ${unique.length}`);
  console.log(`Selected for test: ${selected.length}`);
  if (selected.length) {
    console.log(
      `Time range (MJD): ${selected[selected.length - 1].time} → ${selected[0].time}`
    );
  }
  console.log("");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const startedAt = new Date().toISOString();
  let completed = 0;

  let mediaFoundSoFar = 0;
  const results = await runPool(selected, CONCURRENCY, async (record, i) => {
    const r = await processObservation(record);
    completed += 1;
    if (r.media_found) mediaFoundSoFar += 1;
    if (completed % 25 === 0 || completed === selected.length) {
      console.log(
        `Progress: ${completed}/${selected.length}  ` +
          `(media found so far: ${mediaFoundSoFar})`
      );
    }
    return r;
  });

  const finishedAt = new Date().toISOString();

  // Aggregate statistics
  const withArchive = results.filter((r) => r.archive_accessible);
  const withMedia = results.filter((r) => r.media_found);
  const totalValidatedMedia = results.reduce(
    (s, r) => s + r.validated_media_count,
    0
  );

  const categoryTotals = {
    image: 0,
    light_curve: 0,
    spectrum: 0,
    FPMA: 0,
    FPMB: 0,
    other_image: 0,
    unknown: 0
  };
  for (const r of results) {
    for (const [k, v] of Object.entries(r.category_counts)) {
      categoryTotals[k] = (categoryTotals[k] || 0) + v;
    }
  }

  const byStatus = countBy(results, "status");
  const byObsType = countBy(results, "obs_type");
  const byStatusMedia = {};
  for (const r of results) {
    const key = r.status || "MISSING";
    if (!byStatusMedia[key]) {
      byStatusMedia[key] = { total: 0, with_media: 0, with_archive: 0 };
    }
    byStatusMedia[key].total += 1;
    if (r.media_found) byStatusMedia[key].with_media += 1;
    if (r.archive_accessible) byStatusMedia[key].with_archive += 1;
  }

  const byObsTypeMedia = {};
  for (const r of results) {
    const key = r.obs_type || "MISSING";
    if (!byObsTypeMedia[key]) {
      byObsTypeMedia[key] = { total: 0, with_media: 0, with_archive: 0 };
    }
    byObsTypeMedia[key].total += 1;
    if (r.media_found) byObsTypeMedia[key].with_media += 1;
    if (r.archive_accessible) byObsTypeMedia[key].with_archive += 1;
  }

  const summary = {
    generatedAtUtc: finishedAt,
    startedAtUtc: startedAt,
    sourceCsv: CANDIDATES_CSV,
    maxRequested: MAX_OBS,
    uniqueCandidatesAvailable: unique.length,
    observationsTested: results.length,
    concurrency: CONCURRENCY,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,

    archive: {
      accessible: withArchive.length,
      inaccessible: results.length - withArchive.length,
      accessibilityRate:
        results.length > 0
          ? Number((withArchive.length / results.length).toFixed(4))
          : 0
    },

    media: {
      observationsWithValidatedMedia: withMedia.length,
      observationsWithoutValidatedMedia: results.length - withMedia.length,
      mediaAvailabilityRate:
        results.length > 0
          ? Number((withMedia.length / results.length).toFixed(4))
          : 0,
      totalValidatedMediaFiles: totalValidatedMedia,
      categoryCounts: categoryTotals
    },

    statusComparison: byStatusMedia,
    observationTypeComparison: byObsTypeMedia,
    statusCounts: byStatus,
    observationTypeCounts: byObsType,

    notes: [
      "A directory returning HTTP 200 is not proof that usable media exists.",
      "Only files with a verified image signature (GIF/PNG/JPEG/WebP) count as media.",
      "FITS and large science products were never downloaded.",
      "All candidate statuses (processed, archived, issue-flagged) were retained."
    ]
  };

  // Detailed JSON
  await fs.writeFile(
    path.join(OUTPUT_DIR, "nustar-archive-media-detailed.json"),
    JSON.stringify(
      {
        summary,
        observations: results
      },
      null,
      2
    )
  );

  // CSV summary of each observation
  const csvColumns = [
    "obsid",
    "name",
    "status",
    "obs_type",
    "time",
    "public_date",
    "issue_flag",
    "archive_accessible",
    "archive_status",
    "media_found",
    "media_count",
    "validated_media_count",
    "image_count",
    "light_curve_count",
    "spectrum_count",
    "fpma_count",
    "fpmb_count",
    "archive_url"
  ];

  const csvRows = results.map((r) => ({
    obsid: r.obsid,
    name: r.name,
    status: r.status,
    obs_type: r.obs_type,
    time: r.time,
    public_date: r.public_date,
    issue_flag: r.issue_flag,
    archive_accessible: r.archive_accessible,
    archive_status: r.archive_status,
    media_found: r.media_found,
    media_count: r.media_count,
    validated_media_count: r.validated_media_count,
    image_count: r.category_counts.image,
    light_curve_count: r.category_counts.light_curve,
    spectrum_count: r.category_counts.spectrum,
    fpma_count: r.category_counts.FPMA,
    fpmb_count: r.category_counts.FPMB,
    archive_url: r.archive_url
  }));

  await fs.writeFile(
    path.join(OUTPUT_DIR, "nustar-archive-media-summary.csv"),
    toCsv(csvRows, csvColumns)
  );

  // Aggregate summary JSON
  await fs.writeFile(
    path.join(OUTPUT_DIR, "nustar-archive-media-aggregate.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("\n========== ARCHIVE MEDIA TEST SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReports written to: ${OUTPUT_DIR}`);
  console.log("  - nustar-archive-media-detailed.json");
  console.log("  - nustar-archive-media-summary.csv");
  console.log("  - nustar-archive-media-aggregate.json");
}

main().catch((err) => {
  console.error("\nNuSTAR archive media test FAILED:");
  console.error(err);
  process.exitCode = 1;
});
