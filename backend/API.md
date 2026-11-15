# DIWhy backend API

A JSON API over HTTP. It runs the whole game: the projects, the events, the dice, the cast, the contractor's quote, the bank and the end report. A front end only has to draw what it receives and send back the player's choices.

- **Contract:** [`src/service/types.ts`](src/service/types.ts) holds every request and response shape. Copy it or import it as types only.
- **Typed client:** [`src/client/GameClient.ts`](src/client/GameClient.ts) is a small wrapper over every endpoint here (`health`, `listProjects`, `createGame`, `getGame`, `choose`, `requestQuote`, `payment`, `phone`, `giveUp`, `deleteGame`). Use it, or treat it as a worked example.
- **Working front ends:** [`../frontend/game-link.js`](../frontend/game-link.js) connects the team's gameplay page to this API, and [`../app/`](../app/) is the front door. Both are plain JavaScript and show the calls in use.

## Running it

| Command | What you get |
|---|---|
| `npm run play` | **The whole game** on one address: `http://127.0.0.1:3001` (front door, gameplay page, art, demo) plus the API at `/api`. No CORS to think about. |
| `npm run api` | The API alone, on `http://127.0.0.1:3001/api`. Use this when your front end runs somewhere else. |
| `npm run dev` | A developer console (the reference page with dev mode) and the API, with live reload. |

Settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | Port to listen on. |
| `HOST` | `127.0.0.1` | Interface to bind. `0.0.0.0` accepts other machines. |
| `CORS_ORIGIN` | unset (no CORS headers) | Allowed origin for browsers on another origin, such as `http://localhost:3000`, or `*`. |
| `EVENTS_DIR` | `../events` | Where the team's event CSVs are. |
| `GAMES_DIR` | `backend/.games` | Where games are saved, one JSON file each, so they survive a restart. Set it to an empty string to keep games in memory only. |
| `JEV_URL` | `http://127.0.0.1:8009/v1/systemone` | Where the Jev model server is. Set it to an empty string to turn the `jev` director off. |
| `PHONE_URL` | `http://127.0.0.1:11434` | Where Ollama is, for the phone's writer. Set it to an empty string to turn the phone model off. |
| `PHONE_MODEL` | `qwen3:8b` | Which Ollama model writes the texts. |
| `PHONE_TIMEOUT_MS` | `12000` | How long to wait for a text before using the built-in one. |

**The event files are read live.** Edit a CSV in `events/` and the next *new* game uses it, with no restart. A game copies its job's data (event text, answer keys, links, quote, weights) when it starts, so a game in progress keeps the events it started with, even if the files change or the server restarts. Only the rules in the code apply to it as the running server has them. The built-in bathroom leak has no file; games on it use the server's built-in events, and if those ever change under a running game the API answers `project_changed`. If an edit breaks a file, the server keeps the last good version and logs why.

The API has no authentication. Keep it on localhost or behind something that adds access control before exposing it.

## Playing a game

1. `GET /api/projects` lists the jobs. The player picks one (and a character).
2. `POST /api/games` starts a game on it and returns the first event.
3. Show `event` and its `choices`. When the player picks one, `POST /api/games/:id/choices`.
4. The response is the next state. If `charge` is new, the bank is asking about it: show that, and `POST /api/games/:id/payments` with the answer.
5. Repeat until `status` is no longer `"playing"`. Then `report` holds the end-of-game summary.

```js
const api = 'http://127.0.0.1:3001/api';
const call = (path, body) =>
  fetch(api + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then((r) => r.json());

const { projects } = await call('/projects');
let game = await call('/games', { project: projects[2].id, owner: 'gigi-singh', seed: 42 });
while (game.status === 'playing') {
  const pick = game.event.choices[0]; // ask the player here
  game = await call(`/games/${game.id}/choices`, { choice: pick.index, eventId: game.event.id });
  if (game.charge?.status === 'pending') game = await call(`/games/${game.id}/payments`, { chargeId: game.charge.id, confirm: true });
}
console.log(game.report.achievement.title);
```

