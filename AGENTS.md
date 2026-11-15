# DIWhy: read this first (for AI assistants and people)

DIWhy is a browser game about a DIY renovation that snowballs. Several people work on it at once, each in their own folder, with their own AI assistant. **This file says what has to be updated when you change something, so nobody's change quietly breaks someone else's part.** The most important thing it protects is the **hands-free demo**, which clicks the real game and breaks the moment the game changes underneath it.

Read [`INTEGRATION.md`](INTEGRATION.md) for how the folders connect. Read this file for what to do when you change one.

## Run it and check it

```
cd backend
npm install
npm run play        # the whole game: http://127.0.0.1:3001   (leave it running)
npm test            # all the unit and integration tests, including the demo's safety checks
npm run typecheck
npm run e2e         # plays the whole demo in a real Chrome and photographs it (needs `npm run play` running)
```

- The demo: http://127.0.0.1:3001/app/?demo=1 (everything) or `?demo=short` (just the game).
- `npm run e2e` options: `SPEED=8` (faster check), `DEMO=short`, `SHOTS=0` (no screenshots). Photos land in `backend/e2e/out/`. Set `CHROME` if Chrome is not in the usual place.

## Who owns what

| Folder | Owner | What it is |
|---|---|---|
| `assets/` | Aidan | Art and brand (`style.css`, characters, logos) |
| `frontend/` | Ramy | The gameplay page (`index.html`) and its link to the backend (`game-link.js`) |
| `events/` | Fendy | The events, one CSV per job |
| `backend/` | Travis | The rules, the API, the dice, the tests |
| `app/` | Travis | The front door: splash, character, story |
| `demo/` | Travis | The hands-free demo |

**Stay in your folder.** If your task needs a change in someone else's folder, make the smallest change, mark it clearly, and tell the user so they can tell the owner. Never delete or rewrite a teammate's files to make something pass.

## The rule: when you change X, also do Y

