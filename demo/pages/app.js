// The demo for the front door: splash, pick a character, sign the contract, click through the story.
// It ends when the page moves on to the game, where pages/game.js takes over.
//
// Every element it touches is listed in ../selectors.js. Settings are in ../config.js.

import { DEMO } from "../config.js";
import { SEL } from "../selectors.js";

/** A loopy signature, as points from 0 to 1 across the signature box. */
export function signature() {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push({ x: 0.08 + t * 0.78, y: 0.5 + 0.34 * Math.sin(t * Math.PI * 5) * (1 - t * 0.35) });
  }
  for (let i = 1; i <= 12; i++) pts.push({ x: 0.2 + (i / 12) * 0.66, y: 0.88 }); // the underline
  return pts;
}

export async function run(a) {
  // ---- splash: watch the logo for a moment, then click like a player would
  await a.waitFor(SEL.splash);
  await a.sleep(2300);
  await a.clickAnywhere();

  // ---- pick your diy-er: look around, choose, start
  await a.waitFor(`${SEL.select} ${SEL.pick}`);
  await a.sleep(700);
  await a.hover(SEL.pickOf("aidan-newsome"));
  await a.hover(SEL.pickOf("rachel-katz"));
  await a.click(SEL.pickOf(DEMO.owner));
  await a.sleep(900);
  await a.click(SEL.selectStart);

  // ---- the story: sign the contract, then read each line and click on; it ends by going to the game
  let signed = false;
  for (;;) {
    const [, which] = await a.waitForAny([SEL.captionReady, signed ? ".never" : SEL.contractPadReady]);
    if (which === 1) {
      // the contract: wait for the paper to unroll, sign on the line, then SIGN
      signed = true;
      await a.sleep(600);
      await a.drag(SEL.contractPad, signature());
      await a.sleep(500);
      await a.click(SEL.contractSign);
    } else {
      const length = (document.querySelector(SEL.captionText)?.textContent || "").length;
      await a.sleep(Math.min(3200, 500 + length * 22)); // time to read it
      await a.clickAnywhere();
    }
    await a.sleep(250);
  }
}
