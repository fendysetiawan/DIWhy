// A popover: a button in a corner that opens a panel over the game (the phone, the to-do list). They all work the
// same: its key or the button opens it; the ✕, Esc, or a click outside closes it; the game dims and waits while it's
// open; opening one closes any other. A popover only says what's in its panel (render).

import type { Action } from '../engine/ControlsManager';
import type { Game } from '../engine/Game';

/** Every popover, so opening one can close the others. */
const ALL: Popover[] = [];
/** One dimmer behind whichever is open; a click on it closes it. */
const scrim = document.createElement('div');
scrim.className = 'scrim';
scrim.addEventListener('click', () => {
  for (const p of ALL) p.setOpen(false);
});
document.body.append(scrim);

export abstract class Popover {
  /** Its panel. */
  readonly el = document.createElement('section');
  /** Its button, in a corner. */
  protected readonly button = document.createElement('button');
  private open = false;
  private shown = false;
  private readonly sounds?: { open: string; close: string };

  constructor(
    protected readonly game: Game,
    options: { name: string; key: Action; sounds?: { open: string; close: string } },
  ) {
    this.sounds = options.sounds;
    this.el.className = `popover ${options.name}`;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a "press any key"
    this.button.type = 'button';
    this.button.className = `button icon-button ${options.name}-button`;
    this.button.hidden = true;
    this.button.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });
    document.body.append(this.el, this.button);
    game.controls.onAction(options.key, () => this.setOpen(!this.open));
    game.controls.onAction('back', () => this.setOpen(false));
    ALL.push(this);
  }

  /** Open: you're using it (the game waits). */
  get isUp(): boolean {
    return this.open;
  }

  /** Its button is showing (you're playing). */
  protected get isShown(): boolean {
    return this.shown;
  }

  /** Show its button (once you're playing), or hide it all (the intro, the end). */
  setShown(shown: boolean): void {
    if (shown === this.shown) return;
    this.shown = shown;
    this.button.hidden = !shown;
    if (!shown) this.setOpen(false);
  }

  /** Open it (closing any other) or close it. */
  setOpen(open: boolean): void {
    if (open === this.open || (open && !this.shown)) return;
    if (open) for (const p of ALL) if (p !== this) p.setOpen(false);
    this.open = open;
    if (this.sounds) this.game.sound.play(open ? this.sounds.open : this.sounds.close, 0.4);
    this.el.classList.toggle('up', open);
    this.button.classList.toggle('up', open);
    scrim.classList.toggle('show', ALL.some((p) => p.open));
    this.render();
    if (open) this.onOpen();
  }

  /** Just opened (focus something, clear toasts…). */
  protected onOpen(): void {}

  /** Draw the panel and the button (its badge). */
  protected abstract render(): void;
}
