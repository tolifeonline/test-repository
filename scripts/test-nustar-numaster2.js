
/**
 * Independent NUMASTER catalogue-discovery diagnostic.
 *
 * Reads the public HEASARC NUMASTER table through the HEASARC TAP service.
 * Does NOT import or modify the production NuSTAR adapter and does NOT
 * publish anything to Cloudflare.
 *
 * Run: node scripts/test-nustar-numaster.js
 */

import fs from "node:fs/promises";
import path from "node:path";

const TAP_URL = "https://heasarc.gsfc.nasa.gov/xamin/vo/tap/sync";
const MAX_RECORDS = Number(process.env.NUSTAR_MAX_RECORDS || 50000);
const OUTPUT_DIR = path.resolve("artifacts");

function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCodePoint(parseInt(decimal, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(text) {
  const attributes = {};

  for (const match of text.matchAll(
    /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
  )) {
    attributes[match[1].toLowerCase()] = decodeXml(match[2]);
  }

  return attributes;
}

function parseVOTable(xml) {
  const queryError = xml.match(
    /<INFO\b[^>]*name=["']QUERY_STATUS["'][^>]*value=["']ERROR["'][^>]*>([\s\S]*?)<\/INFO>/i
  );

  if (queryError) {
    throw new Error(
      `HEASARC TAP query error: ${decodeXml(
        queryError[1].replace(/<[^>]*>/g, "").trim()
      )}`
    );
  }

  const fields = [];

  const fieldSection = xml.match(
    /<TABLE\b[\s\S]*?<\/TABLE>/i
  );

  if (!fieldSection) {
    throw new Error("VOTable contains no TABLE definition.");
  }

  for (const match of fieldSection[0].matchAll(
    /<FIELD\b([^>]*)\/?>/gi
  )) {
    const attributes = parseXmlAttributes(match[1]);

    fields.push(
      attributes.name ||
      attributes.id ||
      `column_${fields.length + 1}`
    );
  }

  if (!fields.length) {
    throw new Error("VOTable contains no FIELD definitions.");
  }

  const tableData = xml.match(
    /<TABLEDATA\b[^>]*>([\s\S]*?)<\/TABLEDATA>/i
  );

  if (!tableData) {
    throw new Error(
      "VOTable does not contain TABLEDATA. " +
      "The HEASARC response may be using a different serialization format."
    );
  }

  const records = [];

  for (const rowMatch of tableData[1].matchAll(
    /<TR\b[^>]*>([\s\S]*?)<\/TR>/gi
  )) {
    const values = [];

    for (const cellMatch of rowMatch[1].matchAll(
      /<TD\b[^>]*>([\s\S]*?)<\/TD>/gi
    )) {
      const value = decodeXml(
        cellMatch[1]
          .replace(/<[^>]*>/g, "")
          .trim()
      );

      values.push(value);
    }

    const record = {};

    fields.forEach((field, index) => {
      record[field] = values[index] ?? "";
    });

    records.push(record);
  }

  if (!records.length) {
    throw new Error(
      "VOTable was valid but contained no TABLEDATA records."
    );
  }

  return records;
}

function get(record, name) {
  const key = Object.keys(record).find(
    candidate => candidate.toLowerCase() === name.toLowerCase()
  );

  return key ? record[key] : "";
}

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function parseArchiveDate(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const raw = String(value).trim();
  const numeric = Number(raw);

  // HEASARC time columns can be represented as Modified Julian Date.
  if (
    Number.isFinite(numeric) &&
    numeric > 30000 &&
    numeric < 100000
  ) {
    return new Date((numeric - 40587) * 86400000);
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvCell(value) {
  const text =
    value === null || value === undefined
      ? ""
      : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(records, columns) {
  return [
    columns.map(csvCell).join(","),
    ...records.map(record =>
      columns.map(column => csvCell(record[column])).join(",")
    )
  ].join("\n") + "\n";
}

function normalizeRecord(record) {
  const obsid = String(get(record, "obsid") || "").trim();

  const exposureA = numberOrNull(get(record, "exposure_a"));
  const exposureB = numberOrNull(get(record, "exposure_b"));

  const publicDateRaw = get(record, "public_date");
  const publicDate = parseArchiveDate(publicDateRaw);

  const status = String(get(record, "status") || "")
    .trim()
    .toLowerCase();

  const observationMode = String(
    get(record, "observation_mode") || ""
  ).trim().toUpperCase();

  const publicDatePassed = Boolean(
    publicDate && publicDate.getTime() <= Date.now()
  );

  const fullObservationId = /^\d{11}$/.test(obsid);

  const publiclyAvailable =
    publicDatePassed && fullObservationId;

  const positiveScienceExposure =
    (exposureA ?? -1) > 0 ||
    (exposureB ?? -1) > 0;

  const scienceMode = observationMode === "SCIENCE";

  const archivedStatus = status === "archived";

  const reasons = [];

  if (!fullObservationId) {
    reasons.push("not_an_11_digit_observation_id");
  }

  if (!publicDatePassed) {
    reasons.push("public_date_missing_or_not_yet_public");
  }

  if (!positiveScienceExposure) {
    reasons.push("no_positive_fpma_or_fpmb_exposure");
  }

  if (!scienceMode) {
    reasons.push("observation_mode_not_science");
  }

  if (!archivedStatus) {
    reasons.push(`status_${status || "missing"}`);
  }

  return {
    obsid,
    name: get(record, "name"),
    status,
    observation_mode: observationMode,
    obs_type: get(record, "obs_type"),
    time: get(record, "time"),
    end_time: get(record, "end_time"),
    public_date: publicDateRaw,
    public_date_iso: publicDate
      ? publicDate.toISOString()
      : null,
    exposure_a: exposureA,
    exposure_b: exposureB,
    ra: get(record, "ra"),
    dec: get(record, "dec"),
    title: get(record, "title"),
    abstract: get(record, "abstract"),
    subject_category: get(record, "subject_category"),
    cycle: get(record, "cycle"),
    coordinated: get(record, "coordinated"),
    issue_flag: get(record, "issue_flag"),
    data_gap: get(record, "data_gap"),
    nupsdout: get(record, "nupsdout"),
    solar_activity: get(record, "solar_activity"),
    comments: get(record, "comments"),

    public_date_passed: publicDatePassed,
    publicly_available: publiclyAvailable,
    positive_science_exposure: positiveScienceExposure,
    science_mode: scienceMode,
    archived_status: archivedStatus,

    candidate_for_product_check:
      publiclyAvailable &&
      positiveScienceExposure &&
      scienceMode,

    exclusion_reasons: reasons
  };
}

function countBy(records, field) {
  const counts = {};

  for (const record of records) {
    const value = String(record[field] || "MISSING");

    counts[value] = (counts[value] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1])
  );
}

async function main() {
  console.log("Querying HEASARC NUMASTER through TAP...");
  console.log(`Maximum rows requested: ${MAX_RECORDS}`);

  const adql = `
    SELECT TOP ${MAX_RECORDS} *
    FROM numaster
    ORDER BY time DESC
  `;

const params = new URLSearchParams({
  REQUEST: "doQuery",
  LANG: "ADQL",
  FORMAT: "votable",
  MAXREC: String(MAX_RECORDS),
  QUERY: adql
});

  const response = await fetch(TAP_URL, {
    method: "POST",

    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "accept": "text/csv,text/plain,*/*",
      "user-agent":
        "AstronomicalTime-NuSTAR-catalogue-diagnostic/1.0"
    },

    body: params,
    signal: AbortSignal.timeout(120000)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `HEASARC TAP HTTP ${response.status}: ` +
      responseText.slice(0, 1200)
    );
  }

  if (!responseText.trim()) {
  throw new Error("HEASARC returned an empty response.");
}

const rawRecords = parseVOTable(responseText);

  const records = rawRecords.map(normalizeRecord);

  const publiclyAvailable = records.filter(
    record => record.publicly_available
  );

  const productCandidates = records.filter(
    record => record.candidate_for_product_check
  );

  const archivedWithExposure = records.filter(
    record =>
      record.archived_status &&
      record.positive_science_exposure
  );

  const summary = {
    generatedAtUtc: new Date().toISOString(),

    source: TAP_URL,
    table: "NUMASTER",

    requestedMaximumRows: MAX_RECORDS,
    retrievedRows: records.length,

    possibleTruncation: records.length >= MAX_RECORDS,

    counts: {
      byStatus: countBy(records, "status"),
      byObservationMode: countBy(
        records,
        "observation_mode"
      ),
      byObservationType: countBy(records, "obs_type")
    },

    filters: {
      publicDatePassedAndFullObsId:
        publiclyAvailable.length,

      archivedWithPositiveExposure:
        archivedWithExposure.length,

      productCheckCandidates:
        productCandidates.length,

      candidatesWithIssueFlag:
        productCandidates.filter(
          record => String(record.issue_flag).trim() === "1"
        ).length
    },

    importantNote:
      "Catalogue eligibility is not proof that quick-look GIFs exist. " +
      "The next diagnostic should test archive product paths for productCheckCandidates."
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await fs.writeFile(
    path.join(OUTPUT_DIR, "numaster-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, "numaster-all-records.json"),
    JSON.stringify(records, null, 2)
  );

  const candidateColumns = [
    "obsid",
    "name",
    "status",
    "observation_mode",
    "obs_type",
    "time",
    "end_time",
    "public_date",
    "exposure_a",
    "exposure_b",
    "ra",
    "dec",
    "title",
    "subject_category",
    "cycle",
    "coordinated",
    "issue_flag",
    "data_gap",
    "nupsdout",
    "solar_activity",
    "comments"
  ];

  await fs.writeFile(
    path.join(
      OUTPUT_DIR,
      "numaster-product-candidates.csv"
    ),
    toCsv(productCandidates, candidateColumns)
  );

  await fs.writeFile(
    path.join(
      OUTPUT_DIR,
      "numaster-product-candidates.json"
    ),
    JSON.stringify(productCandidates, null, 2)
  );

  console.log(
    "\n========== NUMASTER DISCOVERY SUMMARY =========="
  );

  console.log(JSON.stringify(summary, null, 2));

  console.log("\nTop 25 product-check candidates:");

  console.table(
    productCandidates.slice(0, 25).map(record => ({
      obsid: record.obsid,
      target: record.name,
      date: record.time,
      type: record.obs_type,
      exposureA: record.exposure_a,
      exposureB: record.exposure_b,
      publicDate: record.public_date
    }))
  );

  if (summary.possibleTruncation) {
    console.warn(
      `WARNING: Retrieved ${records.length} rows, equal to ` +
      "the requested maximum. Increase NUSTAR_MAX_RECORDS " +
      "or use TAP async pagination before treating this as complete."
    );
  }

  console.log(`\nReports written to: ${OUTPUT_DIR}`);
}

main().catch(error => {
  console.error("\nNUMASTER discovery test FAILED:");
  console.error(error);
  process.exitCode = 1;
});
