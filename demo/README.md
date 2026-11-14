# demo: the hands-free play-through

A full playthrough that plays itself at **1.5x speed**, with a visible mouse making every selection. For showing the game without anyone playing.

**Watch it:** start the game (`npm run play` in `backend/`), then open one of:

- http://127.0.0.1:3001/app/?demo=1 the whole thing, from the splash to the final report (about 2 minutes 15). The **watch the demo** link on the character screen does the same.
- http://127.0.0.1:3001/app/?demo=short just the game, skipping the intro (about a minute and a half).

- **Stop it:** press Escape, or just move your real mouse. It hands control back.
- **Other speeds:** add `&speed=3` (default `1.5`).

## What the mouse does

Splash (clicks through), looks at a few characters and picks one, presses Start, **signs the contract** with a drawn signature and the green check, clicks through the story, picks the dryer, answers the contractor with "I'll do it myself", then in the game: opens the phone to read the advice, picks an option on each event card, answers the bank ("Yes, it was me", and once "No, block it." for drama), asks the contractor for a new quote, and ends on the report.

## How it works

It drives the **real pages**. `actor.js` moves a fake pointer to each target and sends real events (pointerdown, mousedown, pointerup, mouseup, click) to the real element, so the page's own code runs. Nothing is faked, so the demo keeps working as the game changes.

| File | What it does |
|---|---|
| `index.js` | Starts the demo for a page: sets the speed, speeds up CSS animations, runs the script, hands back control |
| `actor.js` | The pointer: moves with the frontend's easing curve, ripples on click, hover, drag (the signature), wait-for |
| `pages/app.js` | The front door: splash, character, contract, story |
| `pages/game.js` | The gameplay page: advice, options, bank, contractor, report |

The demo plays one **fixed game** (the dryer, seed `DEMO_SEED` in `app/main.js`), so it tells the same story every time. If someone changes the dryer's events and the story stops being good, search for a new seed: play the policy below over seeds 0 to 600 against `GameService` and keep one that reaches the beehive, has a blow-up, and ends over the contractor's quote.

The picks follow a **policy by step** (good, good, wrong, good, ok, excessive, good...), read from the answer qualities in the team's event files, so editing events changes the story but doesn't break the demo. Open `pages/game.js` and change `POLICY` to change the story.

`?demo=1` is passed from the front door to the game page automatically.
