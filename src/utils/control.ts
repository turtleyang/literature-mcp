import { setTimeout } from 'node:timers/promises';
import type { Status } from '../models/paper.js';
export class Failure extends Error {
  constructor(
    public status: Status,
    message: string,
    public httpStatus?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}
export function failure(e: unknown): Failure {
  if (e instanceof Failure) return e;
  if (e instanceof Error && /^Invalid (?:DOI|arXiv)/.test(e.message))
    return new Failure('failed', e.message);
  if (e instanceof Error && ['AbortError', 'TimeoutError'].includes(e.name))
    return new Failure(e.name === 'AbortError' ? 'cancelled' : 'timeout', e.name);
  return new Failure('failed', 'Operation failed; run doctor or consult sanitized diagnostics');
}
export const wait = (ms: number, signal?: AbortSignal) => setTimeout(ms, undefined, { signal });
export class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(
    private readonly limit: number,
    private readonly maxQueue = 100,
  ) {}
  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (this.queue.length >= this.maxQueue)
      throw new Failure('rate_limited', 'Local queue is full');
    if (this.active >= this.limit)
      await new Promise<void>((resolve, reject) => {
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
    else this.active++;
    try {
      signal?.throwIfAborted();
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }
}
export class Cache<T> {
  private data = new Map<string, { expires: number; value: T }>();
  constructor(
    private ttl: number,
    private max = 250,
  ) {}
  get(key: string): T | undefined {
    const v = this.data.get(key);
    if (!v) return;
    if (v.expires < Date.now()) {
      this.data.delete(key);
      return;
    }
    return structuredClone(v.value);
  }
  set(key: string, value: T) {
    this.data.delete(key);
    if (this.data.size >= this.max) this.data.delete(this.data.keys().next().value!);
    this.data.set(key, { expires: Date.now() + this.ttl, value: structuredClone(value) });
  }
}
