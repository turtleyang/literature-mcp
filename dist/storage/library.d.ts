import type { Config } from '../config.js';
import type { Paper, DownloadResult } from '../models/paper.js';
import { type Identity } from '../download/validate.js';
export declare class Library {
    readonly cfg: Config;
    constructor(cfg: Config);
    init(): Promise<void>;
    private noSymlinkDir;
    directory(requested?: string): Promise<string>;
    private metadataPath;
    existing(identifier: string): Promise<DownloadResult | undefined>;
    locked<T>(identifier: string, fn: () => Promise<T>): Promise<T>;
    save(identifier: string, response: {
        data: Buffer;
        mime: string;
    }, identity: Identity, source: string, paper: Paper | null, directory: string | undefined, overwrite: boolean, version: string, signal?: AbortSignal): Promise<DownloadResult>;
    permit(source: string, signal: AbortSignal, interval?: number): Promise<void>;
    log(record: object): Promise<void>;
}
