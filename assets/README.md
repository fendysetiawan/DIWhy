# DIWHY?!

A game by Around The World Games, built as a series of small, plain vanilla JS experiments. No build step and no dependencies.

## The app

[app/](app) is the real game. So far:

1. **Splash** (plays every time, unless **skip intro** is ticked on the character screen): on the dark blue background, the studio logo (the spinning team globe) and "around the world games presents" fade in together, stay for 3.5 seconds (click to skip), then fade out.
2. **Character select:** "pick your diy-er", with all seven teammates in a row (it wraps on small screens), standing still with their name underneath. Someone is always selected (Travis, the first in the list, to start), so everyone else is always faded back. Hovering lights someone up too; clicking selects them, plays their emote sound and fires a `character:chosen` event with who you picked. A small **skip intro** checkbox sits in the bottom-right corner.

Each screen is its own module in `screens/`, with its own CSS next to it. `main.js` just runs them in order. The app uses ES modules, so open it through the local server (see Running), not straight from the file.

| File | What it does |
|---|---|
| `index.html` | An empty page with `<div id="app">`; the screens put themselves in it |
| `main.js` | Runs the screens in order (splash unless skipped, then character select) |
| `settings.js` | Player settings remembered in the browser (`skipIntro`) |
| `screens/screen.js` | Shared helpers: `createScreen()` makes a full-window screen, `leave()` fades one out |
| `screens/splash.js` / `splash.css` | Screen 1: the splash |
| `screens/character-select.js` / `character-select.css` | Screen 2: character select. The cast list (`CAST`) is at the top |
| `audio/emotes.js` | Placeholder emote sounds, one tiny 8-bit jingle per character, made in code with Web Audio (no sound files). `playEmote(id)` |
| `style.css` | The one stylesheet the page loads: page basics, plus it imports `brand.css` and each screen's CSS |
| `brand.css` | The brand. Colours: mustard `#eeb155`, navy `#0c1450` (the game background, a Final Fantasy-style dark blue gradient via `.brand-navy`), forest `#29372d`, cream, ink, slate and the cat's blues. Fonts: **Caveat Brush** (main/titles), **Amatic SC** (taglines), **Nunito** (reading text), **Fredoka** (buttons, labels, headlines), **Press Start 2P** (retro game text), **Space Mono** (numbers, prices). Ready-made styles: `.brand-bg`, `.brand-navy`, `.brand-dark`, `.brand-title`, `.brand-tagline`, `.brand-eyebrow`, `.brand-headline`, `.brand-body`, `.brand-ui`, `.brand-pixel`, `.brand-mono`, `.brand-button`. Imported by `style.css` |
| `brand.html` | A one-page brand sheet: title, studio logo, colours, the team and the cat |
| `assets/around-the-world-games-logo.svg` | **The final studio logo**: the spinning team globe with map pins and an orbiting spaceship (animated). Shown on the splash |
| `assets/around-the-world-games.svg` | Earlier logo with the words (pixel art, no fonts needed) |
| `assets/around-the-world-games-globe.svg` | Just the globe and its orange ring from the logo, no words |
| `assets/around-the-world-games-globe-animated.svg` | Animated pixel globe with a spaceship orbiting it |
| `assets/sprites/cat/` | The blue bandana cat sprites: normal, standing, sitting, eating, sleepy, mischievous, scared (animated SVG) |
| `assets/sprites/people/` | Pixel portraits of the team, one per person. The `.svg` versions have no background so they sit on anything; the `.png` versions keep their original backdrop and are true size (about 40×39 pixels), so scale them up with `image-rendering: pixelated` |
| `assets/sprites/team/<name>/` | Full-body pixel characters for each teammate (`aidan-newsome`, `travis-potter`, `rachel-katz`, `christian-huber`, `ramy-maher`, `gigi-singh`, `fendy-seitiawan`): `standing.svg` (400×400, cream background) plus animated `front.svg`, `back.svg`, `left.svg`, `right.svg`, and `front-still.svg` (the front view with the animation taken out) |
| `assets/team-world.svg` | Animated pixel globe spinning with a pin for where each teammate is from and where they are now |
| `assets/house-sold.png`, `assets/deed-paper.png` | The house picture and the deed paper |

## Experiments

Small throwaway sketches that feed into the app.

| # | Folder | What it is |
|---|--------|------------|
| 03 | [experiments/03-the-deed](experiments/03-the-deed) | A quitclaim deed for the house you just bought: a photo of the place, a list of ridiculous conditions, a signature pad and a **Sign** button that stamps it RECORDED. |
| 05 | [experiments/05-house-story](experiments/05-house-story) | The house story: narration, choices, the deed to sign, then SOLD slaps onto the sign (was in the app) |
| 04 | [experiments/04-desktop](experiments/04-desktop) | The XP-style desktop: rolling-hills background, a DIY icon, and a window that opens when you click it (no longer in the app) |
| 02 | [experiments/02-rolling-hills](experiments/02-rolling-hills) | Main background: a painted green hill under a deep-blue sky with slow-drifting clouds, all procedural canvas (R rerolls the clouds) |

## References

`references/` holds reference material, not game assets:

- `steamboat-bill-jr-buster-keaton.mp4`: the falling house front from *Steamboat Bill, Jr.* (1928, public domain), 11 seconds

## Running

Serve the repo (the app needs this; experiments can also be opened straight from the file):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/assets/app/
```

Each experiment is self-contained (`index.html`, `style.css`, `main.js`). To start a new one, copy the previous folder to `experiments/NN-name/`.
