// A character: one of the DIY-ers standing in a level (you, later the partner, the neighbour…). It walks and reaches things.

import type { Level } from '../engine/Level';
import type { Actor } from './Actor';
import type { Act } from '../../shared/game';
import type { CharacterData } from '../state/characters';

/** Which way a character looks; it picks the sprite (left.svg, idle-front.svg…). */
export type Facing = 'front' | 'back' | 'left' | 'right';

const SIZE = 120; // a character's box, in level units
const SPEED = 230; // level units per second
const REACH = 70; // how close something must be to use it

export class Character {
  readonly el = document.createElement('img');
  walking = false;
  /** Trying to walk, but something's in the way. */
  bumping = false;
  /** What they're acting out while standing (looking at their phone…), or null. */
  private acting: Act | null = null;

  constructor(
    readonly data: CharacterData,
    public x: number,
    public y: number,
    public facing: Facing,
  ) {
    this.el.className = 'character';
    this.el.alt = '';
    this.draw();
  }

  /** Walk for dt seconds in direction (vx, vy), each -1, 0 or 1. Slides along walls; (0, 0) stands still. */
  walk(vx: number, vy: number, dt: number, level: Level): void {
    if (vx === 0 && vy === 0) {
      this.walking = false;
      this.bumping = false;
    } else {
      const len = Math.hypot(vx, vy);
      const nx = clamp(this.x + (vx / len) * SPEED * dt, 40, level.size.w - 40);
      const ny = clamp(this.y + (vy / len) * SPEED * dt, 110, level.size.h - 30);
      const was = { x: this.x, y: this.y };
      if (!level.isBlocked(nx, this.y)) this.x = nx;
      if (!level.isBlocked(this.x, ny)) this.y = ny;
      this.facing = vx < 0 ? 'left' : vx > 0 ? 'right' : vy < 0 ? 'back' : 'front';
      this.walking = this.x !== was.x || this.y !== was.y; // against a wall: stand
      this.bumping = !this.walking;
    }
    this.draw();
  }

  /** Act something out while standing (null: just stand). Walking stops it. */
  act(act: Act | null): void {
    if (act === this.acting) return;
    this.acting = act;
    this.draw();
  }

  /** The actor you can use within reach, if any. */
  reach(actors: Actor[]): Actor | undefined {
    return actors.find((a) => a.hint && a.measureDistance(this.x, this.y) < REACH);
  }

  /** The standing, walking or acting sprite, facing the right way, with the feet at (x, y). */
  private draw(): void {
    const acting = this.acting && !this.walking ? this.acting : null;
    const src = acting ? this.data.act(acting) : this.walking ? this.data.walk(this.facing) : this.data.idle(this.facing);
    if (!this.el.src.endsWith(src)) this.el.src = src;
    // every sprite is cut from a 160 x 160 frame: walking and standing from x 47, y 19 (67 x 140), acting x 14, y 8 (135 x 144)
    const [cx, cy, cw, ch] = acting ? [14, 8, 135, 144] : [47, 19, 67, 140];
    const k = SIZE / 160;
    Object.assign(this.el.style, {
      left: `${this.x - SIZE / 2 + cx * k}px`,
      top: `${this.y - SIZE * 0.95 + cy * k}px`,
      width: `${cw * k}px`,
      height: `${ch * k}px`,
      zIndex: String(Math.round(this.y)), // lower on screen = in front
    });
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
