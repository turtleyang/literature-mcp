import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { context, response, pdf, xml, doi, crossrefRecord, alexRecord } from '../helpers.mjs';
import { downloadSchema } from '../../dist/tools/schemas.js';
import { Discovery } from '../../dist/download/adapters.js';
import { validateFulltext } from '../../dist/download/validate.js';
const input = (v) => downloadSchema.parse({ doi, ...v });
const meta = (url) =>
  url.includes('api.crossref') ? response({ message: crossrefRecord() }) : response(alexRecord());
const identity = { doi, authoritative: false, evidence: 'mock' };
test('Wiley TDM uses exact encoded DOI, token header, validates PDF and reuses local file offline', async () => {
  const c = await context(
    { WILEY_TDM_TOKEN: 'mock-token', LITERATURE_AUTHORIZED_APIS: 'wiley' },
    (url) => (url.includes('api.wiley') ? response(pdf(), 'application/pdf') : meta(url)),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'wiley' }));
    assert.equal(r.status, 'downloaded');
    assert.equal(r.format, 'pdf');
    assert.equal(r.verified, true);
    const req = c.requests.find((r) => r.url.includes('wiley'));
    assert.ok(req.url.endsWith('10.1234%2Ftarget'));
    assert.equal(req.init.headers['Wiley-TDM-Client-Token'], 'mock-token');
    const n = c.requests.length;
    assert.equal(
      (await c.download.download(input({ preferred_source: 'wiley' }))).status,
      'already_exists',
    );
    assert.equal(c.requests.length, n);
    const record = JSON.parse(
      await readFile(
        join(c.root, 'metadata', (await readdir(join(c.root, 'metadata')))[0]),
        'utf8',
      ),
    );
    assert.equal(record.download.sha256, r.sha256);
  } finally {
    await c.close();
  }
});
test('Wiley subscription-denied 404 is restricted rather than paper not_found', async () => {
  const c = await context(
    { WILEY_TDM_TOKEN: 'mock', LITERATURE_AUTHORIZED_APIS: 'wiley' },
    (url) => (url.includes('wiley') ? response({}, 'application/json', 404) : meta(url)),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'wiley' }));
    assert.equal(r.status, 'restricted');
    assert.match(r.attempts.at(-1).reason, /subscription/);
  } finally {
    await c.close();
  }
});
test('missing Wiley token never fakes success', async () => {
  const c = await context({}, meta);
  try {
    const r = await c.download.download(input({ preferred_source: 'wiley' }));
    assert.equal(r.status, 'credentials_required');
    assert.ok(!c.requests.some((r) => r.url.includes('wiley')));
  } finally {
    await c.close();
  }
});
test('key alone and allow_publisher_api=false prevent publisher requests', async () => {
  for (const env of [
    { WILEY_TDM_TOKEN: 'mock' },
    { WILEY_TDM_TOKEN: 'mock', LITERATURE_AUTHORIZED_APIS: 'wiley' },
  ]) {
    const c = await context(env, meta);
    try {
      const r = await c.download.download(
        input({ preferred_source: 'wiley', allow_publisher_api: false }),
      );
      assert.equal(r.status, 'restricted');
      assert.ok(!c.requests.some((r) => r.url.includes('wiley')));
    } finally {
      await c.close();
    }
  }
});
test('Elsevier structured XML is stored as XML with DOI, never a PDF', async () => {
  const c = await context(
    { ELSEVIER_API_KEY: 'mock-key', LITERATURE_AUTHORIZED_APIS: 'elsevier' },
    (url) => (url.includes('api.elsevier') ? response(xml(), 'text/xml') : meta(url)),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'elsevier' }));
    assert.equal(r.status, 'downloaded');
    assert.equal(r.format, 'xml');
    assert.equal(r.publisher_url, `https://doi.org/${doi}`);
    assert.ok(r.file_path.endsWith('.xml'));
    assert.equal(
      c.requests.find((r) => r.url.includes('elsevier')).init.headers.Accept,
      'text/xml',
    );
  } finally {
    await c.close();
  }
});
test('Elsevier permission failure is restricted without auth retries', async () => {
  const c = await context(
    { ELSEVIER_API_KEY: 'mock-key', LITERATURE_AUTHORIZED_APIS: 'elsevier' },
    (url) => (url.includes('api.elsevier') ? response({}, 'application/json', 403) : meta(url)),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'elsevier' }));
    assert.equal(r.status, 'restricted');
    assert.equal(c.requests.filter((r) => r.url.includes('elsevier')).length, 1);
  } finally {
    await c.close();
  }
});
test('Springer OA verifies exact metadata DOI and downloads official PDF', async () => {
  const c = await context(
    { SPRINGER_OPENACCESS_API_KEY: 'mock', LITERATURE_AUTHORIZED_APIS: 'springer_oa' },
    (url) =>
      url.includes('/openaccess/json')
        ? response({
            records: [
              { doi, url: [{ format: 'pdf', value: 'https://link.springer.com/test.pdf' }] },
            ],
          })
        : url.includes('test.pdf')
          ? response(pdf(), 'application/pdf')
          : meta(url),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'springer' }));
    assert.equal(r.status, 'downloaded');
    assert.equal(r.source, 'springer_oa');
  } finally {
    await c.close();
  }
});
test('Springer OA JATS fallback stays XML', async () => {
  const c = await context(
    { SPRINGER_OPENACCESS_API_KEY: 'mock', LITERATURE_AUTHORIZED_APIS: 'springer_oa' },
    (url) =>
      url.includes('/openaccess/json')
        ? response({ records: [{ doi, url: [] }] })
        : url.includes('/openaccess/jats')
          ? response(xml(), 'application/xml')
          : meta(url),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'springer' }));
    assert.equal(r.format, 'xml');
    assert.equal(r.status, 'downloaded');
  } finally {
    await c.close();
  }
});
test('Unpaywall exact DOI candidates require email and keep submitted version', async () => {
  const c = await context({ UNPAYWALL_EMAIL: 'researcher@example.org' }, () =>
    response({
      doi,
      oa_locations: [
        { url_for_pdf: 'https://repository.example.org/a.pdf', version: 'submittedVersion' },
      ],
    }),
  );
  try {
    const d = new Discovery(c.cfg, c.http);
    const r = await d.unpaywall(doi);
    assert.equal(r[0].version, 'submittedVersion');
    assert.equal(r[0].identity.authoritative, false);
  } finally {
    await c.close();
  }
});
test('arXiv exact ID API resolves version; PDF remains preprint', async () => {
  const atom =
    '<feed><entry><id>http://arxiv.org/abs/2301.00001v2</id><doi>10.1234/target</doi><title>Target paper</title></entry></feed>';
  const c = await context({}, (url) =>
    url.includes('/api/query')
      ? response(atom, 'application/atom+xml')
      : url.includes('/pdf/')
        ? response(pdf('arXiv:2301.00001v2'), 'application/pdf')
        : meta(url),
  );
  try {
    const r = await c.download.download(
      input({ arxiv_id: '2301.00001v2', preferred_source: 'arxiv' }),
    );
    assert.equal(r.status, 'downloaded');
    assert.equal(r.arxiv_id, '2301.00001v2');
    assert.match(r.version, /submittedVersion/);
  } finally {
    await c.close();
  }
});
test('unrelated arXiv DOI cannot substitute a requested journal article', async () => {
  const c = await context({}, (url) =>
    url.includes('/api/query')
      ? response(
          '<feed><entry><id>http://arxiv.org/abs/2301.00001v2</id><doi>10.1234/other</doi></entry></feed>',
          'text/xml',
        )
      : meta(url),
  );
  try {
    const r = await c.download.download(
      input({ arxiv_id: '2301.00001v2', preferred_source: 'arxiv' }),
    );
    assert.equal(r.status, 'failed');
    assert.ok(!c.requests.some((r) => r.url.includes('/pdf/')));
  } finally {
    await c.close();
  }
});
test('PDF header/MIME, EOF, malformed content, repository identity, XML DOI are checked', async () => {
  for (const [body, mime, id] of [
    [Buffer.from('<html>' + 'login '.repeat(30) + '</html>'), 'application/pdf', identity],
    [pdf().subarray(0, -20), 'application/pdf', identity],
    [pdf('10.1234/other'), 'application/pdf', identity],
    [pdf(), 'text/html', identity],
    [Buffer.from(xml('10.1234/other')), 'application/xml', { ...identity, authoritative: true }],
    [Buffer.from(xml().replace('<body>', '<notbody>')), 'application/xml', identity],
  ])
    await assert.rejects(validateFulltext(body, mime, id));
  assert.equal((await validateFulltext(pdf(), 'application/pdf', identity)).format, 'pdf');
});
test('interrupted response, invalid PDF and oversize leave no final or temporary files', async () => {
  for (const kind of ['invalid', 'oversize', 'interrupted']) {
    const c = await context(
      { WILEY_TDM_TOKEN: 'mock', LITERATURE_AUTHORIZED_APIS: 'wiley', LITERATURE_MAX_FILE_MB: '1' },
      (url) => {
        if (!url.includes('wiley')) return meta(url);
        if (kind === 'invalid')
          return response(Buffer.from('not a pdf '.repeat(50)), 'application/pdf');
        if (kind === 'oversize') return response(Buffer.alloc(2 * 1024 * 1024), 'application/pdf');
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(pdf().subarray(0, 120));
              controller.error(new Error('interrupted'));
            },
          }),
          { headers: { 'content-type': 'application/pdf' } },
        );
      },
    );
    try {
      assert.notEqual(
        (await c.download.download(input({ preferred_source: 'wiley' }))).status,
        'downloaded',
      );
      assert.deepEqual(await readdir(join(c.root, 'papers')), []);
      assert.deepEqual(await readdir(join(c.root, 'locks')), []);
    } finally {
      await c.close();
    }
  }
});
test('path traversal, unapproved directories and symlink directories are rejected', async () => {
  const c = await context();
  try {
    await assert.rejects(c.library.directory(join(c.root, '..', 'escape')));
    await mkdir(join(c.root, 'actual'));
    await symlink(
      join(c.root, 'actual'),
      join(c.root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await assert.rejects(c.library.directory(join(c.root, 'linked')));
  } finally {
    await c.close();
  }
});
test('existing unknown files never overwritten; corrupt indexed copy is detected', async () => {
  const c = await context();
  try {
    await c.library.locked(doi, () =>
      c.library.save(
        doi,
        { data: pdf(), mime: 'application/pdf' },
        identity,
        'test',
        null,
        undefined,
        false,
        'publishedVersion',
      ),
    );
    const saved = await c.library.existing(doi);
    await writeFile(saved.file_path, pdf('corrupted'));
    await assert.rejects(c.library.existing(doi));
  } finally {
    await c.close();
  }
});
test('same DOI multiple OA candidates are sequential; successful OA never calls publisher', async () => {
  const c = await context(
    {
      WILEY_TDM_TOKEN: 'mock',
      LITERATURE_AUTHORIZED_APIS: 'wiley',
      LITERATURE_DOWNLOAD_ORDER: 'openalex,wiley',
    },
    (url) => {
      if (url.includes('crossref'))
        return response({ message: { ...crossrefRecord(), publisher: 'Wiley' } });
      if (url.includes('openalex'))
        return response(
          alexRecord(doi, [
            {
              is_oa: true,
              pdf_url: 'https://repo.example.org/first.pdf',
              version: 'acceptedVersion',
            },
            {
              is_oa: true,
              pdf_url: 'https://repo.example.org/second.pdf',
              version: 'acceptedVersion',
            },
          ]),
        );
      if (url.includes('first.pdf')) return response({}, 'application/json', 403);
      return response(pdf(), 'application/pdf');
    },
  );
  try {
    const r = await c.download.download(input({}));
    assert.equal(r.status, 'downloaded');
    assert.match(c.requests.at(-1).url, /second.pdf/);
    assert.ok(!c.requests.some((r) => r.url.includes('wiley')));
  } finally {
    await c.close();
  }
});
test('Europe PMC full text requires exact DOI and OA flag', async () => {
  const c = await context({}, () =>
    response({ resultList: { result: [{ doi, isOpenAccess: 'Y', pmcid: 'PMC123' }] } }),
  );
  try {
    const r = await new Discovery(c.cfg, c.http).pmc(doi);
    assert.match(r[0].url, /PMC123\/fullTextXML$/);
  } finally {
    await c.close();
  }
});
test('default overwrite=false also preserves a pre-existing unindexed target', async () => {
  const c = await context();
  try {
    const { stableId } = await import('../../dist/utils/identifiers.js');
    const path = join(c.root, 'papers', stableId(doi) + '.pdf');
    await writeFile(path, Buffer.from('user file'));
    await assert.rejects(
      c.library.save(
        doi,
        { data: pdf(), mime: 'application/pdf' },
        identity,
        'mock',
        null,
        undefined,
        false,
        'unknown',
      ),
    );
    assert.equal((await readFile(path)).toString(), 'user file');
    assert.ok(!(await readdir(join(c.root, 'papers'))).some((f) => f.endsWith('.tmp')));
  } finally {
    await c.close();
  }
});
test('cross-session Wiley pace is persisted and shared by independent library instances', async () => {
  const c = await context();
  try {
    const { Library } = await import('../../dist/storage/library.js');
    const other = new Library(c.cfg);
    const signal = AbortSignal.timeout(2000);
    await c.library.permit('wiley_tdm', signal, 15);
    const start = Date.now();
    await other.permit('wiley_tdm', signal, 15);
    assert.ok(Date.now() - start >= 8);
  } finally {
    await c.close();
  }
});
test('Wiley 403 identifies invalid token without a retry', async () => {
  const c = await context(
    { WILEY_TDM_TOKEN: 'mock', LITERATURE_AUTHORIZED_APIS: 'wiley' },
    (url) => (url.includes('wiley') ? response({}, 'application/json', 403) : meta(url)),
  );
  try {
    const r = await c.download.download(input({ preferred_source: 'wiley' }));
    assert.equal(r.status, 'credentials_required');
    assert.equal(c.requests.filter((v) => v.url.includes('wiley')).length, 1);
  } finally {
    await c.close();
  }
});
test('allow_publisher_api=false also prevents keyed Springer OA API', async () => {
  const c = await context(
    { SPRINGER_OPENACCESS_API_KEY: 'mock', LITERATURE_AUTHORIZED_APIS: 'springer_oa' },
    meta,
  );
  try {
    await c.download.download(input({ preferred_source: 'springer', allow_publisher_api: false }));
    assert.ok(!c.requests.some((r) => r.url.includes('springernature')));
  } finally {
    await c.close();
  }
});
test('unversioned arXiv OA links preserve actual PDF version and reject version substitution', async () => {
  const r = await validateFulltext(pdf('arXiv:2301.00001v2'), 'application/pdf', {
    arxiv_id: '2301.00001',
    authoritative: true,
    evidence: 'exact DOI source mapping',
  });
  assert.equal(r.arxiv_id, '2301.00001v2');
  await assert.rejects(
    validateFulltext(pdf('arXiv:2301.00001v2'), 'application/pdf', {
      arxiv_id: '2301.00001v1',
      authoritative: true,
      evidence: 'official ID',
    }),
  );
});
test('official JATS external DTD declaration is ignored safely; entity expansion is rejected', async () => {
  const jats = xml().replace(
    '?>',
    '?><!DOCTYPE article PUBLIC "-//NLM//DTD JATS//EN" "https://example.org/never-fetched.dtd">',
  );
  assert.equal(
    (await validateFulltext(Buffer.from(jats), 'application/xml', identity)).format,
    'xml',
  );
  const entity = xml().replace(
    '?>',
    '?><!DOCTYPE article [<!ENTITY leak SYSTEM "file:///etc/passwd">]>',
  );
  await assert.rejects(validateFulltext(Buffer.from(entity), 'application/xml', identity));
});
test('DOI auto-download resolves an unversioned arXiv location to official version before fetching', async () => {
  const c = await context({ LITERATURE_DOWNLOAD_ORDER: 'arxiv,openalex' }, (url) => {
    if (url.includes('crossref')) return response({ message: crossrefRecord() });
    if (url.includes('openalex'))
      return response(
        alexRecord(doi, [
          { is_oa: true, pdf_url: 'https://arxiv.org/pdf/2301.00001', version: 'submittedVersion' },
        ]),
      );
    if (url.includes('/api/query'))
      return response(
        '<feed><entry><id>http://arxiv.org/abs/2301.00001v2</id><doi>10.1234/target</doi><title>Target paper</title></entry></feed>',
        'text/xml',
      );
    return response(pdf(), 'application/pdf');
  });
  try {
    const r = await c.download.download(input({}));
    assert.equal(r.status, 'downloaded');
    assert.equal(r.arxiv_id, '2301.00001v2');
    assert.match(r.version, /v2/);
    assert.ok(c.requests.some((r) => r.url.endsWith('/pdf/2301.00001v2')));
  } finally {
    await c.close();
  }
});
