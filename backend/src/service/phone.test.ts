import { describe, expect, it } from 'vitest';
import { GameService } from './GameService';
import { check, cleanLine, firstName, repeatsChat, type PhoneContext } from './phone';

type Answer = unknown | (() => Response | Promise<Response>);

/** A stand-in for Ollama: answers every /api/chat with `answer`, and records what it was sent. */
function fakeOllama(answer: Answer) {
  const sent: Array<{ system: string; user: string; body: Record<string, unknown> }> = [];
  const fetch = async (_url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init.body));
    sent.push({ system: body.messages[0].content, user: body.messages[1].content, body });
    if (typeof answer === 'function') return (answer as () => Response | Promise<Response>)();
    return new Response(JSON.stringify({ message: { content: JSON.stringify(answer) } }), { status: 200 });
  };
  return { fetch, sent };
}

const REPLIES = ['I have this.', 'Is that safe?', 'Maybe the cat can help.'];

async function gameWithAdvice(make: (a: Answer) => GameService, answer: Answer = {}) {
  const svc = make(answer);
  for (let seed = 0; seed < 200; seed++) {
    const g = await svc.createGame({ seed });
    if (g.event?.advice) return { svc, g, advice: g.event.advice };
  }
  throw new Error('no seed has advice on its first event');
}

function service(answer: Answer, opts: { timeoutMs?: number } = {}) {
  const ollama = fakeOllama(answer);
  const svc = new GameService({ phone: { url: 'http://model', fetch: ollama.fetch, ...opts } });
  return { svc, ollama };
}

describe('cleanLine', () => {
  it('tidies a line into text-message shape', () => {
    expect(cleanLine('  **Hello**   there!  ', 50)).toBe('Hello there!');
    expect(cleanLine('"Quoted whole line."', 50)).toBe('Quoted whole line.');
    expect(cleanLine('Good luck 🙂🔧', 50)).toBe('Good luck');
  });
  it('throws away anything off topic or out of character', () => {
    for (const bad of ['See https://example.com', 'As an AI, I cannot', 'This game is fun', 'ok <b>hi</b>', '', 42, null]) {
      expect(cleanLine(bad, 80)).toBe('');
    }
  });
  it('cuts a long line at a sentence end, or rejects it', () => {
    expect(cleanLine('One short sentence. And then a second one that runs well past the limit of the text.', 40)).toBe('One short sentence.');
    expect(cleanLine('x'.repeat(100), 40)).toBe('');
  });
});

describe('check', () => {
  const ctx = (over: Partial<PhoneContext> = {}): PhoneContext => ({
    role: 'neighbor', name: 'Ramy', owner: 'Travis', title: 'Replace the dryer', job: 'dryer replacement',
    quote: { budget: 1000, days: 5 }, spent: 0, limit: 2500, days: 0, maxDays: 12, stress: 0, partnerFocus: 'budget',
    event: null, pick: 'Unplug it and start the replacement',
    options: ['Keep running it with the door open', 'Unplug it and start the replacement', 'Gut the laundry room and start over'],
    last: null, ...over,
  });

  it('accepts advice that names the option it is pushing, even reworded', () => {
    expect(check({ text: 'Unplug it and start the replacement.', replies: REPLIES }, ctx(), 'advice', false)).not.toBeNull();
    expect(check({ text: 'I would unplug that and start on the replacement.', replies: REPLIES }, ctx(), 'advice', false)).not.toBeNull();
  });
  it('rejects advice that points at a different option, or at none', () => {
    expect(check({ text: 'Just keep running it with the door open.', replies: REPLIES }, ctx(), 'advice', false)).toBeNull();
    expect(check({ text: 'Gut the laundry room and start over!', replies: REPLIES }, ctx(), 'advice', false)).toBeNull();
    expect(check({ text: 'Nice weather today.', replies: REPLIES }, ctx(), 'advice', false)).toBeNull();
  });
  it('drops replies that name people, repeat each other, or repeat the text', () => {
    const out = check({ text: 'What a mess.', replies: ['I told you so, Travis.', 'On it.', 'on it!', 'What a mess.', 'Sorry, Ramy.', 'Not my fault.'] }, ctx(), 'reaction', false);
    expect(out?.replies).toEqual(['On it.', 'Not my fault.']);
  });
  it('gives no buttons when the chat is winding down', () => {
    expect(check({ text: 'Bye now.', replies: REPLIES }, ctx(), 'reply', true)?.replies).toEqual([]);
  });
  it('rejects a missing, empty or wrongly shaped answer', () => {
    for (const bad of [null, 'text', 5, {}, { text: '' }, { text: 7 }]) expect(check(bad, ctx(), 'reaction', false)).toBeNull();
  });
});

