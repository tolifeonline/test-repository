export function normalizeObservation(item) {
    if (!item || !item.observationId) return null;

    const description = item.description || {};
    const proposal = description.proposal || null;
	
	const media = Array.isArray(item.media)
		? item.media
			.filter(file => file && file.imageUrl)
			.map(file => ({
				id: String(file.id || ''),
				filename: String(file.filename || ''),
				type: String(file.type || 'other'),
				instrument: file.instrument || null,
				imageUrl: file.imageUrl,
				productUrl: file.productUrl || null
			}))
		: [];



return {
    observationId: String(item.observationId),
    mission: String(item.mission || ''),
    target: String(item.target || 'Unknown target'),
    observationDate: item.observationDate || null,
    instrument: String(item.instrument || 'Not specified'),
    title: String(item.title || item.target || 'Untitled observation'),
	imageUrl: item.imageUrl ||
		media.find(file => file.type === 'image')?.imageUrl ||
		media[0]?.imageUrl ||
		null,

	imageType: item.imageType || media[0]?.type || 'preview',

	media,
    // Preserve original scientific FITS data.
    fitsUrl: item.fitsUrl || null,
    fitsFilename: item.fitsFilename || null,
    fitsCompression: item.fitsCompression || null,
    fitsSizeBytes: item.fitsSizeBytes ?? null,
    fitsOriginalSizeBytes: item.fitsOriginalSizeBytes ?? null,
    fitsSha256: item.fitsSha256 || null,

    productUrl: item.productUrl || null,
    archive: String(item.archive || ''),

    // Preserve HST proposal metadata.
	proposal_id: item.proposal_id || proposal?.id || null,
	proposal_pi: item.proposal_pi || proposal?.principalInvestigator || null,
	proposal_type: item.proposal_type || proposal?.proposalType || null,

    description: {
        summary: String(description.summary || ''),
        imageExplanation: String(description.imageExplanation || ''),
        scientificContext: String(description.scientificContext || ''),

   		// Preserve enriched proposal details.
		proposal: proposal ? {
			id: proposal.id || '',
			title: proposal.title || '',
			principalInvestigator:
				proposal.principalInvestigator || '',
			coPrincipalInvestigator:
				proposal.coPrincipalInvestigator || '',
			proposalType: proposal.proposalType || '',
			scienceCategory: proposal.scienceCategory || '',
			abstract: proposal.abstract || '',
			program: proposal.program || '',
			cycle: proposal.cycle || '',
			country: proposal.country || '',
			observationType: proposal.observationType || '',
			categoryCode: proposal.categoryCode || '',
			priority: proposal.priority || '',
			source: proposal.source || ''
		} : null,

        // Preserve enriched scientific classification.
        science: {
            objectClass: description.science?.objectClass || '',
            objectClassCode:
                description.science?.objectClassCode || '',
            researchObjective:
                description.science?.researchObjective || '',
            astrophysicalContext:
                description.science?.astrophysicalContext || '',
            notableFeatures:
                description.science?.notableFeatures || ''
	        },
			
		catalogue: description.catalogue ? {
            rightAscension:
                description.catalogue.rightAscension || '',
            declination:
                description.catalogue.declination || '',
            observationType:
                description.catalogue.observationType || '',
            observationMode:
                description.catalogue.observationMode || '',
            exposureA:
                description.catalogue.exposureA || '',
            processingDate:
                description.catalogue.processingDate || '',
            publicDate:
                description.catalogue.publicDate || '',
			issueFlag: (() => {
				const value = String(
					description.catalogue.issueFlag || ''
				).trim();

				return value.toLowerCase() === 'null' ? '' : value;
			})()
        } : null
    }
};

}

export function normalizeObservations(items) {
    if (!Array.isArray(items)) return [];

    const seen = new Set();
    const missionCounts = new Map();

    return items
        .map(normalizeObservation)
        .filter(item => {
		// Retain observations with either a preview or associated media.
		if (!item || (!item.imageUrl && !item.media?.length)) {
			return false;
		}

            const key = `${item.archive}:${item.observationId}`;

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
        })
        .sort((a, b) =>
            (Date.parse(b.observationDate) || 0) -
            (Date.parse(a.observationDate) || 0)
        )
        .filter(item => {
            // Retain up to 20 observations per mission.
            const mission = item.mission || 'UNKNOWN';
            const count = missionCounts.get(mission) || 0;

            if (count >= 20) return false;

            missionCounts.set(mission, count + 1);
            return true;
        });
}