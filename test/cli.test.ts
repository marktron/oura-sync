import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TOKEN_URL } from '../src/auth.ts';
import { main, runExport, runLogin } from '../src/cli.ts';
import { readConfig, readTokens, writeConfig, writeTokens, type Config } from '../src/config.ts';
import { AuthRequiredError, NoDataError, UsageError } from '../src/errors.ts';
import { HEADERS } from '../src/mapping.ts';
import { ACTIVITY, DAILY_SLEEP, LONG_SLEEP, NAP, READINESS } from './fixtures.ts';
import { stubFetch, type FetchCall } from './stub-fetch.ts';

const CONFIG: Config = { clientId: 'cid', clientSecret: 'csec', redirectPort: 8477 };
const FAR_FUTURE = Date.now() + 86_400_000;

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'oura-sync-cli-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Routes the four collection requests to fixture data and the token URL to a refresh response. */
function apiStub(data: { empty?: boolean } = {}) {
  return stubFetch((call: FetchCall) => {
    if (call.url === TOKEN_URL) {
      return { status: 200, body: { access_token: 'refreshed', token_type: 'bearer', expires_in: 3600, refresh_token: 'r2' } };
    }
    const path = new URL(call.url).pathname;
    const docs = path.endsWith('/daily_sleep')
      ? [DAILY_SLEEP]
      : path.endsWith('/sleep')
        ? [NAP, LONG_SLEEP]
        : path.endsWith('/daily_readiness')
          ? [READINESS]
          : path.endsWith('/daily_activity')
            ? [ACTIVITY]
            : undefined;
    if (!docs) return undefined;
    return { status: 200, body: { data: data.empty ? [] : docs, next_token: null } };
  });
}

async function seeded(dir: string, tokens = { accessToken: 'tok', refreshToken: 'r', expiresAt: FAR_FUTURE }) {
  const configDir = join(dir, 'config');
  await writeConfig(configDir, CONFIG);
  await writeTokens(configDir, tokens);
  return configDir;
}

test('runExport writes the CSV into a created output directory and returns its path', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir);
    const outDir = join(dir, 'does', 'not', 'exist', 'yet');
    const { fetchFn, calls } = apiStub();
    const logs: string[] = [];

    const path = await runExport(
      { start: '2025-01-01', end: '2025-01-03', out: outDir },
      { configDir, env: {}, cwd: dir, today: '2025-01-10', fetchFn, log: (m) => logs.push(m) },
    );

    assert.equal(path, join(outDir, '2025-01-01-to-2025-01-03-oura-trends.csv'));
    const lines = (await readFile(path, 'utf8')).split('\n');
    assert.equal(lines[0], HEADERS.join(','));
    assert.equal(lines.length, 3);
    const cells = lines[1]!.split(',');
    assert.equal(cells[0], '2025-01-02');
    assert.equal(cells[HEADERS.indexOf('Average Resting Heart Rate')], '55.5');
    assert.ok(calls.every((c) => c.auth === 'Bearer tok'));
    assert.ok(calls.every((c) => new URL(c.url).searchParams.get('start_date') === '2025-01-01'));
    assert.ok(logs.some((m) => m.includes('1 row') && m.includes(path)));
    assert.deepEqual(await readdir(outDir), ['2025-01-01-to-2025-01-03-oura-trends.csv']);
  });
});

test('runExport defaults end to yesterday', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir);
    const { fetchFn, calls } = apiStub();
    const path = await runExport(
      { start: '2025-01-01', out: dir },
      { configDir, env: {}, cwd: dir, today: '2025-01-04', fetchFn, log: () => {} },
    );
    assert.equal(path, join(dir, '2025-01-01-to-2025-01-03-oura-trends.csv'));
    assert.ok(calls.every((c) => new URL(c.url).searchParams.get('end_date') === '2025-01-03'));
  });
});

test('runExport refreshes an expiring token first and persists the new tokens', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir, { accessToken: 'stale', refreshToken: 'r1', expiresAt: Date.now() + 1000 });
    const { fetchFn, calls } = apiStub();

    await runExport(
      { start: '2025-01-01', end: '2025-01-03', out: dir },
      { configDir, env: {}, cwd: dir, today: '2025-01-10', fetchFn, log: () => {} },
    );

    assert.equal(calls[0]!.url, TOKEN_URL);
    assert.ok(calls.slice(1).every((c) => c.auth === 'Bearer refreshed'));
    assert.equal((await readTokens(configDir))?.refreshToken, 'r2');
  });
});

