// @vitest-environment jsdom
// frontend/game-link.js, the real file, against the real backend and the team's real events.
// The page's own functions (the phone, the bars, pay()) are stood in for by recorders, so this
// proves what the link DOES to the page. The page itself is checked in a real browser separately.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import { bridgeFetch, realProjects } from '../testing';

const SCRIPT = readFileSync(join(process.cwd(), '..', 'frontend', 'game-link.js'), 'utf8'); // tests run from backend/
const ROLES = ['partner', 'clerk', 'contractor', 'parent', 'neighbor', 'friend'];
const WAIT = 10000; // how long to wait for the link to react; generous, because a busy machine is slow in jsdom
const lines = (n: string) => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `${n} line ${i}`);

/** Stands in for the page's DIWHY_HOOKS. Records every call the link makes. */
function makeHooks() {
  const pending: Array<{ amount: number; what: string }> = [];
  const hooks: any = {
    S: { time: 0.6, budget: 0.68, health: 0.78 },
    plan: { days: 30, budget: 24000 },
    PLAN_DAYS: 30,
    PLAN_BUDGET: 24000,
    TEXTS: { contractorQuote: ['Revised: {days} days and {price}.'] },
    pool: Object.fromEntries(ROLES.map((r) => [r, lines(r)])),
    msgs: Object.fromEntries(ROLES.map((r) => [r, []])),
    unread: Object.fromEntries(ROLES.map((r) => [r, 0])),
    tasks: [] as any[],
    taskList: document.createElement('div'),
    LIVE: true,
    C: ['partner', 'clerk', 'contractor', 'parent', 'neighbor', 'friend'].map((id, i) => ({ id, name: ['Aidan', 'Christian', 'Fendy', 'Rachel', 'Ramy', 'Travis'][i] })).concat([{ id: 'bank', name: 'Bank', bank: true } as any]),
    delivered: [] as Array<[string, string]>,
    paid: [] as Array<[number, string]>,
    renders: 0,
    cracked: 0,
    opened: [] as string[],
    cast: undefined as any,
    render: () => hooks.renders++,
    renderList: () => undefined,
    renderChat: () => undefined,
    renderQuote: () => undefined,
    renderReplies: () => undefined,
    deliver: (id: string, text: string) => hooks.delivered.push([id, text]),
    pay: (amount: number, what: string) => {
      pending.push({ amount, what });
      hooks.paid.push([amount, what]);
    },
    heldTotal: () => pending.reduce((a, p) => a + p.amount, 0),
    settleFirst: (ok: boolean) => {
      const p = pending.shift()!;
      hooks.onSettle?.(ok, p);
    },
    diyOpened: [] as string[],
    diyProgressed: [] as Array<[number, string, Array<{ title: string; done: boolean }>]>,
    diyOpenLive: (job: string) => hooks.diyOpened.push(job),
    diyProgress: (fraction: number, note: string, steps: Array<{ title: string; done: boolean }>) =>
      hooks.diyProgressed.push([fraction, note, steps]),
    crackPhone: () => hooks.cracked++,
    openPhone: () => undefined,
    openChat: (id: string) => hooks.opened.push(id),
    makeTask: (t: any) => {
      const el = document.createElement('div');
      el.className = 'task';
      el.dataset.id = String(t.id);
      el.innerHTML = `<div class="check"></div><span class="tt">${t.t}</span>`;
      return el;
    },
    markActive: () => undefined,
    shuffle: (a: unknown[]) => a,
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    money: (n: number) => '$' + Math.round(n).toLocaleString('en-US'),
    onSettle: null,
    owner: () => 'Travis',
    current: () => null,
    setCast: (owner: string, roles: Record<string, string>, focus: string) => (hooks.cast = { owner, roles, focus }),
  };
  document.body.append(hooks.taskList);
  return hooks;
}

