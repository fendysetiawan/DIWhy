// The to-do list: a popover (Popover.ts), its button bottom left (a little post-it). It lists every DIY job you know
// about: where it is and how far along, new and broken ones flagged, done ones crossed off. Its badge counts what's
// new or broke since you last looked. A click or T opens it. It only draws GameState's jobs.

import closeIcon from '@art/icons/close.svg?raw';
import todoIcon from '@art/icons/todo.svg?raw';
import crash from '@audio/effects/object-falling.mp3';
import type { JobView } from '../../shared/game';
import type { Game } from '../engine/Game';
import { Popover } from './Popover';
import { escapeHtml } from './Toast';

/** Where a job is, in words: its level (the ground floor's level is just Ground). */
const describePlace = (level: string) => (level === 'Ground' ? 'GROUND FLOOR' : level.toUpperCase());

export class ToDo extends Popover {
  /** The jobs there at the start: any other one is new (until you start it). */
  private known: Set<string> | null = null;
  /** The flags you've seen (opening the list clears the badge). */
  private readonly seen = new Set<string>();
  /** The breaks we've made a sound for. */
  private readonly heard = new Set<string>();

  constructor(game: Game) {
    super(game, { name: 'todo', key: 'todo' });
    this.el.setAttribute('aria-label', 'To do');
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.todo-close')) this.setOpen(false);
    });
    game.state.subscribe('jobs', () => this.render());
    this.render();
  }

  protected render(): void {
    const { jobs, id } = this.game.state;
    if (!id) {
      this.known = null; // a new game
      this.seen.clear();
      this.heard.clear();
    }
    if (!this.known && jobs.length) this.known = new Set(jobs.map((j) => j.id));
    const flagged = jobs.filter((j) => this.flagOf(j)).map((j) => `${j.id}:${this.flagOf(j)}`);
    if (this.isUp) for (const f of flagged) this.seen.add(f);
    const unseen = flagged.filter((f) => !this.seen.has(f)).length;
    const broke = flagged.filter((f) => f.endsWith(':BROKE') && !this.heard.has(f));
    for (const f of broke) this.heard.add(f);
    if (broke.length && this.isShown) this.game.sound.play(crash, 0.5); // a fix just came undone
    this.button.innerHTML = `${todoIcon}${unseen ? `<i class="badge">${unseen}</i>` : ''}`;
    this.button.setAttribute('aria-label', `To do (T)${unseen ? `, ${unseen} new` : ''}`);
    const sorted = [...jobs.filter((j) => j.status !== 'done'), ...jobs.filter((j) => j.status === 'done')];
    this.el.innerHTML = `<header class="todo-head"><h2>TO DO</h2>
        <button class="todo-close" type="button" aria-label="Close (T)">${closeIcon}</button></header>
      <ol>${sorted.map((j) => this.drawJob(j)).join('')}</ol>`;
  }

  protected override onOpen(): void {
    this.el.querySelector<HTMLButtonElement>('.todo-close')?.focus();
  }

  /** NEW (appeared since the start, not started yet), BROKE (a fix came undone), or nothing. */
  private flagOf(job: JobView): string {
    if (job.status !== 'open') return '';
    if (job.done > 0) return 'BROKE';
    return this.known && !this.known.has(job.id) ? 'NEW' : '';
  }

  /** One job: a box (ticked once done), its title and place, its flag, and its steps. */
  private drawJob(job: JobView): string {
    const done = job.status === 'done';
    const flag = this.flagOf(job);
    const steps = job.steps.map((_, i) => `<i class="${i < job.done ? 'done' : ''}"></i>`).join('');
    return `<li class="${done ? 'done' : ''}">
      <span class="todo-box" aria-hidden="true">${done ? '✓' : ''}</span>
      <span class="todo-job"><b>${escapeHtml(job.title.toUpperCase())}</b>${flag ? `<em class="todo-flag">${flag}!</em>` : ''}
        <span class="todo-place">${describePlace(job.level)}</span>
        ${done ? '' : `<span class="progress small">${steps}</span>`}</span></li>`;
  }
}
