# Simplify frontend and backend: one rules engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every rule that the gameplay page (`frontend/index.html`) duplicates from the backend, so the backend is the only source of rules and the page only draws, animates and talks.

**Architecture:** The backend already owns jobs, quotes, costs, events, budget, time, stress and the final report. The page keeps the house, sprites, DIY step animations, phone UI and the glowing spots, and asks the backend for every number. Standalone mode (`LIVE` false) is deleted, so a page without `?game=` or `?owner=` sends the player to `/app/`. The one ending that only the page had, "give up, the contractor takes over", moves into the backend as a new failure reason.

**Tech Stack:** TypeScript backend (vitest), plain JavaScript front end (`frontend/`, `app/`, `demo/`), no build step.

**Spec:** the user's decisions on branch `simplify-frontend-backend` (2026-11-14), recorded under Decisions below. Competing-logic list is in the conversation that created this branch.

## Decisions (from the user)

1. The backend owns the rules. The frontend owns the interface.
2. Standalone mode is dropped. `?game=` or `?owner=` is always required.
3. Both endings are kept: the backend's (`complete`, or `failed` for budget, time or stress) and the page's "give up" contractor takeover.

Assumptions to confirm (not yet answered):
- A. Dryer events: keep `events/dryer_replace_events.csv` (17), drop `frontend/dryer_vent_events.csv` (5). Follows from decision 1.
- B. The page's "win after everything is fixed and 5 quiet minutes" ending is not kept as such. The game has one job, so winning is the backend's `complete`.
- C. Page-only side content that only ran when standalone is deleted as dead code: `SCEN` (rat, ghost, car), `PERMITS`, `BREAKS` and the local contractor re-quote. Ramy should confirm nothing there is wanted.

## Global Constraints

- Plain JavaScript, no build step, in `app/`, `frontend/`, `demo/`.
- Keep `INTEGRATION` marked lines, `pay()`, `settle()`, `crackPhone()` in `frontend/index.html` (AGENTS.md). Do not rename ids or classes in `demo/selectors.js`.
- Keep `window.DIWHY_LINK` and the `dw-` classes in `game-link.js`.
- Backend layers are enforced by `backend/src/architecture.test.ts`.
- UI text and docs use sentence case, no spaces around dashes or slashes.
- No internal company names, internal registry addresses or credentials in any file or commit.
- Never delete the demo, a test or a hook to make something pass.
- Ownership: this touches Ramy's `index.html`, Travis's backend, Fendy's `events/`. Tell the user to tell them.

## Review Focus

- A player who gives up before answering any event: bill must still work (zero problems, zero spent).
- Giving up twice, or after the game is over: second call must return `409 game_over`, not change the report.
- Giving up with a pending bank charge: the charge must not block the ending.
- Opening `/frontend/` with no query: redirects to `/app/`, no console error.
- Old URL `?over` debug flag and `DIWHY_DEBUG.scen` hooks: removed with their code, nothing else references them (grep).

## File structure

- `backend/src/engine/GameState.ts`: add `'giveup'` to `FailureReason`.
- `backend/src/engine/report.ts`: report text for `giveup`, plus `contractorBill`.
- `backend/src/service/GameService.ts`, `service/types.ts`, `server/http.ts`: new `giveUp` action and route.
- `backend/src/client/GameClient.ts`, `backend/API.md`: contract.
- `frontend/game-link.js`: give-up button, report variant.
- `frontend/index.html`: delete rules and standalone mode.
- `demo/`, `INTEGRATION.md`, `AGENTS.md`, READMEs: follow the changes.

---

### Task 1: Backend give-up ending

**Files:**
- Modify: `backend/src/engine/GameState.ts` (`FailureReason`), `backend/src/engine/report.ts`, `backend/src/service/GameService.ts`, `backend/src/service/types.ts`, `backend/src/server/http.ts`, `backend/src/client/GameClient.ts`
- Test: `backend/src/service/GameService.test.ts`, `backend/src/engine/report.test.ts`, `backend/src/server/http.test.ts`

**Interfaces:**
- Produces: `GameService.giveUp(id: string, opts?: RequestOptions): Promise<GameView>`; route `POST /api/games/:id/giveup` (empty body); `FailureReason` includes `'giveup'`; `Report.contractorBill: { rows: { label: string; cost: number; note: string }[]; total: number; quoted: number } | null` (null unless `failure === 'giveup'`); view `status` is `'failed'` after give-up.

- [ ] **Step 1: Write failing tests**
  - `report.test.ts`: `buildReport` of a state with `failure: 'giveup'` has `achievement.title` non-empty, `outcome` mentions the contractor, and `contractorBill.total === round(quote.budget * 1.35 / 10) * 10 + 250` for a fresh game (`rush job` row at ×1.35, plus a `Call-out fee` row of 250, the numbers the page used). Other failures have `contractorBill === null`.
  - `GameService.test.ts`: `giveUp` on a fresh game gives `status === 'failed'`, `report.contractorBill.total > 0`, `event === null`. After some choices, the bill's `rows` include a `fixing your fix` row at 30% of `quote.budget`. Second `giveUp` rejects with code `game_over`. Give-up with a pending charge ends the game and the charge is not left pending.
  - `http.test.ts`: `POST /api/games/:id/giveup` returns 200 with a report; `GET` on it returns 405.
