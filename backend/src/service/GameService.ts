// The backend's core. Transport-agnostic: HTTP, a CLI or a test can all call it the same way.
//
//   createGame()  -> start a game
//   getGame()     -> look at it
//   choose()      -> make a choice, then the director picks what happens next
//   deleteGame()  -> throw it away
//
// Every method returns a GameView (see types.ts). Games are stored as plain JSON records, so
// the service holds no per-game state in memory and can sit on any GameStore.

import { EVENTS, FINALE } from '../data/events';
import { JevDirector } from '../directors/JevDirector';
import { readInfo, resetInfo } from '../directors/types';
import {
  MAX_EVENTS,
  applyChoice,
  eligibleEvents,
  nextEvent,
  type EventDirector,
  type GameEvent,
} from '../engine/EventEngine';
import { MAX_DAYS, createInitialState, isOver } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { buildReport } from '../engine/report';
import { createRng, type StatefulRng } from '../engine/rng';
import { badRequest, conflict, notFound } from './errors';
import { MemoryGameStore, type GameRecord, type GameStore } from './store';
import type {
  ChooseRequest,
  CreateGameRequest,
  DirectorName,
  EventView,
  GameView,
  HealthView,
  PoolEntry,
  RequestOptions,
} from './types';

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface ServiceOptions {
  store?: GameStore;
  /** Where the Jev model server lives. Leave out to disable the `jev` director. */
  jev?: { url: string; timeoutMs?: number; fetch?: FetchFn };
  now?: () => number;
  newId?: () => string;
}

const EVENT_BY_ID = new Map<string, GameEvent>([...EVENTS, FINALE].map((e) => [e.id, e]));
const MAX_SEED = 4294967295;

export class GameService {
  private store: GameStore;
  private jev?: ServiceOptions['jev'];
  private now: () => number;
  private newId: () => string;
  private locks = new Map<string, Promise<unknown>>();

  constructor(opts: ServiceOptions = {}) {
    this.store = opts.store ?? new MemoryGameStore();
    this.jev = opts.jev;
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? (() => crypto.randomUUID());
  }

  health(): HealthView {
    return { status: 'ok', directors: { random: true, jev: Boolean(this.jev) } };
  }

  async createGame(req: CreateGameRequest = {}, opts: RequestOptions = {}): Promise<GameView> {
    const seed = req.seed === undefined ? Math.floor(Math.random() * 1_000_000) : req.seed;
    if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
      throw badRequest('invalid_seed', `seed must be an integer from 0 to ${MAX_SEED}`);
    }
    const director = req.director ?? 'random';
    if (director !== 'random' && director !== 'jev') {
      throw badRequest('invalid_director', 'director must be "random" or "jev"');
    }
    if (director === 'jev' && !this.jev) {
      throw badRequest('director_unavailable', 'the jev director is not configured on this server');
    }

