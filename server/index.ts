// The server: a Hono app with the API under /api. In production it also serves the built game (dist/).
//   npm run dev   Vite (the app) and this (the API) together; Vite forwards /api here
//   npm start     after npm run build: the game and the API, on one port

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { api } from './routes';
import { prepareTexts } from './texts';

try {
  process.loadEnvFile(); // .env, if there is one (see .env.example)
} catch {}

prepareTexts(); // Claude writes the texts: no sign-in or key, no server

const PORT = Number(process.env.PORT ?? 3000);
const app = new Hono();

app.route('/api', api);

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('/*', serveStatic({ path: './dist/index.html' })); // anything else: the game
}

serve({ fetch: app.fetch, port: PORT }, () => console.log(`API on http://localhost:${PORT}`));
