// Builds the backend: service + HTTP handler. The standalone server, the Vite dev server and the
// tests all create it the same way.

import { join } from 'node:path';
import { GameService, type ServiceOptions } from '../service/GameService';
import { DEFAULT_PHONE_URL } from '../service/phoneModel';
import { projectSource, repoRoot } from './events';
import { FileGameStore } from './fileStore';
import { createHttpHandler, type Handler, type HttpOptions } from './http';

export interface AppOptions extends ServiceOptions {
  http?: HttpOptions;
}

export interface App {
  service: GameService;
  handler: Handler;
}

export function createApp(opts: AppOptions = {}): App {
  const { http, ...serviceOptions } = opts;
  const service = new GameService(serviceOptions);
  return { service, handler: createHttpHandler(service, http) };
}

/** Settings from environment variables, shared by the standalone server and the dev server. */
export function appOptionsFromEnv(env: Record<string, string | undefined>): AppOptions {
  return {
    // Games are saved here, so they survive a restart. Set GAMES_DIR to "" to keep them in memory only.
    store: env.GAMES_DIR === '' ? undefined : new FileGameStore({ dir: env.GAMES_DIR ?? join(repoRoot(env), 'backend', '.games') }),
    // The team's event files, read fresh for each new game.
    projects: projectSource(env.EVENTS_DIR ?? join(repoRoot(env), 'events')),
    // Set JEV_URL to "" to turn the jev director off.
    jev: env.JEV_URL === '' ? undefined : { url: env.JEV_URL ?? 'http://127.0.0.1:8009/v1/systemone' },
    // The local model that writes the phone texts. Set PHONE_URL to "" to turn it off, PHONE_MODEL to use another one.
    phone: env.PHONE_URL === '' ? undefined : { url: env.PHONE_URL ?? DEFAULT_PHONE_URL, model: env.PHONE_MODEL, timeoutMs: env.PHONE_TIMEOUT_MS ? Number(env.PHONE_TIMEOUT_MS) : undefined },
    http: { corsOrigin: env.CORS_ORIGIN },
  };
}
