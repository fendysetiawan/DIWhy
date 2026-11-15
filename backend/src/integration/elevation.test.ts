// @vitest-environment jsdom
// frontend/elevation.js, the real file: the prop kit drawn over the elevation view, and the
// `visual` column of the event files that names the props. Run with a recording fake canvas context.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

// One token grammar, the same as VISUAL_TOKEN in backend/src/content/csv.ts
const TOKEN_PART = /^[a-z0-9_-]+$/;
const TOKEN = /^([a-z0-9_-]+)(?::([a-z0-9_-]+))?@([a-z0-9_-]+)$/;
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
      expect(name).toMatch(TOKEN_PART);
      if (def.variants) for (const v of def.variants) expect(v).toMatch(TOKEN_PART);
    }
    expect(Object.keys(anchors).sort()).toEqual(['bath', 'dryer', 'wall']);
    for (const job of Object.values<any>(anchors)) {
      for (const [name, pt] of Object.entries<any>(job)) {
        expect(name).toMatch(TOKEN_PART);
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

  it('reads the same token grammar as the event loader: digits, hyphens and underscores are fine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ELEV.show(['smoke@dryer-2', 'thought:stack@a_b9']); // well formed, so no "unknown prop token" warning (they are skipped at draw time)
    expect(warn).not.toHaveBeenCalled();
    ELEV.show(['sm oke@dryer', 'smoke@Dryer', 'smoke@dry.er']);
    expect(warn).toHaveBeenCalledTimes(3);
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
    ELEV.clear();
    ELEV.burst('water');
    expect(() => ELEV.draw(fakeCtx().ctx, 'wall', 5)).not.toThrow();
    expect(() => ELEV.draw(fakeCtx().ctx, 'chimney', 5)).not.toThrow();
  });
});

describe('the blow-up burst', () => {
  /** The flash bar is the first thing the burst draws at u = 0: 30 px wide, centred on the burst. */
  const flashAt = (rects: Rect[]) => rects.find(([, , w, h]) => w === 30 && h === 3);

  it('is centred on the picture of the answered card, even after clear() and the next card', () => {
    ELEV.show(['smoke@vent']);
    ELEV.burst('dust'); // the link calls this before clear()
    ELEV.clear();
    ELEV.show(['cat@hose']); // the next card is up while the burst plays
    const f = fakeCtx();
    ELEV.draw(f.ctx, 'dryer', 5000);
    const [x, y] = ELEV.resolve('dryer', 'vent');
    expect(flashAt(f.rects), 'the flash is not on the vent').toEqual([x - 15, y - 1, 30, 3]);
    // still going 1.4 s later (the next card's typing time), gone after 1.5 s
    const late = fakeCtx();
    ELEV.draw(late.ctx, 'dryer', 6400);
    expect(late.shifts()).toBeGreaterThan(0);
    const done = fakeCtx();
    ELEV.draw(done.ctx, 'dryer', 6600);
    expect(done.shifts()).toBe(0);
    ELEV.clear();
  });

  it('falls back to the middle when the answered card had no picture', () => {
    ELEV.clear();
    ELEV.burst('water');
    const f = fakeCtx();
    ELEV.draw(f.ctx, 'dryer', 100);
    expect(flashAt(f.rects)).toEqual([325, 149, 30, 3]);
  });
});

/* Where each job's moving objects are, per scene step (index.html DRAW.dryer and DRAW.bath publish these as
   DIWHY_ELEV.scene). The wall job's scene has nothing that moves. Steps: dryer 0 old out, 1 hose off, 2 event,
   3 new in, 4 plug and vent, 5 push back; bath 0 shut off, 1 lift out, 2 event, 3 wax ring, 4 new drops in, 5 test. */
const SCENES: Record<string, Array<[string, any]>> = {
  wall: [['every step', {}]],
  dryer: [
    ['step 0 start', { dryerX: 300 }], ['step 0 end', { dryerX: 230 }], ['step 1', { dryerX: 230 }], ['step 2', { dryerX: 230 }],
    ['step 3 start', { dryerX: 230 }], ['step 3 middle (new one arriving)', { dryerX: 450 }], ['step 3 end', { dryerX: 316 }],
    ['step 4', { dryerX: 316 }], ['step 5 end', { dryerX: 300 }],
  ],
  bath: [
    ['step 0', { toilet: { x: 238, y: 250 } }], ['step 1 start', { toilet: { x: 238, y: 250 } }],
    ['step 1 lifting', { toilet: { x: 180, y: 237 } }], ['step 1 end (under the card)', { toilet: { x: 8, y: 200 } }],
    ['step 2', { toilet: null }], ['step 3', { toilet: null }],
    ['step 4 start (still up high)', { toilet: { x: 238, y: 40 } }], ['step 4 end', { toilet: { x: 238, y: 250 } }], ['step 5', { toilet: { x: 238, y: 250 } }],
  ],
};

