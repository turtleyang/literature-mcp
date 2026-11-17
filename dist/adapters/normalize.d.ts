import { type Paper, type Source } from '../models/paper.js';
export declare function openAlex(data: any): Paper;
export declare function crossref(data: any): Paper;
export declare function semantic(data: any): Paper;
export declare function upstreamPaper(data: any, source: Source): Paper;
