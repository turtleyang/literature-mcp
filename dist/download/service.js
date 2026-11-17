import { blankPaper } from '../models/paper.js';
import { Failure, Semaphore, failure } from '../utils/control.js';
import { normalizeDoi, normalizeArxiv } from '../utils/identifiers.js';
import { Discovery } from './adapters.js';
export class DownloadService {
    cfg;
    search;
    http;
    library;
    queue;
    discovery;
    constructor(cfg, search, http, library) {
        this.cfg = cfg;
        this.search = search;
        this.http = http;
        this.library = library;
        this.queue = new Semaphore(cfg.downloadConcurrency, 20);
        this.discovery = new Discovery(cfg, http);
    }
    async download(input, signal) {
        const doi = input.doi ? normalizeDoi(input.doi) : undefined;
        const arxiv = input.arxiv_id ? normalizeArxiv(input.arxiv_id) : undefined;
        const identifier = doi || `arxiv:${arxiv}`;
        const start = Date.now();
        let result;
        try {
            result = await this.queue.run(() => this.library.locked(identifier, async () => {
                // Validate destinations even on a local hit; no path creation outside allowed roots.
                if (input.save_directory)
                    await this.library.directory(input.save_directory);
                if (!input.overwrite) {
                    const existing = await this.library.existing(identifier);
                    if (existing)
                        return existing;
                }
                const attempts = [];
                let paper = null;
                if (doi) {
                    const metadata = await this.search.get(doi, undefined, false, signal);
                    paper = metadata.paper;
                    attempts.push(...metadata.source_statuses);
                }
                else {
                    paper = blankPaper();
                    paper.arxiv_id = arxiv;
                    paper.preprint = true;
                    paper.publication_type = 'preprint';
                }
                let tried = 0;
                const seen = new Set();
                let fallback;
                const attempt = async (candidates) => {
                    for (const originalCandidate of candidates) {
                        let candidate = originalCandidate;
                        signal?.throwIfAborted();
                        if (tried >= this.cfg.maxCandidates)
                            return;
                        if (seen.has(candidate.url))
                            continue;
                        seen.add(candidate.url);
                        tried++;
                        const began = Date.now();
                        try {
                            if (candidate.source === 'arxiv' &&
                                candidate.identity.arxiv_id &&
                                !/v\d+$/.test(candidate.identity.arxiv_id)) {
                                candidate = (await this.discovery.arxiv(candidate.identity.arxiv_id, doi, signal))[0];
                                seen.add(candidate.url);
                            }
                            const response = await this.http.request(candidate.url, {
                                headers: candidate.headers,
                                signal,
                                download: true,
                                source: candidate.source,
                                interval: candidate.interval,
                            });
                            if (candidate.metadata && paper)
                                for (const [key, value] of Object.entries(candidate.metadata)) {
                                    if (!paper[key] ||
                                        (Array.isArray(paper[key]) && !paper[key].length))
                                        paper[key] = value;
                                }
                            const saved = await this.library.save(identifier, response, candidate.identity, candidate.source, paper, input.save_directory, input.overwrite, candidate.version, signal);
                            attempts.push({
                                source: candidate.source,
                                status: 'ok',
                                elapsed_ms: Date.now() - began,
                            });
                            saved.attempts = attempts;
                            if (saved.format === 'pdf')
                                return saved;
                            // Retain real XML, but continue looking for a legal PDF. Never call it a PDF.
                            fallback = saved;
                        }
                        catch (e) {
                            let f = failure(e);
                            if (candidate.wiley && f.httpStatus && [400, 401, 403].includes(f.httpStatus))
                                f = new Failure('credentials_required', 'Wiley TDM token is invalid, missing, or not registered', f.httpStatus);
                            if (candidate.wiley && f.httpStatus === 404)
                                f = new Failure('restricted', 'Wiley 404 may indicate lack of subscription access; it does not establish paper absence', 404);
                            attempts.push({
                                source: candidate.source,
                                status: f.status,
                                reason: f.message,
                                elapsed_ms: Date.now() - began,
                            });
                            if (f.status === 'cancelled')
                                throw f;
                        }
                    }
                };
                const preferred = input.preferred_source;
                const pub = paper?.publisher?.toLowerCase() || '';
                const publisher = preferred === 'wiley'
                    ? 'wiley'
                    : preferred === 'elsevier'
                        ? 'elsevier'
                        : preferred === 'springer'
                            ? 'springer_tdm'
                            : doi?.startsWith('10.1002/') ||
                                doi?.startsWith('10.1111/') ||
                                /wiley/.test(pub)
                                ? 'wiley'
                                : doi?.startsWith('10.1016/') || /elsevier/.test(pub)
                                    ? 'elsevier'
                                    : doi?.startsWith('10.1007/') ||
                                        doi?.startsWith('10.1038/') ||
                                        /springer|nature/.test(pub)
                                        ? 'springer_tdm'
                                        : undefined;
                let order = this.cfg.order;
                if (preferred === 'wiley' || preferred === 'elsevier')
                    order = [preferred];
                else if (preferred === 'springer')
                    order = ['springer_oa', 'springer_tdm'];
                else if (preferred === 'arxiv')
                    order = ['arxiv'];
                else if (preferred === 'open_access')
                    order = order.filter((s) => !['wiley', 'elsevier', 'springer_tdm'].includes(s));
                for (const source of order) {
                    signal?.throwIfAborted();
                    if (tried >= this.cfg.maxCandidates)
                        break;
                    let candidates = [];
                    try {
                        if (source === 'springer_oa' && !input.allow_publisher_api) {
                            attempts.push({
                                source,
                                status: 'restricted',
                                reason: 'allow_publisher_api=false',
                            });
                            continue;
                        }
                        if (source === 'arxiv') {
                            if (arxiv)
                                candidates = await this.discovery.arxiv(arxiv, doi, signal);
                            else if (doi?.startsWith('10.48550/arxiv.'))
                                candidates = await this.discovery.arxiv(doi.slice('10.48550/arxiv.'.length), doi, signal);
                            else if (doi)
                                candidates = (paper?.open_access_locations || [])
                                    .map((l) => this.discovery.location(l, doi))
                                    .filter((c) => !!c && c.source === 'arxiv');
                        }
                        else if (source === 'openalex' && doi)
                            candidates = (paper?.open_access_locations || [])
                                .filter((l) => l.source === 'openalex')
                                .map((l) => this.discovery.location(l, doi))
                                .filter((c) => !!c);
                        else if (source === 'unpaywall' && doi && this.cfg.unpaywallEmail)
                            candidates = await this.discovery.unpaywall(doi, signal);
                        else if (source === 'pmc' &&
                            doi &&
                            (/^(?:10\.1371|10\.1186)\//.test(doi) ||
                                (paper?.open_access_locations || []).some((l) => /pmc|europepmc/.test(l.url))))
                            candidates = await this.discovery.pmc(doi, signal);
                        else if (source === 'semantic_scholar' && doi) {
                            // Supplement only after primary OA candidates fail; this is one exact lookup.
                            const result = await this.search.get(doi, ['semantic_scholar'], false, signal);
                            attempts.push(...result.source_statuses);
                            candidates = (result.paper?.open_access_locations || [])
                                .map((l) => this.discovery.location(l, doi))
                                .filter((c) => !!c);
                        }
                        else if (source === 'springer_oa' &&
                            doi &&
                            publisher === 'springer_tdm' &&
                            this.cfg.env.SPRINGER_OPENACCESS_API_KEY &&
                            this.cfg.authorization.has('springer_oa'))
                            candidates = await this.discovery.springerOa(doi, signal);
                        else if (['wiley', 'elsevier', 'springer_tdm'].includes(source) &&
                            doi &&
                            publisher === source) {
                            if (!input.allow_publisher_api) {
                                attempts.push({
                                    source,
                                    status: 'restricted',
                                    reason: 'allow_publisher_api=false',
                                });
                                continue;
                            }
                            candidates = this.discovery.publisher(source, doi);
                        }
                        const success = await attempt(candidates);
                        if (success)
                            return success;
                    }
                    catch (e) {
                        const f = failure(e);
                        attempts.push({ source, status: f.status, reason: f.message });
                        if (f.status === 'cancelled')
                            throw f;
                    }
                }
                if (fallback)
                    return {
                        ...fallback,
                        publisher_url: doi ? `https://doi.org/${doi}` : undefined,
                        open_access_locations: paper?.open_access_locations || [],
                        attempts,
                    };
                const relevant = attempts.filter((s) => s.source !== 'crossref' &&
                    s.source !== 'openalex' &&
                    s.status !== 'ok' &&
                    s.status !== 'not_found');
                const rate = relevant.find((s) => s.status === 'rate_limited');
                const creds = relevant.find((s) => s.status === 'credentials_required');
                const bad = relevant.find((s) => ['failed', 'unsupported_format', 'timeout', 'cancelled'].includes(s.status));
                const state = rate?.status ||
                    creds?.status ||
                    bad?.status ||
                    (!doi &&
                        arxiv &&
                        attempts.some((s) => s.source === 'arxiv' && s.status === 'not_found')
                        ? 'not_found'
                        : 'restricted');
                return {
                    status: state,
                    doi,
                    arxiv_id: arxiv,
                    reason: rate?.reason ||
                        creds?.reason ||
                        bad?.reason ||
                        'No verified, authorized downloadable full text was found',
                    publisher_url: doi
                        ? `https://doi.org/${doi}`
                        : arxiv
                            ? `https://arxiv.org/abs/${arxiv}`
                            : undefined,
                    open_access_locations: paper?.open_access_locations || [],
                    requires_institutional_authorization: !!publisher,
                    attempts,
                };
            }), signal);
        }
        catch (e) {
            const f = failure(e);
            result = {
                status: f.status === 'not_configured'
                    ? 'credentials_required'
                    : f.status === 'ok'
                        ? 'failed'
                        : f.status,
                doi,
                arxiv_id: arxiv,
                reason: f.message,
            };
        }
        await this.library.log({
            kind: 'download',
            identifier,
            status: result.status,
            source: result.source,
            format: result.format,
            bytes: result.bytes,
            elapsed_ms: Date.now() - start,
        });
        return result;
    }
}
//# sourceMappingURL=service.js.map