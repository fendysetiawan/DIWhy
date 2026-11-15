// Screenshots of the game, for the README and slides. It plays the game in a hidden browser (Playwright), through
// every screen worth showing, on a desktop and a phone, and saves them next to this file, in play order:
//
//   desktop/01-splash.png …   1920 × 1080
//   phone/01-splash.png …     390 × 844, at 3×
//   diwhy-screenshots.zip     both folders, to send
//
// Once, here in screenshots/: `npm install` and `npx playwright install chromium`. Then, with `npm run dev` running at
// the top of the repo (the game and the API, with your Claude sign-in): `npx tsx capture.ts`. `--show` plays it in a
// window you can watch.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { type Browser, chromium, type Page } from 'playwright';

const GAME = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = new URL('./', import.meta.url).pathname;
const PLAYER = 'aidan-newsome';
const NAME = 'Aidan';

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  phone: { width: 390, height: 844 },
};

/** The game, as the page has it (main.ts exposes it in dev). Typed loosely: this script only pokes it. */
type GameHandle = {
  screens: { start(key: string, data?: unknown): void };
  session: { startGame(player: string): Promise<void>; sign(name: string): void; startJob(job: string): void; work(job: string): Promise<void> };
  state: { jobs: { id: string; surprise: unknown }[]; chats: Record<string, { messages: unknown[] }> };
  hud: { phone: { setOpen(open: boolean): void } };
  giveUp(): void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run something in the page, with the game. */
function inGame<T>(page: Page, fn: (game: GameHandle, arg: unknown) => T | Promise<T>, arg?: unknown): Promise<T> {
  return page.evaluate(([source, a]) => new Function('game', 'arg', `return (${source})(game, arg)`)((window as unknown as { game: GameHandle }).game, a), [
    fn.toString(),
    arg,
  ] as const) as Promise<T>;
}

/** Go to a screen and let it settle (fades, pop-ins, the first frames of its animations). */
async function show(page: Page, key: string, data?: unknown, settle = 1500): Promise<void> {
  await inGame(page, (game, a) => game.screens.start((a as [string, unknown])[0], (a as [string, unknown])[1]), [key, data]);
  await wait(settle);
}

/** A screenshot, numbered in the order they're taken. */
function shooter(page: Page, folder: string) {
  let n = 0;
  return async (name: string) => {
    n++;
    await page.screenshot({ path: `${folder}/${String(n).padStart(2, '0')}-${name}.png` });
    console.log(`  ${String(n).padStart(2, '0')}-${name}`);
  };
}

/** A game started as PLAYER, signed, and playing. */
async function startGame(page: Page): Promise<void> {
  await inGame(page, async (game, a) => {
    await game.session.startGame((a as string[])[0]);
    game.session.sign((a as string[])[1]);
  }, [PLAYER, NAME]);
}

/** Work a job until a surprise comes up (or it runs out of steps). */
async function workUntilSurprise(page: Page, job: string): Promise<void> {
  await inGame(page, async (game, id) => {
    game.session.startJob(id as string);
    for (let i = 0; i < 12; i++) {
      if (game.state.jobs.find((j) => j.id === id)?.surprise) return;
      await game.session.work(id as string);
    }
  }, job);
}

/** Every state worth a still, at one size. */
async function captureStills(browser: Browser, viewport: keyof typeof VIEWPORTS): Promise<void> {
  const folder = `${OUT}${viewport}`;
  mkdirSync(folder, { recursive: true });
  const page = await browser.newPage({ viewport: VIEWPORTS[viewport], deviceScaleFactor: viewport === 'phone' ? 3 : 1 });
  await page.goto(GAME);
  await page.waitForFunction(() => 'game' in window);
  const shoot = shooter(page, folder);
  const back = { level: 'Ground', at: { x: 900, y: 600, facing: 'front' } };
  console.log(`${viewport}:`);

  // the intro
  await show(page, 'Splash');
  await page.keyboard.press('Enter'); // past "press any key": the studio's logo
  await wait(1500);
  await shoot('splash');
  await show(page, 'Select');
  await shoot('select');
  await startGame(page);
  await show(page, 'House', undefined, 0); // the house falls, the dust settles…
  await page.waitForSelector('.named', { timeout: 15000 }); // …DIWHY?!
  await wait(800);
  await shoot('house-falls');
  await show(page, 'Contract');
  await page.locator('.sign-name').pressSequentially(NAME); // signed, but not sent
  await wait(500);
  await shoot('contract');

  // the house
  await inGame(page, (game) => game.screens.start('Yard'));
  await wait(9000); // and the contractor's first text arrives
  await shoot('yard');
  for (const level of ['Ground', 'Upstairs', 'Basement']) {
    await show(page, level);
    await shoot(level.toLowerCase());
  }

  // the phone and the to-do list
  await show(page, 'Ground');
  await inGame(page, (game) => game.hud.phone.setOpen(true));
  await wait(800);
  await shoot('phone');
  await inGame(page, (game) => game.hud.phone.setOpen(false));
  await page.keyboard.press('KeyT');
  await wait(800);
  await shoot('to-do');
  await page.keyboard.press('KeyT');

  // a DIY job, a surprise, the store
  await show(page, 'Diy', { job: 'mount-tv', back }, 2000);
  await shoot('job');
  await workUntilSurprise(page, 'kitchen-faucet');
  await show(page, 'Diy', { job: 'kitchen-faucet', back }, 2000);
  await shoot('surprise');
  await show(page, 'Store', { tool: 'stud-finder', back: { job: 'mount-tv', back } }, 2000);
  await shoot('store');

  // the endings
  await show(page, 'End', { result: 'win' }, 2500);
  await shoot('end-win');
  await show(page, 'End', { result: 'burnedOut' }, 2500);
  await shoot('end-burned-out');
  await inGame(page, (game) => game.giveUp());
  await wait(3000);
  await shoot('end-gave-up');
  await show(page, 'Credits');
  await shoot('credits');
  await page.close();
}

const browser = await chromium.launch({ headless: !process.argv.includes('--show') });
try {
  for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) await captureStills(browser, viewport);
  rmSync(`${OUT}diwhy-screenshots.zip`, { force: true });
  execFileSync('zip', ['-qrX', 'diwhy-screenshots.zip', 'desktop', 'phone'], { cwd: OUT }); // both folders, to send
  console.log(`Saved in ${OUT}desktop and ${OUT}phone, and both in ${OUT}diwhy-screenshots.zip`);
} finally {
  await browser.close();
}
