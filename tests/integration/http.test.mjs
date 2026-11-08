import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context, response } from '../helpers.mjs';
import { safeUrl, publicIp } from '../../dist/utils/http.js';
test('SSRF blocks private IP, credentials, HTTP, custom ports and unsafe IPv6', () => {
  for (const url of [
    'http://example.org/x',
    'https://127.0.0.1/a',
    'https://10.0.0.1/a',
    'https://[::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://example.org:8443/',
    'https://user:secret@example.org/a',
    'https://localhost/a',
  ])
    assert.throws(() => safeUrl(url));
  assert.equal(publicIp('198.18.0.1'), false);
  assert.equal(publicIp('1.1.1.1'), true);
});
test('redirect follows HTTPS and strips publisher secrets on origin change', async () => {
  const c = await context({}, (url) =>
    url.includes('api.wiley')
      ? response('', 'text/plain', 302, { location: 'https://cdn.example.org/signed.pdf' })
      : response('done', 'text/plain'),
  );
  try {
    await c.http.request('https://api.wiley.com/doi', {
      headers: { 'Wiley-TDM-Client-Token': 'secret' },
    });
    assert.equal(c.requests.length, 2);
    assert.equal(c.requests[1].init.headers['Wiley-TDM-Client-Token'], undefined);
  } finally {
    await c.close();
  }
});
test('redirect to a private service is rejected before a second request', async () => {
  const c = await context({}, () =>
    response('', 'text/plain', 302, { location: 'https://127.0.0.1/secret' }),
  );
  try {
    await assert.rejects(c.http.request('https://api.example.org/a'));
    assert.equal(c.requests.length, 1);
  } finally {
    await c.close();
  }
});
test('401/403 never retry; 429 Retry-After is honored by returning rate_limited', async () => {
  for (const status of [401, 403, 429]) {
    const c = await context({}, () =>
      response({}, 'application/json', status, { 'retry-after': '60' }),
    );
    try {
      await assert.rejects(
        c.http.request('https://api.example.org/a'),
        (e) =>
          e.status ===
          (status === 401
            ? 'credentials_required'
            : status === 403
              ? 'restricted'
              : 'rate_limited'),
      );
      assert.equal(c.requests.length, 1);
    } finally {
      await c.close();
    }
  }
});
test('500 permits one bounded retry', async () => {
  let n = 0;
  const c = await context({}, () =>
    ++n === 1
      ? response({}, 'application/json', 503, { 'retry-after': '0' })
      : response({ ok: true }),
  );
  try {
    assert.equal((await c.http.json('https://api.example.org/a')).ok, true);
    assert.equal(c.requests.length, 2);
  } finally {
    await c.close();
  }
});
test('cancellation and request deadline become explicit statuses', async () => {
  const c = await context(
    { LITERATURE_HTTP_TIMEOUT_MS: '30' },
    (_url, init) =>
      new Promise((_res, rej) =>
        init.signal.addEventListener('abort', () => rej(init.signal.reason)),
      ),
  );
  try {
    await assert.rejects(
      c.http.request('https://api.example.org/a'),
      (e) => e.status === 'timeout',
    );
    const abort = new AbortController();
    const pending = c.http.request('https://api.example.org/a', { signal: abort.signal });
    setImmediate(() => abort.abort());
    await assert.rejects(pending, (e) => e.status === 'cancelled');
  } finally {
    await c.close();
  }
});