describe('the pictures follow the moving objects', () => {
  const SPOT_FILES: Record<string, string> = { wall: 'wall_removal_events.csv', bath: 'toilet_replace_events.csv', dryer: 'dryer_replace_events.csv' };
  const tokensOf = (job: string): string[][] => {
    const table = parseCsv(readFileSync(join(EVENTS, SPOT_FILES[job]), 'utf8').replace(/^\uFEFF/, ''));
    const col = table[0].map((h) => h.trim()).indexOf('visual');
    return table.slice(1).map((r) => (r[col] ?? '').trim().split(/\s+/).filter(Boolean));
  };
  afterEach(() => {
    ELEV.scene = {};
    ELEV.clear();
  });

  for (const job of ['wall', 'bath', 'dryer']) {
    it(`${job}: every event's pictures stay on the canvas and clear of the card at every scene step`, () => {
      for (const [label, scene] of SCENES[job]) {
        ELEV.scene = scene;
        for (const tokens of tokensOf(job)) {
          for (const now of [0, 700]) {
            ELEV.show(tokens);
            const { ctx, rects } = fakeCtx();
            ELEV.draw(ctx, job, now);
            expect(rects.length, `${job} ${tokens} ${label}`).toBeGreaterThan(0);
            expectClear(rects, `${job} ${tokens} at ${label}`);
          }
        }
      }
    });
  }

  it('dryer: the smoke follows the dryer, old then new', () => {
    const at = (dryerX: number) => ((ELEV.scene = { dryerX }), ELEV.resolve('dryer', 'dryer'));
    expect(at(316)).toEqual([358, 150]); // the new dryer's middle
    expect(at(300)).toEqual([342, 150]);
    expect(at(230)).toEqual([280, 150]); // the old one is half under the card: its visible part
    ELEV.scene = {};
    expect(ELEV.resolve('dryer', 'dryer')).toEqual([340, 150]); // nothing published yet: the fixed anchor
  });

  it('dryer: the wall pictures sit on bare wall, above any dryer, the shelf lintel and the alcove', () => {
    const [x, y] = ELEV.resolve('dryer', 'wall');
    expect(y, 'the wall anchor must be above the alcove lintel (y 126) with room for a 48 px picture').toBeLessThan(100);
    expect(x).toBeGreaterThanOrEqual(288);
    expect(x).toBeLessThanOrEqual(396);
    // and the hose pictures sit where the hose meets the wall, near the vent
    const hose = ELEV.resolve('dryer', 'hose');
    const vent = ELEV.resolve('dryer', 'vent');
    expect(Math.abs(hose[0] - vent[0])).toBeLessThanOrEqual(12);
    expect(hose[1] - vent[1]).toBeLessThanOrEqual(40);
  });

  it('bath: the base and tank pictures stand on the toilet, and go to the flange while none stands', () => {
    const at = (toilet: any) => ((ELEV.scene = { toilet }), [ELEV.resolve('bath', 'base'), ELEV.resolve('bath', 'tank')]);
    const [base, tank] = at({ x: 238, y: 250 });
    expect(base[1]).toBe(226); // the bowl and base
    expect(tank[1]).toBe(196); // the tank
    expect(base[0]).toBeGreaterThanOrEqual(280);
    expect(base[0]).toBeLessThanOrEqual(294); // the toilet is 238 to 294 wide
    for (const gone of [null, { x: 8, y: 200 }, { x: 180, y: 237 }, { x: 238, y: 40 }]) {
      const [b, t] = at(gone);
      expect(b[1], 'with no toilet standing the base pictures sit on the floor, by the flange').toBeGreaterThanOrEqual(232);
      expect(t[1]).toBeGreaterThan(200);
    }
  });

  it('the page publishes where its moving objects are', () => {
    const page = readFileSync(join(FRONTEND, 'index.html'), 'utf8');
    for (const [name, field] of [['bath', 'toilet'], ['dryer', 'dryerX']]) {
      const from = page.indexOf(`  ${name}(step, t) {`);
      const body = page.slice(from, page.indexOf('\n  },', from));
      expect(body, `DRAW.${name} must publish DIWHY_ELEV.scene with ${field}`).toMatch(new RegExp(`DIWHY_ELEV\\.scene = \\{ ${field}:`));
    }
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
          const m = TOKEN.exec(tok);
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
