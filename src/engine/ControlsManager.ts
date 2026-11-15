// Keys, clicks and taps. Screens use it through this.controls.
// Actions name what the player means, so arrows and WASD both work: onAction('left', …).

import { CHARACTERS } from '../state/characters';
import type { Game } from './Game';
import type { ScreenClass } from './Screen';

const ACTIONS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Enter', 'Space'],
  back: ['Escape'],
  phone: ['KeyP'],
  todo: ['KeyT'],
} as const;

export type Action = keyof typeof ACTIONS;

export class ControlsManager {
  private readonly down = new Set<string>();

  constructor() {
    addEventListener('keydown', (e) => this.down.add(e.code));
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }

  /** Is this action held right now? e.g. isDown('left') while walking. */
  isDown(action: Action): boolean {
    return ACTIONS[action].some((code) => this.down.has(code));
  }

  /** Call `fn` every time the action's key is pressed. Returns a function that stops it. */
  onAction(action: Action, fn: () => void): () => void {
    const codes: readonly string[] = ACTIONS[action];
    const fire = (e: KeyboardEvent) => {
      if (!codes.includes(e.code) || isTyping(e)) return;
      if (action === 'confirm' && isOnButton(e)) return; // Enter on a focused button clicks that button
      e.preventDefault(); // no page scrolling, no double "click" on a focused button
      fn();
    };
    addEventListener('keydown', fire);
    return () => removeEventListener('keydown', fire);
  }

  /** Call `fn` once on the next key, click or tap. Returns a function that cancels it. */
  onAnyKey(fn: () => void): () => void {
    const fire = () => {
      stop();
      fn();
    };
    const stop = () => {
      removeEventListener('keydown', fire);
      removeEventListener('pointerdown', fire);
    };
    addEventListener('keydown', fire);
    addEventListener('pointerdown', fire);
    return stop;
  }

  /** Dev only: number keys jump to that screen (1 = the first). Later screens get a player so they can start. */
  addDevHotkeys(game: Game, screens: ScreenClass[]): void {
    addEventListener('keydown', async (e) => {
      const to = screens[Number(e.key) - 1];
      if (!to || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!game.state.id) await game.session.startGame(CHARACTERS[0].id);
      game.screens.start(to.key);
    });
    console.info(`Dev hotkeys: ${screens.map((s, i) => `${i + 1} ${s.key}`).join(' · ')}`);
  }
}

/** Is a button focused? Then Enter and Space press it (the browser does that), like a click. */
function isOnButton(e: KeyboardEvent): boolean {
  return (e.target as HTMLElement | null)?.tagName === 'BUTTON';
}

/** Is the player typing in a text box? Then keys are for the text, not the game. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA';
}
