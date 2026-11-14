# DIWhy backend API

A JSON API over HTTP. It runs the whole game: rules, events, dice and the end report. A front end only has to draw what it receives and send back the player's choices.

- **Contract:** [`src/service/types.ts`](src/service/types.ts) holds every request and response shape. Copy it or import it as types only.
- **Typed client:** [`src/client/GameClient.ts`](src/client/GameClient.ts) is a small wrapper over these endpoints. Use it, or treat it as a worked example.
- **Reference front end:** the page in `src/ui` is a front end built on this contract alone. It imports no game code, and a test enforces that.

## Running it

| Command | What you get |
|---|---|
| `npm run dev` | The reference page and the API on one port (5173), with live reload. No CORS to think about. |
| `npm run api` | The API alone, on `http://127.0.0.1:3001/api`. Use this when your front end runs somewhere else. |

Settings for `npm run api` (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | Port to listen on. |
| `HOST` | `127.0.0.1` | Interface to bind. `0.0.0.0` accepts other machines. |
| `CORS_ORIGIN` | unset (no CORS headers) | Allowed origin for browsers on another origin, such as `http://localhost:3000`, or `*`. |
| `JEV_URL` | `http://127.0.0.1:8009/v1/systemone` | Where the Jev model server is. Set it to an empty string to turn the `jev` director off. |

The API has no authentication. Keep it on localhost or behind something that adds access control before exposing it.

## Playing a game

1. `POST /api/games` starts a game and returns the first event.
2. Show `event` and its `choices`. When the player picks one, `POST /api/games/:id/choices`.
3. The response is the next state. Repeat until `status` is no longer `"playing"`.
4. When the game is over, `report` holds the end-of-game summary.

```js
const api = 'http://127.0.0.1:3001/api';
const post = (path, body) =>
  fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

let game = await post('/games', { seed: 42 });
while (game.status === 'playing') {
  const pick = game.event.choices[0]; // ask the player here
  game = await post(`/games/${game.id}/choices`, { choice: pick.index, eventId: game.event.id });
}
console.log(game.report.achievement.title);
```

## Endpoints

| Method and path | Body | Success | Notes |
|---|---|---|---|
| `GET /api/health` | none | `200` `{ status, directors }` | Which directors this server can use. |
| `POST /api/games` | `{ seed?, director? }` | `201` GameView, `Location` header | Body may be empty. |
| `GET /api/games/:id` | none | `200` GameView | Safe to call any time, for example to resume after a reload. |
| `POST /api/games/:id/choices` | `{ choice, eventId? }` | `200` GameView | Applies the choice, then picks the next event. |
| `DELETE /api/games/:id` | none | `204` | Throws the game away. |

Add `?debug=1` to any game request to include the `debug` payload (see below).

### Request fields

- **`seed`:** integer from 0 to 4294967295. Leave it out for a random one. The same seed with the same choices always gives the same game under the `random` director.
- **`director`:** `"random"` (default) or `"jev"`, a local decision model that picks which event happens next. If the model server is down, the game carries on with random picks.
- **`choice`:** the `index` of one of the current event's `choices`.
- **`eventId`:** optional but recommended. It's the `id` of the event the player was looking at. If the game has moved on (a double click, a second tab), the server answers `409 stale_event` and changes nothing.

## The GameView

Every endpoint that returns a game returns this shape. This is a real response, trimmed.

```json
{
  "id": "76fc453c-0fe2-4594-a5cd-2715b795861d",
  "seed": 42,
  "director": "random",
  "status": "playing",
  "failure": null,
  "stats": { "budget": 5000, "spent": 0, "daysElapsed": 0, "maxDays": 30, "stress": 0, "riskDebt": 0, "problems": 0 },
  "ledger": [],
  "log": [],
  "event": {
    "id": "valve-stuck",
    "kind": "problem",
    "title": "The shutoff valve won't close",
    "description": "You watched a six-minute video called \"Faucet swap: so easy!\" ...",
    "choices": [
      { "index": 0, "label": "Force it", "cost": 0, "days": 0 },
      { "index": 1, "label": "Replace the valve", "cost": 180, "days": 1 },
      { "index": 2, "label": "Call a plumber", "cost": 450, "days": 2 }
    ]
  },
  "report": null
}
```

| Field | Meaning |
|---|---|
| `status` | `"playing"`, `"complete"` (the faucet got installed) or `"failed"`. |
| `failure` | When `status` is `"failed"`: `"budget"`, `"time"` or `"stress"`. Otherwise `null`. |
| `stats` | The numbers to show the player. `riskDebt` is shown in the reference page, so hide it if you want the risk to stay secret. |
| `ledger` | Every cost so far, as `{ label, cost }`. Negative means a refund. |
| `log` | Flavor text from recent choices, newest first. |
| `event` | What to decide now. `null` once the game is over. `kind` is `problem`, `temptation`, `humor` or `finale`. |
| `choices[].cost`, `days` | What the player is told up front. Hidden consequences and dice rolls are never sent. |
| `report` | `null` while playing. When over: estimate, actual cost, overrun percentage, days, problems, stress, a one-line outcome, a closing "why" line and an achievement. |

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
| 400 | `invalid_choice` | `choice` isn't a valid index for the current event. |
| 404 | `game_not_found` | Unknown id, or the game expired. |
| 404 | `not_found` | No such route. |
| 405 | `method_not_allowed` | Wrong HTTP method. The `Allow` header lists the right ones. |
| 409 | `game_over` | The game has already ended. |
| 409 | `stale_event` | `eventId` doesn't match the current event. Re-fetch the game and redraw. |
| 500 | `internal_error` | A bug. Details go to the server log, not the response. |

## Things worth knowing

- **One request per game at a time.** If two choices arrive together, the second waits for the first. With `eventId` set, it is then rejected as `stale_event`, so a double click can't apply twice.
- **Slow calls.** With the `jev` director a choice can take a second or two while the model decides. Show a waiting state.
- **Resuming.** Games live on the server, so keep the `id` (for example in the URL) and call `GET /api/games/:id` to pick up where the player left off.
- **Limits.** The built-in store holds up to 1,000 games and drops any idle for 6 hours. A restart clears everything. To persist games, implement the three-method `GameStore` interface in `src/service/store.ts`. A test proves games survive a store that only keeps JSON text.
- **CORS.** Set `CORS_ORIGIN` when your front end runs on a different origin from the API. Responses, including errors, then carry the headers, and `OPTIONS` preflights are answered.

## Debug payload

`?debug=1` adds `debug` to the response. It's meant for tools, not players, because it reveals the hidden state.

```json
{
  "debug": {
    "state": { "...": "the full internal game state, including flags and house condition" },
    "maxEvents": 8,
    "decisions": [ { "step": 2, "pickedId": "while-were-at-it", "pool": [], "info": { "trace": {} } } ],
    "last": { "pool": [ { "id": "corroded-pipes", "weight": 14.2, "pct": 12.5, "picked": false } ], "forced": false }
  }
}
```

- `last.pool` lists the events the director chose from, with the weights and chances under the random rules and, for the `jev` director, the model's own chances (`jevPct`).
- `decisions` holds every model call this game: the exact text the model was sent, its raw response, the seeded roll, and the latency. It's empty under the `random` director.

## Adding another transport

The HTTP handler in `src/server/http.ts` takes a standard `Request` and returns a standard `Response`, so it also runs in a Worker or a serverless function. The game logic itself is `GameService` in `src/service/GameService.ts`, with no HTTP in it. A command-line tool or a WebSocket server can call it directly.
