import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, AuthRequiredError } from '../src/errors.ts';
import { MAX_RATE_LIMIT_RETRIES, OuraApi } from '../src/api.ts';
import { sequence } from './stub-fetch.ts';

function client(
  fetchFn: typeof fetch,
  extra: { refreshes?: string[]; sleeps?: number[]; logs?: string[] } = {},
) {
  const refreshes = extra.refreshes ?? [];
  const sleeps = extra.sleeps ?? [];
  return new OuraApi({
    fetchFn,
    getAccessToken: async () => 'token-1',
    refreshAccessToken: async () => {
      refreshes.push('refresh');
      return 'token-2';
    },
    log: (m) => extra.logs?.push(m),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

test('fetchCollection sends bearer auth, date params, and a timeout signal', async () => {
  const { fetchFn, calls } = sequence([{ status: 200, body: { data: [{ id: 1 }], next_token: null } }]);
  const items = await client(fetchFn).fetchCollection('daily_sleep', '2025-01-01', '2025-01-31');
  assert.deepEqual(items, [{ id: 1 }]);
  assert.equal(calls.length, 1);
  const url = new URL(calls[0]!.url);
  assert.equal(url.origin + url.pathname, 'https://api.ouraring.com/v2/usercollection/daily_sleep');
  assert.equal(url.searchParams.get('start_date'), '2025-01-01');
  assert.equal(url.searchParams.get('end_date'), '2025-01-31');
  assert.equal(url.searchParams.get('next_token'), null);
  assert.equal(calls[0]!.auth, 'Bearer token-1');
  assert.ok(calls[0]!.signal instanceof AbortSignal);
});

test('fetchCollection follows next_token until exhausted', async () => {
  const { fetchFn, calls } = sequence([
    { status: 200, body: { data: [{ id: 1 }], next_token: 'p2' } },
    { status: 200, body: { data: [{ id: 2 }], next_token: 'p3' } },
    { status: 200, body: { data: [{ id: 3 }], next_token: null } },
  ]);
  const items = await client(fetchFn).fetchCollection('sleep', '2025-01-01', '2025-01-31');
  assert.deepEqual(items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(new URL(calls[1]!.url).searchParams.get('next_token'), 'p2');
  assert.equal(new URL(calls[2]!.url).searchParams.get('next_token'), 'p3');
});

test('429 waits Retry-After seconds and retries', async () => {
  const sleeps: number[] = [];
  const logs: string[] = [];
  const { fetchFn, calls } = sequence([
    { status: 429, headers: { 'Retry-After': '7' } },
    { status: 200, body: { data: [], next_token: null } },
  ]);
  await client(fetchFn, { sleeps, logs }).fetchCollection('sleep', '2025-01-01', '2025-01-02');
  assert.deepEqual(sleeps, [7000]);
  assert.deepEqual(logs, [`Rate limited by Oura; waiting 7 s (retry 1/${MAX_RATE_LIMIT_RETRIES})`]);
  assert.equal(calls.length, 2);
});

test('429 without Retry-After waits 5 seconds', async () => {
  const sleeps: number[] = [];
  const { fetchFn } = sequence([{ status: 429 }, { status: 200, body: { data: [], next_token: null } }]);
  await client(fetchFn, { sleeps }).fetchCollection('sleep', '2025-01-01', '2025-01-02');
  assert.deepEqual(sleeps, [5000]);
});

test('429 gives up after MAX_RATE_LIMIT_RETRIES retries', async () => {
  const responses = Array.from({ length: MAX_RATE_LIMIT_RETRIES + 1 }, () => ({ status: 429, body: 'slow down' }));
  const { fetchFn, calls } = sequence(responses);
  await assert.rejects(client(fetchFn).fetchCollection('sleep', '2025-01-01', '2025-01-02'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 429);
    return true;
  });
  assert.equal(calls.length, MAX_RATE_LIMIT_RETRIES + 1);
});

test('401 refreshes once and retries with the new token', async () => {
  const refreshes: string[] = [];
  const { fetchFn, calls } = sequence([{ status: 401 }, { status: 200, body: { data: [{ id: 1 }], next_token: null } }]);
  const items = await client(fetchFn, { refreshes }).fetchCollection('sleep', '2025-01-01', '2025-01-02');
  assert.deepEqual(items, [{ id: 1 }]);
  assert.deepEqual(refreshes, ['refresh']);
  assert.equal(calls[1]!.auth, 'Bearer token-2');
});

test('a second 401 fails with AuthRequiredError', async () => {
  const { fetchFn } = sequence([{ status: 401 }, { status: 401 }]);
  await assert.rejects(client(fetchFn).fetchCollection('sleep', '2025-01-01', '2025-01-02'), AuthRequiredError);
});

test('other non-2xx statuses fail with ApiError carrying the body', async () => {
  const { fetchFn } = sequence([{ status: 403, body: 'subscription expired' }]);
  await assert.rejects(client(fetchFn).fetchCollection('sleep', '2025-01-01', '2025-01-02'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 403);
    assert.equal(err.body, 'subscription expired');
    return true;
  });
});
