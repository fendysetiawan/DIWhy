// Serves the front-end folders (assets/, frontend/, app/) so the whole game runs from one address.
// Written against Request/Response like the API handler. Only the listed folders are reachable,
// and nothing outside them: no "..", no dotfiles, no symlink escapes.

import { readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { Handler } from './http';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

export interface StaticOptions {
  root: string; // the repo root
  folders: string[]; // top-level folders to serve, e.g. ['assets', 'frontend', 'app']
  entry: string; // where "/" redirects to, e.g. '/app/'
}

export function createStaticHandler(opts: StaticOptions): Handler {
  const root = realpathSync(resolve(opts.root));
  const allowed = new Set(opts.folders);

  return async (req) => {
    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return text(405, 'method not allowed', { Allow: 'GET, HEAD' });

    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url).pathname);
    } catch {
      return text(400, 'bad path');
    }
    if (path === '/') return new Response(null, { status: 302, headers: { Location: opts.entry } });

    const parts = path.split('/').filter(Boolean);
    const unsafe = parts.some((p) => p === '..' || p === '.' || p.startsWith('.') || p.includes('\0') || p.includes('\\'));
    if (unsafe || !allowed.has(parts[0])) return text(404, 'not found');

    let file = join(root, ...parts);
    try {
      if (statSync(file).isDirectory()) {
        if (!path.endsWith('/')) return new Response(null, { status: 301, headers: { Location: path + '/' } });
        file = join(file, 'index.html');
      }
      const real = realpathSync(file); // follows symlinks, so an escape is caught here
      if (real !== root && !real.startsWith(root + sep)) return text(404, 'not found');
      const body = readFileSync(real);
      const headers = {
        'Content-Type': TYPES[extname(real).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': String(body.length),
        'Cache-Control': 'no-cache', // the team edits these files constantly
      };
      return new Response(method === 'HEAD' ? null : body, { status: 200, headers });
    } catch {
      return text(404, 'not found');
    }
  };
}

const text = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });
