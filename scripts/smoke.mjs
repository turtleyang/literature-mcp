import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const transport = new StdioClientTransport({
  command: fileURLToPath(new URL('./start.sh', import.meta.url)),
  stderr: 'pipe',
});
transport.stderr?.on('data', (b) => process.stderr.write(b));
const client = new Client({ name: 'literature-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log('tools:', tools.map((t) => t.name).join(', '));
  if (tools.length !== 3) throw Error('Expected exactly three tools');
  for (const [name, args] of [
    ['search_literature', { query: 'TS=("diamond" AND "thermal conductivity")', mode: 'wos' }],
    ['get_paper', { doi: '10.1038/nphys1170' }],
    ['download_paper', { doi: '10.1002/example', preferred_source: 'wiley' }],
  ]) {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
    const d = r.structuredContent || JSON.parse(r.content[0].text);
    console.log(
      JSON.stringify({
        name,
        status: d.status,
        source_statuses: d.source_statuses,
        title: d.paper?.title,
        reason: d.reason,
        attempts: d.attempts,
      }),
    );
  }
} finally {
  await client.close();
}
