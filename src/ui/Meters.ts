// The meters, across the top: days, money and health against the contractor's quote.
// Dumb: it draws GameState whenever the meters change. A change shows: the bar slides, the meter bumps, the
// difference floats up (+$225, -3%), and money and health each make a sound.

import days from '@art/icons/days.svg?raw';
import health from '@art/icons/health.svg?raw';
import money from '@art/icons/money.svg?raw';
import coins from '@audio/ui/coins.wav';
import down from '@audio/ui/meter-down.wav';
import up from '@audio/ui/meter-up.wav';
import type { SoundManager } from '../engine/SoundManager';
import type { GameState } from '../state/GameState';

/** The meters' pixel icons (assets/art/icons/). */
const ICONS = { days, money, health };

type Name = 'days' | 'money' | 'health';

export class Meters {
  readonly el = document.createElement('header');
  /** Each meter's parts, made once (so the bars can slide). */
  private readonly parts = {} as Record<Name, { root: HTMLElement; value: HTMLElement; of: HTMLElement; bar: HTMLElement }>;
  /** What each showed last, to see what changed (null: nothing yet, or a new game). */
  private last: Record<Name, number> | null = null;

  constructor(
    private readonly state: GameState,
    private readonly sound: SoundManager,
  ) {
    this.el.className = 'meters';
    this.el.hidden = true;
    for (const name of ['days', 'money', 'health'] as Name[]) {
      const root = document.createElement('div');
      root.className = 'meter';
      root.innerHTML = `${ICONS[name]}<span class="meter-name">${name.toUpperCase()}</span><b><span class="meter-value"></span><em></em></b><i></i>`;
      this.parts[name] = { root, value: root.querySelector('.meter-value') as HTMLElement, of: root.querySelector('em') as HTMLElement, bar: root.querySelector('i') as HTMLElement };
      this.el.append(root);
    }
    document.body.append(this.el);
    state.subscribe('meters', () => this.render());
    this.render();
  }

  setShown(shown: boolean): void {
    this.el.hidden = !shown;
  }

  private render(): void {
    const { state } = this;
    const now = { days: state.day - 1, money: state.money, health: state.health };
    this.draw('days', `${now.days}`, `/${state.quote.days}`, state.quote.days ? now.days / state.quote.days : 0, false);
    this.draw('money', formatMoney(now.money), `/${formatMoney(state.quote.money)}`, state.quote.money ? now.money / state.quote.money : 0, false);
    this.draw('health', `${Math.round(now.health * 100)}%`, '', now.health, true);
    if (this.last && !this.el.hidden) this.showChanges(this.last, now);
    this.last = state.id ? now : null; // a new game starts fresh
  }

  /** One meter: its value (and out of what), and its bar (red once it's over; for health, low is bad). */
  private draw(name: Name, value: string, of: string, amount: number, goodWhenFull: boolean): void {
    const { root, value: valueEl, of: ofEl, bar } = this.parts[name];
    valueEl.textContent = value;
    ofEl.textContent = of;
    bar.style.setProperty('--amount', String(Math.min(1, Math.max(0, amount))));
    root.classList.toggle('bad', goodWhenFull ? amount < 0.3 : amount > 1);
  }

  /** What changed bumps, floats its difference up, and (money, health) makes a sound. */
  private showChanges(before: Record<Name, number>, now: Record<Name, number>): void {
    const days = now.days - before.days;
    const money = Math.round(now.money - before.money);
    const health = Math.round((now.health - before.health) * 100);
    if (days) this.float('days', `+${days} DAY${days > 1 ? 'S' : ''}`, true);
    if (money) {
      this.float('money', `${money > 0 ? '+' : '-'}${formatMoney(Math.abs(money))}`, money > 0);
      this.sound.play(coins, 0.35);
    }
    if (health) {
      this.float('health', `${health > 0 ? '+' : ''}${health}%`, health < 0);
      this.sound.play(health > 0 ? up : down, 0.35);
    }
  }

  /** The meter bumps, and `text` floats up from it: red when it's bad for you, green when it's good. */
  private float(name: Name, text: string, bad: boolean): void {
    const { root } = this.parts[name];
    root.classList.remove('bump');
    void root.offsetWidth; // restart the bump
    root.classList.add('bump');
    const delta = document.createElement('span');
    delta.className = `meter-delta${bad ? ' bad' : ''}`;
    delta.textContent = text;
    delta.addEventListener('animationend', () => delta.remove());
    root.append(delta);
  }
}

/** Short money: $850, $1.2K, $24K. */
function formatMoney(n: number): string {
  if (n < 1000) return `$${Math.round(n)}`;
  const k = n / 1000;
  return `$${k < 10 ? Number(k.toFixed(1)) : Math.round(k)}K`;
}