async function boot(opts: { gameId?: string; seed?: number; project?: string; fetch?: typeof fetch; wrap?: (real: typeof fetch) => typeof fetch; phone?: Parameters<typeof createApp>[0] extends infer O ? (O extends { phone?: infer P } ? P : never) : never } = {}) {
  const app = createApp({ projects: realProjects(), phone: opts.phone });
  const bridge = bridgeFetch(app.handler);
  const created = await (await bridge('/api/games', {
    method: 'POST',
    body: JSON.stringify({ seed: opts.seed ?? 5, project: opts.project ?? 'wall-removal', owner: 'travis-potter' }),
  })).json();
  document.body.innerHTML = '<button id="quoteBtn"></button><b id="quoteVal"></b>';
  const hooks = makeHooks();
  (window as any).DIWHY_HOOKS = hooks;
  (window as any).DIWHY_SPEED = 400; // type and wait 400 times faster than real time
  vi.stubGlobal('fetch', opts.fetch ?? (opts.wrap ? opts.wrap(bridge) : bridge));
  history.replaceState(null, '', `/frontend/?game=${opts.gameId ?? created.id}`);
  (0, eval)(SCRIPT);
  await (window as any).DIWHY_LINK?.ready;
  return { hooks, app, bridge, created, id: created.id as string };
}

const card = () => document.getElementById('dwCard')!;
const options = () => [...document.querySelectorAll<HTMLButtonElement>('.dw-option')];
const waitForOptions = () => vi.waitFor(() => expect(options().length).toBe(3), { timeout: WAIT });

// Every test evals the link again. The last test's instance would keep its timers (bar loop, typing,
// waits) running against the new document and race the new one, so each test's timers are cleared at its end.
const live = { timeouts: new Set<any>(), intervals: new Set<any>() };
const realSetTimeout = globalThis.setTimeout;
const realSetInterval = globalThis.setInterval;
const realClearTimeout = globalThis.clearTimeout;
const realClearInterval = globalThis.clearInterval;

afterEach(() => {
  live.timeouts.forEach((t) => realClearTimeout(t));
  live.intervals.forEach((t) => realClearInterval(t));
  live.timeouts.clear();
  live.intervals.clear();
  globalThis.setTimeout = realSetTimeout;
  globalThis.setInterval = realSetInterval;
});

beforeEach(() => {
  globalThis.setTimeout = ((fn: any, ms?: number, ...a: any[]) => {
    const t = realSetTimeout(fn, ms, ...a);
    live.timeouts.add(t);
    return t;
  }) as any;
  globalThis.setInterval = ((fn: any, ms?: number, ...a: any[]) => {
    const t = realSetInterval(fn, ms, ...a);
    live.intervals.add(t);
    return t;
  }) as any;
  delete (window as any).DIWHY_LINK;
  document.getElementById('dwStyle')?.remove();
  document.head.querySelectorAll('link[href="/assets/style.css"]').forEach((l) => l.remove());
});

