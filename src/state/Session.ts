// Your session with the game on the server: it starts the game, sends what you do (sign, reply, read, a job's steps),
// and keeps GameState up to date (asking every few seconds while you play). The rules all live on the server (its
// GameMode); the calls to its API (server/routes.ts) are at the bottom.

import { type Action, CLOCK_SPEED, type CharacterId, type Contact, type Update } from '../../shared/game';
import type { GameState } from './GameState';

const ASK_EVERY = 3; // seconds between asking the server for news
const ANSWER_DUE = 1.8; // seconds after you reply: their answer should be in

export class Session {
  private askIn = ASK_EVERY;
  private recovering = false;

  constructor(private readonly state: GameState) {}

  /** A new game, playing `player`. */
  async startGame(player: CharacterId): Promise<void> {
    const { game, happened } = await createGame(player);
    this.state.apply(game, happened);
  }

  /** You signed the contract. */
  sign(name: string): void {
    this.send({ type: 'sign', name });
  }

  /** You reply in a chat; their answer comes in a moment. */
  reply(to: Contact, text: string): void {
    this.send({ type: 'reply', to, text });
    this.askIn = ANSWER_DUE;
  }

  /** Take on a job. */
  startJob(job: string): void {
    this.send({ type: 'startJob', job });
  }

  /** Do the job's next step (done once the server has answered). */
  work(job: string): Promise<void> {
    return this.send({ type: 'work', job });
  }

  /** Answer the surprise: option 0, 1 or 2 (done once the server has answered). */
  choose(job: string, option: number): Promise<void> {
    return this.send({ type: 'choose', job, option });
  }

  /** Watch a job's WeTube video (done once the server has answered). */
  watch(job: string): Promise<void> {
    return this.send({ type: 'watch', job });
  }

  /** Ask AskBot about a job (done once the server has answered). */
  ask(job: string): Promise<void> {
    return this.send({ type: 'ask', job });
  }

  /** Give up: the contractor takes over (their bill arrives with the answer). */
  giveUp(): Promise<void> {
    return this.send({ type: 'giveUp' });
  }

  /** Buy a tool at the store: option 0, 1 or 2 (done once the server has answered). */
  buy(tool: string, option: number): Promise<void> {
    return this.send({ type: 'buy', tool, option });
  }

  /** You read a chat. */
  read(contact: Contact): void {
    if (this.state.chats[contact]?.unread) this.send({ type: 'read', contact });
  }

  /** Every frame while you're playing: the clock runs, and every few seconds, ask the server what's new. */
  update(dt: number): void {
    if (!this.state.id) return;
    if (!this.state.playing) {
      this.state.playing = true; // say it once
      this.send({ type: 'play' });
    }
    this.state.passTime(dt * CLOCK_SPEED);
    this.askIn -= dt;
    if (this.askIn <= 0) {
      this.askIn = ASK_EVERY;
      const id = this.state.id;
      fetchGame(id).then(({ game, happened }) => this.state.apply(game, happened), (e) => this.recover(e));
    }
  }

  private send(action: Action): Promise<void> {
    const id = this.state.id;
    if (!id) return Promise.resolve();
    return sendAction(id, action).then(({ game, happened }) => this.state.apply(game, happened), (e) => this.recover(e));
  }

  /** The server forgot the game (it restarted): start a new one as the same character, and keep playing. */
  private recover(error: unknown): void {
    if (!(error instanceof ApiError) || error.status !== 404 || !this.state.player || this.recovering) {
      console.warn(error);
      return;
    }
    this.recovering = true;
    this.startGame(this.state.player.id)
      .then(() => this.send({ type: 'play' }))
      .finally(() => {
        this.recovering = false;
      });
  }
}

// ─── the API: each call answers with the game as it is now, and what just happened ───

function createGame(player: CharacterId): Promise<Update> {
  return request('POST', '/api/games', { player });
}

function fetchGame(id: string): Promise<Update> {
  return request('GET', `/api/games/${id}`);
}

function sendAction(id: string, action: Action): Promise<Update> {
  return request('POST', `/api/games/${id}/actions`, { action });
}

/** The server said no: its status (404: no such game). */
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(method: string, url: string, body?: unknown): Promise<Update> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, `${method} ${url}: ${res.status}`);
  return res.json();
}
