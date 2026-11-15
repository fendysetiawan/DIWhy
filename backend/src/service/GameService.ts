// The backend's core. Transport-agnostic: HTTP, a CLI or a test can all call it the same way.
//
//   listProjects()    the jobs a player can take on
//   createGame()      start a game on one of them
//   getGame()         look at it
//   choose()          make a choice, then the director picks what happens next
//   requestQuote()    ask the contractor for an updated quote
//   payment()         answer the bank about the latest charge
//   phone()           write a text (and reply buttons) for someone in the cast, with the local model
//   deleteGame()      throw it away
//
// Every game method returns a GameView (see types.ts). Games are stored as plain JSON records, so
// the service holds no per-game state in memory and can sit on any GameStore.

import { JevDirector } from '../directors/JevDirector';
import { readInfo, resetInfo } from '../directors/types';
import { builtInProjects, type Project } from '../content/projects';
import {
  MAX_EVENTS,
  applyChoice,
  eligibleEvents,
  nextEvent,
  type EventDirector,
  type GameEvent,
} from '../engine/EventEngine';
import { applyEffects, checkEnd, createInitialState, isOver } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { buildReport } from '../engine/report';
import { createRng, type StatefulRng } from '../engine/rng';
import { adviceFor } from './advice';
import { CHARACTER_IDS, ROLES, dealCast } from './cast';
import { badRequest, conflict, notFound } from './errors';
import { contextOf, cleanThread, writeText } from './phone';
import { PhoneModel, type PhoneModelOptions } from './phoneModel';
import { MemoryGameStore, type GameRecord, type GameStore } from './store';
import type {
  ChooseRequest,
  CreateGameRequest,
  DirectorName,
  EventView,
  GameView,
  HealthView,
  PaymentRequest,
  PhoneRequest,
  PhoneView,
  PoolEntry,
  ProjectView,
  Quote,
  RequestOptions,
} from './types';

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface ServiceOptions {
  store?: GameStore;
  /** Where the Jev model server lives. Leave out to disable the `jev` director. */
  jev?: { url: string; timeoutMs?: number; fetch?: FetchFn };
  /** The local model that writes the phone texts (Qwen3 8B through Ollama). Leave out to use only the built-in texts. */
  phone?: PhoneModelOptions;
  /**
   * The playable projects. Pass a function to read them fresh for each new game, so edited event
   * files apply without a restart. Defaults to the built-in bathroom project.
   */
  projects?: Project[] | (() => Project[]);
  now?: () => number;
  newId?: () => string;
}

const MAX_SEED = 4294967295;
/** The partner is unhappy about the thing they care about being over the quote. */
const PARTNER_NAG_STRESS = 4;
/** Telling the bank "No, block it" about a real purchase costs a day and some nerves. */
const BLOCKED_CARD_STRESS = 5;

const round50 = (n: number) => Math.round(n / 50) * 50;

export class GameService {
  private store: GameStore;
  private jev?: ServiceOptions['jev'];
  private phoneModel?: PhoneModel;
  private getProjects: () => Project[];
  private now: () => number;
  private newId: () => string;
  private locks = new Map<string, Promise<unknown>>();

  constructor(opts: ServiceOptions = {}) {
    this.store = opts.store ?? new MemoryGameStore();
    this.jev = opts.jev;
    this.phoneModel = opts.phone ? new PhoneModel(opts.phone) : undefined;
    const projects = opts.projects ?? builtInProjects();
    this.getProjects = typeof projects === 'function' ? projects : () => projects;
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? (() => crypto.randomUUID());
  }

  health(): HealthView {
    return { status: 'ok', directors: { random: true, jev: Boolean(this.jev) }, phone: Boolean(this.phoneModel) };
  }

  listProjects(): ProjectView[] {
    return this.getProjects().map(({ id, title, job, blurb, fromPlan, quote }) => ({ id, title, job, blurb, fromPlan, quote }));
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
    if (req.owner !== undefined && !CHARACTER_IDS.includes(req.owner)) {
      throw badRequest('invalid_owner', `owner must be one of: ${CHARACTER_IDS.join(', ')}`);
    }
    const projects = this.getProjects();
    const project = req.project === undefined ? projects[seed % projects.length] : projects.find((p) => p.id === req.project);
    if (!project) {
      throw badRequest('invalid_project', `project must be one of: ${projects.map((p) => p.id).join(', ')}`);
    }

    const now = this.now();
    const rec: GameRecord = {
      id: this.newId(),
      seed,
      director,
      projectId: project.id,
      cast: dealCast(seed, req.owner),
      quoteCurrent: project.quote,
      charge: null,
      chargeSeq: 0,
      outcome: null,
      state: createInitialState({ job: project.job, quote: project.quote }),
      rngState: seed, // a fresh generator starts at its seed
      eventId: null,
      log: [],
      decisions: [],
      last: { pool: [], forced: false },
      createdAt: now,
      updatedAt: now,
    };
    await this.pickNext(rec, project, createRng(rec.rngState));
    await this.store.set(rec);
    return this.toView(rec, project, opts);
  }

