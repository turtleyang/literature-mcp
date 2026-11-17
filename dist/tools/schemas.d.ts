import { z } from 'zod';
export declare const searchSchema: z.ZodObject<{
    query: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<{
        deep: "deep";
        fast: "fast";
        wos: "wos";
    }>>;
    max_results: z.ZodDefault<z.ZodNumber>;
    year_from: z.ZodOptional<z.ZodNumber>;
    year_to: z.ZodOptional<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<{
        citations: "citations";
        date: "date";
        relevance: "relevance";
    }>>;
    sources: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        arxiv: "arxiv";
        crossref: "crossref";
        openalex: "openalex";
        sciencedirect: "sciencedirect";
        scopus: "scopus";
        semantic_scholar: "semantic_scholar";
        springer: "springer";
        wos_expanded: "wos_expanded";
        wos_starter: "wos_starter";
    }>>>;
    wos_product: z.ZodDefault<z.ZodEnum<{
        expanded: "expanded";
        starter: "starter";
    }>>;
    record_view: z.ZodOptional<z.ZodEnum<{
        full: "full";
        short: "short";
    }>>;
    author_id: z.ZodOptional<z.ZodString>;
    journal_id: z.ZodOptional<z.ZodString>;
    min_citations: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type SearchInput = z.infer<typeof searchSchema>;
export declare const getSchema: z.ZodObject<{
    doi: z.ZodString;
    metadata_sources: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        arxiv: "arxiv";
        crossref: "crossref";
        openalex: "openalex";
        sciencedirect: "sciencedirect";
        scopus: "scopus";
        semantic_scholar: "semantic_scholar";
        springer: "springer";
        wos_expanded: "wos_expanded";
        wos_starter: "wos_starter";
    }>>>;
    include_citations: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const downloadSchema: z.ZodObject<{
    doi: z.ZodOptional<z.ZodString>;
    arxiv_id: z.ZodOptional<z.ZodString>;
    preferred_source: z.ZodDefault<z.ZodEnum<{
        arxiv: "arxiv";
        auto: "auto";
        elsevier: "elsevier";
        open_access: "open_access";
        springer: "springer";
        wiley: "wiley";
    }>>;
    save_directory: z.ZodOptional<z.ZodString>;
    allow_publisher_api: z.ZodDefault<z.ZodBoolean>;
    overwrite: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export type DownloadInput = z.infer<typeof downloadSchema>;
