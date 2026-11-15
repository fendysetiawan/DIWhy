// The seven DIY-ers: each one's data (name, face, sprites, voice), like an Unreal Data Asset.
// You play one (the player); the other six play the roles in your life (partner, contractor…). A Character (actors/) is one of them standing in a level.

import { type Act, type CharacterId, CHARACTERS as SHARED_CHARACTERS } from '../../shared/game';
import type { Facing } from '../actors/Character';

const files = {
  ...import.meta.glob<string>(
    '../assets/art/characters/*/{emote-start,emote,reaction,building,you-won,you-failed,front,back,left,right,idle-front,idle-back,idle-left,idle-right}.svg',
    { eager: true, query: '?url', import: 'default' },
  ),
  ...import.meta.glob<string>('../assets/art/characters/*/actions/*.svg', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob<string>('../assets/audio/voices/*/*.mp3', { eager: true, query: '?url', import: 'default' }),
};

export type VoiceLine = 'emote' | 'nice' | 'oops' | 'oh-shit' | 'success' | 'hooray';

export interface CharacterData {
  id: CharacterId;
  name: string;
  /** Standing still, for character select. */
  still: string;
  /** Their little celebration, when picked. */
  emote: string;
  /** Watching the house fall on them (and a disaster on a job). */
  reaction: string;
  /** Hammering at a workbench (on a job, between steps). */
  building: string;
  /** The end: they won, or gave up. */
  won: string;
  failed: string;
  /** Walking, facing a way. */
  walk: (facing: Facing) => string;
  /** Standing, facing a way (they breathe). */
  idle: (facing: Facing) => string;
  /** Acting something out (drill, celebrate…), on a loop. */
  act: (act: Act) => string;
  /** One of their lines. */
  voice: (line: VoiceLine) => string;
}

function makeCharacter(id: CharacterId, name: string): CharacterData {
  const art = (file: string) => findFile(`../assets/art/characters/${id}/${file}`);
  return {
    id,
    name,
    still: art('emote-start.svg'),
    emote: art('emote.svg'),
    reaction: art('reaction.svg'),
    building: art('building.svg'),
    won: art('you-won.svg'),
    failed: art('you-failed.svg'),
    walk: (facing) => art(`${facing}.svg`),
    idle: (facing) => art(`idle-${facing}.svg`),
    act: (act) => art(`actions/${act}.svg`),
    voice: (line) => findFile(`../assets/audio/voices/${id}/${line}.mp3`),
  };
}

/** A character's file, or a loud error if it's missing (so a moved file can't fail quietly). */
function findFile(path: string): string {
  const url = files[path];
  if (!url) throw new Error(`Missing file: ${path}`);
  return url;
}

/** The seven, in the order shared/game.ts lists them. */
export const CHARACTERS: CharacterData[] = SHARED_CHARACTERS.map((c) => makeCharacter(c.id, c.name));
