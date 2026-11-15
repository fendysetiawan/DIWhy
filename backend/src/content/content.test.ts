import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyChoice, eligibleEvents, nextEvent, type Quality } from '../engine/EventEngine';
import { createInitialState, isOver, type GameState } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { createRng } from '../engine/rng';
import { parseCsv, parseEventRows } from './csv';
import { LINKS } from './links';
import { buildEvents, calibrate } from './fromCsv';
import { PROJECT_DEFS, buildProjects, builtInProjects, projectFromSource, type Project } from './projects';
import { WEIGHTS } from './weights';

// The real files the team edits, so a bad edit fails here and not in the middle of a game.
const eventsDir = new URL('../../../events/', import.meta.url);
const files = Object.fromEntries(
  readdirSync(eventsDir).filter((f) => f.endsWith('.csv')).map((f) => [f, readFileSync(new URL(f, eventsDir), 'utf8')]),
);
const projects = buildProjects(files);
const byId = (id: string) => projects.find((p) => p.id === id)!;

describe('parseCsv', () => {
  it('handles quotes, commas, doubled quotes, CRLF and blank lines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,2\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b')).toThrow('unterminated');
  });
});

describe('parseEventRows', () => {
  const HEAD = 'id,event,kind,category,description,option_1,option_2,option_3,answer_key\n';
  const row = (over: Partial<Record<string, string>> = {}) => {
    const r = { id: 'e1', event: 'E', kind: 'snowball', category: 'plumbing', description: 'd', o1: 'a', o2: 'b', o3: 'c', key: '"good,ok,wrong"', ...over };
    return `${r.id},${r.event},${r.kind},${r.category},${r.description},${r.o1},${r.o2},${r.o3},${r.key}\n`;
  };

  it('reads a valid row', () => {
    const [r] = parseEventRows(HEAD + row(), 'f.csv');
    expect(r).toMatchObject({ id: 'e1', kind: 'snowball', options: ['a', 'b', 'c'], qualities: ['good', 'ok', 'wrong'] });
  });

  it.each([
    ['a bad quality', row({ key: '"good,fine,wrong"' }), '"fine" is not a quality'],
    ['too few qualities', row({ key: '"good,ok"' }), 'needs three qualities'],
    ['a bad kind', row({ kind: 'surprise' }), 'kind must be'],
    ['an empty option', row({ o2: '' }), 'all three options need text'],
    ['a duplicate id', row() + row(), 'duplicate id "e1"'],
  ])('names the file and row for %s', (_name, body, message) => {
    expect(() => parseEventRows(HEAD + body, 'wall.csv')).toThrow(new RegExp(`wall\\.csv row \\d.*${message}|wall\\.csv row \\d`));
    expect(() => parseEventRows(HEAD + body, 'wall.csv')).toThrow(message);
  });

  it('reports a missing column', () => {
    expect(() => parseEventRows('id,event\n1,2\n', 'x.csv')).toThrow('missing column "kind"');
  });

  it('lets optional cost_n and days_n columns override the derived numbers', () => {
    const text = 'id,event,kind,category,description,option_1,option_2,option_3,answer_key,cost_1,days_2\n' + 'e1,E,snowball,plumbing,d,a,b,c,"good,ok,wrong",75,3\n';
    const [r] = parseEventRows(text, 'f.csv');
    expect(r.costs).toEqual([75, undefined, undefined]);
    expect(r.days).toEqual([undefined, 3, undefined]);
  });
});

describe('the optional visual column', () => {
  const head = 'id,event,kind,category,description,option_1,option_2,option_3,answer_key,visual\n';
  const line = (visual: string) => `e1,E,snowball,plumbing,d,a,b,c,"good,ok,wrong",${visual}\n`;

  it('splits tokens on whitespace; empty or absent gives none', () => {
    expect(parseEventRows(head + line('"hole@wall  bees@wall thought:stack@ceiling"'), 'f.csv')[0].visual).toEqual(['hole@wall', 'bees@wall', 'thought:stack@ceiling']);
    expect(parseEventRows(head + line(''), 'f.csv')[0].visual).toEqual([]);
    expect(parseEventRows(head.replace(',visual', '') + 'e1,E,snowball,plumbing,d,a,b,c,"good,ok,wrong"\n', 'f.csv')[0].visual).toEqual([]);
  });

  it.each(['smoke', 'Smoke@dryer', 'smoke@', '@dryer', 'a:b:c@x', 'sm oke@dry er@'])('names the file, row and id for the token %s', (tok) => {
    expect(() => parseEventRows(head + line(`"${tok}"`), 'wall.csv')).toThrow(/wall\.csv row 2 \(e1\).*visual/);
  });

  it('survives JSON in a frozen project source', () => {
    const rows = parseEventRows(head + line('smoke@dryer'), 'f.csv');
    const def = { id: 'x', title: 't', job: 'j', blurb: 'b', fromPlan: false, quote: { budget: 1000, days: 5 } };
    const p = projectFromSource(JSON.parse(JSON.stringify({ def, rows, links: {} })));
    expect(p.events[0].visual).toEqual(['smoke@dryer']);
    expect(p.finale.visual ?? []).toEqual([]);
  });
});

