import type { Format } from '../models/paper.js';
export interface Identity {
    doi?: string;
    arxiv_id?: string;
    authoritative: boolean;
    evidence: string;
}
export declare function validateFulltext(data: Buffer, mime: string, identity: Identity): Promise<{
    format: Format;
    identity_verification: string;
    pages?: number;
    arxiv_id?: string;
}>;
