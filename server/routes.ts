// The routes: three of them. Every answer is the whole game as it is now, and what just happened.
// Games live in memory: a restart forgets them.

import { Hono } from 'hono';
import { type Action, CHARACTERS, type CharacterId, type Happening, type Update } from '../shared/game';
import { GameMode } from './GameMode';

const games = new Map<string, GameMode>();

export const api = new Hono();

/** A new game: { player } */
api.post('/games', async (c) => {
  const { player } = await c.req.json<{ player?: string }>();
  if (!CHARACTERS.some((ch) => ch.id === player)) return c.json({ error: 'unknown player' }, 400);
  const game = new GameMode(crypto.randomUUID(), player as CharacterId);
  games.set(game.id, game);
  return c.json(update(game), 201);
});

/** The game now (the app asks every few seconds). */
api.get('/games/:id', (c) => {
  const game = games.get(c.req.param('id'));
  if (!game) return c.json({ error: 'no such game' }, 404);
  return c.json(update(game));
});

/** Do something: { action } (play, sign, reply, read). */
api.post('/games/:id/actions', async (c) => {
  const game = games.get(c.req.param('id'));
  if (!game) return c.json({ error: 'no such game' }, 404);
  const { action } = await c.req.json<{ action?: Action }>();
  if (!action?.type) return c.json({ error: 'no action' }, 400);
  const happened = game.handleAction(action, Date.now());
  return c.json(update(game, happened));
});

/** Catch the game up, then send its copy (with what the action just caused, if any). */
function update(game: GameMode, caused: Happening[] = []): Update {
  const now = Date.now();
  const happened = [...caused, ...game.catchUp(now)];
  return { game: game.replicate(now), happened };
}
