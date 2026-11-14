// Standalone backend. Start with `npm run api`.
//
//   PORT         default 3001
//   HOST         default 127.0.0.1 (set 0.0.0.0 to accept connections from other machines)
//   CORS_ORIGIN  e.g. "*" or "http://localhost:3000". Needed when a front end on another origin calls this.
//   JEV_URL      the Jev model server's /v1/systemone URL. Set to "" to disable the jev director.

import { createServer } from 'node:http';
import { appOptionsFromEnv, createApp } from './app';
import { nodeListener } from './node';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const { handler } = createApp(appOptionsFromEnv(process.env));

const server = createServer(nodeListener(handler));
server.listen(port, host, () => {
  console.log(`DIWhy API listening on http://${host}:${port}/api  (try /api/health)`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
