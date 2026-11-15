import { describe, expect, it } from 'vitest';
import { fakeModel } from '../testing';
import { ServiceError, type ServiceErrorKind } from './errors';
import { GameService } from './GameService';
import { MemoryGameStore, type GameRecord, type GameStore } from './store';
import type { GameView } from './types';

let counter = 0;
const svc = (opts: ConstructorParameters<typeof GameService>[0] = {}) =>
  new GameService({ newId: () => `game-${++counter}`, ...opts });

async function expectError(p: Promise<unknown>, kind: ServiceErrorKind, code: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).kind).toBe(kind);
    expect((e as ServiceError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${kind}/${code} but nothing was thrown`);
}

/** Play a game to the end, always taking the choice `pick` returns. */
async function playOut(s: GameService, id: string, pick: (n: number) => number = () => 0): Promise<GameView> {
  let v = await s.getGame(id);
  for (let i = 0; i < 30 && v.status === 'playing'; i++) {
    v = await s.choose(id, { choice: pick(v.event!.choices.length), eventId: v.event!.id });
  }
  return v;
}

describe('createGame', () => {
  it('starts a playing game on the opening event', async () => {
    const v = await svc().createGame({ seed: 42 });
    expect(v.status).toBe('playing');
    expect(v.seed).toBe(42);
    expect(v.director).toBe('random');
    expect(v.event?.id).toBe('valve-stuck');
    // The bathroom project's contractor quote is $3,500 and 10 days. The game ends at 2.5 times the
    // money and 3 times the days.
    expect(v.quote).toEqual({ original: { budget: 3500, days: 10 }, current: { budget: 3500, days: 10 } });
    expect(v.stats).toMatchObject({ spent: 0, daysElapsed: 0, stress: 0, riskDebt: 0, budget: 8750, maxDays: 30 });
    expect(v.report).toBeNull();
    expect(v.failure).toBeNull();
  });

  it('makes up a seed when none is given', async () => {
    const v = await svc().createGame();
    expect(Number.isInteger(v.seed)).toBe(true);
  });

  it.each([[-1], [1.5], [4294967296], [Number.NaN]])('rejects seed %s', async (seed) => {
    await expectError(svc().createGame({ seed }), 'bad_request', 'invalid_seed');
  });

  it('rejects an unknown director, and jev when no model is configured', async () => {
    await expectError(svc().createGame({ director: 'bogus' as never }), 'bad_request', 'invalid_director');
    await expectError(svc().createGame({ director: 'jev' }), 'bad_request', 'director_unavailable');
  });
});

describe('what a front end is allowed to see', () => {
  it('shows choices as a label only: nobody quotes a DIY fix, so prices and days are hidden', async () => {
    const v = await svc().createGame({ seed: 1 });
    for (const c of v.event!.choices) expect(Object.keys(c).sort()).toEqual(['cost', 'days', 'index', 'label']);
    expect(v.event!.choices[1]).toEqual({ index: 1, label: 'Replace the valve', cost: null, days: null });
  });

  it('never leaks hidden consequences or internals unless debug is asked for', async () => {
    const s = svc();
    const v = await playOut(s, (await s.createGame({ seed: 7 })).id);
    const text = JSON.stringify(v);
    for (const hidden of ['"effects"', '"gamble"', '"weight"', '"flags"', '"waterDamage"', '"probabilities"', '"debug"', 'rngState']) {
      expect(text, `exposed ${hidden}`).not.toContain(hidden);
    }
  });

  it('adds the debug payload on request', async () => {
    const s = svc();
    const created = await s.createGame({ seed: 7 });
    const v = await s.getGame(created.id, { debug: true });
    expect(v.debug?.state.eventHistory).toEqual([]);
    expect(v.debug?.maxEvents).toBe(8);
    expect(v.debug?.last.pool.map((p) => p.id)).toEqual(['valve-stuck']);
  });
});

describe('choose', () => {
  it('advances the game and records the cost', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 42 });
    const v = await s.choose(g.id, { choice: 1, eventId: 'valve-stuck' }); // replace the valve: $180
    expect(v.stats.spent).toBe(180);
    expect(v.ledger).toEqual([{ label: 'The shutoff valve won\'t close: Replace the valve', cost: 180 }]);
    expect(v.event?.id).not.toBe('valve-stuck');
    expect(v.log.length).toBeGreaterThan(0);
  });

  it('plays to an ending with a report, then refuses more choices', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 3 });
    const end = await playOut(s, g.id);
    expect(['complete', 'failed']).toContain(end.status);
    expect(end.event).toBeNull();
    expect(end.report?.whyLine).toMatch(/^Why did you do it yourself\?/);
    await expectError(s.choose(g.id, { choice: 0 }), 'conflict', 'game_over');
  });

  it('rejects bad choices, stale screens and unknown games', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 42 });
    await expectError(s.choose(g.id, { choice: 9 }), 'bad_request', 'invalid_choice');
    await expectError(s.choose(g.id, { choice: -1 }), 'bad_request', 'invalid_choice');
    await expectError(s.choose(g.id, { choice: 1.5 }), 'bad_request', 'invalid_choice');
    await expectError(s.choose(g.id, { choice: 0, eventId: 'some-other-event' }), 'conflict', 'stale_event');
    await expectError(s.choose('nope', { choice: 0 }), 'not_found', 'game_not_found');
    expect((await s.getGame(g.id)).stats.spent).toBe(0); // none of that changed the game
  });

  it('lets only one of two simultaneous clicks through', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 42 });
    const results = await Promise.allSettled([
      s.choose(g.id, { choice: 1, eventId: 'valve-stuck' }),
      s.choose(g.id, { choice: 1, eventId: 'valve-stuck' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((failed.reason as ServiceError).code).toBe('stale_event');
    expect((await s.getGame(g.id)).stats.spent).toBe(180); // applied once, not twice
  });
});

describe('reproducibility and storage', () => {
  it('same seed and same choices give the same game; a different seed gives a different one', async () => {
    const a = svc();
    const norm = (v: GameView) => ({ ...v, id: '' });
    const one = await playOut(a, (await a.createGame({ seed: 11 })).id, (n) => n - 1);
    const two = await playOut(a, (await a.createGame({ seed: 11 })).id, (n) => n - 1);
    expect(norm(one)).toEqual(norm(two));

    const stories = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const v = await playOut(a, (await a.createGame({ seed })).id, (n) => n - 1);
      stories.add(JSON.stringify(v.ledger));
    }
    expect(stories.size).toBeGreaterThan(4);
  });

  it('works on a store that only keeps JSON text (a database), with identical results', async () => {
    class JsonStore implements GameStore {
      private rows = new Map<string, string>();
      async get(id: string) {
        const row = this.rows.get(id);
        return row ? (JSON.parse(row) as GameRecord) : undefined;
      }
      async set(r: GameRecord) {
        this.rows.set(r.id, JSON.stringify(r));
      }
      async delete(id: string) {
        return this.rows.delete(id);
      }
    }
    const norm = (v: GameView) => ({ ...v, id: '' });
    const memory = svc();
    const json = svc({ store: new JsonStore() });
    for (const seed of [5, 21, 99]) {
      const m = await playOut(memory, (await memory.createGame({ seed })).id, (n) => n - 1);
      const j = await playOut(json, (await json.createGame({ seed })).id, (n) => n - 1);
      expect(norm(j)).toEqual(norm(m)); // the saved RNG position resumes the exact same dice
    }
  });

  it('deletes games', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 1 });
    await s.deleteGame(g.id);
    await expectError(s.getGame(g.id), 'not_found', 'game_not_found');
    await expectError(s.deleteGame(g.id), 'not_found', 'game_not_found');
  });
});

describe('MemoryGameStore', () => {
  const record = (id: string, updatedAt: number) => ({ id, updatedAt }) as GameRecord;

  it('drops the oldest games beyond its size cap', async () => {
    const store = new MemoryGameStore({ maxGames: 2 });
    for (const id of ['a', 'b', 'c']) await store.set(record(id, Date.now()));
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeDefined();
    expect(await store.get('c')).toBeDefined();
  });

  it('forgets idle games after the timeout', async () => {
    let clock = 1000;
    const store = new MemoryGameStore({ ttlMs: 100, now: () => clock });
    await store.set(record('a', clock));
    clock += 50;
    expect(await store.get('a')).toBeDefined();
    clock += 100;
    expect(await store.get('a')).toBeUndefined();
  });
});

describe('the jev director through the service', () => {
  it('asks the model after the first choice and records the full trace in debug', async () => {
    const model = fakeModel();
    const s = svc({ jev: { url: 'http://model', fetch: model.fetch } });
    expect(s.health().directors).toEqual({ random: true, jev: true });

    const g = await s.createGame({ seed: 42, director: 'jev' });
    expect(model.calls).toHaveLength(0); // the opening event has one candidate
    const v = await s.choose(g.id, { choice: 1, eventId: 'valve-stuck' }, { debug: true });

    expect(model.calls).toHaveLength(1);
    expect(v.debug!.decisions).toHaveLength(1);
    const d = v.debug!.decisions[0];
    expect(d.pickedId).toBe(v.event!.id);
    expect((d.info.trace!.request as { state: string }).state).toContain('Candidate events:');
    expect(d.info.trace!.response).toBeDefined();
    expect(d.pool.every((p) => p.jevPct !== undefined)).toBe(true);
  });

  it('falls back to random and says so when the model is down', async () => {
    const down = async () => {
      throw new Error('connection refused');
    };
    const s = svc({ jev: { url: 'http://model', fetch: down as never } });
    const g = await s.createGame({ seed: 42, director: 'jev' });
    const v = await s.choose(g.id, { choice: 1 }, { debug: true });
    expect(v.status).toBe('playing'); // the game carries on
    expect(v.debug!.last.info?.fallback).toBe(true);
  });
});

describe('giveUp', () => {
  it('ends a fresh game as a failure with the contractor bill', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 42 });
    const v = await s.giveUp(g.id);
    expect(v.status).toBe('failed');
    expect(v.failure).toBe('giveup');
    expect(v.event).toBeNull();
    expect(v.report!.contractorBill!.total).toBeGreaterThan(0);
    expect(v.report!.contractorBill!.rows.map((r) => r.note)).toEqual(['rush job', 'you called']);
  });

  it('adds a touch-up row after some work, drops a pending charge, and refuses a second call', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 42 });
    // Pick the first choice until a charge is waiting for the bank.
    let v = g;
    for (let i = 0; i < 10 && !(v.charge && v.charge.status === 'pending'); i++) {
      v = await s.choose(g.id, { choice: 0, eventId: v.event!.id });
    }
    expect(v.charge?.status).toBe('pending');
    const ended = await s.giveUp(g.id);
    expect(ended.charge).toBeNull();
    expect(ended.report!.contractorBill!.rows.map((r) => r.note)).toContain('fixing your fix');
    await expectError(s.giveUp(g.id), 'conflict', 'game_over');
    expect((await s.getGame(g.id)).report!.contractorBill!.total).toBe(ended.report!.contractorBill!.total);
  });

  it('cannot give up a game that is already over, or one that does not exist', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 7 });
    const done = await playOut(s, g.id);
    expect(done.status).not.toBe('playing');
    await expectError(s.giveUp(g.id), 'conflict', 'game_over');
    await expectError(s.giveUp('nope'), 'not_found', 'game_not_found');
  });
});