describe('game-link: starting up', () => {
  it('does nothing without ?game, so the page keeps running its own demo', async () => {
    document.body.innerHTML = '';
    (window as any).DIWHY_HOOKS = makeHooks();
    history.replaceState(null, '', '/frontend/');
    (0, eval)(SCRIPT);
    expect((window as any).DIWHY_LINK).toBeUndefined();
    expect(document.getElementById('dwCard')).toBeNull();
  });

  it('without a game, waits in the house; taking on a glowing spot starts that job on the backend', async () => {
    const app = createApp({ projects: realProjects() });
    const bridge = bridgeFetch(app.handler);
    document.body.innerHTML = '<button id="quoteBtn"></button><b id="quoteVal"></b>';
    const hooks = makeHooks();
    (window as any).DIWHY_HOOKS = hooks;
    (window as any).DIWHY_SPEED = 400;
    vi.stubGlobal('fetch', bridge);
    history.replaceState(null, '', '/frontend/?owner=gigi-singh&seed=3');
    (0, eval)(SCRIPT);
    await (window as any).DIWHY_LINK.ready;

    // Waiting: no game, no card, the owner is cast, the page's own spots are still on.
    expect(document.documentElement.classList.contains('dw-pending')).toBe(true);
    expect(document.documentElement.classList.contains('dw-live')).toBe(false);
    expect(document.getElementById('dwCard')).toBeNull();
    expect(hooks.cast.owner).toBe('Gigi');
    expect(typeof hooks.onStartProject).toBe('function');

    hooks.onStartProject('dryer'); // "Take it on" at the basement spot
    await waitForOptions();
    expect(hooks.started).toBe(true);
    expect(document.documentElement.classList.contains('dw-live')).toBe(true);
    const game = (window as any).DIWHY_LINK.game();
    expect(game.project.id).toBe('dryer-replacement');
    expect(game.seed).toBe(3);
    expect(game.cast.owner).toBe('gigi-singh');
    expect(location.search).toBe(`?game=${game.id}`); // a reload resumes it
    // The contractor's quote arrives now, and the job's last step sits on the post-it.
    expect(hooks.msgs.contractor[0].t).toContain('cost estimate');
    expect(hooks.taskList.textContent).toContain('Finish the dryer replacement');

    hooks.onStartProject('wall'); // a second spot does nothing: one job per game
    await new Promise((r) => setTimeout(r, 30));
    expect((window as any).DIWHY_LINK.game().id).toBe(game.id);
  });

  it('ignores a spot it does not know', async () => {
    document.body.innerHTML = '';
    const hooks = makeHooks();
    (window as any).DIWHY_HOOKS = hooks;
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => { calls.push(String(url)); throw new Error('no network expected'); });
    history.replaceState(null, '', '/frontend/?owner=gigi-singh');
    (0, eval)(SCRIPT);
    await (window as any).DIWHY_LINK.ready;
    hooks.onStartProject('attic');
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
    expect(hooks.started).toBeFalsy();
  });

  it('casts the game with the backend\'s cast, as first names', async () => {
    const { hooks, created } = await boot();
    expect(hooks.cast.owner).toBe('Travis');
    const expected = Object.fromEntries(Object.entries(created.cast.roles).map(([r, id]) => [r, (id as string).split('-')[0].replace(/^./, (c) => c.toUpperCase())]));
    expect(hooks.cast.roles).toEqual(expected);
    expect(hooks.cast.focus).toBe(created.cast.partnerFocus);
  });

  it('puts the contractor\'s quote in the contractor\'s chat, and the bars on the game\'s numbers', async () => {
    const { hooks } = await boot();
    expect(hooks.msgs.contractor[0].t).toContain('$10,000');
    expect(hooks.msgs.contractor[0].t).toContain('14 days');
    expect(hooks.plan).toEqual({ days: 14, budget: 10000 });
    expect(hooks.S.time * hooks.PLAN_DAYS).toBeLessThan(1); // day 0: only the clock creeping inside it
    expect(hooks.S.budget).toBe(0);
    expect(hooks.S.health).toBe(1);
  });

  it('counts the bars up to a new value instead of jumping, never past the backend\'s day, and notes the cost', async () => {
    const { hooks, created } = await boot({ seed: 9, project: 'carpet-replacement' });
    (window as any).DIWHY_SPEED = 1; // real time for this one, so the count-up can be seen
    document.body.insertAdjacentHTML('beforeend', '<div class="note"><div id="s-time"></div></div>'); // the stats post-it
    await waitForOptions();
    options()[2].click();
    await vi.waitFor(() => expect(document.getElementById('dwCostNote')?.textContent).toMatch(/That cost/), { timeout: WAIT });
    // Money on hold at the bank is not spent yet: the bar waits for "Yes, it was me".
    if (hooks.paid.length) {
      expect(hooks.S.budget).toBe(0);
      hooks.settleFirst(true);
      await vi.waitFor(() => expect((window as any).DIWHY_LINK.game().charge?.status).not.toBe('pending'), { timeout: WAIT });
    }
    const g = (window as any).DIWHY_LINK.game();
    const target = g.stats.spent / hooks.PLAN_BUDGET;
    // The cost counts up to the new value, and never goes past it.
    expect(hooks.S.budget).toBeLessThanOrEqual(target);
    await vi.waitFor(() => expect(hooks.S.budget).toBeCloseTo(target, 3), { timeout: WAIT });
    // Time never runs ahead of the backend's day, and gets there.
    expect(Math.floor(hooks.S.time * hooks.PLAN_DAYS + 1e-6)).toBeLessThanOrEqual(g.stats.daysElapsed);
    await vi.waitFor(() => expect(Math.floor(hooks.S.time * hooks.PLAN_DAYS + 1e-6)).toBe(g.stats.daysElapsed), { timeout: WAIT });
    expect(created.stats.daysElapsed).toBe(0);
    await waitForOptions(); // let the game finish showing its next event before the next test
    (window as any).DIWHY_SPEED = 400;
  });

  it('shows the first event on the tasks post-it, above the last step, and ignores ticking by hand', async () => {
    const { hooks, created } = await boot();
    await waitForOptions();
    const titles = [...hooks.taskList.querySelectorAll('.tt')].map((e) => e.textContent);
    expect(titles).toEqual([created.event.title, 'Finish the wall removal']); // the event, then the last step
    (hooks.taskList.querySelector('.check') as HTMLElement).click(); // does nothing
    expect(hooks.tasks.every((t: any) => !t.done)).toBe(true);
  });

  it('loads the brand and locks the owner picker', async () => {
    await boot();
    expect(document.documentElement.classList.contains('dw-live')).toBe(true);
    expect(document.head.querySelector('link[href="/assets/style.css"]')).not.toBeNull();
  });
});

