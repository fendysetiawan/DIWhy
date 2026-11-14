# DIWhy: graphics guide

Everything someone working on the look of the gameplay needs: the pixel scale, the palette, how to draw the yard, how to deliver character sprites, the UI style, and how to check your work. All numbers below are the ones used in `index.html`.

---

## 1. The look in one paragraph

A cozy top-down farm-sim look, matching the character sprites: **chunky pixel art** with **dark brown outlines**, **warm saturated colours**, **two to four tones of shading per material**, and **light from the top left**. Buildings are seen in **three-quarter view** (roof from above, front wall visible). The UI on top (post-its, phone, buttons) is clean and calm, and never pixelated: the system font, few colours on light or dark backgrounds, round buttons and pill-shaped chips, soft shadows, and smooth motion on one easing curve (section 9).

---

## 2. The two layers

| Layer | Style | Where it lives |
|---|---|---|
| **Gameplay**: yard, objects, characters | Pixel art | Canvas (`.pix`) and sprite images (`.ch`) |
| **UI**: post-its, phone, buttons, picker | Smooth vector, system font | HTML and CSS |

Keep the gameplay layer pure pixel art: no smooth gradients or anti-aliased shapes there. Fonts and colours of the UI layer are in section 9.

### Stacking order (z-index)

| z | What |
|---|---|
| 0 | Scene canvas (`.pix`): the yard or a floor of the house |
| 1 | Characters (`.yard`), sorted among themselves by their feet (lower on screen = in front) |
| 2 | Glowing spots (`.hots`): door, stairs, DIY potential |
| 4 | DIY elevation view (`.diy`) |
| 5 | Post-its, theme button, floor name |
| 6 | Arrow pad, "You" chip |
| 7 | Fade between scenes |
| 8 | Phone |
| 9 | Home owner picker, DIY and event cards |

---

## 3. Coordinates and pixel scale

- **Scene:** 1600 x 900 units. Every position in the game is in scene units.
- **Screen fit:** the scene covers the window like `object-fit: cover` (scaled by `max(width/1600, height/900)` and centred), so the edges may be cut off on very wide or very tall windows. **Keep anything important inside the middle 1280 x 720.**
- **One art pixel = 1.5 scene units.** The yard canvas is **1066 x 600 pixels** and is scaled up with `image-rendering: pixelated`.
- This matches the sprites: their visible pixel blocks are 1.5 scene units on screen. **Background pixels and character pixels must stay the same size.** Never draw the yard at a finer or coarser grid.
- **Conversion in code:** `S(sceneUnits)` turns scene units into canvas pixels (`Math.round(v / 1.5)`).

### What stays clear of the UI

| Area (screen) | Covered by |
|---|---|
| Left, about 320 px wide, full height | The two post-its (tasks at the top, time / budget / health at the bottom) |
| Right, about 330 px wide | The phone, always on |
| Bottom centre, 150 x 110 px | Arrow pad |
| Top right corner | "You" chip and theme button |

Put the action (house, courtyard, beds, the row of characters) in the middle.

---

## 4. Palette

All colours are hex, in light (day) mode. Night mode is derived from these automatically (section 8).

### Outline and shadow

| Use | Colour |
|---|---|
| Outline around every object | `#2b1a12` |
| Tree outline | `#1b3a17` (blossom tree `#5e2f4a`) |
| Plant outline | `#1f3d18` |
| Drop shadows | darken what is underneath to about 68 % (`shadowRect` / `shadowOval`, strength `.3`), offset right and down |

### Ground

| Material | Tones, light to dark | Details |
|---|---|---|
| Grass | `#7cbd4d` `#70b245` `#65a63e` `#5a9737` | Tufts: `#4a8230` blades, `#9ad366` tips. Lighter patches `#84c454` `#78ba4b` |
| Dirt path | `#d8a35f` `#d09955` `#c8904f` `#be8649` | Rim `#9b6434`, pebbles `#ecc994` and `#8a5a2e` |
| Stone tiles | `#d9d1bf` `#d3cab7` `#cbc2ae` `#c2b8a3` | Grout `#8d8473`, tile highlight `#e8e1d2`, tile shadow `#aa9f8a`, edge `#7a7161` |
| Soil (beds) | `#8a5634` `#74462a` `#5f361c` | Furrows `#4a2a16` |

