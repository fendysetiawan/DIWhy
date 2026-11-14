// The dev panel: a read-only look at everything the backend reports in `debug`.
// Draws HTML only. It never changes game state and imports nothing from the engine.

import type { DebugView, DecisionRecord, DirectorName, GameView } from '../service/types';
import { esc } from '../ui/util';

/** What the panel remembers between renders, so highlights and open sections survive. */
export interface PanelMemory {
  prev: Record<string, string>; // last value per state row, so changed rows can flash
  open: Map<string, boolean>; // <details> blocks the user opened or closed
}

export interface PanelContext {
  game: GameView;
  debug: DebugView;
  busy: boolean;
  memory: PanelMemory;
  onSetDirector: (name: DirectorName) => void;
}

const json = (v: unknown) => esc(JSON.stringify(v, null, 2));

function row(m: PanelMemory, key: string, label: string, value: string): string {
  const changed = key in m.prev && m.prev[key] !== value;
  m.prev[key] = value;
  return `<tr class="${changed ? 'changed' : ''}"><td>${label}</td><td>${esc(value)}</td></tr>`;
}

/** A <details> block that keeps its open/closed state across re-renders. */
function det(m: PanelMemory, key: string, summary: string, body: string, openByDefault = false): string {
  const open = m.open.get(key) ?? openByDefault;
  return `<details data-key="${esc(key)}" ${open ? 'open' : ''}><summary>${summary}</summary>${body}</details>`;
}