describe('game-link: the event card', () => {
  it('types out the event and offers three options', async () => {
    const { created } = await boot();
    await waitForOptions();
    expect(card().querySelector('.dw-title')!.textContent).toBe(created.event.title);
    expect(card().querySelector('.dw-desc')!.textContent).toBe(created.event.description);
    expect(options().map((b) => b.textContent!.replace(/^\d/, ''))).toEqual(created.event.choices.map((c: any) => c.label));
  });

  it('lets the keys 1 to 3 pick', async () => {
    const { created } = await boot();
    await waitForOptions();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' })); // the second option
    await vi.waitFor(() => expect(card().querySelector('.dw-title')!.textContent).not.toBe(created.event.title));
  });

  it('texts the advice from the right person and says so on the card', async () => {
    // Find a seed whose first event comes with advice.
    let found: any;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const r = await boot({ seed });
      if (r.created.event.advice) found = r;
    }
    expect(found).toBeDefined();
    await waitForOptions();
    const who = found.created.event.advice.from as string;
    await vi.waitFor(() => expect(found.hooks.delivered.some(([id]: [string]) => id === who)).toBe(true));
    const text = found.hooks.delivered.find(([id]: [string]) => id === who)[1] as string;
    expect(text).toContain(found.created.event.choices[found.created.event.advice.pick].label);
    const hint = card().querySelector<HTMLButtonElement>('.dw-hint')!;
    expect(hint.textContent).toContain('texted you');
    hint.click();
    expect(found.hooks.opened).toContain(who);
  });
});

/** A stand-in for the local model that writes whatever the prompt asks for, and records the prompts. */
function writer() {
  const prompts: string[] = [];
  const fetch = async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const user: string = body.messages[1].content;
    prompts.push(user);
    const pick = /in quotes: "(.*?)"/.exec(user)?.[1];
    const text = pick ? `Model says: ${pick}.` : user.includes('CHAT SO FAR') ? 'Model answer.' : 'Model reaction.';
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ text, replies: ['Button A.', 'Button B.', 'Button C.'] }) } }), { status: 200 });
  };
  return { fetch, prompts };
}

async function bootWithAdvice(phone?: Parameters<typeof boot>[0] extends infer O ? (O extends { phone?: infer P } ? P : never) : never) {
  for (let seed = 0; seed < 40; seed++) {
    const r = await boot({ seed, phone });
    if (r.created.event.advice) return r;
  }
  throw new Error('no seed with advice');
}

