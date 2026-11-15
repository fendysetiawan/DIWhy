// EVERYTHING the demo needs from the rest of the game, in one registry.
//
// The demo works by clicking the real pages' real buttons. So if someone renames a button, or removes
// a screen, or changes what a page exposes, the demo breaks. This file lists each thing it relies on,
// the file that owns it, and a few words that must still appear in that file. A test
// (backend/src/demo/demo.test.ts) checks every entry, so a rename fails the tests instead of quietly
// breaking the demo. (Run it with: npm test, in backend/.)
//
// When you change one of these things:   update the entry here AND the script in pages/ that uses it.
// When you add something a player must click:   add it here, and add a step for it in pages/.
//
// entry(selector, ownerFile, ...words): `words` must all appear in `ownerFile`.

const entry = (selector, file, ...words) => ({ selector, file, words });

/** Things on the page that the demo finds, hovers or clicks. */
export const REGISTRY = {
  // ---- the front door (app/)
  splash: entry(".splash", "app/screens/splash.js", '"splash"'),
  select: entry(".select", "app/screens/character-select.js", '"select"'),
  pick: entry(".pick", "app/screens/character-select.js", 'class="pick"', "data-id"),
  selectStart: entry(".select-start", "app/screens/character-select.js", "select-start"),
  contractPad: entry(".contract-pad", "assets/cinematics/contract.html", "contract-pad"),
  contractPadReady: entry(".contract-pad.ready", "assets/cinematics/contract.html", "contract-pad", '"ready"'),
  contractSign: entry(".contract-sign", "app/screens/contract.js", "contract-sign"),
  captionReady: entry(".caption.ready", "app/screens/story.js", "caption", '"ready"'),
  captionText: entry(".caption-text", "app/screens/story.js", "caption-text"),

  // ---- the gameplay page: finding the job (frontend/index.html). A lit glowing spot, then "Take it on".
  diySpot: entry(".hot.fix.lit", "frontend/index.html", "hot", "'lit'", "'fix'"),
  takeItOn: entry("#diyAsk .yes", "frontend/index.html", 'id="diyAsk"', "Take it on"),

  // ---- the gameplay page: the event card and report (frontend/game-link.js)
  option: entry(".dw-option", "frontend/game-link.js", "dw-option"),
  report: entry(".dw-report", "frontend/game-link.js", "dw-report"),
  hint: entry(".dw-hint", "frontend/game-link.js", "dw-hint"),

  // ---- the gameplay page: the phone and the contractor's quote (frontend/index.html)
  // The phone is always on. phone.dataset.app is "home", "messages" or "chat" (or another app).
  messagesApp: entry('.app[data-open="messages"]', "frontend/index.html", 'data-open="messages"'),
  homeButton: entry("#homeBtn", "frontend/index.html", 'id="homeBtn"'),
  backButton: entry("#backBtn", "frontend/index.html", 'id="backBtn"'),
  quoteButton: entry("#quoteBtn", "frontend/index.html", 'id="quoteBtn"'),
  reply: entry("#replies button", "frontend/index.html", 'id="replies"', "<button"),
  contact: entry(".contact", "frontend/index.html", 'class="contact', 'data-id="${c.id}"'),
  phone: entry("#phone", "frontend/index.html", 'id="phone"', "dataset.app"),
};

/** Things the page or the backend exposes that the demo reads or calls (not found by selector). */
export const CONTRACTS = {
  link: entry("window.DIWHY_LINK.game()", "frontend/game-link.js", "window.DIWHY_LINK", "game: () => game"),
  hooks: entry("window.DIWHY_HOOKS.heldTotal()", "frontend/index.html", "window.DIWHY_HOOKS", "heldTotal"),
  travel: entry("window.DIWHY_HOOKS.travel(scene, x, y, dir)", "frontend/index.html", "window.DIWHY_HOOKS", "travel,"),
  startHook: entry("window.DIWHY_HOOKS.onStartProject", "frontend/game-link.js", "onStartProject"),
  ownerParam: entry("?owner=<character>&seed=<n> on the game page", "frontend/game-link.js", "params.get('owner')", "params.get('seed')"),
  qualities: entry("debug.choiceQualities", "backend/src/service/types.ts", "choiceQualities"),
  speedInStory: entry("window.DIWHY_SPEED", "app/screens/story.js", "DIWHY_SPEED"),
  speedInLink: entry("window.DIWHY_SPEED", "frontend/game-link.js", "DIWHY_SPEED"),
  demoParam: entry("?demo=1 / ?demo=short", "app/main.js", '"demo"', '"short"'),
  linkDemoParam: entry("?demo=1 on the game page", "frontend/game-link.js", "'demo'"),
};

/** The selectors, by name, for the scripts to use. Dynamic ones are functions. */
export const SEL = {
  ...Object.fromEntries(Object.entries(REGISTRY).map(([name, e]) => [name, e.selector])),
  pickOf: (id) => `.pick[data-id="${id}"]`,
  contactOf: (id) => `.contact[data-id="${id}"]`,
};
