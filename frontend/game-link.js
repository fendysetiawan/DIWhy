/* DIWhy: the link between this page and the backend.
 *
 * Load the page as  /frontend/?game=<id>  and the backend runs the game; without ?game the page runs
 * its own demo exactly as before. This file uses the hooks the page exposes (window.DIWHY_HOOKS) to:
 *   - cast the game: who the player is, and who plays each role (the backend deals them)
 *   - drive the Time, Budget and Health bars from the game
 *   - show each event as a card with typewriter narration and the options to pick
 *   - text the advice from the neighbor, parent, friend or clerk (they can be wrong)
 *   - ask the backend's phone (a small local model) to write those texts and the reply buttons, so they
 *     stay on the job that is actually happening; if it is off or slow, the page's own lines are used
 *   - send every purchase through pay(): the bank alert, and the clerk's card trouble
 *   - let the contractor's Update button ask the backend for a new quote
 *   - show each event on the tasks post-it, in this page's own task style (the rows persist: they are
 *     added as events arrive and ticked off as you answer, never wiped and redrawn)
 *   - show the end-of-game report
 *
 * It talks to /api (see backend/API.md). Plain script, no build step.
 * Add ?demo=1 and the hands-free demo takes over (see app/demo/).
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  // Two ways in: ?game=<id> is a game already running; ?owner=<character> (and maybe &seed=) is a player
  // who has just left the front door and has not picked a job yet. Walking to one of the page's
  // glowing DIY spots and saying "Take it on" starts the backend game for that spot's job.
  let GAME = params.get('game');
  const OWNER = params.get('owner');
  const H = window.DIWHY_HOOKS;
  if ((!GAME && !OWNER) || !H) return;
  const SPOT_PROJECT = { wall: 'wall-removal', bath: 'toilet-replacement', dryer: 'dryer-replacement' }; // the page's spots -> events/*.csv jobs

  const DEMO = params.get('demo') === '1';
  if (DEMO) window.DIWHY_SPEED = Number(params.get('speed')) || 1.5; // the hands-free demo runs everything faster
  const API = (window.DIWHY_API_BASE || '') + '/api';
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------ small helpers

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const first = (id) => id.split('-')[0].replace(/^./, (c) => c.toUpperCase()); // "travis-potter" -> "Travis"
  const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / (window.DIWHY_SPEED || 1)));
  const ROLE_NAME = { partner: 'Partner', clerk: 'Store Clerk', contractor: 'Contractor', parent: 'Parent', neighbor: 'Nosy Neighbor', friend: 'Friend' };
  const KIND = { problem: 'why is this happening?', temptation: 'tempting upgrade', humor: 'plot twist', finale: 'final step' };

  class LinkError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const url = `${API}${path}${DEMO ? (path.includes('?') ? '&' : '?') + 'debug=1' : ''}`;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new LinkError(0, 'network', "Can't reach the game server. Is it running?");
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const e = data && data.error;
      throw new LinkError(res.status, (e && e.code) || 'http', (e && e.message) || `Something went wrong (${res.status}).`);
    }
    return data;
  }

  // ------------------------------------------------------------------ state

  let game = null; // the latest GameView
  let busy = false;
  let cardToken = 0; // changes whenever the card is redrawn, to stop an old typewriter
  let taskId = 0;
  let quoteAsks = 0;
  const charges = []; // charges the bank is asking about, oldest first (mirrors the phone's queue)
  const lineIx = {}; // next unused line in each character's chatter, after the two the page starts with
  const advised = new Set();

  // ------------------------------------------------------------------ keeping the page in step

  /** The bars, the contractor's quote and health all come from the game. `held` is money the bank has on hold. */
  // The bars. The backend knows the truth in whole steps (an answer costs $490 and 2 days). The page
  // shows it the way it happens: the numbers count up to the new value instead of jumping, the clock
  // creeps through the current day while you think (never into the next one), and time the page itself
  // spends (a how-to video, the store) is kept instead of being overwritten. A little note says what the
  // last answer cost.
  const speedNow = () => window.DIWHY_SPEED || 1;
  const DAY_MS = 6 * 60 * 1000; // a day on this page's clock is 6 minutes (3 day, 3 night)
  const aim = { time: 0, budget: 0, health: 1 }; // where the backend says the numbers are
  const shown = { time: 0, budget: 0, health: 1 }; // where they are on screen right now
  let firstSync = true, loop = null, dayStarted = Date.now(), pageExtra = 0, lastWritten = null;

  function stepBars() {
    if (!game) return;
    if (lastWritten !== null && H.S.time !== lastWritten) pageExtra += H.S.time - lastWritten; // the page spent some time itself
    const k = 1 - Math.pow(0.001, 50 / (1600 / speedNow())); // about 1.6 s to arrive
    for (const key of ['time', 'budget', 'health']) {
      const d = aim[key] - shown[key];
      shown[key] = Math.abs(d) < 1e-6 ? aim[key] : shown[key] + d * k;
    }
    const creep = game.status === 'playing' ? Math.min(0.9, (Date.now() - dayStarted) / (DAY_MS / speedNow())) : 0;
    const time = shown.time + creep / H.PLAN_DAYS + pageExtra;
    if (time === H.S.time && shown.budget === H.S.budget && shown.health === H.S.health) return;
    H.S.time = time;
    H.S.budget = shown.budget;
    H.S.health = shown.health;
    lastWritten = time;
    H.render();
  }

  function syncNumbers(g, heldExtra = 0) {
    H.plan.days = g.quote.current.days;
    H.plan.budget = g.quote.current.budget;
    const time = g.stats.daysElapsed / H.PLAN_DAYS;
    if (time !== aim.time) dayStarted = Date.now(); // a new day: the clock inside it starts over
    aim.time = time;
    aim.budget = Math.max(0, (g.stats.spent - H.heldTotal() - heldExtra) / H.PLAN_BUDGET);
    aim.health = H.clamp(1 - g.stats.stress / 100, 0.05, 1);
    if (firstSync) { // the very first numbers appear at once
      firstSync = false;
      Object.assign(shown, aim);
    }
    if (!loop) loop = setInterval(stepBars, 50);
    stepBars();
    H.renderQuote();
    showWork(g);
  }

  /** The 2D elevation view of the job (the wall, the dryer, the toilet). The backend says how far along it is. */
  function showWork(g) {
    const job = Object.keys(SPOT_PROJECT).find((k) => SPOT_PROJECT[k] === g.project.id);
    if (!job || !H.diyOpenLive || !H.diyProgress) return;
    if (g.status === 'playing') H.diyOpenLive(job, 1); // does nothing if it is already open
    const fraction = g.status === 'complete' ? 1 : g.stats.eventsDone / g.stats.eventsMax;
    H.diyProgress(fraction, `Spent ${money(g.stats.spent)} of the contractor's ${money(g.quote.original.budget)}`);
  }

  /** "This one cost $490 and 2 days": a short note above the bars after each answer. */
  function noteCost(o) {
    if (!o || (!o.cost && !o.days)) return;
    const anchor = document.getElementById('s-time');
    const note = anchor && anchor.closest('.note');
    if (!note) return;
    let el = document.getElementById('dwCostNote');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dwCostNote';
      document.body.appendChild(el);
    }
    const parts = [];
    if (o.cost) parts.push(money(o.cost));
    if (o.days) parts.push(`${o.days} day${o.days === 1 ? '' : 's'}`);
    el.textContent = `That cost ${parts.join(' and ')}${o.blewUp ? ' (it gave way)' : ''}`;
    el.className = o.blewUp || o.quality === 'excessive' ? 'bad' : '';
    const r = note.getBoundingClientRect();
    el.style.left = `${r.left}px`;
    el.style.bottom = `${innerHeight - r.top + 8}px`;
    el.style.width = `${r.width}px`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(noteCost.t);
    noteCost.t = setTimeout(() => el.classList.remove('show'), 6000 / speedNow());
  }

  // ---- the tasks post-it: this page's own way of showing events
  // The events come from the team's event list (events/*.csv) via the backend. How they look as tasks is
  // this page's business: the same row component the page's own tasks use (priority chip, progress bar,
  // tick). The rows PERSIST: one is added when an event arrives, ticked off when you answer it, and the
  // oldest finished ones slide away. Nothing is wiped and redrawn.
  const SERIOUS = new Set(['structural', 'environmental', 'electrical', 'plumbing', 'envelope']);
  const priorityOf = (e) => (e.kind === 'temptation' ? 'normal' : e.category && SERIOUS.has(e.category) ? 'urgent' : 'high');
  const MAX_FINISHED_ROWS = 4;
  const rows = new Map(); // event id -> { task, el }
  let finishRow = null; // "Finish the <job>", always last

  function makeRow(title, priority) {
    const task = { id: ++taskId, t: title, p: priority, cost: 0, prog: 0, done: false };
    const el = H.makeTask(task);
    el.querySelector('.check').onclick = (e) => e.stopPropagation(); // ticking by hand does nothing
    el.classList.add('entering');
    return { task, el };
  }

  /** Start the list for a game: just the last step. Events are added as they arrive. */
  function startTasks(g) {
    H.tasks.splice(0, H.tasks.length);
    H.taskList.innerHTML = '';
    rows.clear();
    finishRow = makeRow(`Finish the ${g.project.job}`, 'normal');
    H.tasks.push(finishRow.task);
    H.taskList.appendChild(finishRow.el);
  }

  /** The event now on the table gets a row (once), just above the last step. */
  function noteEvent(g) {
    const e = g.event;
    if (!finishRow) startTasks(g);
    if (!e || rows.has(e.id)) return;
    const row = makeRow(e.title, priorityOf(e));
    rows.set(e.id, row);
    H.tasks.splice(H.tasks.indexOf(finishRow.task), 0, row.task);
    H.taskList.insertBefore(row.el, finishRow.el);
    H.markActive();
  }

  function tickOff(row) {
    row.task.done = true;
    row.task.prog = 1;
    row.el.classList.add('done');
    const bar = row.el.querySelector('.prog i');
    if (bar) bar.style.width = '100%';
    H.markActive();
  }

  /** You answered this event: tick it off, and let the oldest finished rows slide away. */
  function eventAnswered(eventId) {
    const row = rows.get(eventId);
    if (row) tickOff(row);
    const finished = [...rows.entries()].filter(([, r]) => r.task.done);
    while (finished.length > MAX_FINISHED_ROWS) {
      const [id, old] = finished.shift();
      old.el.classList.add('leaving');
      setTimeout(() => old.el.remove(), 500 / (window.DIWHY_SPEED || 1));
      H.tasks.splice(H.tasks.indexOf(old.task), 1);
      rows.delete(id);
    }
  }

  function applyCast(g) {
    const roles = {};
    for (const [role, id] of Object.entries(g.cast.roles)) roles[role] = first(id);
    H.setCast(first(g.cast.owner), roles, g.cast.partnerFocus);
  }

  const money = (n) => H.money(n);
  const quoteLine = (q) => `Took a stab at the cost estimate. I'm looking at around ${money(q.budget)} and ${q.days} days for all the work.`;

  /** The next unused line in someone's chatter. These are the lines the page already has. */
  function nextLine(id) {
    const list = H.pool[id];
    lineIx[id] = lineIx[id] === undefined ? 2 : lineIx[id] + 1;
    return list[lineIx[id] % list.length];
  }

  // ------------------------------------------------------------------ the phone's writer

  // The backend can have a small local model write the texts and the reply buttons for the game as
  // it is now (POST /games/:id/phone). It is only ever a nicer wording: when it is off, slow or off
  // topic the backend says so and the page's own lines and buttons are used, exactly as before.
  // The hands-free demo skips it, so the demo says the same thing every time.
  const SMART_PHONE = !DEMO;
  const suggested = {}; // role -> the buttons for the open chat with them (undefined: the page's own)

  async function phone(who, kind, thread) {
    try {
      const v = await api(`/games/${GAME}/phone`, { method: 'POST', body: { with: who, kind, thread } });
      return v && v.source === 'model' ? v : null;
    } catch {
      return null; // never let a text hold up the game
    }
  }

  function showButtons(who) {
    if (H.current() === who) H.renderReplies();
  }

  /** Deliver a text. `line` is the page's own, used unless the model writes a better one in time. */
  function sendText(who, kind, line, delay) {
    const started = Date.now();
    const ask = SMART_PHONE ? phone(who, kind) : Promise.resolve(null);
    ask.then((v) => {
      const go = () => {
        if (v && v.replies.length) suggested[who] = v.replies;
        H.deliver(who, (v && v.text) || line);
        showButtons(who);
      };
      setTimeout(go, Math.max(0, delay / (window.DIWHY_SPEED || 1) - (Date.now() - started)));
    });
  }

  // The player tapped a button (or one of the page's own). The contractor's red "Give up." ends the game.
  let phoneReply = null;
  H.onReply = (who, text) => {
    if (who === 'contractor' && /^give up/i.test(String(text).trim())) return giveUp();
    return phoneReply && phoneReply(who, text);
  };

  if (SMART_PHONE) {
    H.suggested = (who) => suggested[who] || null;
    // The player tapped a button (or one of the page's own): the person answers, and new buttons appear.
    phoneReply = async (who, text) => {
      if (who === 'bank' || who === 'contractor' || !H.msgs[who]) return; // those two chats have their own fixed answers
      suggested[who] = []; // no stale buttons while they type
      showButtons(who);
      const thread = H.msgs[who].slice(-7).map((m) => ({ from: m.me ? 'me' : 'them', text: m.t }));
      const v = await phone(who, 'reply', thread);
      if (!v) {
        delete suggested[who]; // back to the page's own buttons
        return showButtons(who);
      }
      suggested[who] = v.replies;
      if (v.text) setTimeout(() => (H.deliver(who, v.text), showButtons(who)), 900 / (window.DIWHY_SPEED || 1));
      else showButtons(who);
    };
  }

  // ------------------------------------------------------------------ advice

  // What people say when they point at an option. They are not equally trustworthy.
  const ADVICE = {
    neighbor: [
      (o) => `I watched the whole thing from my window. Between us? "${o}". I would bet my fence on it.`,
      (o) => `Quiet street, you know. I would go with "${o}". Also, what is that noise?`,
      (o) => `Not that I was looking, but "${o}". Definitely "${o}".`,
    ],
    parent: [
      (o) => `Sweetheart, back in my day we did not have all these videos. Your grandfather would have just gone with "${o}" and had a sandwich, and this house is still standing. Mostly. Call me later.`,
      (o) => `I am not saying you have to listen to me, but I would go with "${o}", the way we always did it, before everything got so complicated, and did I ever tell you about the winter of '79?`,
      (o) => `Honey, "${o}". It worked fine for us. Do you remember the shed? Anyway. "${o}".`,
    ],
    friend: [
      (o) => `dude. "${o}". easy. then come over, I brought beer.`,
      (o) => `ok so I looked it up for like a second. "${o}"? sounds fun anyway.`,
      (o) => `"${o}". or not. whatever you pick I'm in. is there pizza`,
    ],
    clerk: [
      (o) => `We carry everything for that! I would go with "${o}". Have you seen our rewards card?`,
      (o) => `Customers like you usually pick "${o}". We also have it in a bundle.`,
      (o) => `For that, "${o}" is our most popular option. Also, gift cards.`,
    ],
  };

  function adviceText(g) {
    const a = g.event.advice;
    const options = ADVICE[a.from];
    return options[hash(g.event.id) % options.length](g.event.choices[a.pick].label);
  }

  // ------------------------------------------------------------------ the event card

  function injectStyle() {
    if (document.getElementById('dwStyle')) return;
    // The brand (assets/style.css) and this page both define --font: the brand's is Press Start 2P,
    // this page's is the system font. Remember the page's, load the brand, put the page's back, and
    // give only the cards below the brand's font. Neither file has to change.
    const pageFont = getComputedStyle(document.documentElement).getPropertyValue('--font').trim();
    const brand = document.createElement('link');
    brand.rel = 'stylesheet';
    brand.href = '/assets/style.css'; // the team's brand: blues, cream, Press Start 2P
    document.head.appendChild(brand);
    const st = document.createElement('style');
    st.id = 'dwStyle';
    st.textContent = `
      ${pageFont ? `:root { --font: ${pageFont}; }` : ''}
      .dw-card, .dw-report-backdrop { --font: "Press Start 2P", ui-monospace, monospace; }
      .dw-live #ownerBtn, .dw-pending #ownerBtn { pointer-events: none; }
      .dw-live #shuffleBtn, .dw-pending #shuffleBtn { display: none; }
      .dw-live .hot.fix { display: none !important; } /* once the job is picked, the other spots are done: one job per game */
      #dwCostNote { position: fixed; z-index: 6; box-sizing: border-box; padding: 7px 12px; border-radius: 10px; pointer-events: none;
        font: 600 13px/1.3 var(--font, system-ui); background: #fffbe8; color: #3a3320; box-shadow: 0 3px 10px rgba(0,0,0,.25);
        opacity: 0; transform: translateY(6px); transition: opacity .3s, transform .3s; }
      #dwCostNote.show { opacity: 1; transform: none; }
      #dwCostNote.bad { background: #fde8e6; color: #7a1d14; }
      .dw-card { position: fixed; left: 50%; top: 46%; transform: translate(-50%, -50%); z-index: 7;
        width: min(640px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
        display: grid; gap: 16px; animation: dw-in .35s cubic-bezier(.2, .8, .2, 1); }
      .dw-card[hidden] { display: none; }
      /* While a job is open the page shows its elevation view (the wall, the dryer). Dock the card low and to the left so the work stays in sight. */
      .in-diy .dw-card { left: 16px; top: auto; bottom: 16px; transform: none; width: min(520px, 48vw); max-height: 52vh; overflow-y: auto; padding: 18px 20px; gap: 12px; }
      .in-diy .dw-title { font-size: 13px; }
      .in-diy .dw-desc { min-height: 0; font-size: 11px; }
      .in-diy .dw-option { padding: 8px 12px; font-size: 11px; }
      .dw-kind { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
      .dw-title { font-size: 16px; line-height: 1.6; margin: 0; }
      .dw-desc { margin: 0; min-height: 4em; }
      .dw-options { display: grid; gap: 12px; }
      .dw-option { display: block; width: 100%; text-align: left; line-height: 1.6; padding: 12px 16px; }
      .dw-option[disabled] { opacity: .45; pointer-events: none; }
      .dw-option .dw-n { color: var(--brand-sky, #9cc3ff); margin-right: 12px; }
      .dw-hint { justify-self: start; background: none; border: 0; padding: 0; font-family: var(--font, monospace);
        font-size: 12px; line-height: 1.6; color: var(--brand-sky, #9cc3ff); text-decoration: underline; cursor: pointer; }
      .dw-error { color: var(--brand-cream, #f7e8d1); }
      .dw-report-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 12px;
        background: rgba(12, 20, 80, .72); animation: dw-fade .5s ease both; }
      .dw-report { width: min(680px, 100%); max-height: calc(100vh - 24px); overflow: auto; display: grid; gap: 16px; }
      .dw-report h2 { margin: 0; }
      .dw-report p { margin: 0; }
      .dw-why { color: var(--brand-sky, #9cc3ff); }
      .dw-report table { width: 100%; border-collapse: collapse; }
      .dw-report td { padding: 6px 0; border-bottom: 2px solid rgba(247, 232, 209, .25); font-size: 12px; line-height: 1.6; }
      .dw-report td:last-child { text-align: right; }
      .dw-actions { display: flex; flex-wrap: wrap; gap: 12px; }
      .dw-actions a { text-decoration: none; }
      @keyframes dw-in { from { opacity: 0; transform: translate(-50%, -46%); } to { opacity: 1; transform: translate(-50%, -50%); } }
      @keyframes dw-fade { from { opacity: 0; } to { opacity: 1; } }
      @media (max-width: 600px) { .dw-card, .dw-report { padding: 20px; } }
      @media (prefers-reduced-motion: reduce) { .dw-card, .dw-report-backdrop { animation: none; } }
    `;
    document.head.appendChild(st);
  }

  function card() {
    let el = document.getElementById('dwCard');
    if (!el) {
      el = document.createElement('section');
      el.id = 'dwCard';
      el.className = 'dw-card brand-window';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.hidden = false;
    return el;
  }
  const hideCard = () => {
    cardToken++;
    const el = document.getElementById('dwCard');
    if (el) el.hidden = true;
  };

  /** Type a line out. A click finishes it early. Reduced motion shows it all at once. */
  function typeOut(node, text, token) {
    return new Promise((resolve) => {
      if (REDUCED) {
        node.textContent = text;
        return resolve();
      }
      let i = 0;
      const finish = () => {
        clearInterval(timer);
        node.textContent = text;
        resolve();
      };
      const timer = setInterval(() => {
        if (token !== cardToken) return finish();
        node.textContent = text.slice(0, ++i);
        if (i >= text.length) finish();
      }, 24 / (window.DIWHY_SPEED || 1));
      node.parentElement.addEventListener('pointerdown', finish, { once: true });
    });
  }

  async function showEvent(g) {
    const e = g.event;
    noteEvent(g);
    const el = card();
    const token = ++cardToken;
    el.innerHTML = `
      <div class="dw-kind brand-text brand-highlight">${esc(KIND[e.kind] || e.kind)}</div>
      <h2 class="dw-title brand-text">${esc(e.title)}</h2>
      <p class="dw-desc brand-text"></p>
      <div class="dw-options" role="group" aria-label="What do you do?"></div>`;
    await typeOut(el.querySelector('.dw-desc'), e.description, token);
    if (token !== cardToken) return;

    const box = el.querySelector('.dw-options');
    e.choices.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'brand-button dw-option';
      b.dataset.i = String(c.index);
      b.innerHTML = `<span class="dw-n">${c.index + 1}</span>${esc(c.label)}`;
      b.addEventListener('click', () => choose(c.index));
      box.appendChild(b);
    });

    // Someone has an opinion. They text it, and the card says so.
    if (e.advice && !advised.has(e.id)) {
      advised.add(e.id);
      const who = e.advice.from;
      const hint = document.createElement('button');
      hint.type = 'button';
      hint.className = 'dw-hint';
      hint.textContent = `${ROLE_NAME[who]} texted you about this`;
      hint.addEventListener('click', () => H.openChat(who));
      el.appendChild(hint);
      sendText(who, 'advice', adviceText(g), 700);
    }
  }

  document.addEventListener('keydown', (ev) => {
    const el = document.getElementById('dwCard');
    if (!el || el.hidden || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const b = el.querySelector(`.dw-option[data-i="${Number(ev.key) - 1}"]`);
    if (b) b.click();
  });

  // ------------------------------------------------------------------ making a choice

  async function choose(i) {
    if (busy || !game || !game.event) return;
    busy = true;
    document.querySelectorAll('.dw-option').forEach((b) => (b.disabled = true));
    try {
      const g = await api(`/games/${GAME}/choices`, { method: 'POST', body: { choice: i, eventId: game.event.id } });
      await afterChoice(g);
    } catch (err) {
      busy = false;
      // A stale click (another tab moved the game on): just show where the game really is.
      if (err.code === 'stale_event') return resume();
      fail(err);
      return;
    }
    busy = false;
  }

  /** Update the page for the new state, let the cast react, then show what is next. */
  async function afterChoice(g) {
    const before = game;
    game = g;
    hideCard();

    const fresh = g.charge && g.charge.status === 'pending' && !(before.charge && before.charge.id === g.charge.id);
    syncNumbers(g, fresh ? g.charge.amount : 0);
    noteCost(g.outcome);
    if (before.event) eventAnswered(before.event.id);
    if (fresh) {
      charges.push(g.charge.id);
      H.pay(g.charge.amount, g.charge.what); // the bank texts, the clerk's card will not go through
    }
    react(g);

    await wait(1400);
    if (g.status === 'playing') await showEvent(g);
    else endGame(g);
  }

  /** The cast reacts, in their own words (the lines the page already had), one text at a time. */
  function react(g) {
    const o = g.outcome;
    if (!o) return;
    const texts = [];
    if (o.partnerNagged) texts.push(['partner', nextLine('partner')]);
    if (o.blewUp) texts.push(['neighbor', nextLine('neighbor')]);
    else if (o.quality === 'excessive') texts.push(['clerk', nextLine('clerk')]);
    else if (o.quality === 'wrong') texts.push(['parent', nextLine('parent')]);
    else if (hash(`${g.id}:${o.eventId}`) % 3 === 0) texts.push(['friend', nextLine('friend')]);
    texts.forEach(([who, line], n) => sendText(who, 'reaction', line, 500 + n * 1600));

    // A big fix sometimes ends with the phone on the floor. Deterministic, so a replay cracks it again.
    if (o.cost >= 300 && hash(`${g.id}:crack:${o.eventId}`) % 10 === 0) setTimeout(() => H.crackPhone(), 900 / (window.DIWHY_SPEED || 1));
  }

  // ------------------------------------------------------------------ the bank

  H.onSettle = (ok) => {
    const id = charges.shift();
    if (id === undefined) return;
    api(`/games/${GAME}/payments`, { method: 'POST', body: { chargeId: id, confirm: ok } })
      .then((g) => {
        game = g;
        syncNumbers(g);
        if (g.status !== 'playing') endGame(g);
      })
      .catch((err) => {
        if (err.code !== 'stale_charge') fail(err); // an older, superseded charge is nothing to worry about
      });
  };

  // ------------------------------------------------------------------ the contractor

  function wireContractor() {
    const btn = document.getElementById('quoteBtn');
    btn.onclick = async (e) => {
      e.stopPropagation();
      try {
        const g = await api(`/games/${GAME}/quote`, { method: 'POST' });
        game = g;
        const asks = H.TEXTS.contractorQuote;
        const line = asks[quoteAsks++ % asks.length]
          .replace('{days}', g.quote.current.days)
          .replace('{price}', money(g.quote.current.budget));
        H.msgs.contractor.push({ t: line, me: false });
        if (H.current() === 'contractor') H.renderChat();
        const v = document.getElementById('quoteVal');
        v.classList.remove('bump');
        void v.offsetWidth;
        v.classList.add('bump');
        syncNumbers(g);
        H.renderList();
      } catch (err) {
        fail(err);
      }
    };
  }

  // ------------------------------------------------------------------ the end

  let givingUp = false;
  async function giveUp() {
    if (givingUp || !game || game.status !== 'playing') return;
    givingUp = true;
    try {
      game = await api(`/games/${GAME}/giveup`, { method: 'POST' });
      syncNumbers(game);
      endGame(game);
    } catch (err) {
      givingUp = false;
      fail(err);
    }
  }

  function endGame(g) {
    hideCard();
    if (finishRow && g.status === 'complete') tickOff(finishRow);
    const r = g.report;
    if (!r) return;
    const failed = g.status === 'failed';
    const bill = r.contractorBill;
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    const billRows = bill
      ? bill.rows.map((b) => `<tr><td>${esc(b.label)} (${esc(b.note)})</td><td>${money(b.cost)}</td></tr>`).join('')
      : '';
    const wrap = document.createElement('div');
    wrap.className = 'dw-report-backdrop';
    wrap.innerHTML = `
      <section class="dw-report brand-window" role="dialog" aria-label="Final report">
        <p class="brand-text brand-highlight">${bill ? 'Contractor called' : failed ? 'DIY abandoned' : 'DIY complete'}</p>
        <h2 class="brand-title">${esc(r.achievement.title)}</h2>
        <p class="brand-text">${esc(r.achievement.text)}</p>
        <p class="brand-text">${esc(r.outcome)}</p>
        <p class="brand-text dw-why">${esc(r.whyLine)}</p>
        <table>
          ${bill ? billRows + row("The contractor's bill", money(bill.total)) : ''}
          ${row('Contractor quote', money(r.estimate))}
          ${row('You spent', money(r.actualCost))}
          ${row('Cost overrun', `${r.overrunPct.toLocaleString('en-US')}%`)}
          ${row('Contractor timeline', `${r.plannedDays} day${r.plannedDays === 1 ? '' : 's'}`)}
          ${row('Your timeline', `${r.actualDays} day${r.actualDays === 1 ? '' : 's'}`)}
          ${row('Times you asked "why?"', r.problems)}
          ${row('Final stress', r.stress)}
        </table>
        <div class="dw-actions">
          <a class="brand-button" id="dwAgain" href="/app/${DEMO ? '?demo=1' : ''}">DIY again</a>
          <button class="brand-button" id="dwReplay" type="button">Replay seed ${g.seed}</button>
        </div>
      </section>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#dwReplay').addEventListener('click', async () => {
      try {
        const next = await api('/games', { method: 'POST', body: { seed: g.seed, project: g.project.id, owner: g.cast.owner } });
        const q = new URLSearchParams(location.search);
        q.set('game', next.id);
        location.search = q.toString();
      } catch (err) {
        fail(err);
      }
    });
  }

  function fail(err) {
    hideCard();
    const el = card();
    const gone = err.status === 404;
    el.innerHTML = `
      <div class="dw-kind brand-text brand-highlight">can't reach the game</div>
      <p class="dw-error brand-text">${esc(gone ? "This game isn't here any more. The server may have restarted." : err.message)}</p>
      <div class="dw-options">
        <a class="brand-button dw-option" style="text-decoration:none" href="/app/">Start a new game</a>
        ${gone ? '' : '<button class="brand-button dw-option" id="dwRetry" type="button">Try again</button>'}
      </div>`;
    const retry = el.querySelector('#dwRetry');
    if (retry) retry.addEventListener('click', resume);
  }

  // ------------------------------------------------------------------ starting up

  /** Load the game and put the page in step with it. Also used to recover after a hiccup. */
  async function resume() {
    try {
      game = await api(`/games/${GAME}`);
    } catch (err) {
      return fail(err);
    }
    syncNumbers(game);
    if (game.status !== 'playing') return endGame(game);
    return showEvent(game);
  }

  let starting = false;

  /** You said "Take it on" at a glowing spot: start the backend game for that spot's job. */
  async function startFromSpot(spotId) {
    const project = SPOT_PROJECT[spotId];
    if (!project || GAME || starting) return;
    starting = true;
    try {
      const body = { owner: OWNER, project };
      const seed = params.get('seed');
      if (seed !== null && seed !== '') body.seed = Number(seed);
      const made = await api('/games', { method: 'POST', body });
      GAME = made.id;
      const next = new URLSearchParams({ game: GAME });
      if (DEMO) next.set('demo', '1');
      if (params.get('speed')) next.set('speed', params.get('speed'));
      history.replaceState(null, '', `${location.pathname}?${next}`); // a reload now resumes this game
      document.documentElement.classList.remove('dw-pending');
      H.started = true;
      await begin();
    } catch (err) {
      starting = false;
      fail(err);
    }
  }

  async function init() {
    injectStyle();
    if (GAME) return begin();
    // No job yet: the house is open and the glowing spots are how you find one.
    document.documentElement.classList.add('dw-pending');
    // You are the owner. Everyone else gets a placeholder role for now; the backend deals the real cast
    // when the game starts. The bars start empty: nothing has been spent and no day has gone by.
    const people = H.C.filter((c) => !c.bank);
    const everyone = [...new Set([...people.map((c) => c.name), H.owner()])];
    const mine = first(OWNER);
    const rest = everyone.filter((n) => n !== mine);
    H.setCast(mine, Object.fromEntries(people.map((c, i) => [c.id, rest[i]])), 'budget');
    H.S.time = 0; H.S.budget = 0; H.S.health = 1;
    H.render();
    H.onStartProject = startFromSpot;
  }

  async function begin() {
    document.documentElement.classList.add('dw-live');
    try {
      game = await api(`/games/${GAME}`);
    } catch (err) {
      return fail(err);
    }
    applyCast(game);
    H.msgs.contractor = [{ t: quoteLine(game.quote.original), me: false }];
    H.unread.contractor = 0;
    wireContractor();
    syncNumbers(game);
    startTasks(game);
    H.renderList();
    // A page reloaded with a charge still waiting: bring the bank's question back.
    if (game.charge && game.charge.status === 'pending') {
      charges.push(game.charge.id);
      syncNumbers(game, game.charge.amount);
      H.pay(game.charge.amount, game.charge.what);
    }
    if (game.status !== 'playing') return endGame(game);
    return showEvent(game);
  }

  window.DIWHY_LINK = { ready: init(), game: () => game, choose, giveUp };

  // The hands-free demo (see demo/): a visible mouse plays the game, starting once the game has loaded.
  if (DEMO) {
    window.DIWHY_LINK.ready
      .then(() => import('/demo/index.js'))
      .then((m) => m.start('game'))
      .catch((e) => console.error('demo failed to start', e));
  }
})();
