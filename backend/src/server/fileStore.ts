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
const RENAME_RETRY_MS = [20, 50, 100];
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const code = (e: unknown) => (e as NodeJS.ErrnoException | undefined)?.code;

export class FileGameStore implements GameStore {
  private dir: string;
  private maxGames: number;
  private ttlMs: number;
  private now: () => number;
  private sets = 0;
  private swept = false;
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
    if (++this.sets % SWEEP_EVERY === 0) await this.sweep();
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

  /** Delete expired games, stale temp files and the oldest games beyond the cap. */
  async sweep(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return;
    }
    const now = this.now();
    const games: { file: string; updatedAt: number }[] = [];
    for (const name of names) {
      const file = join(this.dir, name);
      if (name.endsWith('.tmp')) {
        const st = await stat(file).catch(() => undefined);
        if (st && Date.now() - st.mtimeMs > STALE_TMP_MS) await rm(file, { force: true });
      } else if (/^game-.+\.json$/.test(name)) {
        const rec = await this.read(file);
        if (!rec) continue; // unreadable files are left alone (and warned about once)
        if (now - rec.updatedAt > this.ttlMs) await rm(file, { force: true });
        else games.push({ file, updatedAt: rec.updatedAt });
      }
    }
    games.sort((a, b) => a.updatedAt - b.updatedAt);
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
      text = await readFile(file, 'utf8');
    } catch (err) {
      if (code(err) !== 'ENOENT') this.warnOnce(file, String(err));
      return undefined;
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

  private async renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(from, to);
        return;
      } catch (err) {
        if (!TRANSIENT.has(code(err) ?? '') || attempt >= RENAME_RETRY_MS.length) throw err;
        await sleep(RENAME_RETRY_MS[attempt]);
      }
    }
  }
}
