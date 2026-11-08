import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Failure } from '../utils/control.js';
import type { Format } from '../models/paper.js';
export interface Identity {
  doi?: string;
  arxiv_id?: string;
  authoritative: boolean;
  evidence: string;
}
export async function validateFulltext(
  data: Buffer,
  mime: string,
  identity: Identity,
): Promise<{ format: Format; identity_verification: string; pages?: number; arxiv_id?: string }> {
  if (data.length < 100) throw new Failure('unsupported_format', 'Full text is too small');
  const head = data.subarray(0, 1024).toString('utf8').trimStart();
  if (head.startsWith('%PDF-')) {
    if (!['application/pdf', 'application/octet-stream', 'binary/octet-stream'].includes(mime))
      throw new Failure('unsupported_format', 'PDF bytes conflict with declared MIME');
    if (!data.subarray(-2048).includes(Buffer.from('%%EOF')))
      throw new Failure('unsupported_format', 'PDF is truncated (missing EOF)');
    const task = getDocument({
      data: Uint8Array.from(data),
      verbosity: 0,
      stopAtErrors: true,
      disableFontFace: true,
      useSystemFonts: false,
    });
    try {
      const doc = await task.promise;
      if (doc.numPages < 1 || doc.numPages > 3000)
        throw new Failure('unsupported_format', 'PDF page count exceeds validation limit');
      let front = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        if (i <= 2) {
          const c = await page.getTextContent();
          front += c.items.map((v: any) => v.str || '').join(' ');
        }
      }
      const normalized = front.toLowerCase().replace(/\s+/g, '');
      const matched =
        identity.doi && normalized.includes(identity.doi.toLowerCase().replace(/\s+/g, ''));
      const arxivMatch = identity.arxiv_id && normalized.includes(identity.arxiv_id.toLowerCase());
      const versionedId = identity.arxiv_id
        ? (
            normalized.match(/(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})v[1-9]\d*/g) || []
          ).find(
            (id) =>
              id.replace(/v\d+$/, '') === identity.arxiv_id!.toLowerCase().replace(/v\d+$/, ''),
          )
        : undefined;
      if (
        versionedId &&
        /v\d+$/.test(identity.arxiv_id!) &&
        versionedId !== identity.arxiv_id!.toLowerCase()
      )
        throw new Failure('failed', 'PDF arXiv version differs from requested version');
      const resolvedArxiv = versionedId
        ? identity.arxiv_id!.replace(/v\d+$/, '') + versionedId.match(/v\d+$/)![0]
        : undefined;
      if (!matched && !arxivMatch && !identity.authoritative)
        throw new Failure('failed', 'Cannot verify target identity in PDF front matter');
      return {
        format: 'pdf',
        identity_verification: matched
          ? 'DOI in PDF front matter'
          : arxivMatch
            ? 'arXiv ID in PDF front matter'
            : identity.evidence,
        pages: doc.numPages,
        arxiv_id: resolvedArxiv,
      };
    } catch (e) {
      if (e instanceof Failure) throw e;
      throw new Failure(
        'unsupported_format',
        'PDF parser rejected incomplete, encrypted, or invalid content',
      );
    } finally {
      await task.destroy();
    }
  }
  if (
    /(?:xml|jats)/.test(mime) ||
    head.startsWith('<?xml') ||
    /^<(?:article|articles|full-text-retrieval-response)\b/.test(head)
  ) {
    if (
      !['application/xml', 'text/xml', 'application/jats+xml', 'application/octet-stream'].includes(
        mime,
      )
    )
      throw new Failure('unsupported_format', 'XML bytes conflict with declared MIME');
    const xml = data.toString('utf8');
    // External entities and DTD expansion are never used.
    if (/<!ENTITY/i.test(xml))
      throw new Failure('unsupported_format', 'External XML entities are not accepted');
    const parsingXml = xml.replace(/<!DOCTYPE\s+[^>]*>/gi, '');
    if (XMLValidator.validate(parsingXml) !== true)
      throw new Failure('unsupported_format', 'Malformed XML');
    const parsed = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      processEntities: false,
    }).parse(parsingXml);
    const root =
      parsed.article || parsed.articles?.article || parsed['full-text-retrieval-response'];
    if (!root || !/<(?:[\w-]+:)?(?:body|originalText|rawtext)\b/i.test(xml))
      throw new Failure(
        'unsupported_format',
        'API returned metadata or an error, rather than full text',
      );
    const ids = [...xml.matchAll(/<(?:[\w-]+:)?(?:article-id|doi|prism:doi)\b([^>]*)>([^<]+)</gi)]
      .filter((m) => !m[1] || /doi/i.test(m[1]) || /doi/i.test(m[0]))
      .map((m) => m[2]!.trim().toLowerCase());
    if (identity.doi && ids.length && !ids.includes(identity.doi))
      throw new Failure('failed', 'XML DOI does not match target');
    if (identity.doi && !ids.includes(identity.doi) && !identity.authoritative)
      throw new Failure('failed', 'XML identity could not be verified');
    return {
      format: 'xml',
      identity_verification: ids.includes(identity.doi || '')
        ? 'Exact DOI in structured full text'
        : identity.evidence,
    };
  }
  // Article Retrieval no longer promises HTML. A generic login page must never become a successful full text.
  throw new Failure(
    'unsupported_format',
    'Response is not a verified PDF or structured XML full text',
  );
}
