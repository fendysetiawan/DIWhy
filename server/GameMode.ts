// The GameMode, like Unreal's: one game's rules and everything about it, on the server only. The app never sees it;
// it gets a copy to show (replicate(), into its GameState).
//
// Time is real: whenever the app asks, the game first catches up with what happened since. What's planned for later
// sits on the timeline, at a game time: a text arriving, a job appearing, a fix breaking, someone coming over or leaving.
// Texts are written by Claude in the background (texts.ts, in the roles' voices in roles.ts): the person shows as
// typing until theirs arrives. Jobs: start one, do its steps (each takes game time and some money), and answer the
// surprises that come up; cut corners and it may break later.

import {
  type Action,
  type Bill,
  type Report,
  CHARACTERS,
  CLOCK_SPEED,
  type Chat,
  type CharacterId,
  type Contact,
  type GameView,
  type Happening,
  type JobView,
  type Surprise,
  type Quality,
  ROLES,
  type Role,
  START_MINUTES,
} from '../shared/game';
import { type Event, JOBS, TOOLS } from './jobs';
import { PERSONALITIES } from './roles';
import { type Talk, writeText } from './texts';

const START_HEALTH = 0.78;
const FIRST_TEXT_AFTER_MS = 6000; // into playing, the contractor texts
const ANSWER_MS = 1600; // at the soonest, someone answers you after this (they're typing)
const DAY = 24 * 60; // minutes
/** New jobs turn up this much faster (1.75 = 75% faster): their days and delays are divided by it. */
const TROUBLE_PACE = 1.75;

/** A surprise comes up on this share of steps. */
const SURPRISE_CHANCE = 0.5;
/** The steps' materials cost this share of the job's quote, in all. */
const MATERIALS = 0.6;
/** Finishing a job feels this good. */
const JOB_DONE_HEALTH = 0.05;
/** Each corner you cut on a job (an ok answer: 1, a wrong one: 2) makes it this much likelier to break later. */
const BREAK_PER_CORNER = 0.25;
/** A visit lasts this long (game minutes). */
const VISIT = 3 * 60;
/** The drive to the store and back (game minutes). */
const STORE_TRIP = 60;
/** What the clerk says about what you bought. */
const BOUGHT = { cheap: 'It works. Sort of. Fingers crossed.', right: 'Good pick. That is what the pros use.', premium: 'Fancy. Your wallet felt that.' };

/** Giving up: the contractor's rush price on what's left (more with every bit of trouble), a share for fixing what
 * you did, and a call-out fee. */
const RUSH = 1.35;
const RUSH_PER_TROUBLE = 0.05;
const FIX_YOUR_FIX = 0.3;
const CALL_OUT = 250;
/** Asking AskBot takes this long (game minutes); a video takes its length. */
const ASK_MINUTES = 20;
/** AskBot gets it right this often. */
const ASKBOT_RIGHT = 0.5;

/** About one job in ten ends with the phone on the floor. */
const PHONE_CRACK_CHANCE = 0.1;

/** The levels someone can come over to. */
const LEVELS = ['Yard', 'Ground', 'Upstairs', 'Basement'];

/** What an answer to a surprise does (Ramy's numbers; each option's price is in its job.json): the days it loses, how you feel. */
const OUTCOMES: Record<Quality, { days: number; health: number; text: string }> = {
  good: { days: 0, health: 0, text: 'Exactly what a pro would do.' },
  ok: { days: 0, health: -0.03, text: 'Works. Mostly. Probably.' },
  wrong: { days: 1, health: -0.09, text: "That'll bite you later." },
  excessive: { days: 2, health: -0.02, text: 'Overkill. Your wallet felt it.' },
};

/** Something planned on the timeline. */
type Plan =
  | { kind: 'text'; from: Role; talk: Talk }
  | { kind: 'quote'; days: number; money: number }
  | { kind: 'appear'; job: string }
  | { kind: 'break'; job: string }
  | { kind: 'visit'; role: Role; level: string }
  | { kind: 'leave'; role: Role };

