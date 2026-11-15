// Run on purpose: LIVE_PHONE=1 npx vitest run src/service/phone.live.test.ts --disable-console-intercept
import { describe, it } from 'vitest';
import { GameService } from './GameService';
import { projectSource } from '../server/events';
import { join } from 'node:path';

describe.skipIf(!process.env.LIVE_PHONE)('live phone model', () => {
  it('writes texts', async () => {
    const svc = new GameService({ phone: { url: 'http://127.0.0.1:11434' }, projects: projectSource(join(process.cwd(), '..', 'events')) });
    let g = await svc.createGame({ seed: 7, project: 'dryer-replacement', owner: 'travis-potter' });
    for (let n = 0; n < 3 && g.event; n++) {
      console.log('EVENT', g.event.title, '|', g.event.choices.map((c) => c.label).join(' / '), '| advice', JSON.stringify(g.event.advice));
      if (g.event.advice) {
        const t0 = Date.now();
        const v = await svc.phone(g.id, { with: g.event.advice.from, kind: 'advice' });
        console.log('ADVICE', Date.now() - t0, 'ms', JSON.stringify(v));
      }
      g = await svc.choose(g.id, { choice: 0 });
      for (const who of ['partner', 'parent'] as const) {
        const v = await svc.phone(g.id, { with: who, kind: 'reaction' });
        console.log('REACTION', who, JSON.stringify(v));
      }
    }
    const v = await svc.phone(g.id, { with: 'neighbor', kind: 'reply', thread: [{ from: 'them', text: 'Heard a crash. Everyone okay?' }, { from: 'me', text: 'I have it under control.' }] });
    console.log('REPLY', JSON.stringify(v));
  }, 120000);
});
