// Test support (not part of the game). Fakes for the model server and a way to run the real
// backend in-process so UI tests need no network.

import { readFileSync, readdirSync } from 'node:fs';
import { buildProjects, type Project } from './content/projects';
import { createApp, type App, type AppOptions } from './server/app';
import type { Handler } from './server/http';

/** The six real projects, built from the team's actual events/*.csv. */
export function realProjects(): Project[] {
  const dir = new URL('../../events/', import.meta.url);
  const files = Object.fromEntries(
    readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
  );
  return buildProjects(files);
}

/** A fake Jev model server: gives every option in the request an equal chance. */
export function fakeModel() {
  const calls: Array<{ state: string; questions: Record<string, { criteria: Record<string, null> }> }> = [];
  const fetch = async (_url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(init.body as string);
    calls.push(body);
    const ids = Object.keys(body.questions.next_event.criteria);
    const probabilities = Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
    return {
      ok: true,
      status: 200,
      json: async () => ({ answers: { next_event: { type: 'choice', choice: ids[0], probabilities } } }),
    } as Response;
  };
  return { fetch, calls };
}

/** A backend whose jev director talks to the fake model. */
export function appWithFakeModel(extra: AppOptions = {}): App & { model: ReturnType<typeof fakeModel> } {
  const model = fakeModel();
  const app = createApp({ jev: { url: 'http://model', fetch: model.fetch }, ...extra });
  return { ...app, model };
}

/** A fetch() that sends requests straight to the handler. Records every URL it sees. */
export function bridgeFetch(handler: Handler): typeof fetch & { urls: string[] } {
  const urls: string[] = [];
  const bridged = (async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    return handler(new Request(new URL(String(input), 'http://localhost'), init));
  }) as typeof fetch & { urls: string[] };
  bridged.urls = urls;
  return bridged;
}
