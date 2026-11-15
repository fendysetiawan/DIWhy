# How the pieces fit together

Everyone works in their own folder. This page says how the folders connect, so a change in one doesn't surprise another.

**Using an AI assistant? Point it at [`AGENTS.md`](AGENTS.md).** It lists what to update when you change something, and how to keep the hands-free demo from breaking.

## The flow

```
/app/        splash -> pick your diy-er -> the story ----> /frontend/?owner=<id>
                                                                 |
/frontend/   the gameplay page: walk the house, take on a glowing DIY spot ----> POST /api/games {project, owner}
                                                                 |
/frontend/?game=<id>   the same page  <---- GET game, POST choices / quote / payments / giveup ---->  /api
                                                                                                    ^
                                                                                  reads  events/*.csv
```

Run the whole thing with `npm run play` in `backend/`, then open http://127.0.0.1:3001. One address, no build step for the front-end folders: edit a file, refresh the page. Add `?demo=1` to `/app/` and the game plays itself.

## Who owns what

| Folder | Owner | What it is | The one thing others rely on |
|---|---|---|---|
| `assets/` | Aidan | Art and brand | `assets/style.css` (the brand), `assets/characters/<name>/`, `assets/logos/` |
| `frontend/` | Ramy | The gameplay page | `pay()`, `settle()` and `crackPhone()` (his own note: keep these) |
| `events/` | Fendy | The events, as CSVs | The columns and the `answer_key` convention |
| `backend/` | Travis | The rules, the API, the dice | The JSON contract in `backend/src/service/types.ts` |
| `app/` | Travis | The front door (splash, character, story). Aidan's screens, restored from history and restyled | `app/main.js` hands off to `/frontend/?owner=<id>` |
| `demo/` | Travis | The hands-free playthrough | It clicks the real pages' real buttons |
| `plan/` | the team | The vision | |

## What the backend does with the other folders

- **`events/*.csv` are the content.** The backend reads them at startup and again for each new game, so editing one takes effect on the next game with no restart.
  - `kind`: `snowball` is a problem that cascades, `temptation` is scope creep.
  - `answer_key`: one quality per option, in order: `good`, `ok`, `wrong`, `excessive`. This drives the consequences, the NPC advice and the score.
  - Optional columns `cost_1..3` and `days_1..3` set an option's numbers by hand. Without them the backend derives them from the quality and the `category`.
- **What the CSVs don't say** lives in `backend/src/content/`: what each quality costs (`consequences.ts`), which events follow which (`links.ts`), and each project's contractor quote and title (`projects.ts`).

- **Giving up.** `POST /api/games/:id/giveup` ends the game with the contractor taking over. The report then has `contractorBill` (rush job, fixing your fix, call-out fee). `game-link.js` calls it when the player taps the red "Give up." reply in the contractor's chat, and shows the bill in place of the DIY report. There are two endings: the job finishes or the limits run out (`complete` or `failed`), or the player gives up (`failed`, `failure: "giveup"`).

- **The phone's writer.** `POST /api/games/:id/phone` has a local Qwen3 8B model (through Ollama) write the cast's texts and the suggested replies on the phone buttons, grounded in the game's facts and checked before they show (see `backend/API.md`). `game-link.js` asks for the advice and reaction texts, and for the answer when the player taps a button. If Ollama is off or slow, the page's own lines and buttons are used. The hands-free demo skips it, so the demo says the same thing every time.

### Add an event
Add a row to its CSV. Done. If it should only happen after another event, add a line to `backend/src/content/links.ts`.

### Add a project (a whole new job)
1. Write `events/<job>_events.csv` in the same format.
2. Add an entry to `PROJECT_DEFS` in `backend/src/content/projects.ts`: an id, a title, the contractor's quote in dollars and days, and the file name.
3. Optionally add cascades to `links.ts`.

A test fails and says so if a CSV in `events/` has no project. It also checks the balance: careful play should land near the contractor's quote, and random play should overspend.

## The marked hooks in the teammates' files

Search for `INTEGRATION` to find every one. They are all small, they do nothing when the page runs on its own, and they're all in `frontend/index.html`:

| Where | What | Why |
|---|---|---|
| Top of the script | `const LIVE = ...?(game|owner)=` | A game id (or an owner who has not picked a job yet) in the URL means the backend runs the game |
| `settle()` | one line calling `DIWHY_HOOKS.onSettle` | The backend hears "Yes it was me" or "No, block it" (no longer asked: see `pay()`) |
| `pay()` | one line calling `DIWHY_HOOKS.onSettle(true, ...)` (**added by Ramy**) | The bank no longer asks the player; every charge is confirmed at once, so the backend always hears "yes" and `heldTotal()` stays 0 |
| `setPhase()` | `&& !LIVE` on the dawn line | The backend decides what day it is |
| `useSpot()` | `if (sp.project && LIVE && DIWHY_HOOKS.started) return` | Once the backend game is running, the other spots do nothing: one job per game |
| `startProject()` | one line calling `DIWHY_HOOKS.onStartProject(id)` | Saying "Take it on" at a glowing spot starts the backend game for that job, instead of this page's local one |
| `renderReplies()` and its click handler | one marked line each (**added by Travis**): the buttons come from `DIWHY_HOOKS.suggested(id)` when it has any, and a tap calls `DIWHY_HOOKS.onReply(id, text)` | With a backend game, a small local model suggests the reply buttons and writes the answer, so the chat stays on the job. Both are undefined without it, so the page's own buttons work as before |
| End of the script | the demo loop, the one "hello" text and the demo tasks wait for `!LIVE`; `window.DIWHY_HOOKS` exposes what the link needs | The backend supplies the numbers; the post-it keeps Ramy's own task rows, one per event |
| The "people text when something happens" timer | `if (LIVE) return` (**added by Ramy**) | It watches the page's own fake budget and time, which the backend replaces |
| `startProject()` and the elevation view | `diyOpenLive(id, 1)` after the hook call; `diyOpenLive`, `diyProgress` in `DIWHY_HOOKS`; `run.live` checks in `diyTick`, `diyCard` and `fitDiy` (**added by Travis**) | With a backend game the page still shows the 2D elevation view (the wall, the dryer, the toilet, the character and the steps), but it only draws. The backend's event cards show docked over it. `game-link.js` tells it how far along the work is (`stats.eventsDone / stats.eventsMax`) and it animates up to that point. The step list is the backend's events (`history`, then the card on the table), shown as they are met and never ahead of the player. The page's own fixed `steps` are only used when it runs on its own, and the Leave button is hidden (you leave by giving up). Without `run.live` it plays as before |
| `diyTick` and `DIWHY_ELEV` | `if (run.live && window.DIWHY_ELEV) window.DIWHY_ELEV.draw(...)` after the base scene is drawn; `frontend/elevation.js` is loaded before `game-link.js` (**added by Travis**) | The picture follows the event. `game-link.js` calls `DIWHY_ELEV.show(event.visual)` when a card opens, `burst(kind)` when an answer blows up (water for plumbing/envelope, sparks for electrical, dust otherwise) and `clear()` when it is answered and at the report; `draw` is called every frame. The names in the CSV `visual` column come from `DIWHY_ELEV.KIT`; a test checks them. All calls are guarded, so the link works without it |
| Before `</body>` | `<script src="game-link.js">` | The link itself |

`frontend/game-link.js` does the rest. Without `?game=<id>` or `?owner=<id>` it does nothing, and Ramy's page runs exactly as it does on its own, including the house, the DIY jobs and the day and night cycle.

## Decisions that are still open

These are for the team, not for any one person:

1. **How a player finds a job (decided).** Ramy's glowing DIY spots are the way: the story has no "where do you start?" any more. Walking to a spot and saying "Take it on" starts the backend game for that spot's job (`SPOT_PROJECT` in `game-link.js`: kitchen wall is wall removal, bathroom is toilet replacement, dryer is dryer replacement). Still open: his animated elevation views could play between the backend's events, and the other nine jobs have no spot yet. Both need Ramy and Travis together.
2. **Two sets of numbers (decided: the backend owns them).** The backend's `consequences.ts` and `projects.ts` are the only rules. Ramy's page still carries its own copies (`PROJECTS`, `OUTCOME`, `BREAKS` in `index.html`) from when it ran on its own. They are dead weight with a backend game, and are to be removed from `index.html`.
3. **Dryer events (decided).** `events/dryer_replace_events.csv` (17 events) is the only dryer set. Ramy's 5-event draft (`frontend/dryer_vent_events.csv`: lint, bird nest, gas line, vent maze, duct tape) is deleted. Fendy: the gas line and bird nest ideas are not in the 17 and may be worth adding.
4. **The dryer draft is mine.** Fendy, please review `events/dryer_replace_events.csv`. It uses your columns and `answer_key` convention.
5. **Story scene 3** (the living room and the AI render) has no art yet. A placeholder card stands in.
6. **YouTube and ChatGPT on the phone.** Ramy's phone now has them: a how-to video (1 to 2.5 game hours) makes the job's surprise card mark the right answer, and ChatGPT is quicker but skips steps. The backend already knows which answer is right (`answer_key`) and uses it for the neighbor's, parent's, friend's and clerk's advice. A natural next step is for those two apps to ask the backend, for example "reveal the good answer for the next event, at a cost in days", so researching a job changes the real game. In a backend game the two apps currently do nothing to it. Needs Ramy and Travis together.
7. **Aidan's screens.** `assets/app` was removed in the tidy (commit `4d59a21`). The splash and character select are restored in `app/` from git history (`391db4d`). If Aidan has newer versions, `app/` only depends on `screens/screen.js` and the functions `main.js` imports.