/** Where a job is at (hidden: it hasn't appeared yet). */
interface JobState {
  status: 'hidden' | 'open' | 'working' | 'done';
  /** Steps done. */
  done: number;
  /** What it has cost so far. */
  spent: number;
  /** The surprise waiting for your answer, if any. */
  surprise: Event | null;
  /** The surprises still to come (each one once). */
  surprises: Event[];
  /** Corners you cut on it: the more, the likelier it breaks once it's done. */
  cornersCut: number;
  /** Prepped on the phone: watched its video, asked AskBot. */
  watched: boolean;
  asked: boolean;
  /** What your prep tells you about the surprise that's up. */
  hint: Surprise['hint'];
}

export class GameMode {
  readonly id: string;
  private readonly player: CharacterId;
  /** Who plays which role this game. */
  private readonly cast: Record<Role, CharacterId>;
  private playerName: string | null = null;
  /** When you started playing (real time, ms), or null while still in the intro. */
  private playingSince: number | null = null;
  private money = 0;
  private health = START_HEALTH;
  private readonly chats = startChats();
  /** What's planned, each at a game time (minutes): texts on their way, jobs to appear, fixes to break, visits. */
  private timeline: { at: number; plan: Plan }[] = [];
  /** Who's come over, and to which level. */
  private readonly visitors = new Map<Role, string>();
  private firstTextSent = false;
  /** The day of the last morning text. */
  private day = 1;
  private lastTexter: Role | null = null;
  /** Game time spent working, on top of the clock (a step takes hours; a wrong call, a day). */
  private extraMinutes = 0;
  private readonly jobs: Record<string, JobState>;
  /** Trouble so far (a bad call, a fix breaking, a cheap tool): the contractor's price climbs with it. */
  private trouble = 0;
  private phoneCracked = false;
  /** The contractor's quotes so far: nothing at the start, then each job's quote as you take it on. It's the budget's ceiling. */
  private quoted = { days: 0, money: 0 };
  /** The tools you've bought, and how good each is. */
  private readonly tools = new Map<string, 'cheap' | 'right' | 'premium'>();

  /** A new game as `player`: the other six dealt into the roles, every job open. */
  constructor(id: string, player: CharacterId) {
    this.id = id;
    this.player = player;
    const others = shuffle(CHARACTERS.map((c) => c.id).filter((c) => c !== player));
    this.cast = Object.fromEntries((Object.keys(ROLES) as Role[]).map((role, i) => [role, others[i]])) as Record<Role, CharacterId>;
    this.jobs = Object.fromEntries(
      JOBS.map((j) => [j.id, { status: j.appears ? 'hidden' : 'open', done: 0, spent: 0, surprise: null, surprises: shuffle(j.events), cornersCut: 0, watched: false, asked: false, hint: undefined }]),
    );
    for (const job of JOBS) {
      if (job.appears?.day) this.schedule(((job.appears.day - 1) * DAY) / TROUBLE_PACE + START_MINUTES, { kind: 'appear', job: job.id });
    }
  }

  // ─── what the routes call ───

  /** Catch up with what happened since anyone last asked: what's due on the timeline happens, and someone may text. */
  catchUp(now: number): Happening[] {
    if (this.playingSince === null) return [];
    const minutes = this.minutesAt(now);
    const due = this.timeline.filter((t) => t.at <= minutes).sort((a, b) => a.at - b.at);
    this.timeline = this.timeline.filter((t) => t.at > minutes);
    const happened = due.flatMap((t) => this.carryOut(t.plan, now));
    if (!this.firstTextSent && now - this.playingSince >= FIRST_TEXT_AFTER_MS) {
      this.firstTextSent = true;
      this.lastTexter = 'contractor';
      this.startTyping('contractor', 'text', now, "You haven't started anything yet, so there's no quote yet. Say they'll quote each job as you take it on."); // first, the contractor you turned down
    }
    const day = this.dayAt(now);
    if (day !== this.day) {
      this.day = day;
      this.textFromSomeone(now); // a new morning
      if (Math.random() < 0.5) this.comeOver(now); // and sometimes someone drops by
    }
    return happened;
  }

  /** Do what the app asked; returns what happened because of it (a surprise's outcome, a job finished). */
  handleAction(action: Action, now: number): Happening[] {
    switch (action.type) {
      case 'play':
        this.playingSince ??= now;
        return [];
      case 'sign':
        this.playerName = action.name.slice(0, 20);
        return [];
      case 'read':
        this.chats[action.contact].unread = 0;
        return [];
      case 'reply':
        this.reply(action.to, action.text, now);
        return [];
      case 'startJob':
        this.startJob(action.job, now);
        return [];
      case 'work':
        return this.doStep(action.job, now);
      case 'choose':
        return this.answerSurprise(action.job, action.option, now);
      case 'buy':
        return this.buyTool(action.tool, action.option);
      case 'giveUp':
        return [{ type: 'gaveUp', bill: this.writeBill() }];
      case 'watch':
        return this.prep(action.job, 'watched');
      case 'ask':
        return this.prep(action.job, 'asked');
    }
  }

