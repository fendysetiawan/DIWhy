# DIWhy: read this first (people and AI assistants)

A pixel-art browser game about a DIY renovation that snowballs. The [README](README.md) says how to run it.

## How it works

- **The server runs the game; the app only shows it.** Every rule is in `server/GameMode.ts`. The app draws what the server sends (`src/state/GameState.ts`) and sends what you do (`src/state/Session.ts`).
- **Later events go on GameMode's timeline** (a text, a new job, a fix breaking, a visit), not on timers.
- **Claude writes the phone's texts** (`server/texts.ts`) in each role's voice (`server/roles.ts`). No sign-in or key, no server.
- **One word per idea:** a **Screen** is any state of the game (`src/screens/`); a **Level** is a screen you walk around (`src/levels/`); an **Actor** is something placed in a level (`src/actors/`). The seven **characters**: you play one (the **player**), the others play **roles**.

## When you change X, also do Y

| Change | Where |
|---|---|
| A job | Only its folder, `jobs/<id>/`: `job.json` and its pictures. The server checks every job folder at start-up and lists what's wrong. |
| A tool | `server/tools.json` |
| A role's personality | `server/roles.ts` |
| What the server sends (`shared/game.ts`) | `GameMode.replicate()` and `GameState.apply()`, then whatever draws it |
| A screen or level | Add it to `src/screens/index.ts` |
| Art or sound | Import it where it's used. Icons are SVGs in `src/assets/art/icons/`. Never draw art in code. Unused files go in `unused-assets/` (git-ignored). |
| The look | Only `src/style.css` |

## Style

- TypeScript, few files, short comments. Functions are verbs; classes and their files are PascalCase.
- UI text in CAPS, short and a little funny.
- Pixel style everywhere, one gold hover, and it works on a phone.

## Before you're done

`npm run build` passes, you tried it in `npm run dev`, and the table above still holds.

## Git

- Work on a branch, and ask before you push or merge.
- Never commit `.env`, `.npmrc`, `node_modules/`, `dist/`, `unused-assets/`, credentials, or internal company names.
- Don't rewrite a teammate's work without telling them.
