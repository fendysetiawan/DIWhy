import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { realProjects } from '../testing';
import { GameService } from '../service/GameService';
import type { GameRecord } from '../service/store';
import type { GameView } from '../service/types';
import { FileGameStore } from './fileStore';

// Reads can be made to fail on demand: `readFailures` lists the error codes the next reads throw, in order.
const readFailures = vi.hoisted(() => [] as string[]);
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    readFile: (async (...args: Parameters<typeof real.readFile>) => {
      const code = readFailures.shift();
      if (code) throw Object.assign(new Error(code), { code });
      return real.readFile(...args);
    }) as typeof real.readFile,
  };
});

let dir: string;
let counter = 0;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'diwhy-games-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const svc = (opts: ConstructorParameters<typeof GameService>[0] = {}) =>
  new GameService({ newId: () => `g-${++counter}`, ...opts });
const record = (id: string, updatedAt: number) => ({ id, updatedAt }) as GameRecord;
const files = async () => (await readdir(dir)).sort();

async function playOut(s: GameService, id: string): Promise<GameView> {
  let v = await s.getGame(id);
  for (let i = 0; i < 30 && v.status === 'playing'; i++) {
    v = await s.choose(id, { choice: v.event!.choices.length - 1, eventId: v.event!.id });
  }
  return v;
}

describe('FileGameStore', () => {
  it('keeps the content a game started with, so another process can continue it', async () => {
    const projects = realProjects();
    const first = svc({ store: new FileGameStore({ dir }), projects });
    const g = await first.createGame({ seed: 7, project: 'toilet-replacement' });
    const second = svc({ store: new FileGameStore({ dir }) }); // knows only the built-in bathroom project
    expect((await second.getGame(g.id)).event!.id).toBe(g.event!.id);
    expect((await playOut(second, g.id)).status).not.toBe('playing');
  });

  it('gives the same games as the memory store', async () => {
    const norm = (v: GameView) => ({ ...v, id: '' });
    const memory = svc();
    const file = svc({ store: new FileGameStore({ dir }) });
    for (const seed of [5, 21, 99]) {
      const m = await playOut(memory, (await memory.createGame({ seed })).id);
      const f = await playOut(file, (await file.createGame({ seed })).id);
      expect(norm(f)).toEqual(norm(m));
    }
  });

  it('lets a new store and service continue a game', async () => {
    const first = svc({ store: new FileGameStore({ dir }) });
    const g = await first.createGame({ seed: 42 });
    const after = await first.choose(g.id, { choice: 1, eventId: g.event!.id });
    const second = svc({ store: new FileGameStore({ dir }) });
    expect(await second.getGame(g.id)).toEqual(after);
    const next = await second.choose(g.id, { choice: 0, eventId: after.event!.id });
    expect(next.stats.eventsDone).toBe(2);
  });

  it('leaves no temp files behind', async () => {
    const store = new FileGameStore({ dir });
    for (let i = 0; i < 30; i++) await store.set(record('a', Date.now()));
    expect(await files()).toEqual(['game-a.json']);
  });

  it('refuses invalid ids before touching the disk', async () => {
    const store = new FileGameStore({ dir });
    for (const id of ['../x', 'a/b', '', 'x'.repeat(81)]) {
      expect(await store.get(id)).toBeUndefined();
      expect(await store.delete(id)).toBe(false);
      await expect(store.set(record(id, Date.now()))).rejects.toThrow();
    }
    expect(await files()).toEqual([]);
  });

  it('reads a corrupt file as missing and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await writeFile(join(dir, 'game-bad.json'), '{ nope');
    await writeFile(join(dir, 'game-old.json'), JSON.stringify({ v: 2, record: {} }));
    const store = new FileGameStore({ dir });
    expect(await store.get('bad')).toBeUndefined();
    expect(await store.get('bad')).toBeUndefined();
    expect(await store.get('old')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('drops games idle past the ttl, and deletes their files', async () => {
    let clock = 1_000_000;
    const store = new FileGameStore({ dir, ttlMs: 100, now: () => clock });
    await store.set(record('a', clock));
    expect((await store.get('a'))?.id).toBe('a');
    clock += 101;
    expect(await store.get('a')).toBeUndefined();
    expect(await files()).toEqual([]);
  });

  it('keeps only the newest games beyond the cap', async () => {
    const store = new FileGameStore({ dir, maxGames: 3, now: () => 10_000 });
    for (let i = 1; i <= 5; i++) {
      await store.set(record(`g${i}`, 1000 + i));
      await utimes(join(dir, `game-g${i}.json`), new Date(Date.now() - (10 - i) * 1000), new Date(Date.now() - (10 - i) * 1000));
    }
    await store.sweep();
    expect(await files()).toEqual(['game-g3.json', 'game-g4.json', 'game-g5.json']);
  });

  it('returns true then false when deleting', async () => {
    const store = new FileGameStore({ dir });
    await store.set(record('a', Date.now()));
    expect(await store.delete('a')).toBe(true);
    expect(await store.delete('a')).toBe(false);
    expect(await store.get('a')).toBeUndefined();
  });

  it('retries a read that is only busy for a moment', async () => {
    const store = new FileGameStore({ dir });
    await store.set(record('a', Date.now()));
    readFailures.push('EBUSY', 'EPERM');
    expect((await store.get('a'))?.id).toBe('a');
  });

  it('fails loudly, not "not found", when a read keeps failing', async () => {
    const store = new FileGameStore({ dir });
    await store.set(record('a', Date.now()));
    readFailures.push(...Array(20).fill('EACCES'));
    await expect(store.get('a')).rejects.toThrow();
    readFailures.length = 0;
    expect((await store.get('a'))?.id).toBe('a'); // nothing was deleted or forgotten
    readFailures.push('EIO');
    await expect(store.get('a')).rejects.toThrow();
    readFailures.length = 0;
  });

  it('still reads a missing file as missing', async () => {
    expect(await new FileGameStore({ dir }).get('nobody')).toBeUndefined();
  });

  it('sweeps by file time without opening any game', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new FileGameStore({ dir, ttlMs: 60_000 });
    await writeFile(join(dir, 'game-old.json'), '{ not json');
    await writeFile(join(dir, 'game-new.json'), '{ not json either');
    const longAgo = new Date(Date.now() - 120_000);
    await utimes(join(dir, 'game-old.json'), longAgo, longAgo);
    await store.sweep();
    expect(await files()).toEqual(['game-new.json']);
    expect(warn).not.toHaveBeenCalled(); // nothing was parsed
  });

  it('does not make a request wait for the housekeeping sweep', async () => {
    const store = new FileGameStore({ dir });
    await store.set(record('first', Date.now())); // the first-use sweep happens here
    const sweep = vi.spyOn(store, 'sweep').mockImplementation(() => new Promise<void>(() => undefined)); // never ends
    for (let i = 0; i < 50; i++) await store.set(record('a', Date.now())); // would hang on the 50th if it waited
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  it('warns, and keeps serving, when a background sweep fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new FileGameStore({ dir });
    await store.set(record('first', Date.now()));
    vi.spyOn(store, 'sweep').mockRejectedValue(new Error('disk gone'));
    for (let i = 0; i < 50; i++) await store.set(record('a', Date.now()));
    await new Promise((r) => setTimeout(r, 10));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sweep failed'));
  });
});
