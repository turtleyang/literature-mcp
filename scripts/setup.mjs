import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/** Absolute executables avoid shell quoting, nvm initialization and OS-specific wrappers. */
export function clientConfigs(root, executable = process.execPath, platform = process.platform) {
  const api = platform === 'win32' ? path.win32 : path.posix;
  const entry = api.join(root, 'dist', 'server.js');
  const definition = { type: 'stdio', command: executable, args: [entry] };
  const json = JSON.stringify({ mcpServers: { 'literature-mcp': definition } }, null, 2) + '\n';
  const toml = `[mcp_servers.literature-mcp]\ncommand = ${JSON.stringify(executable)}\nargs = [${JSON.stringify(entry)}]\nstartup_timeout_sec = 30\ntool_timeout_sec = 180\n`;
  return { '.mcp.json': json, '.cursor/mcp.json': json, '.codex/config.toml': toml };
}

export async function setup(root, executable = process.execPath, platform = process.platform) {
  const results = [];
  await mkdir(path.join(root, 'config'), { recursive: true });
  // The POSIX SSH launcher can also use this path; native clients use node directly.
  await writeFile(path.join(root, 'config', 'node-path'), executable + '\n', { mode: 0o600 });
  const files = clientConfigs(root, executable, platform);
  files['.env'] = await readFile(path.join(root, '.env.example'), 'utf8');
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(file, contents, { flag: 'wx', mode: 0o600 });
      results.push({ file: name, status: 'created' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      results.push({ file: name, status: 'preserved' });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const item of await setup(root)) console.log(`${item.status}: ${item.file}`);
  console.log(
    'Local client configs are ready. Fill in private .env as needed; existing files were preserved.',
  );
}
