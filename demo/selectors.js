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
  deedPad: entry(".deed-pad canvas", "app/screens/deed.js", "deed-pad", "canvas"),
  deedCheck: entry(".deed-check", "app/screens/deed.js", "deed-check"),
  choice: entry(".choices .choice", "app/screens/story.js", '"choices"', "choice"),
  replyButton: entry(".reply-button", "app/screens/story.js", "reply-button"),
  captionReady: entry(".caption.ready:not(.choosing)", "app/screens/story.js", "caption", '"ready"', '"choosing"'),
  captionText: entry(".caption-text", "app/screens/story.js", "caption-text"),

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
