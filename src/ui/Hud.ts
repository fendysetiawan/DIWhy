// The HUD: what stays on top of every screen. The settings button (top right); once you're playing, the meters
// (top), the to-do list (left) and the phone (bottom right). Every button press, anywhere, clicks and dips.

import click from '@audio/ui/click.wav';
import type { Game } from '../engine/Game';
import { Phone } from './Phone';
import { Menu } from './Menu';
import { Meters } from './Meters';
import { Toasts } from './Toast';
import { ToDo } from './ToDo';

const PRESS_MS = 120;

export class Hud {
  readonly phone: Phone;
  readonly menu: Menu;
  private readonly meters: Meters;
  private readonly todo: ToDo;

  constructor(private readonly game: Game) {
    this.menu = new Menu(game);
    this.meters = new Meters(game.state, game.sound);
    this.todo = new ToDo(game);
    this.phone = new Phone(game, new Toasts());
    document.addEventListener('click', (e) => this.pressButton(e), true);
  }

  /** Every frame: the meters and the phone show once you're playing (not in the intro or the end). */
  update(): void {
    const playing = this.game.screens.playing;
    this.meters.setShown(playing);
    this.todo.setShown(playing);
    this.phone.setShown(playing);
  }

  /** The game waits while you use the phone, the to-do list or the menu. */
  get isBusy(): boolean {
    return this.phone.isUp || this.todo.isUp || this.menu.isOpen;
  }

  /** A button was pressed (mouse, tap, Enter or Space): a click, and it dips, so a press always shows. */
  private pressButton(e: Event): void {
    const button = (e.target as HTMLElement).closest('button');
    if (!button || button.disabled || button.closest('[data-silent]')) return;
    this.game.sound.play(click, 0.35);
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), PRESS_MS);
  }
}