## Endpoints

| Method and path | Body | Success | Notes |
|---|---|---|---|
| `GET /api/health` | none | `200` `{ status, directors, phone }` | Which directors this server can use, and whether a phone model is configured (it may still not be running). |
| `GET /api/projects` | none | `200` `{ projects }` | Every job a player can take on, with the contractor's quote. |
| `POST /api/games` | `{ seed?, project?, owner?, director? }` | `201` GameView, `Location` header | Body may be empty. |
| `GET /api/games/:id` | none | `200` GameView | Safe to call any time, for example to resume after a reload. |
| `POST /api/games/:id/choices` | `{ choice, eventId? }` | `200` GameView | Applies the choice, then picks the next event. |
| `POST /api/games/:id/quote` | none (a body is ignored) | `200` GameView | The contractor re-quotes. Only ever goes up. Answers `409 game_over` if the game has ended. |
| `POST /api/games/:id/giveup` | none (a body is ignored) | `200` GameView | The player gives up and the contractor takes over. The game ends as `"failed"` with `failure: "giveup"`, and `report.contractorBill` says what the contractor charges. Answers `409 game_over` if the game has already ended. |
| `POST /api/games/:id/payments` | `{ chargeId, confirm }` | `200` GameView | Answer the bank about the latest charge. Answers `409 game_over` if the game has ended. |
| `POST /api/games/:id/phone` | `{ with, kind, thread? }` | `200` PhoneView | A text from someone in the cast, and reply buttons, written by the local model. Read-only: it never changes the game. See below. |
| `DELETE /api/games/:id` | none | `204` | Throws the game away. |

Add `?debug=1` to any game request to include the `debug` payload (see below).

### Request fields

- **`project`:** a project `id` from `GET /api/projects`. Omit to let the seed pick one.
- **`owner`:** who the player is, by folder name in `assets/characters` (`travis-potter`, `aidan-newsome`, `rachel-katz`, `christian-huber`, `ramy-maher`, `gigi-singh`, `fendy-seitiawan`). Omit for a random one.
- **`seed`:** integer from 0 to 4294967295. Omit for a random one. The same seed, project, owner and choices always give the same game under the `random` director.
- **`director`:** `"random"` (default) or `"jev"`, a local decision model that picks which event happens next. If the model server is down, the game carries on with random picks.
- **`choice`:** the `index` of one of the current event's `choices`.
- **`eventId`:** optional but recommended. The `id` of the event the player was looking at. If the game has moved on (a double click, a second tab), the server answers `409 stale_event` and changes nothing.

## The GameView

Every endpoint that returns a game returns this shape. Trimmed:

```json
{
  "id": "76fc453c-0fe2-4594-a5cd-2715b795861d",
  "seed": 0,
  "director": "random",
  "project": { "id": "dryer-replacement", "title": "Replace the smoking dryer", "job": "dryer replacement" },
  "cast": {
    "owner": "gigi-singh",
    "roles": { "partner": "ramy-maher", "clerk": "aidan-newsome", "contractor": "christian-huber", "parent": "fendy-seitiawan", "neighbor": "rachel-katz", "friend": "travis-potter" },
    "partnerFocus": "budget"
  },
  "quote": { "original": { "budget": 1800, "days": 3 }, "current": { "budget": 1800, "days": 3 } },
  "status": "playing",
  "failure": null,
  "stats": { "budget": 4500, "spent": 0, "daysElapsed": 0, "maxDays": 9, "stress": 0, "riskDebt": 0, "problems": 0, "eventsDone": 0, "eventsMax": 9 },
  "charge": null,
  "outcome": null,
  "ledger": [],
  "log": [],
  "event": {
    "id": "dryer_smokes",
    "kind": "problem",
    "title": "Dryer starts smoking",
    "description": "Oh no! The old dryer is smoking. Not metaphorically.",
    "category": "mechanical",
    "choices": [
      { "index": 0, "label": "Keep running it with the door open", "cost": null, "days": null },
      { "index": 1, "label": "Unplug it and start the replacement", "cost": null, "days": null },
      { "index": 2, "label": "Gut the laundry room and start over", "cost": null, "days": null }
    ],
    "visual": ["smoke@dryer"],
    "advice": { "from": "neighbor", "pick": 1 }
  },
  "report": null
}
```

