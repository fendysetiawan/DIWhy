// The event engine: which events can happen, and what a choice does.
//
// The loop (driven by session.ts) is:
//   1. nextEvent()   -> eligible events -> director picks one
//   2. player picks a choice
//   3. applyChoice() -> new state
//   4. repeat until isOver(state)
//
// The ENGINE always decides what is eligible and applies the consequences.
// A director (random, rule-based, or an AI model) only picks from the list it is given.

import { applyEffects, checkEnd, type Effects, type GameState } from './GameState';
import type { Rng } from './rng';

export type EventKind = 'problem' | 'temptation' | 'humor' | 'finale';

export interface Choice {
  label: string;
  /** Effects that always happen. */
  effects: Effects;
  /** Flavor text shown in the history log. */
  result: string;
  /** Optional dice roll AFTER the base effects. `chance` sees the already-updated state. */
  gamble?: {
    chance: (state: GameState) => number; // 0..1
    effects: Effects;
    result: string;
  };
}

export interface GameEvent {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  /** Hard rule: can this event happen right now? (Prerequisites live here.) */
  eligible: (state: GameState) => boolean;
  /** Soft rule: how likely is it relative to other eligible events? (Risk debt lives here.) */
  weight: (state: GameState) => number;
  choices: Choice[]; // 2 or 3
}

/**
 * Anything that can pick the next event from a list the engine already approved.
 * May be async, because a model call is.
 */
export interface EventDirector {
  selectEvent(state: GameState, candidates: GameEvent[]): GameEvent | Promise<GameEvent>;
}

/** After this many events the contractor shows up for the final install. Guarantees an ending. */
export const MAX_EVENTS = 8;

/**
 * Eligibility, step by step. An event can be offered only if:
 *   1. it has not been shown before (every event is one-time, so loops are impossible), and
 *   2. its own `eligible(state)` rule says yes (flags, house condition, days elapsed...), and
 *   3. its `weight(state)` is above zero.
 */
export function eligibleEvents(state: GameState, events: GameEvent[]): GameEvent[] {
  return events.filter(
    (e) => !state.eventHistory.includes(e.id) && e.eligible(state) && e.weight(state) > 0,
  );
}

/**
 * Pick the next event. Returns the finale when the renovation has run long enough
 * (or nothing else is eligible), so the game can never get stuck.
 */
export async function nextEvent(
  state: GameState,
  events: GameEvent[],
  director: EventDirector,
  finale: GameEvent,
): Promise<GameEvent> {
  const candidates = eligibleEvents(state, events);
  if (state.eventHistory.length >= MAX_EVENTS || candidates.length === 0) return finale;
  const picked = await director.selectEvent(state, candidates);
  // Never trust a director blindly: if it returns something that was not on the list, ignore it.
  return candidates.includes(picked) ? picked : candidates[0];
}

export interface ChoiceResult {
  state: GameState;
  /** Lines for the history log, in order. */
  log: string[];
  /** True if the gamble went wrong. */
  gambleHit: boolean;
}

/** Apply one choice. Pure apart from consuming random numbers from `rng`. */
export function applyChoice(
  state: GameState,
  event: GameEvent,
  choiceIndex: number,
  rng: Rng,
): ChoiceResult {
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`No choice ${choiceIndex} on event ${event.id}`);

  let next = applyEffects(state, choice.effects, `${event.title}: ${choice.label}`);
  const log = [choice.result];
  let gambleHit = false;

  if (choice.gamble && rng() < choice.gamble.chance(next)) {
    gambleHit = true;
    next = applyEffects(next, choice.gamble.effects, `${event.title}: complication`);
    log.push(choice.gamble.result);
  }

  next = {
    ...next,
    eventHistory: [...next.eventHistory, event.id],
    problems: next.problems + (event.kind === 'problem' ? 1 : 0) + (gambleHit ? 1 : 0),
  };
  return { state: checkEnd(next), log, gambleHit };
}
