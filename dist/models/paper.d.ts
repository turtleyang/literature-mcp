export declare const sources: readonly ['openalex', 'crossref', 'semantic_scholar', 'arxiv', 'wos_starter', 'wos_expanded', 'scopus', 'sciencedirect', 'springer'];
export type Source = (typeof sources)[number];
export type Status = 'ok' | 'not_configured' | 'credentials_required' | 'restricted' | 'not_found' | 'rate_limited' | 'timeout' | 'cancelled' | 'unsupported_format' | 'failed';
export type Format = 'pdf' | 'xml' | 'html';
export interface SourceStatus {
    source: string;
    status: Status;
    reason?: string;
    elapsed_ms?: number;
    cached?: boolean;
    /** Configured target database; a failed/not_configured status does not prove access. */
    database?: {
        id: string;
        name: string;
    };
    api_product?: 'starter' | 'expanded';
    api_version?: 'v1' | 'v2';
    /** Product-level capabilities, separate from what this MCP wrapper exposes. */
    api_capabilities?: {
        pagination: boolean;
        total_matches: boolean;
    };
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
    source_records: Array<{
        source: string;
        id: string;
        url?: string;
        record_view?: string;
    }>;
    citation_counts: Record<string, number | null>;
    open_access_locations: Location[];
    fulltext_access_status: 'open_access' | 'unknown' | 'subscription_or_tdm';
    available_formats: Format[];
    available_fulltext_formats: Format[];
    local_file_path: string | null;
    downloaded_from: string | null;
    downloaded_at: string | null;
}
export declare const blankPaper: (doi?: string | null) => Paper;
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
export declare function mergePapers(papers: Paper[]): Paper[];
