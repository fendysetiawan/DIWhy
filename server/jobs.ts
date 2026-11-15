// The DIY jobs. Each is one folder, jobs/<id>/: a job.json with everything about it (title, where its spot is, the
// contractor's price, its steps, its surprises, its WeTube video and AskBot chat, its set, and, if it isn't there from
// the start, when it appears) next to its pictures (backdrop.png, the set's moving pieces, a sign.svg). To add a job,
// add a folder. This file reads them all and checks every one when the server starts, saying exactly what's wrong.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Prep, Quality, Role, Step, Surprise } from '../shared/game';
import { ACTS, ROLES } from '../shared/game';

/** A surprise, with how good each option is (the app never sees that). */
export interface Event extends Surprise {
  answers: Quality[];
}

interface Job {
  id: string;
  title: string;
  level: string;
  quote: { days: number; money: number };
  steps: Step[];
  events: Event[];
  prep: Prep;
  /** A job that isn't there at the start: it appears on a day, or after another job is done; `from` texts you about it
   * (`news` says what they saw); `sign` shows sign.svg at its spot until you start on it. */
  appears?: { day?: number; after?: string; from?: Role; news?: string; sign?: boolean };
}

/** A job.json, as written. */
interface JobFile extends Omit<Job, 'events' | 'prep'>, Prep {
  spot: { x: number; y: number; w: number; h: number };
  surprises: { title: string; description: string; options: { text: string; quality: Quality; cost: number }[] }[];
  set: { name: string }[];
}

/** The tools the jobs need (tools.json): each with a cheap, a right and a premium option. */
export const TOOLS: Record<string, { name: string; options: { name: string; price: number; quality: 'cheap' | 'right' | 'premium'; pitch: string }[]; askbot: number }> =
  JSON.parse(readFileSync(new URL('./tools.json', import.meta.url), 'utf8'));

const FOLDER = new URL('../jobs/', import.meta.url);
const EFFECTS = new URL('../src/assets/audio/effects/', import.meta.url);
const LEVELS = ['Yard', 'Ground', 'Upstairs', 'Basement'];
const QUALITIES = ['good', 'ok', 'wrong', 'excessive'];

const files: JobFile[] = readdirSync(FOLDER, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => JSON.parse(readFileSync(new URL(`${d.name}/job.json`, FOLDER), 'utf8')));

/** Everything that's wrong with a job's folder (nothing, ideally). */
function check(job: JobFile): string[] {
  const has = (file: string) => existsSync(new URL(`${job.id}/${file}`, FOLDER));
  const problems = [
    !LEVELS.includes(job.level) && `there's no level "${job.level}"`,
    !job.spot && 'no "spot" (where it is in its level)',
    !has('backdrop.png') && 'no backdrop.png',
    ...job.set.map((p) => !has(`${p.name}.png`) && `no ${p.name}.png (a piece of its set)`),
    ...job.steps.flatMap((s) => [
      !(ACTS as readonly string[]).includes(s.act) && `step "${s.name}": there's no act "${s.act}"`,
      !existsSync(new URL(`${s.sound}.mp3`, EFFECTS)) && `step "${s.name}": no sound src/assets/audio/effects/${s.sound}.mp3`,
      s.tool && !TOOLS[s.tool] && `step "${s.name}": no tool "${s.tool}" in tools.json`,
    ]),
    ...job.surprises.flatMap((s) => s.options.map((o) => !QUALITIES.includes(o.quality) && `surprise "${s.title}": "${o.quality}" isn't good, ok, wrong or excessive`)),
    ...job.surprises.flatMap((s) => s.options.map((o) => !(Number.isInteger(o.cost) && o.cost >= 0) && `surprise "${s.title}": "${o.text}" needs a "cost" (whole dollars)`)),
    job.appears?.from && !(job.appears.from in ROLES) && `appears from "${job.appears.from}": there's no such role`,
    job.appears?.after && !files.some((j) => j.id === job.appears?.after) && `appears after "${job.appears.after}": there's no such job`,
    job.appears?.sign && !has('sign.svg') && "appears with a sign, but there's no sign.svg",
    (!job.video || !job.ask) && 'no "video" or "ask" (its WeTube video and AskBot chat)',
  ];
  return problems.filter((p): p is string => typeof p === 'string');
}

const problems = files.flatMap((job) => check(job).map((p) => `jobs/${job.id}: ${p}`));
if (problems.length) throw new Error(`Some jobs need fixing:\n${problems.join('\n')}`);

export const JOBS: Job[] = files.map((job) => ({
  id: job.id,
  title: job.title,
  level: job.level,
  quote: job.quote,
  steps: job.steps,
  appears: job.appears,
  prep: { video: job.video, ask: job.ask },
  events: job.surprises.map((s) => ({
    title: s.title,
    description: s.description,
    options: s.options.map((o) => o.text),
    costs: s.options.map((o) => o.cost),
    answers: s.options.map((o) => o.quality),
  })),
}));
