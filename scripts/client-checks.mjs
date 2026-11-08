import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const report = { at: new Date().toISOString(), codex: null, pi: null };
const app = spawn(
  'codex',
  [
    'app-server',
    '--stdio',
    '-c',
    'mcp_servers.zotero.enabled=false',
    '-c',
    'mcp_servers.node_repl.enabled=false',
  ],
  { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['pipe', 'pipe', 'pipe'] },
);
app.stderr.resume();
let seq = 0;
const pending = new Map();
const lines = createInterface({ input: app.stdout });
lines.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id !== undefined && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(p.timer);
    msg.error ? p.reject(Error(msg.error.message)) : p.resolve(msg.result);
  }
});
function request(method, params) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error('App server timeout'));
    }, 45000);
    pending.set(id, { resolve, reject, timer });
    app.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  await request('initialize', {
    clientInfo: { name: 'literature_acceptance', version: '1.0.0' },
    capabilities: { experimentalApi: true },
  });
  app.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const r = await request('mcpServerStatus/list', { detail: 'toolsAndAuthOnly' });
  const servers = r.data || r.servers || [];
  report.codex = servers
    .filter((s) => s.name === 'literature-mcp')
    .map((s) => ({ name: s.name, authStatus: s.authStatus, tools: Object.keys(s.tools || {}) }));
  console.log('Codex:', JSON.stringify(report.codex));
} catch (e) {
  report.codex = { error: e.message };
  console.log('Codex check:', e.message);
} finally {
  lines.close();
  app.stdin.end();
  app.kill('SIGTERM');
}
try {
  const file = '/home/xianiming/.pi/agent/npm/node_modules/pi-mcp-adapter/dist/server-manager.js';
  const { McpServerManager } = await import(pathToFileURL(file));
  const manager = new McpServerManager(process.cwd());
  try {
    const connection = await manager.connect('literature-mcp', {
      command: fileURLToPath(new URL('./start.sh', import.meta.url)),
      args: [],
    });
    const names = connection.tools.map((t) => t.name);
    const calls = [];
    for (const [name, args] of [
      ['search_literature', { query: 'diamond', mode: 'wos' }],
      ['get_paper', { doi: '10.1038/nphys1170' }],
      ['download_paper', { arxiv_id: '1706.03762v7', preferred_source: 'arxiv' }],
    ]) {
      const r = await connection.client.callTool({ name, arguments: args });
      const d = r.structuredContent || JSON.parse(r.content[0].text);
      calls.push({ tool: name, status: d.status });
    }
    report.pi = {
      runtime: 'Installed pi-mcp-adapter McpServerManager; no LLM session',
      status: connection.status,
      tools: names,
      calls,
    };
    console.log('Pi:', JSON.stringify(report.pi));
  } finally {
    await manager.closeAll?.();
    await manager.disconnectAll?.();
  }
} catch (e) {
  report.pi = { error: e.message };
  console.log('Pi check:', e.message);
}
await writeFile('docs/client-results.json', JSON.stringify(report, null, 2) + '\n');
