// DIWHY?!: the front door. Runs the screens in order, then hands the game to the gameplay page.
//
//   splash  ->  pick your diy-er  ->  the story (contract, house, where to start, the quote)
//   ->  start the game on the backend  ->  /frontend/?game=<id>
//
// Add ?demo=1 to watch the whole thing play itself (see demo/).

import { createGame, listProjects } from "./api.js";
import { getSetting } from "./settings.js";
import { characterSelect } from "./screens/character-select.js";
import { splash } from "./screens/splash.js";
import { story } from "./screens/story.js";
import { createScreen } from "./screens/screen.js";

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
// ?demo=1 plays everything (about 2 minutes 15 at the demo's 1.5x). ?demo=short skips the intro and
// plays just the game (about a minute and a half).
const demoMode = params.get("demo");
const shortDemo = demoMode === "short";
const demo = demoMode === "1" || shortDemo;
// The demo plays one fixed game, so it tells the same story every time: the dryer chain through to the
// beehive, a cat in the vent, a shortcut that blows up, and an overrun. See demo/README.md.
const DEMO_SEED = 0;
const DEMO_OWNER = "gigi-singh";
const DEMO_PROJECT = "dryer-replacement";

if (demo && !shortDemo) {
  // The demo drives these same screens with a visible mouse, at 1.5x speed.
  window.DIWHY_SPEED = Number(params.get("speed")) || 1.5; // set now, so the very first screen is already fast
  import("/demo/index.js").then((m) => m.start("app")).catch((e) => console.error("demo failed to start", e));
}

function showError(message) {
  const el = createScreen(app, "error", `
    <p class="brand-text brand-highlight">can't reach the game</p>
    <p class="brand-text">${message}</p>
    <button class="brand-button" type="button">Try again</button>`);
  el.querySelector("button").addEventListener("click", () => location.reload());
}

function startGame(game) {
  const next = new URLSearchParams({ game: game.id });
  if (demo) next.set("demo", "1");
  if (params.get("speed")) next.set("speed", params.get("speed"));
  location.assign(`/frontend/?${next}`);
}

try {
  if (shortDemo) {
    // Straight to the game: the same owner, job and seed the full demo uses.
    startGame(await createGame({ owner: DEMO_OWNER, project: DEMO_PROJECT, seed: DEMO_SEED }));
  } else {
    // The intro always plays, unless "skip intro" is ticked (and never when demoing).
    if (demo || !getSetting("skipIntro", false)) await splash(app);

    const character = await characterSelect(app);
    const projects = await listProjects();
    const { project } = await story(app, { character, projects });

    startGame(await createGame({ owner: character.id, project: project.id, ...(demo ? { seed: DEMO_SEED } : {}) }));
  }
} catch (err) {
  showError(err && err.message ? err.message : "Something went wrong.");
}