| Field | Meaning |
|---|---|
| `project` | The job being played. |
| `cast` | Who the player is and who plays each role. The six roles are `partner`, `clerk`, `contractor`, `parent`, `neighbor`, `friend`. Dealt from the seed, so a replay has the same cast. |
| `quote` | `original` is the contractor's quote and the baseline the player is judged against, always. `current` is what the contractor last said; `POST /quote` can raise it as problems turn up. |
| `status` | `"playing"`, `"complete"` (the job got finished) or `"failed"`. |
| `failure` | When `"failed"`: `"budget"`, `"time"`, `"stress"` or `"giveup"` (the player called the contractor in). The game ends at 2.5 times the quote's money, 3 times its days, or stress 100 (`stats.budget` and `stats.maxDays` are those limits). |
| `stats` | The numbers to show. `eventsDone` out of `eventsMax` is how far along the work is (a game has at most 8 events plus the finale), which a front end can use to animate the job. `riskDebt` is the hidden cost of shortcuts; hide it if you want the risk to stay secret. |
| `charge` | The latest purchase, waiting for the bank: `{ id, amount, what, status }`. `status` is `pending`, `confirmed` or `blocked`. A finished game never has a `pending` charge. |
| `outcome` | What the last choice did: its `quality`, what it cost, whether it `blewUp`, whether the partner nagged, and `lines`, the words for what happened (the choice's result, then the blow-up line if the shortcut gave way; the same lines that head `log`, oldest first). Use it to have the cast react. `null` at the start. |
| `ledger` | Every cost so far, as `{ label, cost }`. |
| `history` | The events the player has already answered, oldest first, as `{ id, title }`. The event on the table is not in it, and an event removed from the files since then shows its id as its title. A front end can use it to show the steps so far. |
| `log` | Flavor text from recent choices, newest first. |
| `event` | What to decide now. `null` once the game is over. `kind` is `problem`, `temptation`, `humor` or `finale`. |
| `event.choices[].cost`, `days` | Always `null`: nobody tells you what a DIY fix will cost. The fields exist so a price tag can come back later. |
| `event.visual` | What the elevation picture shows for this event: tokens like `hole@wall` or `thought:stack@ceiling` (`prop[:variant]@anchor`), from the optional `visual` column of the event file. `[]` when the event has none (the finale, the bathroom job). The names live in `frontend/elevation.js`. |
| `event.advice` | Someone's opinion, about two events in three: `{ from, pick }`. They might be wrong (see below). |
| `report` | `null` while playing. When over: the contractor's quote against what happened, `actualCost` (what the player spent), `totalCost` (`actualCost` plus the contractor's bill after a give-up, otherwise the same), `overrunPct` (from `totalCost`; negative when under the quote, so show "under the quote"), days, problems ("times you asked why"), stress, a one-line outcome, a closing "why" line and an achievement. `report.contractorBill` is `null` unless the player gave up. Then it is `{ rows: [{ label, cost, note }], total, quoted }`: the job at a rush price (1.35 times the quote), a `fixing your fix` row (0.3 times the quote) if the player had started, and a $250 call-out fee. |

## The cast, advice and the partner

