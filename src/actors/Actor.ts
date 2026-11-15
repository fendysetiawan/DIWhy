// An actor: anything placed in a level (Surface, Prop, Door). A picture in a box that reacts to you
// through onWalk (you walk on it) and onUse (Enter, close by).

import type { Character } from './Character';
import { findPicture, type Level } from '../engine/Level';

export interface ActorConfig {
  /** What it is. Its pictures are <name>-day.png and <name>-night.png in assets/art/levels/<level>/. */
  name: string;
  /** Where its picture goes, in level units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** You can't walk through it. */
  solid?: boolean;
  /** A sound it makes all the time (a hum, a tick): louder the closer you are. */
  sound?: string;
  /** The sound of using it (a door creaking). */
  useSound?: string;
  /** It has no picture of its own: a spot on the art (a job's place). */
  hidden?: boolean;
  /** It lies on the ground (a floor, a rug, a doorstep): drawn under everyone. */
  flat?: boolean;
}

export class Actor {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly solid: boolean;
  readonly hidden: boolean;
  readonly sound?: string;
  readonly useSound?: string;
  /** Lies on the ground: drawn under everyone. (Otherwise it stands in front of whatever is behind it.) */
  readonly flat: boolean;
  /** The hint over it, if you can use it. */
  hint?: { name: string; does: string; job?: boolean };
  /** Its picture on screen. */
  readonly el = new Image();
  /** The level it's in, once added. */
  protected level!: Level;

  constructor(config: ActorConfig) {
    this.name = config.name;
    this.x = config.x;
    this.y = config.y;
    this.w = config.w;
    this.h = config.h;
    this.solid = config.solid ?? false;
    this.hidden = config.hidden ?? false;
    this.sound = config.sound;
    this.useSound = config.useSound;
    this.flat = config.flat ?? false;
  }

  /** Put it in a level: size and stack its picture. */
  addTo(level: Level): void {
    this.level = level;
    this.el.className = 'piece';
    this.el.hidden = this.hidden;
    this.el.alt = '';
    Object.assign(this.el.style, {
      left: `${this.x}px`,
      top: `${this.y}px`,
      width: `${this.w}px`,
      height: `${this.h}px`,
      zIndex: this.flat ? '0' : String(this.y + this.h),
    });
  }

  /** Show its day or night picture. */
  showTime(night: boolean): void {
    if (this.hidden) return;
    this.el.src = findPicture(this.level.key, `${this.name}-${night ? 'night' : 'day'}.png`);
  }

  /** How far (x, y) is from its box (0 when inside). */
  measureDistance(x: number, y: number): number {
    const dx = Math.max(this.x - x, 0, x - (this.x + this.w));
    const dy = Math.max(this.y - y, 0, y - (this.y + this.h));
    return Math.hypot(dx, dy);
  }

  /** The player is walking on it (every frame while they do). */
  onWalk(_who: Character): void {}

  /** The player pressed Enter close to it. */
  onUse(_who: Character): void {}
}
