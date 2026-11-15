// The HTTP face of the service, written against the standard Request and Response objects.
// That means it runs unchanged in Node, in Vite's dev server, in a Worker, or in a test.
//
//   GET    /api/health
//   GET    /api/projects                                       -> { projects }
//   POST   /api/games              { seed?, project?, owner?, director? }  -> 201 GameView
//   GET    /api/games/:id                                      -> GameView
//   POST   /api/games/:id/choices  { choice, eventId? }       -> GameView
//   POST   /api/games/:id/quote                                -> GameView (contractor re-quotes)
//   POST   /api/games/:id/payments { chargeId, confirm }      -> GameView (answer the bank)
//   POST   /api/games/:id/phone    { with, kind, thread? }     -> PhoneView (a text and reply buttons, from the local model)
//   DELETE /api/games/:id                                      -> 204
//
// Add ?debug=1 to any game request to include the `debug` payload. See API.md.

import { ServiceError } from '../service/errors';
import type { GameService } from '../service/GameService';
import type { ApiErrorBody, ChooseRequest, CreateGameRequest, PaymentRequest, PhoneRequest } from '../service/types';

export interface HttpOptions {
  /** Value for Access-Control-Allow-Origin. Use "*" for any site, or one origin. Omit to disable CORS. */
  corsOrigin?: string;
  maxBodyBytes?: number; // default 4096
}

export type Handler = (req: Request) => Promise<Response>;

const STATUS = { bad_request: 400, not_found: 404, conflict: 409 } as const;

export function createHttpHandler(service: GameService, opts: HttpOptions = {}): Handler {
  const maxBody = opts.maxBodyBytes ?? 4096;

  const headers = (extra: Record<string, string> = {}): Headers => {
    const h = new Headers({ 'Cache-Control': 'no-store', ...extra });
    if (opts.corsOrigin) {
      h.set('Access-Control-Allow-Origin', opts.corsOrigin);
      h.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      h.set('Access-Control-Allow-Headers', 'Content-Type');
      h.set('Access-Control-Max-Age', '600');
      if (opts.corsOrigin !== '*') h.set('Vary', 'Origin');
    }
    return h;
  };

  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: headers({ 'Content-Type': 'application/json', ...extra }) });

  const error = (status: number, code: string, message: string, extra: Record<string, string> = {}) =>
    json({ error: { code, message } } satisfies ApiErrorBody, status, extra);

  /** Read a JSON object body. An empty body means {}. */
  async function readBody(req: Request): Promise<Record<string, unknown>> {
    const text = await req.text();
    if (text.length > maxBody) throw new ServiceError('bad_request', 'body_too_large', `body must be under ${maxBody} bytes`);
    if (text.trim() === '') return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ServiceError('bad_request', 'invalid_json', 'request body is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ServiceError('bad_request', 'invalid_json', 'request body must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  }

  return async (req) => {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const debug = url.searchParams.get('debug') === '1';

    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() });

      if (path === '/api/health') {
        if (method !== 'GET') return error(405, 'method_not_allowed', 'use GET', { Allow: 'GET, OPTIONS' });
        return json(service.health());
      }

      if (path === '/api/projects') {
        if (method !== 'GET') return error(405, 'method_not_allowed', 'use GET', { Allow: 'GET, OPTIONS' });
        return json({ projects: service.listProjects() });
      }

      if (path === '/api/games') {
        if (method !== 'POST') return error(405, 'method_not_allowed', 'use POST', { Allow: 'POST, OPTIONS' });
        const view = await service.createGame((await readBody(req)) as CreateGameRequest, { debug });
        return json(view, 201, { Location: `/api/games/${view.id}` });
      }

      const game = path.match(/^\/api\/games\/([^/]+)$/);
      if (game) {
        const id = decodeURIComponent(game[1]);
        if (method === 'GET') return json(await service.getGame(id, { debug }));
        if (method === 'DELETE') {
          await service.deleteGame(id);
          return new Response(null, { status: 204, headers: headers() });
        }
        return error(405, 'method_not_allowed', 'use GET or DELETE', { Allow: 'GET, DELETE, OPTIONS' });
      }

      const action = path.match(/^\/api\/games\/([^/]+)\/(choices|quote|payments|phone|giveup)$/);
      if (action) {
        if (method !== 'POST') return error(405, 'method_not_allowed', 'use POST', { Allow: 'POST, OPTIONS' });
        const id = decodeURIComponent(action[1]);
        const body = await readBody(req);
        if (action[2] === 'choices') return json(await service.choose(id, body as unknown as ChooseRequest, { debug }));
        if (action[2] === 'phone') return json(await service.phone(id, body as unknown as PhoneRequest));
        if (action[2] === 'giveup') return json(await service.giveUp(id, { debug }));
        if (action[2] === 'quote') return json(await service.requestQuote(id, { debug }));
        return json(await service.payment(id, body as unknown as PaymentRequest, { debug }));
      }

      return error(404, 'not_found', `no route for ${method} ${path}`);
    } catch (err) {
      if (err instanceof ServiceError) return error(STATUS[err.kind], err.code, err.message);
      console.error('DIWhy API: unexpected error', err); // details stay in the server log
      return error(500, 'internal_error', 'something went wrong on the server');
    }
  };
}
