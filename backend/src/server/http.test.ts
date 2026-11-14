import { describe, expect, it, vi } from 'vitest';
import type { ApiErrorBody, GameView } from '../service/types';
import { GameService } from '../service/GameService';
import { appWithFakeModel } from '../testing';
import { realProjects } from '../testing';
import { createApp } from './app';
import { createHttpHandler, type Handler } from './http';

const call = (h: Handler, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  h(
    new Request(`http://api.test${path}`, {
      method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
const view = async (r: Response) => (await r.json()) as GameView;
const err = async (r: Response) => ((await r.json()) as ApiErrorBody).error;

describe('routes', () => {
  it('GET /api/health says which directors exist', async () => {
    const r = await call(createApp().handler, 'GET', '/api/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok', directors: { random: true, jev: false } });
    expect(await (await call(appWithFakeModel().handler, 'GET', '/api/health')).json()).toMatchObject({
      directors: { jev: true },
    });
  });

  it('POST /api/games creates a game: 201, Location, JSON view', async () => {
    const r = await call(createApp().handler, 'POST', '/api/games', { seed: 42 });
    expect(r.status).toBe(201);
    const v = await view(r);
    expect(r.headers.get('Location')).toBe(`/api/games/${v.id}`);
    expect(r.headers.get('Content-Type')).toContain('application/json');
    expect(v).toMatchObject({ seed: 42, status: 'playing', event: { id: 'valve-stuck' } });
  });

  it('accepts an empty body when creating a game', async () => {
    const r = await call(createApp().handler, 'POST', '/api/games');
    expect(r.status).toBe(201);
  });

  it('plays a whole game over HTTP', async () => {
    const { handler } = createApp();
    let v = await view(await call(handler, 'POST', '/api/games', { seed: 8 }));
    for (let i = 0; i < 30 && v.status === 'playing'; i++) {
      const r = await call(handler, 'POST', `/api/games/${v.id}/choices`, { choice: 0, eventId: v.event!.id });
      expect(r.status).toBe(200);
      v = await view(r);
    }
    expect(v.report).not.toBeNull();
    const again = await call(handler, 'POST', `/api/games/${v.id}/choices`, { choice: 0 });
    expect(again.status).toBe(409);
    expect((await err(again)).code).toBe('game_over');
    expect((await view(await call(handler, 'GET', `/api/games/${v.id}`))).status).toBe(v.status);
  });

  it('DELETE removes a game: 204, then 404', async () => {
    const { handler } = createApp();
    const v = await view(await call(handler, 'POST', '/api/games', {}));
    expect((await call(handler, 'DELETE', `/api/games/${v.id}`)).status).toBe(204);
    expect((await call(handler, 'GET', `/api/games/${v.id}`)).status).toBe(404);
  });

  it('?debug=1 adds the debug payload, and nothing else does', async () => {
    const { handler } = createApp();
    const plain = await view(await call(handler, 'POST', '/api/games', { seed: 1 }));
    expect(plain.debug).toBeUndefined();
    const dbg = await view(await call(handler, 'GET', `/api/games/${plain.id}?debug=1`));
    expect(dbg.debug?.state).toBeDefined();
  });

  it('tolerates a trailing slash', async () => {
    expect((await call(createApp().handler, 'GET', '/api/health/')).status).toBe(200);
  });
});

describe('projects, quote and payments', () => {
  const real = () => createApp({ projects: realProjects() }).handler;

  it('GET /api/projects lists the jobs with their contractor quotes', async () => {
    const r = await call(real(), 'GET', '/api/projects');
    expect(r.status).toBe(200);
    const { projects } = (await r.json()) as { projects: Array<{ id: string; quote: { budget: number } }> };
    expect(projects).toHaveLength(12);
    expect(projects[0]).toMatchObject({ id: 'wall-removal', quote: { budget: 10000 } });
  });

  it('POST /api/games takes a project and an owner and returns the cast', async () => {
    const r = await call(real(), 'POST', '/api/games', { seed: 3, project: 'dryer-replacement', owner: 'gigi-singh' });
    expect(r.status).toBe(201);
    const v = await view(r);
    expect(v.project.id).toBe('dryer-replacement');
    expect(v.cast.owner).toBe('gigi-singh');
    expect(Object.keys(v.cast.roles).sort()).toEqual(['clerk', 'contractor', 'friend', 'neighbor', 'parent', 'partner']);
  });

  it('POST /quote and POST /payments work, and bad input gets stable errors', async () => {
    const handler = real();
    let v = await view(await call(handler, 'POST', '/api/games', { seed: 12, project: 'wall-removal' }));
    for (let i = 0; i < 12 && !v.charge; i++) {
      v = await view(await call(handler, 'POST', `/api/games/${v.id}/choices`, { choice: 1, eventId: v.event!.id }));
    }
    const quote = await call(handler, 'POST', `/api/games/${v.id}/quote`);
    expect(quote.status).toBe(200);
    expect((await view(quote)).quote.original).toEqual({ budget: 10000, days: 14 });

    const paid = await call(handler, 'POST', `/api/games/${v.id}/payments`, { chargeId: v.charge!.id, confirm: true });
    expect((await view(paid)).charge!.status).toBe('confirmed');

    const stale = await call(handler, 'POST', `/api/games/${v.id}/payments`, { chargeId: 999, confirm: true });
    expect(stale.status).toBe(409);
    expect((await err(stale)).code).toBe('stale_charge');
    const bad = await call(handler, 'POST', `/api/games/${v.id}/payments`, { chargeId: v.charge!.id, confirm: 'maybe' });
    expect(bad.status).toBe(400);
    expect((await err(bad)).code).toBe('invalid_payment');

    for (const [path, method] of [['/api/projects', 'POST'], [`/api/games/${v.id}/quote`, 'GET'], [`/api/games/${v.id}/payments`, 'GET']]) {
      expect((await call(handler, method, path)).status, `${method} ${path}`).toBe(405);
    }
    expect((await err(await call(handler, 'POST', '/api/games', { project: 'nope' }))).code).toBe('invalid_project');
    expect((await err(await call(handler, 'POST', '/api/games', { owner: 'nobody' }))).code).toBe('invalid_owner');
  });
});

describe('errors', () => {
  const { handler } = createApp();

  it.each([
    ['POST', '/api/games', '{not json', 400, 'invalid_json'],
    ['POST', '/api/games', '[1,2]', 400, 'invalid_json'],
    ['POST', '/api/games', { seed: -3 }, 400, 'invalid_seed'],
    ['POST', '/api/games', { director: 'jev' }, 400, 'director_unavailable'],
    ['GET', '/api/games/nope', undefined, 404, 'game_not_found'],
    ['POST', '/api/games/nope/choices', { choice: 0 }, 404, 'game_not_found'],
    ['GET', '/api/nothing-here', undefined, 404, 'not_found'],
  ])('%s %s -> %i %s', async (method, path, body, status, code) => {
    const r = await call(handler, method, path, body);
    expect(r.status).toBe(status);
    expect(await err(r)).toEqual({ code, message: expect.any(String) });
  });

  it('answers 405 with an Allow header for the wrong method', async () => {
    for (const [method, path, allow] of [
      ['GET', '/api/games', 'POST, OPTIONS'],
      ['POST', '/api/health', 'GET, OPTIONS'],
      ['PUT', '/api/games/abc', 'GET, DELETE, OPTIONS'],
      ['GET', '/api/games/abc/choices', 'POST, OPTIONS'],
    ]) {
      const r = await call(handler, method, path);
      expect(r.status, `${method} ${path}`).toBe(405);
      expect(r.headers.get('Allow')).toBe(allow);
    }
  });

  it('rejects oversized bodies', async () => {
    const r = await call(handler, 'POST', '/api/games', JSON.stringify({ seed: 1, pad: 'x'.repeat(5000) }));
    expect(r.status).toBe(400);
    expect((await err(r)).code).toBe('body_too_large');
  });

  it('turns a bug into a plain 500 and keeps the details in the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = new GameService({
      store: {
        get: async () => {
          throw new Error('internal detail that must stay in the log');
        },
        set: async () => undefined,
        delete: async () => false,
      },
    });
    const r = await call(createHttpHandler(broken), 'GET', '/api/games/x');
    expect(r.status).toBe(500);
    expect(await err(r)).toEqual({ code: 'internal_error', message: expect.not.stringContaining('internal detail') });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('CORS and caching', () => {
  it('sends no CORS headers unless an origin is configured', async () => {
    const r = await call(createApp().handler, 'GET', '/api/health');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers preflight and tags responses when an origin is configured', async () => {
    const { handler } = createApp({ http: { corsOrigin: 'http://localhost:3000' } });
    const pre = await call(handler, 'OPTIONS', '/api/games/abc/choices');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(pre.headers.get('Vary')).toBe('Origin');

    const res = await call(handler, 'GET', '/api/health');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    const bad = await call(handler, 'GET', '/api/games/nope'); // errors carry CORS headers too
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('supports "*"', async () => {
    const { handler } = createApp({ http: { corsOrigin: '*' } });
    const r = await call(handler, 'GET', '/api/health');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Vary')).toBeNull();
  });
});
