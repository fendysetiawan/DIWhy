// A visitor: someone from your phone who's come over (the GameMode says who, and where). They stand near where you
// came in, in their own sprite; walk up and Enter to talk (their chat opens on the phone).

import { ROLES, type Role } from '../../shared/game';
import type { Spot } from '../engine/Level';
import type { CharacterData } from '../state/characters';
import type { Character } from './Character';
import { Actor } from './Actor';

// their sprite, cut and sized like yours (actors/Character.ts): 67 x 140 of a 160 frame, at 120 level units
const W = (67 * 120) / 160;
const H = (140 * 120) / 160;

export class Visitor extends Actor {
  constructor(
    readonly role: Role,
    private readonly data: CharacterData,
    at: Spot,
  ) {
    super({ name: role, x: at.x - W / 2, y: at.y - H, w: W, h: H });
    this.hint = { name: ROLES[role].toUpperCase(), does: 'TALK' };
  }

  /** Their standing sprite, day or night. */
  override showTime(_night: boolean): void {
    this.el.src = this.data.idle('front');
  }

  override onUse(_who: Character): void {
    this.level.talkTo(this.role);
  }
}
