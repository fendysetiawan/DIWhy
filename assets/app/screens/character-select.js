// Screen 2: character select. Everyone stands still facing front; the one you
// hover (or pick) stays bright and the rest fade back. The first character
// is picked to start with, so someone is always selected. Picking someone plays
// their emote sound (audio/emotes.js) and calls onPick(character).

import { createScreen } from "./screen.js";
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

const sprite = (id) => `assets/sprites/team/${id}/front-still.svg`;

export function characterSelect(root, { onPick = () => {} } = {}) {
  const el = createScreen(root, "select", `
    <h1 class="select-title">pick your diy-er</h1>
    <div class="cast" role="radiogroup" aria-label="Characters">
      ${CAST.map((c) => `
        <button class="pick" type="button" role="radio" aria-checked="${c.id === CAST[0].id}" data-id="${c.id}">
          <span class="pick-sprite"><img src="${sprite(c.id)}" alt="" /></span>
          <span class="pick-name">${c.name}</span>
        </button>`).join("")}
    </div>
    <label class="skip-intro">
      <input type="checkbox" ${getSetting("skipIntro", false) ? "checked" : ""} />
      skip intro
    </label>
  `);
  el.querySelector(".skip-intro input").addEventListener("change", (e) => setSetting("skipIntro", e.target.checked));
  const cast = el.querySelector(".cast");

  cast.addEventListener("click", (e) => {
    const btn = e.target.closest(".pick");
    if (!btn) return;
    for (const b of cast.querySelectorAll(".pick")) b.setAttribute("aria-checked", String(b === btn));
    playEmote(btn.dataset.id);
    onPick(CAST.find((c) => c.id === btn.dataset.id));
  });

  return el;
}
