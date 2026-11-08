import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebOfScienceSearcher } from 'paper-search-mcp-nodejs/dist/platforms/WebOfScienceSearcher.js';
import { QuotaManager } from 'paper-search-mcp-nodejs/dist/utils/QuotaManager.js';
const limiter = { waitForPermission: async () => {}, getStatus: () => ({ availableTokens: 1 }) };
const hit = {
  uid: 'WOS:1',
  title: 'Mock diamond',
  source: { sourceTitle: 'Journal', publishYear: 2025 },
  names: { authors: [{ displayName: 'A Researcher' }] },
  identifiers: { doi: '10.1234/mock' },
  citations: [{ db: 'WOS', count: 0 }],
};
test('actual pinned upstream WoS Starter uses v2, correct key/header/query and known zero', async () => {
  const calls = [];
  const q = QuotaManager.getInstance();
  q.resetUsage?.('wos-starter');
  const wos = new WebOfScienceSearcher('mock-starter', 'v2', {
    httpClient: {
      request: async (config) => {
        calls.push(config);
        return { status: 200, headers: {}, data: { metadata: { total: 1 }, hits: [hit] } };
      },
    },
    starterRateLimiter: limiter,
    maxRetries: 0,
  });
  const papers = await wos.search('TS=("diamond" AND "thermal conductivity")', {
    apiProduct: 'starter',
    maxResults: 1,
  });
  assert.equal(papers[0].citationCount, 0);
  assert.match(calls[0].url, /wos-starter\/v2\/documents$/);
  assert.equal(calls[0].headers['X-ApiKey'], 'mock-starter');
  assert.equal(calls[0].params.q, 'TS=("diamond" AND "thermal conductivity")');
});
test('actual pinned upstream Expanded selects FR and independent key', async () => {
  const calls = [];
  const wos = new WebOfScienceSearcher(undefined, 'v2', {
    expandedApiKey: 'mock-expanded',
    httpClient: {
      request: async (config) => {
        calls.push(config);
        return { status: 200, headers: {}, data: { Data: { Records: { records: { REC: [] } } } } };
      },
    },
    expandedRateLimiter: limiter,
    maxRetries: 0,
  });
  await wos.search('DO="10.1234/mock"', {
    apiProduct: 'expanded',
    recordView: 'full',
    maxResults: 1,
  });
  assert.equal(calls[0].headers['X-ApiKey'], 'mock-expanded');
  assert.equal(calls[0].params.optionView, 'FR');
  assert.match(calls[0].url, /api\/wos\/$/);
});
