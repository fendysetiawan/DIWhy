// DIWHY?! — runs the screens in order. Each screen lives in screens/.

import { splash } from "./screens/splash.js";
import { characterSelect } from "./screens/character-select.js";
import { getSetting } from "./settings.js";

const app = document.getElementById("app");

// The intro always plays, unless "skip intro" is ticked on the character screen.
if (!getSetting("skipIntro", false)) {
  await splash(app);
}

characterSelect(app, {
  onPick(character) {
    // The next screen hooks in here.
    window.dispatchEvent(new CustomEvent("character:chosen", { detail: character }));
  },
});
