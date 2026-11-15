// The playable projects. Each has a contractor quote (the baseline the player is judged against),
// a pool of events, and a finale.
//
// Three come from plan/plan.md (open floor plan, bathroom leak, dryer). The rest are extra event
// files the team wrote. Event text lives in events/*.csv; the bathroom leak uses the original
// built-in events (src/data/events.ts).

import { EVENTS as BATHROOM_EVENTS, FINALE as BATHROOM_FINALE } from '../data/events';
import type { GameEvent, Quality } from '../engine/EventEngine';
import type { Quote } from '../engine/GameState';
import { parseEventRows, type CsvEventRow } from './csv';
import { buildEvents, calibrate, makeFinale } from './fromCsv';
import { LINKS } from './links';
import { WEIGHTS, type EventWeight } from './weights';

export interface ProjectDef {
  id: string;
  title: string; // what the player picks
  job: string; // short noun phrase for the report
  blurb: string;
  fromPlan: boolean;
  quote: Quote; // the contractor's quote: dollars and days
  file?: string; // events/<file>, absent for the built-in bathroom events
}

export interface Project extends Omit<ProjectDef, 'file'> {
  events: GameEvent[];
  finale: GameEvent;
  /** The data this project was built from. A game stores it, so editing a file never changes a running game. Absent for the built-in bathroom events. */
  source?: ProjectSource;
}

/** Everything a CSV-built project is made of, as plain JSON: text, answer keys, links, quote and weights. */
export interface ProjectSource {
  def: Omit<ProjectDef, 'file'>;
  rows: CsvEventRow[];
  links: Record<string, string[]>;
  weights?: Record<string, EventWeight>;
}

/** Build a project from its source. The one code path for new games and for games resumed from storage. */
export function projectFromSource(src: ProjectSource): Project {
  // JSON turns the `undefined` slots of hand-set numbers into null; put them back.
  const rows = src.rows.map((r) => ({
    ...r,
    costs: r.costs.map((n) => n ?? undefined) as CsvEventRow['costs'],
    days: r.days.map((n) => n ?? undefined) as CsvEventRow['days'],
  }));
  return {
    ...src.def,
    events: buildEvents(rows, src.links, calibrate(rows, src.def.quote), src.weights),
    finale: makeFinale(src.def.job, src.def.quote),
    source: src,
  };
}

export const PROJECT_DEFS: ProjectDef[] = [
  {
    id: 'wall-removal',
    title: 'Open up the floor plan',
    job: 'wall removal',
    blurb: 'Take out the wall between the kitchen and the living room. How load-bearing could it be?',
    fromPlan: true,
    quote: { budget: 10000, days: 14 },
    file: 'wall_removal_events.csv',
  },
  {
    id: 'bathroom-leak',
    title: 'Fix the bathroom leak',
    job: 'bathroom leak repair',
    blurb: 'A drip under the sink. One quick pipe fix, surely.',
    fromPlan: true,
    quote: { budget: 3500, days: 10 },
  },
  {
    id: 'dryer-replacement',
    title: 'Replace the smoking dryer',
    job: 'dryer replacement',
    blurb: 'It smoked once. It will smoke again. Swap it before the house notices.',
    fromPlan: true,
    quote: { budget: 1800, days: 3 },
    file: 'dryer_replace_events.csv',
  },
  {
    id: 'kitchen-faucet',
    title: 'Swap the kitchen faucet',
    job: 'kitchen faucet swap',
    blurb: 'One faucet. Two wrenches. What could be under there?',
    fromPlan: false,
    quote: { budget: 900, days: 2 },
    file: 'kitchen_faucet_events.csv',
  },
  {
    id: 'carpet-replacement',
    title: 'Replace the carpet',
    job: 'carpet replacement',
    blurb: 'Rip out the old carpet. Let the floor tell you its secrets.',
    fromPlan: false,
    quote: { budget: 4800, days: 5 },
    file: 'carpet_replace_events.csv',
  },
  {
    id: 'window-caulking',
    title: 'Re-caulk the windows',
    job: 'window re-caulking',
    blurb: 'A tube of caulk and a free Saturday. Famous last words.',
    fromPlan: false,
    quote: { budget: 1500, days: 3 },
    file: 'window_caulk_events.csv',
  },
  {
    id: 'finish-basement',
    title: 'Finish the basement',
    job: 'basement finishing',
    blurb: 'It is just a big empty room. Walls, a floor, a ceiling. How wet could it be?',
    fromPlan: false,
    quote: { budget: 18000, days: 21 },
    file: 'finish_basement_events.csv',
  },
  {
    id: 'light-fixture',
    title: 'Swap a light fixture',
    job: 'light fixture swap',
    blurb: 'Two wires and a bulb. Famous last words.',
    fromPlan: false,
    quote: { budget: 600, days: 2 },
    file: 'light_fixture_events.csv',
  },
  {
    id: 'mount-tv',
    title: 'Mount the TV',
    job: 'TV mounting',
    blurb: 'Find the studs, drill four holes, hang the screen. What is behind the wall?',
    fromPlan: false,
    quote: { budget: 450, days: 2 },
    file: 'mount_tv_events.csv',
  },
  {
    id: 'paint-room',
    title: 'Paint the room',
    job: 'room painting',
    blurb: 'A weekend, a roller and a nice color. The old paint has opinions.',
    fromPlan: false,
    quote: { budget: 900, days: 3 },
    file: 'paint_room_events.csv',
  },
  {
    id: 'smart-thermostat',
    title: 'Install a smart thermostat',
    job: 'smart thermostat install',
    blurb: 'It says "easy install" on the box. The box has never seen your wiring.',
    fromPlan: false,
    quote: { budget: 400, days: 2 },
    file: 'smart_thermostat_events.csv',
  },
  {
    id: 'toilet-replacement',
    title: 'Replace the toilet',
    job: 'toilet replacement',
    blurb: 'The old toilet runs all night. A new one is a one-hour job.',
    fromPlan: false,
    quote: { budget: 450, days: 2 }, // the front end estimates one day; a game needs at least two
    file: 'toilet_replace_events.csv',
  },
];

