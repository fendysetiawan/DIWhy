// The game as the server last sent it, for the UI to draw. It changes when an update arrives (apply), and tells
// whoever subscribed (the meters, the phone). The UI only reads it; to do something, it asks the Session.

import { type Bill, type Report, type Chat, type Contact, type GameView, type Happening, type JobView, type ToolView, type Message, type Quality, ROLES, type Role } from '../../shared/game';
import { CHARACTERS, type CharacterData } from './characters';

export { ROLES, type Contact, type Message, type Role };

/** What changed, for subscribers: the clock, the meters, the chats, the jobs; or a text, an outcome, a job finished. */
export type Change = 'clock' | 'meters' | 'chats' | 'jobs' | 'tools' | 'visitors' | 'cracked' | 'burnedOut' | 'text' | 'outcome' | 'finished';

export class GameState {
  /** The game on the server, or null before one starts. */
  id: string | null = null;
  /** The DIY-er you play, and who plays each role. */
  player: CharacterData | null = null;
  cast = {} as Record<Role, CharacterData>;
  playerName: string | null = null;
  /** The game clock: minutes since midnight on day 1. */
  minutes = 0;
  /** You're in the game (past the intro): the clock runs. */
  playing = false;
  /** The contractor's quote, what you've spent, and how you're holding up (0 to 1). */
  quote = { days: 30, money: 24000 };
  money = 0;
  health = 1;
  /** Every chat in the phone. */
  chats = {} as Record<Contact, Chat>;
  /** Every DIY job, and whether they're all done (you won). */
  jobs: JobView[] = [];
  won = false;
  /** Who's come over, and to which level. */
  visitors: { role: Role; level: string }[] = [];
  /** The tools the jobs need, and which you have. */
  tools: ToolView[] = [];
  /** Your health hit zero. */
  burnedOut = false;
  /** How it's going, against the quote (for the end screen). */
  report: Report | null = null;
  /** What the contractor wants to take over now. */
  takeover = { money: 0, days: 0 };
  /** Your phone hit the floor once too often. */
  phoneCracked = false;
  /** The contractor's bill, once you've given up. */
  bill: Bill | null = null;
  /** The last tool you bought, and what the clerk made of it. */
  lastBought: { tool: string; text: string } | null = null;
  /** The last text that arrived (for the toast), and the last answer's outcome (for the character to act out). */
  lastText: { from: Contact; text: string } | null = null;
  lastOutcome: { job: string; quality: Quality; text: string; money: number; days: number } | null = null;

  private readonly subscribers = new Map<Change, Set<() => void>>();

  /** Which day it is (day 1 first). */
  get day(): number {
    return Math.floor(this.minutes / (24 * 60)) + 1;
  }

  /** Is it dark out? (from 18:00 to 6:00) */
  get night(): boolean {
    const hour = (this.minutes / 60) % 24;
    return hour >= 18 || hour < 6;
  }

  /** Call `fn` whenever `change` happens. Returns a function that stops it. */
  subscribe(change: Change, fn: () => void): () => void {
    const set = this.subscribers.get(change) ?? new Set();
    this.subscribers.set(change, set.add(fn));
    return () => set.delete(fn);
  }

  /** The server sent the game as it is now, and what just happened. */
  apply(game: GameView, happened: Happening[]): void {
    const day = this.day;
    const step = Math.floor(this.minutes / 10);
    const chatsBefore = JSON.stringify(this.chats);
    const metersBefore = JSON.stringify([this.money, this.health, this.quote]);
    const jobsBefore = JSON.stringify(this.jobs);
    const visitorsBefore = JSON.stringify(this.visitors);
    const toolsBefore = JSON.stringify(this.tools);
    this.id = game.id;
    this.player = findCharacter(game.player);
    this.cast = Object.fromEntries(Object.entries(game.cast).map(([role, id]) => [role, findCharacter(id)])) as Record<Role, CharacterData>;
    this.playerName = game.playerName;
    this.minutes = game.minutes;
    this.playing = game.playing;
    this.quote = game.quote;
    this.money = game.money;
    this.health = game.health;
    this.chats = game.chats;
    this.jobs = game.jobs;
    this.won = game.won;
    this.visitors = game.visitors;
    this.tools = game.tools;
    this.takeover = game.takeover;
    this.report = game.report;
    if (game.burnedOut && !this.burnedOut) {
      this.burnedOut = true;
      this.tell('burnedOut');
    }
    if (game.phoneCracked && !this.phoneCracked) {
      this.phoneCracked = true;
      this.tell('cracked');
    }
    if (JSON.stringify(this.visitors) !== visitorsBefore) this.tell('visitors');
    if (JSON.stringify(this.jobs) !== jobsBefore) this.tell('jobs');
    if (JSON.stringify(this.chats) !== chatsBefore) this.tell('chats'); // only tell what changed
    if (JSON.stringify([this.money, this.health, this.quote]) !== metersBefore) this.tell('meters');
    if (Math.floor(this.minutes / 10) !== step || this.day !== day) this.tell('clock');
    for (const happening of happened) {
      if (happening.type === 'text') {
        this.lastText = { from: happening.from, text: happening.text };
        this.tell('text');
      } else if (happening.type === 'outcome') {
        this.lastOutcome = { job: happening.job, quality: happening.quality, text: happening.text, money: happening.money, days: happening.days };
        this.tell('outcome');
      } else if (happening.type === 'gaveUp') {
        this.bill = happening.bill;
      } else if (happening.type === 'bought') {
        this.lastBought = { tool: happening.tool, text: happening.text };
      } else this.tell('finished');
    }
    if (JSON.stringify(this.tools) !== toolsBefore) this.tell('tools'); // after the happenings: the store shows what you bought
  }

  /** The game is over (you quit): forget it. */
  clear(): void {
    this.id = null;
    this.player = null;
    this.playerName = null;
    this.playing = false;
    this.minutes = 0;
    this.money = 0;
    this.chats = {} as Record<Contact, Chat>;
    this.jobs = [];
    this.visitors = [];
    this.tools = [];
    this.lastBought = null;
    this.takeover = { money: 0, days: 0 };
    this.phoneCracked = false;
    this.bill = null;
    this.burnedOut = false;
    this.report = null;
    this.won = false;
    this.lastText = null;
    this.tell('clock', 'meters', 'chats', 'jobs', 'visitors');
  }

  /** Between updates the clock keeps running here, so it doesn't jump. */
  passTime(minutes: number): void {
    const step = Math.floor(this.minutes / 10);
    const day = this.day;
    this.minutes += minutes;
    if (Math.floor(this.minutes / 10) !== step) this.tell('clock'); // the clock shows ten-minute steps
    if (this.day !== day) this.tell('meters');
  }

  private tell(...changes: Change[]): void {
    for (const change of changes) for (const fn of this.subscribers.get(change) ?? []) fn();
  }
}

function findCharacter(id: string): CharacterData {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