### Building

| Material | Tones | Details |
|---|---|---|
| Roof shingles | Lit `#df7f57` `#d4704a` / right `#cf6744` `#c45c3d` / front `#ba5338` `#ae4931` / shaded left `#9a3e2a` `#8d3725` | Ridge and hips `#5e2418` with a `#e58d63` highlight, eave `#4a1c12` |
| Wall siding | `#e6dac1` `#ddd0b4` | Board seam `#c4b391`, corner trim `#8b5a2b` |
| Window | Glass `#7fb3d0`, glare `#d6eef8` `#b7dcec` | Frame and bars `#6b4423`, sill `#a06b3b` |
| Door | `#97603a` | Planks `#74461f`, knob `#f2c94c` |
| Brick (chimney) | `#a3533b` | Mortar `#d6c1a5` |

### Wood, metal, other

| Material | Tones |
|---|---|
| Lumber / planks | `#e0a669` (top edge) `#c88a4e` `#b97a42` grain `#9b6335`, end grain `#e6bb84` |
| Raised bed frame | `#9a6236`, top edge `#c58a4c` |
| Fence | `#f1d3a0` (cap) `#ddb57e` `#d4a96f` shade `#b48a55` `#a87d4c` |
| Scaffold metal | `#c4d0d6` highlight, `#8c9aa4` |
| Dumpster | `#7eaed0` rim, `#4f7fa3`, `#3b6688` front, `#2f5675` ribs, `#2a4458` inside |
| Toolbox | `#e86450` `#c8382c` `#8e2a20` |
| Plants | `#9ad962` `#62ae3e` `#43902f` `#2e6c26`, tomatoes `#ff6a52` `#e2412f` `#b52a1f` |
| Trees | `#93d063` `#5fae40` `#428f33` `#2c6a28`, trunk `#8f5f36` `#6b4425` `#4e301a` |
| Blossom tree | `#f9d3e6` `#eea6cc` `#cf7fac` `#a65a89` |
| Flowers | `#f4a6c9` `#ffe07a` `#ffffff` `#f7a072` `#b9a3f5`, centre `#f2b631` |

**Adding a colour:** pick it next to an existing ramp, in the same warmth. Every new material needs at least a base tone, one darker tone for the shaded side and seams, and one lighter tone for the lit edge.

---

## 5. Drawing rules for the yard

1. **Outline everything** that stands on the ground (buildings, furniture, tools, trees, fence) with a 1 px outline in `#2b1a12`. Flat ground (grass, paths, tiles) has no outline, only a darker rim.
2. **Light comes from the top left.** Top and left edges get the lightest tone, bottom and right edges the darkest.
3. **Shadows fall to the bottom right**, as a darkening of whatever is underneath (never a flat grey shape).
4. **Texture, never flat fills.** Mix 3 to 4 tones with noise at two scales (big patches plus single pixels). The helpers use a fixed hash, so the yard looks the same on every load.
5. **Ragged natural edges, straight built edges.** Paths, tree canopies and bushes get a slightly broken edge; walls, beds and planks stay straight.
6. **Three-quarter view** for anything with height: roof from above, front face visible below it. Flat items (beds, ladder on the ground, tiles) are seen straight from above.
7. **No anti-aliasing, no gradients, no blur, no transparency** except for shadows.
8. **Size check:** a door is about 34 px tall, a character about 64 px tall (feet to hair), a plant 11 px, a fence post 13 px. Keep new objects in proportion.

### Where things are (scene units)

