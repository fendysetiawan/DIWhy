// "press any key" → the studio logo and its sound → character select.

import logoSound from '@audio/logo/around-the-world-games.wav';
import logo from '@art/logos/around-the-world-games-logo.svg';
import { Screen } from '../engine/Screen';

export class Splash extends Screen {
  static key = 'Splash';
  static override playable = false;

  create() {
    // the key press is what lets the browser play sound
    this.el.classList.add('splash');
    this.el.innerHTML = `<p class="text hint">PRESS ANY KEY</p>`;
    this.controls.onAnyKey(() => this.showLogo());
  }

  private showLogo() {
    this.el.innerHTML = `
      <div class="logo">
        <img src="${logo}" alt="" />
        <p class="text">Around The World Games presents</p>
      </div>`;
    this.sound.play(logoSound);
    this.time.delay(500, () => this.controls.onAnyKey(() => this.open('Select'))); // a key skips it
    this.time.delay(3500, () => this.open('Select')); // the logo sound is 3.1 s
  }
}
