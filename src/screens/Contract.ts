// The contract, the house's purchase agreement: the agent welcomes you, you read the small print, type your name on the line
// (it appears in pixel handwriting), then SIGN. Your name is saved for the rest of the game.

import houseIcon from '@art/icons/house.svg?raw';
import contractLine from '@audio/narrator/contract.mp3';
import signedLine from '@audio/narrator/contract-signed.mp3';
import music from '@audio/music/menu.mp3';
import stamp from '@audio/ui/stamp.wav';
import { Screen } from '../engine/Screen';
import { drawSignature, loadSignatureFont } from '../ui/signature';

const TERMS = [
  'SOLD AS IS. VERY IS.',
  'ROOF: MOSTLY ON',
  'BASEMENT: A POOL',
  'WIRED BY RACCOONS',
  'STAIRS: COUNT VARIES',
  'SMELLS INCLUDED',
  'DOORS CLOSE, MAYBE',
  "DON'T TOUCH SWITCH",
  'WALLS HOLD UP STUFF',
  'NO REFUNDS',
  'BUYER FIXES IT ALL',
];

export class Contract extends Screen {
  static key = 'Contract';
  static override playable = false;

  private signed = false;

  create() {
    this.sound.playMusic(music);
    this.sound.say(contractLine); // "Congratulations on purchasing your first home… sign right here"

    this.el.classList.add('contract');
    this.el.innerHTML = `
      <div class="paper">
        <header class="contract-head">
          ${houseIcon}
          <h1 class="title">PURCHASE AGREEMENT</h1>
        </header>
        <ul class="terms">${TERMS.map((t) => `<li>${t}</li>`).join('')}</ul>
        <label class="sign-line">
          <span class="sign-x" aria-hidden="true">X</span>
          <canvas class="signature" width="160" height="28" aria-hidden="true"></canvas>
          <input class="sign-name" type="text" maxlength="20" autocomplete="name" aria-label="Type your name to sign" />
        </label>
      </div>
      <div class="actions"><button class="button sign" type="button" disabled>SIGN</button></div>`;

    const input = this.el.querySelector<HTMLInputElement>('.sign-name');
    const button = this.el.querySelector<HTMLButtonElement>('.sign');
    const canvas = this.el.querySelector<HTMLCanvasElement>('.signature');
    if (!input || !button || !canvas) return;

    // the box itself is invisible: what you type is drawn on the line in pixel handwriting, with a blinking cursor
    input.value = this.settings.lastName;
    let cursorOn = true;
    const redraw = () => {
      drawSignature(canvas, input.value, document.activeElement === input && cursorOn);
      button.disabled = input.value.trim() === '';
    };
    const blink = () => {
      cursorOn = !cursorOn;
      redraw();
      this.time.delay(500, blink);
    };
    this.time.delay(500, blink);
    loadSignatureFont().then(redraw);
    input.addEventListener('input', () => {
      cursorOn = true;
      redraw();
    });
    input.addEventListener('focus', redraw);
    input.addEventListener('blur', redraw);
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !button.disabled) this.sign(input.value.trim());
    });
    button.addEventListener('click', () => this.sign(input.value.trim()));
    redraw();
  }

  private sign(name: string) {
    if (this.signed || !name) return;
    this.signed = true;
    this.game.session.sign(name);
    this.settings.lastName = name; // filled in for you next time
    this.sound.say(signedLine); // "Now it's yours, warts and all." (cuts off the first line if it's still going)
    this.sound.play(stamp, 0.8);
    this.open('Yard'); // straight on: the line keeps playing in the yard
  }
}