| Object | Rectangle or position |
|---|---|
| House roof | x 455 to 925, y 95 to 300 |
| House front wall | x 470 to 910, y 300 to 385; porch to y 412 |
| Opened roof (rafters) | x 690 to 830, y 190 to 258 |
| Courtyard | x 470 to 910, y 410 to 660 |
| Work area (chalk marks) | x 575 to 805, y 478 to 612 |
| Scaffold | x 935 to 963, y 112 to 374 |
| Dumpster | x 1010 to 1194, y 140 to 244 |
| Lumber | x 1000 to 1156, y 300 to 364 |
| Garden beds (120 x 92 each) | x 1040 and 1180, y 440, 560 and 680 |
| Shed | x 220 to 360, y 300 to 412 |
| Fence | x 382 to 1402, y 62 to 842; gate gap x 770 to 852 |
| Character row (feet) | y 712, x from 530 every 90 |

---

## 6. Character sprites

### What to deliver

In the repo the team's sprites live in **`assets/characters/<first-last>/`** (for example `aidan-newsome/`), one folder per person:

```
assets/characters/aidan-newsome/
  front.svg        facing the camera (moving down), animated
  back.svg         facing away (moving up), animated
  left.svg         facing left, animated
  right.svg        facing right, animated
  front-still.svg  the front view without the animation
  standing.svg     400 x 400 on a cream background (character select)
```

Current team folders: `aidan-newsome`, `christian-huber`, `fendy-seitiawan`, `gigi-singh`, `rachel-katz`, `ramy-maher`, `travis-potter`. See `assets/README.md`.

`frontend/index.html` carries its own embedded copy of the four direction files per person (from "DIWhy Four-Direction Animated SVGs"). When a sprite changes in `assets/`, the embedded copy has to be refreshed too, until the two front ends are merged.

### Format

| Rule | Value |
|---|---|
| File type | SVG, pixels as `<path>` rectangles, `shape-rendering="crispEdges"` |
| Canvas | `viewBox="0 0 160 160"`, transparent background |
| Figure placement | the figure group sits at `translate(52 24)`: about 56 wide, 128 tall |
| Feet | on the line at **95 %** of the box (y about 152). The game puts this point on the ground. Keep it the same in all four files, or the character jumps when it turns. |
| Style | Same outline colour family (near-black browns, around `#0c0606` to `#2b1a12`), about 50 colours per sprite, shading from the top left |
| Idle animation | optional, inside the SVG: `<animateTransform type="translate" calcMode="discrete" dur="1.4s" repeatCount="indefinite">`, at most 4 units of bob |
| No scripts, no external links, no embedded fonts | the files are embedded as images |
| Size | about 40 to 60 KB per file; the page carries all 28 |

### Walking

Every character has a **walk cycle** for each direction, with moving legs (from "DIWhy Walk Animations - Revised Side Views": `<Name> - Front.svg`, `- Back.svg`, `- Left.svg`, `- Right.svg`). The game shows the walk cycle **only while the character is actually moving**, and the idle sprite as soon as it stops or pushes against a wall or furniture.

- Same box and placement as the idle files (160 x 160, feet at 95 %), so the swap does not jump.
- The legs are separate groups rotated with `animateTransform` (about 0.8 s per step cycle for the side views, 0.72 s front and back).
- The files start their animation after `begin=".42s"`; the game rewrites that to `0s` when embedding them, so a character steps off at once. Deliver new walk cycles in the same format.
- In `index.html` they are embedded as `window.WALK`, next to the idle `window.SPRITES`; `turn(ch, dir, walking)` picks between them.

### Faces (phone avatars)

The phone uses square portraits (the files from "DIWhy Slide 7 Faces"), shown as circles of 32 to 52 px. They are 627 x 627 traced SVGs (about 3 MB each), so they are turned into **192 x 192 PNGs** before being built into the page. A new face should be a square head-and-shoulders portrait on a plain warm background (`#f7e5cd` family), in the same pixel style.

---

## 7. Adding or changing yard graphics in the code

