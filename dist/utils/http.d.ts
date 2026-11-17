import type { Config } from '../config.js';
export declare function publicIp(ip: string): boolean;
export declare function safeUrl(raw: string): URL;
export type Fetcher = (url: string, init: any) => Promise<any>;
export interface HttpResponse {
    data: Buffer;
    mime: string;
    url: string;
    headers: Headers;
    status: number;
}
export declare class Http {
    readonly cfg: Config;
    private log;
    private permit?;
    private agent;
    private closing?;
    private fetcher;
    private next;
    private slots;
    constructor(cfg: Config, fetcher?: Fetcher, log?: (v: object) => void, permit?: ((source: string, signal: AbortSignal) => Promise<void>) | undefined);
    throttle(key: string, interval: number, signal?: AbortSignal): Promise<void>;
    request(url: string, options?: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        download?: boolean;
        maxBytes?: number;
        source?: string;
        interval?: number;
    }): Promise<HttpResponse>;
    json(url: string, options?: Parameters<Http['request']>[1]): Promise<any>;
    close(): Promise<void>;
}
