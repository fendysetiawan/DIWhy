// The ground floor: inside the house, through the yard's front door. Ramy's cottage (legacy/frontend/game/house.js).

import creak from '@audio/effects/creaky-old-door.mp3';
import stairs from '@audio/effects/walking-on-wood.mp3';
import type { Actor } from '../actors/Actor';
import { Door } from '../actors/Door';
import { Prop } from '../actors/Prop';
import { Surface } from '../actors/Surface';
import { type Spot, Level } from '../engine/Level';

export class Ground extends Level {
  static key = 'Ground';

  size = { w: 1600, h: 900 };
  start: Spot = { x: 900, y: 770, facing: 'back' }; // just inside the front door
  override cat = { x: 480, y: 470 }; // in the living room
  actors: Actor[] = [
    new Prop({ name: 'outside', x: 0, y: 0, w: 1600, h: 901, flat: true, solid: false }), // the dark round the house

    // floors: one wood floor for the whole level (so rooms meet without a seam), the other rooms, then the rugs
    new Surface({ name: 'wood-floor', x: 260, y: 131, w: 1081, h: 681, type: 'wood' }),
    new Surface({ name: 'kitchen', x: 524, y: 131, w: 276, h: 270, type: 'tile' }),
    new Surface({ name: 'bathroom', x: 1000, y: 131, w: 341, h: 249, type: 'tile' }),
    new Surface({ name: 'living-room-rug', x: 330, y: 560, w: 260, h: 200, type: 'carpet' }),
    new Surface({ name: 'runner', x: 862, y: 690, w: 77, h: 99, type: 'carpet' }),
    new Surface({ name: 'study-rug', x: 1060, y: 480, w: 240, h: 200, type: 'carpet' }),

    // furniture, and the two staircases (up, and down to the basement)
    new Prop({ name: 'table', x: 318, y: 225, w: 164, h: 102 }),
    new Prop({ name: 'sideboard', x: 270, y: 149, w: 33, h: 93 }),
    new Prop({ name: 'counter', x: 542, y: 138, w: 194, h: 48 }),
    new Prop({ name: 'fridge', x: 738, y: 138, w: 53, h: 63 }),
    new Prop({ name: 'fireplace', x: 269, y: 518, w: 32, h: 134 }),
    new Prop({ name: 'sofa', x: 329, y: 722, w: 233, h: 66 }),
    new Prop({ name: 'coffee-table', x: 389, y: 611, w: 113, h: 51 }),
    new Prop({ name: 'armchair', x: 620, y: 623, w: 74, h: 72 }),
    new Prop({ name: 'plant-1', x: 734, y: 753, w: 45, h: 44 }),
    new Door({ name: 'stairs-up', x: 845, y: 135, w: 111, h: 198, solid: true, label: 'STAIRS', does: 'GO UP', to: 'Upstairs', at: { x: 900, y: 372, facing: 'front' }, useSound: stairs }),
    new Prop({ name: 'vanity', x: 1010, y: 138, w: 93, h: 51 }),
    new Prop({ name: 'toilet', x: 1154, y: 138, w: 42, h: 63 }),
    new Prop({ name: 'shower', x: 1228, y: 138, w: 104, h: 174 }),
    new Prop({ name: 'desk', x: 1189, y: 488, w: 63, h: 168 }),
    new Prop({ name: 'chair-1', x: 1111, y: 480, w: 47, h: 47 }),
    new Prop({ name: 'chair-2', x: 1111, y: 611, w: 47, h: 47 }),
    new Prop({ name: 'office-chair', x: 1271, y: 549, w: 47, h: 47 }),
    new Prop({ name: 'shelf', x: 1010, y: 756, w: 144, h: 44 }),
    new Prop({ name: 'plant-2', x: 1288, y: 753, w: 45, h: 44 }),
    new Door({ name: 'stairs-down', x: 845, y: 518, w: 111, h: 153, solid: true, label: 'STAIRS', does: 'GO DOWN', to: 'Basement', at: { x: 900, y: 700, facing: 'front' }, useSound: stairs }),

    // walls (the gaps between them are the doorways)
    new Prop({ name: 'wall-back', x: 249, y: 119, w: 1102, h: 27 }),
    new Prop({ name: 'wall-left', x: 249, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-right', x: 1333, y: 119, w: 18, h: 702 }),
    new Prop({ name: 'wall-front-left', x: 249, y: 803, w: 602, h: 26 }),
    new Prop({ name: 'wall-front-right', x: 949, y: 803, w: 402, h: 26 }),
    new Prop({ name: 'wall-0', x: 792, y: 119, w: 15, h: 83 }),
    new Prop({ name: 'wall-1', x: 792, y: 288, w: 15, h: 314 }),
    new Prop({ name: 'wall-2', x: 792, y: 698, w: 15, h: 123 }),
    new Prop({ name: 'wall-3', x: 992, y: 119, w: 15, h: 104 }),
    new Prop({ name: 'wall-4', x: 992, y: 299, w: 15, h: 263 }),
    new Prop({ name: 'wall-5', x: 992, y: 678, w: 15, h: 143 }),
    new Prop({ name: 'wall-6', x: 264, y: 393, w: 267, h: 21 }),
    new Prop({ name: 'wall-7', x: 528, y: 393, w: 173, h: 21 }),
    new Prop({ name: 'wall-8', x: 1004, y: 372, w: 332, h: 23 }),

    // the front door: a doorstep you can't step past, so you leave through it
    new Door({ name: 'front-door', x: 850, y: 803, w: 101, h: 17, flat: true, solid: true, label: 'YARD', does: 'GO OUTSIDE', to: 'Yard', at: { x: 690, y: 440, facing: 'front' }, useSound: creak }),
  ];
}
