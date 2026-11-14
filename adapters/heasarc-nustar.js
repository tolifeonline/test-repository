
import { normalizeObservations } from './normalizer.js';

const HEASARC_QUERY =
    'https://heasarc.gsfc.nasa.gov/xamin/query';

const NUSTAR_ARCHIVE =
    'https://heasarc.gsfc.nasa.gov/FTP/nustar/data/obs/00/';

const SCAN_LIMIT = 500;
const CONCURRENCY = 6;
const BATCH_SIZE = 30;

async function fetchText(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }

    return response.text();
}

export function mapNuSTARProposal(record) {
    const clean = value => {
        const text = String(value ?? '').trim();

        return !text || text.toLowerCase() === 'null'
            ? ''
            : text;
    };

    const proposalNumber = clean(record.prnb);
    const cycle = clean(record.cycle);

    const firstName = clean(record.pi_fname);
    const lastName = clean(record.pi_lname);

    const coFirstName = clean(record.copi_fname);
    const coLastName = clean(record.copi_lname);

    const isBaselineProgram =
        proposalNumber === '0' && cycle === '0';

    return {
        // Zero identifies the baseline programme,
        // not a conventional numbered proposal.
        id: proposalNumber && proposalNumber !== '0'
            ? proposalNumber
            : '',

        title: clean(record.title),

        principalInvestigator:
            [firstName, lastName].filter(Boolean).join(' '),

        coPrincipalInvestigator:
            [coFirstName, coLastName].filter(Boolean).join(' '),

        // NUMASTER does not establish Regular or Large here.
        proposalType: '',

        scienceCategory: clean(record.subject_category),
        abstract: isBaselineProgram
		? `Programme Abstract: ${clean(record.abstract)}`
		: clean(record.abstract),

        program: isBaselineProgram
            ? 'NuSTAR Baseline Science Program'
            : '',

        cycle,
        country: clean(record.country),
        observationType: clean(record.obs_type),
        categoryCode: clean(record.category_code),
        priority: clean(record.priority),

        source: 'HEASARC NUMASTER'
    };
}

export async function getNuSTARCatalog() {
		const params = new URLSearchParams({
			table: 'numaster',
			resultmax: String(SCAN_LIMIT),
			time: '2024-01-01..2027-01-01',

			fields: [
				'name',
				'ra',
				'dec',
				'time',
				'obsid',
				'status',
				'exposure_a',
				'exposure_b',
				'observation_mode',
				'obs_type',
				'processing_date',
				'public_date',
				'issue_flag',

				// Proposal and programme metadata
				'prnb',
				'title',
				'abstract',
				'pi_fname',
				'pi_lname',
				'copi_fname',
				'copi_lname',
				'country',
				'cycle',
				'subject_category',
				'category_code',
				'priority'
			].join(','),

			format: 'aligned',
			messages: 'stdout',
			showquery: 'true'
		});

    const url = `${HEASARC_QUERY}?${params}`;

    const response = await fetch(url);
    const text = await response.text();

    console.log('NuSTAR HEASARC status:', response.status);

    if (!response.ok) {
        throw new Error(`HEASARC HTTP ${response.status}`);
    }

    if (text.includes('Query Error') || text.includes('Failure:')) {
        throw new Error(`NuSTAR catalog query failed:\n${text}`);
    }

    const lines = text.split(/\r?\n/);

    const headerIndex = lines.findIndex(line => {
        const columns = line.split('|')
            .map(value => value.trim().toLowerCase());

        return columns.includes('obsid') &&
               columns.includes('time') &&
               columns.includes('status') &&
               columns.includes('observation_mode');
    });

    if (headerIndex < 0) {
        console.error('NuSTAR HEASARC response:', text.slice(0, 5000));
        throw new Error('NuSTAR catalog headers not found.');
    }

    const columns = lines[headerIndex]
        .split('|')
        .map(value => value.trim().toLowerCase());

    const records = [];

    for (const line of lines.slice(headerIndex + 1)) {
        if (!line.includes('|')) continue;

        const values = line.split('|').map(value => value.trim());

        if (values.length !== columns.length) continue;

        const record = Object.fromEntries(
            columns.map((column, index) => [
                column,
                values[index]
            ])
        );

        const exposureA = Number(record.exposure_a);
        const exposureB = Number(record.exposure_b);
        const publicDate = Date.parse(record.public_date);

        if (
            !/^\d{11}$/.test(record.obsid || '') ||
            !record.time ||
            record.status?.toLowerCase() !== 'archived' ||
            record.observation_mode?.toLowerCase() !== 'science' ||
            (!(
                Number.isFinite(exposureA) && exposureA > 0
            ) && !(
                Number.isFinite(exposureB) && exposureB > 0
            )) ||
            !Number.isFinite(publicDate) ||
            publicDate > Date.now()
        ) {
            continue;
        }

        records.push(record);
    }

    records.sort((a, b) =>
        Date.parse(b.time) - Date.parse(a.time)
    );

    console.log('NuSTAR public science records:', records.length);

    return records;
}



