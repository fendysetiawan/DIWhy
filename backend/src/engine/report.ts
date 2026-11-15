// Turns a finished game into the end-of-game report and a humorous achievement.
// Pure functions, no DOM.

import { flagCount, type GameState } from './GameState';

/** What the contractor charges to take over. Only set when the player gave up. */
export interface ContractorBill {
  rows: { label: string; cost: number; note: string }[];
  total: number;
  quoted: number; // the original quote, for comparison
}

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
  contractorBill: ContractorBill | null; // null unless the player gave up
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const RUSH_FACTOR = 1.35;
const TOUCH_UP_FACTOR = 0.3;
const CALL_OUT_FEE = 250;
const toTens = (n: number) => Math.round(n / 10) * 10;

/** The contractor's bill: the job at a rush price, a touch-up if the player started it, and a call-out fee. */
function contractorBill(s: GameState): ContractorBill {
  const rows: ContractorBill['rows'] = [{ label: s.job, cost: toTens(s.quote.budget * RUSH_FACTOR), note: 'rush job' }];
  if (s.eventHistory.length > 0) {
    rows.push({ label: s.job, cost: toTens(s.quote.budget * TOUCH_UP_FACTOR), note: 'fixing your fix' });
  }
  rows.push({ label: 'Call-out fee', cost: CALL_OUT_FEE, note: 'you called' });
  return { rows, total: rows.reduce((t, r) => t + r.cost, 0), quoted: s.quote.budget };
}

export function buildReport(s: GameState): Report {
  const quote = s.quote;
  const fever = flagCount(s, 'upgrade-fever') + flagCount(s, 'scope-creep');
  const overrunPct = Math.round(((s.spent - quote.budget) / quote.budget) * 100);

  let outcome: string;
  let why: string;
  let achievement: Report['achievement'];

  if (s.failure === 'giveup') {
    outcome = 'You called the contractor. They sighed loudly and fixed it all.';
    why = 'It looked easier in the video.';
    achievement = {
      title: 'The contractor fixed everything',
      text: `You gave up, and the contractor's bill came to ${money(contractorBill(s).total)}.`,
    };
  } else if (s.failure === 'stress') {
    outcome = 'You hit 100 stress and walked out of the bathroom for good.';
    why = 'Nobody knows. Least of all you.';
    achievement = {
      title: 'Meltdown in aisle seven',
      text: 'Your stress hit 100 before your faucet hit the sink.',
    };
  } else if (s.failure === 'budget') {
    outcome = `The ${money(s.budget)} limit ran out before the ${s.job} was done.`;
    why = 'To save money. The irony is not lost on anyone.';
    achievement = {
      title: 'Financially renovated',
      text: `You turned the contractor's ${money(quote.budget)} ${s.job} into a ${money(s.spent)} money pit. And it still isn't done.`,
    };
  } else if (s.failure === 'time') {
    outcome = `${s.maxDays} days came and went. The ${s.job} is still not done.`;
    why = 'The video said it would take one day.';
    achievement = {
      title: 'Is it done yet?',
      text: 'Somewhere, a contractor is "just finishing up". He has been for a month.',
    };
  } else if (s.spent <= quote.budget && s.daysElapsed <= quote.days) {
    outcome = 'The job is done, and so is your dignity.';
    why = 'Because, for once, it really was a good idea.';
    achievement = {
      title: 'Beat the contractor',
      text: `You finished under the contractor's ${money(quote.budget)} and ${quote.days} days. They'd like to know your secret.`,
    };
  } else if (fever >= 3) {
    outcome = 'The job is done. So is almost everything else.';
    why = '"While we\'re at it" is a powerful phrase.';
    achievement = {
      title: "While we're at it...",
      text: `You turned the contractor's ${money(quote.budget)} ${s.job} into a ${money(s.spent)} whole-house renovation.`,
    };
  } else if (s.riskDebt >= 50) {
    outcome = 'It works. For now.';
    why = 'It was working, mostly. That felt like enough.';
    achievement = {
      title: 'The duct tape engineer',
      text: 'Everything is held together by optimism. Do not look behind the wall.',
    };
  } else {
    outcome = 'The job is done and the house survived.';
    why = 'How hard could it be?';
    achievement = {
      title: 'The optimist',
      text: 'You believed every contractor estimate. Somehow it worked out. Mostly.',
    };
  }

  return {
    estimate: quote.budget,
    actualCost: s.spent,
    plannedDays: quote.days,
    actualDays: s.daysElapsed,
    overrunPct,
    problems: s.problems,
    stress: s.stress,
    outcome,
    whyLine: `Why did you do it yourself? ${why}`,
    achievement,
    contractorBill: s.failure === 'giveup' ? contractorBill(s) : null,
  };
}