The yard is drawn once, by `paintYard()` in `index.html`, into an image for day and one for night. To add an object, add a few lines in the right place in that function (later lines draw on top). The helpers:

| Helper | Does |
|---|---|
| `S(v)` | scene units to canvas pixels |
| `set(x, y, colour)` | one pixel |
| `rect(x, y, w, h, colour or (x, y) => colour)` | filled rectangle, the colour can vary per pixel |
| `box(x, y, w, h, colour)` | rectangle with a 1 px outline around it |
| `line(x0, y0, x1, y1, colour, width)` | pixel line |
| `shape(x0, y0, x1, y1, inside, paint, outline)` | any shape: `inside(x, y)` says if a pixel belongs, `paint(x, y)` picks its colour, the outline is added around it |
| `shadowRect(x, y, w, h, strength)` / `shadowOval(cx, cy, rx, ry, strength)` | darken what is underneath |
| `hash(x, y, seed)` | repeatable noise between 0 and 1, for texture |
| `lit.push([x, y])` | this pixel glows at night (windows, lamps) |
| `lamps.push([x, y, radius])` | a light source at night |

Example, a wooden crate at scene position (900, 650):

```js
const kx = S(900), ky = S(650);
shadowRect(kx + 3, ky + 4, 16, 14, .3);                       // shadow first
box(kx, ky, 16, 14, '#b97a42');                                // outlined body
rect(kx, ky, 16, 1, '#e0a669');                                // lit top edge
rect(kx, ky + 7, 16, 1, '#9b6335');                            // middle board seam
rect(kx + 15, ky, 1, 14, '#9b6335');                           // shaded right side
```

Order inside `paintYard()`: grass, paths, courtyard, house, shed, work area, ladder, dumpster, lumber, beds, wheelbarrow, fence, flowers, trees, then the night version.

---

## 8. Night (dark mode)

The night image is made from the day image, so you only draw once:

- Every pixel is tinted blue: red x .32 + 10, green x .36 + 14, blue x .52 + 40.
- Pixels added with `lit.push()` become warm light (`#ffc460`, some `#ffecaa`).
- Each `lamps.push([x, y, radius])` adds a warm glow that falls off in **four steps with dithered edges**, never a smooth gradient.
- Sprites are dimmed with `filter: brightness(.8) saturate(.9)`.

When you add something that gives light (a lamp, a window, a fire pit), mark its pixels and add a lamp.

---

## 9. UI style (the non-pixel layer)

> **Two sources, not yet aligned.** The team's brand is in `assets/style.css` (see `assets/README.md`): blues like an old Final Fantasy menu, navy `#0c1450` (background), blue `#2a44c0` (windows), sky `#9cc3ff` (highlights) and cream `#f7e8d1` (text), and one font, Press Start 2P, for everything (32px titles, 16px the rest). `frontend/index.html` currently uses the system font and the calm style described below. **For new UI work, use `assets/style.css`**; the frontend will be moved over to it when the two front ends are merged.

What `frontend/index.html` uses today: one system font, dark grey ink on white (light grey on near-black in dark mode), three accent colours used sparingly, round buttons, pill-shaped chips, soft shadows, and every larger movement on the same easing curve.

| Token | Value |
|---|---|
| Font | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif` |
| Labels on the post-its and names in the phone | 14.5 px, weight 650, ink `rgb(35,35,35)` |
| Small labels | 11 to 12 px, weight 650, uppercase, letter-spacing .04 to .06 em |
| Ink | `rgb(35,35,35)`, secondary `rgba(35,35,35,.7)`, hints `rgba(35,35,35,.48)`; dark mode `#f5f5f7`, `#86868b` |
| Accent | teal `rgb(34,195,160)`, gold `#facc15`, red `#ef4444` (over budget, "Give up.") |
| Round buttons | 40 to 46 px circles, white (dark `#1c1d24`), hairline border, soft shadow |
| Pills | radius 999 px |
| Easing | large moves `cubic-bezier(.65,0,.25,1)`, button press `cubic-bezier(.3,1.6,.5,1)`, settle `cubic-bezier(.2,.8,.2,1)` |
| Motion | `prefers-reduced-motion: reduce` turns all of it off |

