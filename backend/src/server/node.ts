// Adapter: lets a standard-Request handler run on Node's http server (and Vite's dev server).

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Handler } from './http';

const MAX_BYTES = 1_000_000; // hard stop for runaway uploads; the handler enforces the real limit

export function nodeListener(handler: Handler) {
  return async (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse): Promise<void> => {
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'body_too_large', message: 'request body is too large' } }));
          return;
        }
        chunks.push(chunk as Buffer);
      }

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
        else if (v !== undefined) headers.set(k, v);
      }
      const method = req.method ?? 'GET';
      // Vite's middleware strips the mount path from req.url; originalUrl keeps the whole thing.
      const url = new URL(req.originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const hasBody = method !== 'GET' && method !== 'HEAD';

      const response = await handler(
        new Request(url, { method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }),
      );

      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error('DIWhy API: adapter error', err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'internal_error', message: 'something went wrong on the server' } }));
    }
  };
}
