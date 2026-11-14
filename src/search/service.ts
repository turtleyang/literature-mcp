import type { Config } from '../config.js';
import {
  type Paper,
  type PaperResult,
  type Source,
  type SourceStatus,
  mergePapers,
} from '../models/paper.js';
import type { SearchInput } from '../tools/schemas.js';
import { normalizeDoi } from '../utils/identifiers.js';
import { Cache, Failure, Semaphore, failure } from '../utils/control.js';
import { Http } from '../utils/http.js';
import type { Backend } from '../adapters/upstream.js';
import { openAlex, crossref, semantic, upstreamPaper } from '../adapters/normalize.js';
const keys: Partial<Record<Source, string[]>> = {
  wos_starter: ['WOS_API_KEY'],
  wos_expanded: ['WOS_EXPANDED_API_KEY'],
  scopus: ['SCOPUS_SEARCH_API_KEY', 'ELSEVIER_API_KEY'],
  sciencedirect: ['ELSEVIER_API_KEY'],
  springer: ['SPRINGER_API_KEY'],
};
const tools: Partial<Record<Source, string>> = {
  crossref: 'search_crossref',
  arxiv: 'search_arxiv',
  semantic_scholar: 'search_semantic_scholar',
  wos_starter: 'search_webofscience',
  wos_expanded: 'search_webofscience',
  scopus: 'search_scopus',
  sciencedirect: 'search_sciencedirect',
  springer: 'search_springer',
};
export class SearchService {
  private searchCache = new Cache<any>(5 * 60 * 1000);
  private metadataCache = new Cache<PaperResult>(60 * 60 * 1000);
  private gate: Semaphore;
  constructor(
    readonly cfg: Config,
    readonly http: Http,
    readonly backend: Backend,
  ) {
    this.gate = new Semaphore(cfg.searchConcurrency);
  }
  configured(source: Source): SourceStatus | undefined {
    const required = keys[source];
    if (required && !required.some((k) => this.cfg.env[k]))
      return { source, status: 'not_configured', reason: `Set ${required.join(' or ')}` };
    if (required && !this.cfg.authorization.has(source))
      return {
        source,
        status: 'restricted',
        reason: `Explicitly authorize ${source} in LITERATURE_AUTHORIZED_APIS`,
      };
  }
  private sourceContext(source: Source): Partial<SourceStatus> {
    if (source !== 'wos_starter' && source !== 'wos_expanded') return {};
    const version = (this.cfg.env.WOS_STARTER_VERSION || 'v2').toLowerCase();
    return {
      database: { id: 'WOS', name: 'Web of Science Core Collection' },
      api_product: source === 'wos_starter' ? 'starter' : 'expanded',
      ...(source === 'wos_starter'
        ? { api_capabilities: { pagination: true, total_matches: true } }
        : {}),
      ...(source === 'wos_starter' && (version === 'v1' || version === 'v2')
        ? { api_version: version }
        : {}),
    };
  }
  private async run(
    source: Source,
    fn: () => Promise<Paper[]>,
    signal?: AbortSignal,
  ): Promise<{ papers: Paper[]; state: SourceStatus }> {
    const configured = this.configured(source);
    const sourceContext = this.sourceContext(source);
    if (configured) return { papers: [], state: { ...configured, ...sourceContext } };
    const start = Date.now();
    try {
      const papers = await this.gate.run(fn, signal);
      return {
        papers,
        state: {
          ...sourceContext,
          source,
          status: papers.length ? 'ok' : 'not_found',
          elapsed_ms: Date.now() - start,
        },
      };
    } catch (e) {
      const f = failure(e);
      return {
        papers: [],
        state: {
          ...sourceContext,
          source,
          status: f.status,
          reason: f.message,
          elapsed_ms: Date.now() - start,
        },
      };
    }
  }
  async search(input: SearchInput, signal?: AbortSignal) {
    const selected: Source[] =
      input.mode === 'wos'
        ? [`wos_${input.wos_product}`]
        : input.sources ||
          (input.mode === 'deep'
            ? ['openalex', 'crossref', 'semantic_scholar']
            : ['openalex', 'crossref']);
    const chosen = [...new Set(selected)];
    const key = JSON.stringify({ ...input, sources: chosen });
    const cached = this.searchCache.get(key);
    if (cached)
      return {
        ...cached,
        cached: true,
        source_statuses: cached.source_statuses.map((s: SourceStatus) => ({ ...s, cached: true })),
      };
    const results = await Promise.all(
      chosen.map((source) =>
        this.run(source, () => this.searchSource(source, input, signal), signal),
      ),
    );
    let papers = mergePapers(
      results
        .flatMap((r) => r.papers)
        .filter(
          (p) =>
            (!input.year_from || (!!p.year && p.year >= input.year_from)) &&
            (!input.year_to || (!!p.year && p.year <= input.year_to)),
        ),
    );
    if (input.sort_by === 'date') papers.sort((a, b) => (b.year || 0) - (a.year || 0));
    if (input.sort_by === 'citations') papers.sort((a, b) => this.rankCount(b) - this.rankCount(a));
    const value = {
      status: results.every((r) => r.state.status === 'ok' || r.state.status === 'not_found')
        ? 'ok'
        : 'partial',
      query: input.query,
      papers: papers.slice(0, input.max_results).map((p) => ({
        ...p,
        authors: p.authors.slice(0, 8),
        author_count: p.authors.length,
        authors_truncated: p.authors.length > 8,
        open_access_locations: p.open_access_locations.slice(0, 4),
        abstract: undefined,
      })),
      source_statuses: results.map((r) => r.state),
      retrieval: {
        limitation_scope: 'this_mcp_tool',
        requested_max_results: input.max_results,
        returned_count: Math.min(papers.length, input.max_results),
        max_results_per_call: 50,
        total_matches: null,
        pagination_available: false,
        exhaustiveness_verified: false,
      },
      deduplicated: true,
      ranking:
        input.sort_by === 'citations'
          ? 'Within retrieved candidates: OpenAlex count when present, otherwise Crossref then another available source count. Counts remain separate; not a global ranking.'
          : input.sort_by === 'relevance'
            ? 'Source order, source relevance; not a systematic review'
            : 'Publication year descending',
      cached: false,
    };
    if (results.every((r) => ['ok', 'not_found'].includes(r.state.status)))
      this.searchCache.set(key, value);
    return value;
  }
  private rankCount(p: Paper) {
    return (
      p.citation_counts.openalex ??
      p.citation_counts.crossref ??
      p.citation_counts.semantic_scholar ??
      Object.values(p.citation_counts).find((v) => v !== null) ??
      -1
    );
  }
  private async searchSource(
    source: Source,
    input: SearchInput,
    signal?: AbortSignal,
  ): Promise<Paper[]> {
    if (source === 'openalex') {
      const u = new URL('https://api.openalex.org/works');
      u.searchParams.set('search', input.query);
      u.searchParams.set(
        'per-page',
        String(Math.min(input.max_results * (input.sort_by === 'citations' ? 2 : 1), 50)),
      );
      const filters = [];
      if (input.year_from) filters.push(`from_publication_date:${input.year_from}-01-01`);
      if (input.year_to) filters.push(`to_publication_date:${input.year_to}-12-31`);
      if (input.author_id) filters.push(`authorships.author.id:${input.author_id}`);
      if (input.journal_id) filters.push(`primary_location.source.id:${input.journal_id}`);
      if (input.min_citations !== undefined && input.min_citations > 0)
        filters.push(`cited_by_count:>${input.min_citations - 1}`);
      if (filters.length) u.searchParams.set('filter', filters.join(','));
      if (input.sort_by === 'date') u.searchParams.set('sort', 'publication_date:desc');
      if (this.cfg.env.OPENALEX_API_KEY)
        u.searchParams.set('api_key', this.cfg.env.OPENALEX_API_KEY);
      u.searchParams.set(
        'select',
        'id,doi,title,authorships,primary_location,publication_year,type,cited_by_count,locations',
      );
      const data = await this.http.json(u.href, { signal, source });
      if (!Array.isArray(data.results)) throw new Failure('failed', 'Invalid OpenAlex response');
      return data.results.map(openAlex);
    }
    const year =
      input.year_from || input.year_to
        ? `${input.year_from || 1500}-${input.year_to || new Date().getUTCFullYear()}`
        : undefined;
    const args: Record<string, unknown> = {
      query: input.query,
      maxResults: Math.min(
        input.max_results * (input.sort_by === 'citations' ? 2 : 1),
        source === 'scopus' ? 25 : 50,
      ),
      sortBy: source === 'crossref' ? 'relevance' : input.sort_by,
      ...(year ? { year } : {}),
    };
    if (source.startsWith('wos_')) {
      args.apiProduct = source === 'wos_expanded' ? 'expanded' : 'starter';
      args.discoverAccess = false;
      if (source === 'wos_expanded') args.recordView = input.record_view || 'short';
    }
    const data = await this.backend.call(tools[source]!, args, signal);
    if (!Array.isArray(data)) throw new Failure('failed', 'Invalid search result from upstream');
    return data.map((p: any) => upstreamPaper(p, source));
  }
  async get(
    doiInput: string,
    metadataSources: Source[] = ['crossref', 'openalex'],
    includeCitations = false,
    signal?: AbortSignal,
  ): Promise<PaperResult> {
    const doi = normalizeDoi(doiInput);
    const selected = [...new Set(metadataSources)];
    const key = JSON.stringify([doi, selected, includeCitations]);
    const cached = this.metadataCache.get(key);
    if (cached)
      return {
        ...cached,
        source_statuses: cached.source_statuses.map((s) => ({ ...s, cached: true })),
      };
    const results = await Promise.all(
      selected.map((source) =>
        this.run(
          source,
          async () => {
            const papers = await this.getSource(doi, source, signal);
            if (papers.some((p) => p.doi !== doi))
              throw new Failure('failed', 'Metadata DOI does not match target');
            return papers;
          },
          signal,
        ),
      ),
    );
    const paper =
      mergePapers(results.flatMap((r) => r.papers).filter((p) => p.doi === doi))[0] || null;
    const states = results.map((r) => r.state);
    const status = paper
      ? 'ok'
      : states.every((s) => s.status === 'not_found')
        ? 'not_found'
        : states.find((s) => !['not_found', 'ok'].includes(s.status))?.status || 'not_found';
    const result: PaperResult = { status, paper, source_statuses: states };
    if (includeCitations && paper) {
      const wos = paper.source_records.find((r) => r.source === 'wos_expanded');
      if (wos) {
        try {
          result.citations = {
            source: 'wos_expanded',
            limit: 20,
            records: await this.backend.call(
              'get_webofscience_related_records',
              { uid: wos.id, relation: 'citing', maxResults: 20, recordView: 'short' },
              signal,
            ),
          };
        } catch (e) {
          const f = failure(e);
          states.push({ source: 'wos_expanded_citations', status: f.status, reason: f.message });
        }
      } else {
        try {
          const u = new URL(
            `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}/citations`,
          );
          u.searchParams.set('limit', '20');
          u.searchParams.set('fields', 'title,externalIds,year');
          const data = await this.http.json(u.href, {
            signal,
            source: 'semantic_scholar',
            headers: this.cfg.env.SEMANTIC_SCHOLAR_API_KEY
              ? { 'x-api-key': this.cfg.env.SEMANTIC_SCHOLAR_API_KEY }
              : {},
            interval: 3100,
          });
          result.citations = { source: 'semantic_scholar', records: data.data, limit: 20 };
        } catch (e) {
          const f = failure(e);
          states.push({
            source: 'semantic_scholar_citations',
            status: f.status,
            reason: f.message,
          });
        }
      }
    }
    if (paper && states.every((s) => ['ok', 'not_found'].includes(s.status)))
      this.metadataCache.set(key, result);
    return result;
  }
  private async getSource(doi: string, source: Source, signal?: AbortSignal): Promise<Paper[]> {
    try {
      if (source === 'crossref') {
        const raw = await this.http.json(
          `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
          { signal, source, headers: { Accept: 'application/json' } },
        );
        return [crossref(raw.message)];
      }
      if (source === 'openalex') {
        const u = new URL(
          `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`,
        );
        if (this.cfg.env.OPENALEX_API_KEY)
          u.searchParams.set('api_key', this.cfg.env.OPENALEX_API_KEY);
        return [openAlex(await this.http.json(u.href, { signal, source }))];
      }
      if (source === 'semantic_scholar') {
        const u = new URL(
          `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}`,
        );
        u.searchParams.set(
          'fields',
          'title,authors,year,venue,journal,abstract,citationCount,externalIds,isOpenAccess,openAccessPdf,url,publicationTypes',
        );
        return [
          semantic(
            await this.http.json(u.href, {
              signal,
              source,
              headers: this.cfg.env.SEMANTIC_SCHOLAR_API_KEY
                ? { 'x-api-key': this.cfg.env.SEMANTIC_SCHOLAR_API_KEY }
                : {},
              interval: 3100,
            }),
          ),
        ];
      }
      const query = source.startsWith('wos_')
        ? `DO="${doi}"`
        : source === 'scopus'
          ? `DOI(${doi})`
          : source === 'springer'
            ? `doi:${doi}`
            : doi;
      const data = await this.searchSource(
        source,
        {
          query,
          max_results: 5,
          mode: 'fast',
          sort_by: 'relevance',
          wos_product: source === 'wos_expanded' ? 'expanded' : 'starter',
          record_view: source === 'wos_expanded' ? 'full' : undefined,
        },
        signal,
      );
      return data.filter((p) => p.doi === doi);
    } catch (e) {
      if (e instanceof Failure && e.status === 'not_found') return [];
      throw e;
    }
  }
}
