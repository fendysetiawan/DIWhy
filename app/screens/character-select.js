// Screen 2: character select. (Aidan's screen, restored from git history 391db4d and extended.)
// Everyone stands still facing front; the one you hover (or pick) stays bright and the rest fade
// back. The first character is picked to start with, so someone is always selected. Picking someone
// plays their emote sound (audio/emotes.js). New: a Start button (or Enter) confirms the pick, and
// the screen resolves with the chosen character.

import { createScreen, leave } from "./screen.js";
import { playEmote } from "../audio/emotes.js";
import { getSetting, setSetting } from "../settings.js";

export const CAST = [
  { id: "travis-potter", name: "Travis" },
  { id: "aidan-newsome", name: "Aidan" },
  { id: "rachel-katz", name: "Rachel" },
  { id: "christian-huber", name: "Christian" },
  { id: "ramy-maher", name: "Ramy" },
  { id: "gigi-singh", name: "Gigi" },
  { id: "fendy-seitiawan", name: "Fendy" },
];

const sprite = (id) => `/assets/characters/${id}/front-still.svg`;

/** Resolves with the chosen character, after Start is pressed. */
export function characterSelect(root) {
  const el = createScreen(root, "select", `
    <h1 class="select-title brand-title">pick your diy-er</h1>
    <div class="cast" role="radiogroup" aria-label="Characters">
      ${CAST.map((c) => `
        <button class="pick" type="button" role="radio" aria-checked="${c.id === CAST[0].id}" data-id="${c.id}">
          <span class="pick-sprite"><img src="${sprite(c.id)}" alt="" /></span>
          <span class="pick-name brand-text">${c.name}</span>
        </button>`).join("")}
    </div>
    <button class="select-start brand-button" type="button">START</button>
    <label class="skip-intro brand-text">
      <input type="checkbox" ${getSetting("skipIntro", false) ? "checked" : ""} />
      skip intro
    </label>
    <a class="watch-demo brand-text" href="?demo=1">watch the demo</a>
  `);
  el.querySelector(".skip-intro input").addEventListener("change", (e) => setSetting("skipIntro", e.target.checked));
  const cast = el.querySelector(".cast");
  let chosen = CAST[0];

  cast.addEventListener("click", (e) => {
    const btn = e.target.closest(".pick");
    if (!btn) return;
    for (const b of cast.querySelectorAll(".pick")) b.setAttribute("aria-checked", String(b === btn));
    playEmote(btn.dataset.id);
    chosen = CAST.find((c) => c.id === btn.dataset.id);
  });

  return new Promise((resolve) => {
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      leave(el).then(() => resolve(chosen));
    };
    const onKey = (e) => { if (e.key === "Enter" && !e.target.closest("label, a")) start(); };
    el.querySelector(".select-start").addEventListener("click", start);
    window.addEventListener("keydown", onKey);
  });
}
