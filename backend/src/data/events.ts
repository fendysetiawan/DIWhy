// All event content lives here. The engine knows nothing about specific events.
//
// To add an event: append an object to EVENTS. See the README for a worked example.
//
// How events connect (nobody calls anybody; they just read and write state):
//   - Choices ADD FLAGS ('wall-open', 'new-tile', 'upgrade-fever' ...).
//   - Other events check flags in `eligible` (hard prerequisite) or `weight` (soft boost).
//   - Cutting corners adds riskDebt. riskDebt feeds into weights and gamble chances,
//     so shortcuts make the nasty events more likely later.

import { flagCount, hasFlag, type GameState } from '../engine/GameState';
import type { GameEvent } from '../engine/EventEngine';

const afterOpening = (s: GameState) => s.eventHistory.length > 0;
const fever = (s: GameState) => flagCount(s, 'upgrade-fever'); // "while we're at it" pressure
const cap = (n: number, max: number) => Math.min(max, n);

export const EVENTS: GameEvent[] = [
  // ---------------------------------------------------------------- problems
  {
    id: 'valve-stuck',
    kind: 'problem',
    title: "The shutoff valve won't close",
    description:
      'You watched a six-minute video called "Faucet swap: so easy!" You turn the little knob under the sink. It turns beautifully. Nothing else happens. The knob is now in your hand.',
    eligible: (s) => s.eventHistory.length === 0, // always the opening event
    weight: () => 100,
    choices: [
      {
        label: 'Force it',
        effects: { risk: 30, addFlags: ['valve-handled'] },
        result: 'You apply a wrench and the confidence of someone who watched one video.',
        gamble: {
          chance: (s) => cap(0.35 + s.riskDebt / 200, 0.9),
          effects: {
            cost: 180,
            days: 1,
            stress: 15,
            plumbing: -15,
            waterDamage: true,
            addFlags: ['broken-valve'],
          },
          result:
            'SNAP. The valve gives up. Water, briefly, goes everywhere. Emergency replacement valve: $180.',
        },
      },
      {
        label: 'Replace the valve',
        effects: { cost: 180, days: 1, risk: -10, plumbing: 10, addFlags: ['valve-handled'] },
        result: 'A new valve, installed correctly. It feels almost suspicious.',
      },
      {
        label: 'Call a plumber',
        effects: { cost: 450, days: 2, stress: -5, risk: -20, plumbing: 20, addFlags: ['valve-handled'] },
        result: 'The plumber arrives, sighs at the sink, and charges you for the sigh.',
      },
    ],
  },
  {
    id: 'corroded-pipes',
    kind: 'problem',
    title: 'The pipes are "vintage"',
    description:
      'The old pipes have the texture of a coral reef. The plumber calls it "character" and writes a number on his hand.',
    eligible: (s) => afterOpening(s) && !hasFlag(s, 'pipes-handled'),
    // Base 6, plus more for risk debt, an open wall, and worn plumbing.
    weight: (s) =>
      6 + s.riskDebt * 0.4 + (hasFlag(s, 'wall-open') ? 20 : 0) + (100 - s.house.plumbingCondition) * 0.2,
    choices: [
      {
        label: 'Patch it with sealant',
        effects: { cost: 80, risk: 20, plumbing: 5, addFlags: ['pipes-handled'] },
        result: 'A $12 clamp and a dream.',
        gamble: {
          chance: (s) => cap(0.1 + s.riskDebt / 250, 0.7),
          effects: { cost: 250, days: 1, stress: 10, waterDamage: true, addFlags: ['slow-leak'] },
          result: 'The patch holds for about nine minutes. Then there is a drip. Then a steady drip.',
        },
      },
      {
        label: 'Repipe the wall',
        effects: {
          cost: 1400,
          days: 3,
          stress: 5,
          risk: -25,
          plumbing: 60,
          addFlags: ['pipes-handled', 'wall-open'],
        },
        result: 'The wall is open, the pipes are new, and so is your respect for plumbers.',
      },
      {
        label: "Pretend you didn't see it",
        effects: { stress: -3, risk: 30, addFlags: ['pipes-handled'] },
        result: 'Ignorance is bliss. Pipes are somebody else\'s problem. Future you, specifically.',
        gamble: {
          chance: () => 0.35,
          effects: { stress: 8, waterDamage: true },
          result: 'Something behind the wall starts to weep. Quietly. Out of sight.',
        },
      },
    ],
  },
  {
    id: 'hidden-water-damage',
    kind: 'problem',
    title: 'Water damage, revealed',
    description:
      'The floor next to the tub gives a little. Then a lot. Beneath it: a science experiment with a lease.',
    // Hard prerequisite: something above must have actually caused water damage.
    eligible: (s) => s.house.waterDamage && !hasFlag(s, 'damage-handled') && s.eventHistory.length >= 2,
    weight: (s) => 45 + s.riskDebt * 0.5,
    choices: [
      {
        label: 'Dry it out and reseal',
        effects: { cost: 500, days: 3, risk: -10, waterDamage: false, addFlags: ['damage-handled'] },
        result: 'Fans, dehumidifiers, and three days of white noise. The floor survives.',
      },
      {
        label: 'Full remediation',
        effects: {
          cost: 2200,
          days: 6,
          stress: 10,
          risk: -30,
          plumbing: 10,
          waterDamage: false,
          addFlags: ['damage-handled'],
        },
        result: 'Everything damp is removed, replaced, and professionally disapproved of.',
      },
      {
        label: 'Paint over it',
        effects: { cost: 60, stress: -5, risk: 35, addFlags: ['damage-handled', 'painted-over'] },
        result: 'Fresh paint: nature\'s concealer.',
        gamble: {
          chance: () => 0.5,
          effects: { cost: 900, days: 3, stress: 20 },
          result: 'Mold. It is blooming right through the paint. It looks almost decorative.',
        },
      },
    ],
  },
  {
    id: 'outdated-wiring',
    kind: 'problem',
    title: 'The wiring is from 1974',
    description:
      'The electrician pulls off a cover plate and goes quiet. "Who did this?" he asks. Nobody knows. Nobody ever knows.',
    eligible: (s) => afterOpening(s) && !hasFlag(s, 'wiring-handled'),
    // Open walls and planned heated floors make the wiring more likely to come up.
    weight: (s) =>
      5 +
      (hasFlag(s, 'wall-open') ? 25 : 0) +
      (hasFlag(s, 'floors-need-wiring') ? 50 : 0) +
      s.riskDebt * 0.15 +
      (100 - s.house.electricalCondition) * 0.1,
    choices: [
      {
        label: 'Rewire it properly',
        effects: { cost: 900, days: 3, risk: -20, electrical: 55, addFlags: ['wiring-handled'] },
        result: 'Copper, conduit, and an inspector who actually smiles.',
      },
      {
        label: 'Add a GFCI outlet and move on',
        effects: { cost: 120, days: 1, risk: 15, electrical: 15, addFlags: ['wiring-handled'] },
        result: 'A little button that says "TEST". You press it. It says nothing.',
        gamble: {
          chance: (s) => cap(0.1 + s.riskDebt / 250, 0.6),
          effects: { cost: 300, days: 1, stress: 20 },
          result: 'Something sparked. Something else smoked. The breaker takes it personally.',
        },
      },
      {
        label: 'Leave it alone',
        effects: { risk: 30, addFlags: ['wiring-handled'] },
        result: 'If it has worked for 50 years, what could go wrong?',
        gamble: {
          chance: (s) => (hasFlag(s, 'floors-need-wiring') ? 0.6 : 0.25),
          effects: { cost: 400, days: 2, stress: 20 },
          result: 'The whole bathroom goes dark mid-shower. The electrician is already on his way. Slowly.',
        },
      },
    ],
  },
  {
    id: 'contractor-delay',
    kind: 'problem',
    title: 'Your contractor is "running a bit behind"',
    description:
      'You have not seen him in three days. His last text was a thumbs-up to a message you did not send.',
    eligible: (s) => afterOpening(s) && s.daysElapsed >= 1,
    weight: (s) => 8 + s.stress * 0.12, // stressed players get picked on more
    choices: [
      {
        label: 'Wait it out',
        effects: { days: 4, stress: 8 },
        result: 'Four days pass. The faucet sits in its box and judges you.',
      },
      {
        label: 'Pay a rush fee',
        effects: { cost: 350, days: 1, stress: 2 },
        result: 'Money talks. This time it talks fast.',
      },
      {
        label: 'Do it yourself',
        effects: { days: 2, stress: 15, risk: 20 },
        result: 'You watch eleven tutorials. You still own the wrong wrench.',
      },
    ],
  },

  // ------------------------------------------------------------- temptations
  {
    id: 'upgrade-vanity',
    kind: 'temptation',
    title: 'The vanity is looking a bit sad',
    description:
      'Next to the shiny new faucet, the old vanity looks like it has given up on life. A showroom catalog is open on the toilet.',
    eligible: afterOpening,
    weight: (s) => 9 + fever(s) * 6,
    choices: [
      {
        label: 'Buy the dreamy vanity',
        effects: { cost: 950, days: 1, stress: -5, addFlags: ['new-vanity', 'upgrade-fever'] },
        result: 'It is gorgeous. It also makes everything else in the room look worse.',
      },
      {
        label: 'Just swap the countertop',
        effects: { cost: 300, days: 1 },
        result: 'A little marble for the soul.',
      },
      {
        label: 'Keep the old vanity',
        effects: { stress: 3 },
        result: 'It is fine. It is FINE.',
      },
    ],
  },
  {
    id: 'replace-tile',
    kind: 'temptation',
    title: 'About that tile...',
    description:
      'Now that you are looking, the tile is beige in a way that feels personal. The showroom has 400 other options.',
    eligible: (s) => afterOpening(s) && !hasFlag(s, 'new-tile'),
    weight: (s) =>
      8 + fever(s) * 8 + (hasFlag(s, 'new-vanity') ? 10 : 0) + (hasFlag(s, 'wall-open') ? 10 : 0),
    choices: [
      {
        label: 'Premium Italian tile',
        effects: {
          cost: 1800,
          days: 4,
          stress: 5,
          addFlags: ['new-tile', 'tile-order', 'upgrade-fever'],
        },
        result: 'It ships from a small village. It will arrive "soon".',
      },
      {
        label: 'Budget tile from the big store',
        effects: { cost: 700, days: 2, risk: 5, addFlags: ['new-tile'] },
        result: 'It is tile. It is on sale. It is, technically, flat.',
      },
      {
        label: 'Keep the beige',
        effects: { stress: 3 },
        result: 'Beige is a lifestyle.',
      },
    ],
  },
  {
    id: 'heated-floors',
    kind: 'temptation',
    title: 'Heated floors: the gateway upgrade',
    description:
      'The tile guy mentions, casually, that this is "the only time" you can install heated floors. He says it with his whole face.',
    // Unlocked by choosing new tile.
    eligible: (s) => afterOpening(s) && hasFlag(s, 'new-tile'),
    weight: (s) => 30 + fever(s) * 5,
    choices: [
      {
        label: 'Install heated floors',
        effects: {
          cost: 2400,
          days: 4,
          stress: 5,
          addFlags: ['heated-floors', 'floors-need-wiring', 'upgrade-fever'],
        },
        result: 'Warm toes. Also, an electrician is suddenly very interested in your house.',
      },
      {
        label: 'Just a heated towel bar',
        effects: { cost: 350, days: 1, stress: -3 },
        result: 'A toasty towel is 80% of the experience for 15% of the price.',
      },
      {
        label: 'No thanks',
        effects: {},
        result: 'Cold feet are character-building.',
      },
    ],
  },
  {
    id: 'upgrade-lighting',
    kind: 'temptation',
    title: 'The lighting is, frankly, interrogation-grade',
    description:
      'One bare bulb, harsh as a police drama. The lighting store has a pendant shaped like a cloud.',
    eligible: afterOpening,
    weight: (s) => 7 + fever(s) * 6 + (hasFlag(s, 'new-vanity') ? 8 : 0),
    choices: [
      {
        label: 'Statement fixtures',
        effects: { cost: 420, days: 1, addFlags: ['new-lights', 'upgrade-fever'] },
        result: 'You now look 10 years younger in the mirror. The mirror charges extra.',
        gamble: {
          // Old wiring plus new fixtures is a bad mix.
          chance: (s) => (s.house.electricalCondition < 50 ? 0.35 : 0.05),
          effects: { cost: 150, days: 1, stress: 10 },
          result: 'You flip the switch and the whole house goes dark. Lighting is hard.',
        },
      },
      {
        label: 'Add a dimmer',
        effects: { cost: 90, stress: -3 },
        result: 'Mood lighting. For the mood you were already in.',
      },
      {
        label: 'Keep the bare bulb',
        effects: { stress: 2 },
        result: 'You wanted a bathroom, not a mood.',
      },
    ],
  },

  // ------------------------------------------------------------------ humor
  {
    id: 'while-were-at-it',
    kind: 'humor',
    title: '"While we\'re at it..."',
    description:
      'Your contractor leans on the doorframe with the smile of someone who just saw your budget. "It would be a shame not to..."',
    eligible: (s) => afterOpening(s) && s.daysElapsed >= 1,
    weight: (s) => 8 + fever(s) * 8,
    choices: [
      {
        label: 'Sure, open up the wall',
        effects: { cost: 300, days: 1, stress: 5, risk: -5, addFlags: ['wall-open'] },
        result: 'It is just a peek. Everyone knows what a peek costs.',
      },
      {
        label: "Let's do the whole bathroom",
        effects: {
          cost: 3500,
          days: 8,
          stress: 15,
          addFlags: ['upgrade-fever', 'upgrade-fever', 'whole-bath'],
        },
        result: 'You have never seen a contractor so happy. You also have never seen your bank balance so sad.',
      },
      {
        label: 'Just the faucet. Please.',
        effects: { stress: 8 },
        result: 'He sighs like a violin. You feel judged by a man holding a level.',
      },
    ],
  },
  {
    id: 'inspiration-photos',
    kind: 'humor',
    title: 'Your partner has discovered Pinterest',
    description:
      'Over dinner you are shown 47 photos of "spa-inspired" bathrooms. One has a fireplace. You did not agree to a fireplace.',
    eligible: afterOpening,
    weight: (s) => 9 + fever(s) * 3,
    choices: [
      {
        label: 'Say yes to the spa vibe',
        effects: { cost: 650, days: 2, stress: -12, addFlags: ['upgrade-fever'] },
        result: 'Peace at home is priceless. The invoice says $650.',
      },
      {
        label: 'Compromise: plants and art',
        effects: { cost: 180, stress: -6 },
        result: 'Three ferns and a framed print of a different bathroom.',
      },
      {
        label: 'Gently point out the project is a faucet',
        effects: { stress: 12 },
        result: 'The silence at dinner is expensive in other ways.',
      },
    ],
  },
  {
    id: 'tile-discontinued',
    kind: 'humor',
    title: 'The tile has been discontinued',
    description:
      'The showroom calls. Your tile "no longer exists in this world". There is a pause. "We do have a very similar one."',
    // Unlocked only if the player ordered premium tile.
    eligible: (s) => hasFlag(s, 'tile-order') && !hasFlag(s, 'tile-handled'),
    weight: () => 80,
    choices: [
      {
        label: 'Pick the "similar" one',
        effects: { days: 1, stress: 5, addFlags: ['tile-handled'] },
        result: 'It is basically the same, the way a cousin is basically a twin.',
      },
      {
        label: 'Special order from overseas',
        effects: { cost: 600, days: 7, stress: 10, addFlags: ['tile-handled'] },
        result: 'Your tile now travels by boat. It has seen more of the world than you.',
      },
      {
        label: 'Switch to budget tile',
        effects: { cost: -400, days: 1, stress: 8, addFlags: ['tile-handled'] },
        result: 'A partial refund, a lesson learned, and a very flat tile.',
      },
    ],
  },
];