describe('repeats', () => {
  const thread = [
    { from: 'them' as const, text: 'is there pizza' },
    { from: 'me' as const, text: 'Maybe I should just leave it.' },
  ];
  it('spots a parrot, but not an answer', () => {
    expect(repeatsChat('maybe i should just leave it.', thread)).toBe(true);
    expect(repeatsChat('Honestly, maybe I should just leave it', thread)).toBe(true);
    expect(repeatsChat('leave it and the whole wall comes down, come over and hold the ladder', thread)).toBe(false);
    expect(repeatsChat('ok.', thread)).toBe(false); // too short to be a parrot
  });
  it('rejects a reply that echoes the player', () => {
    const c = { role: 'friend', name: 'Christian', owner: 'Travis', pick: null, options: [] } as unknown as PhoneContext;
    expect(check({ text: 'maybe i should just leave it', replies: [] }, c, 'reply', false, thread)).toBeNull();
    expect(check({ text: 'bad idea, bring the shop vac and I will come over', replies: [] }, c, 'reply', false, thread)).not.toBeNull();
  });
  it('tries again once when the first text is a parrot, then uses the second', async () => {
    let n = 0;
    const fetch = async () =>
      new Response(JSON.stringify({ message: { content: JSON.stringify({ text: n++ === 0 ? 'maybe i should just leave it' : 'nah, come over and I will hold the ladder', replies: ['Okay.', 'Not sure.'] }) } }), { status: 200 });
    const svc = new GameService({ phone: { url: 'http://model', fetch } });
    const g = await svc.createGame({ seed: 5 });
    const v = await svc.phone(g.id, { with: 'friend', kind: 'reply', thread });
    expect(n).toBe(2);
    expect(v.text).toBe('nah, come over and I will hold the ladder');
  });
});

