# Bringing old work into the game

The old `app/`, `frontend/`, `backend/` and `demo/` folders are now one Vite app (`src/`) and a small server (`server/`). If your branch is on the old layout, don't rebase it: copy your changes across by hand, using the table below. Read [AGENTS.md](AGENTS.md) first.

| Old | New |
|---|---|
| A surprise (`events/*.csv`) | `"surprises"` in `jobs/<id>/job.json`: `title`, `description`, `options` as `{ "text", "quality", "cost" }` (quality is `good`, `ok`, `wrong` or `excessive`; cost in dollars) |
| A new job | Copy a folder in `jobs/` and edit its `job.json`; add a `backdrop.png` (480 × 270) |
| A tool (`store.js`) | `server/tools.json` |
| Texts, a personality (`TEXTS`, `character-texts.txt`) | `server/roles.ts` |
| A rule or number (`backend/src/engine`) | `server/GameMode.ts`, constants at the top |
| A walkable place (`house.js`, `yard.js`) | `src/levels/`, art in `src/assets/art/levels/` |
| An intro or end screen (`app/screens/`) | `src/screens/` |
| The phone (`phone.js`) | `src/ui/Phone.ts` |
| Art, sound (`assets/`) | `src/assets/` |
| The look (`style.css`) | `src/style.css` |
| The API (`backend/API.md`) | `server/routes.ts` and `shared/game.ts` |
| The demo (`demo/`) | Dropped |

Then `npm run dev`, play what you ported, and check `npm run build` passes.