  async getGame(id: string, opts: RequestOptions = {}): Promise<GameView> {
    const rec = await this.load(id);
    return this.toView(rec, this.projectOf(rec), opts);
  }

  async choose(id: string, req: ChooseRequest, opts: RequestOptions = {}): Promise<GameView> {
    return this.withLock(id, async () => {
      const rec = await this.load(id);
      const project = this.projectOf(rec);
      if (isOver(rec.state) || !rec.eventId) throw conflict('game_over', 'this game has ended');
      if (req.eventId !== undefined && req.eventId !== rec.eventId) {
        throw conflict('stale_event', `the current event is "${rec.eventId}", not "${req.eventId}"`);
      }
      const event = this.eventOf(project, rec.eventId);
      if (!Number.isInteger(req.choice) || req.choice < 0 || req.choice >= event.choices.length) {
        throw badRequest('invalid_choice', `choice must be an integer from 0 to ${event.choices.length - 1}`);
      }

      const before = rec.state;
      const rng = createRng(rec.rngState);
      const result = applyChoice(before, event, req.choice, rng);
      let next = result.state;
      rec.log = [...result.log.slice().reverse(), ...rec.log].slice(0, 12);

      // The partner is unhappy while the thing they care about is over the contractor's quote.
      let partnerNagged = false;
      if (!isOver(next)) {
        const over = rec.cast.partnerFocus === 'budget' ? next.spent > next.quote.budget : next.daysElapsed > next.quote.days;
        if (over) {
          next = checkEnd(applyEffects(next, { stress: PARTNER_NAG_STRESS }, 'The partner'));
          partnerNagged = true;
        }
      }
      rec.state = next;

      // Anything that cost money is a charge the bank will ask the player about.
      const cost = next.spent - before.spent;
      const choice = event.choices[req.choice];
      rec.charge = cost > 0 ? { id: ++rec.chargeSeq, amount: cost, what: choice.label.toLowerCase(), status: 'pending' } : null;
      rec.outcome = {
        eventId: event.id,
        choice: req.choice,
        quality: choice.quality ?? null,
        blewUp: result.gambleHit,
        cost: Math.max(0, cost),
        days: next.daysElapsed - before.daysElapsed,
        partnerNagged,
      };

      if (isOver(next)) {
        this.endGame(rec, rng);
      } else {
        await this.pickNext(rec, project, rng);
      }
      rec.updatedAt = this.now();
      await this.store.set(rec);
      return this.toView(rec, project, opts);
    });
  }

  /** The contractor re-quotes. They only ever go up, as problems turn up. The original never changes. */
  async requestQuote(id: string, opts: RequestOptions = {}): Promise<GameView> {
    return this.withLock(id, async () => {
      const rec = await this.load(id);
      const project = this.projectOf(rec);
      const { quote, problems } = rec.state;
      const asked: Quote = {
        budget: round50(quote.budget * (1 + 0.12 * problems)),
        days: quote.days + Math.ceil(problems * 0.5),
      };
      rec.quoteCurrent = {
        budget: Math.max(rec.quoteCurrent.budget, asked.budget),
        days: Math.max(rec.quoteCurrent.days, asked.days),
      };
      rec.updatedAt = this.now();
      await this.store.set(rec);
      return this.toView(rec, project, opts);
    });
  }

  /**
   * Answer the bank about the latest charge. Confirming changes nothing. Blocking your own card
   * costs a day and some nerves; the charge still stands. Answering twice does nothing more.
   */
  async payment(id: string, req: PaymentRequest, opts: RequestOptions = {}): Promise<GameView> {
    return this.withLock(id, async () => {
      const rec = await this.load(id);
      const project = this.projectOf(rec);
      if (typeof req.confirm !== 'boolean') throw badRequest('invalid_payment', 'confirm must be true or false');
      const charge = rec.charge;
      if (!charge || charge.id !== req.chargeId) {
        throw conflict('stale_charge', 'that charge is not the latest one');
      }
      if (charge.status === 'pending') {
        if (req.confirm) {
          charge.status = 'confirmed';
        } else {
          charge.status = 'blocked';
          rec.log = ['Your bank blocked the card. Sorting it out cost a day.', ...rec.log].slice(0, 12);
          const wasOver = isOver(rec.state);
          rec.state = checkEnd(applyEffects(rec.state, { days: 1, stress: BLOCKED_CARD_STRESS }, 'Card blocked'));
          if (!wasOver && isOver(rec.state)) this.endGame(rec, createRng(rec.rngState));
        }
      }
      rec.updatedAt = this.now();
      await this.store.set(rec);
      return this.toView(rec, project, opts);
    });
  }

