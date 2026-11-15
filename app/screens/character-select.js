// Screen 2: character select. (Aidan's screen, restored from git history 391db4d and extended.)
// Everyone stands still facing front; the one you hover (or pick) stays bright and the rest fade
// back. The first character is picked to start with, so someone is always selected. Picking someone
// plays their emote sound (audio/emotes.js). New: a Start button (or Enter) confirms the pick, and
// the screen resolves with the chosen character (plus `hero`: their sprite, still on screen, for the title).

import { createScreen, leave } from "./screen.js";
import { playEmote } from "../audio/emotes.js";

export const CAST = [
  { id: "travis-potter", name: "Travis" },
  { id: "aidan-newsome", name: "Aidan" },
  { id: "rachel-katz", name: "Rachel" },
  { id: "christian-huber", name: "Christian" },
  { id: "ramy-maher", name: "Ramy" },
  { id: "gigi-singh", name: "Gigi" },
  { id: "fendy-seitiawan", name: "Fendy" },
];

// the same pose (and pixels) as the start of the falling-house title, so picking someone flows straight into it
// Character select shows each person's emote art: a still of its first frame, then the animation when picked.
// Both are the same drawing in the same 238 x 297 box, so starting the emote never shifts anyone.
const sprite = (id) => `/assets/characters/${id}/emote-start.svg`;
const emote = (id) => `/assets/characters/${id}/emote.svg`;
const still = (img, id) => { img.src = sprite(id); };
function startEmote(img, id) {
  const next = new Image();             // load first, then swap in one go: no blank frame
  next.onload = () => { img.src = next.src; };
  next.src = `${emote(id)}?v=${Date.now()}`; // a fresh URL starts the animation from the beginning
}

// The title starts from reaction-start.svg (an 88 x 123 pixel drawing). [width, height, x, y]: where the
// first emote frame sits relative to that still pose, measured from the artwork, so the character handed to
// the title can be placed over the emote art at the same height, feet and centre.
const EMOTE_FIT = {
  "travis-potter": [200.0, 249.6, -2.9, 2.4], "aidan-newsome": [205.0, 255.8, -1.7, 0.6],
  "rachel-katz": [204.2, 254.8, -1.6, 0.5], "christian-huber": [202.0, 252.1, -1.0, 2.5],
  "ramy-maher": [200.9, 250.7, -1.9, 2.9], "gigi-singh": [200.7, 250.4, -3.0, 2.4],
  "fendy-seitiawan": [200.9, 250.7, -2.0, 2.9],
};

/** Resolves with the chosen character, after Start is pressed. */
export function characterSelect(root) {
  const el = createScreen(root, "select", `
    <div class="select-stage">
    <h1 class="select-title brand-title">pick your diy-er</h1>
    <div class="cast" role="radiogroup" aria-label="Characters">
      ${CAST.map((c) => `
        <button class="pick" type="button" role="radio" aria-checked="${c.id === CAST[0].id}" data-id="${c.id}">
          <span class="pick-sprite"><img src="${sprite(c.id)}" alt="" /></span>
          <span class="pick-name brand-text">${c.name}</span>
        </button>`).join("")}
    </div>
    </div>
    <button class="select-start brand-button brand-next" type="button">START</button>
    <a class="watch-demo brand-text" href="?demo=1">watch the demo</a>
  `);
  const cast = el.querySelector(".cast");
  let chosen = CAST[0];

  cast.addEventListener("click", (e) => {
    const btn = e.target.closest(".pick");
    if (!btn) return;
    for (const b of cast.querySelectorAll(".pick")) {
      b.setAttribute("aria-checked", String(b === btn));
      const img = b.querySelector("img");
      // the picked one does their emote (standing, then a victory pose, once); the rest stand still
      if (b === btn) startEmote(img, b.dataset.id);
      else if (!img.src.endsWith("emote-start.svg")) still(img, b.dataset.id);
    }
    playEmote(btn.dataset.id);
    chosen = CAST.find((c) => c.id === btn.dataset.id);
  });

  return new Promise((resolve) => {
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      playEmote(chosen.id); // their line again as they head off
      document.body.dataset.backdrop = "black"; // fade to black, not to the stars (style.css)
      // the picked character stays on screen while everything else fades to black; the title
      // (screens/title.js) then walks them into the falling-house scene
      // as reaction-start.svg (the title's first frame), placed over their emote art
      const img = el.querySelector(`.pick[data-id="${chosen.id}"] img`);
      const r = img.getBoundingClientRect();
      const [w, , tx, ty] = EMOTE_FIT[chosen.id] || [r.width, 0, 0, 0];
      const k = r.width / w;                          // emote px on screen per measured px
      const hw = 176 * k, hh = 246 * k;               // the still pose's box at this size
      const hero = new Image();
      hero.src = `/assets/characters/${chosen.id}/reaction-start.svg`;
      hero.className = "hero";
      Object.assign(hero.style, { left: r.left + r.width / 2 - tx * k - hw / 2 + "px", top: r.bottom - ty * k - hh + "px", width: hw + "px", height: hh + "px" });
      document.body.append(hero);
      leave(el).then(() => resolve({ ...chosen, hero }));
    };
    const onKey = (e) => { if (e.key === "Enter" && !e.target.closest("a")) start(); };
    el.querySelector(".select-start").addEventListener("click", start);
    window.addEventListener("keydown", onKey);
  });
}