  /** The copy of the game the app gets (Unreal: replication), into its GameState. Surprises' answers stay here. */
  replicate(now: number): GameView {
    return {
      id: this.id,
      player: this.player,
      playerName: this.playerName,
      cast: this.cast,
      minutes: this.minutesAt(now),
      playing: this.playingSince !== null,
      quote: this.quoted,
      money: this.money,
      health: this.health,
      chats: this.chats,
      tools: Object.entries(TOOLS).map(([id, t]) => ({
        id,
        name: t.name,
        options: t.options.map(({ name, price, pitch }) => ({ name, price, pitch })),
        owned: this.tools.has(id),
        tips: this.tipsFor(id),
      })),
      takeover: { money: this.writeBill().total, days: this.takeoverDays() },
      phoneCracked: this.phoneCracked,
      visitors: [...this.visitors].map(([role, level]) => ({ role, level })),
      jobs: JOBS.filter((info) => this.jobs[info.id].status !== 'hidden').map((info): JobView => {
        const { status, done, spent, surprise, watched, asked, hint } = this.jobs[info.id];
        return {
          id: info.id,
          title: info.title,
          level: info.level,
          quote: info.quote,
          steps: info.steps,
          done,
          spent,
          status: status === 'hidden' ? 'open' : status,
          surprise: surprise && { title: surprise.title, description: surprise.description, options: surprise.options, costs: surprise.costs, hint },
          prep: { ...info.prep, watched, asked },
          sign: status === 'open' && done === 0 ? info.appears?.sign : undefined,
        };
      }),
      won: Object.values(this.jobs).every((j) => j.status === 'done') && !this.timeline.some((t) => t.plan.kind === 'break' || t.plan.kind === 'appear'),
      burnedOut: this.health <= 0,
      report: this.writeReport(now),
    };
  }

  // ─── the clock ───

  /** The game clock at `now`, in minutes. */
  private minutesAt(now: number): number {
    const played = this.playingSince === null ? 0 : ((now - this.playingSince) / 1000) * CLOCK_SPEED;
    return START_MINUTES + this.extraMinutes + played;
  }

  /** Which day it is at `now` (day 1 first). */
  private dayAt(now: number): number {
    return Math.floor(this.minutesAt(now) / DAY) + 1;
  }

  // ─── the timeline ───

  /** Plan something for game time `at` (minutes). */
  private schedule(at: number, plan: Plan): void {
    this.timeline.push({ at, plan });
  }

  /** Something planned is due: it happens. */
  private carryOut(plan: Plan, now: number): Happening[] {
    switch (plan.kind) {
      case 'text':
        return this.deliverText(plan.from, plan.talk);
      case 'quote':
        this.quoted = { days: this.quoted.days + plan.days, money: this.quoted.money + plan.money }; // the budget grows
        return [];
      case 'appear':
        return this.revealJob(plan.job, now);
      case 'break':
        return this.breakJob(plan.job, now);
      case 'visit':
        this.visitors.set(plan.role, plan.level);
        return [];
      case 'leave':
        this.visitors.delete(plan.role);
        return [];
    }
  }

  // ─── texts ───

  /** You reply in a chat (only with what was on offer); their answer gets written. */
  private reply(to: Contact, text: string, now: number): void {
    if (to === 'bank') return; // the bank doesn't chat
    const chat = this.chats[to];
    if (!chat.replies.includes(text)) return;
    chat.messages.push({ text, mine: true });
    chat.replies = []; // your next choices come with their answer
    this.startTyping(to, 'reply', now);
  }

  /** Someone (not whoever texted last) texts you. */
  private textFromSomeone(now: number): void {
    const role = pickOne((Object.keys(ROLES) as Role[]).filter((r) => r !== this.lastTexter));
    this.lastTexter = role;
    this.startTyping(role, 'text', now);
  }

