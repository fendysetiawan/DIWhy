// Opinions. Each event may come with advice from someone in the cast, and they are not equally
// trustworthy (plan: "can give good or bad advice"). The advice is a pure function of the seed and
// the event, so it never disturbs the game's dice and the same game always hears the same things.
//
//   neighbor  a coin flip between sound and terrible
//   parent    mostly the way it used to be done, which is mostly wrong
//   friend    keeps it fun; usually points at the exciting option
//   clerk     always points at the most expensive option
//
// Whether the advice is sound comes from each answer's quality in the team's event files.

import type { GameEvent, Quality } from '../engine/EventEngine';
import { createRng } from '../engine/rng';
import { mix } from './cast';
import type { AdviceView, Role } from './types';

type Advisor = 'neighbor' | 'parent' | 'friend' | 'clerk';

const ADVISORS: Array<[Advisor, number]> = [
  ['neighbor', 0.35],
  ['parent', 0.3],
  ['friend', 0.2],
  ['clerk', 0.15],
];

/** Chance that an advisor points at a sound answer. The clerk never does, by design. */
const RELIABILITY: Record<Advisor, number> = { neighbor: 0.5, parent: 0.3, friend: 0.4, clerk: 0 };

/** Roughly how often an event comes with an opinion at all. */
const ADVICE_RATE = 0.7;

const SOUND: Quality[] = ['good', 'ok'];

export interface Advice extends AdviceView {
  reliable: boolean;
}

export function adviceFor(event: GameEvent, seed: number): Advice | null {
  if (event.kind === 'finale' || event.choices.some((c) => !c.quality)) return null;
  const rng = createRng(mix(seed, `advice:${event.id}`));
  if (rng() >= ADVICE_RATE) return null;

  let roll = rng();
  let from: Advisor = 'neighbor';
  for (const [who, p] of ADVISORS) {
    if ((roll -= p) < 0) {
      from = who;
      break;
    }
  }

  const indexes = event.choices.map((_, i) => i);
  const sound = indexes.filter((i) => SOUND.includes(event.choices[i].quality!));
  const unsound = indexes.filter((i) => !SOUND.includes(event.choices[i].quality!));
  let pool: number[];

  if (from === 'clerk') {
    // The clerk upsells: the priciest answer, whatever it is.
    const excessive = indexes.filter((i) => event.choices[i].quality === 'excessive');
    pool = excessive.length ? excessive : unsound.length ? unsound : indexes;
  } else if (rng() < RELIABILITY[from] && sound.length) {
    pool = sound;
  } else {
    pool = unsound.length ? unsound : indexes;
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  // Judge the advice by the answer it points at, so it stays honest even in odd cases.
  return { from: from as Role, pick, reliable: SOUND.includes(event.choices[pick].quality!) };
}
