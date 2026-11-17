import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici';
import { lookup } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Failure, wait } from './control.js';
const blocked = new BlockList();
for (const [ip, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
])
    blocked.addSubnet(ip, prefix, 'ipv4');
for (const [ip, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
    ['2001:db8::', 32],
    ['2001:2::', 48],
])
    blocked.addSubnet(ip, prefix, 'ipv6');
export function publicIp(ip) {
    const bare = ip.replace(/^\[|\]$/g, '');
    if (/^::ffff:/i.test(bare))
        return publicIp(bare.slice(7));
    const family = isIP(bare);
    if (family === 6 && !/^[23]/i.test(bare))
        return false;
    return !!family && !blocked.check(bare, family === 4 ? 'ipv4' : 'ipv6');
}
function fakeIp(ip) {
    return /^(?:198\.(?:18|19)\.|2001:2:)/i.test(ip);
}
export function safeUrl(raw) {
    let u;
    try {
        u = new URL(raw);
    }
    catch {
        throw new Failure('failed', 'Invalid full-text URL');
    }
    if (u.protocol !== 'https:' ||
        u.username ||
        u.password ||
        (u.port && u.port !== '443') ||
        u.hostname === 'localhost' ||
        u.hostname.endsWith('.local') ||
        (isIP(u.hostname.replace(/^\[|\]$/g, '')) && !publicIp(u.hostname)))
        throw new Failure('restricted', 'Only public HTTPS URLs on port 443 are permitted');
    return u;
}
export class Http {
    cfg;
    log;
    permit;
    agent;
    closing;
    fetcher;
    next = new Map();
    slots = new Map();
    constructor(cfg, fetcher, log = () => { }, permit) {
        this.cfg = cfg;
        this.log = log;
        this.permit = permit;
        this.fetcher = fetcher || undiciFetch;
        // DNS is checked in the actual connection lookup, so a later resolution cannot bypass it.
        const connect = {
            lookup: ((host, opts, cb) => lookup(host, { all: true }, (err, addresses) => {
                if (err)
                    return cb(err);
                const safe = addresses.filter((a) => publicIp(a.address) || (cfg.trustedFakeIpHosts.has(host) && fakeIp(a.address)));
                if (!safe.length || safe.length !== addresses.length)
                    return cb(new Error('Non-public DNS target rejected'));
                if (opts.all)
                    cb(null, safe);
                else
                    cb(null, safe[0].address, safe[0].family);
            })),
        };
        this.agent = cfg.proxy ? new ProxyAgent(cfg.proxy) : new Agent({ connect });
    }
    async throttle(key, interval, signal) {
        const previous = this.slots.get(key) || Promise.resolve();
        let release;
        const slot = new Promise((r) => {
            release = r;
        });
        this.slots.set(key, slot);
        await previous;
        try {
            signal?.throwIfAborted();
            const delay = (this.next.get(key) || 0) - Date.now();
            if (delay > 0)
                await wait(delay, signal);
            this.next.set(key, Date.now() + interval);
        }
        finally {
            release();
            if (this.slots.get(key) === slot)
                this.slots.delete(key);
        }
    }
    async request(url, options = {}) {
        const signal = AbortSignal.any([
            AbortSignal.timeout(options.download ? this.cfg.downloadTimeout : this.cfg.timeout),
            ...(options.signal ? [options.signal] : []),
        ]);
        const max = options.maxBytes || (options.download ? this.cfg.maxBytes : 8 * 1024 * 1024);
        const start = Date.now();
        let status;
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                let current = safeUrl(url);
                let headers = {
                    ...options.headers,
                    'User-Agent': 'literature-mcp/1.0 (local research tool)',
                };
                for (let hop = 0; hop <= 5; hop++) {
                    signal.throwIfAborted();
                    // A configured proxy resolves destination DNS remotely; preflight it locally too.
                    if (this.cfg.proxy)
                        await new Promise((resolve, reject) => lookup(current.hostname, { all: true }, (e, a) => e
                            ? reject(e)
                            : a.length &&
                                a.every((v) => publicIp(v.address) ||
                                    (this.cfg.trustedFakeIpHosts.has(current.hostname) && fakeIp(v.address)))
                                ? resolve()
                                : reject(new Failure('restricted', 'Non-public proxy target rejected'))));
                    await this.throttle(options.source || current.hostname, options.interval ?? 250, signal);
                    if (options.source)
                        await this.permit?.(options.source, signal);
                    const response = await this.fetcher(current.href, {
                        headers,
                        signal,
                        redirect: 'manual',
                        dispatcher: this.agent,
                    });
                    status = response.status;
                    if ([301, 302, 303, 307, 308].includes(response.status)) {
                        const location = response.headers.get('location');
                        await response.body?.cancel();
                        if (!location || hop === 5)
                            throw new Failure('failed', 'Redirect limit or missing destination');
                        const next = safeUrl(new URL(location, current).href);
                        if (next.origin !== current.origin)
                            headers = { 'User-Agent': headers['User-Agent'] };
                        current = next;
                        continue;
                    }
                    if (!response.ok) {
                        await response.body?.cancel();
                        const code = response.status;
                        const retry = response.headers.get('retry-after');
                        const retryMs = retry
                            ? /^\d+$/.test(retry)
                                ? Number(retry) * 1000
                                : Math.max(0, Date.parse(retry) - Date.now())
                            : 750;
                        if ((code === 429 || code >= 500) && attempt === 0 && retryMs <= 1000) {
                            await wait(retryMs, signal);
                            break;
                        }
                        const state = code === 401
                            ? 'credentials_required'
                            : code === 403
                                ? 'restricted'
                                : code === 404
                                    ? 'not_found'
                                    : code === 429
                                        ? 'rate_limited'
                                        : 'failed';
                        throw new Failure(state, `HTTP ${code} from ${current.hostname}`, code, retryMs);
                    }
                    const length = Number(response.headers.get('content-length') || 0);
                    if (length > max) {
                        await response.body?.cancel();
                        throw new Failure('failed', 'Response exceeds size limit');
                    }
                    const chunks = [];
                    let size = 0;
                    const reader = response.body?.getReader();
                    try {
                        if (reader)
                            for (;;) {
                                const chunk = await reader.read();
                                if (chunk.done)
                                    break;
                                signal.throwIfAborted();
                                size += chunk.value.byteLength;
                                if (size > max)
                                    throw new Failure('failed', 'Response exceeds size limit');
                                chunks.push(Buffer.from(chunk.value));
                            }
                    }
                    catch (e) {
                        await reader?.cancel().catch(() => { });
                        throw e;
                    }
                    if (!size || (length && !response.headers.get('content-encoding') && size !== length))
                        throw new Failure('failed', 'Empty or truncated response');
                    return {
                        data: Buffer.concat(chunks),
                        mime: (response.headers.get('content-type') || '').split(';')[0].toLowerCase(),
                        url: current.href,
                        headers: response.headers,
                        status: response.status,
                    };
                }
            }
            throw new Failure('failed', 'Retry limit reached');
        }
        catch (e) {
            if (signal.aborted)
                throw new Failure(options.signal?.aborted ? 'cancelled' : 'timeout', 'Request cancelled or timed out');
            throw e;
        }
        finally {
            this.log({
                kind: 'http',
                source: options.source || new URL(url).hostname,
                status,
                elapsed_ms: Date.now() - start,
            });
        }
    }
    async json(url, options = {}) {
        const r = await this.request(url, options);
        try {
            return JSON.parse(r.data.toString('utf8'));
        }
        catch {
            throw new Failure('failed', 'Invalid JSON from API');
        }
    }
    close() {
        return (this.closing ||= this.agent.close());
    }
}
//# sourceMappingURL=http.js.map