async function findNuSTARMedia(record) {
    const obsId = String(record.obsid).trim();

    if (!/^\d+$/.test(obsId)) return [];

const missionYear = `${obsId[1]}${obsId[0]}`;
const sourceCategory = obsId[0];

const directoryUrl =
    `https://heasarc.gsfc.nasa.gov/FTP/nustar/data/obs/${missionYear}/${sourceCategory}/${obsId}/event_cl/`;

    try {
        const html = await fetchText(directoryUrl);

        const files = [
            ...html.matchAll(/href=["']([^"']+\.gif)["']/gi)
        ].map(match => match[1]);

        const seen = new Set();

        const media = files.map(href => {
            const fileUrl = new URL(href, directoryUrl);

            const filename = decodeURIComponent(
                fileUrl.pathname.split('/').pop()
            );

            const moduleMatch = filename.match(/([AB])01_/i);
            const typeMatch = filename.match(
                /_(im|lc|ph)\.gif$/i
            );

            const module = moduleMatch
                ? moduleMatch[1].toUpperCase()
                : null;

            const suffix = typeMatch
                ? typeMatch[1].toLowerCase()
                : null;

            const types = {
                im: 'image',
                lc: 'lightcurve',
                ph: 'spectrum'
            };

            const type = types[suffix] || 'other';

            return {
                id: `${obsId}-${filename}`,
                filename,
                type,
                instrument: module
                    ? module === 'A' ? 'FPMA' : 'FPMB'
                    : null,
                imageUrl: fileUrl.href,
                productUrl: fileUrl.href
            };
        }).filter(item => {
            if (seen.has(item.filename)) return false;

            seen.add(item.filename);
            return true;
        });

        // Present familiar media types first.
        const priority = {
            image: 1,
            lightcurve: 2,
            spectrum: 3,
            other: 4
        };

        media.sort((a, b) => {
            const typeOrder =
                priority[a.type] - priority[b.type];

            if (typeOrder !== 0) return typeOrder;

            return (a.instrument || '').localeCompare(
                b.instrument || ''
            );
        });

        return media;

    } catch (error) {
        console.error(
            `NuSTAR media lookup failed for ${obsId}:`,
            error.message
        );

        return [];
    }
}



async function mapWithConcurrency(items, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (true) {
            const index = nextIndex++;

            if (index >= items.length) return;

            results[index] = await worker(items[index]);
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(CONCURRENCY, items.length) },
            () => runWorker()
        )
    );

    return results;
}

function parseNuSTARDate(value) {
    if (!value) return null;

    const normalized = value.includes('T')
        ? value
        : value.replace(' ', 'T');

    const utcValue = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
        ? normalized
        : `${normalized}Z`;

    const date = new Date(utcValue);

    return Number.isFinite(date.getTime())
        ? date.toISOString()
        : null;
}


export async function getNuSTARObservations(limit = 20) {
    const catalog = await getNuSTARCatalog();

    const observations = [];

    for (
        let i = 0;
        i < catalog.length && observations.length < limit;
        i += BATCH_SIZE
    ) {
        const batch = await mapWithConcurrency(
            catalog.slice(i, i + BATCH_SIZE),
            async record => {
                const media = await findNuSTARMedia(record);

                // Retain observations with any available media.
                if (!media.length) return null;

                const date = parseNuSTARDate(record.time);

                if (!date) return null;

                const target = record.name || 'Unknown target';
				
				const proposal = mapNuSTARProposal(record);

                const modules = [
                    ...new Set(
                        media
                            .map(item => item.instrument)
                            .filter(Boolean)
                    )
                ];

                const primaryMedia =
                    media.find(item => item.type === 'image') ||
                    media[0];

                return {
                    observationId: `NUSTAR-${record.obsid}`,
                    mission: 'NuSTAR',
                    target,
                    observationDate: date,

                    instrument: modules.length
                        ? modules.join(' / ')
                        : 'FPMA / FPMB',

                    title: `NuSTAR observation: ${target}`,

                    // Backward-compatible primary media.
                    imageUrl: primaryMedia.imageUrl,
                    productUrl:
                        `${NUSTAR_ARCHIVE}${record.obsid[0]}/${record.obsid}/event_cl/`,

                    // Complete media collection.
                    media,

                    archive: 'HEASARC',


					description: {
						summary:
							`NuSTAR X-ray Observatory observation of ${target}.`,

						imageExplanation:
							'This observation includes available NuSTAR quick-look media, which may include field-of-view images, X-ray light curves and energy spectra from the FPMA and FPMB telescope modules.',

						scientificContext:
							'NuSTAR uses two co-aligned X-ray telescope modules, FPMA and FPMB, to observe high-energy X-ray sources. Its quick-look products provide complementary information about the spatial distribution, temporal variability and spectral characteristics of the detected X-ray emission. Data supplied by the NuSTAR Science Operations Center and archived by HEASARC.',

						proposal,

						science: {
							objectClass: '',
							objectClassCode: '',
							researchObjective: '',
							astrophysicalContext:
								'High-energy X-ray astronomy using the NuSTAR observatory.',
							notableFeatures: ''
						},

						catalogue: {
							rightAscension: record.ra || '',
							declination: record.dec || '',
							observationType: record.obs_type || '',
							observationMode: record.observation_mode || '',
							exposureA: record.exposure_a || '',
							processingDate: record.processing_date || '',
							publicDate: record.public_date || '',
							issueFlag: record.issue_flag || ''
						}
					},


                    imageType: primaryMedia.type
                };
            }
        );

        observations.push(...batch.filter(Boolean));
    }

    console.log(
        'NuSTAR observations with media:',
        observations.length,
        'from',
        catalog.length,
        'catalogue records'
    );

    return normalizeObservations(observations).slice(0, limit);
}

