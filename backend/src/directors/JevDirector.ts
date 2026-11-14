import type { GameEvent } from '../engine/EventEngine';
import type { GameState } from '../engine/GameState';
import type { Rng } from '../engine/rng';
import type { DirectorInfo, InspectableDirector } from './types';

/**
 * Lets a local decision model (OpenJev) choose which event happens next.
 *
 * The model only ever sees events the engine already approved, and it only answers one
 * question: "which of these?". It cannot invent events, costs, or rule changes. If the model
 * server is down, slow, or answers with something unexpected, a fallback director picks instead
 * and the dev view says so.
 *
 * The pick is SAMPLED from the model's probabilities with the seeded rng (not argmax), so the
 * game keeps variety and a seed stays reproducible as long as the model answers the same way.
 */

const QUESTION =
  'Which candidate event should happen next to make this renovation story funnier, more surprising ' +
  'and well paced, while still following believably from the player\'s earlier choices and the ' +
  'condition of the house? Avoid piling on the same kind of event many times in a row.';

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Plain-text description of the game for the model. Exported so it can be tested. */
export function describeState(state: GameState, candidates: GameEvent[]): string {
  const flags = [...new Set(state.flags)];
  const yesNo = (b: boolean) => (b ? 'yes' : 'no');
  return [
    `DIWhy, a comedy game about do-it-yourself home renovation. The player turned down a contractor's ` +
      `quote ($${state.quote.budget}, ${state.quote.days} days) to do a ${state.job} themselves, and every decision snowballs.`,
    `So far: spent $${state.spent} (the game ends at $${state.budget}), ${state.daysElapsed} days (it ends after ${state.maxDays}), ` +
      `stress ${state.stress}/100, risk debt ${state.riskDebt} (shortcuts raise it, and high risk makes disasters likelier).`,
    `House: plumbing ${state.house.plumbingCondition}/100, electrical ${state.house.electricalCondition}/100, ` +
      `water damage: ${yesNo(state.house.waterDamage)}.`,
    `Story flags: ${flags.length ? flags.join(', ') : 'none'}.`,
    `Events so far, in order: ${state.eventHistory.length ? state.eventHistory.join(', ') : 'none'}.`,
    `Candidate events:`,
    ...candidates.map((e) => `- ${e.id} (${e.kind}): ${e.title}. ${e.description}`),
  ].join('\n');
}

/** Pick one candidate by probability. `probs` need not sum to 1. */
export function sampleByProbability(candidates: GameEvent[], probs: number[], rng: Rng): GameEvent {
  const total = probs.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= probs[i];
    if (roll < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export class JevDirector implements InspectableDirector {
  readonly name = 'jev';
  lastInfo?: DirectorInfo;

  /**
   * @param url       the /v1/systemone endpoint. In the browser use the Vite proxy path.
   * @param fallback  director used when the model can't answer
   */
  constructor(
    private rng: Rng,
    private fallback: InspectableDirector,
    private url = '/jev/v1/systemone',
    private timeoutMs = 30_000,
    private fetchFn: FetchFn = (u, i) => fetch(u, i),
  ) {}

  async selectEvent(state: GameState, candidates: GameEvent[]): Promise<GameEvent> {
    if (candidates.length === 1) {
      this.lastInfo = { note: 'Only one candidate, no model call.' };
      return candidates[0];
    }

    const started = Date.now();
    let call: Awaited<ReturnType<JevDirector['ask']>> | undefined;
    try {
      call = await this.ask(state, candidates);
      let roll = 0;
      const picked = sampleByProbability(
        candidates,
        candidates.map((c) => call!.probs[c.id]),
        () => (roll = this.rng()),
      );
      this.lastInfo = {
        probabilities: call.probs,
        latencyMs: Date.now() - started,
        trace: { request: call.body, response: call.data, roll, pickedId: picked.id },
      };
      return picked;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const picked = await this.fallback.selectEvent(state, candidates);
      this.lastInfo = {
        fallback: true,
        note: `Model unavailable, used ${this.fallback.name} fallback: ${message}`,
        latencyMs: Date.now() - started,
        trace: {
          request: call?.body ?? this.buildBody(state, candidates),
          response: call?.data ?? (err as { data?: unknown })?.data,
          pickedId: picked.id,
          error: message,
        },
      };
      return picked;
    }
  }

  /** The exact request body sent to the model. */
  private buildBody(state: GameState, candidates: GameEvent[]) {
    const criteria: Record<string, null> = {};
    candidates.forEach((c) => (criteria[c.id] = null));
    return {
      state: describeState(state, candidates),
      questions: { next_event: { type: 'choice', instructions: QUESTION, criteria } },
    };
  }

  /** Ask the model one `choice` question. Returns a probability for every candidate id. */
  private async ask(
    state: GameState,
    candidates: GameEvent[],
  ): Promise<{ probs: Record<string, number>; body: unknown; data: unknown }> {
    const body = this.buildBody(state, candidates);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const raw = data?.answers?.next_event?.probabilities as Record<string, unknown> | undefined;
      if (!raw || typeof raw !== 'object') throw Object.assign(new Error('response had no probabilities'), { data });

      // Validate: every candidate must have a usable number. Anything else means we don't trust it.
      const probs: Record<string, number> = {};
      for (const c of candidates) {
        const p = Number(raw[c.id]);
        if (!Number.isFinite(p) || p < 0) throw Object.assign(new Error(`bad probability for ${c.id}`), { data });
        probs[c.id] = p;
      }
      if (Object.values(probs).reduce((a, b) => a + b, 0) <= 0) {
        throw Object.assign(new Error('all probabilities were zero'), { data });
      }
      return { probs, body, data };
    } finally {
      clearTimeout(timer);
    }
  }
}
