# How the pieces fit together

Everyone works in their own folder. This page says how the folders connect, so a change in one doesn't surprise another.

## The flow

```
/app/        splash -> pick your diy-er -> the story ----> POST /api/games {project, owner}
                                                                 |
/frontend/?game=<id>   the gameplay page  <---- GET game, POST choices / quote / payments ---->  /api
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
| `app/` | Travis | The front door (splash, character, story). Aidan's screens, restored from history and restyled | `app/main.js` hands off to `/frontend/?game=<id>` |
| `demo/` | Travis | The hands-free playthrough | It clicks the real pages' real buttons |
| `plan/` | the team | The vision | |

## What the backend does with the other folders

- **`events/*.csv` are the content.** The backend reads them at startup and again for each new game, so editing one takes effect on the next game with no restart.
  - `kind`: `snowball` is a problem that cascades, `temptation` is scope creep.
  - `answer_key`: one quality per option, in order: `good`, `ok`, `wrong`, `excessive`. This drives the consequences, the NPC advice and the score.
  - Optional columns `cost_1..3` and `days_1..3` set an option's numbers by hand. Without them the backend derives them from the quality and the `category`.
- **What the CSVs don't say** lives in `backend/src/content/`: what each quality costs (`consequences.ts`), which events follow which (`links.ts`), and each project's contractor quote and title (`projects.ts`).

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
| Top of the script | `const LIVE = ...?game=` | A game id in the URL means the backend runs the game |
| `settle()` | one line calling `DIWHY_HOOKS.onSettle` | The backend hears "Yes it was me" or "No, block it" |
| `setPhase()` | `&& !LIVE` on the dawn line | The backend decides what day it is |
| `useSpot()` | `if (sp.project && LIVE) return` | The glowing DIY spots start this page's own local projects |
| End of the script | the demo loop and demo tasks wait for `!LIVE`; `window.DIWHY_HOOKS` exposes what the link needs | The backend supplies the tasks and the numbers |
| Before `</body>` | `<script src="game-link.js">` | The link itself |

`frontend/game-link.js` does the rest. Without `?game=<id>` it does nothing, and Ramy's page runs exactly as it does on its own, including the house, the DIY jobs and the day and night cycle.

## Decisions that are still open

These are for the team, not for any one person:

1. **How a player picks a job.** The story asks "where do you start?" and that starts the backend game for one job. Ramy's page has its own way: walk into the house and click a glowing spot. In a backend game those spots are switched off. The cohesive version is probably: the spots start backend projects, and his animated elevation views play between the backend's events. That needs Ramy and Travis together.
2. **Two sets of numbers.** Ramy's page has its own costs and outcomes for its three jobs (`PROJECTS`, `OUTCOME` in `index.html`). The backend has its own (`consequences.ts`). They differ, so the same job costs different amounts in each.
3. **Two dryer event sets.** `events/dryer_replace_events.csv` (17 events, a first draft following the plan's smoke, dust, wall, beehive chain) and `frontend/dryer_vent_events.csv` (5 events, Ramy's, about fire and gas). Worth merging into one.
4. **The dryer draft is mine.** Fendy, please review `events/dryer_replace_events.csv`. It uses your columns and `answer_key` convention.
5. **Story scene 3** (the living room and the AI render) has no art yet. A placeholder card stands in.
6. **Aidan's screens.** `assets/app` was removed in the tidy (commit `4d59a21`). The splash and character select are restored in `app/` from git history (`391db4d`). If Aidan has newer versions, `app/` only depends on `screens/screen.js` and the functions `main.js` imports.
