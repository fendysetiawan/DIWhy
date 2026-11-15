// Every GameClient method, through the real backend in-process.

import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { bridgeFetch, realProjects } from '../testing';
import { ApiError, createHttpClient } from './GameClient';

function setup() {
  const app = createApp({ projects: realProjects() });
  const bridge = bridgeFetch(app.handler);
  return { client: createHttpClient({ fetch: bridge }), bridge };
}

describe('GameClient', () => {
  it('health and listProjects', async () => {
    const { client } = setup();
    expect(await client.health()).toMatchObject({ status: 'ok', phone: false });
    const projects = await client.listProjects();
    expect(projects[0]).toMatchObject({ id: 'wall-removal', quote: { budget: 10000 } });
  });

  it('createGame, getGame, choose, requestQuote, payment, giveUp and deleteGame', async () => {
    const { client } = setup();
    const g = await client.createGame({ seed: 12, project: 'wall-removal' });
    expect((await client.getGame(g.id)).id).toBe(g.id);

    const quoted = await client.requestQuote(g.id);
    expect(quoted.quote.current.budget).toBeGreaterThanOrEqual(quoted.quote.original.budget);

    let v = await client.choose(g.id, { choice: 1, eventId: g.event!.id });
    for (let i = 0; i < 12 && !v.charge; i++) v = await client.choose(g.id, { choice: 1, eventId: v.event!.id });
    expect(v.charge?.status).toBe('pending');
    const paid = await client.payment(g.id, { chargeId: v.charge!.id, confirm: true });
    expect(paid.charge?.status).toBe('confirmed');

    const ended = await client.giveUp(g.id);
    expect(ended.failure).toBe('giveup');
    await client.deleteGame(g.id);
    await expect(client.getGame(g.id)).rejects.toMatchObject({ status: 404, code: 'game_not_found' });
  });

  it('phone asks the backend for a text (and says so when no model is configured)', async () => {
    const { client } = setup();
    const g = await client.createGame({ seed: 12, project: 'wall-removal' });
    const text = await client.phone(g.id, { with: 'partner', kind: 'reaction' });
    expect(text).toHaveProperty('replies');
  });

  it('turns an error into an ApiError with the stable code', async () => {
    const { client } = setup();
    const g = await client.createGame({ seed: 12 });
    await expect(client.choose(g.id, { choice: 0, eventId: 'nope' })).rejects.toBeInstanceOf(ApiError);
    await expect(client.choose(g.id, { choice: 0, eventId: 'nope' })).rejects.toMatchObject({ status: 409, code: 'stale_event' });
  });

  it('sends no body for a quote or a give-up', async () => {
    const bodies: Array<string | undefined> = [];
    const { bridge } = setup();
    const client = createHttpClient({
      fetch: ((url: string, init?: RequestInit) => {
        if (/quote|giveup/.test(url)) bodies.push(init?.body as string | undefined);
        return bridge(url, init);
      }) as typeof fetch,
    });
    const g = await client.createGame({ seed: 1 });
    await client.requestQuote(g.id);
    await client.giveUp(g.id);
    expect(bodies).toEqual([undefined, undefined]);
  });
});
