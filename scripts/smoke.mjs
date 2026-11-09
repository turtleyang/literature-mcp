import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This smoke check is deliberately offline, even when the checkout has real credentials.
const scratch = await mkdtemp(join(tmpdir(), 'literature-smoke-'));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../dist/server.js', import.meta.url))],
  cwd: scratch,
  env: {
    LITERATURE_ENV_FILE: join(scratch, 'missing.env'),
    LITERATURE_LIBRARY_DIR: join(scratch, 'library'),
    LITERATURE_AUTHORIZED_APIS: '',
    WOS_API_KEY: '',
    WOS_EXPANDED_API_KEY: '',
  },
  stderr: 'pipe',
});
transport.stderr?.on('data', (b) => process.stderr.write(b));
const client = new Client({ name: 'literature-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  const expected = ['download_paper', 'get_paper', 'search_literature'];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw Error('Unexpected MCP tool set');
  const calls = [
    ['search_literature', { query: 'diamond', mode: 'wos' }],
    ['get_paper', { doi: '10.1234/smoke', metadata_sources: ['wos_starter'] }],
    ['download_paper', { doi: 'invalid-doi' }],
  ];
  for (const [name, args] of calls) {
    const response = await client.callTool({ name, arguments: args });
    const result = response.structuredContent || JSON.parse(response.content[0].text);
    if (name === 'search_literature' && result.source_statuses?.[0]?.status !== 'not_configured')
      throw Error('Unexpected search routing');
    if (name === 'get_paper' && result.status !== 'not_configured')
      throw Error('Unexpected metadata routing');
    if (name === 'download_paper' && !response.isError) throw Error('Invalid DOI was accepted');
    console.log(JSON.stringify({ tool: name, status: result.status }));
  }
  console.log('Offline stdio smoke passed: three tools; no provider requests.');
} finally {
  await client.close();
  await rm(scratch, { recursive: true, force: true });
}