    const now = this.now();
    const rec: GameRecord = {
      id: this.newId(),
      seed,
      director,
      state: createInitialState(),
      rngState: seed, // a fresh generator starts at its seed
      eventId: null,
      log: [],
      decisions: [],
      last: { pool: [], forced: false },
      createdAt: now,
      updatedAt: now,
    };
    await this.pickNext(rec, createRng(rec.rngState));
    await this.store.set(rec);
    return this.toView(rec, opts);
  }

  async getGame(id: string, opts: RequestOptions = {}): Promise<GameView> {
    return this.toView(await this.load(id), opts);
  }

  async choose(id: string, req: ChooseRequest, opts: RequestOptions = {}): Promise<GameView> {
    return this.withLock(id, async () => {
      const rec = await this.load(id);
      if (isOver(rec.state) || !rec.eventId) throw conflict('game_over', 'this game has ended');
      if (req.eventId !== undefined && req.eventId !== rec.eventId) {
        throw conflict('stale_event', `the current event is "${rec.eventId}", not "${req.eventId}"`);
      }
      const event = EVENT_BY_ID.get(rec.eventId)!;
      if (!Number.isInteger(req.choice) || req.choice < 0 || req.choice >= event.choices.length) {
        throw badRequest('invalid_choice', `choice must be an integer from 0 to ${event.choices.length - 1}`);
      }

      const rng = createRng(rec.rngState);
      const result = applyChoice(rec.state, event, req.choice, rng);
      rec.state = result.state;
      rec.log = [...result.log.slice().reverse(), ...rec.log].slice(0, 12);

      if (isOver(rec.state)) {
        rec.eventId = null;
        rec.last = { pool: [], forced: false };
        rec.rngState = rng.state();
      } else {
        await this.pickNext(rec, rng);
      }
      rec.updatedAt = this.now();
      await this.store.set(rec);
      return this.toView(rec, opts);
    });
  }

  async deleteGame(id: string): Promise<void> {
    if (!(await this.store.delete(id))) throw notFound('game_not_found', `no game with id "${id}"`);
  }

  // ------------------------------------------------------------------ internals

  private async load(id: string): Promise<GameRecord> {
    const rec = await this.store.get(id);
    if (!rec) throw notFound('game_not_found', `no game with id "${id}"`);
    return rec;
  }

  /** One game handles one request at a time, so a slow model call can't be raced by a double click. */
  private async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(id) ?? Promise.resolve()).catch(() => undefined).then(fn);
    this.locks.set(id, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(id) === run) this.locks.delete(id);
    }
  }

  private makeDirector(name: DirectorName, rng: StatefulRng): EventDirector {
    const random = new RandomDirector(rng);
    if (name === 'jev' && this.jev) {
      return new JevDirector(rng, random, this.jev.url, this.jev.timeoutMs, this.jev.fetch);
    }
    return random;
  }

  /** Ask the director what happens next and record how it decided. Saves the RNG position. */
  private async pickNext(rec: GameRecord, rng: StatefulRng): Promise<void> {
    const director = this.makeDirector(rec.director, rng);
    resetInfo(director);
    const state = rec.state;
    const candidates = eligibleEvents(state, EVENTS);
    const event = await nextEvent(state, EVENTS, director, FINALE);

    // A forced finale never asks the director, so anything it reports would be stale.
    const forced = event === FINALE;
    const info = forced ? undefined : readInfo(director);

    const total = candidates.reduce((sum, e) => sum + Math.max(0, e.weight(state)), 0);
    const jevTotal = info?.probabilities ? Object.values(info.probabilities).reduce((a, b) => a + b, 0) : 0;
    const pool: PoolEntry[] = candidates.map((e) => {
      const weight = Math.max(0, e.weight(state));
      return {
        id: e.id,
        weight,
        pct: total > 0 ? (weight / total) * 100 : 0,
        jevPct: info?.probabilities && jevTotal > 0 ? (info.probabilities[e.id] / jevTotal) * 100 : undefined,
        picked: e === event,
      };
    });

    rec.eventId = event.id;
    rec.last = { pool, forced, info };
    if (info?.trace) rec.decisions = [...rec.decisions, { step: state.eventHistory.length + 1, pickedId: event.id, pool, info }];
    rec.rngState = rng.state();
  }

  /** Record -> the JSON a front end gets. Hidden consequences (effects, gambles, weights) stay out. */
  private toView(rec: GameRecord, opts: RequestOptions): GameView {
    const s = rec.state;
    const event = rec.eventId ? EVENT_BY_ID.get(rec.eventId) : undefined;
    const eventView: EventView | null = event
      ? {
          id: event.id,
          kind: event.kind,
          title: event.title,
          description: event.description,
          choices: event.choices.map((c, index) => ({
            index,
            label: c.label,
            cost: c.effects.cost ?? 0,
            days: c.effects.days ?? 0,
          })),
        }
      : null;

    const view: GameView = {
      id: rec.id,
      seed: rec.seed,
      director: rec.director,
      status: s.failure ? 'failed' : s.completed ? 'complete' : 'playing',
      failure: s.failure,
      stats: {
        budget: s.budget,
        spent: s.spent,
        daysElapsed: s.daysElapsed,
        maxDays: MAX_DAYS,
        stress: s.stress,
        riskDebt: s.riskDebt,
        problems: s.problems,
      },
      ledger: s.ledger,
      log: rec.log,
      event: eventView,
      report: isOver(s) ? buildReport(s) : null,
    };
    if (opts.debug) {
      view.debug = { state: s, maxEvents: MAX_EVENTS, decisions: rec.decisions, last: rec.last };
    }
    return view;
  }
}
