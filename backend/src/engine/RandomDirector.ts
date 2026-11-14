import type { GameEvent, EventDirector } from './EventEngine';
import type { GameState } from './GameState';
import type { Rng } from './rng';

/**
 * Weighted random selection.
 *
 * Each candidate has a weight (computed from the state by the event itself). Imagine the
 * weights laid end to end on a number line of length `total`. Roll a number in [0, total)
 * and pick whichever candidate's segment it lands in. A weight of 30 next to a weight of
 * 10 is picked three times as often, but the lighter one can still win.
 */
export class RandomDirector implements EventDirector {
  readonly name = 'random';
  constructor(private rng: Rng) {}

  selectEvent(state: GameState, candidates: GameEvent[]): GameEvent {
    const weights = candidates.map((e) => Math.max(0, e.weight(state)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return candidates[Math.floor(this.rng() * candidates.length)];
    let roll = this.rng() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll < 0) return candidates[i];
    }
    return candidates[candidates.length - 1]; // floating point safety net
  }
}
