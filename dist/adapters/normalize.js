import { blankPaper } from '../models/paper.js';
import { maybeDoi, text } from '../utils/identifiers.js';
const count = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export function openAlex(data) {
    const p = blankPaper(maybeDoi(data.doi));
    Object.assign(p, {
        title: text(data.title || data.display_name),
        authors: (data.authorships || []).map((a) => text(a.author?.display_name)).filter(Boolean),
        journal: data.primary_location?.source?.display_name || null,
        year: data.publication_year || null,
        publisher: data.primary_location?.source?.host_organization_name || null,
        publication_type: data.type || null,
    });
    if (data.abstract_inverted_index) {
        const words = [];
        for (const [word, positions] of Object.entries(data.abstract_inverted_index))
            for (const pos of positions)
                words.push([pos, word]);
        p.abstract = text(words
            .sort((a, b) => a[0] - b[0])
            .map((v) => v[1])
            .join(' '));
    }
    p.source_records = [
        { source: 'openalex', id: data.id, url: p.doi ? `https://doi.org/${p.doi}` : data.id },
    ];
    p.citation_counts.openalex = count(data.cited_by_count);
    p.open_access_locations = (data.locations || [data.best_oa_location])
        .filter((l) => l?.is_oa)
        .map((l) => ({
        source: 'openalex',
        url: l.pdf_url || l.landing_page_url,
        landing_page_url: l.landing_page_url,
        format: l.pdf_url ? 'pdf' : undefined,
        version: l.version || 'unknown',
        license: l.license,
        is_oa: true,
        evidence: 'OpenAlex DOI-matched work location',
        doi: p.doi || undefined,
    }))
        .filter((l) => !!l.url);
    p.available_formats = p.open_access_locations.some((l) => l.format === 'pdf') ? ['pdf'] : [];
    p.available_fulltext_formats = p.available_formats;
    p.fulltext_access_status = p.open_access_locations.length ? 'open_access' : 'unknown';
    return p;
}
export function crossref(data) {
    const p = blankPaper(maybeDoi(data.DOI));
    const date = data['published-print'] || data['published-online'] || data.published;
    Object.assign(p, {
        title: text(data.title?.[0]),
        authors: (data.author || [])
            .map((a) => text([a.given, a.family].filter(Boolean).join(' ') || a.name))
            .filter(Boolean),
        journal: text(data['container-title']?.[0]) || null,
        year: date?.['date-parts']?.[0]?.[0] || null,
        publisher: text(data.publisher) || null,
        abstract: text(data.abstract) || null,
        publication_type: data.type || null,
    });
    p.citation_counts.crossref = count(data['is-referenced-by-count']);
    p.source_records = [{ source: 'crossref', id: p.doi || '', url: data.URL }];
    // Crossref TDM links are not proof of OA or API entitlement.
    return p;
}
export function semantic(data) {
    const p = blankPaper(maybeDoi(data.externalIds?.DOI));
    Object.assign(p, {
        title: text(data.title),
        authors: (data.authors || []).map((a) => text(a.name)),
        journal: data.journal?.name || data.venue || null,
        year: data.year || null,
        abstract: text(data.abstract) || null,
        publication_type: data.publicationTypes?.[0] || null,
    });
    p.citation_counts.semantic_scholar = count(data.citationCount);
    p.source_records = [{ source: 'semantic_scholar', id: data.paperId, url: data.url }];
    if (data.externalIds?.ArXiv)
        p.arxiv_id = data.externalIds.ArXiv;
    if (data.isOpenAccess && data.openAccessPdf?.url)
        p.open_access_locations = [
            {
                source: 'semantic_scholar',
                url: data.openAccessPdf.url,
                format: 'pdf',
                version: 'unknown',
                license: data.openAccessPdf.license,
                is_oa: true,
                evidence: 'Semantic Scholar exact DOI record',
                doi: p.doi || undefined,
            },
        ];
    p.available_formats = p.open_access_locations.length ? ['pdf'] : [];
    p.available_fulltext_formats = p.available_formats;
    p.fulltext_access_status = p.open_access_locations.length ? 'open_access' : 'unknown';
    return p;
}
export function upstreamPaper(data, source) {
    const p = blankPaper(maybeDoi(data.doi));
    let extra = {};
    try {
        extra = typeof data.extra === 'string' ? JSON.parse(data.extra) : data.extra || {};
    }
    catch { }
    Object.assign(p, {
        title: text(data.title),
        authors: Array.isArray(data.authors)
            ? data.authors
            : typeof data.authors === 'string'
                ? data.authors
                    .split(';')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
        journal: data.journal || null,
        year: data.year || Number(String(data.published_date || '').slice(0, 4)) || null,
        publisher: extra.publisher || null,
        abstract: text(data.abstract) || null,
        publication_type: extra.type || extra.contentType || null,
    });
    p.source_records = [
        {
            source,
            id: data.paper_id || data.paperId || p.doi || '',
            url: data.url,
            record_view: extra.recordView,
        },
    ];
    // Upstream coerces missing Crossref/Semantic/arXiv counts to zero. Never invent a measured zero.
    p.citation_counts[source] =
        source === 'arxiv' ||
            (['crossref', 'semantic_scholar'].includes(source) && data.citation_count === 0)
            ? null
            : count(data.citation_count);
    if (source === 'arxiv') {
        const id = extra.arxivId || data.paper_id;
        p.arxiv_id = id;
        p.preprint = true;
        p.publication_type = 'preprint';
        if (id)
            p.open_access_locations = [
                {
                    source: 'arxiv',
                    url: `https://arxiv.org/pdf/${id}`,
                    landing_page_url: `https://arxiv.org/abs/${id}`,
                    format: 'pdf',
                    version: 'submittedVersion',
                    is_oa: true,
                    evidence: 'arXiv identifier from source record',
                    doi: p.doi || undefined,
                    arxiv_id: id,
                },
            ];
    }
    else if (data.pdf_url && (extra.openAccess || extra.isOpenAccess)) {
        p.open_access_locations = [
            {
                source,
                url: data.pdf_url,
                format: 'pdf',
                version: 'unknown',
                is_oa: true,
                evidence: `${source} exact record reports OA`,
                doi: p.doi || undefined,
            },
        ];
    }
    p.available_formats = p.open_access_locations.length ? ['pdf'] : [];
    p.available_fulltext_formats = p.available_formats;
    p.fulltext_access_status = p.open_access_locations.length ? 'open_access' : 'unknown';
    return p;
}
//# sourceMappingURL=normalize.js.map