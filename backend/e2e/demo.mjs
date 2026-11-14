// Plays the whole hands-free demo in a real (headless) Chrome and photographs every stage.
//
//   npm run play        (in one terminal: the game server)
//   npm run e2e         (in another: this)
//
//   SPEED=8        how fast to run the demo for this check (the real demo is 1.5)
//   BASE=http://127.0.0.1:3001   where the game is
//   OUT=e2e/out    where the screenshots go
//   SHOTS=0        skip the screenshots (for timing the demo at its real speed)
//   DEMO=short     play the gameplay-only demo instead of the whole thing
//
// Exits non-zero if the demo does not reach the end, or the page throws an error.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './chrome.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3001';
const SPEED = Number(process.env.SPEED ?? 8);
const OUT = process.env.OUT ?? 'e2e/out';
const LIMIT_MS = Number(process.env.LIMIT_MS ?? 300_000);

const STAGE = `(() => {
  const q = (s) => document.querySelector(s);
  const text = (s) => (q(s) && q(s).textContent || '').trim().slice(0, 40);
  if (document.documentElement.dataset.demo === 'finished') return 'finished';
  if (q('.dw-report')) return 'report: ' + text('.dw-report h2');
  if (q('.dw-option')) return 'event: ' + text('.dw-title');
  if (q('#dwCard') && !q('#dwCard').hidden) return 'event loading';
  if (q('.reply-button')) return 'story: the contractor texts';
  if (q('.choices .choice')) return 'story: where do you start';
  if (q('.living-on')) return 'story: the living room';
  if (q('.deed-pad canvas')) return 'story: the contract';
  if (q('.house-on')) return 'story: the house';
  if (q('.story')) return 'story';
  if (q('.select')) return 'character select';
  if (q('.splash')) return 'splash';
  if (q('.dw-live')) return 'game loading';
  return 'loading';
})()`;

try {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  if (h.status !== 'ok') throw new Error('unhealthy');
} catch {
  console.error(`The game is not running at ${BASE}. Start it with: npm run play`);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const chrome = await launchChrome();
const started = Date.now();
const seen = [];
let last = '';
let n = 0;
let failure = null;

await chrome.navigate(`${BASE}/app/?demo=${process.env.DEMO ?? '1'}&speed=${SPEED}`);

while (Date.now() - started < LIMIT_MS) {
  await new Promise((r) => setTimeout(r, 200));
  let stage;
  try { stage = await chrome.eval(STAGE); } catch { continue; } // the page is changing
  if (stage !== last) {
    last = stage;
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    seen.push({ secs, stage });
    console.log(`${secs.padStart(6)}s  ${stage}`);
    await new Promise((r) => setTimeout(r, Math.max(60, (450 * 1.5) / SPEED))); // let the stage settle, scaled to how fast it runs
    if (n < 60 && process.env.SHOTS !== '0') await chrome.screenshot(join(OUT, `${String(++n).padStart(2, '0')}-${stage.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`));
  }
  if (stage === 'finished') break;
}

// Anything the page complained about (ignoring fonts and other network trouble in the sandbox).
for (const e of chrome.events) {
  const text = e.params?.exceptionDetails?.exception?.description ?? e.params?.entry?.text ?? '';
  const isError = e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error');
  if (isError && !/Failed to load resource|fonts\.g|net::ERR/.test(text + (e.params?.entry?.url ?? ''))) failure = failure ?? `page error: ${text.slice(0, 200)}`;
  if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' && /\[demo\]/.test(JSON.stringify(e.params.args))) failure = failure ?? `demo error: ${JSON.stringify(e.params.args).slice(0, 300)}`;
}
if (last !== 'finished') failure = failure ?? `the demo did not finish within ${LIMIT_MS / 1000}s (stuck at "${last}")`;

chrome.close();
const total = ((Date.now() - started) / 1000).toFixed(1);
console.log(failure ? `\nFAILED after ${total}s: ${failure}` : `\nThe demo ran from splash to report in ${total}s at ${SPEED}x. ${n} screenshots in ${OUT}/`);
process.exit(failure ? 1 : 0);
