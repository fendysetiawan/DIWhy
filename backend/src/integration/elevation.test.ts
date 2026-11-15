// @vitest-environment jsdom
// frontend/elevation.js, the real file: the prop kit drawn over the elevation view, and the
// `visual` column of the event files that names the props. Run with a recording fake canvas context.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parseCsv } from '../content/csv';
import { PROJECT_DEFS } from '../content/projects';

const FRONTEND = join(process.cwd(), '..', 'frontend'); // tests run from backend/
const EVENTS = join(process.cwd(), '..', 'events');
const W = 533;
const H = 300;

type Rect = [number, number, number, number];
let ELEV: any;

/** A canvas context that only remembers the rectangles it was asked to fill. */
function fakeCtx() {
  const rects: Rect[] = [];
  let shifts = 0;
  const ctx: any = {
    fillStyle: '',
    canvas: {},
    fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]),
    drawImage: () => shifts++,
  };
  return { ctx, rects, shifts: () => shifts };
}

const inCardZone = (x: number, y: number) => x < 256 && y > 144;
/** Props never touch the bottom-left corner, where the event card sits, and never leave the canvas. */
function expectClear(rects: Rect[], label: string) {
  for (const [x, y, w, h] of rects) {
    expect(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(w) && Number.isInteger(h), `${label}: whole pixels`).toBe(true);
    expect(x >= 0 && y >= 0 && x + w <= W && y + h <= H, `${label}: rect ${[x, y, w, h]} is outside the canvas`).toBe(true);
    if (w > 0 && h > 0) {
      const hitsCard = x < 256 && y + h > 144;
      expect(hitsCard, `${label}: rect ${[x, y, w, h]} is under the event card`).toBe(false);
    }
  }
  expect(inCardZone(300, 200)).toBe(false);
}

beforeAll(() => {
  const script = readFileSync(join(FRONTEND, 'elevation.js'), 'utf8');
  (0, eval)(script);
  ELEV = (window as any).DIWHY_ELEV;
});

describe('the prop kit', () => {
  it('is well formed', () => {
    expect(typeof ELEV.show).toBe('function');
    expect(typeof ELEV.draw).toBe('function');
    expect(typeof ELEV.burst).toBe('function');
    expect(typeof ELEV.clear).toBe('function');
    const { props, anchors } = ELEV.KIT;
    expect(Object.keys(props).length).toBeGreaterThanOrEqual(30);
    for (const [name, def] of Object.entries<any>(props)) {
      expect(name).toMatch(/^[a-z]+$/);
      if (def.variants) for (const v of def.variants) expect(v).toMatch(/^[a-z]+$/);
    }
    expect(Object.keys(anchors).sort()).toEqual(['bath', 'dryer', 'wall']);
    for (const job of Object.values<any>(anchors)) {
      for (const [name, pt] of Object.entries<any>(job)) {
        expect(name).toMatch(/^[a-z]+$/);
        const [x, y] = pt;
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
        expect(x >= 24 && x <= W - 24 && y >= 24 && y <= H - 24, `${name} keeps a prop on the canvas`).toBe(true);
        expect(x >= 280 || y <= 120, `${name} at ${pt} is under the event card`).toBe(true);
      }
    }
  });

  for (const job of ['wall', 'bath', 'dryer']) {
    it(`draws every prop at every anchor of ${job}, clear of the card`, () => {
      const { props, anchors } = ELEV.KIT;
      for (const anchor of Object.keys(anchors[job])) {
        for (const [name, def] of Object.entries<any>(props)) {
          for (const variant of def.variants ?? [null]) {
            const token = `${name}${variant ? ':' + variant : ''}@${anchor}`;
            for (const now of [0, 333, 1234]) {
              ELEV.show([token]);
              const { ctx, rects } = fakeCtx();
              expect(() => ELEV.draw(ctx, job, now), token).not.toThrow();
              expect(rects.length, `${token} drew nothing`).toBeGreaterThan(0);
              expectClear(rects, `${job} ${token} t=${now}`);
            }
          }
        }
      }
      ELEV.clear();
    });
  }

  it('draws nothing for a job it has no anchors for, and after clear()', () => {
    ELEV.show(['smoke@dryer']);
    let f = fakeCtx();
    ELEV.draw(f.ctx, 'chimney', 0);
    expect(f.rects.length).toBe(0);
    ELEV.draw(f.ctx, 'dryer', 0);
    expect(f.rects.length).toBeGreaterThan(0);
    ELEV.clear();
    f = fakeCtx();
    ELEV.draw(f.ctx, 'dryer', 0);
    expect(f.rects.length).toBe(0);
  });

  it('ignores junk tokens without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const junk = ['', 'smoke', 'nope@dryer', 'smoke@nowhere', 'thought:zzz@ceiling', '@', 'smoke@', '::@@', null, undefined, 42, 'SMOKE@dryer'];
    expect(() => ELEV.show(junk)).not.toThrow();
    expect(() => ELEV.show('smoke@dryer  scorch@wall')).not.toThrow();
    // a token whose anchor belongs to another job is skipped at draw time, not an error
    ELEV.show(['smoke@opening', 'scorch@wall']);
    const { ctx, rects } = fakeCtx();
    expect(() => ELEV.draw(ctx, 'dryer', 10)).not.toThrow();
    expect(rects.length).toBeGreaterThan(0);
    expect(() => ELEV.draw(null, 'dryer', 10)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    ELEV.clear();
  });

  it('plays a burst for about 1.5 seconds, then stops', () => {
    for (const kind of ['water', 'sparks', 'dust', undefined, 'nonsense']) {
      ELEV.show(['smoke@dryer']);
      ELEV.burst(kind);
      let f = fakeCtx();
      expect(() => ELEV.draw(f.ctx, 'dryer', 1000)).not.toThrow();
      const during = f.rects.length;
      f = fakeCtx();
      expect(() => ELEV.draw(f.ctx, 'dryer', 1400)).not.toThrow();
      expect(f.shifts()).toBeGreaterThan(0); // the screen shakes
      f = fakeCtx();
      ELEV.draw(f.ctx, 'dryer', 3000);
      expect(f.shifts()).toBe(0);
      expect(f.rects.length).toBeLessThan(during);
      ELEV.clear();
    }
    // a burst with nothing shown, and in a job without anchors
    ELEV.burst('water');
    expect(() => ELEV.draw(fakeCtx().ctx, 'wall', 5)).not.toThrow();
    expect(() => ELEV.draw(fakeCtx().ctx, 'chimney', 5)).not.toThrow();
  });
});

