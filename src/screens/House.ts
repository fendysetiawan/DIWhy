// The house: it falls on your character, a creak, a crash and dust, "!", DIWHY?! → the contract.

import fallingHouse from '@art/cinematics/falling-house.svg';
import exclamation from '@art/effects/exclamation.svg';
import sky from '@art/backgrounds/sky.svg';
import houseCrash from '@audio/effects/house-crash.mp3';
import houseCreak from '@audio/effects/house-creak.mp3';
import music from '@audio/music/menu.mp3';
import pop from '@audio/ui/pop.wav';
import { Screen } from '../engine/Screen';

const SPEED = 1.6; // the artwork runs 8.96 s; we play it this much faster
const LENGTH = 8960 / SPEED; // ms, one pass of the house falling
const STOP_AT = 0.91; // the artwork stops here and stays (house down, DIWHY?! up), instead of looping
const HOLD_MS = 2500; // how long it stays on screen before the contract

/** Where things sit in the house artwork's 840 x 660 frame, as CSS percentages. */
const placeInFrame = (x: number, y: number, w: number, h: number) =>
  `left:${(x / 840) * 100}%;top:${(y / 660) * 100}%;width:${(w / 840) * 100}%;height:${(h / 660) * 100}%`;

export class House extends Screen {
  static key = 'House';
  static override playable = false;

  private urls: string[] = [];

  async create() {
    const player = this.state.player;
    if (!player) return this.open('Select');
    this.sound.playMusic(music);

    this.el.classList.add('house');
    this.el.innerHTML = `
      <img class="sky" src="${sky}" alt="" />
      <div class="frame">
        <img class="fall" alt="" style="${placeInFrame(0, 0, 840, 660)}" />
        <img class="who" alt="" style="${placeInFrame(377, 435, 88, 123)}" />
        <img class="exclaim" src="${exclamation}" alt="" style="${placeInFrame(408, 378, 24, 48)}" />
      </div>
      <h1 class="title name">DIWHY?!</h1>`;
    this.addSkipButton('SKIP INTRO', 'Contract');

    // the house and the character share one timeline: load both, sped up, so they start together
    this.urls = await Promise.all([playOnce(fallingHouse), playOnce(player.reaction)]);
    const house = this.el.querySelector<HTMLImageElement>('.fall');
    const who = this.el.querySelector<HTMLImageElement>('.who');
    if (!house || !who) return;
    house.src = this.urls[0];
    who.src = this.urls[1];
    await Promise.all([house.decode(), who.decode()].map((p) => p.catch(() => {})));
    this.el.classList.add('on');

    this.time.delay(LENGTH * 0.23, () => this.sound.play(houseCreak, 1)); // the front tips
    this.time.delay(LENGTH * 0.45, () => this.land()); // it lands
    this.time.delay(LENGTH * 0.746, () => this.reveal('bang'));
    this.time.delay(LENGTH * 0.78, () => this.reveal('named'));
    this.time.delay(LENGTH * STOP_AT + HOLD_MS, () => this.open('Contract'));
  }

  shutdown() {
    for (const url of this.urls) URL.revokeObjectURL(url);
  }

  private land() {
    this.sound.play(houseCrash, 1);
    const stage = this.el.querySelector('.frame');
    if (stage) addDust(stage);
  }

  private reveal(what: 'bang' | 'named') {
    this.el.classList.add(what);
    this.sound.play(pop, 0.35);
  }
}

/** Load an animated SVG sped up and played once: it stops at STOP_AT and holds that frame.
 *  (Its frames are <animate> steps over one 8.96 s timeline; we cut each at STOP_AT and freeze it.)
 *  A fresh URL, so it starts from the top. */
async function playOnce(url: string): Promise<string> {
  const svg = (await (await fetch(url)).text()).replace(/<animate [^>]*\/>/g, (tag) => {
    const values = readAttr(tag, 'values').split(';');
    const times = readAttr(tag, 'keyTimes').split(';').map(Number);
    const keep = times.map((t, i) => [t / STOP_AT, values[i]] as const).filter(([t]) => t <= 1);
    return tag
      .replace(/values="[^"]*"/, `values="${keep.map(([, v]) => v).join(';')}"`)
      .replace(/keyTimes="[^"]*"/, `keyTimes="${keep.map(([t]) => t).join(';')}"`)
      .replace(/dur="[^"]*"/, `dur="${Math.round(LENGTH * STOP_AT)}ms"`)
      .replace('repeatCount="indefinite"', 'fill="freeze"');
  });
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

const readAttr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';

/** A burst of pixel dust along the ground where the front lands. */
function addDust(stage: Element) {
  for (let k = 0; k < 18; k++) {
    const d = document.createElement('i');
    d.className = 'dust';
    const x = 90 + Math.random() * 660;
    const y = 560 + Math.random() * 60;
    const s = 14 + Math.random() * 22;
    d.style.cssText = `left:${(x / 840) * 100}%;top:${(y / 660) * 100}%;width:${(s / 840) * 100}%;animation-delay:${Math.random() * 0.12}s`;
    d.style.setProperty('--dx', `${(x < 420 ? -1 : 1) * (20 + Math.random() * 60)}px`);
    d.style.setProperty('--dy', `${-(10 + Math.random() * 50)}px`);
    stage.append(d);
    setTimeout(() => d.remove(), 1600);
  }
}
