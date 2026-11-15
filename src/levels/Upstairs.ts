// Upstairs: three bedrooms and a bathroom, up the stairs from the ground floor. Ramy's cottage (legacy/frontend/game/house.js).

import stairs from '@audio/effects/walking-on-wood.mp3';
import hum from '@audio/effects/clock-ticking-sfx.mp3';
import type { Actor } from '../actors/Actor';
import { Door } from '../actors/Door';
import { Prop } from '../actors/Prop';
import { Surface } from '../actors/Surface';
import { type Spot, Level } from '../engine/Level';

export class Upstairs extends Level {
  static key = 'Upstairs';

  size = { w: 1600, h: 900 };
  start: Spot = { x: 900, y: 372, facing: 'front' }; // at the top of the stairs
  actors: Actor[] = [
    new Prop({ name: 'outside', x: 0, y: 0, w: 1600, h: 901, flat: true, solid: false }), // the dark round the house

    // floors: one wood floor for the whole level (so rooms meet without a seam), the other rooms, then the rugs
    new Surface({ name: 'bedroom', x: 260, y: 131, w: 540, h: 329, type: 'carpet' }),
    new Surface({ name: 'second-bedroom', x: 260, y: 459, w: 540, h: 353, type: 'carpet' }),
    new Surface({ name: 'wood-floor', x: 800, y: 131, w: 200, h: 681, type: 'wood' }),
    new Surface({ name: 'bathroom', x: 1000, y: 131, w: 341, h: 270, type: 'tile' }),
    new Surface({ name: 'third-bedroom', x: 1000, y: 401, w: 341, h: 411, type: 'carpet' }),
    new Surface({ name: 'runner', x: 862, y: 420, w: 77, h: 300, type: 'carpet' }),

    // furniture
    new Prop({ name: 'bed-1', x: 393, y: 138, w: 179, h: 168 }),
    new Prop({ name: 'nightstand-1', x: 344, y: 141, w: 47, h: 47, sound: hum }),
    new Prop({ name: 'nightstand-2', x: 576, y: 141, w: 47, h: 47 }),
    new Prop({ name: 'wardrobe-1', x: 743, y: 138, w: 48, h: 219 }),
    new Prop({ name: 'dresser-1', x: 270, y: 399, w: 125, h: 48 }),
    new Prop({ name: 'bed-2', x: 449, y: 629, w: 153, h: 174 }),
    new Prop({ name: 'nightstand-3', x: 393, y: 755, w: 47, h: 47 }),
    new Prop({ name: 'nightstand-4', x: 611, y: 755, w: 47, h: 47 }),
    new Prop({ name: 'wardrobe-2', x: 744, y: 564, w: 47, h: 239 }),
    new Prop({ name: 'dresser-2', x: 270, y: 473, w: 125, h: 48 }),
    new Door({ name: 'stairs-down', x: 845, y: 135, w: 111, h: 198, solid: true, label: 'STAIRS', does: 'GO DOWN', to: 'Ground', at: { x: 900, y: 372, facing: 'front' }, useSound: stairs }),
    new Prop({ name: 'vanity', x: 1010, y: 138, w: 93, h: 51 }),
    new Prop({ name: 'toilet', x: 1154, y: 138, w: 42, h: 63 }),
    new Prop({ name: 'shower', x: 1228, y: 138, w: 104, h: 174 }),
    new Prop({ name: 'wardrobe-3', x: 1004, y: 410, w: 327, h: 44 }),
    new Prop({ name: 'bed-3', x: 1139, y: 558, w: 192, h: 134 }),
    new Prop({ name: 'desk', x: 1189, y: 758, w: 143, h: 65 }),

    // walls (the gaps between them are the doorways)
    new Prop({ name: 'wall-back', x: 249, y: 119, w: 1102, h: 27 }),
    new Prop({ name: 'wall-left', x: 249, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-right', x: 1333, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-front', x: 249, y: 803, w: 1102, h: 26 }),
    new Prop({ name: 'wall-0', x: 792, y: 119, w: 15, h: 254 }),
    new Prop({ name: 'wall-1', x: 792, y: 449, w: 15, h: 23 }),
    new Prop({ name: 'wall-2', x: 792, y: 548, w: 15, h: 273 }),
    new Prop({ name: 'wall-3', x: 264, y: 452, w: 531, h: 23 }),
    new Prop({ name: 'wall-4', x: 992, y: 119, w: 15, h: 104 }),
    new Prop({ name: 'wall-5', x: 992, y: 299, w: 15, h: 158 }),
    new Prop({ name: 'wall-6', x: 992, y: 528, w: 15, h: 293 }),
    new Prop({ name: 'wall-7', x: 1004, y: 393, w: 332, h: 21 }),
  ];
}
