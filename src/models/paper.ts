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
] as const;
export type Source = (typeof sources)[number];
export type Status =
  | 'ok'
  | 'not_configured'
  | 'credentials_required'
  | 'restricted'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'cancelled'
  | 'unsupported_format'
  | 'failed';
export type Format = 'pdf' | 'xml' | 'html';
export interface SourceStatus {
  source: string;
  status: Status;
  reason?: string;
  elapsed_ms?: number;
  cached?: boolean;
}
export interface Location {
  source: string;
  url: string;
  landing_page_url?: string;
  format?: Format;
  version: string;
  license?: string | null;
  is_oa: boolean;
  evidence: string;
  doi?: string;
  arxiv_id?: string;
}
export interface Paper {
  doi: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  publisher: string | null;
  abstract: string | null;
  publication_type: string | null;
  arxiv_id?: string;
  preprint?: boolean;
  source_records: Array<{ source: string; id: string; url?: string; record_view?: string }>;
  citation_counts: Record<string, number | null>;
  open_access_locations: Location[];
  fulltext_access_status: 'open_access' | 'unknown' | 'subscription_or_tdm';
  available_formats: Format[];
  available_fulltext_formats: Format[];
  local_file_path: string | null;
  downloaded_from: string | null;
  downloaded_at: string | null;
}
export const blankPaper = (doi: string | null = null): Paper => ({
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
export interface PaperResult {
  status: Status;
  paper: Paper | null;
  source_statuses: SourceStatus[];
  citations?: unknown;
}
export interface DownloadResult {
  status: 'downloaded' | 'already_exists' | Exclude<Status, 'ok' | 'not_configured'>;
  doi?: string;
  arxiv_id?: string;
  source?: string;
  format?: Format;
  file_path?: string;
  verified?: boolean;
  identity_verification?: string;
  sha256?: string;
  bytes?: number;
  version?: string;
  downloaded_at?: string;
  reason?: string;
  publisher_url?: string;
  open_access_locations?: Location[];
  requires_institutional_authorization?: boolean;
  attempts?: SourceStatus[];
}
export function mergePapers(papers: Paper[]): Paper[] {
  const grouped = new Map<string, Paper>();
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
    ] as const) {
      if (!old[field] && p[field]) (old as any)[field] = p[field];
    }
    if (!old.authors.length) old.authors = p.authors;
    old.source_records = [
      ...new Map(
        [...old.source_records, ...p.source_records].map((r) => [`${r.source}:${r.id}`, r]),
      ).values(),
    ];
    Object.assign(old.citation_counts, p.citation_counts);
    old.open_access_locations = [
      ...new Map(
        [...old.open_access_locations, ...p.open_access_locations].map((l) => [l.url, l]),
      ).values(),
    ];
    old.available_formats = [...new Set([...old.available_formats, ...p.available_formats])];
    old.available_fulltext_formats = old.available_formats;
    if (old.open_access_locations.some((l) => l.is_oa)) old.fulltext_access_status = 'open_access';
    // A merged journal record may have an associated preprint; version lives on each location.
    if (p.preprint && old.publication_type === 'preprint') old.preprint = true;
  }
  return [...grouped.values()];
}
