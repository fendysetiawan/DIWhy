// The hands-free demo. Open /app/?demo=1 (or press "watch the demo" on the character screen) and the
// whole game plays itself at 1.5x speed with a visible mouse, from the splash to the final report.
//
//   ?demo=1         turn it on (it rides along when the page changes)
//   ?speed=3        try another speed; 1.5 is the demo default
//   Escape, or just moving the real mouse, takes over.
//
// It drives the REAL pages by clicking their real buttons, so it keeps working as the game changes.
// Each page has a short script in pages/. See README.md.

import { createActor, Stopped } from "./actor.js";
import { DEMO } from "./config.js";

export const DEMO_SPEED = DEMO.speed;

export function demoSpeed(params = new URLSearchParams(location.search)) {
  const n = Number(params.get("speed"));
  return Number.isFinite(n) && n > 0 ? n : DEMO_SPEED;
}

/** Run the demo for one page: "app" (splash to story) or "game" (the gameplay page). */
export async function start(page) {
  const speed = demoSpeed();
  window.DIWHY_SPEED = speed; // the pages type and wait this much faster
  const actor = createActor({ speed });

  // CSS animations and transitions speed up too, whenever they start.
  const faster = () => document.getAnimations().forEach((a) => { if (a.playbackRate !== speed) a.playbackRate = speed; });
  const timer = setInterval(faster, 80);

  let finished = false;
  try {
    const script = await import(`./pages/${page}.js`);
    await script.run(actor);
    finished = true;
  } catch (err) {
    if (!(err instanceof Stopped)) console.error("[demo]", err);
  } finally {
    clearInterval(timer);
    window.DIWHY_SPEED = 1;
    document.getAnimations().forEach((a) => (a.playbackRate = 1));
    if (finished) {
      document.documentElement.dataset.demo = "finished"; // the page can see the demo ran to the end
      await new Promise((r) => setTimeout(r, 4000));
    }
    actor.stop();
  }
}
