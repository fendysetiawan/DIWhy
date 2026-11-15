// Character select: everyone on stage. Pick with the mouse or the arrow keys (they emote and say their line),
// then START, Enter, or pick them again.

import pop from '@audio/ui/pop.wav';
import music from '@audio/music/select.mp3';
import { Screen } from '../engine/Screen';
import { CHARACTERS, type CharacterData } from '../state/characters';

export class Select extends Screen {
  static key = 'Select';
  static override playable = false;

  private chosen: CharacterData = CHARACTERS[Math.floor(CHARACTERS.length / 2)]; // the middle one, to start
  private starting = false;

  create() {
    this.sound.playMusic(music);
    this.el.classList.add('select');
    this.el.innerHTML = `
      <h1 class="title">PICK YOUR DIY-ER</h1>
        <div class="characters" role="radiogroup" aria-label="Characters" data-silent>
          ${CHARACTERS.map(
            (c) => `
            <button class="pick" type="button" role="radio" aria-checked="${c === this.chosen}" aria-label="${c.name}" data-id="${c.id}">
              <img src="${c.still}" alt="" />
            </button>`,
          ).join('')}
        </div>
      <div class="actions"><button class="button start" type="button">START</button></div>`;

    const row = this.el.querySelector('.characters');
    row?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pick');
      if (btn) this.pickCharacter(btn);
    });
    // a soft tick as the mouse moves onto someone
    row?.addEventListener('pointerover', (e: Event) => {
      const btn = (e.target as HTMLElement).closest('.pick');
      const from = ((e as PointerEvent).relatedTarget as HTMLElement | null)?.closest('.pick');
      if (btn && btn !== from) this.sound.play(pop, 0.25);
    });
    this.el.querySelector('.start')?.addEventListener('click', () => this.startGame());

    this.controls.onAction('left', () => this.pickNext(-1));
    this.controls.onAction('up', () => this.pickNext(-1));
    this.controls.onAction('right', () => this.pickNext(1));
    this.controls.onAction('down', () => this.pickNext(1));
    this.controls.onAction('confirm', () => this.startGame());
    this.showChosen('instant');
  }

  /** Scroll the chosen one into the middle (on a phone, everyone's in one row you swipe). */
  private showChosen(behavior: ScrollBehavior): void {
    this.el.querySelector('.pick[aria-checked="true"]')?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
  }

  /** Arrow keys: pick the previous or next character, wrapping around. */
  private pickNext(step: number) {
    const buttons = [...this.el.querySelectorAll<HTMLButtonElement>('.pick')];
    const i = CHARACTERS.indexOf(this.chosen);
    const next = buttons[(i + step + buttons.length) % buttons.length];
    if (next) this.pickCharacter(next);
  }

  /** Pick the character on this button: they emote and say their line; everyone else stands still. */
  private pickCharacter(btn: HTMLButtonElement) {
    if (btn.getAttribute('aria-checked') === 'true') return this.startGame(); // picking them again: let's go
    this.el.querySelectorAll<HTMLButtonElement>('.pick').forEach((b, i) => {
      const picked = b === btn;
      b.setAttribute('aria-checked', String(picked));
      const img = b.querySelector('img');
      if (picked) this.chosen = CHARACTERS[i];
      if (!img) return;
      if (picked) showEmote(img, CHARACTERS[i].emote);
      else img.src = CHARACTERS[i].still;
    });
    this.sound.say(this.chosen.voice('emote'));
    this.showChosen('smooth');
  }

  /** A new game on the server, then on to the house falling. */
  private async startGame() {
    if (this.starting) return;
    this.starting = true;
    this.sound.say(this.chosen.voice('emote'));
    await this.game.session.startGame(this.chosen.id);
    this.open('House');
  }
}

/** Load the emote first, then swap it in, so there's no blank frame. A fresh URL restarts the animation. */
function showEmote(img: HTMLImageElement, src: string) {
  const next = new Image();
  next.onload = () => {
    img.src = next.src;
  };
  next.src = `${src}?v=${Date.now()}`;
}
