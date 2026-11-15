// A DIY job, up close: its set (sets.ts: a backdrop and the pieces that move) fills the window, and you act out each
// step in front of it.
// Kept simple: one note at the top, like a to-do list: a stepped progress bar, the job, and the next step's button. A surprise
// (Fendy's events) pops up over everything, answered with the picker, one option at a time. Your answer's outcome
// follows on the same card (a good one with champagne, a bad one in flames, with what it cost), and so does the job done
// (coins raining in). LATER goes back to where you were (the job waits).
// It only draws GameState; what happens is the server's call (Session.work, Session.choose).

import coinIcon from '@art/icons/money.svg?raw';
import rubble from '@art/effects/burning-rubble.svg';
import champagne from '@art/effects/champagne-pop.svg';
import exclamation from '@art/effects/exclamation.svg';
import fail from '@audio/effects/error-notification.mp3';
import tooBad from '@audio/effects/too-bad.mp3';
import uhOh from '@audio/music/uh-oh.mp3';
import work from '@audio/music/work.mp3';
import celebrate from '@audio/ui/celebrate.wav';
import coins from '@audio/ui/coins.wav';
import type { Act, JobView, Quality } from '../../shared/game';
import { Screen } from '../engine/Screen';
import type { Spot } from '../engine/Level';
import type { VoiceLine } from '../state/characters';
import { drawHead } from '../ui/Card';
import { drawPicker } from '../ui/Picker';
import { escapeHtml } from '../ui/Toast';
import { drawSet } from '../state/jobs';

/** Each step's sound: assets/audio/effects/<name>.mp3. */
const EFFECTS = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/audio/effects/*.mp3', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.split('/').pop()?.replace('.mp3', ''), url]),
);

/** How you take an answer's outcome: what you act out, and what you say. */
const REACTIONS: Record<Quality, { act: Act; line: VoiceLine }> = {
  good: { act: 'celebration', line: 'nice' },
  ok: { act: 'exhausted', line: 'oops' },
  wrong: { act: 'fright', line: 'oh-shit' },
  excessive: { act: 'exhausted', line: 'hooray' },
};

/** A pop-up waiting to be seen: how an answer went, or the job done. */
type Popup = { kind: 'outcome'; quality: Quality; text: string } | { kind: 'done' };

/** How each outcome looks: its heading, and its icon (good: champagne; bad: flames). */
const LOOKS: Record<Quality, { title: string; icon: string }> = {
  good: { title: 'NICE CALL!', icon: champagne },
  ok: { title: "IT'LL DO", icon: exclamation },
  wrong: { title: 'OUCH!', icon: rubble },
  excessive: { title: 'OVERKILL!', icon: rubble },
};

interface DiyData {
  job: string;
  back: { level: string; at: Spot };
}

export class Diy extends Screen {
  static key = 'Diy';

  private data!: DiyData;
  private you!: HTMLImageElement;
  private note!: HTMLElement;
  private popup!: HTMLElement;
  /** Waiting for the server to answer DO STEP. */
  private waiting = false;
  private surprised = false;
  /** The surprise's option in the picker. */
  private pick = 0;
  /** Pop-ups to show, one at a time (CONTINUE shows the next). */
  private popups: Popup[] = [];

  create(data: DiyData) {
    this.data = data;
    this.sound.playMusic(work);
    this.el.classList.add('diy');
    this.el.innerHTML = `
      ${drawSet(data.job)}
      <img class="diy-you" alt="" />
      <section class="diy-note"></section>
      <div class="popup" hidden><section class="card" role="dialog" aria-label="Surprise"></section></div>`;
    this.you = this.el.querySelector('.diy-you') as HTMLImageElement;
    this.note = this.el.querySelector('.diy-note') as HTMLElement;
    this.popup = this.el.querySelector('.popup') as HTMLElement;
    this.note.addEventListener('click', (e) => this.handleClick(e));
    this.popup.addEventListener('click', (e) => this.handleClick(e));
    // ← →: the surprise's options, or between the buttons
    this.controls.onAction('left', () => this.move(-1));
    this.controls.onAction('right', () => this.move(1));
    this.showBuilding();
    this.render();

    this.onChange('jobs', () => this.render());
    this.onChange('outcome', () => this.react());
    this.onChange('finished', () => this.finish());
  }

  /** The job, as the server has it now. */
  private findJob(): JobView | undefined {
    return this.state.jobs.find((j) => j.id === this.data.job);
  }

