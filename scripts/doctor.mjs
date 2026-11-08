import { loadLocalEnv, makeConfig } from '../dist/config.js';
import { existsSync } from 'node:fs';
loadLocalEnv();
const c = makeConfig();
const keys = [
  'WOS_API_KEY',
  'WOS_EXPANDED_API_KEY',
  'ELSEVIER_API_KEY',
  'SCOPUS_SEARCH_API_KEY',
  'SPRINGER_API_KEY',
  'SPRINGER_OPENACCESS_API_KEY',
  'SPRINGER_TDM_API_KEY',
  'WILEY_TDM_TOKEN',
  'OPENALEX_API_KEY',
  'SEMANTIC_SCHOLAR_API_KEY',
  'UNPAYWALL_EMAIL',
];
console.log(
  JSON.stringify(
    {
      node: process.version,
      node_path: process.execPath,
      platform: process.platform,
      arch: process.arch,
      library: c.library,
      allowed_save_roots: c.allowed,
      proxy_configured: !!c.proxy,
      authorized_apis: [...c.authorization],
      credentials: Object.fromEntries(keys.map((k) => [k, !!c.env[k]])),
      build: existsSync(new URL('../dist/server.js', import.meta.url)),
    },
    null,
    2,
  ),
);
