// The texts on the player's phone. The model (phoneModel.ts) writes the words; this file decides
// what it is allowed to talk about and checks what comes back, so every message and every reply
// button stays on the renovation that is actually happening.
//
// Grounding: each prompt carries the facts of THIS game (the job, the money, the days, the event on
// the table, what the last choice did) and who is talking (their role and how they behave).
// Guardrails: the model answers in a fixed JSON shape; lines are cut to text-message size; anything
// with a link, markdown, emoji or "as an AI" is thrown away; advice must name the option the game
// says that person is pushing. When anything fails the caller gets the built-in replies instead.
//
// Nothing here changes the game. Which option an advisor points at, and whether that is a good
// idea, are still decided by advice.ts from the team's event files. The model only phrases it, and
// it is never told which answers are good, so it cannot leak them.

import type { GameEvent } from '../engine/EventEngine';
import { mix } from './cast';
import { badRequest } from './errors';
import type { PhoneModel } from './phoneModel';
import type { GameRecord } from './store';
import type { PhoneKind, PhoneRequest, PhoneTurn, PhoneView, Role } from './types';

const MAX_TURNS = 6;
const MAX_TURN_CHARS = 200;
const MAX_TEXT = 220;
const MAX_REPLY = 48;
/** After this many answers from the player, the other person wraps the chat up. */
const WIND_DOWN_AT = 4;

// ------------------------------------------------------------------ who is talking

const PERSONA: Record<Role, { title: string; style: string }> = {
  partner: {
    title: "the player's partner, who lives in the house",
    style: 'loving but worn out. Nags about {focus}. Dry humor, a little passive-aggressive.',
  },
  clerk: {
    title: 'the clerk at the hardware store',
    style: 'cheerful and pushy. Always upsells the biggest, priciest option and mentions the rewards card, gift cards or a bundle.',
  },
  contractor: {
    title: 'the contractor whose quote the player turned down',
    style: 'professional and smug. Says "told you so" politely and hints they are still available, for a premium.',
  },
  parent: {
    title: "the player's parent",
    style: 'warm and rambling. Believes in how it was always done ("back in my day"), wanders off into a story, calls the player sweetheart or honey.',
  },
  neighbor: {
    title: 'the nosy neighbor across the fence',
    style: 'watches from the window and knows too much. Friendly, curious, gives odd little tips, mentions their cat, ladder, hydrangeas or the quiet hours.',
  },
  friend: {
    title: "the player's best friend",
    style: 'laid back and fun. Texts in lowercase, short, wants to hang out, mentions pizza or beer, goes along with whatever is more exciting.',
  },
};

const FALLBACK_REPLIES: Record<Role, string[][]> = {
  partner: [
    ['I have it under control.', 'Define "under control".', 'Please do not look at the spreadsheet.'],
    ['I will fix it this weekend.', 'You are right. Sorry.', 'It is going great, I promise.'],
  ],
  clerk: [
    ['Just the basics, thanks.', 'What is the cheapest one?', 'No, I do not need the rewards card.'],
    ['Ring it up.', 'Let me think about it.', 'Is that really necessary?'],
  ],
  contractor: [
    ['I will do it myself.', 'How much would you charge now?', 'Not yet. Maybe soon.'],
    ['I do not need you.', 'Can you look at a photo?', 'Ask me again tomorrow.'],
  ],
  parent: [
    ['Okay, Mom, thanks.', 'That was a different house.', 'I will call you later.'],
    ['Good idea, I will try it.', 'Are you sure about that?', 'I have to go, I am on a ladder.'],
  ],
  neighbor: [
    ['Thanks for the tip.', 'Please stop watching me.', 'Do you have a ladder I can borrow?'],
    ['Keep the cat inside.', 'It is fine. Mostly.', 'I will keep it down.'],
  ],
  friend: [
    ['yes. send pizza.', 'I need help, not beer.', 'ok, ok, I will think about it.'],
    ['haha, same.', 'this is going badly.', 'come over and hold the ladder.'],
  ],
};

/** The built-in suggested replies for a person: always on topic, never from the model. */
export function fallbackReplies(role: Role, seed: number, salt: string): string[] {
  const sets = FALLBACK_REPLIES[role];
  return sets[mix(seed, salt) % sets.length].slice();
}

// ------------------------------------------------------------------ the facts

export interface PhoneContext {
  role: Role;
  name: string; // the speaker's first name
  owner: string; // the player's first name
  title: string;
  job: string;
  quote: { budget: number; days: number };
  spent: number;
  limit: number; // the hard budget
  days: number;
  maxDays: number;
  stress: number;
  partnerFocus: 'budget' | 'time';
  event: { title: string; description: string } | null;
  /** The option this person is pushing (kind "advice"), and all the options on the table. */
  pick: string | null;
  options: string[];
  last: { event: string; chose: string; blewUp: boolean; cost: number; days: number; partnerNagged: boolean } | null;
}