### Post-its

Paper `#fff6a8` fading to `#fce97a` (dark mode `#efe08a` to `#e2cd62`), slightly tilted (-1.2 deg and +0.9 deg), a strip of tape on top, a curled bottom right corner, and a wrinkle layer (soft noise relief plus two faint creases). Text on them is always dark ink, in both themes.

### Bars

Track `rgba(35,35,35,.11)`, time teal, budget `#eab308`, health from green to red with the value. The contractor's quote is a dashed tick at 100 %; the white "you are here" marker is 5 px wide with a dark outline. Going over, the extra part is red and grows past the post-it.

### Phone

True iPhone proportions (9 : 19.5), no dynamic island, frame `#1a1b21`. Always on, on the right, starting below the top-right buttons. Home screen with app icons (Messages, YouTube, ChatGPT) on a blue-green wallpaper (deep blue at night). Bank alerts use a pixel bank icon on `#1f6f5c`. The cracked screen is thin lines in the lower left corner, never over text.

---

## 10. Checking your work

1. Open `index.html` in a browser at **1280 x 720**, then try a phone-size window.
2. Switch the theme (top right) and check the night version.
3. Walk a character over and around your object (arrow keys or WASD) and check it looks like the same world: same pixel size, same outline, same light direction.
4. `index.html?over` shows the bars running over; `index.html?crack` shows the cracked phone.
5. Look for: blurry pixels (canvas not scaled with `pixelated`), missing outlines, shadows falling the wrong way, colours that are flatter or colder than the sprites, anything important hidden under the post-its or the phone.

### Checklist for every new graphic

- [ ] Same pixel size as the sprites (1 px = 1.5 scene units)
- [ ] 1 px dark outline (`#2b1a12`) on anything standing on the ground
- [ ] Lit from the top left, shadow to the bottom right
- [ ] 3 to 4 tones, textured, no flat fills, no gradients, no anti-aliasing
- [ ] Three-quarter view for anything with height
- [ ] Light sources marked for the night version
- [ ] Not under the post-its, the phone or the arrow pad
- [ ] Checked in day and night, at 1280 x 720 and phone size

---

## 11. Inside the house

The cottage (Northeast style: 3 bedrooms, 2 bathrooms, two storeys and a basement) is drawn like the yard: one canvas per floor, 1066 x 600 pixels, the same pixel size and outline. The plan is seen from above with **low walls**, so the whole floor reads at once. Inside, the view shrinks (house and player together) to fit between the post-its and the phone. At night the room the player is in is drawn from a warm, fully lit copy of the floor.

### The floors (scene units)

The house fills x 250 to 1350, y 120 to 820 on every floor, with 16-unit outer walls and 12-unit inner walls.

| Floor | Rooms | DIY spot |
|---|---|---|
| Ground | Dining room and kitchen side by side (top left), living room with fireplace (bottom left), hall with the staircase and the front door (middle), bathroom (top right), office with a desk and two visitor chairs (bottom right); the dining room has a window on the west wall | The kitchen part of the wall to the living room (x 530 to 700, y 394) |
| Upstairs | Bedroom 1 (top left: bed on the north wall, wardrobe on the hall wall), bedroom 2 (bottom left: bed on the south wall, wardrobe on the hall wall), both with windows on the west wall; hall with the staircase; main bathroom (top right); bedroom 3 (bottom right: wardrobe on the north wall, bed on the east wall, desk) | The toilet in the main bathroom |
| Basement | Utility room with furnace and water heater, storage with the staircase, workshop, laundry in the bottom middle, rec area | The dryer |

Both bathrooms have the same layout: vanity on the left, toilet in the middle of the north wall, shower along the east wall. The staircase is in the same place on every floor (x 846 to 954, y 136 to 332); clicking it asks which floor.

