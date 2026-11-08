import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Node's parser does not execute shell expansions. Existing process environment wins.
export function loadLocalEnv() {
  const file = process.env.LITERATURE_ENV_FILE || resolve(projectRoot, '.env');
  try {
    const { parseEnv } = process.getBuiltinModule('node:util') as typeof import('node:util');
    for (const [k, v] of Object.entries(parseEnv(readFileSync(file, 'utf8'))))
      if (process.env[k] === undefined) process.env[k] = v;
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw new Error('Cannot read local environment file');
  }
}
const positive = (v: string | undefined, fallback: number, max: number) =>
  v ? Math.max(1, Math.min(max, Number(v) || fallback)) : fallback;
export function makeConfig(env: NodeJS.ProcessEnv = process.env) {
  const library = resolve(env.LITERATURE_LIBRARY_DIR || resolve(projectRoot, 'literature-library'));
  const allowed = (env.LITERATURE_ALLOWED_SAVE_ROOTS || library)
    .split(';')
    .filter(Boolean)
    .map((p) => {
      if (!isAbsolute(p)) throw new Error('Allowed save roots must be absolute');
      return resolve(p);
    });
  const authorization = new Set(
    (env.LITERATURE_AUTHORIZED_APIS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const order = (
    env.LITERATURE_DOWNLOAD_ORDER ||
    'arxiv,pmc,unpaywall,openalex,semantic_scholar,springer_oa,wiley,elsevier,springer_tdm'
  ).split(',');
  const supportedOrder = [
    'arxiv',
    'pmc',
    'unpaywall',
    'openalex',
    'semantic_scholar',
    'springer_oa',
    'wiley',
    'elsevier',
    'springer_tdm',
  ];
  if (order.some((s) => !supportedOrder.includes(s)))
    throw new Error('Unknown source in LITERATURE_DOWNLOAD_ORDER');
  return {
    env,
    library,
    allowed,
    authorization,
    order,
    trustedFakeIpHosts: new Set(
      (env.LITERATURE_TRUSTED_FAKE_IP_HOSTS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    timeout: positive(env.LITERATURE_HTTP_TIMEOUT_MS, 15000, 120000),
    downloadTimeout: positive(env.LITERATURE_DOWNLOAD_TIMEOUT_MS, 90000, 300000),
    maxBytes: positive(env.LITERATURE_MAX_FILE_MB, 50, 200) * 1024 * 1024,
    maxCandidates: positive(env.LITERATURE_MAX_CANDIDATES, 6, 12),
    searchConcurrency: positive(env.LITERATURE_SEARCH_CONCURRENCY, 3, 5),
    downloadConcurrency: positive(env.LITERATURE_DOWNLOAD_CONCURRENCY, 1, 2),
    proxy: env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy,
    unpaywallEmail: env.UNPAYWALL_EMAIL,
    elsevierFormat: env.ELSEVIER_FULLTEXT_FORMAT === 'pdf' ? ('pdf' as const) : ('xml' as const),
  };
}
export type Config = ReturnType<typeof makeConfig>;