describe('game-link: the phone writer', () => {
  it('delivers the model\'s text, and suggests its buttons for that chat', async () => {
    const w = writer();
    const r = await bootWithAdvice({ url: 'http://model', fetch: w.fetch });
    const who = r.created.event.advice.from as string;
    const label = r.created.event.choices[r.created.event.advice.pick].label as string;
    await vi.waitFor(() => expect(r.hooks.delivered.some(([id]: [string]) => id === who)).toBe(true));
    expect(r.hooks.delivered.find(([id]: [string]) => id === who)[1]).toBe(`Model says: ${label}.`);
    expect(r.hooks.suggested(who)).toEqual(['Button A.', 'Button B.', 'Button C.']);
    expect(r.hooks.suggested('bank')).toBeNull(); // other chats keep the page's own buttons
  });

  it('answers when the player taps a button: sends the chat so far, then shows new buttons', async () => {
    const w = writer();
    const r = await bootWithAdvice({ url: 'http://model', fetch: w.fetch });
    const who = r.created.event.advice.from as string;
    await vi.waitFor(() => expect(r.hooks.suggested(who)).not.toBeNull());
    r.hooks.msgs[who].push({ t: 'Model says hi.', me: false }, { t: 'Button B.', me: true }); // what the page does on a tap
    r.hooks.onReply(who, 'Button B.');
    expect(r.hooks.suggested(who)).toEqual([]); // no stale buttons while they answer
    await vi.waitFor(() => expect(r.hooks.delivered.some(([id, t]: [string, string]) => id === who && t === 'Model answer.')).toBe(true));
    expect(w.prompts.at(-1)).toContain('Button B.');
    expect(r.hooks.suggested(who)).toEqual(['Button A.', 'Button B.', 'Button C.']);
  });

  it('does not ask the model about the bank or the contractor', async () => {
    const w = writer();
    const r = await bootWithAdvice({ url: 'http://model', fetch: w.fetch });
    await vi.waitFor(() => expect(r.hooks.suggested(r.created.event.advice.from)).not.toBeNull());
    const before = w.prompts.length;
    r.hooks.onReply('bank', 'Yes, it was me.');
    r.hooks.onReply('contractor', "I'll do it myself.");
    await new Promise((res) => setTimeout(res, 20));
    expect(w.prompts.length).toBe(before);
  });

  it('keeps the page\'s own lines and buttons when the model is off', async () => {
    const r = await bootWithAdvice({ url: 'http://model', fetch: async () => { throw new Error('connection refused'); } });
    const who = r.created.event.advice.from as string;
    await vi.waitFor(() => expect(r.hooks.delivered.some(([id]: [string]) => id === who)).toBe(true));
    expect(r.hooks.delivered.find(([id]: [string]) => id === who)[1]).toContain(r.created.event.choices[r.created.event.advice.pick].label);
    expect(r.hooks.suggested(who)).toBeNull();
    r.hooks.msgs[who].push({ t: 'x', me: true });
    r.hooks.onReply(who, 'x'); // nothing comes back, and the buttons go back to the page's own
    await vi.waitFor(() => expect(r.hooks.suggested(who)).toBeNull());
  });
});

