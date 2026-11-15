import { describe, expect, it } from 'vitest';
import type { Project } from '../content/projects';
import { makeFinale } from '../content/fromCsv';
import type { GameEvent } from '../engine/EventEngine';
import { realProjects } from '../testing';
import { adviceFor } from './advice';
import { CHARACTER_IDS, ROLES, dealCast } from './cast';
import { ServiceError } from './errors';
import { GameService } from './GameService';
import type { GameView } from './types';

let n = 0;
const projects = realProjects();
const svc = (extra: ConstructorParameters<typeof GameService>[0] = {}) =>
  new GameService({ projects, newId: () => `g${++n}`, ...extra });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as ServiceError).code;
  }
  return 'no error';
}

async function playOut(s: GameService, id: string, pick = 0): Promise<GameView> {
  let v = await s.getGame(id);
  for (let i = 0; i < 30 && v.status === 'playing'; i++) {
    v = await s.choose(id, { choice: Math.min(pick, v.event!.choices.length - 1), eventId: v.event!.id });
  }
  return v;
}

describe('projects', () => {
  it('lists every project, with the plan\'s three first and marked, and the wall quoted at $10,000', () => {
    const list = svc().listProjects();
    expect(list.slice(0, 6).map((p) => p.id)).toEqual([
      'wall-removal',
      'bathroom-leak',
      'dryer-replacement',
      'kitchen-faucet',
      'carpet-replacement',
      'window-caulking',
    ]);
    expect(list).toHaveLength(12);
    expect(list.filter((p) => p.fromPlan).map((p) => p.id)).toEqual(['wall-removal', 'bathroom-leak', 'dryer-replacement']);
    expect(list[0].quote).toEqual({ budget: 10000, days: 14 });
  });

  it('starts the project the player picked, with its quote and limits', async () => {
    const v = await svc().createGame({ seed: 5, project: 'wall-removal' });
    expect(v.project).toEqual({ id: 'wall-removal', title: 'Open up the floor plan', job: 'wall removal' });
    expect(v.quote.original).toEqual({ budget: 10000, days: 14 });
    expect(v.stats).toMatchObject({ budget: 25000, maxDays: 42 }); // 2.5x the money, 3x the days
  });

  it('lets the seed pick a project when none is asked for, and rejects an unknown one', async () => {
    expect((await svc().createGame({ seed: 2 })).project.id).toBe(projects[2].id);
    expect(await code(svc().createGame({ project: 'nope' }))).toBe('invalid_project');
  });

  it('opens each project on one of its own problems', async () => {
    for (const p of projects) {
      const v = await svc().createGame({ seed: 3, project: p.id });
      expect(p.events.map((e) => e.id), p.id).toContain(v.event!.id);
      expect(v.event!.kind, p.id).toBe('problem');
    }
  });

  it('plays every project to an ending judged against its own contractor quote', async () => {
    for (const p of projects) {
      const s = svc();
      const end = await playOut(s, (await s.createGame({ seed: 11, project: p.id })).id);
      expect(['complete', 'failed'], p.id).toContain(end.status);
      expect(end.report!.estimate, p.id).toBe(p.quote.budget);
      expect(end.report!.plannedDays, p.id).toBe(p.quote.days);
    }
  });

  it('starts a game on a project whose events were edited, with the edited text', async () => {
    let live: Project[] = projects;
    const s = svc({ projects: () => live });
    const edited = projects.map((p) => ({ ...p, events: p.events.map((e) => ({ ...e, title: `EDITED ${e.title}` })) }));
    expect((await s.createGame({ seed: 1, project: 'wall-removal' })).event!.title).not.toContain('EDITED');
    live = edited;
    expect((await s.createGame({ seed: 1, project: 'wall-removal' })).event!.title).toContain('EDITED');
  });

  it('says "start a new game" when an event a running game needs is gone', async () => {
    let live: Project[] = projects;
    const s = svc({ projects: () => live });
    const g = await s.createGame({ seed: 1, project: 'wall-removal' });
    live = projects.map((p) => ({ ...p, events: p.events.filter((e) => e.id !== g.event!.id) }));
    expect(await code(s.choose(g.id, { choice: 0 }))).toBe('project_changed');
  });
});

