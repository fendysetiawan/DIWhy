// Background music for the intro, from assets/sounds/music/:
//   select  upbeat, for character select
//   menu    calm, for the story after START
// playMusic(name) fades the current track out and the new one in. Browsers only allow sound after the
// player has clicked or pressed a key, so if it can't start yet it starts on the first click or key press.
//
//   playMusic("select")   duckMusic(true) while someone talks

const VOLUME = 0.3;
const FADE_MS = 600;
let music = null, ducked = false;

const target = () => (ducked ? VOLUME * 0.35 : VOLUME);

function fade(a, to, ms, then) {
  const from = a.volume, t0 = performance.now();
  const step = (now) => {
    const k = Math.max(0, Math.min(1, (now - t0) / ms)); // a frame time can precede t0
    a.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step); else then?.();
  };
  requestAnimationFrame(step);
}

export function playMusic(name) {
  const src = `/assets/sounds/music/${name}.mp3`;
  if (music && music.src.endsWith(src)) return;
  const old = music;
  if (old) fade(old, 0, FADE_MS, () => old.pause());
  const a = (music = new Audio(src));
  a.loop = true;
  a.volume = 0;
  const start = () => a.play().then(() => {
    removeEventListener("pointerdown", start, true);
    removeEventListener("keydown", start, true);
    fade(a, target(), FADE_MS);
  }).catch(() => {});
  addEventListener("pointerdown", start, true);
  addEventListener("keydown", start, true);
  start();
}

/** Turn the music down while someone is talking, and back up after. */
export function duckMusic(on) {
  ducked = on;
  if (music) fade(music, target(), 250);
}
