// The credits, like the original: the team's picture (the spinning globe on the left, everyone's name and home town on
// the right, in their colours). Then PLAY AGAIN.

import team from '@art/logos/team-world.svg';
import music from '@audio/music/menu.mp3';
import { Screen } from '../engine/Screen';

export class Credits extends Screen {
  static key = 'Credits';
  static override playable = false;

  create() {
    this.sound.playMusic(music);
    this.el.classList.add('credits');
    this.el.innerHTML = `
      <header><p class="text">A GAME BY</p><h1 class="title">AROUND THE WORLD GAMES</h1></header>
      <img class="team" src="${team}" alt="The team around the world: Travis, Aidan, Gigi, Christian, Rachel, Ramy and Fendy" />
      <div class="actions"><button class="button" type="button">PLAY AGAIN</button></div>`;
    const button = this.el.querySelector<HTMLButtonElement>('.actions .button');
    button?.addEventListener('click', () => {
      this.state.clear();
      this.open('Select');
    });
    button?.focus();
  }
}
