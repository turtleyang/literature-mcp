export const sources = [
    'openalex',
    'crossref',
    'semantic_scholar',
    'arxiv',
    'wos_starter',
    'wos_expanded',
    'scopus',
    'sciencedirect',
    'springer',
];
export const blankPaper = (doi = null) => ({
    doi,
    title: '',
    authors: [],
    journal: null,
    year: null,
    publisher: null,
    abstract: null,
    publication_type: null,
    source_records: [],
    citation_counts: {},
    open_access_locations: [],
    fulltext_access_status: 'unknown',
    available_formats: [],
    available_fulltext_formats: [],
    local_file_path: null,
    downloaded_from: null,
    downloaded_at: null,
});
export function mergePapers(papers) {
    const grouped = new Map();
    for (const p of papers) {
        const key = p.doi || p.source_records.map((r) => `${r.source}:${r.id}`).join('|');
        const old = grouped.get(key);
        if (!old) {
            grouped.set(key, structuredClone(p));
            continue;
        }
        for (const field of [
            'title',
            'journal',
            'year',
            'publisher',
            'abstract',
            'publication_type',
            'arxiv_id',
        ]) {
            if (!old[field] && p[field])
                old[field] = p[field];
        }
        if (!old.authors.length)
            old.authors = p.authors;
        old.source_records = [
            ...new Map([...old.source_records, ...p.source_records].map((r) => [`${r.source}:${r.id}`, r])).values(),
        ];
        Object.assign(old.citation_counts, p.citation_counts);
        old.open_access_locations = [
            ...new Map([...old.open_access_locations, ...p.open_access_locations].map((l) => [l.url, l])).values(),
        ];
        old.available_formats = [...new Set([...old.available_formats, ...p.available_formats])];
        old.available_fulltext_formats = old.available_formats;
        if (old.open_access_locations.some((l) => l.is_oa))
            old.fulltext_access_status = 'open_access';
        // A merged journal record may have an associated preprint; version lives on each location.
        if (p.preprint && old.publication_type === 'preprint')
            old.preprint = true;
    }
    return [...grouped.values()];
}
//# sourceMappingURL=paper.js.map