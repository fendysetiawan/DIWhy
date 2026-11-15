// The narrator's voice-overs, from assets/sounds/narrator/ (recorded with ElevenLabs, voice "Jessica").
// The music dips while she talks.
//
//   await narrate("contract")   resolves when the line has finished (or straight away if sound is blocked)

import { duckMusic } from "./music.js";

let current = null;

export function narrate(name) {
  current?.pause();
  const a = (current = new Audio(`/assets/sounds/narrator/${name}.mp3`));
  a.volume = 1;
  duckMusic(true);
  return new Promise((resolve) => {
    const done = () => { if (current === a) duckMusic(false); resolve(); };
    a.addEventListener("ended", done, { once: true });
    a.play().catch(done);
  });
}
