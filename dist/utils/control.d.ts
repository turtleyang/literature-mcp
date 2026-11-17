import type { Status } from '../models/paper.js';
export declare class Failure extends Error {
    status: Status;
    httpStatus?: number | undefined;
    retryAfterMs?: number | undefined;
    constructor(status: Status, message: string, httpStatus?: number | undefined, retryAfterMs?: number | undefined);
}
export declare function failure(e: unknown): Failure;
export declare const wait: (ms: number, signal?: AbortSignal) => Promise<undefined>;
export declare class Semaphore {
    private readonly limit;
    private readonly maxQueue;
    private active;
    private queue;
    constructor(limit: number, maxQueue?: number);
    run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T>;
}
export declare class Cache<T> {
    private ttl;
    private max;
    private data;
    constructor(ttl: number, max?: number);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
}
