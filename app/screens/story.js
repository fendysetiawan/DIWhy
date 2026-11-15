// The story, from plan/plan.md. Typewriter narration; click (or Enter, Space) for the next line.
//
//   1. The contract: a paper unrolls, the text is too small to read, you sign and press the check.
//   2. The house, morning, the "sold" sign. The cat walks in. The narration sets up the game.
//   3. The living room. You look at the wall, then at your phone: an AI render of what it could be.
//   4. The contractor texts. You answer: "I'll do it myself."
//
// There is no "where do you start?": the job is found in the house, on the gameplay page, by walking
// to one of its glowing DIY spots.
//
// Scene 3 has no art yet (a placeholder card stands in for the AI render). The house picture and
// the deed paper are the team's art, restored from git history 391db4d (see app/README.md).
//
//   await story(root, { character })

import { playEmote } from "../audio/emotes.js";
import { chime, tap } from "../audio/chime.js";
import { createScreen } from "./screen.js";
import { signDeed } from "./deed.js";

const speed = () => window.DIWHY_SPEED || 1;
const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
// Under reduced motion, pauses shrink and text appears at once. Under the demo, everything speeds up.
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 150) : ms / speed()));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The plan's scene 2, word for word.
const SCENE_2 =
  "On this day, one homeowner decides to go against the advice of a contractor. " +
  "Deciding to take it on themselves, they grab their tools, roll up their sleeves, " +
  "and set out to prove just how hard it can be to DIY.";

export async function story(root, { character }) {
  const el = createScreen(root, "story", `
    <div class="stage" aria-hidden="true">
      <div class="camera">
        <img class="house" src="/app/story/house-sold.png" alt="" />
        <img class="cat" src="/assets/characters/cat/standing.svg" alt="" />
      </div>
    </div>
    <div class="living" aria-hidden="true">
      <img class="owner" src="/assets/characters/${character.id}/front-still.svg" alt="" />
      <div class="render brand-window">
        <p class="brand-text brand-highlight">AI render</p>
        <p class="render-title brand-title">Open plan. Bright. Perfect.</p>
        <p class="render-blurb brand-text">Every wall gone, every room lit. It looks easy.</p>
      </div>
    </div>
    <div class="phone-scene" aria-hidden="true">
      <div class="phone-mock">
        <div class="phone-head brand-text">Contractor</div>
        <div class="bubbles"></div>
        <div class="reply"></div>
      </div>
    </div>
    <div class="caption brand-window" aria-live="polite">
      <p class="caption-text brand-text"></p>
      <span class="caption-next" aria-hidden="true">&#9654;</span>
    </div>
  `);
  const q = (s) => el.querySelector(s);
  const caption = q(".caption");
  const text = q(".caption-text");

  // Type a line out, then wait for a click, key or tap to move on. A click while it is still
  // typing finishes the line instead.
  function say(line, { ms = 28 } = {}) {
    caption.classList.add("on");
    caption.classList.remove("ready", "choosing");
    text.textContent = "";
    return new Promise((resolve) => {
      let i = 0;
      let typing = true;
      const finish = () => {
        clearInterval(tick);
        text.textContent = line;
        typing = false;
        caption.classList.add("ready");
      };
      const tick = reduced() ? null : setInterval(() => {
        text.textContent = line.slice(0, ++i);
        if (i >= line.length) finish();
      }, ms / speed());
      if (reduced()) finish();
      const next = (e) => {
        if (e.type === "keydown" && !["Enter", " ", "ArrowRight"].includes(e.key)) return;
        if (typing) return finish();
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

  const fadeOut = async () => { caption.classList.remove("on"); el.classList.remove("house-on", "living-on", "phone-on"); await wait(700); };

  // ---- Scene 1: the contract
  await signDeed(el);
  await wait(500);

  // ---- Scene 2: the house, the cat, the narration
  el.classList.add("house-on");
  await wait(1400);
  const cat = q(".cat");
  cat.classList.add("walking");
  await wait(3200);
  cat.src = "/assets/characters/cat/sitting.svg";
  cat.classList.add("seated");
  await say(SCENE_2, { ms: 34 });
  await say("Congratulations. You own a house.");

  await fadeOut();

  // ---- Scene 3: the living room and the AI render
  el.classList.add("living-on");
  await wait(900);
  await say("The living room. Beige. Quiet. Full of potential.");
  q(".owner").classList.add("in");
  await wait(1600);
  await say("You look at the wall. Then at your phone.");
  q(".render").classList.add("on");
  await say("The AI shows you how beautiful it could be. How hard could it be?");
  chime();
  await say("A phone chimes.");
  await fadeOut();

  // ---- Scene 4: the contractor's text
  el.classList.add("phone-on");
  await wait(900);
  const bubbles = q(".bubbles");
  const reply = q(".reply");
  // No numbers yet: the real quote arrives on the gameplay page, once you pick a job in the house.
  const line = "Heard you bought the place. Whatever you decide to fix, call me first and I'll give you a number.";
  const incoming = document.createElement("p");
  incoming.className = "bubble them brand-text";
  bubbles.append(incoming);
  await new Promise((resolve) => {
    let i = 0;
    const done = () => { incoming.textContent = line; resolve(); };
    if (reduced()) return done();
    const t = setInterval(() => {
      incoming.textContent = line.slice(0, ++i);
      if (i >= line.length) { clearInterval(t); resolve(); }
    }, 22 / speed());
  });
  await wait(800);
  playEmote(character.id); // the disgruntled grumble

  const button = document.createElement("button");
  button.type = "button";
  button.className = "brand-button reply-button";
  button.textContent = "I'll do it myself.";
  reply.append(button);
  await new Promise((resolve) => button.addEventListener("click", resolve, { once: true }));
  button.remove();
  const mine = document.createElement("p");
  mine.className = "bubble me brand-text";
  mine.textContent = "I'll do it myself.";
  bubbles.append(mine);
  tap();
  await wait(1700);
  await fadeOut();
  el.classList.add("black");
}
