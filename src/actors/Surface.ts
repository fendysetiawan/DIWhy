// A surface: something you walk on (grass, a path, a porch). It lies under everyone, and walking on it
// plays its type's footsteps. It only counts where its picture is painted, so a curvy path is a curvy path.

import carpet from '@audio/effects/footsteps-carpet.wav';
import grass from '@audio/effects/footsteps-grass.wav';
import gravel from '@audio/effects/footsteps-gravel.mp3';
import stone from '@audio/effects/running-on-concrete.mp3';
import tile from '@audio/effects/footsteps-tile.wav';
import wood from '@audio/effects/footsteps-wood.mp3';
import type { Character } from './Character';
import type { Level } from '../engine/Level';
import { Actor, type ActorConfig } from './Actor';

/** What a surface is made of. Each type has its footsteps. */
type SurfaceType = 'grass' | 'gravel' | 'stone' | 'wood' | 'tile' | 'carpet';
const FOOTSTEPS: Record<SurfaceType, string> = { grass, gravel, stone, wood, tile, carpet };

export class Surface extends Actor {
  readonly type: SurfaceType;
  /** Which pixels of its picture are painted, once it has loaded. */
  private pixels?: ImageData;

  constructor(config: ActorConfig & { type: SurfaceType }) {
    super({ ...config, flat: true });
    this.type = config.type;
  }

  override addTo(level: Level): void {
    super.addTo(level);
    this.el.addEventListener('load', () => (this.pixels ??= readPixels(this.el)), { once: true });
  }

  /** Is it painted at (x, y)? */
  covers(x: number, y: number): boolean {
    if (this.measureDistance(x, y) > 0) return false;
    if (!this.pixels) return true;
    const px = Math.floor(((x - this.x) / this.w) * this.pixels.width);
    const py = Math.floor(((y - this.y) / this.h) * this.pixels.height);
    return this.pixels.data[(py * this.pixels.width + px) * 4 + 3] > 0;
  }

  override onWalk(_who: Character): void {
    this.level.sound.setFootsteps(FOOTSTEPS[this.type]);
  }
}

function readPixels(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}
