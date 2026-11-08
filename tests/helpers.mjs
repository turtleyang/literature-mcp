import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeConfig } from '../dist/config.js';
import { Http } from '../dist/utils/http.js';
import { Library } from '../dist/storage/library.js';
import { SearchService } from '../dist/search/service.js';
import { DownloadService } from '../dist/download/service.js';
export const doi = '10.1234/target';
export function pdf(content = doi) {
  const escaped = content.replace(/[()\\]/g, '\\$&');
  const stream = `BT /F1 12 Tf 40 700 Td (${escaped}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}
export const xml = (id = doi) =>
  `<?xml version="1.0"?><article><front><article-meta><article-id pub-id-type="doi">${id}</article-id><title-group><article-title>Target paper</article-title></title-group></article-meta></front><body><p>Full scholarly article text and measured results.</p></body></article>`;
export const response = (data, mime = 'application/json', status = 200, headers = {}) =>
  new Response(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data), {
    status,
    headers: { 'content-type': mime, ...headers },
  });
export function crossrefRecord(id = doi) {
  return {
    DOI: id,
    title: ['Target paper'],
    author: [{ given: 'A', family: 'Researcher' }],
    publisher: 'Test Publisher',
    'container-title': ['Journal'],
    published: { 'date-parts': [[2025]] },
    'is-referenced-by-count': 0,
    type: 'journal-article',
  };
}
export function alexRecord(id = doi, locations = []) {
  return {
    id: 'https://openalex.org/W1',
    doi: `https://doi.org/${id}`,
    title: 'Target paper',
    authorships: [{ author: { display_name: 'A Researcher' } }],
    publication_year: 2025,
    cited_by_count: 3,
    locations,
  };
}
export async function context(env = {}, route, backendCall) {
  const root = await mkdtemp(join(tmpdir(), 'literature-test-'));
  const cfg = makeConfig({ LITERATURE_LIBRARY_DIR: root, ...env });
  const requests = [];
  const calls = [];
  const http = new Http(cfg, async (url, init) => {
    requests.push({ url, init });
    return route ? route(url, init) : response({});
  });
  http.throttle = async () => {};
  const backend = {
    call: async (name, args, signal) => {
      calls.push({ name, args });
      return backendCall ? backendCall(name, args, signal) : [];
    },
    close: async () => {},
  };
  const library = new Library(cfg);
  await library.init();
  const search = new SearchService(cfg, http, backend);
  const download = new DownloadService(cfg, search, http, library);
  return {
    cfg,
    http,
    backend,
    library,
    search,
    download,
    requests,
    calls,
    root,
    async close() {
      await http.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
export const upstream = (id = doi, citations = 0) => ({
  doi: id,
  title: 'Target paper',
  authors: 'A Researcher',
  paper_id: id,
  year: 2025,
  citation_count: citations,
  extra: '{}',
});
