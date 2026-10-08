export interface StubResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FetchCall {
  url: string;
  method: string;
  auth: string | undefined;
  body: string | undefined;
  signal: AbortSignal | null | undefined;
}

/**
 * A fetch stub driven by a route function. The route sees each call in order
 * and returns the response to send, or undefined to fail the call.
 */
export function stubFetch(route: (call: FetchCall, index: number) => StubResponse | undefined) {
  const calls: FetchCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      auth: headers.Authorization,
      body: typeof init?.body === 'string' ? init.body : undefined,
      signal: init?.signal,
    };
    const res = route(call, calls.length);
    calls.push(call);
    if (!res) throw new Error(`Unexpected fetch: ${call.method} ${call.url}`);
    const text = res.body === undefined ? '' : typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    return new Response(text, { status: res.status, headers: res.headers });
  }) as typeof fetch;
  return { fetchFn, calls };
}

/** Returns responses in sequence, regardless of URL. */
export function sequence(responses: StubResponse[]) {
  return stubFetch((_call, i) => responses[i]);
}
