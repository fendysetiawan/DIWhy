// Start a Node server for a handler. Shared by the two entry points.

import { createServer } from 'node:http';
import type { Handler } from './http';
import { nodeListener } from './node';

export function listen(handler: Handler, what: string, env: Record<string, string | undefined> = process.env): void {
  const port = Number(env.PORT ?? 3001);
  const host = env.HOST ?? '127.0.0.1';
  const server = createServer(nodeListener(handler));
  server.listen(port, host, () => console.log(`${what} on http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