- **Advice** comes from the neighbor, parent, friend or clerk, and points at one option. They are not equally trustworthy: the neighbor is a coin flip, the parent is mostly wrong, the friend usually picks the exciting option, and the clerk always points at the priciest. The player is never told whether they are right (`debug.adviceReliable` says, for tools).
- **The partner** nags about money or time (`cast.partnerFocus`). While that thing is over the contractor's quote, every choice adds stress and `outcome.partnerNagged` is `true`.
- **`outcome.autoConfirmed`** is the id of an earlier charge the player never answered, which the bank let through when they made their next choice. It is `null` otherwise.
- **How good an answer is** comes from the `answer_key` in the team's event files (`good`, `ok`, `wrong`, `excessive`). Good answers cost a fair price and lower risk. Wrong ones are cheap now, raise risk, and may blow up. Excessive ones cost far more than needed. For temptations, "good" means saying no, which is free.

## The phone

`POST /api/games/:id/phone` has a small local model (Qwen3 8B, through Ollama) write the texts on the player's phone and the suggested replies on its buttons, so they stay on the renovation that is actually happening.

```json
{ "with": "neighbor", "kind": "reply", "thread": [{ "from": "them", "text": "Is it done yet?" }, { "from": "me", "text": "Almost." }] }
```
```json
{ "with": "neighbor", "text": "Almost? I can hear the sander in my dreams.", "replies": ["Sorry, last day.", "It is going fine.", "Want to sand?"], "source": "model" }
```

