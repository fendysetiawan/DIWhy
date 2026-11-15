// A level you walk around: it shows its actors, walks you, plays footsteps, shows hints, follows with the camera,
// and runs the clock. A level extends it and lists its size, start and actors (see levels/Yard.ts). Visitors (who the
// GameMode says has come over) are added and removed as they come and go.

import wrenchIcon from '@art/icons/wrench.svg?raw';
import bump from '@audio/effects/small-quick-tap.mp3';
import knock from '@audio/effects/hollow-knocking.mp3';
import home from '@audio/music/home.mp3';
import { CHARACTERS } from '../state/characters';
import { Camera } from './Camera';
import { Cat } from '../actors/Cat';
import { Character, type Facing } from '../actors/Character';
import type { Actor } from '../actors/Actor';
import { Surface } from '../actors/Surface';
import { JobSpot } from '../actors/JobSpot';
import { Visitor } from '../actors/Visitor';
import { JOBS } from '../state/jobs';
import type { Role } from '../state/GameState';
import { Screen } from './Screen';

/** Where someone stands, and which way they face. */
export interface Spot {
  x: number;
  y: number;
  facing: Facing;
}

/** A character's feet: half their width, and their depth. */
const FOOT = 14;
const FOOT_H = 12;
/** How far you can hear a thing's sound, in level units, and how loud it is right next to it. */
const HEARING = 280;
const LOUDEST = 0.15;
/** At most one bump sound this often (ms), however long you push against a wall. */
const BUMP_GAP = 500;

const CLOSE = 220; // this close to something you can use, its hint shows

export abstract class Level extends Screen {
  /** Its music (home, unless a level says otherwise). */
  readonly music: string = home;
  /** How big it is, in level units (one art pixel = 1.5 units, like the character sprites). */
  abstract readonly size: { w: number; h: number };
  /** Where you arrive, unless a door says otherwise. */
  abstract readonly start: Spot;
  /** Where the cat starts, if it lives here. */
  readonly cat?: { x: number; y: number };
  /** Everything in it: surfaces first (bottom up), then the rest. */
  abstract readonly actors: Actor[];

  private you!: Character;
  private stage!: HTMLElement;
  private pet?: Cat;
  private camera!: Camera;
  private readonly hints = new Map<Actor, HTMLElement>();
  /** The things making a sound, and their loops. */
  private readonly sounds = new Map<Actor, ReturnType<Screen['sound']['emit']>>();
  private night = false;
  private lastBump = 0;

  create(data?: { at?: Spot }) {
    this.sound.playMusic(this.music);
    this.night = this.state.night;

    this.el.classList.add('level');
    const stage = document.createElement('div');
    this.stage = stage;
    stage.className = 'stage';
    Object.assign(stage.style, { width: `${this.size.w}px`, height: `${this.size.h}px` });
    this.el.append(stage);
    for (const actor of this.actors) this.place(actor);
    for (const job of JOBS.filter((j) => j.level === this.key)) this.place(new JobSpot(job.id, job.spot)); // each job here (jobs/<id>/job.json)
    this.showVisitors();
    this.onChange('visitors', () => this.showVisitors());

    const at = data?.at ?? this.start;
    this.you = new Character(this.state.player ?? CHARACTERS[0], at.x, at.y, at.facing);
    stage.append(this.you.el);
    if (this.cat) {
      this.pet = new Cat(this.cat.x, this.cat.y);
      stage.append(this.pet.el);
    }
    this.camera = new Camera(stage, this.size);
    this.camera.follow(this.you.x, this.you.y);

    this.controls.onAction('confirm', () => {
      const actor = this.isPaused() ? undefined : this.you.reach(this.actors);
      if (!actor) return;
      if (actor.useSound) this.sound.play(actor.useSound, 0.5);
      actor.onUse(this.you);
    });
  }

  shutdown() {
    this.sound.setFootsteps(null);
    for (const loop of this.sounds.values()) loop.stop();
  }

  update(dt: number) {
    if (this.state.night !== this.night) {
      this.night = this.state.night;
      for (const actor of this.actors) actor.showTime(this.night);
    }

    const paused = this.isPaused();
    const vx = paused ? 0 : Number(this.controls.isDown('right')) - Number(this.controls.isDown('left'));
    const vy = paused ? 0 : Number(this.controls.isDown('down')) - Number(this.controls.isDown('up'));
    this.you.walk(vx, vy, dt, this);
    if (this.you.bumping && performance.now() - this.lastBump > BUMP_GAP) {
      this.lastBump = performance.now();
      this.sound.play(bump, 0.3);
    }
    // standing still: on the phone while it's out; worn out when health is low
    this.you.act(this.game.hud.phone.isUp ? 'phone' : this.state.health < 0.3 ? 'exhausted' : null);
    this.pet?.update(dt, this, this.you);
    const under = this.you.walking ? this.findSurfaceAt(this.you.x, this.you.y) : undefined;
    if (under) under.onWalk(this.you);
    else this.sound.setFootsteps(null);

    for (const [actor, loop] of this.sounds) {
      const closeness = Math.max(0, 1 - actor.measureDistance(this.you.x, this.you.y) / HEARING);
      loop.setVolume(LOUDEST * closeness * closeness); // fades quickly as you walk away
    }

    const near = this.you.reach(this.actors);
    for (const [actor, el] of this.hints) {
      el.classList.toggle('close', actor.measureDistance(this.you.x, this.you.y) < CLOSE); // its hint shows
      el.classList.toggle('near', actor === near);
      actor.el.classList.toggle('near', actor === near); // the actor itself glows
    }
    this.camera.follow(this.you.x, this.you.y);
  }