/**
 * The ending. Never picked by a director: the engine shows it when the renovation has run
 * long enough (or nothing else can happen). Both choices finish the job.
 */
export const FINALE: GameEvent = {
  id: 'finale',
  kind: 'finale',
  title: 'Finally: install the faucet',
  description:
    'Every box is checked, every surprise survived. The faucet sits on the counter, exactly where it started. You are far too deep to ask why now. Who installs it?',
  eligible: () => false,
  weight: () => 0,
  choices: [
    {
      label: 'Install it yourself',
      effects: { days: 1, complete: true },
      result: 'Two turns of a wrench. How hard could it be?',
      gamble: {
        // Everything you skipped earlier comes due right here.
        chance: (s) =>
          cap(0.1 + s.riskDebt / 150 + (s.house.plumbingCondition < 50 ? 0.2 : 0) + (s.house.waterDamage ? 0.15 : 0), 0.85),
        effects: { cost: 350, days: 2, stress: 15 },
        result: 'It leaks. Of course it leaks. A tiny, confident drip. The plumber is back.',
      },
    },
    {
      label: 'Hire a pro for the install',
      effects: { cost: 200, days: 1, risk: -10, complete: true },
      result: 'Ten minutes and a signature. It works. It always works when someone else does it.',
    },
  ],
};
