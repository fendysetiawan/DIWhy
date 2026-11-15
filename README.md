# DIWhy

![DIWHY?! Do it yourself. Then ask why. The team in front of the house.](.github/banner.png)

**Do it yourself. Then ask why.**

[![Play DIWhy](https://img.shields.io/badge/▶%20Play%20DIWhy%20now-diwhy.onrender.com-F5A623?style=for-the-badge&logo=googlechrome&logoColor=white)](https://diwhy.onrender.com/)

A game where replacing one faucet snowballs into a very different project. You turn down the contractor's quote and do it yourself: walk the house, take on the DIY jobs, answer the surprises that come up, and keep an eye on the days, the money and your health. Meanwhile everyone in your life texts you about it.

By Around The World Games: Travis, Aidan, Gigi, Christian, Rachel, Ramy and Fendy.

## How to Play

Arrow keys (or WASD) to walk, **Enter** to use what you're next to, **P** for the phone, **Esc** to put it away. Or click and tap: on a phone, arrows and **USE** appear along the bottom while you walk around.

## Run it

You need [Node.js](https://nodejs.org), and Claude for the phone's texts. Once:

```sh
brew install anthropics/tap/ant   # the Anthropic CLI
ant auth login                    # sign in (no key needed), or put ANTHROPIC_API_KEY= in .env
npm install
```

Then:

```sh
npm run dev    # the game and the API together: open http://localhost:5173
npm run build  # check the types, then build the game into dist/
npm start      # after a build: the game and the API on one port (http://localhost:3000)
```

## Screenshots

`screenshots/capture.ts` plays through the game and saves a screenshot of every screen, on a desktop and a phone, into `screenshots/desktop/` and `screenshots/phone/`, and both in `screenshots/diwhy-screenshots.zip` to send (none of it committed). It has its own tools, so the game doesn't install them. Once: `cd screenshots && npm install && npx playwright install chromium`. Then, with `npm run dev` running, `npx tsx capture.ts` in `screenshots/` (`--show` to watch it).

## How it's organized

A Vite + TypeScript game and a small Node API. The server runs the game; the game shows it.

- **`src/`**: the game, in the browser
- **`server/`**: the API: the rules, the DIY jobs, and Claude writing the phone's texts
- **`jobs/`**: the DIY jobs, one folder each: a `job.json` with everything about it, and its pictures. To add a job, add a folder
- **`shared/`**: the types both use
- **`public/`**: the favicon

Inside `src/`:

| Folder | What's in it |
|---|---|
| `screens/` | Every screen: menus, cinematics, a DIY job |
| `levels/` | The places you walk around |
| `actors/` | What's in a level: props, doors, you, the cat |
| `engine/` | The machinery: the loop, camera, controls, sound |
| `state/` | The game as the server sent it |
| `ui/` | The interface: the HUD (meters, phone, settings) and pieces screens share (the picker, toasts) |
| `assets/` | Art and sound |

Art and sound we made but don't use go in `unused-assets/` (same layout as `src/assets/`). It stays on your machine (it's in `.gitignore`).