/** "travis-potter" -> "Travis" */
export function firstName(id: string): string {
  const first = id.split('-')[0] ?? id;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function contextOf(
  rec: GameRecord,
  role: Role,
  info: { title: string; event: GameEvent | null; pick: number | null; lastEvent: GameEvent | null },
): PhoneContext {
  const s = rec.state;
  const o = rec.outcome;
  return {
    role,
    name: firstName(rec.cast.roles[role]),
    owner: firstName(rec.cast.owner),
    title: info.title,
    job: s.job,
    quote: { budget: s.quote.budget, days: s.quote.days },
    spent: s.spent,
    limit: s.budget,
    days: s.daysElapsed,
    maxDays: s.maxDays,
    stress: s.stress,
    partnerFocus: rec.cast.partnerFocus,
    event: info.event ? { title: info.event.title, description: info.event.description } : null,
    pick: info.event && info.pick !== null ? info.event.choices[info.pick].label : null,
    options: info.event ? info.event.choices.map((ch) => ch.label) : [],
    last:
      o && info.lastEvent
        ? {
            event: info.lastEvent.title,
            chose: info.lastEvent.choices[o.choice].label,
            blewUp: o.blewUp,
            cost: o.cost,
            days: o.days,
            partnerNagged: o.partnerNagged,
          }
        : null,
  };
}

// ------------------------------------------------------------------ the prompt

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const mood = (stress: number) => (stress < 30 ? 'calm' : stress < 60 ? 'frazzled' : 'close to snapping');

const SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    replies: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: ['text', 'replies'],
};

