import type { Config } from '../config.js';
export interface Backend {
    call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any>;
    close(): Promise<void>;
}
/** One lazily initialized upstream process per literature-mcp session. Never exposes its tools directly. */
export declare class Upstream implements Backend {
    private cfg;
    private client?;
    private stopped;
    private transport?;
    private connecting?;
    private cwd?;
    private gate;
    constructor(cfg: Config);
    private connect;
    call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any>;
    close(): Promise<void>;
    private reset;
}
