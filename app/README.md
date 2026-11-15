# app: the front door

The first thing a player sees: **splash, pick your diy-er, the story, then the game.** Plain ES modules, no build step. Open it through the game server (`npm run play` in `backend/`, then http://127.0.0.1:3001), because it talks to the backend.

| File | What it does |
|---|---|
| `main.js` | Runs the screens in order (the intro always plays), then goes to `/frontend/?owner=<id>`. The game starts on the backend when the player takes on a glowing DIY spot in the house |
| `screens/splash.js` | The studio logo and "around the world games presents", with its sound |
| `screens/character-select.js` | Pick the home owner from the seven characters. The other six are dealt to roles by the backend |
| `screens/story.js` | The intro, in order: the title, the contract, the house stamped SOLD!, then straight to the game (the job is found in the house). The cat narrates; every change fades through black |
| `screens/title.js` | The title: `assets/cinematics/falling-house.svg` falls on your character's `reaction.svg`, the "!" pops up, DIWHY?! appears, fade to black |
| `screens/contract.js` | The contract (`assets/cinematics/contract.html`). Sign on the line; SIGN is enabled once you have |
| `screens/cinematic.js` | Loads the cinematics from `assets/cinematics/` and plays a scene full-window |
| `audio/` | `emotes.js` (each character's recorded voice lines from `assets/characters/<id>/voice/`, with a made-in-code jingle if one is missing), `music.js` plays `select.mp3` (upbeat) on character select and fades to `menu.mp3` (calm) for the story; `narrator.js` plays the narrator's voice-overs (and dips the music); `sfx.js` plays the interface sounds in `assets/sounds/ui/` and the falling house's creak and crash |

## Where this came from

The splash, character select, helpers and emote sounds are **Aidan's screens**. Aidan tidied `assets/` down to just art and brand (commit `4d59a21`), which removed them from `main`. They are restored here from git history (`391db4d`), restyled to the new brand in `assets/style.css`, and character select gained a Start button. The story follows `plan/plan.md` and is built from the team's house-story experiment (also history, `391db4d`). The scenes are our cinematics in `assets/cinematics/`.

If Aidan has newer versions of these screens, drop them in: this folder only depends on `createScreen`/`leave` in `screens/screen.js` and on the functions `main.js` imports.

Everything up to the game (this folder) is the intro. The game itself is `frontend/`.