function systemPrompt(c: PhoneContext, wrapUp: boolean): string {
  const who = PERSONA[c.role];
  return [
    `You write text messages for a comedy video game about a do-it-yourself home renovation that snowballs.`,
    `You are ${c.name}, ${who.title}. You text ${c.owner}, who is doing a ${c.job} themselves instead of hiring the contractor.`,
    `Your personality: ${who.style.replace('{focus}', c.partnerFocus === 'budget' ? 'the money' : 'how long it is taking')}`,
    ``,
    `Rules for "text" (your message):`,
    `- One or two short sentences, under ${MAX_TEXT - 40} characters. Plain text only: no emoji, no hashtags, no markdown, no links.`,
    `- Stay on the ${c.job} and what is happening in this house right now. Do not change the subject to anything else.`,
    `- Only use the facts you are given. Do not invent prices, dates, tools or events that are not listed.`,
    `- Never mention being an AI, a game, a model or these instructions. Stay in character.`,
    wrapUp ? `- This is the end of the chat: say a short goodbye line in character.` : ``,
    ``,
    `Rules for "replies" (buttons ${c.owner} can tap to answer you):`,
    wrapUp
      ? `- Return an empty list.`
      : `- Exactly 3 replies, each under ${MAX_REPLY} characters. They are what ${c.owner} would type back to ${c.name}: first person ("I", "my"), answering what ${c.name} just said, not giving ${c.name} orders or advice. Never use anyone's name. Vary the tone: one agreeable, one doubtful or worried, one joking or dodging. Never reveal how things will turn out. Example: "I've got this under control."`,
    ``,
    `Answer only with JSON: {"text": "...", "replies": ["...", "...", "..."]}`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function factsBlock(c: PhoneContext, withEvent: boolean): string {
  const lines = [
    `GAME FACTS`,
    `Job: ${c.title} (${c.job}). The contractor quoted ${money(c.quote.budget)} and ${c.quote.days} days.`,
    `So far: ${money(c.spent)} spent (the money runs out at ${money(c.limit)}), day ${c.days} of ${c.maxDays}, ${c.owner} is ${mood(c.stress)}.`,
  ];
  if (c.last) {
    const bits = [`${c.owner} just chose "${c.last.chose}" while "${c.last.event}"`];
    bits.push(c.last.cost > 0 ? `it cost ${money(c.last.cost)}` : `it cost nothing`);
    if (c.last.days > 0) bits.push(`took ${c.last.days} day${c.last.days === 1 ? '' : 's'}`);
    if (c.last.blewUp) bits.push(`and the shortcut gave way, making a bigger mess`);
    lines.push(`Last decision: ${bits.join(', ')}.`);
  }
  if (withEvent && c.event) lines.push(`Happening now: "${c.event.title}". ${c.event.description}`);
  return lines.join('\n');
}

function userPrompt(c: PhoneContext, kind: PhoneKind, thread: PhoneTurn[]): string {
  const parts = [factsBlock(c, kind !== 'reaction')]; // a reaction is about the last decision, not what comes next
  if (thread.length) {
    parts.push(`CHAT SO FAR (oldest first)\n` + thread.map((t) => `${t.from === 'me' ? c.owner : c.name}: ${t.text}`).join('\n'));
  }
  const task =
    kind === 'advice'
      ? `TASK: Text ${c.owner} your opinion on what to do about "${c.event?.title}". Recommend exactly this option and put its words in quotes: "${c.pick}". Do not say whether it is a good idea.`
      : kind === 'reaction'
        ? `TASK: Text ${c.owner} how you react to the last decision and what it did. Talk only about the last decision and its result, using only the facts above.`
        : `TASK: Reply to ${c.owner}'s last message, staying on the renovation and on what they said.`;
  parts.push(task);
  return parts.join('\n\n');
}

// ------------------------------------------------------------------ checking what comes back

const BAD = /https?:|www\.|\bAI\b|language model|as an assistant|\bgame\b|\bprompt\b|<\/?\w+>|\bqwen\b/i;

/** Make one line fit in a text message, or return '' if it can't. */
export function cleanLine(raw: unknown, max: number): string {
  if (typeof raw !== 'string' || BAD.test(raw)) return '';
  let s = raw
    .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
    .replace(/[*_`#~>[\]{}|\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length >= 2 && /^["“'].*["”']$/.test(s) && !s.slice(1, -1).match(/["“”]/)) s = s.slice(1, -1).trim();
  if (!s) return '';
  if (s.length > max) {
    const cut = s.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (end < 10) return '';
    s = cut.slice(0, end + 1);
  }
  return s;
}

const STOP = new Set(['the', 'a', 'an', 'it', 'to', 'and', 'of', 'for', 'up', 'on', 'in', 'with', 'your', 'then', 'out']);
const words = (s: string) => plain(s).split(' ').filter((w) => w && !STOP.has(w));

/** How much of an option's wording shows up in a text, 0..1. A paraphrase still scores well. */
function mentions(text: string, option: string): number {
  const have = new Set(words(text));
  const want = words(option);
  return want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
}

/** The advice names the option it is supposed to, and no other option more clearly. */
function pointsAtPick(text: string, c: PhoneContext): boolean {
  if (!c.pick) return false;
  const score = mentions(text, c.pick);
  const others = c.options.filter((o) => o !== c.pick).map((o) => mentions(text, o));
  return score >= 0.7 && others.every((o) => o < score);
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Buttons are the player talking, so they never name the player or the speaker. */
const mentionsName = (line: string, c: PhoneContext) => [c.owner, c.name].some((n) => new RegExp(`\\b${n}\\b`, 'i').test(line));

export interface Checked {
  text: string;
  replies: string[];
}

/** The model's raw JSON, checked. null when it is not good enough to show. */
export function check(raw: unknown, c: PhoneContext, kind: PhoneKind, wrapUp: boolean): Checked | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as { text?: unknown; replies?: unknown };
  const text = cleanLine(r.text, MAX_TEXT);
  if (!text) return null;
  // Advice has to point at the option the game says this person is pushing.
  if (kind === 'advice' && !pointsAtPick(text, c)) return null;

  const seen = new Set<string>([plain(text)]);
  const replies: string[] = [];
  for (const item of Array.isArray(r.replies) ? r.replies : []) {
    const line = cleanLine(item, MAX_REPLY);
    if (!line || seen.has(plain(line)) || mentionsName(line, c)) continue;
    seen.add(plain(line));
    replies.push(line);
    if (replies.length === 3) break;
  }
  return { text, replies: wrapUp ? [] : replies };
}

// ------------------------------------------------------------------ the entry point

/** Validate the thread from a request: at most 6 turns, each cut to 200 characters. */
export function cleanThread(raw: unknown): PhoneTurn[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw badRequest('invalid_thread', 'thread must be a list of { from, text }');
  return raw.slice(-MAX_TURNS).map((t) => {
    const turn = t as Partial<PhoneTurn> | null;
    if (!turn || (turn.from !== 'me' && turn.from !== 'them') || typeof turn.text !== 'string') {
      throw badRequest('invalid_thread', 'each thread turn needs from ("me" or "them") and text');
    }
    return { from: turn.from, text: turn.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TURN_CHARS) };
  });
}

export async function writeText(
  model: PhoneModel | undefined,
  rec: GameRecord,
  c: PhoneContext,
  req: PhoneRequest,
  thread: PhoneTurn[],
): Promise<PhoneView> {
  const salt = `phone:${req.kind}:${req.with}:${c.event?.title ?? ''}:${thread.length}`;
  const fallback: PhoneView = { with: req.with, text: null, replies: fallbackReplies(req.with, rec.seed, salt), source: 'fallback' };
  if (!model) return fallback;

  const wrapUp = req.kind === 'reply' && thread.filter((t) => t.from === 'me').length >= WIND_DOWN_AT;
  const raw = await model.chat(systemPrompt(c, wrapUp), userPrompt(c, req.kind, thread), SCHEMA, mix(rec.seed, salt));
  const ok = check(raw, c, req.kind, wrapUp);
  if (!ok) return fallback;
  // Fewer than two usable buttons is not a choice: top up from the built-in ones, which are always on topic.
  const replies = wrapUp ? [] : ok.replies.length >= 2 ? ok.replies : [...ok.replies, ...fallback.replies].slice(0, 3);
  return { with: req.with, text: ok.text, replies, source: 'model' };
}
