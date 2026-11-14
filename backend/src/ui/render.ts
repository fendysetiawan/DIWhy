// The game screen. Presentation only: it turns a GameView (the backend's JSON) into HTML and
// reports clicks. It has no game rules and imports nothing from the engine.

import type { ChoiceView, EventKind, EventView, GameView } from '../service/types';
import { esc, money, pct } from './util';

export interface View {
  game: GameView | null; // null until the first game loads
  busy: boolean; // waiting on the backend
  error: string | null;
  devMode: boolean;
  onChoose: (index: number) => void;
  onRestart: () => void;
  onReplay: () => void;
  onRetry: () => void;
  onToggleDev: () => void;
}

// Remember the last numbers drawn so we can animate the ones that changed.
let prev: Record<string, number> = {};
let lastGameId = '';

function stat(key: string, label: string, value: string, raw: number, fillPct: number | null, tone: string) {
  const changed = key in prev && prev[key] !== raw;
  prev[key] = raw;
  const bar = fillPct === null ? '' : `<div class="bar"><div class="fill ${tone}" style="width:${fillPct}%"></div></div>`;
  return `<div class="stat"><div class="label">${label}</div><div class="value ${changed ? 'bump' : ''}">${value}</div>${bar}</div>`;
}

function statusBar(g: GameView): string {
  const s = g.stats;
  return `<header class="status">
    ${stat('spent', 'Spent', `${money(s.spent)} <small>/ ${money(s.budget)}</small>`, s.spent, pct(s.spent, s.budget), 'money')}
    ${stat('days', 'Days', `${s.daysElapsed} <small>/ ${s.maxDays}</small>`, s.daysElapsed, pct(s.daysElapsed, s.maxDays), 'time')}
    ${stat('stress', 'Stress', `${s.stress}`, s.stress, s.stress, 'stress')}
    ${stat('risk', 'Risk debt', `${s.riskDebt}`, s.riskDebt, null, '')}
  </header>`;
}

/** "$180, 1 day" when the backend shows prices. Most games hide them: nobody quotes a DIY fix. */
function hint(c: ChoiceView): string {
  if (c.cost === null && c.days === null) return '';
  const parts: string[] = [];
  if (c.cost) parts.push(c.cost > 0 ? money(c.cost) : `refund ${money(-c.cost)}`);
  if (c.days) parts.push(`${c.days} day${c.days === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'free';
}

const KIND_LABEL: Record<EventKind, string> = {
  problem: 'why is this happening?',
  temptation: 'tempting upgrade',
  humor: 'plot twist',
  finale: 'final step',
};

function eventCard(e: EventView): string {
  const buttons = e.choices
    .map(
      (c) =>
        `<button class="choice" data-i="${c.index}"><span class="choice-label">${esc(c.label)}</span><span class="choice-hint">${esc(hint(c))}</span></button>`,
    )
    .join('');
  return `<section class="card event-card"><div class="kind ${e.kind}">${KIND_LABEL[e.kind]}</div>
    <h2>${esc(e.title)}</h2><p>${esc(e.description)}</p><div class="choices">${buttons}</div></section>`;
}

function thinkingCard(): string {
  return `<section class="card event-card thinking"><div class="spinner"></div>
    <p>Pausing a 12-minute tutorial to decide what goes wrong next...</p></section>`;
}

function errorCard(message: string): string {
  return `<section class="card error-card"><div class="kind problem">can't reach the game</div>
    <p>${esc(message)}</p>
    <div class="actions"><button class="choice primary" id="retry"><span class="choice-label">Try again</span></button></div></section>`;
}

function reportCard(g: GameView): string {
  const r = g.report!;
  const failed = g.status === 'failed';
  const row = (k: string, v: string) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  return `<section class="card report-card">
    <div class="kind ${failed ? 'problem' : 'humor'}">${failed ? 'DIY abandoned' : 'DIY complete'}</div>
    <h2>${esc(r.achievement.title)}</h2>
    <p class="achievement">${esc(r.achievement.text)}</p>
    <p>${esc(r.outcome)}</p>
    <p class="why-line">${esc(r.whyLine)}</p>
    <table>
      ${row('Original estimate', money(r.estimate))}
      ${row('Actual total cost', money(r.actualCost))}
      ${row('Cost overrun', `${r.overrunPct.toLocaleString('en-US')}%`)}
      ${row('Original timeline', `${r.plannedDays} day`)}
      ${row('Actual timeline', `${r.actualDays} day${r.actualDays === 1 ? '' : 's'}`)}
      ${row('Times you asked "why?"', String(r.problems))}
      ${row('Final stress', String(r.stress))}
    </table>
    <div class="actions">
      <button class="choice primary" id="restart"><span class="choice-label">DIY again with a new seed</span></button>
      <button class="choice" id="replay"><span class="choice-label">Replay seed ${g.seed}</span></button>
    </div></section>`;
}

function bottom(g: GameView): string {
  const history = g.log.length
    ? g.log.slice(0, 8).map((l, i) => `<li class="${i === 0 ? 'fresh' : ''}">${esc(l)}</li>`).join('')
    : '<li class="muted">Nothing has gone wrong. Yet.</li>';
  const ledger = g.ledger.length
    ? g.ledger.map((l) => `<li><span>${esc(l.label)}</span><b>${money(l.cost)}</b></li>`).join('')
    : '<li class="muted">No costs so far.</li>';
  return `<div class="bottom">
    <section class="card small"><h3>What just happened</h3><ul class="history">${history}</ul></section>
    <section class="card small"><h3>The damage so far</h3><ul class="ledger">${ledger}</ul>
      <div class="total"><span>Total</span><b>${money(g.stats.spent)}</b></div></section>
  </div>`;
}

export function renderGame(host: HTMLElement, view: View): void {
  const g = view.game;
  if (g && g.id !== lastGameId) {
    prev = {}; // a new game should not animate from the old one
    lastGameId = g.id;
  }

  let card: string;
  if (view.error) card = errorCard(view.error);
  else if (!g || view.busy || (g.status === 'playing' && !g.event)) card = thinkingCard();
  else card = g.status === 'playing' ? eventCard(g.event!) : reportCard(g);

  host.innerHTML = `
    <h1>DI<span class="why">Why</span></h1>
    <p class="tagline">The mission: replace one faucet. Do it yourself, then ask why.
      ${g ? `<span class="seed">seed ${g.seed}</span>` : ''}</p>
    ${g ? statusBar(g) : ''}
    ${card}
    ${g ? bottom(g) : ''}
    <footer class="foot"><button class="link" id="toggle-dev" aria-pressed="${view.devMode}">Dev mode: ${view.devMode ? 'on' : 'off'}</button></footer>`;

  host.querySelectorAll<HTMLButtonElement>('.choice[data-i]').forEach((b) =>
    b.addEventListener('click', () => view.onChoose(Number(b.dataset.i))),
  );
  host.querySelector('#restart')?.addEventListener('click', view.onRestart);
  host.querySelector('#replay')?.addEventListener('click', view.onReplay);
  host.querySelector('#retry')?.addEventListener('click', view.onRetry);
  host.querySelector('#toggle-dev')?.addEventListener('click', view.onToggleDev);
}
