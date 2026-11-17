import path from 'node:path';
/** Keep POSIX, Windows drive and UNC roots intact while checking every ancestor. */
export function directoryChain(input, api = path) {
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
export function samePath(a, b, platform = process.platform) {
    if (platform === 'win32') {
        const normalize = (value) => path.win32.toNamespacedPath(path.win32.resolve(value)).toLowerCase();
        return normalize(a) === normalize(b);
    }
    return path.resolve(a) === path.resolve(b);
}
//# sourceMappingURL=paths.js.map