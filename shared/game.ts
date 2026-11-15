// What the server and the app both know: who's who, the shape of a game as the server sends it, and the actions
// the app can send. Both sides import this file, so a change breaks the build, not the game.

/** The seven DIY-ers (their pictures and voices are in the app). */
export const CHARACTERS = [
  { id: 'travis-potter', name: 'Travis' },
  { id: 'aidan-newsome', name: 'Aidan' },
  { id: 'rachel-katz', name: 'Rachel' },
  { id: 'christian-huber', name: 'Christian' },
  { id: 'ramy-maher', name: 'Ramy' },
  { id: 'gigi-singh', name: 'Gigi' },
  { id: 'fendy-seitiawan', name: 'Fendy' },
] as const;
export type CharacterId = (typeof CHARACTERS)[number]['id'];

/** The roles in your life. The other six characters play them, dealt at random each game; each role's
 * personality is in server/roles.ts. */
export const ROLES = {
  partner: 'Partner',
  contractor: 'Contractor',
  clerk: 'Store Clerk',
  parent: 'Parent',
  neighbor: 'Nosy Neighbor',
  friend: 'Friend',
} as const;
export type Role = keyof typeof ROLES;
/** Everyone in your phone: the roles, and the bank. */
export type Contact = Role | 'bank';

/** The game clock: it starts at 8:00 on day 1, and runs this many game minutes per real second while you play. */
export const START_MINUTES = 8 * 60;
export const CLOCK_SPEED = 1;

/** One message in a chat. */
export interface Message {
  text: string;
  /** You sent it. */
  mine?: boolean;
}

/** A chat in your phone: its messages, how many are unread, what you could say next, and whether they're typing. */
export interface Chat {
  messages: Message[];
  unread: number;
  replies: string[];
  typing: boolean;
}

/** What a character can act out (each has a looping animation: art/characters/<id>/actions/<name>.svg). */
export const ACTS = [
  'bad-smell', 'carry-box', 'caulking', 'ceiling-reach', 'celebration', 'drill', 'dust-cough', 'electric-shock',
  'exhausted', 'flashlight', 'floor-prying', 'fright', 'measuring', 'paint-roller', 'phone', 'push-pull', 'talking',
  'under-sink', 'water-spray', 'wrench',
] as const;
export type Act = (typeof ACTS)[number];

/** How good an answer to a surprise was (Fendy's answer keys). */
export type Quality = 'good' | 'ok' | 'wrong' | 'excessive';

/** One step of a job: what you do, how it looks and sounds, and how long it takes. */
export interface Step {
  name: string;
  act: Act;
  /** A sound effect's name (assets/audio/effects/<sound>.mp3). */
  sound: string;
  minutes: number;
  /** The tool it needs (server/tools.json), if any: you buy it at the store first. */
  tool?: string;
}

/** A tool at the hardware store: its options (cheapest first, each with the clerk's pitch; how good each is stays on
 * the server), and if you have it. */
export interface ToolView {
  id: string;
  /** "a stud finder" */
  name: string;
  options: { name: string; price: number; pitch: string }[];
  owned: boolean;
  /** What your prep recommends (an option): the video's pick, and AskBot's (whatever it read first). */
  tips: { video?: number; ask?: number };
}

/** A surprise in the middle of a job, with three ways to deal with it. */
export interface Surprise {
  title: string;
  description: string;
  options: string[];
  /** What each option costs (dollars), the same order as the options. */
  costs: number[];
  /** What your prep tells you: the option a video showed you (or AskBot said), or that AskBot skipped this part. */
  hint?: { option: number; from: 'video' | 'ask' } | { skipped: true };
}

/** Prep for a job, on the phone: a WeTube video (watching takes game time) and an AskBot chat (quick, but it skips
 * things). */
export interface Prep {
  video: { title: string; channel: string; length: string; minutes: number };
  ask: { question: string; answer: string; skipped: string };
}

/** A DIY job, as the app sees it. */
export interface JobView {
  id: string;
  title: string;
  /** Where its glowing spot is: a level, and the spot's name there. */
  level: string;
  /** The contractor's price for it. */
  quote: { days: number; money: number };
  steps: Step[];
  /** How many steps are done. */
  done: number;
  /** What it has cost you so far (materials, and your answers to surprises). */
  spent: number;
  status: 'open' | 'working' | 'done';
  /** A surprise waiting for your answer, or null. */
  surprise: Surprise | null;
  /** Its sign shows at its spot until you start on it (a rat's shadow, a ghost: jobs/<id>/sign.svg). */
  sign?: boolean;
  /** Its video and AskBot chat, and whether you've watched or asked. */
  prep: Prep & { watched: boolean; asked: boolean };
}

/** How the game went, for the end screen: against the contractor's quote. */
export interface Report {
  days: number;
  quote: { days: number; money: number };
  spent: number;
  jobsDone: number;
  jobs: number;
  cornersCut: number;
}

/** The whole game, as the server sends it. */
export interface GameView {
  id: string;
  player: CharacterId;
  playerName: string | null;
  cast: Record<Role, CharacterId>;
  /** The clock now (game minutes since midnight on day 1), and whether it's running (you're playing). */
  minutes: number;
  playing: boolean;
  /** The contractor's quote, what you've spent, and how you're holding up (0 to 1). */
  quote: { days: number; money: number };
  money: number;
  health: number;
  chats: Record<Contact, Chat>;
  jobs: JobView[];
  /** The tools the jobs need, and which you have. */
  tools: ToolView[];
  /** What the contractor wants to take over now (it climbs as trouble piles up). */
  takeover: { money: number; days: number };
  /** Your phone hit the floor once too often. */
  phoneCracked: boolean;
  /** Who's come over, and where they are (a level). */
  visitors: { role: Role; level: string }[];
  /** Everything's fixed: you won. */
  won: boolean;
  /** Your health hit zero: you burned out. */
  burnedOut: boolean;
  report: Report;
}

/** What just happened (since the app last asked), for sounds, toasts and the character acting it out. */
export type Happening =
  | { type: 'text'; from: Contact; text: string }
  | { type: 'outcome'; job: string; quality: Quality; text: string; money: number; days: number } // how your answer to a surprise went, and what it cost
  | { type: 'finished'; job: string }
  | { type: 'bought'; tool: string; text: string } // you bought a tool, and how that went
  | { type: 'gaveUp'; bill: Bill }; // you called the contractor: their bill

/** The contractor's bill when you give up: a line for each job, and the total. */
export interface Bill {
  lines: { title: string; money: number; note: string }[];
  total: number;
  /** What you'd already spent yourself. */
  spent: number;
}

/** The server's answer to anything: the game as it is now, and what just happened. */
export interface Update {
  game: GameView;
  happened: Happening[];
}

/** What the app can ask the server to do. */
export type Action =
  | { type: 'play' } // you're in the game now: the clock starts
  | { type: 'sign'; name: string }
  | { type: 'reply'; to: Contact; text: string }
  | { type: 'read'; contact: Contact }
  | { type: 'startJob'; job: string }
  | { type: 'work'; job: string } // do the next step
  | { type: 'choose'; job: string; option: number } // answer the surprise
  | { type: 'buy'; tool: string; option: number } // buy a tool at the store
  | { type: 'giveUp' } // call the contractor: they finish it all, for a price
  | { type: 'watch'; job: string } // watch a job's WeTube video
  | { type: 'ask'; job: string }; // ask AskBot about a job
