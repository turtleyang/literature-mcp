import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { directoryChain, samePath } from '../../dist/utils/paths.js';
import { clientConfigs, setup } from '../../scripts/setup.mjs';

test('path traversal preserves POSIX, Windows drive and UNC roots', () => {
  assert.deepEqual(directoryChain('/srv/papers', path.posix), ['/', '/srv', '/srv/papers']);
  assert.deepEqual(directoryChain('D:\\Library\\papers', path.win32), [
    'D:\\',
    'D:\\Library',
    'D:\\Library\\papers',
  ]);
  assert.deepEqual(directoryChain('\\\\host\\share\\papers', path.win32), [
    '\\\\host\\share\\',
    '\\\\host\\share\\papers',
  ]);
});
test('Windows canonical path comparison tolerates casing but rejects different directories', () => {
  assert.equal(samePath('C:\\Papers', '\\\\?\\c:\\papers', 'win32'), true);
  assert.equal(samePath('C:\\Papers', 'C:\\Other', 'win32'), false);
  assert.equal(samePath('/Papers', '/papers', 'linux'), false);
});
test('client definitions use direct absolute Node entry on Windows and POSIX', () => {
  const win = clientConfigs(
    'C:\\Research Projects\\literature-mcp',
    'C:\\Program Files\\nodejs\\node.exe',
    'win32',
  );
  const definition = JSON.parse(win['.mcp.json']).mcpServers['literature-mcp'];
  assert.equal(definition.command, 'C:\\Program Files\\nodejs\\node.exe');
  assert.deepEqual(definition.args, ['C:\\Research Projects\\literature-mcp\\dist\\server.js']);
  assert.ok(!win['.codex/config.toml'].includes('start.sh'));
  assert.equal(
    JSON.parse(clientConfigs('/srv/literature-mcp', '/opt/node/bin/node', 'linux')['.mcp.json'])
      .mcpServers['literature-mcp'].args[0],
    '/srv/literature-mcp/dist/server.js',
  );
});
test('setup preserves private env and existing client config; adds missing clients', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'literature-setup-'));
  try {
    await writeFile(path.join(root, '.env.example'), 'WILEY_TDM_TOKEN=\n');
    await writeFile(path.join(root, '.env'), 'USER_PRIVATE_SETTING=preserve\n');
    await mkdir(path.join(root, '.codex'));
    await writeFile(path.join(root, '.codex', 'config.toml'), '# user configuration\n');
    await setup(root);
    assert.equal(
      await readFile(path.join(root, '.env'), 'utf8'),
      'USER_PRIVATE_SETTING=preserve\n',
    );
    assert.equal(
      await readFile(path.join(root, '.codex', 'config.toml'), 'utf8'),
      '# user configuration\n',
    );
    const generated = JSON.parse(await readFile(path.join(root, '.cursor', 'mcp.json'), 'utf8'));
    assert.equal(generated.mcpServers['literature-mcp'].command, process.execPath);
    assert.equal(
      generated.mcpServers['literature-mcp'].args[0],
      path.join(root, 'dist', 'server.js'),
    );
    assert.ok((await setup(root)).every((item) => item.status === 'preserved'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('offline stdio launcher works from a different working directory on the native OS', async () => {
  const script = fileURLToPath(new URL('../../scripts/smoke.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], {
    cwd: tmpdir(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const timeout = setTimeout(() => child.kill(), 30000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(code, 0, output);
    assert.match(output, /Offline stdio smoke passed/);
  } finally {
    clearTimeout(timeout);
    child.kill();
  }
});
