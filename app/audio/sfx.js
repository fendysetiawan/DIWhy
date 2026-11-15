// Interface sounds, from assets/sounds/ui/ and assets/sounds/effects/:
//   click  any button press (wired up once for the whole page by listenForClicks)
//   pop    something appears: a line of narration, a button, the title
//   stamp  the SOLD! stamp landing on the sign
//   celebrate  a champagne cork, fizz and a little 8-bit ta-da (the house is yours)
//   creak, crash  the house front giving way and landing
//
//   import { sfx, listenForClicks } from "../audio/sfx.js";   sfx("pop")

const FILES = { click: "ui/click.wav", pop: "ui/pop.wav", stamp: "ui/stamp.wav", celebrate: "ui/celebrate.wav", creak: "effects/house-creak.mp3", crash: "effects/house-crash.mp3" };
const VOLUME = { click: 0.5, pop: 0.35, stamp: 0.8, celebrate: 0.6, creak: 1, crash: 1 };
const cache = {};

const get = (name) => (cache[name] ||= new Audio(`/assets/sounds/${FILES[name]}`));

/** Load sounds ahead of time so the first play isn't late. */
export function preloadSfx(...names) { for (const n of names) get(n).load(); }

export function sfx(name) {
  const a = get(name);
  a.volume = VOLUME[name] ?? 0.5;
  a.currentTime = 0;
  a.play().catch(() => {}); // browsers stay silent until the first click; that's fine
}

export function listenForClicks() {
  document.addEventListener("click", (e) => { if (e.target.closest("button, .pick")) sfx("click"); }, true);
}
