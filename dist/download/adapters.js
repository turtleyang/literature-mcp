import { XMLParser } from 'fast-xml-parser';
import { maybeDoi, normalizeArxiv } from '../utils/identifiers.js';
import { Failure } from '../utils/control.js';
/** Reserved extension points: no unsupported publisher is presented as implemented. */
export const reservedPublishers = [
    'acs',
    'rsc',
    'ieee',
    'taylor_francis',
    'iop',
    'aip',
    'aps',
];
export class Discovery {
    cfg;
    http;
    constructor(cfg, http) {
        this.cfg = cfg;
        this.http = http;
    }
    location(l, doi) {
        if (!l.is_oa || l.doi !== doi || !l.format || l.format === 'html')
            return;
        const arxiv = (() => {
            try {
                const u = new URL(l.url);
                return /(^|\.)arxiv\.org$/.test(u.hostname)
                    ? normalizeArxiv(u.pathname.replace(/^\/(?:pdf|abs)\//, ''))
                    : undefined;
            }
            catch {
                return undefined;
            }
        })();
        const authoritative = !!arxiv;
        return {
            source: arxiv ? 'arxiv' : l.source,
            url: arxiv ? `https://arxiv.org/pdf/${arxiv}` : l.url,
            version: arxiv ? 'submittedVersion' : l.version,
            identity: {
                doi,
                arxiv_id: arxiv,
                authoritative,
                evidence: arxiv
                    ? 'arXiv ID explicitly associated with target DOI by source record'
                    : l.evidence,
            },
            interval: arxiv ? 3100 : 500,
        };
    }
    async arxiv(idInput, doi, signal) {
        const id = normalizeArxiv(idInput);
        const u = new URL('https://export.arxiv.org/api/query');
        u.searchParams.set('id_list', id);
        const raw = await this.http.request(u.href, { signal, source: 'arxiv', interval: 3100 });
        const data = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(raw.data.toString());
        let entry = data.feed?.entry;
        if (Array.isArray(entry))
            entry = entry[0];
        if (!entry?.id || !/arxiv\.org\/abs\//.test(entry.id))
            throw new Failure('not_found', 'arXiv identifier not found');
        const resolved = normalizeArxiv(entry.id);
        if (resolved.replace(/v\d+$/, '') !== id.replace(/v\d+$/, '') ||
            (/v\d+$/.test(id) && resolved !== id))
            throw new Failure('failed', 'arXiv version mismatch');
        if (doi &&
            doi !== `10.48550/arxiv.${resolved.replace(/v\d+$/, '').toLowerCase()}` &&
            maybeDoi(entry.doi) !== doi)
            throw new Failure('failed', 'arXiv metadata does not establish the supplied DOI relationship');
        return [
            {
                source: 'arxiv',
                url: `https://arxiv.org/pdf/${resolved}`,
                version: `submittedVersion (${resolved})`,
                identity: {
                    doi,
                    arxiv_id: resolved,
                    authoritative: true,
                    evidence: 'Official arXiv API ID and version mapping',
                },
                interval: 3100,
                metadata: {
                    title: String(entry.title || '')
                        .replace(/\s+/g, ' ')
                        .trim(),
                    authors: (Array.isArray(entry.author) ? entry.author : [entry.author])
                        .filter(Boolean)
                        .map((a) => a.name),
                    year: entry.published ? Number(String(entry.published).slice(0, 4)) : null,
                    arxiv_id: resolved,
                    preprint: true,
                    publication_type: 'preprint',
                    source_records: [
                        { source: 'arxiv', id: resolved, url: `https://arxiv.org/abs/${resolved}` },
                    ],
                },
            },
        ];
    }
    async unpaywall(doi, signal) {
        if (!this.cfg.unpaywallEmail)
            throw new Failure('credentials_required', 'Set UNPAYWALL_EMAIL to use the official API');
        const u = new URL(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`);
        u.searchParams.set('email', this.cfg.unpaywallEmail);
        const data = await this.http.json(u.href, { signal, source: 'unpaywall' });
        if (maybeDoi(data.doi) !== doi)
            throw new Failure('failed', 'Unpaywall DOI mismatch');
        return (data.oa_locations || [])
            .filter((l) => !!l.url_for_pdf)
            .map((l) => this.location({
            source: 'unpaywall',
            url: l.url_for_pdf,
            format: 'pdf',
            version: l.version || 'unknown',
            is_oa: true,
            evidence: 'Unpaywall exact DOI location',
            doi,
        }, doi))
            .filter(Boolean);
    }
    async pmc(doi, signal) {
        const u = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
        u.searchParams.set('query', `DOI:"${doi}" AND OPEN_ACCESS:Y`);
        u.searchParams.set('format', 'json');
        u.searchParams.set('resultType', 'core');
        u.searchParams.set('pageSize', '3');
        const data = await this.http.json(u.href, { signal, source: 'europe_pmc' });
        const rec = (data.resultList?.result || []).find((r) => maybeDoi(r.doi) === doi && r.isOpenAccess === 'Y' && /^PMC\d+$/.test(r.pmcid));
        if (!rec)
            return [];
        return [
            {
                source: 'europe_pmc',
                url: `https://www.ebi.ac.uk/europepmc/webservices/rest/${rec.pmcid}/fullTextXML`,
                version: 'publishedVersion',
                identity: {
                    doi,
                    authoritative: true,
                    evidence: 'Europe PMC exact DOI and PMC ID OA record',
                },
            },
        ];
    }
    async springerOa(doi, signal) {
        const key = this.cfg.env.SPRINGER_OPENACCESS_API_KEY;
        if (!key)
            throw new Failure('credentials_required', 'Set SPRINGER_OPENACCESS_API_KEY');
        if (!this.cfg.authorization.has('springer_oa'))
            throw new Failure('restricted', 'Springer OA API not explicitly authorized');
        const u = new URL('https://api.springernature.com/openaccess/json');
        u.searchParams.set('q', `doi:${doi}`);
        u.searchParams.set('api_key', key);
        u.searchParams.set('p', '2');
        const data = await this.http.json(u.href, { signal, source: 'springer_oa', interval: 1000 });
        const record = (data.records || []).find((r) => maybeDoi(r.doi) === doi);
        if (!record)
            return [];
        const identity = { doi, authoritative: true, evidence: 'Springer official exact DOI OA API' };
        const out = (record.url || [])
            .filter((l) => l.format === 'pdf')
            .map((l) => ({
            source: 'springer_oa',
            url: l.value,
            version: 'publishedVersion',
            identity,
        }));
        const xml = new URL('https://api.springernature.com/openaccess/jats');
        xml.searchParams.set('q', `doi:${doi}`);
        xml.searchParams.set('api_key', key);
        out.push({
            source: 'springer_oa',
            url: xml.href,
            version: 'publishedVersion',
            identity,
            interval: 1000,
        });
        return out;
    }
    publisher(source, doi) {
        const env = this.cfg.env;
        const key = source === 'wiley'
            ? env.WILEY_TDM_TOKEN
            : source === 'elsevier'
                ? env.ELSEVIER_API_KEY
                : env.SPRINGER_TDM_API_KEY;
        if (!key)
            throw new Failure('credentials_required', `Missing ${source} full-text credential`);
        if (!this.cfg.authorization.has(source))
            throw new Failure('restricted', `Explicit ${source} API/TDM entitlement is required`);
        const identity = {
            doi,
            authoritative: true,
            evidence: `Official ${source} DOI-addressed full-text endpoint`,
        };
        if (source === 'wiley')
            return [
                {
                    source: 'wiley_tdm',
                    url: `https://api.wiley.com/onlinelibrary/tdm/v1/articles/${encodeURIComponent(doi)}`,
                    headers: { 'Wiley-TDM-Client-Token': key, Accept: 'application/pdf' },
                    version: 'publishedVersion',
                    identity,
                    interval: 11000,
                    wiley: true,
                },
            ];
        if (source === 'elsevier')
            return [
                {
                    source: 'elsevier_article',
                    url: `https://api.elsevier.com/content/article/doi/${encodeURIComponent(doi)}?view=FULL`,
                    headers: {
                        'X-ELS-APIKey': key,
                        ...(env.ELSEVIER_INST_TOKEN ? { 'X-ELS-Insttoken': env.ELSEVIER_INST_TOKEN } : {}),
                        Accept: this.cfg.elsevierFormat === 'pdf' ? 'application/pdf' : 'text/xml',
                    },
                    version: 'publishedVersion',
                    identity,
                    interval: 1000,
                },
            ];
        const u = new URL('https://api.springernature.com/xmldata/jats');
        u.searchParams.set('q', `doi:${doi}`);
        u.searchParams.set('api_key', key);
        return [
            {
                source: 'springer_tdm',
                url: u.href,
                version: 'publishedVersion',
                identity,
                interval: 1000,
            },
        ];
    }
}
//# sourceMappingURL=adapters.js.map