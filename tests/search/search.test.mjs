import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context, response, alexRecord, crossrefRecord, doi, upstream } from '../helpers.mjs';
import { searchSchema } from '../../dist/tools/schemas.js';
import { normalizeDoi } from '../../dist/utils/identifiers.js';
import { Failure } from '../../dist/utils/control.js';
const input = (v) =>
  searchSchema.parse({ query: 'diamond thermal conductivity measurement', ...v });
test('fast routes only OpenAlex+Crossref; DOI dedup and source citations survive', async () => {
  const c = await context(
    {},
    () => response({ results: [alexRecord()] }),
    () => [upstream()],
  );
  try {
    const r = await c.search.search(input({}));
    assert.equal(c.calls.length, 1);
    assert.equal(c.calls[0].name, 'search_crossref');
    assert.equal(c.requests.length, 1);
    assert.equal(r.papers.length, 1);
    assert.deepEqual(r.papers[0].citation_counts, { openalex: 3, crossref: null });
    assert.equal(r.papers[0].source_records.length, 2);
    const cached = await c.search.search(input({}));
    assert.equal(cached.cached, true);
    assert.equal(c.requests.length, 1);
  } finally {
    await c.close();
  }
});
test('wos default only Starter; missing key is not_configured without network', async () => {
  const c = await context();
  try {
    const r = await c.search.search(input({ mode: 'wos' }));
    assert.equal(r.source_statuses[0].source, 'wos_starter');
    assert.equal(r.source_statuses[0].status, 'not_configured');
    assert.equal(c.requests.length + c.calls.length, 0);
  } finally {
    await c.close();
  }
});
test('WoS Starter and Expanded credentials and query routing stay separate', async () => {
  const c = await context(
    {
      WOS_API_KEY: 'mock',
      WOS_EXPANDED_API_KEY: 'mock2',
      LITERATURE_AUTHORIZED_APIS: 'wos_starter,wos_expanded',
    },
    undefined,
    () => [upstream()],
  );
  try {
    await c.search.search(input({ mode: 'wos' }));
    await c.search.search(input({ mode: 'wos', wos_product: 'expanded', record_view: 'full' }));
    assert.equal(c.calls.length, 2);
    assert.equal(c.calls[0].args.apiProduct, 'starter');
    assert.equal(c.calls[1].args.apiProduct, 'expanded');
    assert.equal(c.calls[1].args.recordView, 'full');
    assert.equal(c.requests.length, 0);
  } finally {
    await c.close();
  }
});
test('a key alone never grants authorization to commercial search', async () => {
  const c = await context({ WOS_API_KEY: 'mock' });
  try {
    const r = await c.search.search(input({ mode: 'wos' }));
    assert.equal(r.source_statuses[0].status, 'restricted');
    assert.equal(c.calls.length, 0);
  } finally {
    await c.close();
  }
});
test('deep routes public trio; never sweeps configured paid APIs', async () => {
  const c = await context(
    { ELSEVIER_API_KEY: 'mock', LITERATURE_AUTHORIZED_APIS: 'sciencedirect' },
    () => response({ results: [] }),
    () => [],
  );
  try {
    const r = await c.search.search(input({ mode: 'deep' }));
    assert.deepEqual(
      r.source_statuses.map((s) => s.source),
      ['openalex', 'crossref', 'semantic_scholar'],
    );
    assert.deepEqual(
      c.calls.map((x) => x.name),
      ['search_crossref', 'search_semantic_scholar'],
    );
  } finally {
    await c.close();
  }
});
test('timeout in one source returns healthy source and service remains usable', async () => {
  const c = await context(
    {},
    () => {
      throw new Failure('timeout', 'Mock timeout');
    },
    () => [upstream()],
  );
  try {
    const r = await c.search.search(input({}));
    assert.equal(r.papers.length, 1);
    assert.equal(r.source_statuses[0].status, 'timeout');
    assert.equal((await c.search.search(input({ sources: ['crossref'] }))).status, 'ok');
  } finally {
    await c.close();
  }
});
test('metadata is exact DOI; measured zero is retained, unknown stays null', async () => {
  const c = await context({}, (url) =>
    response(
      url.includes('crossref')
        ? { message: crossrefRecord() }
        : { ...alexRecord('10.1234/other'), cited_by_count: undefined },
    ),
  );
  try {
    const r = await c.search.get(doi);
    assert.equal(r.paper.doi, doi);
    assert.deepEqual(r.paper.citation_counts, { crossref: 0 });
    assert.equal(r.paper.source_records.length, 1);
    assert.equal(r.source_statuses[1].status, 'failed');
    await c.search.get(doi, ['crossref']);
    assert.equal((await c.search.get(doi, ['crossref'])).source_statuses[0].cached, true);
  } finally {
    await c.close();
  }
});
test('all not-found is distinct from failed retrieval', async () => {
  const c = await context({}, () => response({}, 'application/json', 404));
  try {
    const r = await c.search.get(doi);
    assert.equal(r.status, 'not_found');
    assert.equal(r.paper, null);
  } finally {
    await c.close();
  }
});
test('years, counts, source limits, mode constraints and DOI URL normalization', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1234%2FTARGET'), '10.1234/target');
  for (const v of [
    { year_from: 2026, year_to: 2020 },
    { max_results: 51 },
    { mode: 'wos', sources: ['crossref'] },
    { sources: ['scihub'] },
  ])
    assert.equal(searchSchema.safeParse({ query: 'x', ...v }).success, false);
});
test('year postfilter corrects upstream single-year over-inclusion', async () => {
  const c = await context({}, undefined, () => [
    { ...upstream(), year: 2024 },
    { ...upstream('10.1234/right'), year: 2025 },
  ]);
  try {
    const r = await c.search.search(
      input({ sources: ['crossref'], year_from: 2025, year_to: 2025 }),
    );
    assert.equal(r.papers.length, 1);
    assert.equal(r.papers[0].year, 2025);
  } finally {
    await c.close();
  }
});
test('OpenAlex author, journal, year and citation filters use stable IDs', async () => {
  const c = await context({}, () => response({ results: [] }));
  try {
    await c.search.search(
      input({
        sources: ['openalex'],
        author_id: 'A123',
        journal_id: 'S456',
        min_citations: 5,
        year_from: 2022,
      }),
    );
    const filter = new URL(c.requests[0].url).searchParams.get('filter');
    assert.match(filter, /authorships.author.id:A123/);
    assert.match(filter, /primary_location.source.id:S456/);
    assert.match(filter, /cited_by_count:>4/);
  } finally {
    await c.close();
  }
});
test('citation sorting retrieves relevant candidates before ranking, not globally cited loose matches', async () => {
  const c = await context(
    {},
    () => response({ results: [] }),
    () => [],
  );
  try {
    await c.search.search(input({ sort_by: 'citations', max_results: 4 }));
    const url = new URL(c.requests[0].url);
    assert.equal(url.searchParams.get('sort'), null);
    assert.equal(url.searchParams.get('per-page'), '8');
    assert.equal(c.calls[0].args.sortBy, 'relevance');
    assert.equal(c.calls[0].args.maxResults, 8);
  } finally {
    await c.close();
  }
});
test('explicit Expanded metadata uses FR and capped citing relationship call', async () => {
  const c = await context(
    { WOS_EXPANDED_API_KEY: 'mock', LITERATURE_AUTHORIZED_APIS: 'wos_expanded' },
    undefined,
    (name) =>
      name === 'search_webofscience' ? [{ ...upstream(), paper_id: 'WOS:123' }] : { items: [] },
  );
  try {
    const r = await c.search.get(doi, ['wos_expanded'], true);
    assert.equal(r.status, 'ok');
    assert.equal(c.calls[0].args.recordView, 'full');
    assert.equal(c.calls[1].name, 'get_webofscience_related_records');
    assert.equal(c.calls[1].args.uid, 'WOS:123');
    assert.equal(c.calls[1].args.maxResults, 20);
  } finally {
    await c.close();
  }
});
