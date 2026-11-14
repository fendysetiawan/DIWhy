# DIWHY?! assets

The art and brand for DIWHY?! by Around The World Games.

**See it all on one page: [style.html](style.html)** (the font, colours, styles, logos and characters). Serve the repo and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/assets/style.html
```

```
assets/
├── style.css      the brand: the blues, the font (Press Start 2P) and ready-made styles
├── style.html     the style guide: everything in style.css on one page
├── characters/    the seven team characters and the cat, one folder each
├── backgrounds/   stars.svg: a repeating pixel starfield
├── logos/         Around The World Games logos and the team globe
└── precedents/    precedents to learn from, not game art
```

## Characters

`characters/<first-last>/`, one folder per person: `aidan-newsome`, `christian-huber`, `fendy-seitiawan`, `gigi-singh`, `rachel-katz`, `ramy-maher`, `travis-potter`. Plus `characters/cat/`.

| File | What it is |
|---|---|
| `front.svg`, `back.svg`, `left.svg`, `right.svg` | Animated four-direction sprites (160×160 artwork) |
| `front-still.svg` | The front view with the animation taken out |
| `standing.svg` | Large full-body version (400×400, cream background) |

**The cat** (`characters/cat/`): the blue bandana cat, one animated SVG per mood: `normal`, `standing`, `sitting`, `eating`, `sleepy`, `mischievous`, `scared`.

## Logos

| File | What it is |
|---|---|
| `around-the-world-games-logo.svg` | **The studio logo**: the spinning team globe with map pins and an orbiting spaceship (animated) |
| `team-world.svg` | Spinning globe with a pin for where each teammate is from and where they are now |

## Brand

`style.css` is the brand document: link it (or `@import` it) to get the colours, the font and the styles. [style.html](style.html) shows it all.

- **Colours:** blues, like an old Final Fantasy menu: navy `#0c1450` (background), blue `#2a44c0` (windows and panels), sky `#9cc3ff` (highlights), cream `#f7e8d1` (text).
- **Font:** **Press Start 2P**, for everything, in two sizes: 32px for titles, 16px for everything else.
- **Backgrounds:** `backgrounds/stars.svg` is a transparent, repeating 256×256 tile of pixel stars, taken from the look of the team globe. `.brand-stars` puts it over the navy (shown at 3×, 768px, so each star is 3 pixels like on the globe).
- **Ready-made styles:** `.brand-navy` (the background), `.brand-stars` (navy with stars), `.brand-window` (a Final Fantasy-style window), `.brand-title`, `.brand-text`, `.brand-highlight`, `.brand-button`.

## Precedents

- `precedents/steamboat-bill-jr-buster-keaton.mp4`: the falling house front from *Steamboat Bill, Jr.* (1928, public domain), 11 seconds
