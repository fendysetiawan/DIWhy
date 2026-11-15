// A screen: one state of the game (a menu, a cinematic, a level you walk around). Every screen extends this:
// create(data) to start, update(dt) every frame, shutdown() to clean up.

import type { Action } from './ControlsManager';
import type { Change } from '../state/GameState';
import type { Game } from './Game';

export type ScreenClass = (new (game: Game) => Screen) & { key: string; playable: boolean };

export abstract class Screen {
  /** The screen's name, used by this.open('Name'). */
  static key: string;

  /** A screen you play in (the meters and phone show); false for the intro and the end screens. */
  static playable = true;


  /** This screen's name (its class's key). */
  get key(): string {
    return (this.constructor as ScreenClass).key;
  }

  /** The screen's own full-window element. */
  el!: HTMLElement;

  private cleanups: (() => void)[] = [];
  private leaving = false;

  constructor(protected readonly game: Game) {}

  abstract create(data?: unknown): void;
  update(_dt: number): void {}
  shutdown(): void {}

  /** Go to another screen, like Unreal's OpenLevel: e.g. this.open('Yard'). */
  protected open(key: string, data?: unknown): void {
    if (this.leaving) return; // only the first one counts
    this.leaving = true;
    this.game.screens.start(key, data);
  }

  /** Keys, clicks and taps, removed when the screen ends. */
  protected readonly controls = {
    onAnyKey: (fn: () => void) => this.cleanUpLater(this.game.controls.onAnyKey(fn)),
    onAction: (action: Action, fn: () => void) => this.cleanUpLater(this.game.controls.onAction(action, fn)),
    isDown: (action: Action) => this.game.controls.isDown(action),
  };

  /** Call `fn` when the game changes (GameState), until the screen ends. */
  protected onChange(change: Change, fn: () => void): void {
    this.cleanUpLater(this.game.state.subscribe(change, fn));
  }

  /** Timers, cleared when the screen ends. */
  protected readonly time = {
    delay: (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      this.cleanUpLater(() => clearTimeout(id));
    },
  };

  /** Sound effects, voices and music. */
  get sound() {
    return this.game.sound;
  }

  /** The player's preferences, kept between visits (sound, your name). */
  protected get settings() {
    return this.game.settings;
  }

  /** This playthrough's state (the chosen character, and later money, days, the job). */
  get state() {
    return this.game.state;
  }

  /** A skip button for cinematics, first in the bottom button row: e.g. this.addSkipButton('SKIP INTRO', 'Contract'). */
  protected addSkipButton(label: string, to: string): void {
    let row = this.el.querySelector('.actions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'actions';
      this.el.append(row);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary'; // skipping is the other choice, not the main one
    button.textContent = label;
    button.addEventListener('click', () => this.open(to));
    row.prepend(button);
    button.focus(); // Enter skips
  }

  /** Arrow keys move between the buttons in the bottom row (Enter presses the one you're on). */
  protected useArrowsOnButtons(): void {
    const move = (step: number) => {
      if (this.game.hud.isBusy) return; // the phone or the menu has the keys
      const buttons = [...this.el.querySelectorAll<HTMLButtonElement>('.actions button:not(:disabled)')];
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[i < 0 ? 0 : (i + step + buttons.length) % buttons.length]?.focus();
    };
    this.controls.onAction('left', () => move(-1));
    this.controls.onAction('up', () => move(-1));
    this.controls.onAction('right', () => move(1));
    this.controls.onAction('down', () => move(1));
  }

  /** Called by the screen manager. */
  destroy(): void {
    this.shutdown();
    for (const stop of this.cleanups.splice(0)) stop();
  }

  private cleanUpLater(stop: () => void): void {
    this.cleanups.push(stop);
  }
}
