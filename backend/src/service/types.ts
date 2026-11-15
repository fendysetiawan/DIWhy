// The public contract of the DIWhy backend: every JSON shape a front end sends or receives.
//
// This file is the single source of truth. A front end can copy it, or import it as types only.
// It has no runtime code. (The `import type` lines below are erased at build time, so nothing
// from the engine ends up in a front end's bundle.)

import type { DirectorInfo } from '../directors/types';
import type { EventKind } from '../engine/EventEngine';
import type { FailureReason, GameState, LedgerEntry, Quote } from '../engine/GameState';
import type { Report } from '../engine/report';

export type { DirectorInfo, EventKind, FailureReason, LedgerEntry, Quote, Report };

/** Who picks which event happens next. `jev` is a local decision model. */
export type DirectorName = 'random' | 'jev';

export type GameStatus = 'playing' | 'complete' | 'failed';

/** The people in the game. The player is the owner; the other six are dealt to the roles. */
export type Role = 'partner' | 'clerk' | 'contractor' | 'parent' | 'neighbor' | 'friend';

/** One of the seven characters, by folder name in assets/characters, e.g. "travis-potter". */
export type CharacterId = string;

export interface Cast {
  owner: CharacterId;
  roles: Record<Role, CharacterId>;
  /** What the partner nags about this game. */
  partnerFocus: 'budget' | 'time';
}

// ------------------------------------------------------------------ responses

/** One option the player can take. Hidden consequences are never included. */
export interface ChoiceView {
  index: number; // send this back as `choice`
  label: string;
  /** Always null: nobody tells you what a DIY fix will cost. Kept so a price tag can come back. */
  cost: number | null;
  days: number | null;
}

/** Someone's opinion on what to do. They might be right. */
export interface AdviceView {
  from: Role;
  pick: number; // the ChoiceView.index they point at
}

/** The event the player is deciding on right now. */
export interface EventView {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  category: string | null; // "plumbing", "structural", ...
  choices: ChoiceView[];
  advice: AdviceView | null; // not every event comes with an opinion
}

/** One of the jobs the player can take on. */
export interface ProjectView {
  id: string;
  title: string; // "Open up the floor plan"
  job: string; // "wall removal"
  blurb: string;
  fromPlan: boolean;
  quote: Quote; // what the contractor quotes for it
}

/** The contractor's quote. `original` is the baseline the player is judged against. */
export interface QuoteView {
  original: Quote;
  current: Quote; // what the contractor last told the player; asking again can raise it
}

/** Money that just left the account and is waiting for the player to confirm it with the bank. */
export interface ChargeView {
  id: number;
  amount: number;
  what: string;
  status: 'pending' | 'confirmed' | 'blocked';
}

/** What the last choice did, so a front end can react (a text from the partner, a cracked phone). */
export interface OutcomeView {
  eventId: string;
  choice: number;
  quality: 'good' | 'ok' | 'wrong' | 'excessive' | null;
  blewUp: boolean; // the shortcut gave way
  cost: number; // dollars this choice added, including a blow-up
  days: number;
  partnerNagged: boolean; // the partner's pet peeve (money or time) is over the quote
}

/** The numbers a player sees. */
export interface StatsView {
  budget: number; // the hard limit: the game ends when spending reaches it
  spent: number;
  daysElapsed: number;
  maxDays: number; // the hard limit: the game ends after this many days
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
  /** Whether the current event's advice points at a sound answer. Players never see this. */
  adviceReliable: boolean | null;
  /** How good each answer to the current event is (the team's answer_key). The demo uses this. */
  choiceQualities: Array<'good' | 'ok' | 'wrong' | 'excessive' | null>;
}

/** The whole game as a front end needs to draw it. Every endpoint returns this. */
export interface GameView {
  id: string;
  seed: number;
  director: DirectorName;
  project: { id: string; title: string; job: string };
  cast: Cast;
  quote: QuoteView;
  charge: ChargeView | null; // the latest charge, if any
  outcome: OutcomeView | null; // what the last choice did, null at the start
  status: GameStatus;
  failure: FailureReason | null; // set when status is "failed"
  stats: StatsView;
  ledger: LedgerEntry[]; // every cost so far
  log: string[]; // flavor text from recent choices, newest first
  event: EventView | null; // null once the game is over
  report: Report | null; // the end-of-game report, once the game is over
  debug?: DebugView;
}

export interface ProjectsView {
  projects: ProjectView[];
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
  project?: string; // a ProjectView.id. Omit to let the seed pick one.
  owner?: CharacterId; // who the player is. Omit for a random one.
  director?: DirectorName; // default "random"
}

export interface ChooseRequest {
  choice: number; // a ChoiceView.index
  /** Optional safety check: the id of the event the player was looking at. Rejected if it changed. */
  eventId?: string;
}

export interface PaymentRequest {
  chargeId: number; // ChargeView.id
  /** false means the player told the bank "No, block it". The card is blocked, and a day is lost. */
  confirm: boolean;
}

export interface RequestOptions {
  debug?: boolean; // include `debug` in the response
}
