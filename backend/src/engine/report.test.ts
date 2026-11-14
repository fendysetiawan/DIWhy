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
});
