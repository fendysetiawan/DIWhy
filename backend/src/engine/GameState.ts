// Game state and the pure functions that change it.
//
// Nothing in here touches the DOM or randomness. State goes in, new state comes out.
// That makes it easy to test and easy to hand to a different "director" later.

// Defaults describe the original faucet job. A real game passes its project's contractor quote.
export const ESTIMATE = 250; // what the faucet job "should" cost
export const ESTIMATED_DAYS = 1; // ...and how long it "should" take
export const BUDGET = 5000;
export const MAX_DAYS = 30;

/** With a contractor quote, the game ends at this multiple of the quote's money and days. */
export const BUDGET_LIMIT_FACTOR = 2.5;
export const DAYS_LIMIT_FACTOR = 3;

/** The contractor's ORIGINAL quote. It is the baseline the player is judged against. */
export interface Quote {
  budget: number; // dollars
  days: number;
}

export type FailureReason = 'budget' | 'time' | 'stress' | 'giveup'; // giveup: the player called the contractor in

export interface LedgerEntry {
  label: string;
  cost: number; // negative = refund
}

export interface GameState {
  /** Short noun phrase for the job, used in the report: "wall removal", "dryer replacement". */
  job: string;
  /** What the contractor quoted. Never changes during a game. */
  quote: Quote;
  budget: number; // the hard limit: the game ends when spending reaches it
  maxDays: number; // the hard limit: the game ends when the days pass it
  spent: number;
  daysElapsed: number;
  stress: number; // 0..100, game over at 100
  riskDebt: number; // >= 0. Cut corners now, pay later. See README.
  house: {
    plumbingCondition: number; // 0..100
    electricalCondition: number; // 0..100
    waterDamage: boolean;
  };
  /** Free-form tags that unlock or boost events. Duplicates are allowed (counted as a "stack"). */
  flags: string[];
  /** Ids of events already shown, in order. */
  eventHistory: string[];
  /** Number of unexpected problems so far (problem events + gambles that went wrong). */
  problems: number;
  ledger: LedgerEntry[];
  completed: boolean; // the job got finished
  failure: FailureReason | null; // or the game ended badly
}

/** What a choice (or a failed gamble) does to the state. Every field is optional. */
export interface Effects {
  cost?: number;
  days?: number;
  stress?: number;
  risk?: number; // added to riskDebt (negative = reduce)
  plumbing?: number; // added to plumbingCondition
  electrical?: number; // added to electricalCondition
  waterDamage?: boolean; // set the flag on the house
  addFlags?: string[];
  removeFlags?: string[];
  complete?: boolean; // renovation finished
}

export interface StartOptions {
  job?: string;
  quote?: Quote;
}

export function createInitialState(opts: StartOptions = {}): GameState {
  const quote = opts.quote ?? { budget: ESTIMATE, days: ESTIMATED_DAYS };
  return {
    job: opts.job ?? 'faucet replacement',
    quote,
    budget: opts.quote ? Math.round(quote.budget * BUDGET_LIMIT_FACTOR) : BUDGET,
    maxDays: opts.quote ? Math.ceil(quote.days * DAYS_LIMIT_FACTOR) : MAX_DAYS,
    spent: 0,
    daysElapsed: 0,
    stress: 0,
    riskDebt: 0,
    house: { plumbingCondition: 40, electricalCondition: 35, waterDamage: false },
    flags: [],
    eventHistory: [],
    problems: 0,
    ledger: [],
    completed: false,
    failure: null,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const hasFlag = (s: GameState, f: string) => s.flags.includes(f);
export const flagCount = (s: GameState, f: string) => s.flags.filter((x) => x === f).length;
export const isOver = (s: GameState) => s.completed || s.failure !== null;

/** Apply effects and return a NEW state. The input is never mutated. */
export function applyEffects(state: GameState, fx: Effects, label: string): GameState {
  const cost = fx.cost ?? 0;
  const removed = new Set(fx.removeFlags ?? []);
  return {
    ...state,
    spent: state.spent + cost,
    daysElapsed: state.daysElapsed + (fx.days ?? 0),
    stress: clamp(state.stress + (fx.stress ?? 0), 0, 100),
    riskDebt: Math.max(0, state.riskDebt + (fx.risk ?? 0)),
    house: {
      plumbingCondition: clamp(state.house.plumbingCondition + (fx.plumbing ?? 0), 0, 100),
      electricalCondition: clamp(state.house.electricalCondition + (fx.electrical ?? 0), 0, 100),
      waterDamage: fx.waterDamage ?? state.house.waterDamage,
    },
    flags: [...state.flags.filter((f) => !removed.has(f)), ...(fx.addFlags ?? [])],
    ledger: cost !== 0 ? [...state.ledger, { label, cost }] : state.ledger,
    completed: state.completed || fx.complete === true,
  };
}

/** Check the end conditions. Failure wins over completion: you can't finish with no money. */
export function checkEnd(state: GameState): GameState {
  let failure: FailureReason | null = null;
  if (state.spent >= state.budget) failure = 'budget';
  else if (state.daysElapsed > state.maxDays) failure = 'time';
  else if (state.stress >= 100) failure = 'stress';
  return failure ? { ...state, failure } : state;
}