test('runExport requires --start', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir);
    const { fetchFn } = apiStub();
    await assert.rejects(
      runExport({ out: dir }, { configDir, env: {}, cwd: dir, today: '2025-01-10', fetchFn, log: () => {} }),
      UsageError,
    );
  });
});

test('runExport without config or tokens tells the user to log in', async () => {
  await withTempDir(async (dir) => {
    const deps = { configDir: join(dir, 'config'), env: {}, cwd: dir, today: '2025-01-10', log: () => {} };
    await assert.rejects(runExport({ start: '2025-01-01', out: dir }, deps), AuthRequiredError);
    await writeConfig(deps.configDir, CONFIG);
    await assert.rejects(runExport({ start: '2025-01-01', out: dir }, deps), AuthRequiredError);
  });
});

test('runExport writes nothing when the API fails', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir);
    const { fetchFn } = stubFetch(() => ({ status: 500, body: 'boom' }));
    await assert.rejects(
      runExport(
        { start: '2025-01-01', end: '2025-01-03', out: dir },
        { configDir, env: {}, cwd: dir, today: '2025-01-10', fetchFn, log: () => {} },
      ),
      /500/,
    );
    assert.deepEqual((await readdir(dir)).filter((f) => f.endsWith('.csv')), []);
  });
});

test('runExport writes nothing and fails when the range has no data', async () => {
  await withTempDir(async (dir) => {
    const configDir = await seeded(dir);
    const { fetchFn } = apiStub({ empty: true });
    await assert.rejects(
      runExport(
        { start: '2025-01-01', end: '2025-01-03', out: dir },
        { configDir, env: {}, cwd: dir, today: '2025-01-10', fetchFn, log: () => {} },
      ),
      NoDataError,
    );
    assert.deepEqual((await readdir(dir)).filter((f) => f.endsWith('.csv')), []);
  });
});

test('runLogin prompts for credentials on first run, saves config and tokens, reports success last', async () => {
  await withTempDir(async (dir) => {
    const configDir = join(dir, 'config');
    const answers = ['  my-id ', 'my-secret\n'];
    const logs: string[] = [];
    const { fetchFn } = stubFetch(() => ({
      status: 200,
      body: { access_token: 'a', token_type: 'bearer', expires_in: 10, refresh_token: 'r' },
    }));
    await runLogin({
      configDir,
      fetchFn,
      log: (m) => logs.push(m),
      prompt: async () => answers.shift()!,
      timeoutMs: 5000,
      redirectPort: 0,
      openBrowser: async (url) => {
        const u = new URL(url);
        const redirect = new URL(u.searchParams.get('redirect_uri')!);
        await fetch(`${redirect.origin}/callback?code=xyz&state=${u.searchParams.get('state')}`);
      },
    });
    const config = await readConfig(configDir);
    assert.equal(config?.clientId, 'my-id');
    assert.equal(config?.clientSecret, 'my-secret');
    assert.equal(config?.redirectPort, 0);
    assert.equal((await readTokens(configDir))?.accessToken, 'a');
    assert.match(logs[logs.length - 1]!, /Logged in/);
  });
});

test('runLogin rejects empty credentials', async () => {
  await withTempDir(async (dir) => {
    await assert.rejects(
      runLogin({ configDir: join(dir, 'config'), log: () => {}, prompt: async () => '' }),
      UsageError,
    );
  });
});

test('main returns 2 for an unknown command and 1 for a usage error', async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (m: string) => errors.push(m);
  try {
    assert.equal(await main(['frobnicate']), 2);
    assert.equal(await main(['export', '--bogus']), 1);
    assert.ok(errors.some((m) => m.includes('frobnicate')));
  } finally {
    console.error = original;
  }
});

test('main --help returns 0', async () => {
  const original = console.log;
  console.log = () => {};
  try {
    assert.equal(await main(['--help']), 0);
  } finally {
    console.log = original;
  }
});
