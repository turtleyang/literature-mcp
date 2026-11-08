import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const transport = new StdioClientTransport({
  command: fileURLToPath(new URL('./start.sh', import.meta.url)),
  stderr: 'pipe',
});
transport.stderr?.on('data', (b) => process.stderr.write(b));
const client = new Client({ name: 'literature-live-acceptance', version: '1.0.0' });
const report = {
  at: new Date().toISOString(),
  environment:
    'User Linux x86_64 host, Node 24.19.0, Clash TUN Fake-IP with explicit trusted official hosts',
  tests: [],
};
async function call(label, name, args) {
  const start = Date.now();
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
  const data = result.structuredContent || JSON.parse(result.content[0].text);
  report.tests.push({ label, name, input: args, elapsed_ms: Date.now() - start, result: data });
  console.log(
    JSON.stringify({
      label,
      status: data.status,
      papers: data.papers?.map((p) => ({
        doi: p.doi,
        title: p.title,
        oa: p.open_access_locations,
      })),
      file_path: data.file_path,
      reason: data.reason,
      source_statuses: data.source_statuses,
    }),
  );
  return data;
}
try {
  await client.connect(transport);
  report.tools = (await client.listTools()).tools.map((t) => t.name);
  await call('A', 'search_literature', {
    query: 'diamond thermal conductivity measurement',
    mode: 'fast',
    max_results: 5,
  });
  await call('B', 'search_literature', {
    query: 'TS=("diamond" AND "thermal conductivity")',
    mode: 'wos',
  });
  await call('C', 'get_paper', { doi: '10.1038/nphys1170' });
  const d = await call('D', 'download_paper', {
    arxiv_id: '1706.03762v7',
    preferred_source: 'arxiv',
  });
  if (d.status === 'downloaded' || d.status === 'already_exists')
    await call('D-local-reuse', 'download_paper', {
      arxiv_id: '1706.03762v7',
      preferred_source: 'arxiv',
    });
  await call('E-no-token', 'download_paper', {
    doi: '10.1111/1467-923x.12168',
    preferred_source: 'wiley',
  });
  await call('F-search-only', 'search_literature', {
    query: 'diamond semiconductor interfacial thermal conductance',
    mode: 'fast',
    year_from: 2022,
    year_to: 2026,
    max_results: 8,
    sort_by: 'citations',
  });
} finally {
  await client.close();
  await mkdir('docs', { recursive: true });
  await writeFile('docs/online-results.json', JSON.stringify(report, null, 2) + '\n');
}
