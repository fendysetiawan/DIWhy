// The basement: the furnace, the laundry, a workbench, boxes. Down the stairs from the ground floor's hall.
// Ramy's cottage (legacy/frontend/game/house.js).

import stairs from '@audio/effects/walking-on-wood.mp3';
import hum from '@audio/effects/air-vent.mp3';
import type { Actor } from '../actors/Actor';
import { Door } from '../actors/Door';
import { Prop } from '../actors/Prop';
import { Surface } from '../actors/Surface';
import { type Spot, Level } from '../engine/Level';

export class Basement extends Level {
  static key = 'Basement';

  size = { w: 1600, h: 900 };
  start: Spot = { x: 900, y: 700, facing: 'front' }; // at the foot of the stairs
  actors: Actor[] = [
    new Prop({ name: 'outside', x: 0, y: 0, w: 1600, h: 901, flat: true, solid: false }), // the dark round the house

    // floors: one wood floor for the whole level (so rooms meet without a seam), the other rooms, then the rugs
    new Surface({ name: 'basement', x: 258, y: 131, w: 1082, h: 681, type: 'stone' }),
    new Surface({ name: 'laundry', x: 650, y: 500, w: 350, h: 312, type: 'tile' }),

    // what's down here
    new Prop({ name: 'furnace', x: 299, y: 149, w: 93, h: 93, sound: hum }),
    new Prop({ name: 'water-heater', x: 419, y: 161, w: 65, h: 65 }),
    new Prop({ name: 'shelf', x: 269, y: 399, w: 33, h: 92 }),
    new Prop({ name: 'boxes', x: 698, y: 149, w: 132, h: 65 }),
    new Prop({ name: 'workbench', x: 299, y: 738, w: 219, h: 53 }),
    new Prop({ name: 'boxes-2', x: 1178, y: 738, w: 87, h: 60 }),
    new Prop({ name: 'couch', x: 1028, y: 179, w: 164, h: 63 }),
    new Door({ name: 'stairs-up', x: 845, y: 518, w: 111, h: 153, solid: true, label: 'STAIRS', does: 'GO UP', to: 'Ground', at: { x: 900, y: 700, facing: 'front' }, useSound: stairs }),
    new Prop({ name: 'sink', x: 671, y: 749, w: 63, h: 53 }),
    new Prop({ name: 'washer', x: 788, y: 746, w: 81, h: 62 }),
    new Prop({ name: 'dryer', x: 889, y: 746, w: 81, h: 62 }),

    // walls (the gaps between them are the doorways)
    new Prop({ name: 'wall-back', x: 249, y: 119, w: 1102, h: 27 }),
    new Prop({ name: 'wall-left', x: 249, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-right', x: 1333, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-front', x: 249, y: 803, w: 1102, h: 26 }),
    new Prop({ name: 'wall-0', x: 642, y: 119, w: 15, h: 263 }),
    new Prop({ name: 'wall-1', x: 642, y: 468, w: 15, h: 134 }),
    new Prop({ name: 'wall-2', x: 642, y: 689, w: 15, h: 132 }),
    new Prop({ name: 'wall-3', x: 264, y: 492, w: 158, h: 23 }),
    new Prop({ name: 'wall-4', x: 509, y: 492, w: 137, h: 23 }),
    new Prop({ name: 'wall-5', x: 992, y: 492, w: 15, h: 110 }),
    new Prop({ name: 'wall-6', x: 992, y: 689, w: 15, h: 132 }),
  ];
}
