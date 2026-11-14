// Director comparison harness. NOT part of the normal test run: it calls the real model.
//
//   VITE_COMPARE=1 npx vitest run src/directors/compare.test.ts --disable-console-intercept
//   optional: VITE_COMPARE_N=20 (games per director)  VITE_JEV_URL=http://127.0.0.1:8009/v1/systemone
//
// Both directors play the same seeds with the same random-clicking bot, so differences in the
// numbers come from event selection, not from the player.

import { describe, it } from 'vitest';
import { EVENTS, FINALE } from '../data/events';
import { applyChoice, nextEvent, type EventDirector, type EventKind } from '../engine/EventEngine';
import { createInitialState, isOver, type FailureReason } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { createRng } from '../engine/rng';
import { JevDirector } from './JevDirector';
import { readInfo, resetInfo } from './types';

const RUN = Boolean(import.meta.env.VITE_COMPARE);
const N = Number(import.meta.env.VITE_COMPARE_N ?? 12);
const URL_ = String(import.meta.env.VITE_JEV_URL ?? 'http://127.0.0.1:8009/v1/systemone');
const kindOf = (id: string): EventKind => (id === FINALE.id ? 'finale' : EVENTS.find((e) => e.id === id)!.kind);

interface GameRecord {
  ids: string[];
  ending: FailureReason | 'complete';
  spent: number;
  days: number;
  stress: number;
  problems: number;
  calls: number; // model decisions
  fallbacks: number;
  latencies: number[];
  topProbs: number[]; // highest probability the model gave, per decision
}

async function runGame(seed: number, kind: 'random' | 'jev'): Promise<GameRecord> {
  const rng = createRng(seed);
  const random = new RandomDirector(rng);
  const director: EventDirector = kind === 'jev' ? new JevDirector(rng, random, URL_, 120_000) : random;
  const chooser = createRng(seed + 1); // the bot player: picks a random choice every time

  let state = createInitialState();
  const rec: GameRecord = {
    ids: [], ending: 'complete', spent: 0, days: 0, stress: 0, problems: 0,
    calls: 0, fallbacks: 0, latencies: [], topProbs: [],
  };

  while (!isOver(state) && rec.ids.length < 20) {
    resetInfo(director);
    const event = await nextEvent(state, EVENTS, director, FINALE);
    const info = readInfo(director);
    if (info?.probabilities) {
      rec.calls++;
      rec.topProbs.push(Math.max(...Object.values(info.probabilities)));
      if (info.latencyMs !== undefined) rec.latencies.push(info.latencyMs);
    }
    if (info?.fallback) rec.fallbacks++;
    rec.ids.push(event.id);
    state = applyChoice(state, event, Math.floor(chooser() * event.choices.length), rng).state;
  }

  Object.assign(rec, {
    ending: state.failure ?? 'complete',
    spent: state.spent, days: state.daysElapsed, stress: state.stress, problems: state.problems,
  });
  return rec;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f = (n: number, d = 1) => n.toFixed(d);

function summarize(games: GameRecord[]) {
  const endings: Record<string, number> = { complete: 0, budget: 0, time: 0, stress: 0 };
  games.forEach((g) => endings[g.ending]++);

  // Kind mix excludes the forced opening and the finale: only the director's actual picks.
  const picks = games.flatMap((g) => g.ids.slice(1).filter((id) => id !== FINALE.id));
  const kinds: Record<string, number> = { problem: 0, temptation: 0, humor: 0 };
  picks.forEach((id) => kinds[kindOf(id)]++);

  // Pacing: how often does the same kind of event happen twice in a row?
  let pairs = 0, repeats = 0;
  games.forEach((g) => {
    const ks = g.ids.slice(1).filter((id) => id !== FINALE.id).map(kindOf);
    for (let i = 1; i < ks.length; i++) { pairs++; if (ks[i] === ks[i - 1]) repeats++; }
  });

  const freq: Record<string, number> = {};
  games.forEach((g) => g.ids.forEach((id) => (freq[id] = (freq[id] ?? 0) + 1)));

  return {
    n: games.length,
    endings,
    spent: mean(games.map((g) => g.spent)),
    days: mean(games.map((g) => g.days)),
    stress: mean(games.map((g) => g.stress)),
    problems: mean(games.map((g) => g.problems)),
    events: mean(games.map((g) => g.ids.length)),
    distinctStories: new Set(games.map((g) => g.ids.join(','))).size,
    kinds, picks: picks.length,
    sameKindRepeatRate: pairs ? repeats / pairs : 0,
    freq,
    calls: games.reduce((a, g) => a + g.calls, 0),
    fallbacks: games.reduce((a, g) => a + g.fallbacks, 0),
    latency: mean(games.flatMap((g) => g.latencies)),
    topProb: mean(games.flatMap((g) => g.topProbs)),
  };
}

describe.skipIf(!RUN)('random vs jev director', () => {
  it('plays the same seeds with both and prints a comparison', async () => {
    const random: GameRecord[] = [];
    const jev: GameRecord[] = [];
    for (let seed = 1; seed <= N; seed++) {
      random.push(await runGame(seed, 'random'));
      jev.push(await runGame(seed, 'jev'));
      console.log(`seed ${seed}/${N} done`);
    }
    const r = summarize(random);
    const j = summarize(jev);
    const row = (label: string, a: string, b: string) => `${label.padEnd(34)}${a.padStart(10)}${b.padStart(10)}`;
    const pct = (n: number, d: number) => `${f((100 * n) / Math.max(1, d), 0)}%`;

    const lines = [
      '',
      `Games per director: ${N} (same seeds, same random-clicking bot)`,
      row('', 'random', 'jev'),
      row('mean total cost ($)', f(r.spent, 0), f(j.spent, 0)),
      row('mean days', f(r.days), f(j.days)),
      row('mean final stress', f(r.stress), f(j.stress)),
      row('mean unexpected problems', f(r.problems), f(j.problems)),
      row('mean events per game', f(r.events), f(j.events)),
      row('distinct stories', `${r.distinctStories}/${r.n}`, `${j.distinctStories}/${j.n}`),
      row('same kind twice in a row', pct(r.sameKindRepeatRate, 1), pct(j.sameKindRepeatRate, 1)),
      '',
      'Endings',
      ...(['complete', 'budget', 'time', 'stress'] as const).map((k) => row(`  ${k}`, String(r.endings[k]), String(j.endings[k]))),
      '',
      'Event kinds (director picks only)',
      ...(['problem', 'temptation', 'humor'] as const).map((k) => row(`  ${k}`, pct(r.kinds[k], r.picks), pct(j.kinds[k], j.picks))),
      '',
      'How often each event appeared',
      ...EVENTS.map((e) => row(`  ${e.id}`, String(r.freq[e.id] ?? 0), String(j.freq[e.id] ?? 0))),
      '',
      `Jev: ${j.calls} model decisions, ${j.fallbacks} fallbacks, mean latency ${f(j.latency, 0)} ms, ` +
        `mean top probability ${f(j.topProb * 100, 0)}% (higher = more decisive)`,
      '',
    ];
    console.log(lines.join('\n'));
  }, 3_600_000);
});
