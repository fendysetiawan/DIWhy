// Who is who. The player picks the home owner; the other six characters are dealt, at random but
// from the game's seed, to the six roles (plan: "one the user chooses as the home owner, the rest
// are randomized"). The partner nags about money or time, different every game.

import { createRng } from '../engine/rng';
import type { Cast, CharacterId, Role } from './types';

/** The seven team characters (folder names in assets/characters). */
export const CHARACTER_IDS: readonly CharacterId[] = [
  'travis-potter',
  'aidan-newsome',
  'rachel-katz',
  'christian-huber',
  'ramy-maher',
  'gigi-singh',
  'fendy-seitiawan',
];

export const ROLES: readonly Role[] = ['partner', 'clerk', 'contractor', 'parent', 'neighbor', 'friend'];

/** A small deterministic mix of a seed and a label, so each use gets its own random stream. */
export function mix(seed: number, label: string): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const c of label) h = Math.imul(h ^ c.charCodeAt(0), 0x85ebca6b) >>> 0;
  return h;
}

export function dealCast(seed: number, owner?: CharacterId): Cast {
  const rng = createRng(mix(seed, 'cast'));
  const pick = owner ?? CHARACTER_IDS[Math.floor(rng() * CHARACTER_IDS.length)];

  const others = CHARACTER_IDS.filter((c) => c !== pick);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const roles = Object.fromEntries(ROLES.map((role, i) => [role, others[i]])) as Record<Role, CharacterId>;
  return { owner: pick, roles, partnerFocus: rng() < 0.5 ? 'budget' : 'time' };
}