describe('game-link: making choices', () => {
  it('sends the choice, moves the bars and shows the next event', async () => {
    const { hooks, created } = await boot();
    await waitForOptions();
    options()[1].click();
    await vi.waitFor(() => expect(card().querySelector('.dw-title')!.textContent).not.toBe(created.event.title));
    await waitForOptions();
    expect(hooks.S.time * 30 + hooks.S.budget).toBeGreaterThan(0);
  });

  it('tells the player what the last choice did, in a .dw-last line on the next card', async () => {
    const { bridge, id } = await boot();
    await waitForOptions();
    expect(document.querySelector('.dw-last')!.hasAttribute('hidden')).toBe(true); // nothing has happened yet
    options()[1].click();
    await vi.waitFor(() => expect(document.querySelector('.dw-last:not([hidden])')).not.toBeNull(), { timeout: WAIT });
    const o = (await (await bridge(`/api/games/${id}`)).json()).outcome;
    expect(o.lines.length).toBeGreaterThan(0);
    const text = document.querySelector('.dw-last')!.textContent!;
    for (const line of o.lines) expect(text).toContain(line);
    if (o.cost > 0) expect(text).toContain('$');
  });

  it('keeps the post-it rows: a row is added per event and ticked off, never wiped and redrawn', async () => {
    const { hooks } = await boot({ seed: 9, project: 'carpet-replacement' });
    await waitForOptions();
    const firstRow = hooks.taskList.querySelector('.task') as HTMLElement;
    const lastRow = hooks.taskList.querySelector('.task:last-child') as HTMLElement;
    expect(lastRow.textContent).toContain('Finish the carpet replacement');

    options()[1].click();
    await vi.waitFor(() => expect(hooks.taskList.querySelectorAll('.task').length).toBe(3));
    await waitForOptions();

    // The very same elements are still there: the answered event is ticked off, a new one joined it.
    const rowsNow = [...hooks.taskList.querySelectorAll('.task')];
    expect(rowsNow[0]).toBe(firstRow);
    expect(rowsNow.at(-1)).toBe(lastRow);
    expect(firstRow.classList.contains('done')).toBe(true);
    expect(rowsNow[1].classList.contains('done')).toBe(false); // the event on the table now
    expect(hooks.tasks.map((t: any) => t.done)).toEqual([true, false, false]);
  });

  it('lets the oldest finished rows slide away so the post-it does not overflow', async () => {
    const { hooks } = await boot({ seed: 2, project: 'wall-removal' });
    for (let i = 0; i < 7; i++) {
      await vi.waitFor(() => expect(options().length >= 2 || document.querySelector('.dw-report')).toBeTruthy(), { timeout: WAIT });
      if (document.querySelector('.dw-report')) break;
      options()[1].click();
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, 60));
    const finished = [...hooks.taskList.querySelectorAll('.task.done')];
    expect(finished.length).toBeLessThanOrEqual(5); // 4 kept, plus one still sliding away
    expect(hooks.tasks.filter((t: any) => t.done).length).toBeLessThanOrEqual(5);
    expect(hooks.taskList.querySelector('.task:last-child')!.textContent).toContain('Finish the wall removal');
  });

  it('sends every purchase through pay(), holding it back from the budget until the bank is answered', async () => {
    const { hooks } = await boot();
    for (let i = 0; i < 6 && hooks.paid.length === 0; i++) {
      await waitForOptions();
      options()[1].click();
      await vi.waitFor(() => expect(document.querySelectorAll('.dw-option[disabled]').length).toBe(0), { timeout: WAIT });
    }
    expect(hooks.paid.length).toBeGreaterThan(0);
    const [amount] = hooks.paid.at(-1)!;
    expect(amount).toBeGreaterThan(0);
    // The page's budget bar shows only what the bank has confirmed: spent minus the amount on hold.
    const spent = (hooks.S.budget * 24000) + hooks.heldTotal();
    const view = await (await fetch(`/api/games/${(window as any).DIWHY_LINK.game().id}`)).json();
    expect(Math.round(spent)).toBe(view.stats.spent);
  });

  it('tells the backend when the player confirms the bank, and when they block their own card', async () => {
    const { hooks, id } = await boot();
    for (let i = 0; i < 6 && hooks.paid.length === 0; i++) {
      await waitForOptions();
      options()[1].click();
      await vi.waitFor(() => expect(document.querySelectorAll('.dw-option[disabled]').length).toBe(0), { timeout: WAIT });
    }
    const before = await (await fetch(`/api/games/${id}`)).json();
    hooks.settleFirst(false); // "No, block it."
    await vi.waitFor(async () => {
      const after = await (await fetch(`/api/games/${id}`)).json();
      expect(after.charge.status).toBe('blocked');
      expect(after.stats.daysElapsed).toBe(before.stats.daysElapsed + 1);
    });
  });

  it('has the cast react: the partner nags, the neighbor hears a blow-up, and so on', async () => {
    const { hooks } = await boot({ seed: 9, project: 'carpet-replacement' });
    for (let i = 0; i < 8; i++) {
      await waitForOptions().catch(() => undefined);
      if (!options().length) break;
      options()[2].click(); // the "excessive" or "wrong" end of the options, to give them something to say
      await vi.waitFor(() => expect(document.querySelectorAll('.dw-option[disabled]').length).toBe(0), { timeout: WAIT });
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 50));
    const who = new Set(hooks.delivered.map(([id]: [string]) => id));
    expect(who.size).toBeGreaterThanOrEqual(2);
    // Lines come from the page's own chatter pools, never invented here.
    for (const [id, text] of hooks.delivered) {
      const pool = hooks.pool[id] as string[];
      const own = (text as string).startsWith(`${id} line`);
      const advice = /"/.test(text as string);
      expect(own || advice, `${id}: ${text}`).toBe(true);
      if (own) expect(pool).toContain(text);
    }
  });
});

describe('game-link: the contractor and the end', () => {
  it('asks the backend for a new quote and puts it on the post-it and in the chat', async () => {
    const { hooks } = await boot();
    for (let i = 0; i < 4; i++) {
      await waitForOptions();
      options()[0].click();
      await vi.waitFor(() => expect(document.querySelectorAll('.dw-option[disabled]').length).toBe(0), { timeout: WAIT });
    }
    document.getElementById('quoteBtn')!.click();
    await vi.waitFor(() => expect(hooks.msgs.contractor.length).toBe(2));
    expect(hooks.msgs.contractor[1].t).toMatch(/^Revised: \d+ days and \$\d/);
    expect(hooks.plan.budget).toBeGreaterThan(10000);
    expect(hooks.plan.days).toBeGreaterThan(14);
  });

  it('plays to the end and shows the report against the contractor, with a way to play again', async () => {
    await boot({ seed: 2, project: 'dryer-replacement' });
    for (let i = 0; i < 14 && !document.querySelector('.dw-report'); i++) {
      // Most events have three options. The last step has two.
      await vi.waitFor(() => expect(options().length >= 2 || document.querySelector('.dw-report')).toBeTruthy(), { timeout: WAIT });
      if (document.querySelector('.dw-report')) break;
      options()[1].click();
      await new Promise((r) => setTimeout(r, 30));
    }
    await vi.waitFor(() => expect(document.querySelector('.dw-report')).not.toBeNull(), { timeout: WAIT });
    const text = document.querySelector('.dw-report')!.textContent!;
    expect(text).toContain('Contractor quote');
    expect(text).toContain('$1,800');
    expect(text).toContain('Why did you do it yourself?');
    expect(document.querySelector<HTMLAnchorElement>('#dwAgain')!.getAttribute('href')).toBe('/app/');
    expect(document.getElementById('dwCard')!.hidden).toBe(true);
  });
});

