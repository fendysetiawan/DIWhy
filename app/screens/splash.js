// Screen 1: splash. (Aidan's screen, restored from git history 391db4d.) The globe and "around the world games presents" fade in,
// stay for a few seconds (click to skip), then fade out.

import { createScreen, leave } from "./screen.js";

const SHOW_MS = 3500;

export function splash(root) {
  const el = createScreen(root, "splash", `
    <img class="splash-globe" src="/assets/logos/around-the-world-games-logo.svg" alt="" />
    <p class="splash-text">around the world games presents</p>
  `);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      leave(el).then(resolve);
    };
    setTimeout(finish, SHOW_MS);
    el.addEventListener("click", finish);
  });
}
