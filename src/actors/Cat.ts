// The cat: it lives in the house and does what it likes. It wanders from spot to spot, then sits, eats, naps or plots
// for a while; walk right up to it and it gets a fright. Nobody controls it.

import type { Level } from '../engine/Level';

const POSES = import.meta.glob<string>('../assets/art/characters/cat/*.svg', { eager: true, query: '?url', import: 'default' });
type Pose = 'standing' | 'normal' | 'sitting' | 'sleepy' | 'eating' | 'mischievous' | 'scared';
const pose = (name: Pose) => POSES[`../assets/art/characters/cat/${name}.svg`];

const W = 78; // its picture, in level units (52 x 36 art pixels, 1.5 units each)
const H = 54;
const SPEED = 60; // level units per second: a slow amble
const SKITTISH = 60; // you this close: it gets a fright
const RESTS: Pose[] = ['normal', 'sitting', 'sleepy', 'eating', 'mischievous'];

export class Cat {
  readonly el = document.createElement('img');
  private target: { x: number; y: number } | null = null;
  /** Seconds left of what it's doing (resting, or the fright). */
  private busy = 8;
  private posing: Pose = 'sitting';
  private left = false;

  constructor(
    private x: number,
    private y: number,
  ) {
    this.el.className = 'character cat';
    this.el.alt = '';
    this.draw();
  }

  /** Every frame: walk to where it's going, or rest; a fright if you're too close. */
  update(dt: number, level: Level, you: { x: number; y: number }): void {
    if (Math.hypot(you.x - this.x, you.y - this.y) < SKITTISH && this.posing !== 'scared') {
      this.target = null;
      this.busy = 1.5;
      this.posing = 'scared';
    }
    if (this.target) this.walk(dt, level);
    else {
      this.busy -= dt;
      if (this.busy <= 0) this.pickTarget(level);
    }
    this.draw();
  }

  private walk(dt: number, level: Level): void {
    const target = this.target;
    if (!target) return;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const far = Math.hypot(dx, dy);
    const step = Math.min(far, SPEED * dt);
    const nx = this.x + (dx / far) * step;
    const ny = this.y + (dy / far) * step;
    if (far < 2 || level.isBlocked(nx, ny)) {
      this.rest(); // there, or something's in the way: good enough
      return;
    }
    this.left = dx < 0;
    this.x = nx;
    this.y = ny;
  }

  /** Somewhere not too far away it can stand. */
  private pickTarget(level: Level): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = this.x + (Math.random() - 0.5) * 300;
      const y = this.y + (Math.random() - 0.5) * 180;
      if (x > 40 && y > 110 && x < level.size.w - 40 && y < level.size.h - 30 && !level.isBlocked(x, y)) {
        this.target = { x, y };
        this.posing = 'standing';
        return;
      }
    }
    this.rest();
  }

  private rest(): void {
    this.target = null;
    this.busy = 15 + Math.random() * 25; // a cat mostly stays put
    this.posing = RESTS[Math.floor(Math.random() * RESTS.length)];
  }

  /** Its pose, facing the way it walks, with its feet at (x, y). */
  private draw(): void {
    const src = pose(this.posing);
    if (!this.el.src.endsWith(src)) this.el.src = src;
    Object.assign(this.el.style, {
      left: `${this.x - W / 2}px`,
      top: `${this.y - H + 4}px`,
      width: `${W}px`,
      height: `${H}px`,
      transform: this.left ? 'scaleX(-1)' : '',
      zIndex: String(Math.round(this.y)),
    });
  }
}
