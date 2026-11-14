// The demo for the gameplay page: read the advice, pick an option on each event card, answer the
// bank, ask the contractor for a new quote, and finish on the report.
//
// What it picks follows a policy by step (see ../config.js), not specific events, so editing the
// event files changes the story but never breaks the demo. Every element it touches is listed in
// ../selectors.js.

import { DEMO } from "../config.js";
import { SEL } from "../selectors.js";

export const POLICY = DEMO.policy;

/** The index of the option with the wanted quality; falls back to a good one, then the first. */
export function chooseIndex(want, qualities) {
  const q = qualities || [];
  const hit = q.indexOf(want);
  if (hit >= 0) return hit;
  const good = q.indexOf("good");
  return good >= 0 ? good : 0;
}

const $ = (s) => document.querySelector(s);

export async function run(a) {
  await waitForLink(a);
  const H = window.DIWHY_HOOKS;
  let step = 0;
  let charges = 0;

  // The phone is always on. Which screen it shows is phone.dataset.app: "home", "messages" or "chat".
  const screen = () => $(SEL.phone).dataset.app;
  async function openChat(id) {
    if (screen() === "chat") await a.click(SEL.backButton); // back to the list of chats
    else if (screen() !== "messages") {
      if (screen() !== "home") await a.click(SEL.homeButton); // out of another app
      await a.click(SEL.messagesApp); // from the home screen into Messages
    }
    await a.click(SEL.contactOf(id));
  }
  async function goHome() {
    if (screen() !== "home") await a.click(SEL.homeButton);
  }

  for (;;) {
    const [, which] = await a.waitForAny([SEL.option, SEL.report]);
    if (which === 1) break; // the report is up

    // Someone texted advice about this event: have a look.
    if ($(SEL.hint)) {
      await a.sleep(500);
      await a.click(SEL.hint);
      await a.sleep(2800); // reading it
      await goHome();
    }

    // Choose.
    const game = window.DIWHY_LINK.game();
    const qualities = game.debug && game.debug.choiceQualities;
    const finale = game.event.kind === "finale";
    const index = chooseIndex(finale ? DEMO.finalePick : POLICY[step % POLICY.length], qualities);
    const options = [...document.querySelectorAll(SEL.option)];
    await a.sleep(700);
    for (const other of options.filter((_, i) => i !== index).slice(0, 1)) await a.hover(other); // weighing it up
    await a.click(options[index]);
    step++;

    // The bank texts about the purchase: answer it.
    await a.sleep(2200);
    if (H.heldTotal() > 0) {
      charges++;
      await openChat("bank");
      await a.waitFor(SEL.reply);
      const buttons = [...document.querySelectorAll(SEL.reply)];
      await a.click(charges === DEMO.blockTheCardOnCharge ? buttons[1] : buttons[0]); // "No, block it." or "Yes, it was me."
      await a.sleep(2200);
      await goHome();
    }

    // Once the work is under way, ask the contractor where the quote stands.
    if (step === DEMO.askTheContractorAfterEvents) {
      await openChat("contractor");
      await a.click(SEL.quoteButton);
      await a.sleep(2200);
      await goHome();
    }
  }

  await a.sleep(5500); // let the report sink in
}

async function waitForLink(a) {
  const t0 = Date.now();
  while (!(window.DIWHY_LINK && window.DIWHY_LINK.game && window.DIWHY_LINK.game())) {
    if (Date.now() - t0 > 30000) throw new Error("the demo gave up waiting for the game to load");
    await a.sleep(300);
  }
}
