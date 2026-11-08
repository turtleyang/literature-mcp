import { createHash } from 'node:crypto';
export function normalizeDoi(input: string): string {
  let value = input
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  try {
    value = decodeURIComponent(value);
  } catch {
    throw new Error('Invalid DOI encoding');
  }
  if (value.length > 256 || !/^10\.\d{4,9}\/[^\s\x00-\x1f]+$/i.test(value) || /[<>"\\]/.test(value))
    throw new Error('Invalid DOI');
  return value.toLowerCase();
}
export function maybeDoi(v: unknown): string | null {
  try {
    return typeof v === 'string' ? normalizeDoi(v) : null;
  } catch {
    return null;
  }
}
export function normalizeArxiv(input: string): string {
  const id = input
    .trim()
    .replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//i, '')
    .replace(/^arxiv:\s*/i, '')
    .replace(/\.pdf$/i, '');
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v[1-9]\d*)?$/.test(id))
    throw new Error('Invalid arXiv ID');
  return id;
}
export const stableId = (identifier: string) =>
  createHash('sha256').update(identifier).digest('hex');
export const text = (v: unknown, limit = 12000) =>
  typeof v === 'string'
    ? v
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limit)
    : '';
