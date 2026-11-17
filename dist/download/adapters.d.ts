import type { Config } from '../config.js';
import type { Http } from '../utils/http.js';
import type { Paper, Location } from '../models/paper.js';
import type { Identity } from './validate.js';
export interface Candidate {
    source: string;
    url: string;
    headers?: Record<string, string>;
    version: string;
    identity: Identity;
    interval?: number;
    wiley?: boolean;
    metadata?: Partial<Paper>;
}
export interface PublisherDownloadAdapter {
    name: string;
    supports(paper: Paper): boolean;
    discover(doi: string, signal?: AbortSignal): Promise<Candidate[]>;
}
/** Reserved extension points: no unsupported publisher is presented as implemented. */
export declare const reservedPublishers: readonly ['acs', 'rsc', 'ieee', 'taylor_francis', 'iop', 'aip', 'aps'];
export declare class Discovery {
    private cfg;
    private http;
    constructor(cfg: Config, http: Http);
    location(l: Location, doi: string): Candidate | undefined;
    arxiv(idInput: string, doi?: string, signal?: AbortSignal): Promise<Candidate[]>;
    unpaywall(doi: string, signal?: AbortSignal): Promise<Candidate[]>;
    pmc(doi: string, signal?: AbortSignal): Promise<Candidate[]>;
    springerOa(doi: string, signal?: AbortSignal): Promise<Candidate[]>;
    publisher(source: 'wiley' | 'elsevier' | 'springer_tdm', doi: string): Candidate[];
}
