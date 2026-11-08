import { writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(join(root, 'config'), { recursive: true });
await writeFile(join(root, 'config', 'node-path'), process.execPath + '\n', { mode: 0o600 });
const command = join(root, 'scripts', 'start.sh');
const files = {
  '.mcp.json':
    JSON.stringify({ mcpServers: { 'literature-mcp': { command, args: [] } } }, null, 2) + '\n',
  '.codex/config.toml': `[mcp_servers.literature-mcp]\ncommand = ${JSON.stringify(command)}\nstartup_timeout_sec = 30\ntool_timeout_sec = 180\n`,
};
for (const [file, contents] of Object.entries(files)) {
  await mkdir(join(root, file, '..'), { recursive: true });
  try {
    await writeFile(join(root, file), contents, { flag: 'wx', mode: 0o600 });
    console.log('Created', file);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    console.log('Preserved existing', file);
  }
}
console.log('Node path recorded. Existing client configurations and private .env preserved.');