The stairs are 108 units wide, so there is a 40-unit walkway on each side of them in the hall. A character's feet are 28 units wide: keep every doorway and passage at least 40 units.

### Drawing rules for interiors

- **Floors:** wood planks `#c99158` `#bd8650` `#b07a46` (seams `#7d4f2a`), kitchen tile `#efe9dd` `#d9d0c0` (grout `#a89e8c`), bathroom tile `#e8f1f4` `#d3e4ea` (grout `#9fb3bd`), carpet per bedroom (blue `#9db4c8`, rose `#d2aeae`, green `#b4c79d` families), basement concrete `#a8a49b` with cracks, laundry vinyl `#d8d2c4` `#c9c2b2`.
- **Walls:** a top face `#efe5d3` with a light edge `#fffaf0` and a 1 px outline. Horizontal walls also get a short front face below them (`#cbbb9e`, 5 px): that is the "low wall" seen in three-quarter view.
- **Furniture:** outlined, lit from the top left, with a drop shadow, like objects in the yard. Big pieces (beds, counters, sofa, tub, washer, dryer, stairs) are colliders.
- **Outside the house:** dark brown `#231912` / `#281d15`, so the plan floats.
- **Night:** the same tint as the yard but lighter (rooms have their lights on), plus a warm glow per room and around lamps, the fireplace and nightstands.

### Colliders

Walls and the big furniture block the character (`blocked()` in the code): it slides along them and can never stand on a wall. In the yard the house, shed, dumpster, lumber, scaffold, beds and fence are colliders, with the gate left open.

### Glowing spots

A DIY spot glows softly as soon as the character enters its room. When the character's feet come within 70 units of any spot, it glows fully and shows a label; click it (or press **Space** or **Enter**) to use it.

| Spot | Glow | Does |
|---|---|---|
| Front door (yard) and the door in the hall | Warm yellow | Go in or out |
| Stairs | Teal | Ask which floor, then go there |
| DIY potential | Gold, with a gold label | Offer the project, then open the elevation view |

## 12. DIY elevation views

A DIY project opens a **side view (elevation)** of the spot, on its own canvas of 533 x 300 pixels: **one pixel = 3 scene units**, twice as close as the plan, and the character is drawn twice as large (240 units), standing on the floor line at y 250.

- **Layout:** ceiling band (y 0 to 40), crown line, wall (y 45 to 242), baseboard (to 250), floor (250 to 300). Keep the action between x 150 and 400: the post-its cover the left, the character stands on the right.
- **Static parts** are painted once with the pixel painter (textures, outlines). **Moving parts** are drawn every frame with whole-pixel rectangles (`fr`, `fb`, `fo` in the code), so they stay crisp.
- **Steps:** each project is a list of steps with a duration; one of them is an **event card** from `events/` (the wall uses `wall_removal_events.csv`, the toilet `toilet_replace_events.csv`; the dryer has draft events in `frontend/dryer_vent_events.csv`). The answer (good, ok, wrong, excessive) changes the cost, the days and health.
- **Current animations:** the wall (scanner finds studs, cut lines, drywall falls in pieces, header beam, studs come out, trim and paint), the toilet (valve, old toilet lifted out, wax ring, new toilet set, flush), the dryer (pulled out, old foil hose comes off with a lint cloud, duct brushed, new metal duct, pushed back with clothes tumbling).
- **The player in the scene:** walks in from the right (walk cycle) to the spot for each step (`WORK_X`), then turns their **back to the camera** and works; a small pixel tool for the step (`STEP_TOOL`, `TOOL_SVG`, 16 x 16) swings in their hand.
- **The store** is a static elevation in the same scale: shelves of products and a pegboard of tools on a cream wall, a navy counter at waist height on its own transparent layer, the clerk (front sprite) behind it and the player (back sprite, larger, closer) in front.
- **Adding a project:** add an entry to `PROJECTS` (title, cost, days, steps, event file), a `DRAW` function, a background in `buildElevations()`, and a DIY spot on the right floor.
