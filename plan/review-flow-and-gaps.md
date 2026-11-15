# DIWhy: flow review, duplication and gaps

Reviewed 2026-11-14 on `main` (509eff6). `npm run typecheck` and `npm test` are green (254 passed, 2 skipped). I did not run `npm run e2e`. The numbers in [the balance check](#balance-check) come from a throwaway simulation I ran against the real events and removed afterwards.

## The short version

The backend is in good shape: clean layers, seeded and replayable, well tested, and the demo is protected by a registry. The weak spot is the **seam between the backend game and Ramy's gameplay page**. In a backend game (`?game=<id>`) the page becomes a yard with an event card on top. Most of what makes the page rich (the house, the glowing DIY spots, the animated job, the tool store, YouTube, ChatGPT) is either switched off or does nothing to the real game. The two halves still keep their own copies of events, costs and projects.

Top five things to do, in order:

1. Decide how a player picks and plays a job (open decision 1 in `INTEGRATION.md`). Everything else on the front end waits on this.
2. Make the report text generic. It still says "bathroom" and "faucet" for every job.
3. Remove or finish the payments flow. It is dead weight, and the demo's bank step silently never runs.
4. Make the story's scene 3 narration follow the chosen job.
5. Pick one source for events and project numbers, and delete the others.

## The flow as it plays today

```
/app/        splash -> pick a character -> story: deed, house, cat,
             "where do you start?" (picks 1 of 12 jobs), living room, contractor text
                |  POST /api/games {project, owner}
                v
/frontend/?game=<id>
             yard + phone + post-its, one event card at a time (up to 8 events, then the finale)
             each answer -> POST /choices -> new numbers, cast reacts by text, next card
             contractor "Update" -> POST /quote       bank alert -> POST /payments (always "yes")
                |  game ends (finale, budget, time or stress)
                v
             report dialog -> "DIY again" (/app/) or "Replay seed"
```

What happens on one turn in the backend: `choose()` applies the answer's effects, rolls the hidden gamble for "wrong" answers, nags if the partner's focus is over the quote, records the charge and outcome, then asks the director (random or the Jev model) for the next event from the eligible pool. A forced finale arrives after 8 events or when the pool is empty.

## What works well (keep it)

- **Replayable by seed.** One 32-bit RNG state per game, a fresh stream per use (`mix(seed, label)`) so advice and cast never disturb the dice.
- **The engine decides, directors only pick.** `nextEvent` ignores a director that returns something off the list.
- **Content as CSV.** Fendy can add rows with no code, and a broken edit keeps the previous good version running (`server/events.ts`).
- **Calibration.** `calibrate()` scales each job so all-good play lands near 85% of the quote. The simulation confirms it (see below).
- **The demo safety net.** Registry, story test and the "fix the demo, never loosen the test" rule.
- **Safe rendering.** `esc()` on every interpolated string in `game-link.js` and `story.js`; static server blocks traversal and symlink escapes.

## Bugs and broken behaviour

Ranked by how likely a player or the demo hits them.

### 1. The report is written for one job (backend, `engine/report.ts`)
- Stress ending: "You hit 100 stress and walked out of the **bathroom** for good." and "Your stress hit 100 before your **faucet** hit the sink." These show for the dryer, the wall, the basement and every other job.
- The "While we're at it" ending counts the flag `upgrade-fever`, which only the hand-coded bathroom events set. CSV jobs set `scope-creep`, so the branch relies on a sum of both. Fine today, but fragile.
- Fix: use `s.job` in the text. Move the two flags into one named constant. Add a test that renders every ending for every job and checks no other job's noun appears.

### 2. The payments flow is dead, and the demo skips its bank step
- `pay()` in `index.html` now confirms every charge at once and never queues anything, so `heldTotal()` is always 0. The bank chat never shows answer buttons.
- Result: `GameService.payment()`, `status: 'pending' | 'blocked'`, `BLOCKED_CARD_STRESS`, `/api/games/:id/payments`, `syncNumbers(g, heldExtra)`, `settle()`, `CLERK_BLOCKED`, the `payments` route in `API.md` and `game-link.js`'s `charges` queue are all unreachable from the real page.
- `demo/pages/game.js` only answers the bank `if (H.heldTotal() > 0)`, so the demo **never** clicks the bank, and `blockTheCardOnCharge: 3` in `demo/config.js` never fires. `demo/README.md` still says the demo answers the bank and blocks the card once. The demo registry test passes because `heldTotal` still exists as a word in the file.
- Decide with Ramy: bring the fraud check back (it is a good "why is this happening?" beat and the backend already supports it), or delete the whole path. Either way update `demo/README.md`, `INTEGRATION.md`, `API.md` and the demo script.

### 3. The story's scene 3 ignores the job you picked (`app/screens/story.js`)
- "The living room. Beige. Quiet." and "You look at the wall. Then at your phone." play for every job, including the dryer, the toilet and the thermostat. The plan's version is about the open-floor wall.
- Fix: add a short `scene` line per project (in `PROJECT_DEFS`, returned by `/api/projects`), or fall back to a neutral line for non-plan jobs.

### 4. Money spent in the store and the phone does not reach the backend
- In a backend game `pay()` skips `applyFx`, and the store, tools, YouTube and ChatGPT are only reachable inside the local animated DIY run, which `useSpot()` blocks. So these are unreachable in a backend game, not just inert.
- Also: the contractor says the quote goes up as problems appear, but the page's own `PLAN_DAYS = 30, PLAN_BUDGET = 24000` scale still decides how full the bars look. A 450-dollar toilet job and a 18,000-dollar basement share the same bar maths via `H.PLAN_*`. Worth checking visually on the small jobs.

### 5. Time is decoration on half the jobs
- The simulation shows `kitchen-faucet` finishes at about 0.27 of its quoted days even under random play, and never went over in 150 games. `toilet-replacement` went over 10 of 150, `paint-room` 32, `dryer-replacement` 37.
- So the partner whose focus is "time" almost never nags on those jobs, and the "Time limit exceeded" ending is nearly unreachable (1 in 1,800 simulated games).
- Cause: `calibrate()` floors days at `0.15`, and these jobs are quoted at 2 to 3 days. Fix: give small jobs a minimum day cost per event (in `consequences.ts`, or `days_n` columns in the CSV) so a 2-day quote can actually slip.

### 6. It is almost impossible to lose
- Random play wins 97% of games (141 to 150 of 150 on every job). Losses are nearly all "stress reached 100", and budget losses need 2.5 times the quote.
- That may be fine for a comedy (the report is the payoff), but if the plan wants real tension, tighten the limits or make "wrong" answers hurt more. A decision, not a bug. See [balance check](#balance-check).

### 7. Smaller things
- **Typewriter in a live region.** `.dw-card` has `aria-live="polite"` and the description is rewritten one character at a time, so a screen reader may announce fragments. Render the full text into a visually hidden live region, or set `aria-live` after typing finishes.
- **No focus handling on the card or the report.** The card is a fixed overlay with no focus move, trap or Escape. Keys 1 to 3 pick options, which is nice, but keyboard users have no way to reach the options before typing ends, and the report `role="dialog"` does not take focus.
- **Negative overrun.** The report row "Cost overrun" shows "-7%" when the player beat the quote. Show "Under budget" instead.
- **Reload repeats advice.** `advised` is in memory, so a reload re-texts the same advice. Chat history is also lost on reload.
- **`showError` in `app/main.js`** injects `message` into `innerHTML` without `esc()`. The message comes from the server so risk is low, but every other screen escapes.
- **`GameView` leaks `stats.riskDebt` and `ledger`/`log`.** The comment in `toView` says hidden consequences stay out, yet `riskDebt` ships to every client. Nothing uses `log` or `ledger` on the gameplay page.
- **Games live in memory.** A server restart loses every game. The front end handles it ("This game isn't here any more"), but a player mid-run loses everything. A file-backed `GameStore` is a small class (the interface is already there).
- **`deleteGame` is never called** by any front end, so games sit for up to 6 hours. Harmless, noted.

## Where code is doubled up

Grouped by how much it costs the team. "Keep" is my suggestion for the single source.

### A. Events, costs and projects exist in up to four places (highest cost)

| Thing | Copies | Keep |
|---|---|---|
| Event text | `events/*.csv` (12 jobs), `DIY_EVENTS` embedded in `frontend/index.html` (3 jobs), `frontend/dryer_vent_events.csv`, `backend/src/data/events.ts` (hand-coded bathroom) | `events/*.csv` |
| Answer quality ("good", "wrong"...) | `answer_key` in CSV, `keys` inside `DIY_EVENTS`, `BATHROOM_QUALITIES` in `projects.ts` | `answer_key` |
| What an answer costs | `consequences.ts`, `OUTCOME` and `PROJECTS.cost/days` in `index.html` | `consequences.ts` |
| Project title, blurb, quote | `PROJECT_DEFS` in TypeScript, `PROJECTS` in `index.html` | One data file (see below) |
| The dryer | `events/dryer_replace_events.csv` (17) vs `frontend/dryer_vent_events.csv` (5), and "dryer" vs "vent" are even different jobs | Merge into the CSV |

Suggestions:
- Convert the bathroom job to a CSV (`events/bathroom_leak_events.csv`). That deletes `data/events.ts` (455 lines of TypeScript), `BATHROOM_QUALITIES`, `builtInProjects()` and the special case in `buildProjects()`. The `humor` kind and the `upgrade-fever` flag disappear with it, or move to CSV columns if the team likes them. The reference UI and the Jev director tests lean on the built-in events, so those tests need a small test CSV fixture.
- Move `PROJECT_DEFS` out of TypeScript into `events/projects.csv` (or one JSON file): `id, title, job, blurb, quote_budget, quote_days, file, scene`. Then "add a job" really is "add two files" and Fendy needs no code (today `AGENTS.md` says a new CSV needs a TypeScript entry). Move `links.ts` the same way (a `requires` column, comma separated).
- Generate `DIY_EVENTS` for the gameplay page from `/api/projects` rather than pasting it, or delete it once decision 1 is made.

### B. Three front ends
- `app/` + `frontend/` is the real game.
- `backend/src/main.ts`, `ui/render.ts`, `ui/util.ts`, `style.css` and `dev/` are a second reference UI with a dev panel. `backend/index.html` loads it, and `GameClient.ts` is its API client.
- `assets/style.html` is a third style sheet demo.
- The reference UI repeats the `KIND` labels, the report table (`render.ts` and `game-link.js` have the same seven rows), money and escape helpers, and the stats bars.
- Suggestion: keep the dev panel (it is useful for balance and director work) but drop the playable reference UI, or label it "dev only" in `README.md`. It is ~500 lines that must follow every contract change.

### C. Helpers copied across plain-JS files (no build step, so no imports today)
- `esc`: `game-link.js`, `story.js`, `backend/ui/util.ts`.
- `money`: `story.js`, `game-link.js` (via `H.money`), `report.ts`, `ui/util.ts`.
- `hash`: `game-link.js`, `consequences.ts`, `cast.mix` (three string hashes).
- `wait` with speed and reduced motion: `story.js`, `game-link.js`.
- Typewriter: three versions (`story.js` `say()`, `story.js` contractor bubble, `game-link.js` `typeOut()`), plus `deed.js` timing.
- API client: `app/api.js` `call`, `game-link.js` `api`, `GameClient.ts` (three error classes).
- Contractor quote sentence: `story.js`, `quoteLine` in `game-link.js`, `TEXTS.contractorQuote` in `index.html`, and the plan's wording.
- Fix without a build step: add `shared/` served at `/shared/` with native ES modules (`dom.js`, `api.js`, `typewriter.js`, `format.js`). `app/` and `demo/` already use modules, so this fits. `game-link.js` is a classic script today, so either make it a module or load the helpers as a classic script that sets `window.DIWHY_SHARED`.

### D. Backend knowledge copied into the front end
- `SERIOUS` category set: `consequences.ts` and `game-link.js` (used for the task priority chips). Send a `priority` (or `serious: boolean`) on the event view instead.
- The advice sentences (`ADVICE` in `game-link.js`) and the people's chatter (`pool` in `index.html`) are two sets of lines for the same four characters. Let the backend return the advice text, or at least keep one list of lines per character.
- The `KIND` labels ("why is this happening?", "plot twist"...) live in `game-link.js` and `render.ts`.

### E. The cast, five copies (already in `AGENTS.md`, noted for completeness)
`CHARACTER_IDS` in `cast.ts`, `CAST` in `character-select.js`, the owner in `demo/config.js`, `emotes.js`, and the sprites embedded in `index.html`. Suggestion: expose `GET /api/cast` (ids, display names) so the select screen and the page read the list instead of copying it. The sprites and sounds can stay where they are.

### F. Dead or legacy code
- Payments (see bug 2).
- `ESTIMATE`, `ESTIMATED_DAYS`, `BUDGET`, `MAX_DAYS` in `GameState.ts`: defaults for the old faucet game, only used when no quote is passed (tests and the reference UI).
- `EventKind` `humor`: only the hand-coded bathroom events use it.
- `backend/COMPARISON.md`: describes the faucet game ("valve-stuck") and says itself it predates the rename. Re-run it or archive it.

## What the plan promises that the game does not do yet

Checked against `plan/plan.md`.

| Plan says | State |
|---|---|
| Three starter projects: open floor, leaking pipe, dryer | Present, plus nine more. The bathroom leak is the hand-coded one |
| Wall removal cuts cables, slab collapse, mold | Cables, load-bearing, asbestos present. "Mold in the wall" is missing from the wall CSV (there is `mold_under_cabinet` in the faucet job) |
| Dryer: smoke, dust, wall, beehive | Done and held by a test |
| Scene 3: AI render of the open floor plan | Placeholder card. No art |
| Scene 5 | Blank in the plan, nothing built. Natural home: the walk from the story into the yard |
| Partner "leaves notifications that build up stress" | One nag per turn while over the focus. No build-up over time, no notification when idle |
| Partner wants budget or timeline "randomly, different every instance" | Done (`partnerFocus`), but see bug 5: the time focus is inert on small jobs |
| Neighbor "wants to know what's happening" | Only gives advice. No snooping, no noise complaint, no effect on the game |
| Contractor "sends a quote and updates it whenever the user clicks update" | Done. The quote only goes up, which suits the joke |
| Store clerk "shows more items to sell" | Only as advice (always the priciest). The real store scene is unreachable in a backend game |
| Parent "unsolicited advice in a long paragraph" | Done in text. Always wrong 70% of the time |
| Friend "could help every once in a while, backs down if the task is not fun" | Texts only. No help, no backing out |
| "Animations to show the user where to click" | Not in the event card or report |
| "Motion explains something", "reduced motion" | Reduced motion handled for typing. The card slide-in is covered by a media query. The yard and the demo are not checked |
| "Works on all browsers and display sizes" | `fitDiy` and the card have small-screen rules. Not tested on a phone-sized viewport in `e2e` |
| "Typewriter narration, click for the next scene" | Done in the story and the card |

Ideas that fit the existing engine without new systems:
- **People who change the numbers, not just the text.** Let the friend, once per game, take half a day off the next problem (or drop out and cost a day). Let the neighbor file a noise complaint that adds a `permitting` event. These are `Effects` plus a flag, so they fit the engine.
- **Show the player something to learn from.** Right now the only clue to "good" is advice that is mostly wrong. A tiny tell (a one-line "pros would check X first" after the first mistake) turns repeat plays into learning, which is the "why" in DIWhy.
- **Show consequences after the fact.** `EventView.choices[].cost/days` are always `null`, and the outcome only shows as bars moving. A one-line result card ("That cost $240 and a day. The shortcut gave way.") after each answer would make cause and effect obvious. `outcome` already has `cost`, `days`, `blewUp`, `quality` and the flavor text sits in `rec.log`.
- **A "what you missed" report.** The backend knows every answer's quality and the order. List the two worst choices and what the good one was.

## Balance check

Method: for each job, 150 seeded games with a random picker (and 60 each for "always good", "always wrong", "always excessive"). A throwaway test, not committed.

| Job | Random wins | Over budget | Over days | Notes |
|---|---|---|---|---|
| wall-removal | 145/150 | 120 | 113 | |
| bathroom-leak | 146/150 | 89 | 109 | Only job where budget losses happen at random |
| dryer-replacement | 148/150 | 109 | 37 | |
| kitchen-faucet | 147/150 | 129 | **0** | Time never matters |
| carpet-replacement | 147/150 | 129 | 59 | |
| window-caulking | 141/150 | 119 | 93 | |
| finish-basement | 141/150 | 140 | 132 | Hardest. Most nags per game (2.65) |
| light-fixture | 145/150 | 138 | 84 | |
| mount-tv | 146/150 | 116 | 67 | |
| paint-room | 148/150 | 118 | 32 | |
| smart-thermostat | 149/150 | 133 | 79 | |
| toilet-replacement | 150/150 | 126 | 10 | |

Other results:
- "Always good" wins 60/60 on every job and beats the quote in 19 to 60 of 60. The baseline works.
- "Always wrong" is the only policy that loses often (up to 55 of 60 on some jobs), almost always on stress.
- Average spend under random play is 1.25 to 1.54 times the quote, so the "overrun" story lands.
- A game is 9 cards (8 events plus the finale) out of a pool of 15 to 20. Replays differ, and each job has a different cascade.

An earlier version of the simulation used a weak home-made random picker, and one job produced identical "random" and "always wrong" results. I redid the random runs with the game's own seeded RNG and used only those numbers above.

## Suggested order of work

Small first, so the demo and tests stay green throughout. Owners follow `AGENTS.md`.

| # | Task | Owner | Size | Also update |
|---|---|---|---|---|
| 1 | Generic report text and a test that renders all endings for all jobs | Travis | S | `report.ts`, `engine/report.test.ts` |
| 2 | Scene 3 narration follows the job (add a `scene` line per project) | Travis | S | `projects.ts`, `API.md`, `story.js`, demo story test |
| 3 | Decide on payments: restore the fraud check or delete the path | Ramy and Travis | S to M | `index.html` `pay()`, `demo/pages/game.js`, `demo/config.js`, `demo/README.md`, `API.md`, `INTEGRATION.md` |
| 4 | Small-job time pressure (day floor per event) | Travis | S | `consequences.ts`, balance tests, **demo seed may need refinding** |
| 5 | Post-answer result line from `outcome` | Ramy (card), Travis (no API change needed) | S | `game-link.js`, demo selectors if a new element is clickable |
| 6 | `priority` on the event view, remove the copied `SERIOUS` | Travis and Ramy | S | `types.ts`, `API.md`, `GameClient.ts`, `game-link.js` |
| 7 | Merge the two dryer sets, delete `frontend/dryer_vent_events.csv` | Fendy | S | `events/dryer_replace_events.csv`, demo story test |
| 8 | Bathroom to CSV, delete `data/events.ts` | Travis | M | `projects.ts`, tests that use built-in events, README |
| 9 | `projects.csv` and a CSV `requires` column replace `PROJECT_DEFS` and `links.ts` | Travis and Fendy | M | `AGENTS.md`, `INTEGRATION.md`, `content.test.ts` |
| 10 | Decision 1: backend jobs started from the glowing DIY spots, with the elevation animation playing between events | Ramy and Travis | L | Everything listed under "gameplay page" and "new step" in `AGENTS.md`, then the demo |
| 11 | `shared/` modules for helpers, typewriter and the API client | Travis | M | `AGENTS.md`, `app/README.md` |
| 12 | Decide the fate of the reference UI (keep the dev panel, retire the playable page) | Travis | S | `backend/README.md`, `architecture.test.ts` |
| 13 | Accessibility pass: live region, focus into the card and report, Escape | Ramy | S to M | `game-link.js`, `e2e` |
| 14 | File-backed `GameStore` | Travis | S | `store.ts`, `README.md` |

Items 1, 2, 3 and 5 are the ones a player or an audience would notice. Item 10 is the big one: until it happens, the page and the backend are two games sharing a screen.

## Questions for the team

1. Fraud check (item 3): bring it back or remove it? The backend half is built and tested.
2. Should the game be hard to lose, or is the report the payoff? That sets item 4 and the balance limits.
3. Is the bathroom leak a plan job that should live in `events/` like the others (item 8), or does Fendy want to keep it separate?
4. Who owns the reference UI under `backend/src/` after Travis moves to the main game?
