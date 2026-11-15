// The title: the character you picked moves from character select into the scene, the house front
// falls on them, the "!" pops up, DIWHY?! appears, and it all fades to black. Built from three assets
// on the same 8.82 s timeline (see assets/README.md, "Scenes"):
//   assets/cinematics/falling-house.svg            the house, 840 x 660 frame
//   assets/characters/<id>/reaction.svg         the person, at 377,435 (88 x 123) in that frame
//   assets/effects/exclamation.svg              the "!", at 408,378 (24 x 48), from 74.6% to the end
//
//   await titleCard(screenElement, character)   character.hero: their sprite from character select (optional)

const SPEED = 1.6;                 // the artwork runs 8.82 s; we play it this much faster
const LENGTH = 8820 / SPEED;      // ms, one pass of the house animation (it loops, so we leave before it restarts)
const CREAK_AT = 0.23;            // the front starts to tip
const CRASH_AT = 0.45;            // it lands (measured: the front stops moving at 45% of the loop): crash and dust
const BANG_AT = 0.746;            // the "!" appears
const TITLE_AT = LENGTH * 0.78;   // ms: DIWHY?! appears
const FADE_AT = LENGTH * 0.91;    // ms: everything fades to black
const FADE = 600;
const MOVE = 900;         // ms: the character moving into place (matches .hero in style.css)

import { sfx, preloadSfx } from "../audio/sfx.js";

const place = (x, y, w, h) =>
  `left:${(x / 840) * 100}%;top:${(y / 660) * 100}%;width:${(w / 840) * 100}%;height:${(h / 660) * 100}%`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a burst of pixel dust along the ground where the front lands (frame y 560-620, x 90-750 of 840 x 660)
function dust(stage) {
  for (let k = 0; k < 18; k++) {
    const d = document.createElement("i");
    d.className = "title-dust";
    const x = 90 + Math.random() * 660, y = 560 + Math.random() * 60, s = 14 + Math.random() * 22;
    Object.assign(d.style, { left: (x / 840) * 100 + "%", top: (y / 660) * 100 + "%", width: (s / 840) * 100 + "%", animationDelay: Math.random() * 0.12 + "s" });
    d.style.setProperty("--dx", (x < 420 ? -1 : 1) * (20 + Math.random() * 60) + "px");
    d.style.setProperty("--dy", -(10 + Math.random() * 50) + "px");
    stage.append(d);
    setTimeout(() => d.remove(), 1600);
  }
}

const faster = async (url) => {
  const svg = (await (await fetch(url)).text()).replaceAll('dur="8820ms"', `dur="${Math.round(LENGTH)}ms"`);
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
};

export async function titleCard(root, character) {
  preloadSfx("creak", "crash", "pop");
  const box = document.createElement("div");
  box.className = "title-card";
  box.innerHTML = `
    <div class="title-stage">
      <img class="title-house" alt="" style="${place(0, 0, 840, 660)}" />
      <img class="title-who" alt="" style="${place(377, 435, 88, 123)}" />
      <img class="title-bang" src="/assets/effects/exclamation.svg" alt="" style="${place(408, 378, 24, 48)}" />
    </div>
    <h1 class="title-name brand-title">DIWHY?!</h1>`;
  root.append(box);
  const house = box.querySelector(".title-house"), who = box.querySelector(".title-who");

  // 1. walk the picked character from character select to their spot in the scene (feet on the same line)
  const hero = character.hero;
  if (hero) {
    await new Promise(requestAnimationFrame);
    // the hero is reaction-start.svg, the same frame as reaction.svg's first, so it lands exactly on it
    const t = who.getBoundingClientRect();
    Object.assign(hero.style, { left: t.left + "px", top: t.top + "px", width: t.width + "px", height: t.height + "px" });
    await sleep(MOVE);
  }

  // 2. the house appears around them and starts falling. Both SVGs are loaded as text with their
  //    8.82 s timeline shortened, so they play faster and start together.
  const [houseUrl, whoUrl] = await Promise.all([faster("/assets/cinematics/falling-house.svg"), faster(`/assets/characters/${character.id}/reaction.svg`)]);
  house.src = houseUrl; who.src = whoUrl;
  await Promise.all([house, who].map((i) => i.decode().catch(() => {})));
  box.classList.add("on");
  if (hero) { hero.style.opacity = 0; setTimeout(() => hero.remove(), 300); }

  // 3. creak, crash and dust, "!", DIWHY?!, fade out
  setTimeout(() => sfx("creak"), LENGTH * CREAK_AT);
  setTimeout(() => { sfx("crash"); dust(box.querySelector(".title-stage")); }, LENGTH * CRASH_AT);
  setTimeout(() => { box.classList.add("bang"); sfx("pop"); }, LENGTH * BANG_AT);
  setTimeout(() => { box.classList.add("named"); sfx("pop"); }, TITLE_AT);
  setTimeout(() => box.classList.add("out"), FADE_AT);
  await sleep(FADE_AT + FADE);
  box.remove();
}
