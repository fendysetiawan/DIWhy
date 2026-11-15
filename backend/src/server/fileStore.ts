// A GameStore that keeps one JSON file per game, so games survive a server restart.
// It lives in server/ because only that layer may touch the disk.
//
// The per-game lock in GameService is in-process, so run one server per directory.

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GameRecord, GameStore } from '../service/store';

export interface FileStoreOptions {
  dir: string;
  maxGames?: number; // oldest games are dropped beyond this. Default 1000.
  ttlMs?: number; // games idle longer than this are dropped. Default 7 days.
  now?: () => number;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const FORMAT_VERSION = 1;
const SWEEP_EVERY = 50; // sets between housekeeping sweeps
const STALE_TMP_MS = 60_000;
const RETRY_MS = [20, 50, 100, 250, 500]; // for a file another process (a virus scanner, an editor) holds for a moment
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const code = (e: unknown) => (e as NodeJS.ErrnoException | undefined)?.code;

/** Run a file operation again, with a growing pause, while the file is only busy. */
async function retrying<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (err) {
      if (!TRANSIENT.has(code(err) ?? '') || attempt >= RETRY_MS.length) throw err;
      await sleep(RETRY_MS[attempt]);
    }
  }
}

export class FileGameStore implements GameStore {
  private dir: string;
  private maxGames: number;
  private ttlMs: number;
  private now: () => number;
  private sets = 0;
  private swept = false;
  private sweeping: Promise<void> | null = null;
  private warned = new Set<string>();

  constructor(opts: FileStoreOptions) {
    this.dir = opts.dir;
    this.maxGames = opts.maxGames ?? 1000;
    this.ttlMs = opts.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.now = opts.now ?? Date.now;
  }

  async get(id: string): Promise<GameRecord | undefined> {
    if (!ID_PATTERN.test(id)) return undefined;
    await this.firstSweep();
    const rec = await this.read(this.path(id));
    if (rec && this.expired(rec)) {
      await rm(this.path(id), { force: true });
      return undefined;
    }
    return rec;
  }

  async set(record: GameRecord): Promise<void> {
    if (!ID_PATTERN.test(record.id)) throw new Error(`invalid game id "${record.id}"`);
    await mkdir(this.dir, { recursive: true });
    await this.firstSweep();
    const target = this.path(record.id);
    const tmp = `${target}.${Math.random().toString(36).slice(2, 10)}.tmp`;
    await writeFile(tmp, JSON.stringify({ v: FORMAT_VERSION, record }));
    try {
      await this.renameWithRetry(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    if (++this.sets % SWEEP_EVERY === 0) this.sweepInBackground(); // housekeeping never holds up a request
  }

  async delete(id: string): Promise<boolean> {
    if (!ID_PATTERN.test(id)) return false;
    try {
      await stat(this.path(id));
    } catch {
      return false;
    }
    await rm(this.path(id), { force: true });
    return true;
  }

  /** Delete expired games, stale temp files and the oldest games beyond the cap. Goes by file times, so no game is parsed. */
  async sweep(): Promise<void> {
    if (this.sweeping) return this.sweeping; // one at a time
    this.sweeping = this.doSweep().finally(() => (this.sweeping = null));
    return this.sweeping;
  }

  private sweepInBackground(): void {
    this.sweep().catch((err) => console.warn(`[fileStore] sweep failed: ${String(err)}`));
  }

  private async doSweep(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return;
    }
    const now = Date.now(); // file times are the real clock's
    const games: { file: string; at: number }[] = [];
    for (const name of names) {
      const isTmp = name.endsWith('.tmp');
      if (!isTmp && !/^game-.+\.json$/.test(name)) continue;
      const file = join(this.dir, name);
      const st = await stat(file).catch(() => undefined);
      if (!st) continue;
      if (isTmp) {
        if (now - st.mtimeMs > STALE_TMP_MS) await rm(file, { force: true });
      } else if (now - st.mtimeMs > this.ttlMs) {
        await rm(file, { force: true });
      } else {
        games.push({ file, at: st.mtimeMs });
      }
    }
    games.sort((a, b) => a.at - b.at || (a.file < b.file ? -1 : 1));
    for (const g of games.slice(0, Math.max(0, games.length - this.maxGames))) await rm(g.file, { force: true });
  }

  private path(id: string): string {
    return join(this.dir, `game-${id}.json`);
  }

  private expired(rec: GameRecord): boolean {
    return this.now() - rec.updatedAt > this.ttlMs;
  }

  private async firstSweep(): Promise<void> {
    if (this.swept) return;
    this.swept = true;
    await this.sweep();
  }

  private async read(file: string): Promise<GameRecord | undefined> {
    let text: string;
    try {
      text = await this.readWithRetry(file);
    } catch (err) {
      if (code(err) === 'ENOENT') return undefined;
      throw err; // a file we could not read is not a game that is gone: the caller gets a 500 and can try again
    }
    try {
      const data = JSON.parse(text) as { v?: unknown; record?: GameRecord };
      if (data.v === FORMAT_VERSION && data.record && typeof data.record === 'object') return data.record;
      this.warnOnce(file, 'unknown format');
    } catch {
      this.warnOnce(file, 'not valid JSON');
    }
    return undefined;
  }

  private warnOnce(file: string, why: string): void {
    if (this.warned.has(file)) return;
    this.warned.add(file);
    console.warn(`[fileStore] ignoring ${file}: ${why}`);
  }

  private renameWithRetry(from: string, to: string): Promise<void> {
    return retrying(() => rename(from, to));
  }

  private readWithRetry(file: string): Promise<string> {
    return retrying(() => readFile(file, 'utf8'));
  }
}
