# DIWhy: front end

The game's user interface as a single self-contained page. Open `index.html` in a browser; no build step and no server needed. The character sprites, faces and texts are all built into the file.

## What is on screen

- **Two to-do post-its (left).** The current tasks with their priority at the top; Time, Budget and Health at the bottom. On its own, the bottom post-it measures **the job you took on**: its days against the contractor's days and what you spent at the hardware store against the contractor's price (wall $6,500 and 6 days, toilet $950 and 2 days, dryer vent $320 and 1 day). Before a job it reads "No job yet". Health drops while the job runs over budget or over time. Compared with the contractor's quote: a dashed tick marks the quote, a white line marks where you are, and the bar runs past the note in red when you go over.
- **The yard.** Pixel art drawn on a canvas at the same pixel size as the character sprites, with a day and a night (dark mode) version.
- **The seven characters.** Animated four-direction sprites. Arrow keys, WASD or the round arrow pad move the selected character. Your home owner is selected by default; click anyone else to move them.
- **The phone (right).** Always on. The home screen has three apps: **Messages** (six contacts plus the bank; tap one to read and answer), **YouTube** and **ChatGPT**. The bar at the bottom of the screen goes back home. The unread count sits next to the clock.
- **Preparing for a DIY job.** On YouTube, a how-to video for each job takes 1 to 2.5 hours of game time; afterwards the job's surprise card marks the right answer ("Seen on YouTube"). ChatGPT answers in 20 minutes but skips steps, so it only points at the right answer half the time. Time spent in the apps comes off the calendar.
- **You (top right).** Shows your home owner. Click it to pick one; the other six are dealt out to the roles at random. Without a pick, the home owner is random too.
- **Theme button (top right).** Light or dark.

## The house

- **Going in:** walk up to the front door; it glows. Click it (or press **Space** or **Enter**) and the scene changes to the inside of the house.
- **The cottage:** a Northeast-style cottage with 3 bedrooms, 2 bathrooms, two storeys and a basement. Each floor is a plan seen from above with low walls. Walls and big furniture are colliders: you walk around them, never over them.
- **Stairs:** one staircase, in the hall on every floor (the way down runs under the way up). Walk up to it; it glows. Click it (or press **Space**) and a small card asks **Up** or **Down**: the up arrow (key, W, or the pad) goes one floor up, the down arrow one floor down, **Escape** cancels. On the top floor there is no Up, in the basement no Down.
- **Fits the screen:** inside, the house and the player shrink so the plan fits between the post-its and the phone. At night the room you are in is lit.
- **DIY potential:** walk into a room with something to fix and it glows softly; come close and it glows fully with a label. Three spots: the **wall between kitchen and living room** (ground floor; the dining room sits next to the kitchen), the **toilet** in the upstairs bathroom and the **dryer** (basement). Click one to see the cost and time, then **Take it on**.
- **DIY projects:** the scene changes to a side view (elevation) where the job is animated step by step. Halfway through, an event card from `events/` asks how you handle a surprise; the answer changes the cost, the days and your health. At the end the payment goes through the bank's fraud check, the days are added, and some projects change the house (the kitchen wall really disappears from the plan).
- **Day and night:** the game switches between day and night every 3 minutes; one full cycle is one day, and the date turns over at dawn. The theme button skips to the next day or night.

## People in the world

- **Partner:** lives on the ground floor and roams the living room, dining room and kitchen. Never outside.
- **Neighbor:** stands outside the bottom fence, peeping. Step out of the house and they come over to talk; every few minutes they come over again, but only while you are in the yard. They never walk into the house. What visitors say appears at the bottom of the screen, in the middle, above the arrows.
- **Friend and parent:** not around. Each minute there is a 15% chance the parent and a 15% chance the friend comes by; they walk over, say something, stay for about 30 seconds and leave. A visit that cannot start yet (in a job or the store) waits until it can.
- **Visitors walk to where you are now**, not to where you stood when they came in.
- **Close by, they talk:** walk near the partner or the neighbor and they come over and say something (at most every 45 seconds each). When someone in the same place as you has something to say, they say it in person instead of texting.
- **Contractor:** only appears in person when the player answers "Give up." in the contractor's chat.
- **Store clerk:** only appears behind the counter in the store.
- Only the home owner is played; clicking the others does nothing.

## Problems that find you

- **Do nothing for a minute and a problem shows up**, one at a time, in this order:
  1. **The monster:** the partner comes over: they saw a monster in the living room last night, and show a blurry photo. Walk up to the fireplace and you see what it is: a rat standing on its back legs, sniffing for food. New job: **Rat-proof the chimney** (quote 2 days, $850).
  2. **The ghost:** the partner heard the ghost in the ground floor bathroom again. Walk up to the sink and it is the pipe behind it, whistling. New job: **Stop the whistling pipe** (quote 1 day, $420). Its event cards come from `events/kitchen_faucet_events.csv`.
  3. **Hit and run:** while you are inside, a car hits the picket fence and drives off. Nobody sees it. Step outside and a stretch of the street-side fence is knocked out; the neighbor heard the bang. New job: **Fix the picket fence** (quote 1 day, $700).
