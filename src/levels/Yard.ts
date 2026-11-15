// The yard: where the game starts. Ramy's yard (legacy/frontend/game/yard.js), cut into its actors.

import creak from '@audio/effects/creaky-old-door.mp3';
import { type Spot, Level } from '../engine/Level';
import { Door } from '../actors/Door';
import type { Actor } from '../actors/Actor';
import { Prop } from '../actors/Prop';
import { Surface } from '../actors/Surface';

export class Yard extends Level {
  static key = 'Yard';

  size = { w: 1600, h: 900 };
  start: Spot = { x: 690, y: 712, facing: 'back' }; // on the path in front of the house
  actors: Actor[] = [
    // surfaces: what you walk on, bottom up
    new Surface({ name: 'grass', x: 0, y: 0, w: 1600, h: 900, type: 'grass' }),
    new Surface({ name: 'path-to-gate', x: 666, y: 377, w: 162, h: 524, type: 'gravel' }),
    new Surface({ name: 'path-to-beds', x: 684, y: 585, w: 366, h: 71, type: 'gravel' }),
    new Surface({ name: 'path-to-shed', x: 288, y: 407, w: 197, h: 128, type: 'gravel' }),
    new Surface({ name: 'courtyard', x: 468, y: 408, w: 443, h: 254, type: 'stone' }),
    new Surface({ name: 'work-area', x: 575, y: 477, w: 231, h: 137, type: 'stone' }), // chalk marks, sawhorses, a toolbox
    new Surface({ name: 'porch', x: 636, y: 387, w: 108, h: 26, type: 'wood' }),
    new Surface({ name: 'ladder', x: 479, y: 678, w: 146, h: 60, type: 'wood' }), // lying in the grass

    // things standing in the yard
    new Prop({ name: 'house', x: 453, y: 93, w: 518, h: 296 }),
    new Door({ name: 'door', x: 675, y: 333, w: 30, h: 54, label: 'HOUSE', does: 'GO INSIDE', to: 'Ground', at: { x: 900, y: 770, facing: 'back' }, useSound: creak }),
    new Prop({ name: 'shed', x: 213, y: 299, w: 156, h: 114 }),
    new Prop({ name: 'dumpster', x: 1009, y: 138, w: 188, h: 108 }),
    new Prop({ name: 'lumber', x: 998, y: 299, w: 159, h: 75 }),
    new Prop({ name: 'garden-bed-1', x: 1039, y: 438, w: 123, h: 95 }),
    new Prop({ name: 'garden-bed-2', x: 1178, y: 438, w: 123, h: 95 }),
    new Prop({ name: 'garden-bed-3', x: 1039, y: 558, w: 123, h: 95 }),
    new Prop({ name: 'garden-bed-4', x: 1178, y: 558, w: 123, h: 95 }),
    new Prop({ name: 'garden-bed-5', x: 1039, y: 678, w: 123, h: 95 }),
    new Prop({ name: 'garden-bed-6', x: 1178, y: 678, w: 123, h: 95 }),
    new Prop({ name: 'wheelbarrow', x: 1289, y: 491, w: 78, h: 29 }),
    new Prop({ name: 'fence-back', x: 378, y: 42, w: 1025, h: 23 }),
    new Prop({ name: 'fence-left', x: 378, y: 50, w: 11, h: 780 }),
    new Prop({ name: 'fence-right', x: 1397, y: 50, w: 11, h: 780 }),
    new Prop({ name: 'fence-front-left', x: 378, y: 823, w: 398, h: 23 }), // the gate is the gap between these two
    new Prop({ name: 'fence-front-right', x: 848, y: 823, w: 555, h: 23 }),
    new Prop({ name: 'lamp', x: 857, y: 786, w: 14, h: 57 }),

    // trees, all outside the fence: you can't reach them, so they don't need to be solid
    new Prop({ name: 'tree-1', x: 174, y: 93, w: 153, h: 156, solid: false }),
    new Prop({ name: 'tree-2', x: 84, y: 513, w: 134, h: 135, solid: false }),
    new Prop({ name: 'tree-3', x: 239, y: 767, w: 125, h: 128, solid: false }),
    new Prop({ name: 'tree-4', x: 1412, y: 120, w: 158, h: 162, solid: false }),
    new Prop({ name: 'tree-5', x: 1459, y: 507, w: 141, h: 146, solid: false }),
    new Prop({ name: 'tree-6', x: 1382, y: 812, w: 137, h: 89, solid: false }),
    new Prop({ name: 'tree-7', x: 0, y: 798, w: 122, h: 102, solid: false }),
    new Prop({ name: 'tree-8', x: 829, y: 0, w: 105, h: 44, solid: false }),
    new Prop({ name: 'tree-9', x: 1519, y: 0, w: 81, h: 104, solid: false }),
  ];
}