describe('game-link: the elevation view', () => {
  it(`opens the job's view and tells it how far along the backend says the work is`, async () => {
    const { hooks } = await boot({ seed: 2, project: 'wall-removal' });
    await waitForOptions();
    expect(hooks.diyOpened).toContain('wall');
    expect(hooks.diyProgressed[0][0]).toBe(0);
    expect(hooks.diyProgressed[0][1]).toBe("Spent $0 of the contractor's $10,000");
    options()[1].click();
    const latest = () => hooks.diyProgressed[hooks.diyProgressed.length - 1];
    await vi.waitFor(() => expect(latest()[0]).toBeCloseTo(1 / 9), { timeout: WAIT });
    const last = latest();
    expect(last[1]).toMatch(/^Spent \$[\d,]+ of the contractor's \$10,000$/);
  });

  it('lists only the events the player has met: the answered ones, then the one on the table', async () => {
    const { hooks } = await boot({ seed: 2, project: 'wall-removal' });
    await waitForOptions();
    const latest = () => hooks.diyProgressed[hooks.diyProgressed.length - 1][2];
    const first = (window as any).DIWHY_LINK.game().event.title;
    await vi.waitFor(() => expect(latest()).toEqual([{ title: first, done: false }]), { timeout: WAIT });
    options()[1].click();
    await vi.waitFor(() => expect(latest().length).toBe(2), { timeout: WAIT });
    const now = (window as any).DIWHY_LINK.game().event.title;
    expect(latest()).toEqual([
      { title: first, done: true },
      { title: now, done: false },
    ]);
  });
});

describe('game-link: the report when you beat the quote', () => {
  it('says "Under the quote" instead of a negative overrun', async () => {
    const underTheQuote = (real: typeof fetch) =>
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await real(input, init);
        const body = await res.clone().json().catch(() => null);
        if (!body?.report) return res;
        body.report.overrunPct = -12;
        return new Response(JSON.stringify(body), { status: res.status, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch;
    const { hooks } = await boot({ seed: 2, project: 'dryer-replacement', wrap: underTheQuote });
    await waitForOptions();
    hooks.onReply('contractor', 'Give up.'); // any ending shows the same report rows
    await vi.waitFor(() => expect(document.querySelector('.dw-report')).not.toBeNull(), { timeout: WAIT });
    const text = document.querySelector('.dw-report')!.textContent!;
    expect(text).toContain('Under the quote');
    expect(text).toContain('12%');
    expect(text).not.toContain('Cost overrun');
    expect(text).not.toContain('-12');
  });
});

describe('game-link: giving up', () => {
  it(`the contractor's "Give up." reply ends the game and shows the contractor's bill`, async () => {
    const { hooks, bridge, id } = await boot({ seed: 2, project: 'dryer-replacement' });
    await waitForOptions();
    hooks.onReply('contractor', 'Give up.'); // the page calls this when the red reply is tapped
    await vi.waitFor(() => expect(document.querySelector('.dw-report')).not.toBeNull(), { timeout: WAIT });
    const text = document.querySelector('.dw-report')!.textContent!;
    expect(text).toContain('The contractor fixed everything');
    expect(text).toContain('rush job');
    expect(text).toContain('Call-out fee');
    expect(text).toContain("The contractor's bill");
    expect(text).toContain('$2,430'); // $1,800 quote x1.35 = $2,430, plus $250 call-out = $2,680
    expect(text).toContain('$2,680');
    expect(text).toContain('All in');
    expect(text).toContain('Cost overrun');
    expect(document.getElementById('dwCard')!.hidden).toBe(true);
    const g = await (await bridge(`/api/games/${id}`)).json();
    expect(g.failure).toBe('giveup');
  });

  it(`"I'll do it myself." does not give up`, async () => {
    const { hooks, bridge, id } = await boot({ seed: 2, project: 'dryer-replacement' });
    await waitForOptions();
    hooks.onReply('contractor', "I'll do it myself.");
    await new Promise((r) => setTimeout(r, 100));
    expect((await (await bridge(`/api/games/${id}`)).json()).status).toBe('playing');
    expect(document.querySelector('.dw-report')).toBeNull();
  });
});

describe('game-link: when things go wrong', () => {
  it('says the game is gone when the server no longer knows it, and offers a fresh start', async () => {
    await boot({ gameId: 'does-not-exist' });
    expect(card().textContent).toContain("isn't here any more");
    expect(card().querySelector<HTMLAnchorElement>('a')!.getAttribute('href')).toBe('/app/');
  });

  it('says so when the server cannot be reached, and recovers on retry', async () => {
    let up = false;
    const app = createApp({ projects: realProjects() });
    const good = bridgeFetch(app.handler);
    const created = await (await good('/api/games', { method: 'POST', body: JSON.stringify({ seed: 5, project: 'wall-removal', owner: 'travis-potter' }) })).json();
    const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!up) throw new TypeError('fetch failed');
      return good(input, init);
    }) as typeof fetch;
    await boot({ gameId: created.id, fetch: flaky });
    expect(card().textContent).toContain("Can't reach the game server");
    up = true;
    card().querySelector<HTMLButtonElement>('#dwRetry')!.click();
    await waitForOptions();
  });
});

