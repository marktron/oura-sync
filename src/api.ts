import { ApiError, AuthRequiredError } from './errors.ts';
import type { MultiDocumentResponse } from './oura-types.ts';

export const API_BASE = 'https://api.ouraring.com';
export const MAX_RATE_LIMIT_RETRIES = 3;
export const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_AFTER_SECONDS = 5;

export interface ApiClientOptions {
  getAccessToken: () => Promise<string>;
  /** Refresh and return the new access token. Throw AuthRequiredError if that is impossible. */
  refreshAccessToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  /** Progress messages, such as rate-limit waits. Defaults to silent. */
  log?: (message: string) => void;
}

export class OuraApi {
  readonly #getAccessToken: () => Promise<string>;
  readonly #refreshAccessToken: () => Promise<string>;
  readonly #fetchFn: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #baseUrl: string;
  readonly #log: (message: string) => void;

  constructor(opts: ApiClientOptions) {
    this.#getAccessToken = opts.getAccessToken;
    this.#refreshAccessToken = opts.refreshAccessToken;
    this.#fetchFn = opts.fetchFn ?? fetch;
    this.#sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.#baseUrl = opts.baseUrl ?? API_BASE;
    this.#log = opts.log ?? (() => {});
  }

  /** Fetch every document in a usercollection for [start, end], following pagination. */
  async fetchCollection<T>(collection: string, start: string, end: string): Promise<T[]> {
    const items: T[] = [];
    let nextToken: string | null = null;
    do {
      const url = new URL(`/v2/usercollection/${collection}`, this.#baseUrl);
      url.searchParams.set('start_date', start);
      url.searchParams.set('end_date', end);
      if (nextToken) url.searchParams.set('next_token', nextToken);
      const page: MultiDocumentResponse<T> = await this.#getJson(url);
      items.push(...page.data);
      nextToken = page.next_token;
    } while (nextToken);
    return items;
  }

  async #getJson<T>(url: URL): Promise<T> {
    let token = await this.#getAccessToken();
    let refreshed = false;
    let rateLimitRetries = 0;
    for (;;) {
      const res = await this.#fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;

      if (res.status === 401) {
        if (refreshed) throw new AuthRequiredError();
        refreshed = true;
        token = await this.#refreshAccessToken();
        continue;
      }

      if (res.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        rateLimitRetries++;
        const header = Number(res.headers.get('retry-after'));
        const seconds = Number.isFinite(header) && header > 0 ? header : DEFAULT_RETRY_AFTER_SECONDS;
        this.#log(`Rate limited by Oura; waiting ${seconds} s (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})`);
        await this.#sleep(seconds * 1000);
        continue;
      }

      throw new ApiError(res.status, await res.text());
    }
  }
}
