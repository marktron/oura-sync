import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthRequiredError } from '../src/errors.ts';
import {
  authorizeUrl,
  exchangeCode,
  login,
  newVerifier,
  pkceChallenge,
  redirectUri,
  refreshTokens,
  SCOPES,
  TOKEN_URL,
  toTokens,
  waitForCallback,
} from '../src/auth.ts';
import type { Config, Tokens } from '../src/config.ts';
import { stubFetch } from './stub-fetch.ts';

const CONFIG: Config = { clientId: 'cid', clientSecret: 'csec', redirectPort: 0 };
const NOW = 1_700_000_000_000;

test('pkceChallenge matches the RFC 7636 appendix B vector', () => {
  assert.equal(
    pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});

test('newVerifier is 43 unreserved characters and differs each call', () => {
  const a = newVerifier();
  const b = newVerifier();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test('redirectUri uses localhost and the port', () => {
  assert.equal(redirectUri(8477), 'http://localhost:8477/callback');
});

test('authorizeUrl carries every required parameter', () => {
  const url = new URL(
    authorizeUrl({ clientId: 'cid', redirectUri: 'http://localhost:8477/callback', state: 'st', challenge: 'ch' }),
  );
  assert.equal(url.origin + url.pathname, 'https://cloud.ouraring.com/oauth/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), 'cid');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:8477/callback');
  assert.equal(url.searchParams.get('scope'), SCOPES);
  assert.equal(url.searchParams.get('state'), 'st');
  assert.equal(url.searchParams.get('code_challenge'), 'ch');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('toTokens computes expiresAt and requires a refresh token', () => {
  const fresh = toTokens({ access_token: 'a', token_type: 'bearer', expires_in: 3600, refresh_token: 'r1' }, NOW);
  assert.deepEqual(fresh, { accessToken: 'a', refreshToken: 'r1', expiresAt: NOW + 3_600_000 });
  assert.throws(() => toTokens({ access_token: 'c', token_type: 'bearer', expires_in: 60 }, NOW), AuthRequiredError);
  assert.throws(() => toTokens({ access_token: 'c', token_type: 'bearer', expires_in: 60, refresh_token: '' }, NOW), AuthRequiredError);
});

test('exchangeCode posts a form to the token URL with a timeout and returns tokens', async () => {
  const { fetchFn, calls } = stubFetch(() => ({
    status: 200,
    body: { access_token: 'a', token_type: 'bearer', expires_in: 2592000, refresh_token: 'r' },
  }));
  const tokens = await exchangeCode({ config: { ...CONFIG, redirectPort: 8477 }, code: 'the-code', verifier: 'v', fetchFn, now: NOW });
  assert.deepEqual(tokens, { accessToken: 'a', refreshToken: 'r', expiresAt: NOW + 2_592_000_000 });
  assert.equal(calls[0]!.url, TOKEN_URL);
  assert.equal(calls[0]!.method, 'POST');
  assert.ok(calls[0]!.signal instanceof AbortSignal);
  const form = new URLSearchParams(calls[0]!.body);
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('code'), 'the-code');
  assert.equal(form.get('code_verifier'), 'v');
  assert.equal(form.get('client_id'), 'cid');
  assert.equal(form.get('client_secret'), 'csec');
  assert.equal(form.get('redirect_uri'), 'http://localhost:8477/callback');
});

test('refreshTokens posts grant_type=refresh_token and returns the replacement', async () => {
  const old: Tokens = { accessToken: 'old', refreshToken: 'r-old', expiresAt: 0 };
  const { fetchFn, calls } = stubFetch(() => ({
    status: 200,
    body: { access_token: 'new', token_type: 'bearer', expires_in: 100, refresh_token: 'r-new' },
  }));
  const tokens = await refreshTokens({ config: CONFIG, tokens: old, fetchFn, now: NOW });
  assert.deepEqual(tokens, { accessToken: 'new', refreshToken: 'r-new', expiresAt: NOW + 100_000 });
  const form = new URLSearchParams(calls[0]!.body);
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('refresh_token'), 'r-old');
  assert.equal(form.get('client_id'), 'cid');
  assert.equal(form.get('client_secret'), 'csec');
});

test('refreshTokens fails with AuthRequiredError when Oura rejects the refresh token', async () => {
  const old: Tokens = { accessToken: 'old', refreshToken: 'r-old', expiresAt: 0 };
  const { fetchFn } = stubFetch(() => ({ status: 401, body: { error: 'invalid_grant' } }));
  await assert.rejects(refreshTokens({ config: CONFIG, tokens: old, fetchFn, now: NOW }), AuthRequiredError);
});

test('refreshTokens fails when the response omits the new refresh token', async () => {
  const old: Tokens = { accessToken: 'old', refreshToken: 'r-old', expiresAt: 0 };
  const { fetchFn } = stubFetch(() => ({ status: 200, body: { access_token: 'new', token_type: 'bearer', expires_in: 100 } }));
  await assert.rejects(refreshTokens({ config: CONFIG, tokens: old, fetchFn, now: NOW }), AuthRequiredError);
});

test('waitForCallback resolves with the code when state matches', async () => {
  const code = await waitForCallback({
    port: 0,
    state: 'good',
    timeoutMs: 5000,
    onListening: async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=good`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.match(text, /return to the terminal/i);
      assert.doesNotMatch(text, /logged in/i);
    },
  });
  assert.equal(code, 'abc');
});

test('waitForCallback rejects on state mismatch even when Oura also reports an error', async () => {
  await assert.rejects(
    waitForCallback({
      port: 0,
      state: 'good',
      timeoutMs: 5000,
      onListening: async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/callback?error=access_denied&state=bad`);
        assert.equal(res.status, 400);
      },
    }),
    /state/i,
  );
});

test('waitForCallback rejects when Oura reports an error', async () => {
  await assert.rejects(
    waitForCallback({
      port: 0,
      state: 'good',
      timeoutMs: 5000,
      onListening: async (port) => {
        await fetch(`http://127.0.0.1:${port}/callback?error=access_denied&state=good`);
      },
    }),
    /access_denied/,
  );
});

test('waitForCallback times out', async () => {
  await assert.rejects(
    waitForCallback({ port: 0, state: 's', timeoutMs: 50, onListening: () => {} }),
    /Timed out/,
  );
});

test('login opens the browser to the authorize URL and exchanges the code', async () => {
  const opened: string[] = [];
  const logged: string[] = [];
  const { fetchFn, calls } = stubFetch(() => ({
    status: 200,
    body: { access_token: 'a', token_type: 'bearer', expires_in: 10, refresh_token: 'r' },
  }));
  const tokens = await login({
    config: CONFIG, // redirectPort 0 => ephemeral port
    fetchFn,
    log: (m) => logged.push(m),
    timeoutMs: 5000,
    openBrowser: async (url) => {
      opened.push(url);
      const u = new URL(url);
      const redirect = new URL(u.searchParams.get('redirect_uri')!);
      await fetch(`${redirect.origin}/callback?code=xyz&state=${u.searchParams.get('state')}`);
    },
  });
  assert.equal(tokens.accessToken, 'a');
  assert.equal(opened.length, 1);
  assert.ok(logged.some((m) => m.includes(opened[0]!)), 'login prints the URL for manual use');
  const form = new URLSearchParams(calls[0]!.body);
  assert.equal(form.get('code'), 'xyz');
  const challenge = new URL(opened[0]!).searchParams.get('code_challenge');
  assert.equal(challenge, pkceChallenge(form.get('code_verifier')!));
});
