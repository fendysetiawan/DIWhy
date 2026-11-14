# DIWhy: graphics guide

Everything someone working on the look of the gameplay needs: the pixel scale, the palette, how to draw the yard, how to deliver character sprites, the UI style, and how to check your work. All numbers below are the ones used in `index.html`.

---

## 1. The look in one paragraph

A cozy top-down farm-sim look, matching the character sprites: **chunky pixel art** with **dark brown outlines**, **warm saturated colours**, **two to four tones of shading per material**, and **light from the top left**. Buildings are seen in **three-quarter view** (roof from above, front wall visible). The UI on top (post-its, phone, buttons) is clean and calm, in the ramymaher.com style, and is never pixelated.

---

## 2. The two layers

| Layer | Style | Where it lives |
|---|---|---|
| **Gameplay**: yard, objects, characters | Pixel art | Canvas (`.pix`) and sprite images (`.ch`) |
| **UI**: post-its, phone, buttons, picker | Smooth vector, system font | HTML and CSS |

Never mix them: no smooth gradients or anti-aliased shapes in the gameplay layer, and no pixel fonts or pixel borders in the UI.

### Stacking order (z-index)

| z | What |
|---|---|
| 0 | Yard canvas (`.pix`) |
| 1 | Characters (`.yard`), sorted among themselves by their feet (lower on screen = in front) |
| 5 | Post-its, theme button |
| 6 | Arrow pad, "You" chip |
| 8 | Phone |
| 9 | Home owner picker |

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
| Top left, about 320 x 100 % of the height | The two post-its |
| Bottom right, about 300 px wide | The phone's status bar (the whole phone when it is up) |
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

One folder per character, named after the person, with four files:

```
Aidan/
  front.svg   facing the camera (moving down)
  back.svg    facing away (moving up)
  left.svg    facing left
  right.svg   facing right
```

Current characters: Aidan, Christian, Fendy, Gigi, Rachel, Ramy, Travis.

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

Right now the game fakes walking: the sprite bobs (`.ch.walking`, 0.3 s) while it moves. If you make real walk cycles, deliver them as extra files in the same box and placement, for example `front-walk.svg` with the frames inside as a discrete SMIL animation (4 frames, about 0.5 s loop). Tell the front end, and they get wired in next to the idle files.

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

From the ramymaher.com style guide:

| Token | Value |
|---|---|
| Font | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif` |
| Labels on the post-its and names in the phone | 14.5 px, weight 650, ink `rgb(35,35,35)` |
| Small labels | 11 to 12 px, weight 650, uppercase, letter-spacing .04 to .06 em |
| Ink | `rgb(35,35,35)`, secondary `rgba(35,35,35,.7)`, hints `rgba(35,35,35,.48)`; dark mode `#f5f5f7`, `#86868b` |
| Accent | teal `rgb(34,195,160)`, gold `#facc15`, red `#ef4444` (over budget, "Give up.", fraud) |
| Round buttons | 40 to 46 px circles, white (dark `#1c1d24`), hairline border, soft shadow |
| Pills | radius 999 px |
| Easing | large moves `cubic-bezier(.65,0,.25,1)`, button press `cubic-bezier(.3,1.6,.5,1)`, settle `cubic-bezier(.2,.8,.2,1)` |
| Motion | `prefers-reduced-motion: reduce` turns all of it off |

### Post-its

Paper `#fff6a8` fading to `#fce97a` (dark mode `#efe08a` to `#e2cd62`), slightly tilted (-1.2 deg and +0.9 deg), a strip of tape on top, a curled bottom right corner, and a wrinkle layer (soft noise relief plus two faint creases). Text on them is always dark ink, in both themes.

### Bars

Track `rgba(35,35,35,.11)`, time teal, budget `#eab308`, health from green to red with the value. The contractor's quote is a dashed tick at 100 %; the white "you are here" marker is 5 px wide with a dark outline. Going over, the extra part is red and grows past the post-it.

### Phone

True iPhone proportions (9 : 19.5), no dynamic island, frame `#1a1b21`. Put away, only the status bar shows; it slides up and down only. Bank alerts use a pixel bank icon on `#1f6f5c`. The cracked screen is thin lines in the lower left corner, never over text.

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
