# DIWhy

**Do it yourself. Then ask why.**

A game where replacing one faucet snowballs into a very different project. You turn down the contractor's quote and do it yourself. Choices change a hidden state, the state decides which problems come next, and the end report counts the moments you asked "why?".

## Play it

```
cd backend
npm install
npm run play
```

Then open http://127.0.0.1:3001.

**Want to watch instead?** Open http://127.0.0.1:3001/app/?demo=1. The game plays itself at 1.5x speed with a visible mouse, from the splash to the final report. `?demo=short` skips the intro and plays just the game. Press Escape or move your mouse to take over. See [`demo/`](demo/README.md).

## Folders

Each person works in their own folder. [`INTEGRATION.md`](INTEGRATION.md) explains how they connect and what each depends on.

| Folder | What's in it | Start here |
|---|---|---|
| [`app/`](app/README.md) | The front door: splash, pick your diy-er, the story | `app/main.js` |
| [`frontend/`](frontend/README.md) | The gameplay page: the yard, the house, the phone, the post-its | `frontend/index.html`, and `frontend/game-link.js` for the backend |
| [`backend/`](backend/README.md) | The rules, the dice, the API | [`backend/API.md`](backend/API.md) if you are building a front end |
| [`events/`](events/) | The events, one CSV per job | Add a row, and the next game uses it |
| [`assets/`](assets/README.md) | Art and brand | `assets/style.css` |
| [`demo/`](demo/README.md) | The hands-free playthrough | `?demo=1` |
