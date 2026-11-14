# DIWhy: front end

The game's user interface as a single self-contained page. Open `index.html` in a browser; no build step and no server needed. The character sprites, faces and texts are all built into the file.

## What is on screen

- **Two to-do post-its (top left).** Time, Budget and Health on the first, compared with the contractor's quote: a dashed tick marks the quote, a white line marks where you are, and the bar runs past the note in red when you go over. The second post-it holds the current tasks with their priority.
- **The yard.** Pixel art drawn on a canvas at the same pixel size as the character sprites, with a day and a night (dark mode) version.
- **The seven characters.** Animated four-direction sprites. Arrow keys, WASD or the round arrow pad move the selected character. Your home owner is selected by default; click anyone else to move them.
- **The phone (bottom right).** Put away, only its status bar shows, with the unread count next to the clock. Click it, or get a message, and it slides up. Six contacts plus the bank. Tap a contact to read the messages and answer.
- **You (top right).** Shows your home owner. Click it to pick one; the other six are dealt out to the roles at random. Without a pick, the home owner is random too.
- **Theme button (top right).** Light or dark.

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

Follows the ramymaher.com style guide: system font, calm colours, the house easing curve `cubic-bezier(.65,0,.25,1)`, round buttons and pill chips, light and dark themes, and `prefers-reduced-motion` turns the motion off.
