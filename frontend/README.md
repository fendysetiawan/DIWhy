# DIWhy: front end

The game's user interface as a single self-contained page. Open `index.html` in a browser; no build step and no server needed. The character sprites, faces and texts are all built into the file.

## What is on screen

- **Two to-do post-its (top left).** Time, Budget and Health on the first, compared with the contractor's quote: a dashed tick marks the quote, a white line marks where you are, and the bar runs past the note in red when you go over. The second post-it holds the current tasks with their priority.
- **The yard.** Pixel art drawn on a canvas at the same pixel size as the character sprites, with a day and a night (dark mode) version.
- **The seven characters.** Animated four-direction sprites. Arrow keys, WASD or the round arrow pad move the selected character. Your home owner is selected by default; click anyone else to move them.
- **The phone (bottom right).** Put away, only its status bar shows, with the unread count next to the clock. Click it, or get a message, and it slides up. Six contacts plus the bank. Tap a contact to read the messages and answer.
- **You (top right).** Shows your home owner. Click it to pick one; the other six are dealt out to the roles at random. Without a pick, the home owner is random too.
- **Theme button (top right).** Light or dark.

## The house

- **Going in:** walk up to the front door; it glows. Click it (or press **E** or **Enter**) and the scene changes to the inside of the house.
- **The cottage:** a Northeast-style cottage with 3 bedrooms, 2 bathrooms, two storeys and a basement. Each floor is a plan seen from above with low walls. Walls and big furniture are colliders: you walk around them, never over them.
- **Stairs:** walk up to them; they glow. Click to go to the other floor. The ground floor has stairs up (hall) and down to the basement (dining room).
- **DIY potential:** three spots glow gold when you come close: the **wall between kitchen and living room** (ground floor), the **bathroom** (upstairs) and the **dryer** (basement). Click one to see the cost and time, then **Take it on**.
- **DIY projects:** the scene changes to a side view (elevation) where the job is animated step by step. Halfway through, an event card from `events/` asks how you handle a surprise; the answer changes the cost, the days and your health. At the end the payment goes through the bank's fraud check, the days are added, and some projects change the house (the kitchen wall really disappears from the plan).
- **Day and night:** the game switches between day and night every 3 minutes; one full cycle is one day, and the date turns over at dawn. The theme button skips to the next day or night.

## Characters

Every game the seven sprites are shuffled. One is the home owner (the player), the rest are dealt out to:

| Role | Behaviour |
|---|---|
| Partner | Cares about the budget or the timeline, chosen at random each game |
| Store Clerk | Has everything, keeps selling you more |
| Contractor | Sends a quote pinned on top of the chat; **Update** asks for a new one and changes the plan on the post-it. Your only answers: "I'll do it myself." or "Give up." (red) |
| Parent | Unsolicited advice in long paragraphs, stories from back in the day |
| Nosy Neighbor | Wants quiet, gives good or terrible advice, must know everything |
| Friend | Brings beer, helps once in a while, backs off when it's not fun |

All texts are in `character-texts.txt`: 40 per character, plus 40 overconfident replies for the home owner.

## Keep these when the code is combined

- **Payments: `pay(amount, what)`** is the one entry point for spending money. The payment goes on hold ("on hold" under Budget), the **Bank** texts a potential fraud alert, the **Store Clerk** says the card is not going through, and only "Yes, it was me." in the bank chat takes the money from the budget ("No, block it." cancels it). Look for the block marked `PAYMENTS: keep this when the game code is combined`.
- **Cracked phone: `crackPhone()`.** After a big fix (a task of $300 or more, or an urgent one) there is a 1 in 10 chance the phone screen cracks in the lower left corner. The text stays readable.

## Demo and test switches

The page runs a demo loop: messages arrive every ~10 seconds, time and budget creep up, tasks get done.

- `index.html?over` starts past the contractor's quote, to show the bars running over.
- `index.html?crack` cracks the phone straight away.

## Style

**Working on the graphics? Read [GRAPHICS.md](GRAPHICS.md) first:** pixel scale, palette, drawing rules, sprite format and a checklist.

The interface uses the system font, dark grey ink with few colours (teal, gold and red as accents), round buttons and pill-shaped chips with soft shadows, light and dark themes that follow the computer's setting, and one easing curve, `cubic-bezier(.65,0,.25,1)`, for every larger movement. With `prefers-reduced-motion` all motion is off.

## Playing with the backend

Open the page as `/frontend/?game=<id>` and the backend runs the game: `game-link.js` casts the characters from the backend, drives the Time, Budget and Health bars and the tasks post-it, shows each event as a card (with advice texts from the cast), sends every purchase through `pay()`, and shows the end report. The glowing DIY spots and the demo loop are switched off in that mode, because the backend game has its own job. **Without `?game` the page runs on its own, exactly as described above.** Start a backend game from the front door at `/app/`, or see [`../INTEGRATION.md`](../INTEGRATION.md).

The few lines in `index.html` that make this work are marked `INTEGRATION`.
