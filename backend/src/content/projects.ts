// The playable projects. Each has a contractor quote (the baseline the player is judged against),
// a pool of events, and a finale.
//
// Three come from plan/plan.md (open floor plan, bathroom leak, dryer). The rest are extra event
// files the team wrote. Event text lives in events/*.csv; the bathroom leak uses the original
// built-in events (src/data/events.ts).

import { EVENTS as BATHROOM_EVENTS, FINALE as BATHROOM_FINALE } from '../data/events';
import type { GameEvent, Quality } from '../engine/EventEngine';
import type { Quote } from '../engine/GameState';
import { parseEventRows } from './csv';
import { buildEvents, calibrate, makeFinale } from './fromCsv';
import { LINKS } from './links';

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
    return {
      ...rest,
      events: buildEvents(rows, links, calibrate(rows, def.quote)),
      finale: makeFinale(def.job, def.quote),
    };
  });
}