/** Everything the model was asked and answered, one block per decision, newest first. */
function decisionLog(c: PanelContext): string {
  const decisions: DecisionRecord[] = c.debug.decisions;
  if (c.game.director !== 'jev' && decisions.length === 0) return '';
  if (decisions.length === 0) {
    return '<h4>Jev decision log</h4><p class="muted">No model decisions yet. (Single-candidate and forced events skip the model.)</p>';
  }
  const m = c.memory;

  const blocks = [...decisions].reverse().map((d, i) => {
    const t = d.info.trace;
    const key = `rec-${c.game.id}-${d.step}`;
    const req = t?.request as { state?: string; questions?: unknown } | undefined;
    const pct = d.pool.find((p) => p.picked)?.jevPct;
    const tag = d.info.fallback ? ' <span class="warn">FALLBACK</span>' : '';
    const head = `#${d.step} ${esc(d.pickedId)}${pct !== undefined ? ` <span class="muted">${pct.toFixed(0)}%</span>` : ''}${tag}`;

    const rows = [...d.pool]
      .sort((a, b) => (b.jevPct ?? -1) - (a.jevPct ?? -1))
      .map(
        (p) =>
          `<tr class="${p.picked ? 'picked' : ''}"><td>${esc(p.id)}</td><td>${p.jevPct === undefined ? '' : `${p.jevPct.toFixed(0)}%`}</td><td>${p.pct.toFixed(0)}%</td></tr>`,
      )
      .join('');

    const parts = [
      d.info.fallback ? `<p class="warn">${esc(d.info.note ?? 'fallback used')}</p>` : '',
      `<table class="pool"><tr><th>candidate</th><th>jev</th><th>weighted</th></tr>${rows}</table>`,
      t?.roll !== undefined ? `<p class="muted">sampled with seeded roll ${t.roll.toFixed(4)} -> ${esc(t.pickedId ?? '')}</p>` : '',
      d.info.latencyMs !== undefined ? `<p class="muted">${d.info.latencyMs} ms</p>` : '',
      req?.state !== undefined ? det(m, `${key}-state`, 'INPUT: state Jev sees', `<pre class="wrap">${esc(req.state)}</pre>`, i === 0) : '',
      req?.questions !== undefined ? det(m, `${key}-q`, 'INPUT: question and options Jev can choose', `<pre>${json(req.questions)}</pre>`, i === 0) : '',
      t?.response !== undefined ? det(m, `${key}-resp`, 'OUTPUT: raw model response', `<pre>${json(t.response)}</pre>`, i === 0) : '',
      t?.error ? `<p class="warn">error: ${esc(t.error)}</p>` : '',
    ];
    return det(m, key, head, parts.join(''), i === 0);
  });

  const download = {
    seed: c.game.seed,
    director: c.game.director,
    decisions: decisions.map((d) => ({
      step: d.step,
      picked: d.pickedId,
      fallback: d.info.fallback ?? false,
      latencyMs: d.info.latencyMs,
      pool: d.pool,
      trace: d.info.trace,
    })),
  };
  const href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(download, null, 2))}`;
  return `<h4>Jev decision log</h4>${blocks.join('')}
    <p><a class="dl" download="jev-trace-seed-${c.game.seed}.json" href="${href}">Download trace JSON</a></p>`;
}

function directorPool(c: PanelContext): string {
  const { last } = c.debug;
  let pool: string;
  if (c.busy) {
    pool = '<p class="muted">Director is choosing...</p>';
  } else if (last.forced) {
    pool = '<p class="muted">Engine forced the finale (event limit reached or nothing eligible). No director pick.</p>';
  } else if (last.pool.length === 0) {
    pool = '<p class="muted">No next event.</p>';
  } else {
    // "weighted" is what the random rules give. "jev" is what the model said (when it answered).
    const hasJev = last.pool.some((p) => p.jevPct !== undefined);
    const body = [...last.pool]
      .sort((a, b) => b.weight - a.weight)
      .map(
        (p) =>
          `<tr class="${p.picked ? 'picked' : ''}"><td>${esc(p.id)}</td><td>${p.weight.toFixed(1)}</td><td>${p.pct.toFixed(0)}%</td>${
            hasJev ? `<td>${p.jevPct === undefined ? '' : `${p.jevPct.toFixed(0)}%`}</td>` : ''
          }</tr>`,
      )
      .join('');
    pool = `<table class="pool"><tr><th>candidate</th><th>weight</th><th>weighted</th>${hasJev ? '<th>jev</th>' : ''}</tr>${body}</table>`;
  }

  const notes: string[] = [];
  const info = last.info;
  if (info?.fallback) notes.push(`<p class="warn">${esc(info.note ?? 'fallback used')}</p>`);
  else if (info?.note) notes.push(`<p class="muted">${esc(info.note)}</p>`);
  if (info?.latencyMs !== undefined && !info.fallback) notes.push(`<p class="muted">decision took ${info.latencyMs} ms</p>`);
  return pool + notes.join('');
}

/** Draw the panel into `host` and wire its controls. */
export function renderPanel(host: HTMLElement, c: PanelContext): void {
  const s = c.debug.state;
  const maxDays = c.game.stats.maxDays;
  const m = c.memory;

  const rows = [
    row(m, 'spent', 'spent', `${s.spent} / ${s.budget}`),
    row(m, 'days', 'daysElapsed', `${s.daysElapsed} / ${maxDays}`),
    row(m, 'stress', 'stress', String(s.stress)),
    row(m, 'risk', 'riskDebt', String(s.riskDebt)),
    row(m, 'plumb', 'house.plumbingCondition', String(s.house.plumbingCondition)),
    row(m, 'elec', 'house.electricalCondition', String(s.house.electricalCondition)),
    row(m, 'water', 'house.waterDamage', String(s.house.waterDamage)),
    row(m, 'problems', 'problems', String(s.problems)),
    row(m, 'events', 'events shown', `${s.eventHistory.length} / ${c.debug.maxEvents}`),
    row(m, 'completed', 'completed', String(s.completed)),
    row(m, 'failure', 'failure', String(s.failure)),
  ].join('');

  // Flags with stack counts: ["upgrade-fever","upgrade-fever"] -> upgrade-fever x2
  const counts = new Map<string, number>();
  s.flags.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
  const flags = counts.size
    ? [...counts].map(([f, n]) => `<span class="chip">${esc(f)}${n > 1 ? ` x${n}` : ''}</span>`).join('')
    : '<span class="muted">none</span>';

  const history = s.eventHistory.length
    ? `<ol class="dev-history">${s.eventHistory.map((id) => `<li>${esc(id)}</li>`).join('')}</ol>`
    : '<span class="muted">empty</span>';

  const jev = c.game.director === 'jev';
  host.innerHTML = `
    <h3>Dev mode <span class="muted">seed ${c.game.seed}</span></h3>
    <div class="director-switch">Event director:
      ${(['random', 'jev'] as const)
        .map(
          (n) =>
            `<button class="seg ${c.game.director === n ? 'active' : ''}" data-director="${n}">${n === 'jev' ? 'Jev (local model)' : 'Random'}</button>`,
        )
        .join('')}
      <div class="muted">switching replays this seed</div>
    </div>
    ${jev ? decisionLog(c) : ''}
    <h4>State</h4><table class="kv">${rows}</table>
    <h4>Flags</h4><div>${flags}</div>
    <h4>Current event: ${esc(c.busy ? '(choosing)' : (c.game.event?.id ?? 'none'))}</h4>
    <h4>Director pool (${esc(c.game.director)})</h4>${directorPool(c)}
    ${jev ? '' : decisionLog(c)}
    <h4>Event history</h4>${history}
    ${det(m, 'raw-state', 'Raw state JSON', `<pre>${json(s)}</pre>`)}`;

  host.querySelectorAll<HTMLDetailsElement>('details[data-key]').forEach((d) =>
    d.addEventListener('toggle', () => m.open.set(d.dataset.key!, d.open)),
  );
  host.querySelectorAll<HTMLButtonElement>('.seg').forEach((b) =>
    b.addEventListener('click', () => {
      const name = b.dataset.director as DirectorName;
      if (name !== c.game.director) c.onSetDirector(name);
    }),
  );
}
