// Where games live between requests. The service only talks to the GameStore interface,
// so swapping memory for a database means writing one small class.

import type { GameState } from '../engine/GameState';
import type { DecisionRecord, DirectorName, LastDecision } from './types';

/** Everything needed to resume a game. Plain JSON, so any store can persist it as-is. */
export interface GameRecord {
  id: string;
  seed: number;
  director: DirectorName;
  state: GameState;
  rngState: number; // createRng(rngState) continues the exact random sequence
  eventId: string | null; // the event on screen, null once the game is over
  log: string[];
  decisions: DecisionRecord[];
  last: LastDecision;
  createdAt: number;
  updatedAt: number;
}

export interface GameStore {
  get(id: string): Promise<GameRecord | undefined>;
  set(record: GameRecord): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface MemoryStoreOptions {
  maxGames?: number; // oldest games are dropped beyond this. Default 1000.
  ttlMs?: number; // games idle longer than this are dropped. Default 6 hours.
  now?: () => number;
}

/** In-process store with a size cap and an idle timeout, so memory can't grow forever. */
export class MemoryGameStore implements GameStore {
  private games = new Map<string, GameRecord>(); // insertion order = least recently updated first
  private maxGames: number;
  private ttlMs: number;
  private now: () => number;

  constructor(opts: MemoryStoreOptions = {}) {
    this.maxGames = opts.maxGames ?? 1000;
    this.ttlMs = opts.ttlMs ?? 6 * 60 * 60 * 1000;
    this.now = opts.now ?? Date.now;
  }

  async get(id: string): Promise<GameRecord | undefined> {
    const rec = this.games.get(id);
    if (rec && this.now() - rec.updatedAt > this.ttlMs) {
      this.games.delete(id);
      return undefined;
    }
    return rec;
  }

  async set(record: GameRecord): Promise<void> {
    this.games.delete(record.id); // re-insert so it counts as most recently used
    this.games.set(record.id, record);
    const cutoff = this.now() - this.ttlMs;
    for (const [id, rec] of this.games) {
      if (rec.updatedAt < cutoff || this.games.size > this.maxGames) this.games.delete(id);
      else break; // everything after this is newer
    }
  }

  async delete(id: string): Promise<boolean> {
    return this.games.delete(id);
  }

  get size(): number {
    return this.games.size;
  }
}
