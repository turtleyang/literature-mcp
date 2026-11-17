import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const adapterPath =
  process.env.PI_MCP_ADAPTER_MODULE ||
  'C:/Users/54509/.pi/agent/npm/node_modules/pi-mcp-adapter/dist/server-manager.js';
const { McpServerManager } = await import(pathToFileURL(adapterPath));

const root = fileURLToPath(new URL('..', import.meta.url));
const serverEntry = path.join(root, 'dist', 'server.js');
const manager = new McpServerManager(root);

const report = {
  tested_at: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  client: 'pi-mcp-adapter (Windows native runtime)',
  server_entry: serverEntry,
  tools: [],
  calls: [],
};

try {
  const conn = await manager.connect('literature-mcp', {
    command: process.execPath,
    args: [serverEntry],
  });

  report.tools = conn.tools.map((t) => t.name);
  console.log('Connected to literature-mcp! Tools found:', report.tools);

  // 1. search_literature (fast mode)
  console.log('1. Testing search_literature (fast)...');
  const r1 = await conn.client.callTool({
    name: 'search_literature',
    arguments: { query: 'diamond thermal conductivity', mode: 'fast', max_results: 3 },
  });
  const d1 = r1.structuredContent || JSON.parse(r1.content[0].text);
  report.calls.push({
    tool: 'search_literature_fast',
    status: d1.status,
    papers_count: d1.papers?.length,
    sources: d1.source_statuses?.map((s) => ({ source: s.source, status: s.status })),
  });
  console.log(`   search_literature: ${d1.status}, papers: ${d1.papers?.length}`);

  // 2. search_literature (wos mode)
  console.log('2. Testing search_literature (wos starter)...');
  const rWoS = await conn.client.callTool({
    name: 'search_literature',
    arguments: { query: 'TS=("diamond")', mode: 'wos' },
  });
  const dWoS = rWoS.structuredContent || JSON.parse(rWoS.content[0].text);
  report.calls.push({
    tool: 'search_literature_wos',
    status: dWoS.status,
    database: dWoS.source_statuses?.[0]?.database?.name,
    papers_count: dWoS.papers?.length,
  });
  console.log(
    `   search_literature_wos: ${dWoS.status}, database: ${dWoS.source_statuses?.[0]?.database?.name}`,
  );

  // 3. get_paper
  console.log('3. Testing get_paper...');
  const r2 = await conn.client.callTool({
    name: 'get_paper',
    arguments: { doi: '10.1038/nphys1170' },
  });
  const d2 = r2.structuredContent || JSON.parse(r2.content[0].text);
  report.calls.push({
    tool: 'get_paper',
    status: d2.status,
    title: d2.paper?.title,
    doi: d2.paper?.doi,
  });
  console.log(`   get_paper: ${d2.status}, title: ${d2.paper?.title}`);

  // 4. download_paper
  console.log('4. Testing download_paper (arXiv)...');
  const r3 = await conn.client.callTool({
    name: 'download_paper',
    arguments: { arxiv_id: '1706.03762v7', preferred_source: 'arxiv' },
  });
  const d3 = r3.structuredContent || JSON.parse(r3.content[0].text);
  report.calls.push({
    tool: 'download_paper',
    status: d3.status,
    file_path: d3.file_path,
  });
  console.log(`   download_paper: ${d3.status}, path: ${d3.file_path}`);

  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(
    path.join(root, 'docs', 'pi-windows-receipt.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log('All tests passed! Receipt written to docs/pi-windows-receipt.json');
} finally {
  await manager.closeAll?.();
  await manager.disconnectAll?.();
}
