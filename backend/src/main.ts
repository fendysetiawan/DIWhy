// Bootstraps the reference front end. It is a client of the backend: it sends requests through
// GameClient and draws the GameView it gets back. It holds no game rules.
//
// This is also the only file that knows dev tools exist, and it loads them (a separate chunk)
// only when dev mode is on.
//
// URL options:
//   ?seed=42      reproducible playthrough
//   ?dev=1        dev mode on (?dev=0 forces it off). Otherwise the last toggle is remembered.
//   ?director=jev with dev mode on, start with the local model picking events
//
// Build-time option:
//   VITE_API_URL  point at a backend on another origin, e.g. http://localhost:3001

import './style.css';
import { createHttpClient } from './client/GameClient';
import type { DevHost } from './devHost';
import type { DirectorName, GameView } from './service/types';
import { renderGame } from './ui/render';
import { setParam } from './ui/util';

const DEV_KEY = 'diwhy.dev';
const randomSeed = () => Math.floor(Math.random() * 1_000_000);

function readSeed(): number {
  const raw = new URLSearchParams(location.search).get('seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : randomSeed();
}

/** The URL wins; otherwise use whatever was chosen last time. Default: off. */
function readDevMode(): boolean {
  const q = new URLSearchParams(location.search).get('dev');
  if (q === '1') return true;
  if (q === '0') return false;
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false; // storage blocked
  }
}

const client = createHttpClient({ baseUrl: import.meta.env.VITE_API_URL ?? '' });

const root = document.getElementById('app')!;
root.innerHTML = `<div class="layout" id="layout"><main id="game"></main><aside id="dev" class="dev" hidden></aside></div>`;
const layout = document.getElementById('layout')!;
const gameEl = document.getElementById('game')!;
const devEl = document.getElementById('dev')!;

let game: GameView | null = null;
let busy = true;
let error: string | null = null;
let devOn = readDevMode();
let unmountDev: (() => void) | null = null;
let requestCount = 0; // only the newest request may change the screen
let toggleCount = 0; // lets a late-arriving dev chunk notice it was switched off again
const listeners = new Set<() => void>();

function emit(): void {
  draw();
  listeners.forEach((fn) => fn());
}

/** Run one backend call and show its result. A newer call makes an older one's result irrelevant. */
async function run(call: () => Promise<GameView>): Promise<void> {
  const mine = ++requestCount;
  busy = true;
  error = null;
  emit();
  try {
    const next = await call();
    if (mine !== requestCount) return;
    game = next;
  } catch (e) {
    if (mine !== requestCount) return;
    const status = (e as { status?: number }).status;
    error =
      status === 0
        ? "Can't reach the DIWhy server. Is it running?"
        : e instanceof Error
          ? e.message
          : 'Something went wrong.';
  }
  busy = false;
  emit();
}

function start(seed: number, director: DirectorName): Promise<void> {
  setParam('seed', seed);
  return run(() => client.createGame({ seed, director }, { debug: devOn }));
}

function choose(index: number): Promise<void> | undefined {
  const g = game;
  if (busy || !g?.event) return;
  // eventId makes the backend reject the click if the screen was out of date.
  return run(() => client.choose(g.id, { choice: index, eventId: g.event!.id }, { debug: devOn }));
}

function refresh(): Promise<void> {
  const g = game;
  return g ? run(() => client.getGame(g.id, { debug: devOn })) : start(readSeed(), 'random');
}

function draw(): void {
  renderGame(gameEl, {
    game,
    busy,
    error,
    devMode: devOn,
    onChoose: (i) => void choose(i),
    onRestart: () => void start(randomSeed(), game?.director ?? 'random'),
    onReplay: () => void start(game?.seed ?? readSeed(), game?.director ?? 'random'),
    onRetry: () => void refresh(),
    onToggleDev: () => {
      const on = !devOn;
      try {
        localStorage.setItem(DEV_KEY, on ? '1' : '0');
      } catch {
        /* storage blocked: the toggle still works for this page load */
      }
      setParam('dev', null); // the remembered choice replaces any ?dev= in the URL
      void setDev(on);
    },
  });
}

/** What dev tools are allowed to see and do. */
const devHost: DevHost = {
  game: () => game,
  busy: () => busy,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async setDirector(name) {
    setParam('director', name);
    await start(game?.seed ?? readSeed(), name);
  },
};

/** Switch dev mode. The dev code is only downloaded the first time it is switched on. */
async function setDev(on: boolean): Promise<void> {
  const mine = ++toggleCount;
  devOn = on;
  draw();
  if (on) {
    const { mountDev } = await import('./dev');
    if (mine !== toggleCount) return; // switched off while the chunk was loading
    devEl.hidden = false;
    unmountDev = mountDev(devHost, devEl);
    layout.classList.add('with-dev');
    if (game && !game.debug) void refresh(); // fetch the debug payload for the game on screen
  } else {
    unmountDev?.();
    unmountDev = null;
    devEl.hidden = true;
    layout.classList.remove('with-dev');
    setParam('director', null);
    // Leaving dev mode means playing the plain game, so drop the model director.
    if (game && game.director !== 'random') void start(game.seed, 'random');
  }
}

draw();
const wantsJev = new URLSearchParams(location.search).get('director') === 'jev';
void start(readSeed(), devOn && wantsJev ? 'jev' : 'random');
if (devOn) void setDev(true);
