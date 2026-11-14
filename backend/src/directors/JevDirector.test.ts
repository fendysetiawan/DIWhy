import { describe, expect, it } from 'vitest';
import { EVENTS, FINALE } from '../data/events';
import { nextEvent, type GameEvent } from '../engine/EventEngine';
import { createInitialState } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { createRng } from '../engine/rng';
import { JevDirector, describeState, sampleByProbability } from './JevDirector';

const byId = (id: string) => EVENTS.find((e) => e.id === id)!;
const candidates: GameEvent[] = [byId('corroded-pipes'), byId('upgrade-vanity'), byId('contractor-delay')];
const state = { ...createInitialState(), eventHistory: ['valve-stuck'] };

/** A fake fetch that returns whatever the test wants. Also records the request bodies. */
function fakeFetch(answer: unknown, ok = true) {
  const requests: any[] = [];
  const fn = async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return { ok, status: ok ? 200 : 500, json: async () => answer } as Response;
  };
  return { fn, requests };
}
const answerWith = (probabilities: Record<string, number>) => ({
  answers: { next_event: { type: 'choice', choice: 'x', probabilities } },
});

function director(fetchFn: ReturnType<typeof fakeFetch>['fn'], seed = 1) {
  const rng = createRng(seed);
  return new JevDirector(rng, new RandomDirector(rng), 'http://model', 1000, fetchFn);
}

describe('describeState', () => {
  it('tells the model the numbers, the history and every candidate', () => {
    const text = describeState({ ...state, spent: 180, flags: ['wall-open', 'wall-open'] }, candidates);
    expect(text).toContain('spent $180 (the game ends at $5000)');
    expect(text).toContain('wall-open'); // once, flags are de-duplicated
    expect(text.match(/wall-open/g)).toHaveLength(1);
    expect(text).toContain('Events so far, in order: valve-stuck');
    for (const c of candidates) expect(text).toContain(`- ${c.id} (${c.kind})`);
  });
});

describe('sampleByProbability', () => {
  it('follows the probabilities and never picks a zero', () => {
    const rng = createRng(3);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[candidates.indexOf(sampleByProbability(candidates, [0.8, 0.2, 0], rng))]++;
    expect(counts[2]).toBe(0);
    expect(counts[0] / counts[1]).toBeGreaterThan(3);
    expect(counts[0] / counts[1]).toBeLessThan(5);
  });
});

describe('JevDirector', () => {
  it('asks one choice question using the candidate ids and returns a candidate', async () => {
    const { fn, requests } = fakeFetch(answerWith({ 'corroded-pipes': 0.1, 'upgrade-vanity': 0.8, 'contractor-delay': 0.1 }));
    const d = director(fn);
    const picked = await d.selectEvent(state, candidates);
    expect(candidates).toContain(picked);
    expect(Object.keys(requests[0].questions)).toEqual(['next_event']);
    expect(requests[0].questions.next_event.type).toBe('choice');
    expect(Object.keys(requests[0].questions.next_event.criteria)).toEqual(candidates.map((c) => c.id));
    expect(d.lastInfo?.fallback).toBeUndefined();
    expect(d.lastInfo?.probabilities?.['upgrade-vanity']).toBe(0.8);
  });

  it('records a full trace: request sent, raw response, roll and pick', async () => {
    const answer = answerWith({ 'corroded-pipes': 0.5, 'upgrade-vanity': 0.3, 'contractor-delay': 0.2 });
    const { fn, requests } = fakeFetch(answer);
    const d = director(fn);
    const picked = await d.selectEvent(state, candidates);
    const trace = d.lastInfo!.trace!;
    expect(trace.request).toEqual(requests[0]); // exactly what was sent
    expect((trace.request as { state: string }).state).toContain('Candidate events:');
    expect(trace.response).toEqual(answer); // exactly what came back
    expect(trace.pickedId).toBe(picked.id);
    expect(trace.roll).toBeGreaterThanOrEqual(0);
    expect(trace.roll).toBeLessThan(1);
    expect(trace.error).toBeUndefined();
  });

  it('records the request and the error when it falls back', async () => {
    const bad = { answers: {} };
    const d = director(fakeFetch(bad).fn);
    await d.selectEvent(state, candidates);
    const trace = d.lastInfo!.trace!;
    expect(trace.error).toContain('no probabilities');
    expect(trace.response).toEqual(bad); // the unusable response is kept for debugging
    expect((trace.request as { questions: object }).questions).toHaveProperty('next_event');
    expect(candidates.map((c) => c.id)).toContain(trace.pickedId);
  });

  it('is reproducible: same seed and same answers give the same pick', async () => {
    const answer = answerWith({ 'corroded-pipes': 0.4, 'upgrade-vanity': 0.3, 'contractor-delay': 0.3 });
    const a = await director(fakeFetch(answer).fn, 9).selectEvent(state, candidates);
    const b = await director(fakeFetch(answer).fn, 9).selectEvent(state, candidates);
    expect(a.id).toBe(b.id);
  });

  it('skips the model when there is only one candidate', async () => {
    const { fn, requests } = fakeFetch({});
    const d = director(fn);
    expect(await d.selectEvent(state, [candidates[0]])).toBe(candidates[0]);
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['HTTP error', fakeFetch({}, false).fn],
    ['no probabilities', fakeFetch({ answers: {} }).fn],
    ['missing a candidate', fakeFetch(answerWith({ 'corroded-pipes': 1 })).fn],
    ['negative probability', fakeFetch(answerWith({ 'corroded-pipes': -1, 'upgrade-vanity': 1, 'contractor-delay': 1 })).fn],
    ['all zero', fakeFetch(answerWith({ 'corroded-pipes': 0, 'upgrade-vanity': 0, 'contractor-delay': 0 })).fn],
    ['network failure', async () => { throw new Error('connection refused'); }],
  ])('falls back to the random director on %s', async (_name, fn) => {
    const d = director(fn);
    const picked = await d.selectEvent(state, candidates);
    expect(candidates).toContain(picked);
    expect(d.lastInfo?.fallback).toBe(true);
    expect(d.lastInfo?.note).toContain('fallback');
  });

  it('can never hand the engine an ineligible event: the engine still validates', async () => {
    const rogue = { name: 'rogue', selectEvent: async () => byId('tile-discontinued') };
    expect((await nextEvent(createInitialState(), EVENTS, rogue, FINALE)).id).toBe('valve-stuck');
  });
});
