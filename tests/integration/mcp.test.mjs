import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createApp } from '../../dist/server.js';
import { context, response, alexRecord, crossrefRecord, upstream, pdf, doi } from '../helpers.mjs';
test('actual MCP schemas expose exactly three tools and complete search/get/selected-download/local-reuse', async () => {
  const c = await context(
    {},
    (url) => {
      if (url.includes('repo.example.org')) return response(pdf(), 'application/pdf');
      if (url.includes('crossref')) return response({ message: crossrefRecord() });
      const record = alexRecord(doi, [
        { is_oa: true, pdf_url: 'https://repo.example.org/target.pdf', version: 'acceptedVersion' },
      ]);
      return response(url.includes('search=') ? { results: [record] } : record);
    },
    () => [upstream()],
  );
  const app = await createApp(c.cfg, { http: c.http, backend: c.backend });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'offline-e2e', version: '1' });
  try {
    await app.server.connect(b);
    await client.connect(a);
    const tools = (await client.listTools()).tools;
    assert.deepEqual(
      tools.map((t) => t.name),
      ['search_literature', 'get_paper', 'download_paper'],
    );
    const call = async (name, args) => {
      const r = await client.callTool({ name, arguments: args });
      assert.ok(!r.isError);
      return r.structuredContent;
    };
    const search = await call('search_literature', { query: 'diamond', max_results: 2 });
    assert.equal(search.papers[0].doi, doi);
    assert.ok(!c.requests.some((r) => r.url.includes('repo.example.org')));
    const metadata = await call('get_paper', { doi });
    assert.equal(metadata.paper.title, 'Target paper');
    const downloaded = await call('download_paper', { doi });
    assert.equal(downloaded.status, 'downloaded');
    assert.equal(downloaded.format, 'pdf');
    const before = c.requests.length;
    assert.equal((await call('download_paper', { doi })).status, 'already_exists');
    assert.equal(c.requests.length, before);
    assert.equal((await call('get_paper', { doi })).paper.local_file_path, downloaded.file_path);
  } finally {
    await client.close();
    await app.close();
    await c.close();
  }
});
