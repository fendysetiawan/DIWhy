// Screen 1: splash. (Aidan's screen, restored from git history 391db4d.) It opens on "press any key" in
// the middle of the stars. The key press (or click) lets the browser play sound, so then the globe and
// "around the world games presents" fade in with the logo sound, stay a few seconds (click to skip), and fade out.

import { createScreen, leave } from "./screen.js";

const SHOW_MS = 3500; // long enough for the logo sound (3.1 s): "Around the world... GAMES... presents"

export function splash(root) {
  const el = createScreen(root, "splash", `
    <p class="splash-hint brand-text">press any key</p>
  `);

  const sting = new Audio("/assets/sounds/logo/around-the-world-games.wav"); // assets/sounds/logo/
  sting.volume = 0.8;
  sting.load();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      leave(el).then(resolve);
    };
    const start = () => {
      removeEventListener("pointerdown", start); removeEventListener("keydown", start);
      el.innerHTML = `
        <div class="splash-logo">
          <img class="splash-globe" src="/assets/logos/around-the-world-games-logo.svg" alt="" />
          <p class="splash-text">around the world games presents</p>
        </div>`;
      sting.play().catch(() => {});
      setTimeout(finish, SHOW_MS);
      // click to skip (armed a moment later, so the press that started it doesn't also skip it)
      setTimeout(() => el.addEventListener("click", finish), 500);
    };
    addEventListener("pointerdown", start); addEventListener("keydown", start);
  });
}
