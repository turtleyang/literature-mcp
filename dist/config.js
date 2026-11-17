import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const projectVersion = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version;
// Node's parser does not execute shell expansions. Existing process environment wins.
export function loadLocalEnv() {
    const candidates = [];
    if (process.env.LITERATURE_ENV_FILE) {
        candidates.push(resolve(process.env.LITERATURE_ENV_FILE));
    }
    else {
        // 1. Current working directory
        candidates.push(resolve(process.cwd(), '.env'));
        // 2. Project root (for git clone checkout)
        candidates.push(resolve(projectRoot, '.env'));
        // 3. User home config (~/.config/literature-mcp/.env or ~/.literature-mcp.env)
        const home = homedir();
        candidates.push(resolve(home, '.config', 'literature-mcp', '.env'));
        candidates.push(resolve(home, '.literature-mcp.env'));
    }
    const { parseEnv } = process.getBuiltinModule('node:util');
    for (const file of candidates) {
        try {
            if (existsSync(file)) {
                for (const [k, v] of Object.entries(parseEnv(readFileSync(file, 'utf8'))))
                    if (process.env[k] === undefined)
                        process.env[k] = v;
                break;
            }
        }
        catch (e) {
            if (e.code !== 'ENOENT')
                throw new Error('Cannot read local environment file');
        }
    }
}
const positive = (v, fallback, max) => v ? Math.max(1, Math.min(max, Number(v) || fallback)) : fallback;
export function makeConfig(env = process.env) {
    let defaultLibrary;
    if (env.LITERATURE_LIBRARY_DIR) {
        defaultLibrary = resolve(env.LITERATURE_LIBRARY_DIR);
    }
    else {
        const localLib = resolve(projectRoot, 'literature-library');
        if (existsSync(localLib) || existsSync(resolve(projectRoot, 'src'))) {
            defaultLibrary = localLib;
        }
        else {
            defaultLibrary = resolve(homedir(), 'literature-library');
        }
    }
    const library = defaultLibrary;
    const allowed = (env.LITERATURE_ALLOWED_SAVE_ROOTS || library)
        .split(';')
        .filter(Boolean)
        .map((p) => {
        if (!isAbsolute(p))
            throw new Error('Allowed save roots must be absolute');
        return resolve(p);
    });
    const authorization = new Set((env.LITERATURE_AUTHORIZED_APIS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean));
    const order = (env.LITERATURE_DOWNLOAD_ORDER ||
        'arxiv,pmc,unpaywall,openalex,semantic_scholar,springer_oa,wiley,elsevier,springer_tdm').split(',');
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
        trustedFakeIpHosts: new Set((env.LITERATURE_TRUSTED_FAKE_IP_HOSTS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)),
        timeout: positive(env.LITERATURE_HTTP_TIMEOUT_MS, 15000, 120000),
        downloadTimeout: positive(env.LITERATURE_DOWNLOAD_TIMEOUT_MS, 90000, 300000),
        maxBytes: positive(env.LITERATURE_MAX_FILE_MB, 50, 200) * 1024 * 1024,
        maxCandidates: positive(env.LITERATURE_MAX_CANDIDATES, 6, 12),
        searchConcurrency: positive(env.LITERATURE_SEARCH_CONCURRENCY, 3, 5),
        downloadConcurrency: positive(env.LITERATURE_DOWNLOAD_CONCURRENCY, 1, 2),
        proxy: env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy,
        unpaywallEmail: env.UNPAYWALL_EMAIL,
        elsevierFormat: env.ELSEVIER_FULLTEXT_FORMAT === 'pdf' ? 'pdf' : 'xml',
    };
}
//# sourceMappingURL=config.js.map