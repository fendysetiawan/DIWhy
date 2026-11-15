# Changelog

What changed, what was taken out (and where to get it back), and duplication still to clean up. Newest first.

To restore anything marked removed, use the commit given, for example:

```
git show ac4105b:app/screens/deed.js
git checkout ac4105b -- app/screens/deed.js
```

## 2026-11-14: the intro, built from `assets/`

**Scope:** everything from opening the app up to the game. The game itself (`frontend/`) is not touched yet.

### What the intro is now

1. **Splash** on the stars: the logo and its sound. If the browser blocks sound, it waits on "press any key".
2. **Character select** on the stage background, with upbeat music. Characters stand on the floor as a still of their emote art (`emote-start.svg`). Picking someone plays their `emote.svg` and their recorded line; START plays the line again. START is bottom centre; "watch the demo" is top left.
3. **Title:** the music fades to a calm track. The picked character moves into the falling house, which drops on them with a creak, a crash and pixel dust, then the "!" and DIWHY?!. From here the background is black and every change fades through black.
4. **Contract:** the real estate agent (narrator) (a deep, mumbly man's voice) welcomes you and asks you to sign; a scratchy sketching sound plays while you sign; SIGN is enabled once there's a mark; he says "Now it's yours, warts and all." The music dips while he talks.
5. **Sold:** the house with FOR SALE, stamped SOLD!, with a stamp, a champagne pop and a ta-da. The cat narrates two short lines (whole lines, NEXT moves on), then it fades straight into the game, where the job is found at a glowing DIY spot in the house.

The main button (START, SIGN, NEXT) is always bottom centre, presses down when clicked and clicks.

### Removed

| What | Where it was | Get it back from | Replaced by |
|---|---|---|---|
| The old contract screen (parchment picture, Kalam font, blurry text, green check) | `app/screens/deed.js`, `app/story/deed-paper.png`, `.deed-*` in `app/screens/story.css`, a font link in `app/index.html` | `ac4105b` | `app/screens/contract.js` playing `assets/cinematics/contract.html` |
| The story's house picture with the cat walking in | `app/story/house-sold.png`, `.house-stage`/`.camera`/`.cat` in `app/screens/story.*` | `ac4105b` | `assets/cinematics/sold.html` |
| The living room and its AI-render card | `.living`/`.owner`/`.render` in `app/screens/story.*` | `ac4105b` | The job's scene |
| Typing narration (the ▶ arrow), and the phone chime and key taps | `app/screens/story.js`, `app/audio/chime.js` | `ac4105b` | Whole lines, with NEXT |
| Picking the job in the intro ("Where do you start?"), the job's scene and its sounds, and the contractor's text on a phone | `app/screens/story.*`, `app/api.js` (the app no longer calls the backend; the game page starts the game), `app/audio/chime.js` | Never committed (earlier versions are in `ac4105b`) | Straight to the game after SOLD!; the job scenes stay in `assets/cinematics/projects/` for the game |
| "Skip intro" and the settings it used | `app/screens/character-select.*`, `app/main.js`, `app/settings.js` | `ac4105b` | None: the intro always plays |
| The cinematics as they arrived (four packed scene pages, a 30 s intro) and the wall and estimate scenes | `assets/cinematics/` | Never committed | One HTML file per scene: `contract.html`, `sold.html`, `projects/*.html`, with shared code in `cinematics/shared/` |
| Made-in-code event sounds (70 events, saw and screw loops), and footsteps | `assets/sounds/events/`, `assets/sounds/footsteps/` | Never committed | Real recordings in `assets/sounds/effects/` |
| The first menu music | `assets/sounds/music/8bit-techno.mp3` | Never committed (no recorded source or licence; it's in Aidan's Trash) | `music/select.mp3` and `music/menu.mp3` |

### Moved and renamed

| From | To |
|---|---|
| `assets/scenes/falling-house.svg` | `assets/cinematics/falling-house.svg` |
| `characters/<name>/selection.svg` | `characters/<name>/emote.svg` |
| `characters/<name>/{wrench,drill,water-spray,electric-shock}.svg` | `characters/<name>/actions/` |
| `assets/sounds/title/house-creak.wav`, `house-crash.wav` | `assets/sounds/effects/house-creak.mp3`, `house-crash.mp3` |

### Added to `assets/`

- **Cinematics:** `contract.html` (11 editable lines of small print, `CONTRACT_TERMS`), `sold.html`, a scene for each of the 12 jobs in `projects/`, and `index.html` to see them all. Open any one on its own; add `?controls` for buttons.
- **Characters:** walk sprites (revised side views) and `idle-*.svg` sharing one 67 × 140 crop; `emote-start.svg` and `reaction-start.svg` (stills); `building.svg`; 20 animated `actions/` in one shared 135 × 144 crop; `voice/` lines (an `emote.mp3` each, plus nice, oops, oh-shit, success, hooray). Emote frames re-aligned so the last pose doesn't jump. Cream background removed from between the legs of four `standing.svg`.
- **Sounds:** `effects/` (96 real recordings, 8-bit processed; sources in `effects/SOURCES.md`), `narrator/` (the contract voice-over, ElevenLabs, pitched down to a deep, mumbly man's voice), `logo/` (the logo line sung by a vocoder), `ui/` (click, pop, stamp, celebrate, and pen: a sketching scratch while you sign), `music/` (`select`, `menu`, and eight 8-bit mood loops for the game).
- **Brand:** `.brand-next` (the one spot for the main button), a pressed look and a disabled look for `.brand-button`.

### Changed outside `app/` and `assets/`

- `demo/pages/app.js` and `demo/selectors.js`: the hands-free demo follows the new order and signs the contract; the contract's pad and SIGN button replace the old deed and reply-button entries.
- `frontend/GRAPHICS.md`: sprite paths point at `assets/characters/<first-last>/`.

## Before 2026-11-14 (in `assets/`)

| Removed | Get it back from | Replaced by |
|---|---|---|
| `characters/<name>/front-still.svg` | `4d59a21` | `emote-start.svg`, `reaction-start.svg` and `standing.svg` for still poses |
| One falling house per character, and `house-chaos.svg` | Never committed | One house plus the character's `reaction.svg` plus `effects/exclamation.svg` |
| The DIWHY app, experiments, portraits, images and old logos | `391db4d` | `assets/` is art and brand only; the team restored the app screens into `app/` |

## Still to do

| What | Where | Next step |
|---|---|---|
| The game's own character sprites | Built into `frontend/index.html` | At the integration step, switch to `assets/characters/` (walk, idle, actions, emote, reaction, voice lines; see `assets/README.md`) |
| Sounds made in code | `SOUNDS` in `assets/cinematics/shared/player.js` (standalone scene previews only), the emote jingle fallback in `app/audio/emotes.js` | Swap for recordings when there are good ones |
| Sprite halos | Light outline around Travis's and Rachel's action sprites | New clean files from the artist |
