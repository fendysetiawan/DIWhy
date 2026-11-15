// The phone's texts: Claude writes what each person texts, and your three replies, in their role's voice (roles.ts) and about this
// game. It only ever writes words; the GameMode (GameMode.ts) decides everything else.
//
// Claude is required: sign in once with `ant auth login`, or put an ANTHROPIC_API_KEY in .env (see the README).
// Without either, the server won't start.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Message, Role } from '../shared/game';
import { ROLES } from '../shared/game';
import { PERSONALITIES, PLAYER_PERSONALITY } from './roles';

const MODEL = 'claude-haiku-5-5'; // the fast one: a text is short and simple
const MAX_TEXT = 140;
const MAX_REPLY = 40;
const EXAMPLES = 4; // of their lines, each time

/** What Claude answers with. */
const Answer = z.object({
  text: z.string().describe('Their next text: one short, funny sentence (at most about 15 words), like a real text.'),
  replies: z.array(z.string()).length(3).describe('Three things the player could text back: 2 to 5 words each, each a different tone.'),
});
export type Talk = { text: string; replies: string[] };

/** What Claude needs to know: who's talking, about what, and how the game is going. */
interface Situation {
  role: Role;
  /** text: they text out of the blue. reply: they answer what the player just said. */
  kind: 'text' | 'reply';
  chat: Message[];
  playerName: string;
  facts: string;
  /** Something that just happened that they text about (a fix broke, they're coming over). */
  news?: string;
}

let claude: Anthropic;

// PHONE_BACKEND=ollama writes the texts with a local model instead (OLLAMA_URL, OLLAMA_MODEL), no Claude sign-in needed.
const OLLAMA = process.env.PHONE_BACKEND === 'ollama';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:8b';

/** When the server starts: Claude's credentials are there (the SDK finds a sign-in or a key by itself), or stop. */
export function prepareTexts(): void {
  if (process.env.PHONE_BACKEND === 'ollama') {
    console.log(`Phone texts: written by ${process.env.OLLAMA_MODEL ?? 'qwen3:8b'} on Ollama`);
    return;
  }
  const configDir = process.env.ANTHROPIC_CONFIG_DIR ?? join(homedir(), '.config', 'anthropic');
  if (!process.env.ANTHROPIC_API_KEY && !existsSync(join(configDir, 'credentials'))) {
    throw new Error('The phone texts need Claude. Sign in once: brew install anthropics/tap/ant && ant auth login (see the README).');
  }
  claude = new Anthropic();
  console.log(`Phone texts: written by ${MODEL}`);
}

/** Claude writes their text and your three replies; null if the call fails (they stop typing, nothing arrives). */
export async function writeText(situation: Situation): Promise<Talk | null> {
  if (OLLAMA) return writeTextOllama(situation);
  try {
    const response = await claude.messages.parse(
      {
        model: MODEL,
        max_tokens: 400,
        thinking: { type: 'disabled' }, // a text message: answer straight away
        system: describe(situation),
        messages: [{ role: 'user', content: brief(situation) }],
        output_config: { effort: 'low', format: zodOutputFormat(Answer) },
      },
      { timeout: 15_000, maxRetries: 1 },
    );
    return response.parsed_output ? check(response.parsed_output) : null;
  } catch (error) {
    console.error('Phone texts: Claude failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The same, from a local Ollama model: JSON in the shape of Answer, then the same checks. */
async function writeTextOllama(situation: Situation): Promise<Talk | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        think: false, // Qwen3 would otherwise reason before it answers
        format: z.toJSONSchema(Answer),
        keep_alive: '30m',
        messages: [
          { role: 'system', content: describe(situation) },
          { role: 'user', content: brief(situation) },
        ],
        options: { temperature: 0.8, top_p: 0.9, num_predict: 260 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
    const content = ((await res.json()) as { message?: { content?: string } }).message?.content ?? '';
    const parsed = Answer.safeParse(JSON.parse(content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()));
    return parsed.success ? check(parsed.data) : null;
  } catch (error) {
    console.error('Phone texts: Ollama failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Who they are, how they text, and how your replies sound. */
function describe(situation: Situation): string {
  const personality = PERSONALITIES[situation.role];
  return [
    'You write text messages in DIWHY?!, a funny pixel-art game about a first-time homeowner who turned down the contractor and does every renovation themselves.',
    `You are ${ROLES[situation.role]}: ${personality.who}`,
    `The player is ${situation.playerName}. Stay in character. One short, clever sentence, shorter than the examples, about this house and these renovations. No emoji, no links, never mention being an AI or a game.`,
    `How you text (examples, don't repeat them):\n${pickSome(personality.lines).map((l) => `- ${l}`).join('\n')}`,
    `Also write the player's three possible replies: 2 to 5 words each (they're buttons), each a different tone. The player is ${PLAYER_PERSONALITY.who}, like:\n${pickSome(PLAYER_PERSONALITY.lines).map((l) => `- ${l}`).join('\n')}`,
  ].join('\n\n');
}

/** How the game is going, the chat so far, and what to write. */
function brief(situation: Situation): string {
  const chat = situation.chat
    .slice(-8)
    .map((m) => `${m.mine ? 'Player' : 'You'}: ${m.text}`)
    .join('\n');
  const ask =
    situation.kind === 'reply'
      ? 'Answer what the player just said.'
      : situation.news
        ? `Something just happened; text the player about it: ${situation.news}`
        : 'Text the player something new, out of the blue.';
  return `How the game is going: ${situation.facts}\n\nThe chat so far:\n${chat || '(nothing yet)'}\n\n${ask}`;
}

/** Keep it text-sized and on the rails, or give up. */
function check(answer: z.infer<typeof Answer>): Talk | null {
  const clean = (s: string, max: number) => {
    const one = s.replace(/\s+/g, ' ').trim();
    return one.length <= max ? one : `${one.slice(0, one.lastIndexOf(' ', max - 1))}…`; // cut between words
  };
  const bad = (s: string) => !s || /https?:|as an ai|language model/i.test(s);
  const text = clean(answer.text, MAX_TEXT);
  const replies = answer.replies.map((r) => clean(r, MAX_REPLY)).filter((r) => !bad(r));
  if (bad(text) || replies.length < 3) return null;
  return { text, replies };
}

/** A few lines at random (EXAMPLES of them), so each text gets a different taste of the voice. */
function pickSome(lines: readonly string[]): string[] {
  return [...lines].sort(() => Math.random() - 0.5).slice(0, EXAMPLES);
}
