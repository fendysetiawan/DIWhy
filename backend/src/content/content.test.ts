import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyChoice, eligibleEvents, nextEvent, type Quality } from '../engine/EventEngine';
import { createInitialState, isOver, type GameState } from '../engine/GameState';
import { RandomDirector } from '../engine/RandomDirector';
import { createRng } from '../engine/rng';
import { parseCsv, parseEventRows } from './csv';
import { LINKS } from './links';
import { PROJECT_DEFS, buildProjects, builtInProjects, type Project } from './projects';

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

describe("the team's real event files", () => {
  it('build into all six projects without errors', () => {
    expect(projects.map((p) => p.id)).toEqual(PROJECT_DEFS.map((d) => d.id));
    expect(projects).toHaveLength(6);
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

  it('fail loudly when a file is missing', () => {
    const { 'wall_removal_events.csv': _gone, ...rest } = files;
    expect(() => buildProjects(rest)).toThrow('wall_removal_events.csv not found');
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
    expect(r.spent).toBeLessThanOrEqual(1.0);
    expect(r.days).toBeLessThanOrEqual(1.1);
  });

  it('makes the average DIY player overspend and run late', async () => {
    const careful = await simulate(p, 'good');
    const random = await simulate(p, 'random');
    expect(random.spent).toBeGreaterThan(careful.spent);
    expect(random.spent).toBeGreaterThanOrEqual(0.95);
    expect(random.days).toBeGreaterThan(1);
    expect(random.completed / random.games).toBeGreaterThanOrEqual(0.7); // hard, not hopeless
  });

  it('punishes going overboard', async () => {
    const r = await simulate(p, 'excessive');
    expect(r.spent).toBeGreaterThanOrEqual(1.35);
    expect(r.beat).toBe(0);
  });
});

describe('balance: shortcuts', () => {
  it.each(projects.filter((p) => p.id !== 'bathroom-leak').map((p) => [p.id, p] as const))(
    'usually ends in a meltdown in %s',
    async (_id, p) => {
      const r = await simulate(p, 'wrong');
      expect(r.completed / r.games).toBeLessThanOrEqual(0.4);
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
