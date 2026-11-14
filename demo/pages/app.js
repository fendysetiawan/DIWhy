// The demo for the front door: splash, pick a character, sign the contract, click through the story,
// pick the dryer (the plan's showpiece: smoke, dust, wall, beehive), answer the contractor.
// It ends when the page moves on to the game, where pages/game.js takes over.

const OWNER = "gigi-singh";
const PROJECT = "Replace the smoking dryer";

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
  await a.waitFor(".splash");
  await a.sleep(2300);
  await a.clickAnywhere();

  // ---- pick your diy-er: look around, choose, start
  await a.waitFor(".select .pick");
  await a.sleep(700);
  await a.hover('.pick[data-id="aidan-newsome"]');
  await a.hover('.pick[data-id="rachel-katz"]');
  await a.click(`.pick[data-id="${OWNER}"]`);
  await a.sleep(900);
  await a.click(".select-start");

  // ---- the contract: sign, then the green check
  await a.waitFor(".deed-pad canvas");
  await a.sleep(1300);
  await a.drag(".deed-pad canvas", signature());
  await a.sleep(500);
  await a.click(".deed-check");

  // ---- the story: read each line, click to go on, pick the project, answer the contractor
  for (;;) {
    const [el, which] = await a.waitForAny([".choices .choice", ".reply-button", ".caption.ready:not(.choosing)"]);
    if (which === 0) {
      const options = [...document.querySelectorAll(".choices .choice")];
      const wanted = options.find((b) => b.textContent.includes(PROJECT)) || options[0];
      await a.sleep(900);
      for (const other of options.filter((b) => b !== wanted).slice(0, 2)) await a.hover(other);
      await a.click(wanted);
    } else if (which === 1) {
      await a.sleep(1200); // let the quote sink in
      await a.click(el);
    } else {
      const length = (document.querySelector(".caption-text")?.textContent || "").length;
      await a.sleep(Math.min(3200, 500 + length * 22)); // time to read it
      await a.clickAnywhere();
    }
    await a.sleep(250);
  }
}