| If you change... | ...also do this |
|---|---|
| **An event CSV** (add, edit or remove rows; change an `answer_key`) | Run `npm test`. A **new CSV** needs an entry in `PROJECT_DEFS` in `backend/src/content/projects.ts` (a test tells you). A **removed or renamed event id** needs `backend/src/content/links.ts` fixed. If the test **"the fixed game still tells a good story"** fails, the demo needs a new seed: see [Keeping the demo alive](#keeping-the-demo-alive). |
| **How answers cost** (`content/consequences.ts`), **a contractor quote** or **the balance** | Run `npm test` (the balance tests cover every job). Check the demo story test too. |
| **The API or the JSON contract** (`service/types.ts`, `GameService`, `server/http.ts`) | Update `backend/API.md`, `client/GameClient.ts`, `frontend/game-link.js`. The demo reads `debug.choiceQualities` and the `outcome`, so check `demo/`. The give-up ending (`POST /giveup`, `report.contractorBill`) is part of the contract too. Update `INTEGRATION.md` if the flow changed. |
| **The gameplay page** (`frontend/index.html`) | **Keep the lines marked `INTEGRATION`** (search for it) and `pay()`, `settle()`, `crackPhone()`. After pulling or merging upstream changes to this file, check those lines are still there. **Do not rename ids or classes listed in `demo/selectors.js`.** If you added something the player must click, see [Adding something the player clicks](#adding-something-the-player-clicks). Run `npm run e2e`. |
| **`frontend/game-link.js`** (the event card, the report, the bank) | Run the link tests (`npm test`). The `dw-` classes are demo selectors. Keep `window.DIWHY_LINK`. |
| **A front-door screen** (`app/screens/`) | Update `demo/pages/app.js` and `demo/selectors.js`. Keep `createScreen` and `leave` in `screens/screen.js`. Run `npm run e2e`. |
| **Characters** (add, remove or rename a folder in `assets/characters/`) | The cast needs exactly seven (six roles plus the owner). Update `CHARACTER_IDS` in `backend/src/service/cast.ts`, `CAST` in `app/screens/character-select.js`, the owner in `demo/config.js`, and the sounds in `app/audio/emotes.js`. The gameplay page loads the sprites and faces from these folders by name (`CAST` near the top of `frontend/index.html`'s script). |
| **Art or brand paths** (anything that moves or renames files in `assets/`) | Search for the old path in `app/`, `frontend/game-link.js`, `demo/` and `backend/`. `assets/style.css` sets `--font`, which the gameplay page also uses; `game-link.js` keeps them apart, so don't rename it without checking. |
| **A new screen, step or overlay in the player's path**, or reordering the flow | The demo must get a step for it or it will hang waiting. Update `demo/pages/`, the `STAGE` check in `backend/e2e/demo.mjs`, and the flow in `INTEGRATION.md`. |
| **Timing or pacing** (typing speed, pauses, animation lengths) | Re-time the demo: `SPEED=1.5 SHOTS=0 npm run e2e`. It should take about **2 min** in full and about **1 min 20** for `?demo=short`. Update the numbers in `demo/README.md` if they move. |
| **A new job** (a whole new project) | CSV in `events/`, an entry in `PROJECT_DEFS`, optional cascades in `links.ts`. It also needs a glowing spot to start it: today only three jobs have one (`SPOT_PROJECT` in `frontend/game-link.js`, spots in `frontend/index.html`), so tell the user. |
| **Routes or URLs** (`/api`, `/app`, `/frontend`, which folders the server serves) | `backend/src/server/play.ts` (the folders it serves), the links in every README, `demo/README.md`. |
| **The `?demo`, `?game`, `?owner`, `?seed` or `?speed` options** | `demo/selectors.js` (`CONTRACTS`), `app/main.js`, `frontend/game-link.js`, `demo/README.md`. |

When in doubt: search the whole repo for the thing you are changing, and run `npm test`.

## Keeping the demo alive

The demo (`demo/`) plays the real pages by moving a fake mouse and sending real events to the real buttons. So it keeps working as long as **the things it clicks still exist**. Three files keep it honest:

- **`demo/selectors.js`** lists every element and page function the demo relies on, the file that owns it, and words that must still appear in that file.
- **`demo/config.js`** holds the demo's settings: the fixed game (seed, owner, job), what it picks on each event card (by answer quality, never by specific event), and what a good demo story must contain.
- **`backend/src/demo/demo.test.ts`** checks all of it on every `npm test`:
  1. every registered element still exists in its owner file (a **rename fails here**, with the file and the fix in the message)
  2. the demo scripts use no selector outside the registry
  3. the settings are valid (a real character, a real job, real qualities)
  4. the fixed game still tells a good story against the real event files (the dryer chain to the beehive, the cat, a blow-up, an overrun)

**If a demo test fails, fix the demo. Do not delete the registry entry, skip the test, or loosen the story rules to make it pass.**

**If the story test fails** (someone edited events or consequences): find a new seed and set it in `demo/config.js`.

```
cd backend
FIND_DEMO_SEED=1 npx vitest run src/demo/demo.test.ts --disable-console-intercept
```

On Windows PowerShell: `$env:FIND_DEMO_SEED=1; npx vitest run src/demo/demo.test.ts --disable-console-intercept`.

### Adding something the player clicks
Give it a stable `id` or class. Add an entry to `REGISTRY` in `demo/selectors.js` (its selector, the owner file, and a few words that must stay in that file). Add a step for it in `demo/pages/app.js` or `demo/pages/game.js`, using `SEL.<name>`, never a typed-out selector. Run `npm run e2e` and look at the photos.

### Checking the demo for real
`npm test` catches renames and a broken story. It cannot catch a button that exists but is covered, hidden or disabled. For that, run it for real: start `npm run play`, then `npm run e2e`, and look at a few photos in `backend/e2e/out/`. The command must end with `The demo ran from splash to report`.

## Before you say you're done

1. `cd backend && npm run typecheck && npm test` is green.
2. You changed anything the player sees or does (UI, flow, events, consequences)? Then `npm run e2e` also passes.
3. You updated what the table above says to update, including the docs.
4. You did not make the demo, a test or a hook pass by removing it.
5. No file you added contains internal company names, internal package registry addresses, or credentials.

## Git and safety

- Pull before you start (`git pull`), work on a branch, make small commits, and don't force-push `main`.
- Never commit: `node_modules/`, `.venv/`, `.npmrc`, `package-lock.json`, `backend/e2e/out/`, `backend/dist*`. They are ignored for a reason; `.npmrc` can hold private registry settings.
- **Never put internal company names, internal package registry addresses or credentials in any file, commit message or doc**, including docs like this one. If a task seems to need one, stop and ask the user.
- Don't change teammates' files without telling the user (see Who owns what).

## Conventions

- **Code:** the backend is TypeScript. `app/`, `frontend/` and `demo/` are plain JavaScript with no build step. Keep it that way: edit, refresh, see.
- **The backend's layers are enforced** by `backend/src/architecture.test.ts` (the front end may only use the JSON contract as types; the engine imports nothing else). If it fails, the import is wrong, not the test.
- **Words:** UI text and docs use sentence case, and no spaces around dashes or slashes ("input/output", "a faster workflow—without added complexity").
- **Events** are CSVs: `id,event,kind,category,description,option_1,option_2,option_3,answer_key`. `kind` is `snowball` or `temptation`. `answer_key` is three of `good,ok,wrong,excessive`, one per option, in order.

## Open decisions

These are for the team, listed in `INTEGRATION.md`: which jobs get a glowing spot, removing the page's leftover copies of the rules from `frontend/index.html` (the backend owns them), and the story's missing living-room art. If your task touches one, tell the user before choosing.
