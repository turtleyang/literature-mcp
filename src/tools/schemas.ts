import { z } from 'zod';
import { sources } from '../models/paper.js';
const year = z.number().int().min(1500).max(2200);
export const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    mode: z.enum(['fast', 'wos', 'deep']).default('fast'),
    max_results: z.number().int().min(1).max(50).default(10),
    year_from: year.optional(),
    year_to: year.optional(),
    sort_by: z.enum(['relevance', 'date', 'citations']).default('relevance'),
    sources: z.array(z.enum(sources)).min(1).max(5).optional(),
    wos_product: z.enum(['starter', 'expanded']).default('starter'),
    record_view: z.enum(['short', 'full']).optional(),
    author_id: z
      .string()
      .regex(/^A\d+$/)
      .optional(),
    journal_id: z
      .string()
      .regex(/^S\d+$/)
      .optional(),
    min_citations: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (v) =>
      !(v.author_id || v.journal_id || v.min_citations !== undefined) ||
      (v.sources?.length === 1 && v.sources[0] === 'openalex'),
    { message: 'OpenAlex ID/citation filters require sources:[openalex]' },
  )
  .refine((v) => !(v.year_from && v.year_to && v.year_from > v.year_to), {
    message: 'year_from must be <= year_to',
  })
  .refine(
    (v) => v.mode !== 'wos' || !v.sources || v.sources.every((s) => s === `wos_${v.wos_product}`),
    { message: 'wos mode only calls selected WoS product' },
  )
  .refine(
    (v) => !v.record_view || v.wos_product === 'expanded' || v.sources?.includes('wos_expanded'),
    { message: 'record_view requires WoS Expanded' },
  );
export type SearchInput = z.infer<typeof searchSchema>;
export const getSchema = z
  .object({
    doi: z.string().min(1).max(300),
    metadata_sources: z.array(z.enum(sources)).min(1).max(5).optional(),
    include_citations: z.boolean().default(false),
  })
  .strict();
export const downloadSchema = z
  .object({
    doi: z.string().min(1).max(300).optional(),
    arxiv_id: z.string().max(100).optional(),
    preferred_source: z
      .enum(['auto', 'wiley', 'elsevier', 'springer', 'arxiv', 'open_access'])
      .default('auto'),
    save_directory: z.string().max(4096).optional(),
    allow_publisher_api: z.boolean().default(true),
    overwrite: z.boolean().default(false),
  })
  .strict()
  .refine((v) => !!(v.doi || v.arxiv_id), { message: 'doi or arxiv_id required' });
export type DownloadInput = z.infer<typeof downloadSchema>;