- `with` is a role: `partner`, `clerk`, `contractor`, `parent`, `neighbor` or `friend`.
- `kind` is `advice` (the current event's advice in their words, so it needs `event.advice.from` to be that role, or `409 no_advice`), `reaction` (how they react to what the last choice did) or `reply` (their answer to the last text: `thread` must end with a `"me"` turn). Only the last 6 turns count, each cut to 200 characters. After the player's 4th answer the person says goodbye and `replies` is empty.
- **Grounded:** every prompt carries this game's facts (the job, the quote, money and days, how stressed the player is, the last decision and what it did, the event on the table) and who is talking (their role, how they behave, their first name from `cast`).
- **Checked:** the model answers in a fixed JSON shape. Lines are cut to text size, and anything with a link, markdown, emoji, a name in a button, or "as an AI" is thrown away. Advice must name the option the game says that person is pushing (`advice.ts` decides that, and whether it is a good idea; the model only phrases it) and no other option more clearly.
- **Never leaks:** the model is not told which answers are good, so it can't give the answer away.
- **Always answers:** if Ollama is off, slow or off topic, the response is `{ text: null, replies: <built-in on-topic buttons>, source: "fallback" }` and a front end uses its own line. A game never waits more than `PHONE_TIMEOUT_MS` for a text.
- **Seeded:** the model's seed comes from the game's seed, so a replay writes nearly the same texts.

To use it: `ollama pull qwen3:8b`, make sure Ollama is running (`ollama serve`, or the Ollama app), then `npm run play`. `GET /api/health` shows `phone: true` when it is configured. To try the model on its own: `LIVE_PHONE=1 npx vitest run src/service/phone.live.test.ts --disable-console-intercept`.

## Money and the bank

Every choice that costs money becomes a `charge` with `status: "pending"`. A front end shows the bank's fraud alert and asks the player.

- `confirm: true` (**"Yes, it was me"**): nothing changes.
- `confirm: false` (**"No, block it"**): the player blocked their own card. It costs a **day** and some stress, and the charge **still stands**. Answering the same charge twice does nothing more.
- Only the latest charge can be answered. An older one is rejected with `stale_charge`.
- A charge the player never answers is let through when they make their next choice. `outcome.autoConfirmed` carries its id.
- A finished game has no charge left to answer. The choice that ends the game creates its charge already `confirmed`, giving up confirms a pending one, and `payments` on a finished game answers `409 game_over`. A won game can't be turned into a lost one by blocking a card afterwards.

## Errors

Every error has the same shape, and `code` is stable, so match on it and not on `message`.

```json
{ "error": { "code": "stale_event", "message": "the current event is \"contractor-delay\", not \"valve-stuck\"" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_json` | The body isn't a JSON object. |
| 400 | `body_too_large` | Body over 4 KB. |
| 400 | `invalid_seed` | Seed isn't an integer in range. |
| 400 | `invalid_director` | Director isn't `random` or `jev`. |
| 400 | `director_unavailable` | `jev` requested but this server has no model configured. |
| 400 | `invalid_project` | No such project. |
| 400 | `invalid_owner` | Not one of the seven characters. |
| 400 | `invalid_choice` | `choice` isn't a valid index for the current event, or `eventId` isn't text. |
| 400 | `invalid_role` | `with` isn't one of the six roles. |
| 400 | `invalid_kind` | `kind` isn't `advice`, `reaction` or `reply`. |
| 400 | `invalid_thread` | `thread` isn't a list of `{ from, text }`, or a `reply` doesn't end with a `"me"` turn. |
| 400 | `invalid_payment` | `confirm` isn't `true` or `false`, or `chargeId` isn't a whole number. |
| 404 | `game_not_found` | Unknown id, or the game expired. An id that isn't letters, digits, `_` or `-` (up to 80) is treated the same way. |
| 404 | `not_found` | No such route. |
| 405 | `method_not_allowed` | Wrong HTTP method. The `Allow` header lists the right ones. |
| 409 | `game_over` | The game has already ended. |
| 409 | `stale_event` | `eventId` doesn't match the current event. Re-fetch the game and redraw. |
| 409 | `no_advice` | `kind: "advice"` for someone who has no advice about the current event. |
| 409 | `stale_charge` | That charge isn't the latest one. |
| 409 | `project_changed` | The event files were edited and an event this game needs is gone. Start a new game. |
| 500 | `internal_error` | A bug. Details go to the server log, not the response. |

## Things worth knowing

- **One request per game at a time.** If two choices arrive together, the second waits for the first. With `eventId` set, it is then rejected as `stale_event`, so a double click can't apply twice.
- **Slow calls.** With the `jev` director a choice can take a second or two while the model decides. Show a waiting state.
- **Resuming.** Games live on the server, so keep the `id` (for example in the URL) and call `GET /api/games/:id` to pick up where the player left off.
- **Limits.** The built-in store holds up to 1,000 games and drops any idle for 6 hours. `npm run play` saves games to files instead (see `GAMES_DIR`), so a restart keeps them for 7 days. The memory store clears on restart. To use a database, implement the three-method `GameStore` interface in `src/service/store.ts`. A test proves games survive a store that only keeps JSON text.
- **CORS.** Set `CORS_ORIGIN` when your front end runs on a different origin from the API. Responses, including errors, then carry the headers, and `OPTIONS` preflights are answered.

## Debug payload

`?debug=1` adds `debug` to the response. It's meant for tools, not players, because it reveals the hidden state.

```json
{
  "debug": {
    "state": { "...": "the full internal game state, including flags and house condition" },
    "maxEvents": 8,
    "adviceReliable": true,
    "choiceQualities": ["wrong", "good", "excessive"],
    "decisions": [ { "step": 2, "pickedId": "scorched_wall", "pool": [], "info": { "trace": {} } } ],
    "last": { "pool": [ { "id": "lint_everywhere", "weight": 16, "pct": 25, "picked": false } ], "forced": false }
  }
}
```

- `choiceQualities` is how good each answer to the current event is. The hands-free demo uses it.
- `last.pool` lists the events the director chose from, with the weights and chances under the random rules and, for the `jev` director, the model's own chances (`jevPct`).
- `decisions` holds every model call this game: the exact text the model was sent, its raw response, the seeded roll, and the latency. It's empty under the `random` director.

## Adding another transport

The HTTP handler in `src/server/http.ts` takes a standard `Request` and returns a standard `Response`, so it also runs in a Worker or a serverless function. The game logic itself is `GameService` in `src/service/GameService.ts`, with no HTTP in it. A command-line tool or a WebSocket server can call it directly.
