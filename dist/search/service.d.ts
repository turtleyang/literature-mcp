import type { Config } from '../config.js';
import { type PaperResult, type Source, type SourceStatus } from '../models/paper.js';
import type { SearchInput } from '../tools/schemas.js';
import { Http } from '../utils/http.js';
import type { Backend } from '../adapters/upstream.js';
export declare class SearchService {
    readonly cfg: Config;
    readonly http: Http;
    readonly backend: Backend;
    private searchCache;
    private metadataCache;
    private gate;
    constructor(cfg: Config, http: Http, backend: Backend);
    configured(source: Source): SourceStatus | undefined;
    private sourceContext;
    private run;
    search(input: SearchInput, signal?: AbortSignal): Promise<any>;
    private rankCount;
    private searchSource;
    get(doiInput: string, metadataSources?: Source[], includeCitations?: boolean, signal?: AbortSignal): Promise<PaperResult>;
    private getSource;
}
