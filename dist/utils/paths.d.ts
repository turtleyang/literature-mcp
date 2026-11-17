import path from 'node:path';
type PathApi = Pick<typeof path, 'resolve' | 'parse' | 'relative' | 'join' | 'sep'>;
/** Keep POSIX, Windows drive and UNC roots intact while checking every ancestor. */
export declare function directoryChain(input: string, api?: PathApi): string[];
/** realpath may normalize drive-letter casing or add a Windows namespace prefix. */
export declare function samePath(a: string, b: string, platform?: NodeJS.Platform): boolean;
export {};
