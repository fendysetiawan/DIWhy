// The DIY jobs' art and where they are, read straight from their folders (jobs/<id>/: job.json and its pictures), like
// characters.ts is the characters'. The rules about jobs are the server's; this is only what the app draws: each job's
// spot in its level, its set (a backdrop and the pieces that move), and its sign.

/** How a set's piece moves (style.css, "sets", has each one). Some take a distance in art pixels. */
type Animation = 'wobble' | 'shake' | 'drip' | 'drift' | 'ripple' | 'blink' | 'flicker' | 'sway' | 'swing' | 'sweep' | 'orbit' | 'flutter';

interface Piece {
  name: string;
  /** Where it goes on the backdrop, in art pixels (the backdrop is 480 x 270). */
  x: number;
  y: number;
  w: number;
  h: number;
  animate: Animation;
  /** How far it goes (art pixels): a drop's fall, a swing's reach, an orbit's radius. */
  reach?: number;
  /** Seconds per loop. */
  every?: number;
}

/** What the app needs from a job.json. */
interface JobArt {
  id: string;
  level: string;
  spot: { x: number; y: number; w: number; h: number };
  set: Piece[];
}

const FILES = import.meta.glob<JobArt>('../../jobs/*/job.json', { eager: true, import: 'default' });
const PICTURES = import.meta.glob<string>('../../jobs/*/*.{png,svg}', { eager: true, query: '?url', import: 'default' });

/** Every job's art, in no particular order. */
export const JOBS: JobArt[] = Object.values(FILES);

/** A job's picture (backdrop, a piece, sign), or a loud error if it's missing. */
export function findJobPicture(job: string, file: string): string {
  const url = PICTURES[`../../jobs/${job}/${file}`];
  if (!url) throw new Error(`Missing picture: jobs/${job}/${file}`);
  return url;
}

/** A job's set, as HTML: the backdrop, and its pieces over it (placed in art pixels, so it scales with the set). */
export function drawSet(job: string): string {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const pieces = (JOBS.find((j) => j.id === job)?.set ?? [])
    .map((p) => {
      const style = [
        `left: ${pct(p.x, 480)}`,
        `top: ${pct(p.y, 270)}`,
        `width: ${pct(p.w, 480)}`,
        `height: ${pct(p.h, 270)}`,
        p.reach ? `--reach: ${p.reach}` : '',
        p.every ? `--every: ${p.every}s` : '',
      ].filter(Boolean);
      return `<img class="set-piece ${p.animate}" src="${findJobPicture(job, `${p.name}.png`)}" alt="" style="${style.join('; ')}" />`;
    })
    .join('');
  return `<div class="set" aria-hidden="true"><img class="set-backdrop" src="${findJobPicture(job, 'backdrop.png')}" alt="" />${pieces}</div>`;
}