- [ ] **Step 2: Run** `cd backend && npx vitest run src/service src/engine src/server`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `report.ts`: add the `giveup` branch before the others (outcome "You called the contractor. They sighed and fixed it all.") and `contractorBill`. `GameService.giveUp`: same lock, `isOver` and `game_over` conflict as `choose`; set `rec.state.failure = 'giveup'`, clear `rec.charge`, call `this.endGame`. Route added to the action regex in `http.ts`. Add `giveUp` to `GameClient`.
- [ ] **Step 4: Run** `npm run typecheck && npm test`. Expected: green, including `architecture.test.ts`.
- [ ] **Step 5: Commit** `feat: give-up ending in the backend`.

### Task 2: Contract docs and link

**Files:**
- Modify: `backend/API.md`, `frontend/game-link.js` (`endGame`, `wireContractor`), `backend/src/integration/game-link.test.ts`

**Interfaces:**
- Consumes: Task 1 route and `report.contractorBill`.

- [ ] **Step 1: Failing test** in `game-link.test.ts`: when the contractor's "Give up" reply is clicked, the link POSTs `/giveup` and the report shows "The contractor fixed everything", the bill rows and `contractorBill.total`. A normal `failed` report (budget) still shows "DIY abandoned".
- [ ] **Step 2: Run** `npx vitest run src/integration`. Expected: FAIL.
- [ ] **Step 3: Implement** in `game-link.js`: `wireContractor` sends `api('/games/' + id + '/giveup', { method: 'POST' })`; `endGame(g)` picks the title from `g.report.contractorBill` and renders its rows. Keep the `dw-` classes. Document the route and the new report field in `API.md`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: link and docs for the give-up ending`.

### Task 3: Delete the page's rules and standalone mode

**Files:**
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: `window.DIWHY_HOOKS` and `DIWHY_LINK` from `game-link.js` (unchanged).
- Produces: a page that always runs live. `LIVE` const is removed; every `!LIVE` branch is deleted and every `LIVE` branch is kept unconditionally.

- [ ] **Step 1: Grep sweep** for every use of `LIVE`, `PROJECTS`, `OUTCOME`, `BREAKS`, `SCEN`, `PERMITS`, `plan`, `PLAN_DAYS`, `PLAN_BUDGET`, `jobs`, `S.budget`, `endGame`, `contractorTakesOver`, `contractorQuote`, `syncTasks`, `winSince`, `?over`, `DIWHY_DEBUG.scen`. List each hit as keep, delete or rewire, in the task's commit message.
- [ ] **Step 2: Delete rules.** `OUTCOME`, the cost, days and quote fields of `PROJECTS`, `BREAKS`, `SCEN` and `scenQueue`, `PERMITS`, local `plan` and `jobs` accounting, local `endGame`, `contractorTakesOver`, win-hold timer, local contractor quote. Keep in `PROJECTS` only what draws: `short`, `title`, `where`, `blurb`, `steps`. The titles come from the backend when it has them.
- [ ] **Step 3: Delete standalone.** Remove `LIVE` and every `!LIVE` block. Add one guard at the top of the script: no `game` or `owner` param sends the browser to `/app/` (keep the one marked `INTEGRATION` line style).
- [ ] **Step 4: Verify** `rtk grep -n "LIVE" frontend/index.html` returns nothing. `pay()`, `settle()`, `crackPhone()` and every `INTEGRATION` line remain. Every selector in `demo/selectors.js` still matches (`npm test`).
- [ ] **Step 5: Run** `npm run play`, then `npm run e2e`. Expected: ends with `The demo ran from splash to report`. Open `/frontend/` bare and see `/app/`.
- [ ] **Step 6: Commit** `refactor: the page draws, the backend decides`.

### Task 4: Events and numbers cleanup

**Files:**
- Delete: `frontend/dryer_vent_events.csv` (after confirming assumption A)
- Modify: `frontend/README.md`, `frontend/character-texts.txt` references if any

- [ ] **Step 1: Grep** for `dryer_vent_events` across the repo. If any code or doc reads it, fix that first.
- [ ] **Step 2: Delete** the file. Run `npm test`. Expected: green.
- [ ] **Step 3: Commit** `chore: one dryer event set`.

### Task 5: Demo, docs, final check

**Files:**
- Modify: `demo/` (add a give-up step only if the demo should show it; otherwise nothing), `demo/selectors.js`, `INTEGRATION.md`, `AGENTS.md`, `frontend/README.md`, `demo/README.md`

- [ ] **Step 1: Update docs.** `INTEGRATION.md`: remove "Two sets of numbers" and "Two dryer event sets" from open decisions, rewrite the hooks table for what remains, document `/giveup`. `AGENTS.md`: update the table rows that mention standalone, `PROJECTS` or `OUTCOME`. Add the give-up route to the API row.
- [ ] **Step 2: Retime** `SPEED=1.5 SHOTS=0 npm run e2e`. About 2 min full, 1 min 20 short. Update `demo/README.md` if it moved.
- [ ] **Step 3: Final check.** `cd backend && npm run typecheck && npm test` green, `npm run e2e` passes, photos in `backend/e2e/out/` look right.
- [ ] **Step 4: Commit** `docs: one rules engine`.

## Self-review

- Spec coverage: decision 1 (Tasks 3, 4), decision 2 (Task 3), decision 3 (Tasks 1, 2). Competing areas 1 to 7 from the list: jobs, costs, events, state, contractor and endings are all covered. Phone and chatter are not competing (the page's lines are the fallback), so they stay.
- Open risks: assumption C deletes content Ramy wrote. Task 3 Step 1 lists every deletion so it can be reviewed before Step 2.
