import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Config } from '../config.js';
import { Failure, Semaphore } from '../utils/control.js';
const require = createRequire(import.meta.url);
export interface Backend {
  call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any>;
  close(): Promise<void>;
}
/** One lazily initialized upstream process per literature-mcp session. Never exposes its tools directly. */
export class Upstream implements Backend {
  private client?: Client;
  private stopped = false;
  private transport?: StdioClientTransport;
  private connecting?: Promise<void>;
  private cwd?: string;
  private gate = new Semaphore(3);
  constructor(private cfg: Config) {}
  private async connect() {
    if (this.stopped) throw new Failure('cancelled', 'Backend is closing');
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      this.cwd = await mkdtemp(resolve(tmpdir(), 'literature-upstream-'));
      const env: Record<string, string> = {};
      for (const key of [
        'PATH',
        'HOME',
        'TMPDIR',
        'HTTPS_PROXY',
        'HTTP_PROXY',
        'ALL_PROXY',
        'NO_PROXY',
        'https_proxy',
        'http_proxy',
        'all_proxy',
        'no_proxy',
        'CROSSREF_MAILTO',
        'SEMANTIC_SCHOLAR_API_KEY',
        'WOS_STARTER_VERSION',
      ])
        if (this.cfg.env[key]) env[key] = this.cfg.env[key]!;
      const mapping: Record<string, string[]> = {
        wos_starter: ['WOS_API_KEY'],
        wos_expanded: ['WOS_EXPANDED_API_KEY'],
        scopus: ['SCOPUS_SEARCH_API_KEY', 'ELSEVIER_API_KEY'],
        sciencedirect: ['ELSEVIER_API_KEY'],
        springer: ['SPRINGER_API_KEY', 'SPRINGER_OPENACCESS_API_KEY'],
      };
      for (const [permission, keys] of Object.entries(mapping))
        if (this.cfg.authorization.has(permission))
          for (const key of keys) if (this.cfg.env[key]) env[key] = this.cfg.env[key]!;
      Object.assign(env, {
        MCP_SERVER: 'true',
        NODE_ENV: 'production',
        SCIHUB_ENABLED: 'false',
        SCRAPINGANT_ENABLED: 'false',
        WOS_STARTER_RPS: '1',
        WOS_STARTER_DAILY_LIMIT: '50',
        WOS_EXPANDED_RPS: '1',
      });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [require.resolve('paper-search-mcp-nodejs/dist/server.js'), '--mcp'],
        env,
        cwd: this.cwd,
        stderr: 'pipe',
      });
      // Upstream errors can contain raw third-party data. Use only our generic, sanitized statuses.
      transport.stderr?.on('data', () => {});
      const client = new Client({ name: 'literature-mcp-backend', version: '1.0.0' });
      try {
        await client.connect(transport, { timeout: this.cfg.timeout });
        if (this.stopped) {
          await client.close();
          throw new Failure('cancelled', 'Backend is closing');
        }
        this.transport = transport;
        this.client = client;
      } catch (e) {
        await transport.close();
        throw e;
      }
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }
  async call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
    const allowed = [
      'search_crossref',
      'search_arxiv',
      'search_semantic_scholar',
      'search_webofscience',
      'search_scopus',
      'search_sciencedirect',
      'search_springer',
      'get_webofscience_related_records',
    ];
    if (!allowed.includes(name))
      throw new Failure('restricted', 'Backend operation is not allowlisted');
    return this.gate.run(async () => {
      await this.connect();
      let result: any;
      try {
        result = await this.client!.callTool({ name, arguments: args }, undefined, {
          signal,
          timeout: this.cfg.timeout,
        });
      } catch (e: any) {
        // Several upstream searchers do not abort Axios on MCP cancellation. Terminate the shared
        // child to stop their retries; concurrent operations report failure and next call reconnects.
        if (signal?.aborted || e.code === -32001) await this.reset();
        throw new Failure(
          signal?.aborted ? 'cancelled' : e.code === -32001 ? 'timeout' : 'failed',
          'Upstream MCP request failed or timed out',
        );
      }
      const content = (result.content || [])
        .filter((v: any) => v.type === 'text')
        .map((v: any) => v.text)
        .join('\n');
      if (result.isError) {
        const code = content.match(/\b(401|403|404|429)\b/)?.[1];
        const state =
          code === '401'
            ? 'credentials_required'
            : code === '403'
              ? 'restricted'
              : code === '404'
                ? 'not_found'
                : code === '429'
                  ? 'rate_limited'
                  : /timed?\s*out/i.test(content)
                    ? 'timeout'
                    : 'failed';
        throw new Failure(state, `Upstream ${name} failed${code ? ` (HTTP ${code})` : ''}`);
      }
      const start = Math.min(...['[', '{'].map((c) => content.indexOf(c)).filter((i) => i >= 0));
      if (!Number.isFinite(start)) throw new Failure('failed', 'Unexpected upstream response');
      try {
        return JSON.parse(content.slice(start));
      } catch {
        throw new Failure('failed', 'Invalid upstream JSON');
      }
    }, signal);
  }
  async close() {
    this.stopped = true;
    await this.connecting?.catch(() => {});
    await this.reset();
  }
  private async reset() {
    const client = this.client,
      transport = this.transport,
      cwd = this.cwd;
    this.client = undefined;
    this.transport = undefined;
    this.cwd = undefined;
    try {
      await client?.close();
    } finally {
      await transport?.close();
      if (cwd) await rm(cwd, { recursive: true, force: true });
    }
  }
}
