# DIWHY?! assets

The art and brand for DIWHY?! by Around The World Games.

> **This folder is the single source of truth for game assets.**
> When you build or refactor any part of the game, take sprites, backgrounds, sounds, logos and styles from here, not from copies elsewhere.
> If something you need isn't here yet, bring it into `assets/` first: put it in the right folder, give it a clear lowercase name (people as `first-last`, words joined with `-`), crop it to its content, and add a line about it to this README. Then use it from here.

**See it all on one page: [style.html](style.html)** (the font, colours, styles, logos, characters and music), and every scene playing on [cinematics/index.html](cinematics/index.html). Start the game server (`npm run play` in `backend/`) and open http://127.0.0.1:3001/assets/style.html

```
assets/
├── style.css      the brand: the blues, the font (Press Start 2P) and ready-made styles
├── style.html     the style guide: everything in style.css on one page
├── cinematics/    cut scenes, one HTML file each (contract, sold, ...) + shared/
├── characters/    the seven team characters and the cat, one folder each
├── backgrounds/   character-select.svg and stars.svg
├── logos/         Around The World Games logos and the team globe
├── effects/       small extras, like the "!" over a character
├── sounds/        music, the logo sound, interface sounds and sound effects, one folder each
└── precedents/    precedents to learn from, not game art
```

## Cinematics

Animated pixel-art cut scenes. **Each scene is one HTML file**: open it (through the local server) to watch it on its own, and add `?controls` for pause, restart and sound. The app pulls the same files in.

| File | What it is |
|---|---|
| `contract.html` | The contract unrolls, then waits until the player signs it. The small print is `CONTRACT_TERMS` at the top |
| `sold.html` | The house with its FOR SALE sign; then a red SOLD! stamp (the app stamps it when the player clicks NEXT) |
| `projects/<job id>.html` | One per job (12): the room as it is, with the problem showing, looping. Not used in the intro any more; ready for the game |
| `index.html` | All the scenes on one page, playing |
| `falling-house.svg` | The title's house front falling; the app puts the picked character and the "!" on top (see The falling house below) |
| `shared/` | What every scene file uses: `player.js` (the clock, sound cues, waiting for the player, loading a scene into another page), `pixel-art.js` (drawing helpers), `cinematic.css` (the stage and its colours), `controls.js` (the `?controls` buttons) |

A scene file has its own `<style id="scene-style">` and `<script id="scene">`; edit those to change it.

## Characters

`characters/<first-last>/`, one folder per person: `aidan-newsome`, `christian-huber`, `fendy-seitiawan`, `gigi-singh`, `rachel-katz`, `ramy-maher`, `travis-potter`. Plus `characters/cat/`.

| File | What it is |
|---|---|
| `front.svg`, `back.svg`, `left.svg`, `right.svg` | Walking, four directions. Each stands still, then walks (from 0.42s, looping). Cropped to 67×140 artwork, shown at 3× |
| `idle-front.svg`, `idle-back.svg`, `idle-left.svg`, `idle-right.svg` | Standing still and breathing, four directions (3.4s loop). Same 67×140 box as the walk, so switching between idle and walking never jumps |
| `emote-start.svg` | The first frame of `emote.svg`, as a still (same 238×297 box). Character select shows it, then swaps to `emote.svg` when you pick them, so they never shift |
| `reaction-start.svg` | The first frame of `reaction.svg`, as a still (same 88×123 box). The title starts from it (the picked character moves into the falling house in this pose) |
| `actions/` | 20 animated actions, 1.2–1.4 s loops, all cropped to one shared 135×144 box (shown at 3×). **Working:** `wrench`, `drill`, `under-sink`, `ceiling-reach` (on a ladder), `floor-prying`, `paint-roller`, `caulking`, `push-pull`, `carry-box`, `measuring`. **Reacting:** `water-spray`, `electric-shock`, `dust-cough`, `bad-smell`, `fright`, `flashlight`, `phone`, `talking`. **Ending:** `exhausted`, `celebration`. Same 160×160 art frame as the walk sprites, so to line one up with `front.svg`, place it 33 art px left and 11 up |
| `building.svg` | Hammering at a workbench (1.12s loop). Cropped to 276×340 (same box for everyone) |
| `emote.svg` | Their emote: standing, then a victory pose (for character select). Plays once and holds the last pose. Cropped to 238×297 (same box for everyone) |
| `reaction.svg` | Their reaction when the house falls (8.8 s), cropped to 88×123. Placed on top of `cinematics/falling-house.svg` (see The falling house) |
| `standing.svg` | Large full-body version, transparent background, cropped tight (about 160×345) |

**The cat** (`characters/cat/`): the blue bandana cat, one animated SVG per mood: `normal`, `standing`, `sitting`, `eating`, `sleepy`, `mischievous`, `scared`.

**Voices** (`characters/<first-last>/voice/`): short recorded lines, trimmed and levelled. `emote.mp3` is each person's own line, played when you pick them on character select (Aidan "let's go", Fendy "ba-da-da", Gigi "lalala", Rachel "ah", Ramy "heya", Travis "hmmm", Christian "yep yep"). Everyone also has `nice`, `oops`, `oh-shit`, `success` and `hooray` (Aidan has `sweet` instead of `hooray`).

**For the integration step (not done yet):** the game (`frontend/`) still uses its own built-in character sprites. When the intro and the game are joined up, switch it to these files: the walk sprites and `idle-*.svg` for moving and standing, the `actions/` (and `building.svg`) while working and when events hit, `emote.svg` for celebrating, `reaction.svg` for disasters, the `voice/` lines to go with them (`nice`/`success`/`hooray` for good moments, `oops`/`oh-shit` for bad ones), and `reaction-start.svg` / `standing.svg` for still poses. Then delete the built-in copies.