export async function testNuSTARImageFormatCoverage() {
    console.log('Fetching NuSTAR catalogue for image format test...');

    const catalog = await getNuSTARCatalog();

    const results = await mapWithConcurrency(
        catalog,
        async record => {
            const obsId = String(record.obsid).trim();

            const directoryUrl =
                `${NUSTAR_ARCHIVE}${obsId[0]}/${obsId}/event_cl/`;

            try {
                const response = await fetch(directoryUrl);

				if (!response.ok) {
					return {
						obsid: obsId,
						formats: {
							gif: 0,
							jpeg: 0,
							png: 0
						},
						total: 0,
						accessible: false,
						status: response.status
					};
				}

				const html = await response.text();

                const files = [
                    ...html.matchAll(
                        /href=["']([^"']+\.(?:gif|jpe?g|png))["']/gi
                    )
                ].map(match => match[1]);

                const formats = {
                    gif: 0,
                    jpeg: 0,
                    png: 0
                };

                for (const file of files) {
                    const extension = file
                        .split('?')[0]
                        .split('.')
                        .pop()
                        .toLowerCase();

                    if (extension === 'gif') {
                        formats.gif++;
                    } else if (
                        extension === 'jpg' ||
                        extension === 'jpeg'
                    ) {
                        formats.jpeg++;
                    } else if (extension === 'png') {
                        formats.png++;
                    }
                }

                return {
                    obsid: obsId,
                    formats,
                    total: files.length,
                    accessible: true
                };

            } catch (error) {
                return {
				obsid: obsId,
				formats: {
					gif: 0,
					jpeg: 0,
					png: 0
				},
				total: 0,
				accessible: false,
				status: 'NETWORK_ERROR',
				error: error.message
			};
            }
        }
    );

    const summary = {
        catalogueRecords: results.length,
        accessibleDirectories: 0,
        inaccessibleDirectories: 0,
        gif: 0,
        jpeg: 0,
        png: 0,
        directoriesWithGif: 0,
        directoriesWithJpeg: 0,
        directoriesWithPng: 0,
        directoriesWithAnyImage: 0,
        directoriesWithNonGifOnly: 0,
		httpStatusDistribution: {}
    };

    for (const result of results) {
    const status = String(result.status || 200);

    summary.httpStatusDistribution[status] =
        (summary.httpStatusDistribution[status] || 0) + 1;

    if (!result.accessible) {
        summary.inaccessibleDirectories++;
        continue;
    }

    summary.accessibleDirectories++;

    summary.gif += result.formats.gif;
    summary.jpeg += result.formats.jpeg;
    summary.png += result.formats.png;

    if (result.formats.gif > 0) {
        summary.directoriesWithGif++;
    }

    if (result.formats.jpeg > 0) {
        summary.directoriesWithJpeg++;
    }

    if (result.formats.png > 0) {
        summary.directoriesWithPng++;
    }

    if (result.total > 0) {
        summary.directoriesWithAnyImage++;
    }

    if (
        result.formats.gif === 0 &&
        result.total > 0
    ) {
        summary.directoriesWithNonGifOnly++;
    }
}

    console.log('\n========== NUSTAR IMAGE FORMAT COVERAGE ==========');
    console.table(summary);

    console.log('\nSample directories containing JPEG or PNG:');

    console.table(
        results
            .filter(result =>
                result.formats.jpeg > 0 ||
                result.formats.png > 0
            )
            .slice(0, 15)
            .map(result => ({
                obsid: result.obsid,
                gif: result.formats.gif,
                jpeg: result.formats.jpeg,
                png: result.formats.png
            }))
    );

    return summary;
}

