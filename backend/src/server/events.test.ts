import { copyFileSync, mkdtempSync, readdirSync, utimesSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { projectSource } from './events';

const real = new URL('../../../events/', import.meta.url).pathname;

/** A temp copy of the team's events folder that the test can edit. */
function copyOfEvents() {
  const dir = mkdtempSync(join(tmpdir(), 'diwhy-events-'));
  for (const f of readdirSync(real).filter((x) => x.endsWith('.csv'))) copyFileSync(join(real, f), join(dir, f));
  return dir;
}
const bump = (file: string) => {
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
};

describe('projectSource', () => {
  it('builds every project from the real folder', () => {
    expect(projectSource(real)().map((p) => p.id)).toHaveLength(12);
  });

  it('returns the same projects until a file changes', () => {
    const get = projectSource(copyOfEvents());
    expect(get()).toBe(get());
  });

  it('picks up an edited event file without a restart', () => {
    const dir = copyOfEvents();
    const get = projectSource(dir);
    const before = get().find((p) => p.id === 'dryer-replacement')!;
    expect(before.events.find((e) => e.id === 'dryer_smokes')!.title).toBe('Dryer starts smoking');

    const file = join(dir, 'dryer_replace_events.csv');
    writeFileSync(file, readFileSync(file, 'utf8').replace('Dryer starts smoking', 'Dryer starts SMOKING A LOT'));
    bump(file);
    const after = get().find((p) => p.id === 'dryer-replacement')!;
    expect(after.events.find((e) => e.id === 'dryer_smokes')!.title).toBe('Dryer starts SMOKING A LOT');
  });

  it('keeps the last good version when an edit breaks a file, and says why', () => {
    const dir = copyOfEvents();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const get = projectSource(dir);
    const good = get();
    const file = join(dir, 'wall_removal_events.csv');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"good,wrong,excessive"', '"good,wrong,splendid"'));
    bump(file);
    expect(get()).toBe(good); // the running game is not taken down
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"splendid" is not a quality'));
    log.mockRestore();
  });

  it('refuses to start at all when the very first load is broken', () => {
    const dir = copyOfEvents();
    writeFileSync(join(dir, 'wall_removal_events.csv'), 'id,event\n1,2\n');
    expect(() => projectSource(dir)()).toThrow('missing column');
  });
});