  /** Between steps: hammering away at a workbench. */
  private showBuilding(): void {
    const player = this.state.player;
    if (player) this.you.src = player.building;
  }

  /** A disaster: their reaction, played from the start. */
  private showReaction(): void {
    const player = this.state.player;
    if (player) this.you.src = `${player.reaction}?v=${Date.now()}`;
  }

  /** Act something out (it loops). */
  private act(act: Act): void {
    const player = this.state.player;
    if (player) this.you.src = player.act(act);
  }

  /** The note: which step, the job, the next step's button (or done); and the surprise, if one's up, over it all. */
  private render(): void {
    const job = this.findJob();
    if (!job) return;
    this.waiting = false;
    const { surprise } = job;
    if (surprise && !this.surprised) {
      this.surprised = true;
      this.pick = 0;
      this.sound.playMusic(uhOh);
      this.act('fright');
    }
    const step = job.steps[job.done];
    const segments = job.steps.map((_, i) => `<i class="${i < job.done ? 'done' : i === job.done ? 'now' : ''}"></i>`).join('');
    const progress = `<div class="progress" role="progressbar" aria-label="Steps done" aria-valuemin="0" aria-valuemax="${job.steps.length}" aria-valuenow="${job.done}">${segments}</div>`;
    let body: string;
    const tool = step?.tool ? this.state.tools.find((t) => t.id === step.tool && !t.owned) : undefined;
    if (step && tool) {
      // the step needs a tool you don't have: off to the store first
      body = `<p class="store-need">${escapeHtml(step.name.toUpperCase())} NEEDS ${escapeHtml(tool.name.toUpperCase())}</p>
        <div class="diy-buttons"><button type="button" class="button" data-store>GO TO THE STORE</button>
        <button type="button" class="button secondary" data-leave>LATER</button></div>`;
    } else if (step) {
      body = `<div class="diy-buttons"><button type="button" class="button" data-step>${escapeHtml(step.name.toUpperCase())}</button>
        <button type="button" class="button secondary" data-leave>LATER</button></div>`;
    } else {
      body = `<div class="diy-buttons"><button type="button" class="button" data-leave>BACK TO THE HOUSE</button></div>`;
    }
    this.note.innerHTML = `${progress}<h1 class="title diy-title">${escapeHtml(job.title.toUpperCase())}</h1>${body}`;
    this.drawPopup(job);
    this.el.querySelector<HTMLButtonElement>(this.popup.hidden ? '[data-step], [data-store], [data-leave]' : '.popup [data-go], .popup [data-continue]')?.focus();
  }