  /** Have Claude write what `who` says (about `news`, if any), in the background: they're typing until it's due. */
  private startTyping(who: Role, kind: 'text' | 'reply', now: number, news?: string, alongside?: Plan): void {
    const chat = this.chats[who];
    chat.typing = true;
    const situation = { role: who, kind, chat: chat.messages, playerName: this.playerName ?? 'the new homeowner', facts: this.describe(now), news };
    writeText(situation).then((talk) => {
      if (!talk) {
        chat.typing = false; // it failed: nothing arrives
        if (alongside) this.schedule(this.minutesAt(Date.now()), alongside); // but what came with it still happens
        return;
      }
      const due = Math.max(this.minutesAt(Date.now()), this.minutesAt(now + ANSWER_MS));
      this.schedule(due, { kind: 'text', from: who, talk });
      if (alongside) this.schedule(due, alongside);
    });
  }

  /** A text arrives: into the chat, unread, with your new choices; and their role's mood rubs off on you. */
  private deliverText(from: Role, talk: Talk): Happening[] {
    const chat = this.chats[from];
    chat.replies = talk.replies;
    chat.typing = false;
    chat.messages.push({ text: talk.text });
    chat.unread++;
    this.changeHealth(PERSONALITIES[from].mood);
    return [{ type: 'text', from, text: talk.text }];
  }

  /** How the game is going, in a few sentences, for Claude. */
  private describe(now: number): string {
    const hour = Math.floor((this.minutesAt(now) % DAY) / 60);
    const titles = (status: JobState['status']) => JOBS.filter((j) => this.jobs[j.id].status === status).map((j) => j.title.toLowerCase());
    const working = titles('working');
    const done = titles('done');
    return [
      `Day ${this.dayAt(now)} of the ${this.quoted.days}-day quote so far, about ${hour}:00. Spent $${Math.round(this.money)} of the contractor's $${this.quoted.money} quote so far. The player's mood: ${Math.round(this.health * 100)}%.`,
      working.length ? `Working on: ${working.join(', ')}.` : 'No job started yet.',
      done.length ? `Done: ${done.join(', ')}.` : '',
    ].join(' ');
  }

  // ─── visits ───

  /** Someone comes over to a level for a while, and texts that they're on their way. */
  private comeOver(now: number): void {
    const role = pickOne((Object.keys(ROLES) as Role[]).filter((r) => !this.visitors.has(r)));
    const level = pickOne(LEVELS);
    const minutes = this.minutesAt(now);
    this.schedule(minutes, { kind: 'visit', role, level });
    this.schedule(minutes + VISIT, { kind: 'leave', role });
    this.startTyping(role, 'text', now, `They're dropping by the house to see how it's going (they'll be in the ${level === 'Ground' ? 'ground floor' : level.toLowerCase()} for a bit).`);
  }

  // ─── jobs ───

  /** A job appears (on its day, or after the one it follows), and someone tells you about it. */
  private revealJob(id: string, now: number): Happening[] {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (job?.status !== 'hidden' || !info) return [];
    job.status = 'open';
    this.startTyping(info.appears?.from ?? 'partner', 'text', now, info.appears?.news ?? `A new problem in the house: ${info.title.toLowerCase()}.`);
    return [];
  }

  /** A fix you cut corners on breaks: its last step needs doing again, and the partner lets you know. */
  private breakJob(id: string, now: number): Happening[] {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (job?.status !== 'done' || !info) return [];
    job.status = 'open';
    job.done = info.steps.length - 1;
    job.cornersCut = 0;
    this.addTrouble(2, now);
    this.startTyping('partner', 'text', now, `The ${info.title.toLowerCase()} the player did already broke.`);
    return [];
  }

  /** Take on a job. */
  private startJob(id: string, now: number): void {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (job?.status !== 'open' || !info) return;
    job.status = 'working';
    const { days, money } = info.quote;
    // The budget grows when their text lands, so the meter and the quote arrive together.
    this.startTyping('contractor', 'text', now, `Their quote for ${info.title.toLowerCase()}: ${days} days, $${money}. The whole quote is now ${this.quoted.days + days} days, $${this.quoted.money + money}.`, { kind: 'quote', days, money });
  }

