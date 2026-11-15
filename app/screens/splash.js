// Screen 1: splash. (Aidan's screen, restored from git history 391db4d.) The globe and "around the world games presents" fade in,
// stay for a few seconds with the logo sound (click to skip), then fade out.

import { createScreen, leave } from "./screen.js";

const SHOW_MS = 3500; // long enough for the logo sound (3.1 s): "Around the world... GAMES... presents"

export function splash(root) {
  const el = createScreen(root, "splash", `
    <img class="splash-globe" src="/assets/logos/around-the-world-games-logo.svg" alt="" />
    <p class="splash-text">around the world games presents</p>
  `);

  // The logo sound (assets/sounds/logo/). Browsers block sound until the player clicks or presses a key,
  // so if it's blocked the logo waits with "press any key", then plays the sound and carries on.
  const sting = new Audio("/assets/sounds/logo/around-the-world-games.wav");
  sting.volume = 0.8;

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      leave(el).then(resolve);
    };
    // click to skip (armed a moment later, so the click that started the sound doesn't also skip it)
    const run = () => { setTimeout(finish, SHOW_MS); setTimeout(() => el.addEventListener("click", finish), 500); };
    sting.play().then(run).catch(() => {
      const hint = document.createElement("p");
      hint.className = "splash-hint brand-text";
      hint.textContent = "press any key";
      el.append(hint);
      const go = () => {
        removeEventListener("pointerdown", go); removeEventListener("keydown", go);
        hint.remove(); sting.play().catch(() => {}); run();
      };
      addEventListener("pointerdown", go); addEventListener("keydown", go);
    });
  });
}
