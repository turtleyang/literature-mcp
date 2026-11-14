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
test('MCP wire explains Starter constraints and supports recovery without weakening validation', async () => {
  const c = await context(
    {
      WOS_API_KEY: 'mock',
      WOS_STARTER_VERSION: 'v1',
      LITERATURE_AUTHORIZED_APIS: 'wos_starter',
    },
    undefined,
    () => [upstream()],
  );
  const app = await createApp(c.cfg, { http: c.http, backend: c.backend });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'agent-contract-check', version: '1' });
  try {
    await app.server.connect(b);
    await client.connect(a);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 3);
    const search = tools.find((t) => t.name === 'search_literature');
    assert.match(search.description, /Core Collection.*db=WOS/);
    assert.match(search.inputSchema.properties.record_view.description, /OMIT.*entirely/i);
    assert.match(search.inputSchema.properties.record_view.description, /neither short nor full/i);
    assert.match(
      search.inputSchema.properties.max_results.description,
      /Starter API itself supports pagination and totals/,
    );
    const get = tools.find((t) => t.name === 'get_paper');
    assert.match(get.inputSchema.properties.include_citations.description, /Keep false.*COUNTS/);
    assert.match(client.getInstructions(), /Expanded.*not a prerequisite for Core Collection/i);
    for (const record_view of ['short', 'full']) {
      const rejected = await client.callTool({
        name: 'search_literature',
        arguments: { query: 'TS=(diamond)', mode: 'wos', record_view },
      });
      assert.equal(rejected.isError, true);
      assert.match(rejected.content[0].text, /OMIT the property entirely for WoS Starter/);
    }
    assert.equal(c.calls.length, 0);
    const response = await client.callTool({
      name: 'search_literature',
      arguments: { query: 'TS=(diamond) AND PY=2025', mode: 'wos', max_results: 1 },
    });
    assert.ok(!response.isError);
    assert.equal(response.structuredContent.source_statuses[0].database.id, 'WOS');
    assert.equal(response.structuredContent.source_statuses[0].api_version, 'v1');
    assert.equal(response.structuredContent.source_statuses[0].api_capabilities.pagination, true);
    assert.equal(response.structuredContent.retrieval.limitation_scope, 'this_mcp_tool');
    assert.equal(response.structuredContent.retrieval.returned_count, 1);
    assert.equal(response.structuredContent.retrieval.total_matches, null);
    assert.equal(c.calls.length, 1);
    assert.equal(c.calls[0].args.recordView, undefined);
  } finally {
    await client.close();
    await app.close();
    await c.close();
  }
});