  /** Talk to someone who's come over: their chat, on the phone. */
  talkTo(role: Role): void {
    this.game.hud.phone.openChat(role);
  }

  /** Take on a job (or go back to it): its DIY level, coming back here afterwards. */
  startJob(job: string): void {
    const isNew = this.state.jobs.find((j) => j.id === job)?.status === 'open';
    this.game.session.startJob(job);
    if (isNew) this.game.hud.phone.openChat('contractor'); // a new task: the contractor's quote is on its way
    this.open('Diy', { job, back: { level: this.key, at: { x: this.you.x, y: this.you.y, facing: this.you.facing } } });
  }

  /** Go to another level (a door's job), arriving at a spot. */
  goTo(key: string, at?: Spot): void {
    this.open(key, { at });
  }

  /** You stand still while using the phone or the menu; Enter is theirs then. */
  private isPaused(): boolean {
    return this.game.hud.isBusy;
  }

  /** Would feet standing at (x, y) overlap anything solid? */
  isBlocked(x: number, y: number): boolean {
    return this.actors.some(
      (a) => a.solid && x + FOOT > a.x && x - FOOT < a.x + a.w && y > a.y && y - FOOT_H < a.y + a.h,
    );
  }

  /** The top surface painted at (x, y). */
  private findSurfaceAt(x: number, y: number): Surface | undefined {
    return this.actors.findLast((a): a is Surface => a instanceof Surface && a.covers(x, y));
  }

  /** Put an actor in the level: its picture, its hint, its sound. */
  private place(actor: Actor): void {
    if (!this.actors.includes(actor)) this.actors.push(actor);
    actor.addTo(this);
    actor.showTime(this.night);
    this.stage.append(actor.el);
    if (actor.hint) this.stage.append(this.addHint(actor));
    if (actor.sound) this.sounds.set(actor, this.sound.emit(actor.sound));
  }

  /** Take an actor out of the level. */
  private remove(actor: Actor): void {
    this.actors.splice(this.actors.indexOf(actor), 1);
    actor.el.remove();
    this.hints.get(actor)?.remove();
    this.hints.delete(actor);
  }

  /** Whoever's come over to this level stands near where you come in; whoever's left goes. */
  private showVisitors(): void {
    const here = this.state.visitors.filter((v) => v.level === this.key);
    for (const actor of this.actors.filter((a): a is Visitor => a instanceof Visitor)) {
      if (!here.some((v) => v.role === actor.role)) this.remove(actor);
    }
    here.forEach((v, i) => {
      if (this.actors.some((a) => a instanceof Visitor && a.role === v.role)) return;
      this.place(new Visitor(v.role, this.state.cast[v.role], { x: this.start.x + 80 + i * 70, y: this.start.y, facing: 'front' }));
      if (this.you) this.sound.play(knock, 0.6); // they just arrived (not: they were here when you came in)
    });
  }

  /** A glowing spot over an actor you can use, with its hint floating above. */
  private addHint(actor: Actor): HTMLElement {
    const el = document.createElement('div');
    el.className = actor.hint?.job ? 'spot job' : 'spot'; // a job's hint looks different from a door's
    Object.assign(el.style, { left: `${actor.x}px`, top: `${actor.y}px`, width: `${actor.w}px`, height: `${actor.h}px` });
    el.innerHTML = `<div class="hint"><span class="hint-name">${actor.hint?.job ? wrenchIcon : ''}${actor.hint?.name}</span><span class="hint-what">${actor.hint?.does}</span></div>`;
    this.hints.set(actor, el);
    return el;
  }
}

/** Every walk level's pictures: 'yard/shed-day.png' → its URL. */
const PICTURES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/art/levels/*/*.png', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.split('/').slice(-2).join('/'), url]),
);

/** One of a level's pictures, e.g. findPicture('Yard', 'shed-day.png'); a loud error if it's missing. */
export function findPicture(level: string, file: string): string {
  const url = PICTURES[`${level.toLowerCase()}/${file}`];
  if (!url) throw new Error(`Missing picture: ${level.toLowerCase()}/${file}`);
  return url;
}
