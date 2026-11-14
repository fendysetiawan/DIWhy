// Keeps the hands-free demo (demo/) working as the rest of the game changes.
//
// The demo clicks the real pages' real buttons, so it breaks when one is renamed, removed or hidden.
// This file turns that into a failing test instead of a surprise on demo day:
//
//   1. every element the demo relies on (demo/selectors.js) still exists in the file that owns it
//   2. the demo scripts use no selector that is not in the registry
//   3. the demo's settings (demo/config.js) are valid
//   4. the fixed game the demo plays still tells a good story against the real event files
//
// If the story breaks (an event was edited), find a new seed:
//   FIND_DEMO_SEED=1 npx vitest run src/demo/demo.test.ts --disable-console-intercept
// then set `seed` in demo/config.js.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../service/cast';
import { GameService } from '../service/GameService';
import { realProjects } from '../testing';

const root = join(process.cwd(), '..'); // tests run from backend/

type Entry = { selector: string; file: string; words: string[] };
interface DemoConfig {
  speed: number;
  seed: number;
  owner: string;
  project: string;
  projectTitle: string;
  policy: string[];
  finalePick: string;
  story: { mustSee: string[]; minEvents: number; minBlowups: number; overrun: [number, number] };
}

const load = async <T>(rel: string): Promise<T> => import(/* @vite-ignore */ pathToFileURL(join(root, rel)).href);
const { DEMO } = await load<{ DEMO: DemoConfig }>('demo/config.js');
const { REGISTRY, CONTRACTS } = await load<{ REGISTRY: Record<string, Entry>; CONTRACTS: Record<string, Entry> }>('demo/selectors.js');
const { chooseIndex } = await load<{ chooseIndex: (want: string, q: Array<string | null>) => number }>('demo/pages/game.js');

const HOW_TO_FIX =
  'The demo (demo/) depends on this. Update the entry in demo/selectors.js and the script in demo/pages/ that uses it, then run `npm run e2e` to watch it work. See AGENTS.md.';

describe('demo: everything it relies on still exists', () => {
  const entries: Array<[string, string, Entry]> = [
    ...Object.entries(REGISTRY).map(([name, e]) => ['element', name, e] as [string, string, Entry]),
    ...Object.entries(CONTRACTS).map(([name, e]) => ['contract', name, e] as [string, string, Entry]),
  ];

  it.each(entries)('%s "%s" is still in its owner file', (_kind, name, entry) => {
    const path = join(root, entry.file);
    expect(existsSync(path), `${entry.file} (owner of "${name}") is gone. ${HOW_TO_FIX}`).toBe(true);
    const text = readFileSync(path, 'utf8');
    for (const word of entry.words) {
      expect(text.includes(word), `${entry.file} no longer contains ${JSON.stringify(word)}, which "${name}" (${entry.selector}) needs. ${HOW_TO_FIX}`).toBe(true);
    }
  });

  it('has no hard-coded selectors in the demo scripts: every one goes through the registry', () => {
    const dir = join(root, 'demo/pages');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const code = readFileSync(join(dir, file), 'utf8');
      // a quote straight after the call is a hard-coded selector; a template that starts from SEL.<name> is fine
      const loose = [...code.matchAll(/\b(?:a\.(?:click|hover|waitFor|waitForAny|drag)|querySelector(?:All)?|\$)\(\s*(?:["']|`(?!\$\{SEL\.))/g)];
      expect(loose.map((m) => m[0]), `demo/pages/${file} uses a selector that is not in demo/selectors.js. Add it there and use SEL.<name>. ${HOW_TO_FIX}`).toEqual([]);
    }
  });
});

describe('demo: its settings are valid', () => {
  const projects = realProjects();

  it('uses a real character and a real project, and clicks the project\'s real title', () => {
    expect(CHARACTER_IDS, 'demo owner is not one of the seven characters').toContain(DEMO.owner);
    const project = projects.find((p) => p.id === DEMO.project);
    expect(project, `demo project "${DEMO.project}" is not in backend/src/content/projects.ts`).toBeDefined();
    expect(project!.title, 'the story button the demo clicks must match the project title in projects.ts').toBe(DEMO.projectTitle);
  });

  it('picks only real answer qualities', () => {
    for (const q of [...DEMO.policy, DEMO.finalePick]) expect(['good', 'ok', 'wrong', 'excessive']).toContain(q);
  });

  it('plays at the speed the docs promise', () => {
    expect(DEMO.speed).toBe(1.5);
  });
});

/** Play the demo's fixed game the way the demo does, and report what happened. */
async function playDemo(seed: number) {
  const svc = new GameService({ projects: realProjects() });
  let v = await svc.createGame({ seed, project: DEMO.project, owner: DEMO.owner }, { debug: true });
  const events: string[] = [];
  let blowups = 0;
  for (let step = 0; v.status === 'playing' && step < 14; step++) {
    events.push(v.event!.id);
    const finale = v.event!.kind === 'finale';
    const index = chooseIndex(finale ? DEMO.finalePick : DEMO.policy[step % DEMO.policy.length], v.debug!.choiceQualities);
    v = await svc.choose(v.id, { choice: index, eventId: v.event!.id }, { debug: true });
    if (v.outcome!.blewUp) blowups++;
  }
  const overrun = v.stats.spent / v.quote.original.budget;
  return { v, events, blowups, overrun };
}

function problems(r: Awaited<ReturnType<typeof playDemo>>): string[] {
  const s = DEMO.story;
  const out: string[] = [];
  if (r.v.status !== 'complete') out.push(`it did not finish the job (${r.v.status}${r.v.failure ? `: ${r.v.failure}` : ''})`);
  if (r.events.length < s.minEvents) out.push(`only ${r.events.length} events (wanted ${s.minEvents}+)`);
  for (const id of s.mustSee) if (!r.events.includes(id)) out.push(`"${id}" never came up`);
  if (r.blowups < s.minBlowups) out.push(`no shortcut blew up (wanted ${s.minBlowups}+)`);
  if (r.overrun < s.overrun[0] || r.overrun > s.overrun[1]) out.push(`it ended ${r.overrun.toFixed(2)}x the contractor's quote (wanted ${s.overrun[0]} to ${s.overrun[1]})`);
  return out;
}

describe('demo: the fixed game still tells a good story', () => {
  it('plays the dryer chain, a blow-up, and an overrun with the configured seed', async () => {
    const r = await playDemo(DEMO.seed);
    const found = problems(r);
    expect(
      found,
      `The demo's story is no longer good with seed ${DEMO.seed}: ${found.join('; ')}. The events or the consequences changed. ` +
        `Find a new seed with: FIND_DEMO_SEED=1 npx vitest run src/demo/demo.test.ts --disable-console-intercept  then set \`seed\` in demo/config.js.`,
    ).toEqual([]);
  });
});

// Not a test: a tool. Prints seeds that tell a good story. Only runs when asked for.
describe.skipIf(!process.env.FIND_DEMO_SEED)('demo seed finder', () => {
  it('lists seeds that would make a good demo', async () => {
    const good: string[] = [];
    for (let seed = 0; seed < 2000 && good.length < 8; seed++) {
      const r = await playDemo(seed);
      if (problems(r).length === 0) {
        good.push(`seed ${seed}: ${r.v.report!.achievement.title}, ${r.overrun.toFixed(2)}x the quote, ${r.blowups} blow-up(s)\n     ${r.events.join(' > ')}`);
      }
    }
    console.log(`\nSeeds that tell a good demo story (set one as \`seed\` in demo/config.js):\n${good.join('\n') || '  none found: loosen the story rules in demo/config.js'}\n`);
  }, 300_000);
});
