import {
  mkdir,
  readFile,
  writeFile,
  rename,
  link,
  unlink,
  lstat,
  realpath,
  open,
} from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import type { Config } from '../config.js';
import type { Paper, DownloadResult } from '../models/paper.js';
import { stableId } from '../utils/identifiers.js';
import { Failure, wait } from '../utils/control.js';
import { validateFulltext, type Identity } from '../download/validate.js';
import { directoryChain, samePath } from '../utils/paths.js';
const within = (parent: string, child: string) => {
  const r = relative(parent, child);
  return !r || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r));
};
export class Library {
  constructor(readonly cfg: Config) {}
  async init() {
    for (const dir of [
      this.cfg.library,
      resolve(this.cfg.library, 'papers'),
      resolve(this.cfg.library, 'metadata'),
      resolve(this.cfg.library, 'logs'),
      resolve(this.cfg.library, 'locks'),
      resolve(this.cfg.library, 'rates'),
    ])
      await this.noSymlinkDir(dir);
  }
  private async noSymlinkDir(dir: string) {
    for (const current of directoryChain(dir)) {
      try {
        const s = await lstat(current);
        if (s.isSymbolicLink() || !s.isDirectory())
          throw new Failure(
            'restricted',
            'Storage paths cannot contain symlinks or non-directories',
          );
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          try {
            await mkdir(current, { mode: 0o700 });
          } catch (x: any) {
            if (x.code !== 'EEXIST') throw x;
          }
          const s = await lstat(current);
          if (s.isSymbolicLink() || !s.isDirectory())
            throw new Failure('restricted', 'Unsafe storage directory');
        } else throw e;
      }
    }
  }
  async directory(requested?: string) {
    const dir = resolve(requested || resolve(this.cfg.library, 'papers'));
    if (!this.cfg.allowed.some((root) => within(root, dir)))
      throw new Failure('restricted', 'save_directory is outside configured allowed roots');
    await this.noSymlinkDir(dir);
    const actual = await realpath(dir);
    if (!samePath(actual, dir)) {
      // Windows TEMP can use an 8.3 alias (RUNNER~1) while realpath expands it.
      // Accept that spelling only when both non-link directories have the same
      // volume and file ID; do not weaken the ancestor symlink/junction checks.
      const [requested, resolved] = await Promise.all([
        lstat(dir, { bigint: true }),
        lstat(actual, { bigint: true }),
      ]);
      const identicalWindowsDirectory =
        process.platform === 'win32' &&
        requested.isDirectory() &&
        resolved.isDirectory() &&
        !requested.isSymbolicLink() &&
        !resolved.isSymbolicLink() &&
        requested.ino !== 0n &&
        requested.dev === resolved.dev &&
        requested.ino === resolved.ino;
      if (!identicalWindowsDirectory)
        throw new Failure('restricted', 'Resolved storage path changed');
    }
    return dir;
  }
  private metadataPath(identifier: string) {
    return resolve(this.cfg.library, 'metadata', `${stableId(identifier)}.json`);
  }
  async existing(identifier: string): Promise<DownloadResult | undefined> {
    try {
      const path = this.metadataPath(identifier);
      if ((await lstat(path)).isSymbolicLink())
        throw new Failure('restricted', 'Symlink index rejected');
      const record = JSON.parse(await readFile(path, 'utf8'));
      const result: DownloadResult = record.download;
      if (
        !result?.file_path ||
        !this.cfg.allowed.some((root) => within(root, resolve(result.file_path!)))
      )
        return;
      await this.noSymlinkDir(dirname(result.file_path));
      const s = await lstat(result.file_path);
      if (s.isSymbolicLink() || !s.isFile() || s.size > this.cfg.maxBytes) return;
      const data = await readFile(result.file_path);
      if (createHash('sha256').update(data).digest('hex') !== result.sha256)
        throw new Failure(
          'failed',
          'Local file hash mismatch; overwrite must be explicitly requested',
        );
      await validateFulltext(
        data,
        result.format === 'pdf' ? 'application/pdf' : 'application/xml',
        {
          doi: result.doi,
          arxiv_id: result.arxiv_id,
          authoritative: true,
          evidence: result.identity_verification || 'Validated local index',
        },
      );
      return { ...result, status: 'already_exists' };
    } catch (e: any) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
  }
  async locked<T>(identifier: string, fn: () => Promise<T>) {
    await this.init();
    const path = resolve(this.cfg.library, 'locks', `${stableId(identifier)}.lock`);
    let handle;
    try {
      handle = await open(path, 'wx', 0o600);
    } catch (e: any) {
      if (e.code === 'EEXIST')
        throw new Failure(
          'rate_limited',
          'This identifier is being downloaded in another process (see stale-lock recovery in README)',
        );
      throw e;
    }
    try {
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }),
      );
      return await fn();
    } finally {
      await handle.close();
      await unlink(path).catch(() => {});
    }
  }
  async save(
    identifier: string,
    response: { data: Buffer; mime: string },
    identity: Identity,
    source: string,
    paper: Paper | null,
    directory: string | undefined,
    overwrite: boolean,
    version: string,
    signal?: AbortSignal,
  ): Promise<DownloadResult> {
    const dir = await this.directory(directory);
    const temp = resolve(dir, `.${stableId(identifier)}.${randomUUID()}.tmp`);
    if (response.data.length > this.cfg.maxBytes)
      throw new Failure('failed', 'File exceeds configured limit');
    try {
      signal?.throwIfAborted();
      await writeFile(temp, response.data, { flag: 'wx', mode: 0o600 });
      const verified = await validateFulltext(response.data, response.mime, identity);
      signal?.throwIfAborted();
      const final = resolve(dir, `${stableId(identifier)}.${verified.format}`);
      if (overwrite) {
        try {
          if ((await lstat(final)).isSymbolicLink())
            throw new Failure('restricted', 'Refusing to overwrite a symlink');
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
        await rename(temp, final);
      } else {
        try {
          await link(temp, final);
        } catch (e: any) {
          if (e.code === 'EEXIST')
            throw new Failure(
              'failed',
              'Unindexed existing file preserved; use overwrite=true after review',
            );
          throw e;
        }
        await unlink(temp);
      }
      const result: DownloadResult = {
        status: 'downloaded',
        downloaded_at: new Date().toISOString(),
        doi: identity.doi,
        arxiv_id: verified.arxiv_id || identity.arxiv_id,
        source,
        format: verified.format,
        file_path: final,
        verified: true,
        identity_verification: verified.identity_verification,
        sha256: createHash('sha256').update(response.data).digest('hex'),
        bytes: response.data.length,
        version: verified.arxiv_id ? `submittedVersion (${verified.arxiv_id})` : version,
      };
      const formats = paper ? [...new Set([...paper.available_formats, verified.format])] : [];
      const metadata = {
        schema_version: 1,
        identifier,
        paper: paper
          ? {
              ...paper,
              available_formats: formats,
              available_fulltext_formats: formats,
              fulltext_access_status: ['wiley_tdm', 'elsevier_article', 'springer_tdm'].includes(
                source,
              )
                ? 'subscription_or_tdm'
                : 'open_access',
              local_file_path: final,
              downloaded_from: source,
              downloaded_at: new Date().toISOString(),
            }
          : null,
        download: result,
        downloaded_at: new Date().toISOString(),
        sharing: 'Local use; access does not imply redistribution rights',
      };
      const meta = this.metadataPath(identifier),
        tmp = `${meta}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmp, JSON.stringify(metadata, null, 2), { flag: 'wx', mode: 0o600 });
        await rename(tmp, meta);
      } finally {
        await unlink(tmp).catch(() => {});
      }
      return result;
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  async permit(source: string, signal: AbortSignal, interval = 11000) {
    if (source !== 'wiley_tdm') return;
    for (;;) {
      signal.throwIfAborted();
      let delay = 0;
      try {
        delay = await this.locked('rate:' + source, async () => {
          const path = resolve(this.cfg.library, 'rates', source + '.json');
          let next = 0;
          try {
            const stat = await lstat(path);
            if (stat.isSymbolicLink())
              throw new Failure('restricted', 'Symlink rate state rejected');
            next = JSON.parse(await readFile(path, 'utf8')).next || 0;
          } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
          }
          if (next > Date.now()) return next - Date.now();
          const temp = path + '.' + randomUUID() + '.tmp';
          try {
            await writeFile(temp, JSON.stringify({ next: Date.now() + interval }), {
              flag: 'wx',
              mode: 0o600,
            });
            await rename(temp, path);
          } finally {
            await unlink(temp).catch(() => {});
          }
          return 0;
        });
      } catch (e) {
        if (e instanceof Failure && e.status === 'rate_limited') delay = 50;
        else throw e;
      }
      if (!delay) return;
      await wait(delay, signal);
    }
  }
  async log(record: object) {
    // Only callers' fixed diagnostic fields, never URLs, tokens, response bodies or complete text.
    try {
      const file = resolve(this.cfg.library, 'logs', 'events.jsonl');
      const handle = await open(file, 'a', 0o600);
      try {
        await handle.writeFile(JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n');
      } finally {
        await handle.close();
      }
    } catch {}
  }
}
