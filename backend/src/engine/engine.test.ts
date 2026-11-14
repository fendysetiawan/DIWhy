import { describe, expect, it } from 'vitest';
import { EVENTS, FINALE } from '../data/events';
import { MAX_EVENTS, applyChoice, eligibleEvents, nextEvent, type GameEvent } from './EventEngine';
import { RandomDirector } from './RandomDirector';
import { applyEffects, createInitialState, isOver, type GameState } from './GameState';
import { createRng } from './rng';

const byId = (id: string) => EVENTS.find((e) => e.id === id)!;
const withHistory = (s: GameState, n: number): GameState => ({
  ...s,
  eventHistory: Array.from({ length: n }, (_, i) => `seen-${i}`),
});

/** Play a whole game, always picking choices with `pick`. Returns the event ids in order. */
async function play(seed: number, pick: (n: number) => number): Promise<{ ids: string[]; state: GameState }> {
  const rng = createRng(seed);
  const director = new RandomDirector(rng);
  const chooser = createRng(seed + 1);
  let state = createInitialState();
  const ids: string[] = [];
  for (let step = 0; step < 50 && !isOver(state); step++) {
    const event = await nextEvent(state, EVENTS, director, FINALE);
    ids.push(event.id);
    state = applyChoice(state, event, pick(Math.floor(chooser() * event.choices.length)), rng).state;
  }
  return { ids, state };
}

describe('event eligibility', () => {
  it('offers only the opening event at the very start', () => {
    const ids = eligibleEvents(createInitialState(), EVENTS).map((e) => e.id);
    expect(ids).toEqual(['valve-stuck']);
  });

  it('never repeats an event that was already shown', () => {
    const s = { ...withHistory(createInitialState(), 1), eventHistory: ['valve-stuck', 'corroded-pipes'] };
    const ids = eligibleEvents(s, EVENTS).map((e) => e.id);
    expect(ids).not.toContain('valve-stuck');
    expect(ids).not.toContain('corroded-pipes');
  });

  it('only offers water damage once the house actually has some', () => {
    const dry = withHistory(createInitialState(), 3);
    const wet = { ...dry, house: { ...dry.house, waterDamage: true } };
    expect(eligibleEvents(dry, EVENTS).map((e) => e.id)).not.toContain('hidden-water-damage');
    expect(eligibleEvents(wet, EVENTS).map((e) => e.id)).toContain('hidden-water-damage');
  });

  it('unlocks heated floors and tile-discontinued through flags', () => {
    const base = withHistory(createInitialState(), 2);
    expect(eligibleEvents(base, EVENTS).map((e) => e.id)).not.toContain('heated-floors');
    const tiled = { ...base, flags: ['new-tile', 'tile-order'] };
    const ids = eligibleEvents(tiled, EVENTS).map((e) => e.id);
    expect(ids).toContain('heated-floors');
    expect(ids).toContain('tile-discontinued');
  });

  it('gives the finale when nothing else is eligible or the event limit is reached', async () => {
    const director = new RandomDirector(createRng(1));
    const long = withHistory(createInitialState(), MAX_EVENTS);
    expect(await nextEvent(long, EVENTS, director, FINALE)).toBe(FINALE);
    expect(await nextEvent(createInitialState(), [], director, FINALE)).toBe(FINALE);
  });

  it('ignores a director that returns an event not on the list', async () => {
    const rogue = { name: 'rogue', selectEvent: () => byId('tile-discontinued') };
    const s = createInitialState();
    expect((await nextEvent(s, EVENTS, rogue, FINALE)).id).toBe('valve-stuck');
  });
});

describe('state updates', () => {
  it('applies effects without mutating the old state', () => {
    const before = createInitialState();
    const after = applyEffects(before, { cost: 180, days: 1, stress: 10, risk: 30, addFlags: ['x'] }, 'test');
    expect(after.spent).toBe(180);
    expect(after.daysElapsed).toBe(1);
    expect(after.riskDebt).toBe(30);
    expect(after.flags).toEqual(['x']);
    expect(after.ledger).toEqual([{ label: 'test', cost: 180 }]);
    expect(before.spent).toBe(0);
    expect(before.flags).toEqual([]);
  });

  it('keeps stress in 0..100 and risk debt at or above 0', () => {
    const s = applyEffects(createInitialState(), { stress: 500, risk: -40 }, 't');
    expect(s.stress).toBe(100);
    expect(s.riskDebt).toBe(0);
    expect(applyEffects(s, { stress: -500 }, 't').stress).toBe(0);
  });

  it('forcing the valve adds risk, and the gamble can break it', () => {
    const force = byId('valve-stuck');
    const lucky = applyChoice(createInitialState(), force, 0, () => 0.99);
    expect(lucky.gambleHit).toBe(false);
    expect(lucky.state.riskDebt).toBe(30);
    expect(lucky.state.house.waterDamage).toBe(false);

    const unlucky = applyChoice(createInitialState(), force, 0, () => 0);
    expect(unlucky.gambleHit).toBe(true);
    expect(unlucky.state.flags).toContain('broken-valve');
    expect(unlucky.state.house.waterDamage).toBe(true);
    expect(unlucky.state.spent).toBe(180);
    expect(unlucky.state.problems).toBe(2); // the event itself plus the broken valve
  });

  it('fails the game when the budget runs out, even if the job finished', () => {
    const broke = { ...createInitialState(), spent: 4900 };
    const result = applyChoice(broke, FINALE, 1, () => 0.99); // pro install: $200
    expect(result.state.completed).toBe(true);
    expect(result.state.failure).toBe('budget');
  });
});

describe('risk debt', () => {
  it('makes bad events more likely and gambles riskier', () => {
    const calm = withHistory(createInitialState(), 2);
    const risky = { ...calm, riskDebt: 80 };
    expect(byId('corroded-pipes').weight(risky)).toBeGreaterThan(byId('corroded-pipes').weight(calm));
    expect(byId('hidden-water-damage').weight(risky)).toBeGreaterThan(byId('hidden-water-damage').weight(calm));
    const install = FINALE.choices[0].gamble!;
    expect(install.chance(risky)).toBeGreaterThan(install.chance(calm));
  });
});

describe('weighted randomness', () => {
  const fake = (id: string, w: number): GameEvent => ({ ...FINALE, id, weight: () => w });

  it('picks in proportion to weight and never picks weight zero', () => {
    const director = new RandomDirector(createRng(7));
    const events = [fake('a', 30), fake('b', 10), fake('never', 0)];
    const counts: Record<string, number> = { a: 0, b: 0, never: 0 };
    for (let i = 0; i < 4000; i++) counts[director.selectEvent(createInitialState(), events).id]++;
    expect(counts.never).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.4);
    expect(counts.a / counts.b).toBeLessThan(3.8);
  });
});

describe('determinism and termination', () => {
  it('same seed gives the same game', async () => {
    expect((await play(42, () => 0)).ids).toEqual((await play(42, () => 0)).ids);
    expect((await play(42, (n) => n)).state).toEqual((await play(42, (n) => n)).state);
  });

  it('different seeds give different stories', async () => {
    const stories = new Set<string>();
    for (let i = 0; i < 30; i++) stories.add((await play(i, (n) => n)).ids.join(','));
    expect(stories.size).toBeGreaterThan(10);
  });

  it('createRng is reproducible', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('always reaches an ending, never repeats an event, within the event limit', async () => {
    for (let seed = 0; seed < 300; seed++) {
      const { ids, state } = await play(seed, (n) => n);
      expect(isOver(state)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(MAX_EVENTS + 1);
    }
  });
});