// How good each answer is in the built-in bathroom events, in option order.
const BATHROOM_QUALITIES: Record<string, Quality[]> = {
  'valve-stuck': ['wrong', 'good', 'ok'],
  'corroded-pipes': ['wrong', 'good', 'wrong'],
  'hidden-water-damage': ['good', 'excessive', 'wrong'],
  'outdated-wiring': ['good', 'ok', 'wrong'],
  'contractor-delay': ['ok', 'good', 'wrong'],
  'upgrade-vanity': ['excessive', 'ok', 'good'],
  'replace-tile': ['excessive', 'ok', 'good'],
  'heated-floors': ['excessive', 'ok', 'good'],
  'upgrade-lighting': ['excessive', 'ok', 'good'],
  'while-were-at-it': ['ok', 'excessive', 'good'],
  'inspiration-photos': ['excessive', 'ok', 'good'],
  'tile-discontinued': ['ok', 'excessive', 'good'],
  finale: ['ok', 'good'],
};

const withQualities = (e: GameEvent): GameEvent => ({
  ...e,
  choices: e.choices.map((c, i) => ({ ...c, quality: BATHROOM_QUALITIES[e.id]?.[i] ?? c.quality })),
});

function bathroomProject(def: ProjectDef): Project {
  const { file: _file, ...rest } = def;
  return { ...rest, events: BATHROOM_EVENTS.map(withQualities), finale: withQualities(BATHROOM_FINALE) };
}

/** Just the built-in bathroom project. Needs no files, which is what tests and demos use. */
export function builtInProjects(): Project[] {
  return [bathroomProject(PROJECT_DEFS.find((d) => d.id === 'bathroom-leak')!)];
}

/**
 * Build every project. `files` maps an event file name (as in events/) to its text, so this stays
 * free of file access. A missing file is an error: the game should not start half-built.
 */
export function buildProjects(files: Record<string, string>): Project[] {
  return PROJECT_DEFS.map((def): Project => {
    if (!def.file) return bathroomProject(def);
    const text = files[def.file];
    if (text === undefined) throw new Error(`events/${def.file} not found (needed by project "${def.id}")`);
    const rows = parseEventRows(text, `events/${def.file}`);
    const links = LINKS[def.id] ?? {};
    for (const parent of Object.values(links).flat().concat(Object.keys(links))) {
      if (!rows.some((r) => r.id === parent)) throw new Error(`links for "${def.id}" mention "${parent}", which is not in events/${def.file}`);
    }
    const { file: _file, ...rest } = def;
    return projectFromSource({ def: rest, rows, links, weights: WEIGHTS[def.id] });
  });
}
