import { describe, expect, it } from 'vitest';
import { PROJECT_DEFS } from '../content/projects';
import { buildReport } from './report';
import { createInitialState, type GameState } from './GameState';

const done = (over: Partial<GameState>): GameState => ({ ...createInitialState(), completed: true, ...over });

describe('end report', () => {
  it('every ending closes with the DIWhy question and an answer', () => {
    const endings: GameState[] = [
      done({ failure: 'stress' }),
      done({ failure: 'budget', spent: 5200 }),
      done({ failure: 'time', daysElapsed: 31 }),
      done({ spent: 300, daysElapsed: 2 }),
      done({ spent: 3000, daysElapsed: 12, flags: ['upgrade-fever', 'upgrade-fever', 'upgrade-fever'] }),
      done({ spent: 1200, daysElapsed: 6, riskDebt: 60 }),
      done({ spent: 1200, daysElapsed: 6 }),
    ];
    for (const s of endings) {
      const r = buildReport(s);
      expect(r.whyLine).toMatch(/^Why did you do it yourself\? .{5,}/);
    }
  });

  it('computes the cost overrun against the $250 estimate', () => {
    expect(buildReport(done({ spent: 1250 })).overrunPct).toBe(400);
  });

  it('a give-up report carries the contractor bill, and no other ending does', () => {
    const fresh = createInitialState({ job: 'wall removal', quote: { budget: 10000, days: 14 } });
    const r = buildReport({ ...fresh, failure: 'giveup' });
    expect(r.outcome).toMatch(/contractor/i);
    expect(r.contractorBill).toEqual({
      rows: [
        { label: 'wall removal', cost: 13500, note: 'rush job' },
        { label: 'Call-out fee', cost: 250, note: 'you called' },
      ],
      total: 13750,
      quoted: 10000,
    });
    const started = buildReport({ ...fresh, failure: 'giveup', eventHistory: ['a'] });
    expect(started.contractorBill!.rows.map((x) => x.note)).toEqual(['rush job', 'fixing your fix', 'you called']);
    expect(started.contractorBill!.rows[1].cost).toBe(3000);
    expect(buildReport({ ...fresh, failure: 'budget' }).contractorBill).toBeNull();
    expect(buildReport({ ...fresh, completed: true }).contractorBill).toBeNull();
  });
});

describe('end report for every job', () => {
  // A noun that belongs to one job. A report for another job must not use it.
  const NOUNS = ['bathroom', 'faucet', 'dryer', 'carpet', 'caulk', 'basement', 'fixture', 'thermostat', 'toilet', 'paint', 'TV'];
  const endings = (job: string, quote: { budget: number; days: number }): Record<string, GameState> => {
    const base = { ...createInitialState({ job, quote }), eventHistory: ['a', 'b'] };
    const over = { spent: quote.budget * 1.5, daysElapsed: quote.days + 3 };
    return {
      giveup: { ...base, failure: 'giveup' },
      stress: { ...base, failure: 'stress', stress: 100 },
      budget: { ...base, failure: 'budget', spent: base.budget },
      time: { ...base, failure: 'time', daysElapsed: base.maxDays },
      under: { ...base, completed: true, spent: quote.budget * 0.8, daysElapsed: quote.days - 1 },
      fever: { ...base, completed: true, ...over, flags: ['scope-creep', 'scope-creep', 'upgrade-fever'] },
      risk: { ...base, completed: true, ...over, riskDebt: 60 },
      plain: { ...base, completed: true, ...over },
    };
  };

  it.each(PROJECT_DEFS.map((d) => [d.id, d] as const))('%s: every ending talks about this job and no other', (_id, def) => {
    for (const [name, s] of Object.entries(endings(def.job, def.quote))) {
      const r = buildReport(s);
      const text = [r.outcome, r.whyLine, r.achievement.title, r.achievement.text].join(' ');
      for (const noun of NOUNS) {
        if (def.job.toLowerCase().includes(noun.toLowerCase())) continue;
        expect(text, `${def.id}/${name} mentions "${noun}"`).not.toMatch(new RegExp(`\\b${noun}`, noun === 'TV' ? '' : 'i'));
      }
      expect(text, `${def.id}/${name}`).not.toMatch(/month|one day/i);
    }
  });

  it('names the job and the real limits where the ending depends on them', () => {
    const quote = { budget: 450, days: 2 };
    const e = endings('toilet replacement', quote);
    expect(buildReport(e.stress).outcome).toContain('toilet replacement');
    expect(buildReport(e.time).whyLine).toContain('2 days');
    expect(buildReport(e.time).achievement.text).toContain(`${e.time.maxDays} days`);
  });

  it('counts the contractor bill in the total after a give-up, and only then', () => {
    const fresh = createInitialState({ job: 'wall removal', quote: { budget: 10000, days: 14 } });
    const started = buildReport({ ...fresh, failure: 'giveup', eventHistory: ['a'], spent: 2000 });
    expect(started.actualCost).toBe(2000);
    expect(started.totalCost).toBe(2000 + started.contractorBill!.total); // 13500 + 3000 + 250 on top of the $2,000
    expect(started.overrunPct).toBe(Math.round(((started.totalCost - 10000) / 10000) * 100));
    expect(started.overrunPct).toBeGreaterThan(0);
    const noWork = buildReport({ ...fresh, failure: 'giveup' });
    expect(noWork.totalCost).toBe(13750);
    expect(noWork.overrunPct).toBe(38);
    const finished = buildReport({ ...fresh, completed: true, spent: 12000, daysElapsed: 10 });
    expect(finished.totalCost).toBe(12000);
    expect(finished.overrunPct).toBe(20);
    expect(buildReport({ ...fresh, completed: true, spent: 8000, daysElapsed: 10 }).overrunPct).toBe(-20);
  });
});
