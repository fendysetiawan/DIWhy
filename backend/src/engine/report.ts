// Turns a finished game into the end-of-game report and a humorous achievement.
// Pure functions, no DOM.

import { ESTIMATE, ESTIMATED_DAYS, MAX_DAYS, flagCount, type GameState } from './GameState';

export interface Report {
  estimate: number;
  actualCost: number;
  plannedDays: number;
  actualDays: number;
  overrunPct: number;
  problems: number;
  stress: number;
  outcome: string; // one line: how it ended
  whyLine: string; // the DIWhy closer: "Why did you do it yourself?" and the answer
  achievement: { title: string; text: string };
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function buildReport(s: GameState): Report {
  const fever = flagCount(s, 'upgrade-fever');
  const overrunPct = Math.round(((s.spent - ESTIMATE) / ESTIMATE) * 100);

  let outcome: string;
  let why: string;
  let achievement: Report['achievement'];

  if (s.failure === 'stress') {
    outcome = 'You hit 100 stress and walked out of the bathroom for good.';
    why = 'Nobody knows. Least of all you.';
    achievement = {
      title: 'Meltdown in aisle seven',
      text: 'Your stress hit 100 before your faucet hit the sink.',
    };
  } else if (s.failure === 'budget') {
    outcome = `The ${money(s.budget)} budget ran out before the faucet went in.`;
    why = 'To save money. The irony is not lost on anyone.';
    achievement = {
      title: 'Financially renovated',
      text: `You turned a ${money(ESTIMATE)} faucet replacement into a ${money(s.spent)} money pit. Without a working faucet.`,
    };
  } else if (s.failure === 'time') {
    outcome = `${MAX_DAYS} days came and went. The faucet is still in its box.`;
    why = 'The video said it would take one day.';
    achievement = {
      title: 'Is it done yet?',
      text: 'Somewhere, a contractor is "just finishing up". He has been for a month.',
    };
  } else if (s.spent <= 400 && s.daysElapsed <= 3) {
    outcome = 'The faucet is in, and so is your dignity.';
    why = 'Because, for once, it really was a good idea.';
    achievement = {
      title: 'Against all odds',
      text: 'You actually finished on budget. Please buy a lottery ticket.',
    };
  } else if (fever >= 3) {
    outcome = 'The faucet is in. So is almost everything else.';
    why = '"While we\'re at it" is a powerful phrase.';
    achievement = {
      title: "While we're at it...",
      text: `You turned a ${money(ESTIMATE)} faucet replacement into a ${money(s.spent)} bathroom renovation.`,
    };
  } else if (s.riskDebt >= 50) {
    outcome = 'It works. For now.';
    why = 'It was working, mostly. That felt like enough.';
    achievement = {
      title: 'The duct tape engineer',
      text: 'Everything is held together by optimism. Do not look behind the wall.',
    };
  } else {
    outcome = 'The faucet is in and the bathroom survived.';
    why = 'How hard could it be?';
    achievement = {
      title: 'The optimist',
      text: 'You believed every contractor estimate. Somehow it worked out. Mostly.',
    };
  }

  return {
    estimate: ESTIMATE,
    actualCost: s.spent,
    plannedDays: ESTIMATED_DAYS,
    actualDays: s.daysElapsed,
    overrunPct,
    problems: s.problems,
    stress: s.stress,
    outcome,
    whyLine: `Why did you do it yourself? ${why}`,
    achievement,
  };
}
