// A door: a prop you can use (a door, the stairs). Its hint always floats over it; up close it glows, says what
// it does, and Enter takes you to another level (`to`), arriving at `at`. Without `to` it only shows its hint.

import type { Character } from './Character';
import type { Spot } from '../engine/Level';
import type { ActorConfig } from './Actor';
import { Prop } from './Prop';

export class Door extends Prop {
  private readonly to?: string;
  private readonly at?: Spot;

  constructor(config: ActorConfig & { label: string; does: string; to?: string; at?: Spot }) {
    super({ solid: false, ...config });
    this.hint = { name: config.label, does: config.does };
    this.to = config.to;
    this.at = config.at;
  }

  override onUse(_who: Character): void {
    if (this.to) this.level.goTo(this.to, this.at);
  }
}
