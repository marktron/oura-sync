import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { REQUEST_TIMEOUT_MS } from './api.ts';
import type { Config, Tokens } from './config.ts';
import { AuthRequiredError } from './errors.ts';

export const AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
export const TOKEN_URL = 'https://api.ouraring.com/oauth/token';
export const SCOPES = 'daily heartrate';
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function newVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function redirectUri(port: number): string {
  return `http://localhost:${port}/callback`;
}

export function authorizeUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', p.clientId);
  url.searchParams.set('redirect_uri', p.redirectUri);
  url.searchParams.set('scope', p.scope ?? SCOPES);
  url.searchParams.set('state', p.state);
  url.searchParams.set('code_challenge', p.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Oura refresh tokens are single-use: the one we just sent is now invalid,
 * so a response without a replacement leaves us unable to refresh again.
 */
export function toTokens(r: TokenResponse, now: number): Tokens {
  if (!r.refresh_token) {
    throw new AuthRequiredError('Oura returned no refresh token. Run `oura-sync login`.');
  }
  return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: now + r.expires_in * 1000 };
}

interface TokenRequestOptions {
  fetchFn?: typeof fetch;
  now?: number;
  tokenUrl?: string;
}

async function postToken(params: Record<string, string>, opts: TokenRequestOptions): Promise<TokenResponse> {
  const fetchFn = opts.fetchFn ?? fetch;
  const res = await fetchFn(opts.tokenUrl ?? TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new AuthRequiredError(`Oura token request failed (${res.status}): ${await res.text()}. Run \`oura-sync login\`.`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(
  opts: { config: Config; code: string; verifier: string } & TokenRequestOptions,
): Promise<Tokens> {
  const r = await postToken(
    {
      grant_type: 'authorization_code',
      code: opts.code,
      code_verifier: opts.verifier,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
      redirect_uri: redirectUri(opts.config.redirectPort),
    },
    opts,
  );
  return toTokens(r, opts.now ?? Date.now());
}

export async function refreshTokens(opts: { config: Config; tokens: Tokens } & TokenRequestOptions): Promise<Tokens> {
  const r = await postToken(
    {
      grant_type: 'refresh_token',
      refresh_token: opts.tokens.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
    },
    opts,
  );
  return toTokens(r, opts.now ?? Date.now());
}

export interface CallbackOptions {
  port: number;
  state: string;
  timeoutMs: number;
  /** Called once the server is listening, with the actual port (useful when port is 0). */
  onListening: (port: number) => void | Promise<void>;
}

/** Run a one-shot HTTP server that waits for Oura's redirect and resolves with the authorization code. */
export function waitForCallback(opts: CallbackOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const finish = (status: number, text: string, outcome: () => void) => {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
        clearTimeout(timer);
        server.close();
        outcome();
      };
      // State first: nothing else in the redirect is trusted until it matches.
      if (url.searchParams.get('state') !== opts.state) {
        return finish(400, 'State mismatch. Try logging in again.', () => reject(new Error('OAuth state mismatch')));
      }
      const error = url.searchParams.get('error');
      if (error) {
        return finish(400, `Oura returned an error: ${error}`, () => reject(new Error(`Authorization failed: ${error}`)));
      }
      const code = url.searchParams.get('code');
      if (!code) return finish(400, 'Missing code.', () => reject(new Error('Callback had no code')));
      finish(200, 'Authorization received. Return to the terminal.', () => resolve(code));
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for the browser callback'));
    }, opts.timeoutMs);
    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    server.listen(opts.port, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      Promise.resolve(opts.onListening(port)).catch((err) => {
        clearTimeout(timer);
        server.close();
        reject(err);
      });
    });
  });
}

export interface LoginOptions {
  config: Config;
  fetchFn?: typeof fetch;
  openBrowser?: (url: string) => Promise<void>;
  log?: (message: string) => void;
  timeoutMs?: number;
}

/** Full authorization-code + PKCE flow. Resolves with fresh tokens; the caller stores them. */
export async function login(opts: LoginOptions): Promise<Tokens> {
  const log = opts.log ?? (() => {});
  const verifier = newVerifier();
  const state = randomBytes(16).toString('base64url');
  const code = await waitForCallback({
    port: opts.config.redirectPort,
    state,
    timeoutMs: opts.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS,
    onListening: async (port) => {
      const url = authorizeUrl({
        clientId: opts.config.clientId,
        redirectUri: redirectUri(port),
        state,
        challenge: pkceChallenge(verifier),
      });
      log(`Opening your browser to authorize oura-sync. If it does not open, visit:\n${url}`);
      if (opts.openBrowser) {
        try {
          await opts.openBrowser(url);
        } catch {
          // The URL was printed; the user can open it by hand.
        }
      }
    },
  });
  return exchangeCode({ config: opts.config, code, verifier, fetchFn: opts.fetchFn });
}