describe('the cast', () => {
  it('deals the seven characters to the player and the six roles, each exactly once', () => {
    const c = dealCast(42, 'ramy-maher');
    expect(c.owner).toBe('ramy-maher');
    const everyone = [c.owner, ...ROLES.map((r) => c.roles[r])];
    expect(everyone.sort()).toEqual([...CHARACTER_IDS].sort());
    expect(['budget', 'time']).toContain(c.partnerFocus);
  });

  it('is the same for the same seed and different across seeds', () => {
    expect(dealCast(7)).toEqual(dealCast(7));
    expect(dealCast(7, 'gigi-singh')).toEqual(dealCast(7, 'gigi-singh'));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(dealCast(i, 'travis-potter').roles)));
    expect(seen.size).toBeGreaterThan(20);
    const focus = new Set(Array.from({ length: 30 }, (_, i) => dealCast(i).partnerFocus));
    expect(focus).toEqual(new Set(['budget', 'time']));
  });

  it('uses the owner the player picked, and a random one otherwise; rejects strangers', async () => {
    expect((await svc().createGame({ seed: 4, owner: 'aidan-newsome' })).cast.owner).toBe('aidan-newsome');
    expect(CHARACTER_IDS).toContain((await svc().createGame({ seed: 4 })).cast.owner);
    expect(await code(svc().createGame({ owner: 'nobody' }))).toBe('invalid_owner');
  });

  it('is part of every view and stays the same all game', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 8, owner: 'fendy-seitiawan' });
    const later = await s.choose(g.id, { choice: 0, eventId: g.event!.id });
    expect(later.cast).toEqual(g.cast);
  });
});

describe('advice', () => {
  const wall = projects.find((p) => p.id === 'wall-removal')!;

  it('is a pure function of the seed and the event', () => {
    for (const e of wall.events) expect(adviceFor(e, 9)).toEqual(adviceFor(e, 9));
  });

  it('points at a real option, and not every event has an opinion', () => {
    const all = wall.events.map((e) => adviceFor(e, 3));
    const given = all.filter((a) => a !== null);
    expect(given.length).toBeGreaterThan(0);
    expect(given.length).toBeLessThan(all.length);
    given.forEach((a) => expect(a!.pick).toBeGreaterThanOrEqual(0));
  });

  it('has the clerk always pushing the priciest answer, and the others being right only sometimes', () => {
    let clerk = 0, clerkExcessive = 0, soundByOthers = 0, others = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const e of wall.events) {
        const a = adviceFor(e, seed);
        if (!a) continue;
        const q = e.choices[a.pick].quality!;
        if (a.from === 'clerk') {
          clerk++;
          if (q === 'excessive') clerkExcessive++;
        } else {
          others++;
          if (a.reliable) soundByOthers++;
        }
      }
    }
    expect(clerkExcessive / clerk).toBeGreaterThan(0.95);
    expect(soundByOthers / others).toBeGreaterThan(0.15);
    expect(soundByOthers / others).toBeLessThan(0.6); // advice is a gamble, not a cheat sheet
  });

  it('never gives advice on the finale or on events without answer qualities', () => {
    const noQuality: GameEvent = { ...wall.events[0], choices: wall.events[0].choices.map((c) => ({ ...c, quality: undefined })) };
    expect(adviceFor(noQuality, 1)).toBeNull();
    expect(adviceFor(wall.finale, 1)).toBeNull();
  });

  it('lists each answer\'s quality in the debug view only', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 4, project: 'wall-removal' }, { debug: true });
    expect(g.debug!.choiceQualities).toHaveLength(3);
    expect(g.debug!.choiceQualities).toContain('good');
    const plain = await s.getGame(g.id);
    expect(JSON.stringify(plain)).not.toContain('choiceQualities');
    expect(JSON.stringify(plain)).not.toContain('"good"');
  });

  it('shows the player who said what, but only the debug view says whether it was right', async () => {
    const s = svc();
    let found: GameView | undefined;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const v = await s.createGame({ seed, project: 'wall-removal' }, { debug: true });
      if (v.event!.advice) found = v;
    }
    expect(found).toBeDefined();
    const advice = found!.event!.advice!;
    expect(Object.keys(advice).sort()).toEqual(['from', 'pick']);
    expect(ROLES).toContain(advice.from);
    expect(typeof found!.debug!.adviceReliable).toBe('boolean');
    const plain = await s.getGame(found!.id);
    expect(JSON.stringify(plain)).not.toContain('adviceReliable');
  });
});

