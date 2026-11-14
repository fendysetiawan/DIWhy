/* DIWhy: the link between this page and the backend.
 *
 * Load the page as  /frontend/?game=<id>  and the backend runs the game; without ?game the page runs
 * its own demo exactly as before. This file uses the hooks the page exposes (window.DIWHY_HOOKS) to:
 *   - cast the game: who the player is, and who plays each role (the backend deals them)
 *   - drive the Time, Budget and Health bars from the game
 *   - show each event as a card with typewriter narration and the options to pick
 *   - text the advice from the neighbor, parent, friend or clerk (they can be wrong)
 *   - send every purchase through pay(): the bank alert, and the clerk's card trouble
 *   - let the contractor's Update button ask the backend for a new quote
 *   - turn the tasks post-it into the game's to-do list
 *   - show the end-of-game report
 *
 * It talks to /api (see backend/API.md). Plain script, no build step.
 * Add ?demo=1 and the hands-free demo takes over (see app/demo/).
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const GAME = params.get('game');
  const H = window.DIWHY_HOOKS;
  if (!GAME || !H) return;

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
  function syncNumbers(g, heldExtra = 0) {
    H.plan.days = g.quote.current.days;
    H.plan.budget = g.quote.current.budget;
    H.S.time = g.stats.daysElapsed / H.PLAN_DAYS;
    H.S.budget = Math.max(0, (g.stats.spent - H.heldTotal() - heldExtra) / H.PLAN_BUDGET);
    H.S.health = H.clamp(1 - g.stats.stress / 100, 0.05, 1);
    H.render();
    H.renderQuote();
  }

  /** The tasks post-it is the game's to-do list. Ticking one by hand does nothing. */
  function syncTasks(g) {
    H.tasks.splice(0, H.tasks.length);
    H.taskList.innerHTML = '';
    for (const t of g.tasks) {
      const task = { id: ++taskId, t: t.title, p: t.priority, cost: 0, prog: t.done ? 1 : 0, done: t.done };
      H.tasks.push(task);
      const el = H.makeTask(task);
      el.querySelector('.check').onclick = (e) => e.stopPropagation();
      H.taskList.appendChild(el);
    }
    H.markActive();
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
      .dw-live #ownerBtn { pointer-events: none; }
      .dw-live #shuffleBtn { display: none; }
      .dw-card { position: fixed; left: 50%; top: 46%; transform: translate(-50%, -50%); z-index: 7;
        width: min(640px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
        display: grid; gap: 16px; animation: dw-in .35s cubic-bezier(.2, .8, .2, 1); }
      .dw-card[hidden] { display: none; }
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
      setTimeout(() => H.deliver(who, adviceText(g)), 700 / (window.DIWHY_SPEED || 1));
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
    syncTasks(g);
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
    texts.forEach(([who, line], n) => setTimeout(() => H.deliver(who, line), (500 + n * 1600) / (window.DIWHY_SPEED || 1)));

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
        syncTasks(g);
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

  function endGame(g) {
    hideCard();
    const r = g.report;
    if (!r) return;
    const failed = g.status === 'failed';
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    const wrap = document.createElement('div');
    wrap.className = 'dw-report-backdrop';
    wrap.innerHTML = `
      <section class="dw-report brand-window" role="dialog" aria-label="Final report">
        <p class="brand-text brand-highlight">${failed ? 'DIY abandoned' : 'DIY complete'}</p>
        <h2 class="brand-title">${esc(r.achievement.title)}</h2>
        <p class="brand-text">${esc(r.achievement.text)}</p>
        <p class="brand-text">${esc(r.outcome)}</p>
        <p class="brand-text dw-why">${esc(r.whyLine)}</p>
        <table>
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
    syncTasks(game);
    if (game.status !== 'playing') return endGame(game);
    return showEvent(game);
  }

  async function init() {
    injectStyle();
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
    syncTasks(game);
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

  window.DIWHY_LINK = { ready: init(), game: () => game, choose };

  // The hands-free demo (see demo/): a visible mouse plays the game, starting once the game has loaded.
  if (DEMO) {
    window.DIWHY_LINK.ready
      .then(() => import('/demo/index.js'))
      .then((m) => m.start('game'))
      .catch((e) => console.error('demo failed to start', e));
  }
})();
