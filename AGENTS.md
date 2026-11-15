# DIWhy: read this first (for AI assistants and people)

DIWhy is a pixel-art browser game about a DIY renovation that snowballs. Several people work on it, often with an AI assistant. This file says how the code is shaped and what to update when you change something, so everyone's part keeps working. The [README](README.md) says how to run it.

## How it works

- **The server runs the game; the app shows it.** All rules live in `server/GameMode.ts`. The app (`src/`) only draws what the server sends (`state/GameState.ts`) and sends what you do (`state/Session.ts`). Never put a rule in the app.
- **One name per idea.** A **Screen** is any state of the game (menus, the intro, a DIY job; `src/screens/`). A **Level** is a Screen you walk around (`src/levels/`). What's placed in a level is an **Actor** (`src/actors/`). The seven DIY-ers are **characters**; you play one (the **player**), the other six play **roles** (partner, contractor…). Don't add a second word for any of these.
- **The UI is dumb.** HUD pieces (`src/ui/`) subscribe to GameState and redraw; they hold no game data.
- **Claude writes the phone's texts** (`server/texts.ts`), in each role's voice (`server/roles.ts`). There's no fallback: without a sign-in or key the server won't start.
- **Things happen later through the timeline** in GameMode (a text arriving, a job appearing, a fix breaking, a visit). Add a new kind of event there, not with timers.

## When you change X, also do Y

| If you change... | ...also do this |
|---|---|
| **A job, or a new one** | Only its folder, `jobs/<id>/`: `job.json` (title, level and spot, quote, steps, surprises, WeTube video and AskBot chat, its set, and `appears` if it turns up later) and its pictures (`backdrop.png`, the set's pieces, `sign.svg`). The level places its spot and the job screen draws its set from that folder. The server checks every folder when it starts and lists anything wrong (a missing picture, an unknown act, sound or tool). |
| **A tool** | `server/tools.json`: a cheap, a right and a premium option, each with the clerk's pitch. |
| **A role's personality** | Only `server/roles.ts`. |
| **What the server sends** (`GameView`, `Happening`, `Action` in `shared/game.ts`) | `GameMode.replicate()` on the server and `GameState.apply()` in the app; then whatever draws it. |
| **A screen or level** | List it in `src/screens/index.ts` (in play order). |
| **Art or sound** | Import it where it's used (`import x from '@art/…'`), or add it to a glob that already loads its folder. Icons too: SVG files in `src/assets/art/icons/` (import with `?raw` to put one inline, so it can take the text colour); never draw art in code. A missing file fails the build. Art and sound the game doesn't use go to `unused-assets/` (same layout, git-ignored), not the repo. |
| **The look** | Only `src/style.css`: shared tokens and buttons first, then one section per screen or widget, nested in its root class. Two text sizes (`--text`, `--text-big`). |

When in doubt, search the whole repo for what you're changing.

## Style

- **Code:** TypeScript everywhere. Few files; split only when it's cleaner. Functions are verbs; PascalCase for classes and their files. Short comments that say what something is or why.
- **Words:** UI text in CAPS (titles, buttons, hints); sentences for dialogue and descriptions. Keep everything short and a little funny.
- **Look:** the pixel style everywhere, nothing in the browser's own style. Every button has the same gold hover. Mobile always works.

## Before you say you're done

1. `npm run build` passes (it checks the types).
2. If you changed what the player sees, try it in `npm run dev`.
3. You updated what the table above says.

## Git and safety

- Work on a branch, make small commits, and don't push or merge without asking the people involved.
- Never commit `.env`, `.npmrc`, `node_modules/`, `dist/` or `unused-assets/`. Do commit `package-lock.json` (it only names the public npm registry).
- Never put credentials, internal company names or private registry addresses in any file or commit.
- Don't rewrite a teammate's work (their art, lines, events) without telling them.