  /** Over everything: the surprise, or the next pop-up (a bad answer, the job done), or nothing. */
  private drawPopup(job: JobView): void {
    const { surprise } = job;
    const next = this.popups[0];
    this.popup.hidden = !surprise && !next;
    const card = this.popup.firstElementChild as HTMLElement;
    if (surprise) {
      card.className = 'card';
      card.innerHTML = `${drawHead(exclamation, escapeHtml(surprise.title.toUpperCase()))}
        <p>${escapeHtml(surprise.description)}</p>${'skipped' in (surprise.hint ?? {}) ? `<p class="card-hint">AskBot skipped this part (${escapeHtml(job.prep.ask.skipped.replace(/^It skipped /, '').replace(/\.$/, ''))}). You're on your own.</p>` : ''}
        ${drawPicker(this.labelOption(this.pick), surprise.options.length > 1)}`;
    } else if (next?.kind === 'outcome') {
      const look = LOOKS[next.quality];
      card.className = `card ${next.quality}`;
      card.innerHTML = `${drawHead(look.icon, look.title)}
        <p>${escapeHtml(next.text)}</p>
        <button type="button" class="button" data-continue>CONTINUE</button>`;
    } else if (next?.kind === 'done') {
      const rain = Array.from({ length: 14 }, (_, i) => `<i class="coin" style="--x: ${(i * 37) % 100}%; --delay: ${(i % 7) * 0.12}s">${coinIcon}</i>`).join('');
      card.className = 'card done';
      card.innerHTML = `<div class="coins" aria-hidden="true">${rain}</div>${drawHead(champagne, 'JOB DONE!')}
        <p>${escapeHtml(job.title)}</p>
        <p class="card-note">SPENT ${formatMoney(job.spent)}. THE CONTRACTOR WANTED ${formatMoney(job.quote.money)}.</p>
        <button type="button" class="button" data-continue>${this.state.won ? 'SEE HOW IT ENDS' : 'BACK TO THE HOUSE'}</button>`;
    }
  }

  /** Its buttons say what they do in data attributes. */
  private handleClick(e: Event): void {
    const { pick, go, step, leave, store, continue: next } = (e.target as HTMLElement).closest('button')?.dataset ?? {};
    if (next !== undefined) this.dismissPopup();
    else if (store !== undefined) this.goToStore();
    else if (pick) this.move(Number(pick));
    else if (go !== undefined) this.choose(this.pick);
    else if (step !== undefined) this.doStep();
    else if (leave !== undefined) this.leave();
  }

  /** A surprise's option, tagged if your prep pointed at it (a video you watched, or AskBot). */
  private labelOption(i: number): string {
    const surprise = this.findJob()?.surprise;
    if (!surprise) return '';
    const hint = surprise.hint;
    const tag = hint && 'option' in hint && hint.option === i ? (hint.from === 'video' ? ' · SEEN ON WETUBE' : ' · ASKBOT SAYS SO') : '';
    return `${surprise.options[i]} · ${formatMoney(surprise.costs[i])}${tag}`;
  }

  /** ← →: the surprise's next option, or the other button. */
  private move(step: number): void {
    if (this.game.hud.isBusy) return;
    const options = this.findJob()?.surprise?.options;
    if (options) {
      this.pick = (this.pick + step + options.length) % options.length;
      const text = this.popup.querySelector('.picker-text');
      if (text) text.textContent = this.labelOption(this.pick);
      return;
    }
    const buttons = [...this.note.querySelectorAll<HTMLButtonElement>('.diy-buttons button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + step + buttons.length) % buttons.length]?.focus();
  }

  /** Do the next step: you act it out, it sounds like it; the server says if a surprise came up. */
  private doStep(): void {
    const job = this.findJob();
    const step = job?.steps[job.done];
    if (!job || !step || this.waiting) return;
    this.waiting = true;
    this.act(step.act);
    const effect = EFFECTS[step.sound];
    if (effect) this.sound.play(effect, 0.6);
    this.game.session.work(job.id).finally(() => {
      this.waiting = false; // answered (or failed): you can press again
    });
  }

  private choose(option: number): void {
    if (this.waiting) return;
    this.waiting = true;
    this.surprised = false;
    this.sound.playMusic(work);
    this.game.session.choose(this.data.job, option).finally(() => {
      this.waiting = false;
    });
  }

  /** CONTINUE: the next pop-up; after the job's done, home (or, all done, the end). */
  private dismissPopup(): void {
    const seen = this.popups.shift();
    if (seen?.kind === 'done') {
      if (this.state.won) this.open('End', { result: 'win' });
      else this.leave();
      return;
    }
    this.render();
  }

  /** How your answer went: you act it out and say so, and it follows on the surprise's card. */
  private react(): void {
    const outcome = this.state.lastOutcome;
    const player = this.state.player;
    if (!outcome || outcome.job !== this.data.job || !player) return;
    const reaction = REACTIONS[outcome.quality];
    const bad = outcome.quality === 'wrong' || outcome.quality === 'excessive';
    if (bad) this.showReaction();
    else this.act(reaction.act);
    this.sound.say(player.voice(reaction.line));
    this.popups.push({ kind: 'outcome', quality: outcome.quality, text: outcome.text });
    if (bad) this.sound.play(outcome.quality === 'wrong' ? tooBad : fail, 0.6);
    this.render();
  }

  /** The job's done: celebrate, and its pop-up (champagne, coins) after any other. */
  private finish(): void {
    const player = this.state.player;
    if (!player || this.findJob()?.status !== 'done') return;
    this.act('celebration');
    this.sound.say(player.voice('success'));
    this.sound.play(coins, 0.5);
    this.sound.play(celebrate, 0.5);
    this.popups.push({ kind: 'done' });
    this.render();
  }

  /** Off to the store for the next step's tool; it brings you back here. */
  private goToStore(): void {
    const job = this.findJob();
    const tool = job?.steps[job.done]?.tool;
    if (tool) this.open('Store', { tool, back: this.data });
  }

  private leave(): void {
    this.open(this.data.back.level, { at: this.data.back.at });
  }
}

/** $850, $1,200. */
function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
