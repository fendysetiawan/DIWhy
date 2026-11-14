// Builds the backend: service + HTTP handler. The standalone server, the Vite dev server and the
// tests all create it the same way.

import { join } from 'node:path';
import { GameService, type ServiceOptions } from '../service/GameService';
import { projectSource, repoRoot } from './events';
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
    // The team's event files, read fresh for each new game.
    projects: projectSource(env.EVENTS_DIR ?? join(repoRoot(env), 'events')),
    // Set JEV_URL to "" to turn the jev director off.
    jev: env.JEV_URL === '' ? undefined : { url: env.JEV_URL ?? 'http://127.0.0.1:8009/v1/systemone' },
    http: { corsOrigin: env.CORS_ORIGIN },
  };
}
