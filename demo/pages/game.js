// The demo for the gameplay page: read the advice, pick an option on each event card, answer the
// bank, ask the contractor for a new quote, and finish on the report.
//
// What it picks follows a policy by step, not specific events, so editing the event files changes
// the story but never breaks the demo: mostly sensible answers, one shortcut, one overkill.

export const POLICY = ["good", "good", "wrong", "good", "ok", "excessive", "good", "good", "good"];
const FINALE_PICK = "ok"; // finish it yourself: the risky one
const BLOCK_THE_CARD_ON = 3; // the third bank alert gets "No, block it." for drama
const ASK_CONTRACTOR_AFTER = 3; // after this many events, ask the contractor to update the quote

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

  const phoneIsOpen = () => $("#phone").classList.contains("open");
  async function openChat(id) {
    if (!phoneIsOpen()) await a.click("#statusBar"); // a click on the status bar pops the phone up
    else if ($("#phone").classList.contains("chat")) await a.click("#backBtn");
    await a.click(`.contact[data-id="${id}"]`);
  }
  async function putPhoneAway() {
    if (phoneIsOpen()) await a.click("#homeBtn");
  }

  for (;;) {
    const [, which] = await a.waitForAny([".dw-option", ".dw-report"]);
    if (which === 1) break; // the report is up

    // Someone texted advice about this event: have a look.
    if ($(".dw-hint")) {
      await a.sleep(500);
      await a.click(".dw-hint");
      await a.sleep(2800); // reading it
      await putPhoneAway();
    }

    // Choose.
    const game = window.DIWHY_LINK.game();
    const qualities = game.debug && game.debug.choiceQualities;
    const finale = game.event.kind === "finale";
    const index = chooseIndex(finale ? FINALE_PICK : POLICY[step % POLICY.length], qualities);
    const options = [...document.querySelectorAll(".dw-option")];
    await a.sleep(700);
    for (const other of options.filter((_, i) => i !== index).slice(0, 1)) await a.hover(other); // weighing it up
    await a.click(options[index]);
    step++;

    // The bank texts about the purchase: answer it.
    await a.sleep(2200);
    if (H.heldTotal() > 0) {
      charges++;
      await openChat("bank");
      await a.waitFor("#replies button");
      const buttons = [...document.querySelectorAll("#replies button")];
      await a.click(charges === BLOCK_THE_CARD_ON ? buttons[1] : buttons[0]); // "No, block it." or "Yes, it was me."
      await a.sleep(2200);
      await putPhoneAway();
    }

    // Once the work is under way, ask the contractor where the quote stands.
    if (step === ASK_CONTRACTOR_AFTER) {
      await openChat("contractor");
      await a.click("#quoteBtn");
      await a.sleep(2200);
      await putPhoneAway();
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
