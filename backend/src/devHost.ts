// The contract between the app (main.ts) and the dev tools (src/dev). Types only.
// main.ts implements it and hands it to the dev tools when dev mode is switched on.

import type { DirectorName, GameView } from './service/types';

export interface DevHost {
  /** The game currently shown, or null before the first one loads. */
  game(): GameView | null;
  /** True while a request to the backend is in flight. */
  busy(): boolean;
  /** Be told whenever the game or busy state changes. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
  /** Start a fresh game with the same seed under a different director. */
  setDirector(name: DirectorName): Promise<void>;
}
