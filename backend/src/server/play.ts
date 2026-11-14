// The whole game on one address. Start with `npm run play`, then open http://127.0.0.1:3001
//
//   /api/*       the backend
//   /app/        the front door: splash, character select, the story
//   /frontend/   the gameplay screen
//   /assets/     art and brand
//   /demo/       the hands-free demo (add ?demo=1 to /app/)
//
// One address means no CORS settings and no build step for the front-end folders: edit a file,
// refresh the page. Event CSVs are re-read for each new game. Same settings as the API server.

import { join } from 'node:path';
import { appOptionsFromEnv, createApp } from './app';
import { repoRoot } from './events';
import { listen } from './listen';
import { createSiteHandler } from './site';
import { createStaticHandler } from './static';

const root = repoRoot(process.env);
const api = createApp(appOptionsFromEnv(process.env)).handler;
const files = createStaticHandler({ root, folders: ['app', 'frontend', 'assets', 'demo'], entry: '/app/' });

console.log(`Serving the game from ${join(root)}`);
listen(createSiteHandler(api, files), 'DIWhy game');
