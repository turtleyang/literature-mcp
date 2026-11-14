import { z } from 'zod';
import { sources } from '../models/paper.js';
const year = z.number().int().min(1500).max(2200);
export const searchSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe(
        'Keywords or a source-specific query. Both WoS Starter and Expanded support field queries such as TS=(diamond AND "thermal conductivity") AND PY=(2020-2025), TI=, AU=, SO= and DO=. WoS queries allow at most 10 Boolean operators.',
      ),
    mode: z
      .enum(['fast', 'wos', 'deep'])
      .default('fast')
      .describe(
        'fast=OpenAlex+Crossref; wos=only the selected WoS product; deep=public sources. Explicit sources override fast/deep defaults.',
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe(
        'Maximum candidates returned, 1-50. THIS MCP TOOL does not expose pagination or total matches; the WoS Starter API itself supports pagination and totals. These are wrapper limits, not absent Starter capabilities. Results are not a certified exhaustive corpus.',
      ),
    year_from: year.optional(),
    year_to: year.optional(),
    sort_by: z.enum(['relevance', 'date', 'citations']).default('relevance'),
    sources: z.array(z.enum(sources)).min(1).max(5).optional(),
    wos_product: z
      .enum(['starter', 'expanded'])
      .default('starter')
      .describe(
        'For mode=wos. Starter already searches Web of Science Core Collection (db=WOS), supports field queries and returns citation counts when permitted. Expanded needs a separate key/license and adds richer metadata and relations; it is not required for Core Collection search.',
      ),
    record_view: z
      .enum(['short', 'full'])
      .optional()
      .describe(
        'Expanded ONLY. For WoS Starter OMIT this property entirely: neither short nor full is valid. For Expanded, short is the default and full requests richer record metadata, not article full text.',
      ),
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
    {
      message:
        'record_view is Expanded-only; OMIT the property entirely for WoS Starter (short is also invalid)',
    },
  );
export type SearchInput = z.infer<typeof searchSchema>;
export const getSchema = z
  .object({
    doi: z
      .string()
      .min(1)
      .max(300)
      .describe('Exact DOI of the requested paper, or its doi.org URL.'),
    metadata_sources: z
      .array(z.enum(sources))
      .min(1)
      .max(5)
      .optional()
      .describe(
        'Defaults to Crossref+OpenAlex. For Web of Science metadata and times-cited counts explicitly select ["wos_starter"]. Starter uses Core Collection (db=WOS); Expanded is a separate optional product.',
      ),
    include_citations: z
      .boolean()
      .default(false)
      .describe(
        'Keep false to obtain metadata and citation COUNTS, including WoS Starter counts. True additionally requests up to 20 citing-paper relationships from selected Expanded or Semantic Scholar; it is not needed for times-cited counts.',
      ),
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
    overwrite: z
      .boolean()
      .default(false)
      .describe(
        'Keep false to reuse a validated existing local file. True explicitly re-downloads and replaces the same indexed paper.',
      ),
  })
  .strict()
  .refine((v) => !!(v.doi || v.arxiv_id), { message: 'doi or arxiv_id required' });
export type DownloadInput = z.infer<typeof downloadSchema>;