describe("the team's real event files", () => {
  it('build into every project without errors', () => {
    expect(projects.map((p) => p.id)).toEqual(PROJECT_DEFS.map((d) => d.id));
    expect(projects).toHaveLength(12);
  });

  it('are all registered: every CSV in events/ belongs to a project (add a line to PROJECT_DEFS for a new file)', () => {
    const registered = new Set(PROJECT_DEFS.map((d) => d.file).filter(Boolean));
    const unregistered = Object.keys(files).filter((f) => !registered.has(f));
    expect(unregistered, `no project uses: ${unregistered.join(', ')}. Add one to PROJECT_DEFS in src/content/projects.ts`).toEqual([]);
  });

  it('give every project enough events for a varied game', () => {
    for (const p of projects) expect(p.events.length, p.id).toBeGreaterThanOrEqual(12);
  });

  it('give every event three answers with a quality, and at least one good one', () => {
    for (const p of projects) {
      for (const e of p.events) {
        expect(e.choices, `${p.id}/${e.id}`).toHaveLength(3);
        expect(e.choices.every((c) => c.quality), `${p.id}/${e.id}`).toBe(true);
        expect(e.choices.some((c) => c.quality === 'good'), `${p.id}/${e.id} has no good answer`).toBe(true);
      }
    }
  });

  it('only link events that exist (a typo here would silently disable a cascade)', () => {
    for (const [project, links] of Object.entries(LINKS)) {
      const ids = new Set(byId(project).events.map((e) => e.id));
      for (const [child, parents] of Object.entries(links)) {
        expect(ids.has(child), `${project}: child ${child}`).toBe(true);
        for (const parent of parents) expect(ids.has(parent), `${project}: ${child} <- ${parent}`).toBe(true);
      }
    }
  });

  it('has a baked weight for every event, and only for events and projects that exist', () => {
    const csvJobs = PROJECT_DEFS.filter((d) => d.file).map((d) => d.id);
    for (const id of Object.keys(WEIGHTS)) expect(csvJobs, `weights for unknown project ${id}`).toContain(id);
    for (const id of csvJobs) {
      const ids = byId(id).events.map((e) => e.id);
      const table = WEIGHTS[id] ?? {};
      for (const e of ids) expect(table[e], `${id}: no weight for ${e}`).toBeDefined();
      for (const [e, w] of Object.entries(table)) {
        expect(ids, `${id}: weight for unknown ${e}`).toContain(e);
        expect(w.base).toBeGreaterThan(0);
        for (const [parent, n] of Object.entries(w.after ?? {})) {
          expect(ids, `${id}: ${e} after unknown ${parent}`).toContain(parent);
          expect(n).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fail loudly when a file is missing', () => {
    const { 'wall_removal_events.csv': _gone, ...rest } = files;
    expect(() => buildProjects(rest)).toThrow('wall_removal_events.csv not found');
  });
});

describe('a project rebuilt from its source', () => {
  const csvProjects = projects.filter((p) => p.source);
  const snapshot = (p: Project, s: GameState) =>
    p.events.map((e) => ({ id: e.id, title: e.title, eligible: e.eligible(s), weight: e.weight(s), choices: e.choices.map((c) => ({ ...c, gamble: c.gamble && { ...c.gamble, chance: c.gamble.chance(s) } })) }));
  const stateOf = (p: Project, history: string[]): GameState => ({ ...createInitialState({ job: p.job, quote: p.quote }), eventHistory: history, riskDebt: 20 });

  it('exists for every project built from a file, and not for the built-in bathroom', () => {
    expect(csvProjects.map((p) => p.id)).toEqual(PROJECT_DEFS.filter((d) => d.file).map((d) => d.id));
    expect(byId('bathroom-leak').source).toBeUndefined();
  });

  it('is plain JSON and rebuilds an equal project', () => {
    for (const p of csvProjects) {
      const again = projectFromSource(JSON.parse(JSON.stringify(p.source)));
      expect(again.events.map((e) => e.id), p.id).toEqual(p.events.map((e) => e.id));
      expect(again.finale.title, p.id).toBe(p.finale.title);
      expect(again.quote, p.id).toEqual(p.quote);
      const parents = Object.values(LINKS[p.id] ?? {}).flat().slice(0, 3);
      for (const history of [[], ...parents.map((x) => [x]), ['a', ...parents]]) {
        const s = stateOf(p, history);
        expect(JSON.stringify(snapshot(again, s)), `${p.id} after ${history.join(',')}`).toBe(JSON.stringify(snapshot(p, s)));
      }
    }
  });

  it('carries hand-set cost and day columns through JSON', () => {
    const head = 'id,event,kind,category,description,option_1,option_2,option_3,answer_key,cost_1,days_2\n';
    const text = head + 'e1,E,snowball,plumbing,d,a,b,c,"good,ok,wrong",123,4\n';
    const rows = parseEventRows(text, 'f.csv');
    const def = { id: 'x', title: 't', job: 'j', blurb: 'b', fromPlan: false, quote: { budget: 1000, days: 5 } };
    const direct = projectFromSource({ def, rows, links: {} });
    const viaJson = projectFromSource(JSON.parse(JSON.stringify({ def, rows, links: {} })));
    expect(JSON.stringify(viaJson.events[0].choices)).toBe(JSON.stringify(direct.events[0].choices));
  });
});

describe('baked weights', () => {
  it('reproduce the weights the game had before the table, at the start and after each parent', () => {
    for (const p of projects.filter((x) => x.source)) {
      const { rows, links } = p.source!;
      const scale = calibrate(rows, p.quote);
      const withTable = buildEvents(rows, links, scale, WEIGHTS[p.id]);
      const without = buildEvents(rows, links, scale);
      const base = createInitialState({ job: p.job, quote: p.quote });
      const parents = [...new Set(Object.values(links).flat())];
      const histories = [[], ...parents.map((x) => [x]), parents.slice(0, 4), ['one', 'two', ...parents.slice(0, 2)]];
      for (const history of histories) {
        for (const riskDebt of [0, 30]) {
          const s = { ...base, eventHistory: history, riskDebt };
          withTable.forEach((e, i) => {
            expect(e.eligible(s), `${p.id}/${e.id}`).toBe(without[i].eligible(s));
            expect(e.weight(s), `${p.id}/${e.id} after ${history.join(',')}`).toBe(without[i].weight(s));
          });
        }
      }
    }
  });
});

describe('cascades', () => {
  const start = (p: Project): GameState => createInitialState({ job: p.job, quote: p.quote });
  const after = (s: GameState, ...ids: string[]): GameState => ({ ...s, eventHistory: ids });

  it('open with a problem, never a temptation or a follow-up', () => {
    for (const p of projects) {
      const openers = eligibleEvents(start(p), p.events);
      // Most projects open from a pool of problems. Two have one scripted opener: the bathroom's
      // stuck valve, and the dryer's smoke (the plan's chain starts there).
      const scripted = ['bathroom-leak', 'dryer-replacement'];
      expect(openers.length, p.id).toBeGreaterThanOrEqual(scripted.includes(p.id) ? 1 : 3);
      expect(openers.every((e) => e.kind === 'problem'), p.id).toBe(true);
    }
  });

  it('hold a follow-up back until its parent has happened', () => {
    const dryer = byId('dryer-replacement');
    const ids = (s: GameState) => eligibleEvents(s, dryer.events).map((e) => e.id);
    expect(ids(start(dryer))).not.toContain('beehive_found');
    expect(ids(after(start(dryer), 'dryer_smokes', 'lint_everywhere'))).toContain('wall_needs_opening');
    expect(ids(after(start(dryer), 'dryer_smokes', 'lint_everywhere'))).not.toContain('beehive_found');
    expect(ids(after(start(dryer), 'dryer_smokes', 'lint_everywhere', 'wall_needs_opening'))).toContain('beehive_found');
  });

  it("follows the plan's dryer chain: smoke, dust, wall, beehive", () => {
    const chain = ['dryer_smokes', 'lint_everywhere', 'wall_needs_opening', 'beehive_found'];
    const dryer = byId('dryer-replacement');
    for (let i = 1; i < chain.length; i++) {
      const state = { ...createInitialState({ job: dryer.job, quote: dryer.quote }), eventHistory: chain.slice(0, i) };
      expect(eligibleEvents(state, dryer.events).map((e) => e.id), chain[i]).toContain(chain[i]);
    }
  });

  it('keep temptations until the work is under way', () => {
    const wall = byId('wall-removal');
    const tempt = (n: number) => eligibleEvents({ ...start(wall), eventHistory: Array(n).fill('x') }, wall.events).filter((e) => e.kind === 'temptation');
    expect(tempt(1)).toHaveLength(0);
    expect(tempt(2).length).toBeGreaterThan(0);
  });

  it('make serious trouble likelier when corners have been cut', () => {
    const wall = byId('wall-removal');
    const e = wall.events.find((x) => x.id === 'wires_in_wall')!;
    const calm = start(wall);
    expect(e.weight({ ...calm, riskDebt: 60 })).toBeGreaterThan(e.weight(calm));
  });
});

// ------------------------------------------------------------------ balance
// Bots play whole games, always taking one kind of answer. This pins the design: careful play
// beats or matches the contractor, DIY on average costs more, and corner-cutting ends badly.

const PICK: Record<string, (q: (Quality | undefined)[], r: () => number) => number> = {
  good: (q) => Math.max(0, q.indexOf('good')),
  excessive: (q) => Math.max(0, q.indexOf('excessive')),
  wrong: (q) => Math.max(0, q.indexOf('wrong')),
  random: (q, r) => Math.floor(r() * q.length),
};

async function simulate(p: Project, policy: keyof typeof PICK, games = 40) {
  const out = { spent: 0, days: 0, completed: 0, beat: 0, games };
  for (let seed = 0; seed < games; seed++) {
    const rng = createRng(seed);
    const director = new RandomDirector(rng);
    const chooser = createRng(seed + 1000);
    let s = createInitialState({ job: p.job, quote: p.quote });
    for (let i = 0; i < 20 && !isOver(s); i++) {
      const e = await nextEvent(s, p.events, director, p.finale);
      s = applyChoice(s, e, PICK[policy](e.choices.map((c) => c.quality), chooser), rng).state;
    }
    expect(isOver(s)).toBe(true); // every game must end
    out.spent += s.spent / p.quote.budget / games;
    out.days += s.daysElapsed / p.quote.days / games;
    if (!s.failure) out.completed++;
    if (!s.failure && s.spent <= p.quote.budget && s.daysElapsed <= p.quote.days) out.beat++;
  }
  return out;
}

describe.each(projects.map((p) => [p.id, p] as const))('balance: %s', (_id, p) => {
  it('lets careful play finish near, and often under, the contractor quote', async () => {
    const r = await simulate(p, 'good');
    expect(r.completed).toBe(r.games);
    expect(r.spent).toBeGreaterThan(0.7);
    expect(r.spent).toBeLessThanOrEqual(1.05); // tiny jobs round to $10 steps, so allow a little slack
    expect(r.days).toBeLessThanOrEqual(1.35);
  });

  it('makes the average DIY player overspend compared with careful play', async () => {
    const careful = await simulate(p, 'good');
    const random = await simulate(p, 'random');
    expect(random.spent).toBeGreaterThan(careful.spent);
    expect(random.spent).toBeGreaterThanOrEqual(1.0); // DIY costs more than the contractor
    expect(random.completed / random.games).toBeGreaterThanOrEqual(0.7); // hard, not hopeless
  });

  it('punishes going overboard', async () => {
    const r = await simulate(p, 'excessive');
    expect(r.spent).toBeGreaterThanOrEqual(1.35);
    expect(r.beat).toBe(0);
  });
});

describe('balance: shortcuts', () => {
  // Cutting every corner ends badly, far more often than careful play (which always finishes).
  // The bathroom's blow-ups are milder, and painting is mostly cosmetic trouble, so they get slack.
  it.each(projects.filter((p) => p.id !== 'bathroom-leak').map((p) => [p.id, p] as const))(
    'usually ends in a meltdown in %s',
    async (_id, p) => {
      const r = await simulate(p, 'wrong');
      expect(r.completed / r.games).toBeLessThanOrEqual(0.75);
    },
  );
});

describe('the built-in bathroom project', () => {
  it('needs no files and annotates its answers', () => {
    const [p] = builtInProjects();
    expect(p.id).toBe('bathroom-leak');
    expect(p.events.every((e) => e.choices.every((c) => c.quality))).toBe(true);
    expect(p.finale.choices.map((c) => c.quality)).toEqual(['ok', 'good']);
  });
});
