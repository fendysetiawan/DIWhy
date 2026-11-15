// Turns parsed CSV rows into engine events, and builds each project's finale.

import { MAX_EVENTS, type Choice, type GameEvent } from '../engine/EventEngine';
import { flagCount, type GameState, type Quote } from '../engine/GameState';
import { SERIOUS, baseFor, consequence, flavor, type Scale } from './consequences';
import type { CsvEventRow } from './csv';
import type { EventWeight } from './weights';

const cap = (n: number, max: number) => Math.min(max, n);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** What the pro charges for the last step, as a share of the quote. */
const PRO_FINISH_SHARE = 0.08;

/**
 * Choose the money and day multipliers so that always taking the "good" answer finishes at
 * about 85% of the contractor's quote. The player's job is to beat that. Wrong answers are cheap
 * now and expensive later, and excessive ones overshoot, so the numbers cut both ways.
 */
export function calibrate(rows: CsvEventRow[], quote: Quote): Scale {
  const problems = rows.filter((r) => r.kind === 'snowball');
  const perGame = MAX_EVENTS * 0.8; // most events in a game are problems, the rest are temptations
  const cost = (0.85 * quote.budget - quote.budget * PRO_FINISH_SHARE) / (avg(problems.map((r) => baseFor(r.category).cost)) * perGame);
  const days = (0.85 * quote.days - 1) / (avg(problems.map((r) => baseFor(r.category).days)) * perGame);
  return { cost, days: Math.max(0.15, days) };
}

/** The baked weight of an event right now: its pull from the latest event, else the strongest pull from any earlier one, else base. */
export function bakedWeight(w: EventWeight, s: GameState): number {
  const after = w.after;
  if (!after) return w.base;
  const last = s.eventHistory[s.eventHistory.length - 1];
  if (last !== undefined && after[last] !== undefined) return after[last];
  const pulls = s.eventHistory.filter((id) => after[id] !== undefined).map((id) => after[id]);
  return pulls.length ? Math.max(...pulls) : w.base;
}

export function buildEvents(
  rows: CsvEventRow[],
  links: Record<string, string[]>,
  scale: Scale,
  weights: Record<string, EventWeight> = {},
): GameEvent[] {
  return rows.map((row): GameEvent => {
    const parents = links[row.id] ?? [];
    const temptation = row.kind === 'temptation';
    // Without a table entry: 8 for an opener, 16 for a follow-up, 5 for a temptation.
    const baked = (s: GameState, fallback: number): number => (weights[row.id] ? bakedWeight(weights[row.id], s) : fallback);
    return {
      id: row.id,
      kind: temptation ? 'temptation' : 'problem',
      title: row.title,
      description: row.description,
      category: row.category,
      visual: row.visual ?? [], // rows frozen before the column existed have none
      // A temptation shows up once the work is under way. A follow-up needs one of its parents.
      eligible: temptation
        ? (s) => s.eventHistory.length >= 2
        : parents.length
          ? (s) => parents.some((p) => s.eventHistory.includes(p))
          : () => true,
      // The baked table (weights.ts) sets the odds; follow-ups are likelier than openers (that is
      // the cascade). Cutting corners makes the serious kinds of trouble likelier still. Scope
      // creep makes temptations louder.
      weight: temptation
        ? (s) => baked(s, 5) + 4 * flagCount(s, 'scope-creep')
        : (s) => baked(s, parents.length ? 16 : 8) + (SERIOUS.has(row.category) ? s.riskDebt * 0.25 : 0),
      choices: row.options.map((label, i): Choice => {
        const q = row.qualities[i];
        const c = consequence(q, row.category, row.kind, scale, { cost: row.costs[i], days: row.days[i] });
        return {
          label,
          quality: q,
          effects: c.effects,
          result: flavor(row.id, q, row.kind),
          gamble: c.gamble && { ...c.gamble, result: flavor(row.id, q, row.kind, 'blowup') },
        };
      }),
    };
  });
}

/** The last step of any job: finish it yourself (risky) or pay a pro (safe, a little pricey). */
export function makeFinale(job: string, quote: Quote): GameEvent {
  // The last step takes a day on a job quoted at a few days or more. On a quick job it takes no extra time.
  const lastStep = quote.days >= 3 ? 1 : 0;
  return {
    id: 'finale',
    kind: 'finale',
    title: `Finally: finish the ${job}`,
    description: `Every box is checked, every surprise survived. All that is left is the last step of the ${job}. You are far too deep to ask why now. Who does it?`,
    eligible: () => false,
    weight: () => 0,
    choices: [
      {
        label: 'Finish it yourself',
        quality: 'ok',
        effects: { days: lastStep, complete: true },
        result: 'A couple of turns of a wrench. How hard could it be?',
        gamble: {
          // Everything you skipped earlier comes due right here.
          chance: (s) => cap(0.1 + s.riskDebt / 150 + (s.house.waterDamage ? 0.15 : 0), 0.85),
          effects: { cost: Math.round((quote.budget * 0.2) / 10) * 10, days: lastStep + 1, stress: 15 },
          result: 'It does not hold. Of course it does not hold. The pro is back, and amused.',
        },
      },
      {
        label: 'Hire a pro for the last step',
        quality: 'good',
        effects: { cost: Math.round((quote.budget * PRO_FINISH_SHARE) / 10) * 10, days: lastStep, risk: -10, complete: true },
        result: 'Ten minutes and a signature. It works. It always works when someone else does it.',
      },
    ],
  };
}
