import { setTimeout } from 'node:timers/promises';
export class Failure extends Error {
    status;
    httpStatus;
    retryAfterMs;
    constructor(status, message, httpStatus, retryAfterMs) {
        super(message);
        this.status = status;
        this.httpStatus = httpStatus;
        this.retryAfterMs = retryAfterMs;
    }
}
export function failure(e) {
    if (e instanceof Failure)
        return e;
    if (e instanceof Error && /^Invalid (?:DOI|arXiv)/.test(e.message))
        return new Failure('failed', e.message);
    if (e instanceof Error && ['AbortError', 'TimeoutError'].includes(e.name))
        return new Failure(e.name === 'AbortError' ? 'cancelled' : 'timeout', e.name);
    return new Failure('failed', 'Operation failed; run doctor or consult sanitized diagnostics');
}
export const wait = (ms, signal) => setTimeout(ms, undefined, { signal });
export class Semaphore {
    limit;
    maxQueue;
    active = 0;
    queue = [];
    constructor(limit, maxQueue = 100) {
        this.limit = limit;
        this.maxQueue = maxQueue;
    }
    async run(fn, signal) {
        signal?.throwIfAborted();
        if (this.queue.length >= this.maxQueue)
            throw new Failure('rate_limited', 'Local queue is full');
        if (this.active >= this.limit)
            await new Promise((resolve, reject) => {
                const grant = () => {
                    signal?.removeEventListener('abort', cancel);
                    resolve();
                };
                const cancel = () => {
                    this.queue = this.queue.filter((q) => q !== grant);
                    reject(signal?.reason);
                };
                this.queue.push(grant);
                signal?.addEventListener('abort', cancel, { once: true });
            });
        else
            this.active++;
        try {
            signal?.throwIfAborted();
            return await fn();
        }
        finally {
            const next = this.queue.shift();
            if (next)
                next();
            else
                this.active--;
        }
    }
}
export class Cache {
    ttl;
    max;
    data = new Map();
    constructor(ttl, max = 250) {
        this.ttl = ttl;
        this.max = max;
    }
    get(key) {
        const v = this.data.get(key);
        if (!v)
            return;
        if (v.expires < Date.now()) {
            this.data.delete(key);
            return;
        }
        return structuredClone(v.value);
    }
    set(key, value) {
        this.data.delete(key);
        if (this.data.size >= this.max)
            this.data.delete(this.data.keys().next().value);
        this.data.set(key, { expires: Date.now() + this.ttl, value: structuredClone(value) });
    }
}
//# sourceMappingURL=control.js.map