  /** Do the job's next step: it takes time and materials, unless a surprise comes up first. */
  private doStep(id: string, now: number): Happening[] {
    const job = this.jobs[id];
    if (job?.status === 'open') this.startJob(id, now); // doing a step means you've started
    if (job?.status !== 'working' || job.surprise) return [];
    const tool = JOBS.find((j) => j.id === id)?.steps[job.done]?.tool;
    if (tool && !this.tools.has(tool)) return []; // buy it first
    const quality = tool ? this.tools.get(tool) : undefined;
    if (quality === 'cheap') {
      job.cornersCut++; // a cheap tool is a corner cut
      this.addTrouble(1, now);
    }
    const chance = quality === 'premium' ? SURPRISE_CHANCE / 2 : SURPRISE_CHANCE; // the fancy one helps a bit
    if (job.surprises.length && Math.random() < chance) {
      job.surprise = job.surprises.shift() ?? null;
      job.hint = this.hintFor(job);
      return [];
    }
    return this.finishStep(id);
  }

  /** Your answer to the surprise: it costs its price (job.json), then the step gets done. */
  private answerSurprise(id: string, option: number, now: number): Happening[] {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (!job?.surprise || !info) return [];
    const quality = job.surprise.answers[option] ?? 'ok';
    const outcome = OUTCOMES[quality];
    if (quality === 'wrong' || quality === 'excessive') this.addTrouble(1, now);
    job.cornersCut += quality === 'ok' ? 1 : quality === 'wrong' ? 2 : 0;
    const money = job.surprise.costs[option] ?? 0;
    this.spend(job, money);
    const charged = this.chargeCard(money, `${info.title.toLowerCase()} (an unexpected fix)`);
    this.extraMinutes += outcome.days * DAY;
    this.changeHealth(outcome.health);
    job.surprise = null;
    return [{ type: 'outcome', job: id, quality, text: outcome.text, money, days: outcome.days }, ...charged, ...this.finishStep(id)];
  }

  /** A step done: its time and materials; the last one finishes the job (which may break later, if you cut corners;
   * and other jobs may follow it). */
  private finishStep(id: string): Happening[] {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (!info) return [];
    this.extraMinutes += info.steps[job.done].minutes;
    this.spend(job, Math.round((info.quote.money * MATERIALS) / info.steps.length));
    job.done++;
    if (job.done < info.steps.length) return [];
    job.status = 'done';
    this.changeHealth(JOB_DONE_HEALTH);
    if (Math.random() < PHONE_CRACK_CHANCE) this.phoneCracked = true; // celebrated a bit too hard
    const minutes = this.minutesAt(Date.now());
    if (Math.random() < job.cornersCut * BREAK_PER_CORNER) this.schedule(minutes + DAY * (1 + Math.random() * 2), { kind: 'break', job: id });
    for (const next of JOBS.filter((j) => j.appears?.after === id)) this.schedule(minutes + 60 / TROUBLE_PACE, { kind: 'appear', job: next.id });
    return [{ type: 'finished', job: id }];
  }

  // ─── the contractor ───

  /** Trouble piles up: the contractor's price to take over climbs, and they make sure you know. */
  private addTrouble(by: number, now: number): void {
    this.trouble += by;
    const { money, days } = { money: this.writeBill().total, days: this.takeoverDays() };
    this.startTyping('contractor', 'text', now, `Their price to take over just went up: $${money}, ${days} days. They're still available.`);
  }

  /** What the contractor charges to take over now: a rush price on every job left, a share for fixing each job you
   * did, and the call-out. */
  private writeBill(): Bill {
    const rush = RUSH + RUSH_PER_TROUBLE * Math.min(this.trouble, 10);
    const round = (n: number) => Math.round(n / 10) * 10;
    const lines = [
      ...JOBS.filter((j) => ['open', 'working'].includes(this.jobs[j.id].status)).map((j) => ({ title: j.title, money: round(j.quote.money * rush), note: 'rush job' })),
      ...JOBS.filter((j) => this.jobs[j.id].status === 'done').map((j) => ({ title: j.title, money: round(j.quote.money * FIX_YOUR_FIX), note: 'fixing your fix' })),
      { title: 'Call-out fee', money: CALL_OUT, note: 'you called' },
    ];
    return { lines, total: lines.reduce((sum, l) => sum + l.money, 0), spent: Math.round(this.money) };
  }

