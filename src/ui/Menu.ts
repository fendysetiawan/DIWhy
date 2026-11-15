// The settings menu: a gear button top right opens it. Sound on or off, give up (asks once to be sure; the contractor
// takes over), back.
// The game waits while it's open.

import settingsIcon from '@art/icons/settings.svg?raw';
import soundOff from '@art/icons/sound-off.svg';
import soundOn from '@art/icons/sound-on.svg';
import type { Game } from '../engine/Game';


export class Menu {
  private readonly button = document.createElement('button');
  private readonly el = document.createElement('div');
  private open = false;
  /** GIVE UP was pressed once: the next press gives up. */
  private sure = false;

  constructor(private readonly game: Game) {
    this.button.type = 'button';
    this.button.className = 'button quiet icon-button menu-button'; // out of the way: faint until you point at it
    this.button.setAttribute('aria-label', 'Settings');
    this.button.innerHTML = settingsIcon;
    this.button.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a "press any key"
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });
    this.el.className = 'menu';
    this.el.hidden = true;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.handleClick(e));
    game.controls.onAction('back', () => this.open && this.setOpen(false));
    document.body.append(this.el, this.button);
  }

  /** Open: the game waits. */
  get isOpen(): boolean {
    return this.open;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.sure = false;
    this.el.hidden = !open;
    if (open) {
      this.render();
      this.el.querySelector('button')?.focus();
    }
  }

  private handleClick(e: Event): void {
    e.stopPropagation();
    const what = (e.target as HTMLElement).closest('button')?.dataset.do;
    if (what === 'sound') this.toggleSound();
    else if (what === 'giveUp') this.giveUp();
    else if (what === 'back' || e.target === this.el) this.setOpen(false);
  }

  private toggleSound(): void {
    const muted = !this.game.settings.muted;
    this.game.settings.muted = muted;
    this.game.sound.setMuted(muted);
    this.render();
  }

  /** The first press asks; the second gives up: the contractor takes over, and their bill ends the game. */
  private giveUp(): void {
    if (!this.sure) {
      this.sure = true;
      this.render();
      this.el.querySelector<HTMLButtonElement>('[data-do="giveUp"]')?.focus();
      return;
    }
    this.setOpen(false);
    this.game.giveUp();
  }

  private render(): void {
    const muted = this.game.settings.muted;
    const playing = this.game.screens.playing;
    this.el.innerHTML = `
      <div class="menu-card" role="dialog" aria-label="Settings">
        <h2 class="title">SETTINGS</h2>
        <button class="button" type="button" data-do="sound"><img src="${muted ? soundOff : soundOn}" alt="" />SOUND ${muted ? 'OFF' : 'ON'}</button>
        ${playing ? `<button class="button${this.sure ? ' danger' : ''}" type="button" data-do="giveUp">${this.sure ? 'SURE? CALL THE CONTRACTOR' : 'GIVE UP'}</button>` : ''}
        <button class="button secondary" type="button" data-do="back">BACK</button>
      </div>`;
  }
}
