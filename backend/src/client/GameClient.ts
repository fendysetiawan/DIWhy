// A typed client for the DIWhy backend. Any front end can use it, or copy it as an example.
// It imports only the contract's types, so it pulls no game code into a front end's bundle.

import type {
  ApiErrorBody,
  ChooseRequest,
  CreateGameRequest,
  GameView,
  HealthView,
  PaymentRequest,
  PhoneRequest,
  PhoneView,
  ProjectView,
  RequestOptions,
} from '../service/types';

export interface GameClient {
  health(): Promise<HealthView>;
  listProjects(): Promise<ProjectView[]>;
  createGame(req?: CreateGameRequest, opts?: RequestOptions): Promise<GameView>;
  getGame(id: string, opts?: RequestOptions): Promise<GameView>;
  choose(id: string, req: ChooseRequest, opts?: RequestOptions): Promise<GameView>;
  requestQuote(id: string, opts?: RequestOptions): Promise<GameView>;
  payment(id: string, req: PaymentRequest, opts?: RequestOptions): Promise<GameView>;
  phone(id: string, req: PhoneRequest): Promise<PhoneView>;
  giveUp(id: string, opts?: RequestOptions): Promise<GameView>;
  deleteGame(id: string): Promise<void>;
}

/** Thrown for any failed call. `status` is 0 when the server could not be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string, // e.g. "game_over", "stale_event", "network"
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpClientOptions {
  /** Where the backend lives, e.g. "http://localhost:3001". Empty means the same origin. */
  baseUrl?: string;
  fetch?: typeof fetch; // inject for tests
}

export function createHttpClient(opts: HttpClientOptions = {}): GameClient {
  const base = (opts.baseUrl ?? '').replace(/\/+$/, '');
  // Look up fetch at call time so a later stub or polyfill is honored.
  const doFetch: typeof fetch = (input, init) => (opts.fetch ?? fetch)(input, init);

  async function call<T>(method: string, path: string, body?: unknown, ro?: RequestOptions): Promise<T> {
    const url = `${base}/api${path}${ro?.debug ? '?debug=1' : ''}`;
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new ApiError(0, 'network', err instanceof Error ? err.message : 'could not reach the server');
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => undefined);
    if (!res.ok) {
      const e = (data as ApiErrorBody | undefined)?.error;
      throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `request failed (${res.status})`);
    }
    return data as T;
  }

  return {
    health: () => call('GET', '/health'),
    listProjects: async () => (await call<{ projects: ProjectView[] }>('GET', '/projects')).projects,
    createGame: (req = {}, ro) => call('POST', '/games', req, ro),
    getGame: (id, ro) => call('GET', `/games/${encodeURIComponent(id)}`, undefined, ro),
    choose: (id, req, ro) => call('POST', `/games/${encodeURIComponent(id)}/choices`, req, ro),
    requestQuote: (id, ro) => call('POST', `/games/${encodeURIComponent(id)}/quote`, undefined, ro),
    payment: (id, req, ro) => call('POST', `/games/${encodeURIComponent(id)}/payments`, req, ro),
    phone: (id, req) => call('POST', `/games/${encodeURIComponent(id)}/phone`, req),
    giveUp: (id, ro) => call('POST', `/games/${encodeURIComponent(id)}/giveup`, undefined, ro),
    deleteGame: (id) => call('DELETE', `/games/${encodeURIComponent(id)}`),
  };
}