## Logos

| File | What it is |
|---|---|
| `around-the-world-games-logo.svg` | **The studio logo**: the spinning team globe with map pins and an orbiting spaceship (animated) |
| `team-world.svg` | Spinning globe with a pin for where each teammate is from and where they are now |

## The falling house (the title)

| File | What it is |
|---|---|
| `cinematics/falling-house.svg` | The house front falls (our *Steamboat Bill, Jr.* moment) and the wrecked interior shows. Nobody in it: the game adds the chosen character on top. 840×660 frame, 8.8 s loop |

**Building the falling house for any character.** Stack three pieces, all on the same 8.82-second timeline (start them together):

| Layer | File | Where in the 840×660 frame |
|---|---|---|
| 1 | `cinematics/falling-house.svg` | fills the frame |
| 2 | `characters/<name>/reaction.svg` | x 377, y 435 (88×123) |
| 3 | `effects/exclamation.svg` | x 408, y 378 (24×48), shown from 74.6% of the loop to the end |

## Effects

`effects/exclamation.svg`: the orange "!" that pops up over a character.

## Sounds

Sounds live in `sounds/`, one folder per kind. Sound effects for things in the game are **real recordings**, processed to sound a bit 8-bit (see `sounds/effects/` below).

| Folder | Files | What they are |
|---|---|---|
| `sounds/music/` | `select.mp3`, `menu.mp3` | The intro music, 8-bit. `select`: upbeat and bouncy (140 bpm, drums), for character select. `menu`: calm and cosy (76 bpm, no drums), for the story after START. The app fades from one to the other |
| `sounds/music/` (moods) | `home.mp3`, `work.mp3`, `uh-oh.mp3`, `disaster.mp3`, `temptation.mp3`, `phone.mp3`, `victory.mp3`, `defeat.mp3` | Background loops, one per mood (made from scratch, no licence needed): **home** warm and easy (walking around the house), **work** busy and upbeat (doing a job), **uh-oh** tense (a problem shows up), **disaster** fast and frantic (it's going badly wrong), **temptation** dreamy and sparkly (the shiny upgrade, the partner's idea), **phone** light and quirky (texts), **victory** happy (job done), **defeat** slow and sad (gave up or ran out of money). 6–13 s each; set `loop` |
| `sounds/logo/` | `around-the-world-games.wav` | The logo sound (3.1 s): "Around the world games presents" sung by a vocoder (a recorded voice shaping a bright synth chord, A to B to D major), with soft echoes. Plays with the splash |
| `sounds/narrator/` | `contract.mp3`, `contract-signed.mp3` | The real estate agent narrating (ElevenLabs, voice "Jessica"), pitched down to a deep man's voice, a little slower and muffled so it's mumbly, with a light 8-bit crunch. `contract`: "Congratulations on purchasing your first home. Are you ready? Great. Sign right here on the dotted line." (7.1 s, as the contract opens). `contract-signed`: "Now it's yours, warts and all." (2.5 s, after SIGN) |
| `sounds/ui/` | `click.wav`, `pop.wav`, `stamp.wav`, `celebrate.wav`, `pen.wav` | Interface sounds: a button press, something appearing (narration, a button, the title), the SOLD! stamp (Kenney, CC0), and `celebrate.wav`, a champagne cork, fizz and an 8-bit ta-da for when the house is yours (made in code), and `pen.wav`, a scratchy sketching loop that plays while you sign the contract (made in code) |
| `sounds/effects/` | 96 `.mp3` files, named for what they are (`toilet-flush`, `pipeburst`, `power-drill`, `circuit-breaker`, `wood-crack`, `carpet-ripping`, `footsteps-wood`, `grunt`, `ewww`, `house-creak`, `house-crash`...) | Real recordings of things in the house, footsteps, people's reactions and tools, processed so they sit with the 8-bit music (8-bit crunch, levelled, trimmed, at most 15 s). Where each one came from is in `effects/SOURCES.md` (most are from Pixabay). To add one, run it through the same chain: `ffmpeg -i in.mp3 -t 15 -af "aformat=channel_layouts=mono,highpass=f=70,silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,acompressor=threshold=-20dB:ratio=3:attack=5:release=100,acrusher=bits=8:mode=lin:samples=4:mix=0.85:aa=0.3,lowpass=f=9000,loudnorm=I=-16:TP=-1.5" -ac 1 -b:a 128k effects/<name>.mp3`, then add a line to `SOURCES.md`. **Used in the intro so far:** `house-creak` and `house-crash` (the title) |

## Brand

`style.css` is the brand document: link it (or `@import` it) to get the colours, the font and the styles. [style.html](style.html) shows it all.

- **Colours:** blues, like an old Final Fantasy menu: navy `#0c1450` (background), blue `#2a44c0` (windows and panels), sky `#9cc3ff` (highlights), cream `#f7e8d1` (text).
- **Font:** **Press Start 2P**, for everything, in two sizes: 32px for titles, 16px for everything else.
- **Backgrounds:** `backgrounds/character-select.svg` is the animated background for the character selection screen (1672×941): a night-time wooden stage with a glowing circle, a toolbox and planks on the left, eyes peering out of the dark trees, and a dotted trail of sparkles. `backgrounds/stars.svg` is a full-screen (1920×1080) deep blue sky with twinkling blue pixel stars; `.brand-stars` fills the page with it.
- **Ready-made styles:** `.brand-navy` (the background), `.brand-stars` (twinkling stars), `.brand-window` (a Final Fantasy-style window), `.brand-title`, `.brand-text`, `.brand-highlight`, `.brand-button`.

## Precedents

- `precedents/steamboat-bill-jr-buster-keaton.mp4`: the falling house front from *Steamboat Bill, Jr.* (1928, public domain), 11 seconds
