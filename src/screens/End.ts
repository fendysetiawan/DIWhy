// The end, three ways: you did it yourself (win), you gave up (the contractor's bill), or you burned out (health hit
// zero). Each shows your character, and the same report: days, money and jobs against the contractor's quote (giving
// up adds their bill). Then CREDITS or PLAY AGAIN (a fresh game, back at character select).

import win from '@art/backgrounds/win.svg';
import fire from '@art/backgrounds/loss-fire.svg';
import rubble from '@art/effects/burning-rubble.svg';
import champagne from '@art/effects/champagne-pop.svg';
import defeat from '@audio/music/defeat.mp3';
import victory from '@audio/music/victory.mp3';
import { Screen } from '../engine/Screen';
import { CHARACTERS } from '../state/characters';
import { escapeHtml } from '../ui/Toast';

const ENDINGS = {
  win: { title: 'YOU DID IT YOURSELF!', line: 'All fixed. Nothing broke. Yet.', background: win, effect: champagne, music: victory },
  giveUp: { title: 'YOU GAVE UP', line: 'The contractor takes over. For a price.', background: fire, effect: rubble, music: defeat },
  burnedOut: { title: 'YOU BURNED OUT', line: 'Your health hit zero. The couch wins.', background: fire, effect: rubble, music: defeat },
};

export class End extends Screen {
  static key = 'End';
  static override playable = false;

  create(data?: { result?: keyof typeof ENDINGS }) {
    this.useArrowsOnButtons();
    const result = data?.result ?? 'win';
    const ending = ENDINGS[result];
    const player = this.state.player ?? CHARACTERS[0];
    this.sound.playMusic(ending.music);

    this.el.classList.add('end');
    this.el.style.backgroundImage = `url("${ending.background}")`;
    this.el.innerHTML = `
      <h1 class="title">${ending.title}</h1>
      <p class="text">${ending.line}</p>
      <section class="bill">${this.drawReport()}${result === 'giveUp' ? this.drawBill() : ''}</section>
      <div class="end-stage">
        <img class="end-effect" src="${ending.effect}" alt="" />
        <img class="end-who" src="${result === 'win' ? player.won : player.failed}" alt="" />
      </div>
      <div class="actions">
        <button class="button secondary" type="button" data-go="Credits">CREDITS</button>
        <button class="button" type="button" data-go="Select">PLAY AGAIN</button>
      </div>`;
    this.el.querySelector('.actions')?.addEventListener('click', (e) => {
      const to = (e.target as HTMLElement).closest('button')?.dataset.go;
      if (to === 'Select') this.playAgain();
      else if (to) this.open(to);
    });
    this.el.querySelector<HTMLButtonElement>('.actions .button:last-child')?.focus();
  }

  /** How it went: days, money and jobs against the contractor's quote, and the corners you cut. */
  private drawReport(): string {
    const r = this.state.report;
    if (!r) return '';
    const row = (name: string, value: string) => `<li><span>${name}</span><b>${value}</b></li>`;
    return `<ul>${[
      row('DAYS', `${r.days} of ${r.quote.days}`),
      row('SPENT', `${money(r.spent)} of ${money(r.quote.money)}`),
      row('JOBS DONE', `${r.jobsDone} of ${r.jobs}`),
      row('CORNERS CUT', String(r.cornersCut)),
    ].join('')}</ul>`;
  }

  /** The contractor's bill: each job, and the total. */
  private drawBill(): string {
    const bill = this.state.bill;
    if (!bill) return '';
    const lines = bill.lines.map((l) => `<li><span>${escapeHtml(l.title.toUpperCase())}</span><i>${l.note}</i><b>${money(l.money)}</b></li>`).join('');
    return `<ul>${lines}</ul><p class="bill-total"><span>THE CONTRACTOR'S BILL</span><b>${money(bill.total)}</b></p>`;
  }

  /** A fresh game: forget this one, back to character select. */
  private playAgain() {
    this.state.clear();
    this.open('Select');
  }
}

/** $1,250. */
function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