  /**
   * Write a text from someone in the cast, with suggested replies for the player's buttons.
   * It only reads the game. The model never changes it, and a slow or missing model just means
   * `text` is null and the replies are the built-in ones.
   */
  async phone(id: string, req: PhoneRequest): Promise<PhoneView> {
    const rec = await this.load(id);
    const project = this.projectOf(rec);
    if (!ROLES.includes(req.with)) throw badRequest('invalid_role', `with must be one of: ${ROLES.join(', ')}`);
    if (req.kind !== 'advice' && req.kind !== 'reaction' && req.kind !== 'reply') {
      throw badRequest('invalid_kind', 'kind must be "advice", "reaction" or "reply"');
    }
    const thread = cleanThread(req.thread);
    if (req.kind === 'reply' && thread[thread.length - 1]?.from !== 'me') {
      throw badRequest('invalid_thread', 'a reply needs a thread that ends with a "me" turn');
    }

    const event = rec.eventId ? this.eventOf(project, rec.eventId) : null;
    let pick: number | null = null;
    if (req.kind === 'advice') {
      const advice = event ? adviceFor(event, rec.seed) : null;
      if (!event || !advice || advice.from !== req.with) {
        throw conflict('no_advice', `${req.with} has no advice about the current event`);
      }
      pick = advice.pick;
    }
    const lastEvent = rec.outcome ? this.eventOf(project, rec.outcome.eventId) : null;
    const ctx = contextOf(rec, req.with, { title: project.title, event, pick, lastEvent });
    return writeText(this.phoneModel, rec, ctx, { ...req, thread }, thread);
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

  private projectOf(rec: GameRecord): Project {
    const project = this.getProjects().find((p) => p.id === rec.projectId);
    if (!project) throw conflict('project_changed', `the project "${rec.projectId}" is no longer available; start a new game`);
    return project;
  }

  private eventOf(project: Project, id: string): GameEvent {
    const event = id === project.finale.id ? project.finale : project.events.find((e) => e.id === id);
    if (!event) throw conflict('project_changed', `the event "${id}" no longer exists; start a new game`);
    return event;
  }

  private endGame(rec: GameRecord, rng: StatefulRng): void {
    rec.eventId = null;
    rec.last = { pool: [], forced: false };
    rec.rngState = rng.state();
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
  private async pickNext(rec: GameRecord, project: Project, rng: StatefulRng): Promise<void> {
    const director = this.makeDirector(rec.director, rng);
    resetInfo(director);
    const state = rec.state;
    const candidates = eligibleEvents(state, project.events);
    const event = await nextEvent(state, project.events, director, project.finale);

    // A forced finale never asks the director, so anything it reports would be stale.
    const forced = event === project.finale;
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
  private toView(rec: GameRecord, project: Project, opts: RequestOptions): GameView {
    const s = rec.state;
    const event = rec.eventId ? this.eventOf(project, rec.eventId) : undefined;
    const advice = event ? adviceFor(event, rec.seed) : null;
    const eventView: EventView | null = event
      ? {
          id: event.id,
          kind: event.kind,
          title: event.title,
          description: event.description,
          category: event.category ?? null,
          choices: event.choices.map((c, index) => ({ index, label: c.label, cost: null, days: null })),
          advice: advice ? { from: advice.from, pick: advice.pick } : null,
        }
      : null;

    const view: GameView = {
      id: rec.id,
      seed: rec.seed,
      director: rec.director,
      project: { id: project.id, title: project.title, job: project.job },
      cast: rec.cast,
      quote: { original: s.quote, current: rec.quoteCurrent },
      charge: rec.charge,
      outcome: rec.outcome,
      status: s.failure ? 'failed' : s.completed ? 'complete' : 'playing',
      failure: s.failure,
      stats: {
        budget: s.budget,
        spent: s.spent,
        daysElapsed: s.daysElapsed,
        maxDays: s.maxDays,
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
      view.debug = {
        state: s,
        maxEvents: MAX_EVENTS,
        decisions: rec.decisions,
        last: rec.last,
        adviceReliable: advice ? advice.reliable : null,
        choiceQualities: event ? event.choices.map((c) => c.quality ?? null) : [],
      };
    }
    return view;
  }
}