describe('GameService.phone', () => {
  it('names the first name of a character folder', () => {
    expect(firstName('travis-potter')).toBe('Travis');
  });

  it('writes advice from the model, with buttons', async () => {
    const make = (a: Answer) => service(a).svc;
    const probe = await gameWithAdvice(make);
    const pick = probe.g.event!.choices[probe.advice.pick].label;
    const { svc, ollama } = service({ text: `Honestly? ${pick}.`, replies: REPLIES });
    const g = await svc.createGame({ seed: probe.g.seed });
    const v = await svc.phone(g.id, { with: g.event!.advice!.from, kind: 'advice' });
    expect(v).toEqual({ with: g.event!.advice!.from, text: `Honestly? ${pick}.`, replies: REPLIES, source: 'model' });
    const { system, user, body } = ollama.sent[0];
    expect(body).toMatchObject({ model: 'qwen3:8b', stream: false, think: false });
    expect(system).toContain('do-it-yourself home renovation');
    expect(user).toContain(g.event!.title); // grounded in the event on the table
    expect(user).toContain(`"${pick}"`); // and told which option to push
  });

  it('never tells the model which answers are good', async () => {
    const { svc, ollama } = service({ text: 'x', replies: [] });
    const g = await svc.createGame({ seed: 3 });
    await svc.phone(g.id, { with: 'partner', kind: 'reaction' });
    const everything = ollama.sent.map((s) => s.system + s.user).join(' ');
    expect(everything).not.toMatch(/\b(good|excessive)\b answer|answer_key|quality/i);
  });

  it('falls back to the built-in replies when the model is off', async () => {
    const svc = new GameService({ phone: { url: 'http://model', fetch: async () => { throw new Error('connection refused'); } } });
    const g = await svc.createGame({ seed: 1 });
    const v = await svc.phone(g.id, { with: 'friend', kind: 'reaction' });
    expect(v.source).toBe('fallback');
    expect(v.text).toBeNull();
    expect(v.replies.length).toBe(3);
  });

  it('falls back when no model is configured at all', async () => {
    const svc = new GameService();
    expect((await svc.health()).phone).toBe(false);
    const g = await svc.createGame({ seed: 1 });
    expect((await svc.phone(g.id, { with: 'partner', kind: 'reaction' })).source).toBe('fallback');
  });

  it('falls back on a slow model, a bad status and garbage', async () => {
    const cases: Array<[string, Answer]> = [
      ['slow', () => new Promise<Response>(() => {})],
      ['500', () => new Response('nope', { status: 500 })],
      ['not json', () => new Response(JSON.stringify({ message: { content: 'hello' } }), { status: 200 })],
    ];
    for (const [name, answer] of cases) {
      const { svc } = service(answer, { timeoutMs: 20 });
      const g = await svc.createGame({ seed: 2 });
      expect((await svc.phone(g.id, { with: 'partner', kind: 'reaction' })).source, name).toBe('fallback');
    }
  });

  it('falls back when the advice names the wrong option', async () => {
    const make = (a: Answer) => service(a).svc;
    const { g, advice } = await gameWithAdvice(make);
    const wrong = g.event!.choices.find((c) => c.index !== advice.pick)!.label;
    const { svc } = service({ text: `Do this: ${wrong}`, replies: REPLIES });
    const again = await svc.createGame({ seed: g.seed });
    expect((await svc.phone(again.id, { with: advice.from, kind: 'advice' })).source).toBe('fallback');
  });

  it('answers a reply from the thread, and winds the chat down after four taps', async () => {
    const { svc, ollama } = service({ text: 'Ha, good luck.', replies: REPLIES });
    const g = await svc.createGame({ seed: 5 });
    const turn = (n: number) => [
      { from: 'them' as const, text: 'Is it done yet?' },
      ...Array.from({ length: n }, () => ({ from: 'me' as const, text: 'Almost.' })),
    ];
    const first = await svc.phone(g.id, { with: 'neighbor', kind: 'reply', thread: turn(1) });
    expect(first.replies).toEqual(REPLIES);
    expect(ollama.sent[0].user).toContain('CHAT SO FAR');
    expect(ollama.sent[0].user).toContain('Almost.');
    const last = await svc.phone(g.id, { with: 'neighbor', kind: 'reply', thread: turn(4) });
    expect(last.replies).toEqual([]);
  });

  it('keeps only the last 6 turns, each at most 200 characters', async () => {
    const { svc, ollama } = service({ text: 'ok then.', replies: REPLIES });
    const g = await svc.createGame({ seed: 5 });
    const thread = Array.from({ length: 10 }, (_, i) => ({ from: (i % 2 ? 'me' : 'them') as 'me' | 'them', text: `turn${i} ${'x'.repeat(500)}` }));
    thread.push({ from: 'me', text: 'last' });
    await svc.phone(g.id, { with: 'friend', kind: 'reply', thread });
    const user = ollama.sent[0].user;
    expect(user).not.toContain('turn4');
    expect(user).toContain('turn5');
    expect(user).not.toContain('x'.repeat(201));
  });

  it('rejects bad requests', async () => {
    const { svc } = service({ text: 'x', replies: [] });
    const g = await svc.createGame({ seed: 5 });
    const bad = (req: object) => svc.phone(g.id, req as never);
    await expect(bad({ with: 'dog', kind: 'reaction' })).rejects.toMatchObject({ code: 'invalid_role' });
    await expect(bad({ with: 'friend', kind: 'gossip' })).rejects.toMatchObject({ code: 'invalid_kind' });
    await expect(bad({ with: 'friend', kind: 'reply' })).rejects.toMatchObject({ code: 'invalid_thread' });
    await expect(bad({ with: 'friend', kind: 'reply', thread: [{ from: 'them', text: 'hi' }] })).rejects.toMatchObject({ code: 'invalid_thread' });
    await expect(bad({ with: 'friend', kind: 'reaction', thread: 'hi' })).rejects.toMatchObject({ code: 'invalid_thread' });
    await expect(svc.phone('nope', { with: 'friend', kind: 'reaction' })).rejects.toMatchObject({ code: 'game_not_found' });
  });

  it('refuses advice from someone who has none', async () => {
    const { svc } = service({ text: 'x', replies: [] });
    const g = await svc.createGame({ seed: 5 });
    const who = (['partner', 'clerk', 'contractor', 'parent', 'neighbor', 'friend'] as const).find((r) => r !== g.event?.advice?.from)!;
    await expect(svc.phone(g.id, { with: who, kind: 'advice' })).rejects.toMatchObject({ code: 'no_advice' });
  });
});
