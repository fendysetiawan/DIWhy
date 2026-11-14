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
const demo = params.get("demo") === "1";

if (demo) {
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

try {
  // The intro always plays, unless "skip intro" is ticked (and never when demoing).
  if (demo || !getSetting("skipIntro", false)) await splash(app);

  const character = await characterSelect(app);
  const projects = await listProjects();
  const { project } = await story(app, { character, projects });

  const game = await createGame({ owner: character.id, project: project.id });
  const next = new URLSearchParams({ game: game.id });
  if (demo) next.set("demo", "1");
  if (params.get("speed")) next.set("speed", params.get("speed"));
  location.assign(`/frontend/?${next}`);
} catch (err) {
  showError(err && err.message ? err.message : "Something went wrong.");
}