describe('what a choice does', () => {
  it('reports the outcome: its quality, what it cost, and whether it blew up', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 12, project: 'wall-removal' });
    const goodIndex = g.event!.choices.findIndex((_, i) => projects[0].events.find((e) => e.id === g.event!.id)!.choices[i].quality === 'good');
    const v = await s.choose(g.id, { choice: goodIndex, eventId: g.event!.id });
    expect(v.outcome).toMatchObject({ eventId: g.event!.id, choice: goodIndex, quality: 'good', blewUp: false });
    expect(v.outcome!.cost).toBe(v.stats.spent); // the first choice is all the money spent so far
    expect(v.outcome!.cost).toBeGreaterThan(0);
  });

  it('turns a charge into a pending payment, and a free choice into none', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 12, project: 'wall-removal' });
    const v = await s.choose(g.id, { choice: 0, eventId: g.event!.id });
    if (v.outcome!.cost > 0) {
      expect(v.charge).toMatchObject({ id: 1, amount: v.outcome!.cost, status: 'pending' });
      expect(v.charge!.what).toBe(v.charge!.what.toLowerCase());
    }
    const free = await s.createGame({ seed: 31, project: 'kitchen-faucet' });
    let cur = free;
    for (let i = 0; i < 20 && cur.status === 'playing'; i++) {
      const e = projects.find((p) => p.id === 'kitchen-faucet')!.events.find((x) => x.id === cur.event?.id);
      const zero = e?.kind === 'temptation' ? e.choices.findIndex((c) => c.quality === 'good') : -1;
      cur = await s.choose(cur.id, { choice: zero >= 0 ? zero : 0, eventId: cur.event!.id });
      if (e?.kind === 'temptation' && zero >= 0) {
        expect(cur.charge).toBeNull(); // saying no to a temptation costs nothing
        return;
      }
    }
  });
});

describe('payments (the bank texts, the player answers)', () => {
  async function withCharge(s: GameService, seed = 12) {
    let v = await s.createGame({ seed, project: 'wall-removal' });
    for (let i = 0; i < 12; i++) {
      v = await s.choose(v.id, { choice: 1, eventId: v.event!.id });
      if (v.charge) return v;
    }
    throw new Error('never got a charge');
  }

  it('confirming changes nothing, and answering again changes nothing more', async () => {
    const s = svc();
    const v = await withCharge(s);
    const ok = await s.payment(v.id, { chargeId: v.charge!.id, confirm: true });
    expect(ok.charge!.status).toBe('confirmed');
    expect(ok.stats).toEqual(v.stats);
    const again = await s.payment(v.id, { chargeId: v.charge!.id, confirm: false });
    expect(again.charge!.status).toBe('confirmed'); // already answered, so it stays answered
    expect(again.stats).toEqual(v.stats);
  });

  it('blocking your own card costs a day and some nerves, once, and the charge still stands', async () => {
    const s = svc();
    const v = await withCharge(s);
    const blocked = await s.payment(v.id, { chargeId: v.charge!.id, confirm: false });
    expect(blocked.charge!.status).toBe('blocked');
    expect(blocked.stats.daysElapsed).toBe(v.stats.daysElapsed + 1);
    expect(blocked.stats.stress).toBe(v.stats.stress + 5);
    expect(blocked.stats.spent).toBe(v.stats.spent); // no refund: that would be a free-money exploit
    expect(blocked.log[0]).toContain('blocked');
    const twice = await s.payment(v.id, { chargeId: v.charge!.id, confirm: false });
    expect(twice.stats).toEqual(blocked.stats);
  });

  it('rejects an old charge and a malformed answer', async () => {
    const s = svc();
    const v = await withCharge(s);
    expect(await code(s.payment(v.id, { chargeId: v.charge!.id + 5, confirm: true }))).toBe('stale_charge');
    expect(await code(s.payment(v.id, { chargeId: v.charge!.id, confirm: 'yes' as never }))).toBe('invalid_payment');
    expect(await code(s.payment('nope', { chargeId: 1, confirm: true }))).toBe('game_not_found');
  });
});

