import { describe, expect, it } from 'vitest';
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
