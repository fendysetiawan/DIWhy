// What an answer does, derived from its quality and the kind of trouble it is.
//
// The team's event files say HOW GOOD an answer is (good, ok, wrong, excessive) but not what it
// costs, so this table is where those numbers come from. Tune the game here. To set a number by
// hand for one option, add cost_1..3 or days_1..3 columns to that event's CSV (see csv.ts).
//
//   good       the sensible fix. Fair price, risk debt goes down.
//   ok         acceptable and a bit rough. Half price, a little risk.
//   wrong      a shortcut. Almost free now, risk debt jumps, and it can blow up (hidden gamble).
//   excessive  far more than needed. Expensive and slow, and it feeds scope creep.
//
// Temptations (kind "temptation") flip the meaning of "good": the good answer is to say no or
// wait, which costs nothing.

import type { Quality } from '../engine/EventEngine';
import type { Effects, GameState } from '../engine/GameState';

export interface CategoryBase {
  cost: number; // dollars for a "good" fix, before the project's scale
  days: number;
  severity: 1 | 2 | 3; // how nasty it gets when it goes wrong
}

export const CATEGORY: Record<string, CategoryBase> = {
  structural: { cost: 1200, days: 4, severity: 3 },
  permitting: { cost: 400, days: 2, severity: 2 }, // the paperwork kind of trouble
  environmental: { cost: 1000, days: 4, severity: 3 },
  electrical: { cost: 600, days: 2, severity: 2 },
  mechanical: { cost: 500, days: 2, severity: 2 },
  envelope: { cost: 500, days: 2, severity: 2 },
  plumbing: { cost: 450, days: 1, severity: 2 },
  architectural: { cost: 350, days: 1, severity: 1 },
  furnishings: { cost: 250, days: 1, severity: 1 },
  maintenance: { cost: 120, days: 0, severity: 1 },
};
const FALLBACK: CategoryBase = CATEGORY.architectural;
export const baseFor = (category: string): CategoryBase => CATEGORY[category] ?? FALLBACK;

/** Categories where a bad day costs real money and makes the next problem likelier. */
export const SERIOUS = new Set(['structural', 'environmental', 'electrical', 'plumbing', 'envelope']);

/** Per-project multipliers so a good path lands near the contractor's quote. */
export interface Scale {
  cost: number;
  days: number;
}

export interface Gamble {
  chance: (state: GameState) => number;
  effects: Effects;
}
export interface Consequence {
  effects: Effects;
  gamble?: Gamble;
}

const cap = (n: number, max: number) => Math.min(max, n);

export function consequence(
  quality: Quality,
  category: string,
  kind: 'snowball' | 'temptation',
  scale: Scale,
  override: { cost?: number; days?: number } = {},
): Consequence {
  const base = baseFor(category);
  const money = (m: number) => Math.round((base.cost * m * scale.cost) / 10) * 10;
  const days = (m: number) => Math.round(base.days * m * scale.days);
  // A mishap costs a day on a big job, but not on a two-day job, where it would end the game.
  const bump = scale.days >= 0.3 ? 1 : 0;

  let effects: Effects;
  let gamble: Gamble | undefined;

  if (kind === 'temptation' && quality === 'good') {
    effects = { cost: 0, days: 0, stress: 1 }; // saying no to a shiny idea
  } else if (quality === 'good') {
    effects = { cost: money(1), days: days(1), stress: 1, risk: -12 };
  } else if (quality === 'ok') {
    effects = { cost: money(0.55), days: days(0.6), stress: 2, risk: 4 };
  } else if (quality === 'wrong') {
    effects = { cost: money(0.12), days: 0, stress: 4, risk: 10 + 8 * base.severity };
    gamble = {
      // The more corners you have already cut, the likelier this one gives way.
      chance: (s) => cap(0.28 + s.riskDebt / 220 + 0.04 * base.severity, 0.85),
      effects: {
        cost: money(2.3),
        days: days(1) + bump,
        stress: 8 + 3 * base.severity,
        waterDamage: category === 'plumbing' || category === 'envelope' ? true : undefined,
        // Nothing in the rules reads this flag. Its reader is the Jev prompt (JevDirector.ts, "Story flags"), so keep writing it.
        addFlags: [`trouble-${category}`],
      },
    };
  } else {
    effects = { cost: money(2.4), days: days(2) + bump, stress: 3, risk: -18, addFlags: ['scope-creep'] };
  }

  if (override.cost !== undefined) effects = { ...effects, cost: override.cost };
  if (override.days !== undefined) effects = { ...effects, days: override.days };
  return { effects, gamble };
}

// ------------------------------------------------------------- flavor text
// Short lines so every outcome gets a sentence. One is picked by the event's id, so the same
// event always reads the same way.

const LINES: Record<'good' | 'ok' | 'wrong' | 'excessive' | 'declined' | 'blowup', string[]> = {
  good: [
    'You do it properly. It costs a bit, and it holds.',
    'Slow, boring, correct. Somewhere, a contractor nods.',
    'The sensible fix. You feel almost professional.',
  ],
  ok: [
    'It works. Mostly. You decide not to look closely.',
    'Good enough for now, which is how most of this house got built.',
    "Fine. It's fine. It's probably fine.",
  ],
  wrong: [
    'That was fast and cheap. The house makes a note of it.',
    'You saved money today. The house keeps receipts.',
    'Shortcut taken. It feels great. For now.',
  ],
  excessive: [
    'You go big. The invoice goes bigger.',
    'Why fix the problem when you can fix the whole house?',
    'The store clerk is suddenly your best friend.',
  ],
  declined: [
    'You stay strong. The idea goes on the list.',
    'Not today. The list gets longer, not the bill.',
    'Discipline. It will not last, but it is lovely.',
  ],
  blowup: [
    'It holds for about a day. Then it does not.',
    'The shortcut gives way, right on schedule.',
    'Turns out the shortcut was the long way around.',
  ],
};

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

export function flavor(
  eventId: string,
  quality: Quality,
  kind: 'snowball' | 'temptation',
  which: 'result' | 'blowup' = 'result',
): string {
  const key = which === 'blowup' ? 'blowup' : kind === 'temptation' && quality === 'good' ? 'declined' : quality;
  const lines = LINES[key];
  return lines[Math.abs(hash(eventId + key)) % lines.length];
}
