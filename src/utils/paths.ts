import path from 'node:path';

type PathApi = Pick<typeof path, 'resolve' | 'parse' | 'relative' | 'join' | 'sep'>;

/** Keep POSIX, Windows drive and UNC roots intact while checking every ancestor. */
export function directoryChain(input: string, api: PathApi = path): string[] {
  const absolute = api.resolve(input);
  const root = api.parse(absolute).root;
  const chain = [root];
  let current = root;
  for (const part of api.relative(root, absolute).split(api.sep).filter(Boolean)) {
    current = api.join(current, part);
    chain.push(current);
  }
  return chain;
}

/** realpath may normalize drive-letter casing or add a Windows namespace prefix. */
export function samePath(a: string, b: string, platform = process.platform): boolean {
  if (platform === 'win32') {
    const normalize = (value: string) =>
      path.win32.toNamespacedPath(path.win32.resolve(value)).toLowerCase();
    return normalize(a) === normalize(b);
  }
  return path.resolve(a) === path.resolve(b);
}