describe('the visual column of the event files', () => {
  // The page's spots (the elevation job ids) -> the project each one starts: SPOT_PROJECT in game-link.js.
  const spotProject: Record<string, string> = JSON.parse(
    /const SPOT_PROJECT = (\{[^}]*\})/.exec(readFileSync(join(FRONTEND, 'game-link.js'), 'utf8'))![1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'),
  );
  const FILES: Array<[string, string]> = Object.entries(spotProject).map(([job, project]) => [PROJECT_DEFS.find((d) => d.id === project)!.file!, job]);

  it('covers the three reachable jobs', () => {
    expect(FILES.map(([, job]) => job).sort()).toEqual(['bath', 'dryer', 'wall']);
  });

  for (const [file, job] of FILES) {
    it(`${file}: every row names props the kit can draw for ${job}`, () => {
      const table = parseCsv(readFileSync(join(EVENTS, file), 'utf8').replace(/^﻿/, ''));
      const col = table[0].map((h) => h.trim()).indexOf('visual');
      expect(col, `${file} needs a visual column`).toBeGreaterThan(-1);
      expect(table.length).toBeGreaterThan(1);
      const { props, anchors } = ELEV.KIT;
      for (const row of table.slice(1)) {
        const tokens = (row[col] ?? '').trim().split(/\s+/).filter(Boolean);
        expect(tokens.length, `${file} ${row[0]}: needs at least one visual token`).toBeGreaterThan(0);
        for (const tok of tokens) {
          const m = /^([a-z]+)(?::([a-z]+))?@([a-z]+)$/.exec(tok);
          expect(m, `${file} ${row[0]}: "${tok}" is not prop[:variant]@anchor`).not.toBeNull();
          const [, prop, variant, anchor] = m!;
          expect(props[prop], `${file} ${row[0]}: unknown prop "${prop}"`).toBeDefined();
          if (variant) expect(props[prop].variants ?? [], `${file} ${row[0]}: unknown variant "${variant}"`).toContain(variant);
          expect(anchors[job][anchor], `${file} ${row[0]}: "${anchor}" is not an anchor of ${job}`).toBeDefined();
        }
      }
    });
  }
});