describe('the contractor quote', () => {
  it('goes up as problems turn up, never down, and never touches the original', async () => {
    const s = svc();
    let v = await s.createGame({ seed: 6, project: 'wall-removal' });
    expect(v.quote.current).toEqual(v.quote.original);
    const first = await s.requestQuote(v.id);
    expect(first.quote.current).toEqual(first.quote.original); // no problems yet
    for (let i = 0; i < 4; i++) v = await s.choose(v.id, { choice: 0, eventId: v.event!.id });
    const raised = await s.requestQuote(v.id);
    expect(raised.quote.current.budget).toBeGreaterThan(10000);
    expect(raised.quote.current.days).toBeGreaterThan(14);
    expect(raised.quote.original).toEqual({ budget: 10000, days: 14 });
    expect(raised.quote.current.budget % 50).toBe(0);
    const again = await s.requestQuote(v.id);
    expect(again.quote.current.budget).toBeGreaterThanOrEqual(raised.quote.current.budget);
  });

  it('is what the report is judged against: the original quote, however often the contractor re-quotes', async () => {
    const s = svc();
    const g = await s.createGame({ seed: 14, project: 'wall-removal' });
    await s.requestQuote(g.id);
    const end = await playOut(s, g.id);
    expect(end.report!.estimate).toBe(10000);
  });
});

describe('the partner', () => {
  // A project where the first choice goes past the quote ($1,000) but not the game's limit
  // ($2,500), so the partner has something to say and the game carries on.
  const frugal: Project = {
    id: 'tiny',
    title: 'Tiny',
    job: 'tiny job',
    blurb: '',
    fromPlan: false,
    quote: { budget: 1000, days: 100 },
    finale: makeFinale('tiny job', { budget: 1000, days: 100 }),
    events: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i): GameEvent => ({
      id: `e${i}`,
      kind: 'problem',
      title: `E${i}`,
      description: '',
      eligible: () => true,
      weight: () => 1,
      choices: [
        { label: 'Spend', quality: 'good', effects: { cost: 1500, days: 0, stress: 0 }, result: 'ok' },
        { label: 'Wait', quality: 'ok', effects: { cost: 0, days: 0, stress: 0 }, result: 'ok' },
      ],
    })),
  };
  const seedWith = (focus: 'budget' | 'time') => Array.from({ length: 50 }, (_, i) => i).find((i) => dealCast(i).partnerFocus === focus)!;

  it('adds stress once you are over the thing they care about, and says so in the outcome', async () => {
    const s = svc({ projects: [frugal] });
    const g = await s.createGame({ seed: seedWith('budget') });
    const v = await s.choose(g.id, { choice: 0, eventId: g.event!.id });
    expect(v.outcome!.partnerNagged).toBe(true);
    expect(v.stats.stress).toBe(4);
  });

  it('stays quiet while you are within the quote', async () => {
    const s = svc({ projects: [frugal] });
    const g = await s.createGame({ seed: seedWith('budget') });
    const v = await s.choose(g.id, { choice: 1, eventId: g.event!.id }); // "Wait" costs nothing
    expect(v.outcome!.partnerNagged).toBe(false);
    expect(v.stats.stress).toBe(0);
  });

  it('ignores the thing they do not care about: money is over, but this partner watches the clock', async () => {
    const s = svc({ projects: [frugal] });
    const g = await s.createGame({ seed: seedWith('time') });
    const v = await s.choose(g.id, { choice: 0, eventId: g.event!.id });
    expect(v.stats.spent).toBeGreaterThan(1000);
    expect(v.outcome!.partnerNagged).toBe(false);
    expect(v.stats.stress).toBe(0);
  });
});
