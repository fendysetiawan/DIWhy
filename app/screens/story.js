// The story, from plan/plan.md. Short lines of narration; click (or Enter, Space, NEXT) for the next one.
//
//   0. The title: the house front falls on your character, "!", then DIWHY?! (screens/title.js).
//   1. The contract (assets/cinematics/contract.html). You sign, then press SIGN. Fade.
//   2. The house you just bought (assets/cinematics/sold.html): FOR SALE, stamped SOLD! Then straight to the game.
//
//   await story(root, { character })

import { sfx } from "../audio/sfx.js";
import { createScreen } from "./screen.js";
import { signContract } from "./contract.js";
import { openFilm } from "./cinematic.js";
import { titleCard } from "./title.js";

const speed = () => window.DIWHY_SPEED || 1;
const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
// Under reduced motion, pauses shrink and text appears at once. Under the demo, everything speeds up.
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 150) : ms / speed()));

// Kept short: the player reads each line in one go.
const SCENE_2 = "No contractor. Just you, some tools, and a lot of confidence.";

export async function story(root, { character }) {
  const el = createScreen(root, "story", `
    <div class="caption brand-window" aria-live="polite">
      <img class="caption-cat" src="/assets/characters/cat/sitting.svg" alt="" />
      <p class="caption-text brand-text"></p>
    </div>
    <button class="caption-next brand-button brand-next" type="button">NEXT</button>
  `);
  const q = (s) => el.querySelector(s);
  const caption = q(".caption");
  const text = q(".caption-text");

  // A line of narration appears whole (no typing). Click, Enter, Space or NEXT to go on.
  function say(line) {
    sfx("pop");
    caption.classList.add("on", "ready");
    caption.classList.remove("choosing");
    text.textContent = line;
    return new Promise((resolve) => {
      const next = (e) => {
        if (e.type === "keydown" && !["Enter", " ", "ArrowRight"].includes(e.key)) return;
        window.removeEventListener("pointerdown", next);
        window.removeEventListener("keydown", next);
        resolve();
      };
      // attach on the next frame so the click that got us here doesn't count
      requestAnimationFrame(() => {
        window.addEventListener("pointerdown", next);
        window.addEventListener("keydown", next);
      });
    });
  }


  // Ask a question with buttons. Click one, or press 1 to 9.



  const fadeOut = async () => { caption.classList.remove("on", "ready"); await wait(900); }; // fully to black (the scenes fade in 0.8 s) before the next one starts

  // ---- The title: the house falls on your character, "!", DIWHY?!
  await titleCard(el, character);

  // ---- Scene 1: the contract. Sign, then SIGN
  await signContract(el);

  // ---- Scene 2: the house you just bought: FOR SALE, stamped SOLD!
  const house = await openFilm(el);
  const sold = await house.play("sold", { manual: true });
  await wait(900);
  sold.send("stamp");
  sfx("stamp");
  setTimeout(() => sfx("celebrate"), 350); // pop the champagne
  await wait(600);
  await say("Congratulations. You own a house.");
  await say(SCENE_2);

  await fadeOut();
  await house.close();
  el.classList.add("black");
}
