// The game's state machine: the states are the screens. One runs at a time; start() moves to another,
// fading through black (the old one's shutdown() is its exit, the new one's create() its enter).

import type { Game } from './Game';
import type { Screen, ScreenClass } from './Screen';

const FADE_MS = 600;

export class ScreenManager {
  private readonly byKey = new Map<string, ScreenClass>();
  /** The screen running now. */
  active: Screen | null = null;
  private switching = false;

  constructor(
    private readonly game: Game,
    private readonly root: HTMLElement,
    screens: ScreenClass[],
  ) {
    for (const screen of screens) this.byKey.set(screen.key, screen);
  }

  /** Fade out the active screen, then create the one called `key`, passing it `data`. */
  async start(key: string, data?: unknown): Promise<void> {
    const Next = this.byKey.get(key);
    if (!Next) throw new Error(`No screen called "${key}"`);
    if (this.switching) return; // one change at a time
    this.switching = true;

    const old = this.active;
    this.active = null;
    if (old) {
      old.destroy();
      old.el.classList.add('out');
      await new Promise((resolve) => setTimeout(resolve, FADE_MS));
      old.el.remove();
    }

    const screen = new Next(this.game);
    screen.el = document.createElement('main');
    screen.el.className = 'screen';
    this.root.append(screen.el);
    this.active = screen;
    this.switching = false;
    screen.create(data);
  }

  /** In a screen you play (not the intro or the end). */
  get playing(): boolean {
    return !!this.active && (this.active.constructor as ScreenClass).playable;
  }

  /** Called every frame by the loop. */
  update(dt: number): void {
    this.active?.update(dt);
  }
}