- **The contractor quotes:** for each problem the partner calls the contractor, who texts a quote. Answer **I'll do it myself.** and the contractor answers back, sarcastically. The latest quote is pinned at the top of the chat.
- **Quick fixes bite back:** a wrong answer on an event card (duct tape, a rug over it...) can go wrong again: 40% right away, otherwise 70% within the next 1 to 5 minutes. A half-right answer: 35% within 5 minutes. Each time it adds 12 to 22% of the job's quote in money (5 to 10% for half-right) and a day (half a day), the bank texts the charge and the partner tells you. The contractor's quote stays as it was.
- **Finished jobs can break later** (1 to 4 minutes after): 10% for a good fix, from 45% up to 75% when corners were cut (wrong or half-right answers, or the cheap version of a tool). The toilet leaks (a puddle), the dryer catches fire (smoke), the new plaster falls off (chunks on the floor), the rat comes back, the pipe whistles again, the fence leans. The partner calls the contractor, the contractor texts a quote, and the spot glows again for a repair.
- The chimney, fence and repair event cards are drafts written in the page; they are not in `events/` yet.

## Tools and the store

- Each DIY job needs a couple of tools (`TOOLS_NEEDED` in `index.html`; the event files don't list tools yet). The player starts with a hammer, a screwdriver and a tape measure.
- When a step needs a tool the player doesn't have, the job stops: **"Go buy it"**. The player walks out through the gate and appears in the store, in front of the counter, with the clerk behind it.
- The store window sits on the right, below the "You" chip and the theme button. It shows only what this job needs, and for each tool only what is suggested: the clerk's pick, plus YouTube's and ChatGPT's once you asked them. **Show all products** opens the whole store (and switches back). Each tool comes in three versions (cheap, right, fancy), with a line of recommendations: **the clerk** always (the fancy one), **YouTube** (the right one) once watched, **ChatGPT** (whatever it read first, sometimes wrong) once asked.
- Click items to put them in the **cart**; click again ("Remove") or use the × on an item in the cart list to take it out; **Buy all** pays for everything at once in one charge through `pay()`. Anything can be bought. A tool bought only in its cheap version costs a little health.
- **At the bottom of the store window:** **Watch YouTube first** (2 to 3 hours) or **Ask ChatGPT first** (20 minutes) adds their picks to each tool's recommendations, and **Leave the store** (the job keeps waiting for the tool) turns into **Back to the job** once you have what you need.
- **Back to the job** jumps straight back into the fixing scene, which carries on.

## In a DIY scene

- The phone and the post-its step aside.
- The player walks to each work spot, turns their back to the camera and works with the tool for that step (stud finder, saw, pry bar, hammer, wrench, brush and so on).

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

- **Payments: `pay(amount, what)`** is the one entry point for spending money. The money leaves the budget at once and the **Bank** texts how much was charged (no fraud check, no confirmation). In backend mode the page answers the backend's charge with "yes" straight away; `settle()` and `heldTotal()` stay for the link.
- **Cracked phone: `crackPhone()`.** After a big fix (a task of $300 or more, or an urgent one) there is a 1 in 10 chance the phone screen cracks in the lower left corner. The text stays readable.

## Demo and test switches

On its own, the page runs a light demo loop: tasks get done slowly. Money only goes out at the hardware store (nothing is charged for tasks or for finishing a job), and a trip to the store takes an hour and a half. People only text when something happens: a new day, a project starts or ends, you go over budget or behind schedule, or you pay for something.

- `index.html?over` starts a kitchen wall job already over its quote (3 days and $1,600), to show the bars running over and health dropping.
- `index.html?crack` cracks the phone straight away.
- In the browser console, `DIWHY_DEBUG.scen` triggers the problems: `idle()` (as if you did nothing for a minute), `car()`, `brk('bath')` (breaks a finished job: bath, dryer, wall, chimney, pipe, fence), `state()`.

## Style

**Working on the graphics? Read [GRAPHICS.md](GRAPHICS.md) first:** pixel scale, palette, drawing rules, sprite format and a checklist.

The interface uses the system font, dark grey ink with few colours (teal, gold and red as accents), round buttons and pill-shaped chips with soft shadows, light and dark themes that follow the computer's setting, and one easing curve, `cubic-bezier(.65,0,.25,1)`, for every larger movement. With `prefers-reduced-motion` all motion is off.

## Playing with the backend

Open the page as `/frontend/?game=<id>` and the backend runs the game: `game-link.js` casts the characters from the backend, drives the Time, Budget and Health bars, keeps the tasks post-it going with this page's own rows (one per event from the events list, ticked off when answered, above a "Finish the job" row), shows each event as a card (with advice texts from the cast), sends every purchase through `pay()`, and shows the end report. The demo loop is switched off in that mode. The glowing DIY spots are how you find the job: with `?owner=<character>` (what the front door sends) the house opens with no job yet, and saying "Take it on" at the kitchen wall, the bathroom or the dryer starts the backend game for that job (then the page reloads as `?game=<id>`, and the other spots go quiet: one job per game). **Without `?game` or `?owner` the page runs on its own, exactly as described above.** Start from the front door at `/app/`, or see [`../INTEGRATION.md`](../INTEGRATION.md).

The few lines in `index.html` that make this work are marked `INTEGRATION`.

## Easter eggs

- A tiny model of the Equitable Building (120 Broadway) stands among the plants in the top-left garden bed.
- A sheet on the office desk has the AEC Tech logo on it, in light grey.
