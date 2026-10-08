import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import {
  configDir,
  DEFAULT_REDIRECT_PORT,
  readConfig,
  readTokens,
  resolveOutDir,
  writeConfig,
  writeFileAtomic,
  writeTokens,
  type Config,
  type Tokens,
} from '../src/config.ts';

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'oura-sync-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const CONFIG: Config = { clientId: 'id', clientSecret: 'secret', redirectPort: DEFAULT_REDIRECT_PORT };
const TOKENS: Tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 1_700_000_000_000 };

test('configDir honours XDG_CONFIG_HOME and falls back to ~/.config', () => {
  assert.equal(configDir({ XDG_CONFIG_HOME: '/xdg' }), join('/xdg', 'oura-sync'));
  assert.equal(configDir({}), join(homedir(), '.config', 'oura-sync'));
  assert.equal(configDir({ XDG_CONFIG_HOME: '' }), join(homedir(), '.config', 'oura-sync'));
});

test('readConfig and readTokens return null when files are absent', async () => {
  await withTempDir(async (dir) => {
    assert.equal(await readConfig(join(dir, 'missing')), null);
    assert.equal(await readTokens(join(dir, 'missing')), null);
  });
});

test('config round-trips and is written with mode 0600 in a created directory', async () => {
  await withTempDir(async (dir) => {
    const target = join(dir, 'nested', 'oura-sync');
    await writeConfig(target, CONFIG);
    assert.deepEqual(await readConfig(target), CONFIG);
    const mode = (await stat(join(target, 'config.json'))).mode & 0o777;
    assert.equal(mode, 0o600);
  });
});

test('tokens round-trip, are mode 0600, and overwrite leaves no temp files', async () => {
  await withTempDir(async (dir) => {
    await writeTokens(dir, TOKENS);
    await writeTokens(dir, { ...TOKENS, accessToken: 'b' });
    assert.deepEqual(await readTokens(dir), { ...TOKENS, accessToken: 'b' });
    const mode = (await stat(join(dir, 'tokens.json'))).mode & 0o777;
    assert.equal(mode, 0o600);
    assert.ok((await readFile(join(dir, 'tokens.json'), 'utf8')).endsWith('\n'));
    assert.deepEqual(await readdir(dir), ['tokens.json']);
  });
});

test('readConfig and readTokens reject malformed files by path', async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'config.json'), JSON.stringify({ clientId: 'x' }));
    await assert.rejects(readConfig(dir), /config\.json/);
    await writeFile(join(dir, 'tokens.json'), 'not json');
    await assert.rejects(readTokens(dir), /tokens\.json/);
  });
});

test('writeFileAtomic replaces content and never leaves a partial file on error', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'out.csv');
    await writeFileAtomic(path, 'first\n');
    await writeFileAtomic(path, 'second\n');
    assert.equal(await readFile(path, 'utf8'), 'second\n');
    assert.deepEqual(await readdir(dir), ['out.csv']);
    // Writing under a path whose parent is a regular file fails before rename; the target is untouched.
    await assert.rejects(writeFileAtomic(join(path, 'child.csv'), 'x'));
    assert.equal(await readFile(path, 'utf8'), 'second\n');
  });
});

test('resolveOutDir precedence: flag, env, config, cwd', () => {
  const cwd = '/work';
  const config: Config = { ...CONFIG, outDir: '/from-config' };
  assert.equal(resolveOutDir({ flag: '/flag', env: { OURA_SYNC_OUT: '/env' }, config, cwd }), '/flag');
  assert.equal(resolveOutDir({ env: { OURA_SYNC_OUT: '/env' }, config, cwd }), '/env');
  assert.equal(resolveOutDir({ env: {}, config, cwd }), '/from-config');
  assert.equal(resolveOutDir({ env: { OURA_SYNC_OUT: '' }, config: CONFIG, cwd }), '/work');
  assert.equal(resolveOutDir({ env: {}, config: null, cwd }), '/work');
});

test('resolveOutDir resolves relative paths against cwd', () => {
  assert.equal(resolveOutDir({ flag: 'exports', env: {}, config: null, cwd: '/work' }), '/work/exports');
});
