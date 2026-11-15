# app: the front door

The first thing a player sees: **splash, pick your diy-er, the story, then the game.** Plain ES modules, no build step. Open it through the game server (`npm run play` in `backend/`, then http://127.0.0.1:3001), because it talks to the backend.

| File | What it does |
|---|---|
| `main.js` | Runs the screens in order, then goes to `/frontend/?owner=<id>`. The game starts on the backend when the player takes on a glowing DIY spot in the house |
| `screens/splash.js` | The studio logo and "around the world games presents" |
| `screens/character-select.js` | Pick the home owner from the seven characters. The other six are dealt to roles by the backend |
| `screens/story.js` | The plan's scenes: the contract, the house and the cat, the living room, the contractor's text (there is no "where do you start?": the job is found in the house) |
| `screens/deed.js` | The signing screen: blurry small print, a signature pad, the green check |
| `api.js` | The only calls to the backend: the project list, and starting a game |
| `audio/` | Emote sounds (one per character) and a phone chime, made in code |
| `story/` | The house picture and the deed paper |

## Where this came from

The splash, character select, helpers and emote sounds are **Aidan's screens**. Aidan tidied `assets/` down to just art and brand (commit `4d59a21`), which removed them from `main`. They are restored here from git history (`391db4d`), restyled to the new brand in `assets/style.css`, and character select gained a Start button. The story follows `plan/plan.md` and is built from the team's house-story experiment (also history, `391db4d`), as are the two pictures in `story/`.

If Aidan has newer versions of these screens, drop them in: this folder only depends on `createScreen`/`leave` in `screens/screen.js` and on the functions `main.js` imports.

Scene 3 (the living room and the AI render) has no art yet. A placeholder card stands in for it.