describe('game-link: the elevation view follows the event', () => {
  const recorder = () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const elev = { show: (t: string[]) => calls.push(['show', t]), burst: (k: string) => calls.push(['burst', k]), clear: () => calls.push(['clear']), draw: () => undefined };
    (window as any).DIWHY_ELEV = elev;
    return calls;
  };
  afterEach(() => delete (window as any).DIWHY_ELEV);

  it('shows the picture tokens of each card', async () => {
    const calls = recorder();
    await boot({ project: 'dryer-replacement' });
    const g = (window as any).DIWHY_LINK.game();
    expect(g.event.visual.length).toBeGreaterThan(0);
    expect(calls.find((c) => c[0] === 'show')).toEqual(['show', g.event.visual]);
  });

  it('bursts when an answer blows up, by the kind of trouble, then clears at the report', async () => {
    const calls = recorder();
    const kindOf = (c: string | null) => (c === 'plumbing' || c === 'envelope' ? 'water' : c === 'electrical' ? 'sparks' : 'dust');
    let blew = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      calls.length = 0;
      document.body.innerHTML = '';
      delete (window as any).DIWHY_LINK;
      await boot({ seed, project: 'wall-removal' });
      for (let i = 0; i < 9 && !document.querySelector('.dw-report'); i++) {
        await vi.waitFor(() => expect(options().length >= 2 || document.querySelector('.dw-report')).toBeTruthy(), { timeout: WAIT });
        if (document.querySelector('.dw-report')) break;
        const asked = (window as any).DIWHY_LINK.game().event;
        options()[options().length - 1].click();
        await vi.waitFor(() => expect((window as any).DIWHY_LINK.game().event?.id !== asked.id || (window as any).DIWHY_LINK.game().status !== 'playing').toBe(true), { timeout: WAIT });
        const o = (window as any).DIWHY_LINK.game().outcome;
        if (o.blewUp) {
          blew++;
          await vi.waitFor(() => expect(calls.some((c) => c[0] === 'burst')).toBe(true));
          expect(calls.filter((c) => c[0] === 'burst').at(-1)).toEqual(['burst', kindOf(asked.category)]);
        }
      }
      await vi.waitFor(() => expect(document.querySelector('.dw-report')).toBeTruthy(), { timeout: WAIT });
      expect(calls.at(-1)).toEqual(['clear']); // nothing is left on the picture at the report
      if (blew) break;
    }
    expect(blew).toBeGreaterThan(0);
  });

  it('works without the prop kit on the page', async () => {
    delete (window as any).DIWHY_ELEV;
    await boot({ project: 'dryer-replacement' });
    await waitForOptions();
    options()[0].click();
    await vi.waitFor(() => expect(document.querySelectorAll('.dw-option[disabled]').length).toBe(0), { timeout: WAIT });
  });
});
