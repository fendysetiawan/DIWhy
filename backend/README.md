# DIWhy backend

**Do it yourself. Then ask why.**

A game where replacing one $250 faucet snowballs into a very different project. You watched a six-minute video. How hard could it be? Choices change a hidden state, the state decides which events can happen next, and the end report counts the moments you asked "why?"

This folder is the backend: the game rules, the HTTP API that serves them, and a small developer console. The game itself is played through the front-end folders next to it (`../app`, `../frontend`), which this server also serves. If you are building a different front end, start with [`API.md`](API.md).

The events are not in this folder: they are the team's CSV files in `../events`, read live. This folder turns them into playable jobs.

TypeScript, Vite, no frameworks. Events are picked by weighted random, or by a local decision model (Jev) so the two can be compared.

## Run it

```
npm install
npm run play       # THE GAME: front door, gameplay page and API at http://127.0.0.1:3001
npm run api        # the API alone: http://127.0.0.1:3001/api
npm run dev        # the developer console (dev mode, Jev traces) with live reload: http://localhost:5173
npm test           # all tests
npm run e2e        # play the whole hands-free demo in a real Chrome and photograph each stage
```

Pick a seed to reproduce a playthrough: `http://localhost:5173/?seed=42`. Dev mode is off by default. See [Dev mode](#dev-mode).

## How it's organized

```
src/
  engine/         the rules. Pure functions, no I/O.
  data/events.ts  the built-in bathroom events (the plan's "leaking pipe" job)
  content/        turns the team's event CSVs into playable jobs: the CSV parser, what each
                  answer quality costs, which events follow which, each job's contractor quote
  directors/      who picks the next event: Jev (local model) lives here
  service/        the backend core: GameService, the JSON contract (types.ts), the game store,
                  the cast, the advice
  server/         HTTP: the API handler, the static file server, the CSV loader, entry points
  client/         a typed client for the API (any front end can use or copy it)
  ui/ dev/ main.ts  a small developer console. Uses only the JSON contract.
e2e/              a real-browser runner for the demo (Chrome over the DevTools protocol)
```

Each layer may only use the ones below it, and `architecture.test.ts` fails if an import breaks the rules:

```
front end (ui, dev, client, main)  --types only-->  service/types
server  -->  service  -->  content, directors, data, engine
```

The important consequence: the front end holds no game rules, and its bundle contains no event text. A different front end gets exactly the same view of the game.

The loop: a front end calls `POST /api/games`, shows the event, sends the player's choice, and gets the next event back. Behind that, `GameService` applies the choice with `applyChoice()`, asks the director for the next event with `nextEvent()`, and saves the game. Games are plain JSON records, so any store can hold them.

### Eligibility

An event can be offered only if all three hold:

1. It hasn't been shown yet. Every event is one-time, so loops are impossible.
2. Its own `eligible(state)` is true. This is where hard prerequisites live. For example, `hidden-water-damage` needs `house.waterDamage`, and `heated-floors` needs the `new-tile` flag.
3. Its `weight(state)` is above zero.

The opening event (`valve-stuck`) is eligible only when the history is empty, and everything else waits until after it.

### Weighted randomness

Each eligible event reports a weight. `RandomDirector` lays the weights end to end, rolls a number up to their total, and picks the event whose segment it lands in. Weights 30 and 10 means 3 to 1 odds, but the lighter event can still win. The roll comes from a seeded generator, so the same seed and the same choices always replay the same game. The generator's position is saved with the game, so a game resumed from storage rolls the same dice.

### Risk debt

Cutting corners adds `riskDebt` (a number from 0 up). Careful, expensive choices reduce it. It feeds in two places:

- **Weights.** `corroded-pipes` and `hidden-water-damage` get heavier as risk debt grows, so shortcuts attract the nasty events.
- **Gamble chances.** Cheap options carry a hidden dice roll, such as the GFCI patch sparking or the DIY install leaking. Its chance is a function of risk debt.

Players see costs and days on every choice, but never the dice rolls.

### Flags (how events connect)

Choices add string flags to the state: `wall-open`, `new-tile`, `tile-order`, `upgrade-fever`. Other events read them. Example chain:

```
Premium tile (adds new-tile, tile-order)
   -> Heated floors become eligible (needs new-tile)
         -> adds floors-need-wiring -> Outdated wiring gets much heavier
   -> Tile discontinued becomes eligible (needs tile-order)
```

`upgrade-fever` can stack (duplicates are allowed). It's the "while we're at it" pressure, and temptations get heavier with each stack.

### Why the game always ends

- Events never repeat.
- After `MAX_EVENTS` (8) events, or when nothing else is eligible, the engine serves the finale, and both its choices complete the job.
- Failure checks run after every choice: budget spent, more than 30 days, or stress at 100.

A test plays 300 seeds to the end to check this.

## Add a new event

Append to `EVENTS` in `src/data/events.ts`:

```ts
{
  id: 'neighbor-drops-by',
  kind: 'humor',
  title: 'Your neighbor has opinions',
  description: 'He has done his own bathroom. Twice. He would like to share the photos.',
  eligible: (s) => s.eventHistory.length > 0,          // when it may happen
  weight: (s) => 6 + s.stress * 0.1,                   // how likely, relative to others
  choices: [
    { label: 'Listen politely', effects: { days: 1, stress: 5 }, result: 'You now know a lot about grout.' },
    { label: 'Ask for his plumber', effects: { cost: 100, risk: -10 }, result: 'His plumber is excellent. And booked.' },
  ],
},
```

Use `addFlags` in a choice to unlock other events, and `gamble` for a hidden dice roll. No other code changes: the API and any front end pick the new event up automatically.

## Directors: random vs a local decision model

`EventDirector` is a single method: `selectEvent(state, candidates)`. `RandomDirector` is the default. `JevDirector` sends the game state and the candidate event ids to a local OpenJev server and samples the pick from the probabilities it returns. It only ever chooses among events the engine already approved. If the server is down, it falls back to random and says so in the debug payload. Choose it per game with `{ "director": "jev" }`. `COMPARISON.md` has results from 30 seeds per director.

## Dev mode

Dev mode adds a panel next to the reference page, and it's how you watch the Jev director work. The dev code is a separate chunk that's only downloaded when dev mode is on. It reads the API's `?debug=1` payload, so it shows the same thing against a remote backend.

**Switching it on or off:**

- Click **Dev mode: off** in the footer. The choice is remembered in the browser.
- Or use the URL: `?dev=1` turns it on and `?dev=0` forces it off (the URL wins over the remembered choice).
- Turning it off while Jev is the director restarts the same seed with the random director.

**In the panel:**

- **Event director:** Random or Jev. Switching replays the same seed, so you can compare stories. `?director=jev` starts on Jev.
- **State:** every number, flag and house condition, flashing when it changes, plus the event history and raw JSON.
- **Director pool:** the eligible events with their weights and chances, and Jev's probabilities next to them.
- **Jev decision log:** for each model decision, the exact state it was sent, the question and options, the raw response, the seeded roll, and the latency. Everything for the newest decision is expanded, and you can download the whole trace as JSON.

**Pointing the page at a separate API:** build or run it with `VITE_API_URL=http://localhost:3001` and set `CORS_ORIGIN` on the API.

**Running the model** (Python 3.11 to 3.13 is required by the package). From the repo root:

```
uv venv --python 3.12 .venv
.venv/bin/python -m ensurepip && .venv/bin/python -m pip install "openjev-ai[serve]"
.venv/bin/wev serve --model alanhuangya/OpenJev-4B --port 8009 --device mps --dtype bf16
```

The backend calls `http://127.0.0.1:8009/v1/systemone`. Set `JEV_URL` to change that, or to an empty string to switch the `jev` director off. For a smaller, faster model use `alanhuangya/OpenJev-1.7B`.

**Comparing directors over many seeds** (opt-in because it calls the model):

```
VITE_COMPARE=1 VITE_COMPARE_N=30 npx vitest run src/directors/compare.test.ts --disable-console-intercept
```

## Next experiments

1. **Rule-based director.** Add a director that favors variety and pacing (one big temptation, then one problem, avoiding streaks). Compare its stories with random on 20 seeds.
2. **Prompt variants for Jev.** Reword the question so the model weighs the game state more heavily, and measure whether its picks follow from the state.
3. **A second front end.** Build it against `API.md` and see what the contract is missing.
