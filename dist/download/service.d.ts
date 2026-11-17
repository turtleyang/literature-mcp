import type { Config } from '../config.js';
import { type DownloadResult } from '../models/paper.js';
import type { SearchService } from '../search/service.js';
import type { Http } from '../utils/http.js';
import type { DownloadInput } from '../tools/schemas.js';
import { Library } from '../storage/library.js';
export declare class DownloadService {
    private cfg;
    private search;
    private http;
    private library;
    private queue;
    private discovery;
    constructor(cfg: Config, search: SearchService, http: Http, library: Library);
    download(input: DownloadInput, signal?: AbortSignal): Promise<DownloadResult>;
}