  /** How long the contractor would take: the jobs left, plus a day for every two bits of trouble. */
  private takeoverDays(): number {
    const left = JOBS.filter((j) => ['open', 'working'].includes(this.jobs[j.id].status));
    return left.reduce((sum, j) => sum + j.quote.days, 0) + 1 + Math.floor(this.trouble / 2);
  }

  // ─── the store ───

  /** Buy a tool: its price, the trip there and back, and the clerk's opinion. */
  private buyTool(id: string, option: number): Happening[] {
    const pick = TOOLS[id]?.options[option];
    if (!pick || this.tools.has(id)) return [];
    this.tools.set(id, pick.quality);
    this.money += pick.price;
    this.extraMinutes += STORE_TRIP;
    return [{ type: 'bought', tool: id, text: BOUGHT[pick.quality] }, ...this.chargeCard(pick.price, 'the hardware store')];
  }

  // ─── you ───

  /** Money spent on a job: on the job's bill, and on yours. */
  private spend(job: JobState, money: number): void {
    job.spent += money;
    this.money += money;
  }

  /** Health goes up or down, between 0 (you burned out: the game's over) and 100%. */
  private changeHealth(by: number): void {
    this.health = Math.min(1, Math.max(0, this.health + by));
  }

  /** How it went, against the contractor's quote (the end screen shows it). */
  private writeReport(now: number): Report {
    const jobs = JOBS.filter((j) => this.jobs[j.id].status !== 'hidden');
    return {
      days: this.dayAt(now) - 1,
      quote: this.quoted,
      spent: Math.round(this.money),
      jobsDone: jobs.filter((j) => this.jobs[j.id].status === 'done').length,
      jobs: jobs.length,
      cornersCut: Object.values(this.jobs).reduce((sum, j) => sum + j.cornersCut, 0),
    };
  }

  // ─── the bank ───

  /** The bank texts every charge on your card (not the materials, which are a running tab). */
  private chargeCard(money: number, where: string): Happening[] {
    if (!money) return [];
    const text = `Card charged $${money.toLocaleString('en-US')} at ${where}.`;
    const chat = this.chats.bank;
    chat.messages.push({ text });
    chat.unread++;
    return [{ type: 'text', from: 'bank', text }];
  }

  // ─── prep (the phone's WeTube and AskBot) ───

  /** Watch a job's video (its length in game time) or ask AskBot (quick); either helps with its surprises. */
  private prep(id: string, how: 'watched' | 'asked'): Happening[] {
    const job = this.jobs[id];
    const info = JOBS.find((j) => j.id === id);
    if (!job || !info || job[how] || job.status === 'hidden') return [];
    job[how] = true;
    this.extraMinutes += how === 'watched' ? info.prep.video.minutes : ASK_MINUTES;
    if (job.surprise && !job.hint) job.hint = this.hintFor(job); // the surprise that's already up
    return [];
  }

  /** What your prep says about the surprise that's up: a video shows you the right answer; AskBot, half the time. */
  private hintFor(job: JobState): Surprise['hint'] {
    const good = job.surprise?.answers.indexOf('good') ?? -1;
    if (good < 0) return undefined;
    if (job.watched) return { option: good, from: 'video' };
    if (job.asked) return Math.random() < ASKBOT_RIGHT ? { option: good, from: 'ask' } : { skipped: true };
    return undefined;
  }

  /** What your prep recommends at the store for a tool: the video, the right one; AskBot, whatever it read first. */
  private tipsFor(tool: string): { video?: number; ask?: number } {
    const jobs = JOBS.filter((j) => j.steps.some((s) => s.tool === tool)).map((j) => this.jobs[j.id]);
    const right = TOOLS[tool].options.findIndex((o) => o.quality === 'right');
    return {
      video: jobs.some((j) => j.watched) ? right : undefined,
      ask: jobs.some((j) => j.asked) ? TOOLS[tool].askbot : undefined,
    };
  }
}

/** Everyone's chat at the start: empty (they text once you're playing), and the bank's welcome. */
function startChats(): Record<Contact, Chat> {
  const chats = {} as Record<Contact, Chat>;
  for (const role of Object.keys(ROLES) as Role[]) chats[role] = { messages: [], unread: 0, replies: [], typing: false };
  chats.bank = { messages: [{ text: "We'll text you if your card does anything weird." }], unread: 0, replies: [], typing: false };
  return chats;
}

/** A shuffled copy. */
function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One of them, at random. */
function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
