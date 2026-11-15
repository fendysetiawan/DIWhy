// A prop: something standing in a level (the house, the shed, a tree, the fence). Solid unless you say otherwise.

import { Actor, type ActorConfig } from './Actor';

export class Prop extends Actor {
  constructor(config: ActorConfig) {
    super({ solid: true, ...config });
  }
}
