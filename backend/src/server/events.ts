// Reads the team's event files (events/*.csv) from disk and builds the playable projects.
// This is the one place the backend touches those files.
//
// The result is cached by file modification time, so editing a CSV changes the next NEW game
// without restarting the server. A game already in progress keeps playing the events it started
// with, unless an event it needs was removed (then the API says "start a new game").

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildProjects, type Project } from '../content/projects';

/** The repo root: where events/, assets/ and frontend/ live. Set DIWHY_ROOT to override. */
export const repoRoot = (env: Record<string, string | undefined> = process.env) =>
  env.DIWHY_ROOT ?? join(process.cwd(), '..');

export function projectSource(eventsDir: string): () => Project[] {
  let stamp = '';
  let cached: Project[] = [];

  return () => {
    const names = readdirSync(eventsDir).filter((f) => f.endsWith('.csv')).sort();
    const next = names.map((f) => `${f}:${statSync(join(eventsDir, f)).mtimeMs}`).join('|');
    if (next !== stamp) {
      const files = Object.fromEntries(names.map((f) => [f, readFileSync(join(eventsDir, f), 'utf8')]));
      try {
        cached = buildProjects(files);
        stamp = next;
      } catch (err) {
        // A broken edit must not take down a running game. Keep the last good version, if any.
        if (cached.length === 0) throw err;
        console.error(`DIWhy: events/ has an error, still using the previous version.\n  ${(err as Error).message}`);
        stamp = next;
      }
    }
    return cached;
  };
}
