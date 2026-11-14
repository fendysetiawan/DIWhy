// The public contract of the DIWhy backend: every JSON shape a front end sends or receives.
//
// This file is the single source of truth. A front end can copy it, or import it as types only.
// It has no runtime code. (The `import type` lines below are erased at build time, so nothing
// from the engine ends up in a front end's bundle.)

import type { DirectorInfo } from '../directors/types';
import type { EventKind } from '../engine/EventEngine';
import type { FailureReason, GameState, LedgerEntry } from '../engine/GameState';
import type { Report } from '../engine/report';

export type { DirectorInfo, EventKind, FailureReason, LedgerEntry, Report };

/** Who picks which event happens next. `jev` is a local decision model. */
export type DirectorName = 'random' | 'jev';

export type GameStatus = 'playing' | 'complete' | 'failed';

// ------------------------------------------------------------------ responses

/** One option the player can take. Hidden consequences are never included. */
export interface ChoiceView {
  index: number; // send this back as `choice`
  label: string;
  cost: number; // dollars shown to the player; negative = refund
  days: number;
}

/** The event the player is deciding on right now. */
export interface EventView {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  choices: ChoiceView[];
}

/** The numbers a player sees. */
export interface StatsView {
  budget: number;
  spent: number;
  daysElapsed: number;
  maxDays: number;
  stress: number; // 0..100, game over at 100
  riskDebt: number;
  problems: number; // the "times you asked why" count
}

/** One row of "what the director could have picked". */
export interface PoolEntry {
  id: string;
  weight: number;
  pct: number; // chance under the weighted-random rules, 0..100
  jevPct?: number; // chance according to the model, when it answered
  picked: boolean;
}

/** One director decision, kept so tools can show exactly what happened. */
export interface DecisionRecord {
  step: number; // which event slot this decision filled (1 = first)
  pickedId: string;
  pool: PoolEntry[];
  info: DirectorInfo;
}

/** The most recent director pick, whether or not a model was involved. */
export interface LastDecision {
  pool: PoolEntry[];
  forced: boolean; // the engine forced the finale, no director pick
  info?: DirectorInfo;
}

/** Everything the engine knows. Only returned when `debug=1` is requested. */
export interface DebugView {
  state: GameState;
  maxEvents: number;
  decisions: DecisionRecord[]; // model decisions, oldest first
  last: LastDecision;
}

/** The whole game as a front end needs to draw it. Every endpoint returns this. */
export interface GameView {
  id: string;
  seed: number;
  director: DirectorName;
  status: GameStatus;
  failure: FailureReason | null; // set when status is "failed"
  stats: StatsView;
  ledger: LedgerEntry[]; // every cost so far
  log: string[]; // flavor text from recent choices, newest first
  event: EventView | null; // null once the game is over
  report: Report | null; // the end-of-game report, once the game is over
  debug?: DebugView;
}

export interface HealthView {
  status: 'ok';
  directors: Record<DirectorName, boolean>; // which directors this server can use
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ------------------------------------------------------------------- requests

export interface CreateGameRequest {
  seed?: number; // integer 0..4294967295. Omit for a random one. Same seed + same choices = same game.
  director?: DirectorName; // default "random"
}

export interface ChooseRequest {
  choice: number; // a ChoiceView.index
  /** Optional safety check: the id of the event the player was looking at. Rejected if it changed. */
  eventId?: string;
}

export interface RequestOptions {
  debug?: boolean; // include `debug` in the response
}
