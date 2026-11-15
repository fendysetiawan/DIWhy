// Scene 1, the contract: our cinematic (assets/cinematics/contract.html). The paper unrolls,
// the player signs on the line (SIGN stays disabled until they do), then presses SIGN.
//
//   await signContract(screenElement)   resolves once the player has signed and pressed SIGN

import { openFilm } from "./cinematic.js";
import { sfx } from "../audio/sfx.js";
import { narrate } from "../audio/narrator.js";

export async function signContract(root) {
  const film = await openFilm(root);
  const scene = await film.play("contract");
  narrate("contract"); // "Congratulations on purchasing your first home... Sign right here on the dotted line."

  // SIGN is always there, bottom right, and stays disabled until there's a signature on the line
  const button = document.createElement("button");
  button.type = "button";
  button.className = "brand-button brand-next contract-sign";
  button.textContent = "SIGN";
  button.disabled = true;
  film.box.append(button);
  scene.events.addEventListener("signed", () => { button.disabled = false; sfx("pop"); }, { once: true });

  // pen on paper while signing: a sketchy scratch that loops while the pen moves, goes quiet when it stops
  const pad = film.box.querySelector(".contract-pad");
  const pen = new Audio("/assets/sounds/ui/pen.wav"); // a scratchy sketching loop
  pen.loop = true; pen.volume = 0;
  let down = false, quiet = null;
  pad.addEventListener("pointerdown", () => { if (!pad.classList.contains("ready")) return; down = true; pen.play().catch(() => {}); });
  pad.addEventListener("pointermove", () => {
    if (!down) return;
    pen.volume = 0.6;
    clearTimeout(quiet); quiet = setTimeout(() => { pen.volume = 0; }, 90); // the pen stopped moving
  });
  const lift = () => { down = false; pen.pause(); };
  addEventListener("pointerup", lift); addEventListener("pointercancel", lift);
  await new Promise((resolve) => button.addEventListener("click", resolve, { once: true }));
  scene.release();
  lift(); removeEventListener("pointerup", lift); removeEventListener("pointercancel", lift);
  await narrate("contract-signed"); // "Now it's yours, warts and all."

  await film.close();
}
