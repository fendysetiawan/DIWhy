import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Handler } from './http';
import { createSiteHandler } from './site';
import { createStaticHandler } from './static';

// A throwaway "repo": three public folders, plus private things that must never be served.
let root: string;
let handler: Handler;
let linked = false; // Windows only allows symlinks with Developer Mode or admin rights
const get = (path: string, method = 'GET') => handler(new Request(`http://site.test${path}`, { method }));

beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), 'diwhy-static-'));
  root = join(base, 'repo');
  mkdirSync(join(root, 'app', 'screens'), { recursive: true });
  mkdirSync(join(root, 'assets', 'logos'), { recursive: true });
  mkdirSync(join(root, 'frontend'), { recursive: true });
  mkdirSync(join(root, 'backend'), { recursive: true });
  mkdirSync(join(root, 'events'), { recursive: true });
  writeFileSync(join(root, 'app', 'index.html'), '<h1>front door</h1>');
  writeFileSync(join(root, 'app', 'main.js'), 'export {}');
  writeFileSync(join(root, 'app', 'screens', 'splash.css'), 'a{}');
  writeFileSync(join(root, 'assets', 'logos', 'logo.svg'), '<svg/>');
  writeFileSync(join(root, 'assets', '.hidden'), 'dotfile');
  writeFileSync(join(root, 'frontend', 'index.html'), '<h1>game</h1>');
  writeFileSync(join(root, 'backend', 'package.json'), '{"private":"yes"}');
  writeFileSync(join(root, 'events', 'wall.csv'), 'id\n');
  writeFileSync(join(base, 'outside.txt'), 'top secret');
  try {
    symlinkSync(join(base, 'outside.txt'), join(root, 'assets', 'escape.txt')); // points outside the repo
    linked = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
  }
  handler = createStaticHandler({ root, folders: ['app', 'frontend', 'assets'], entry: '/app/' });
});

describe('static files', () => {
  it('serves files with the right content type and no caching', async () => {
    const js = await get('/app/main.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('Content-Type')).toContain('text/javascript');
    expect(js.headers.get('Cache-Control')).toBe('no-cache');
    expect(await js.text()).toBe('export {}');
    expect((await get('/assets/logos/logo.svg')).headers.get('Content-Type')).toBe('image/svg+xml');
    expect((await get('/app/screens/splash.css')).headers.get('Content-Type')).toContain('text/css');
  });

  it('sends "/" to the front door, and a folder to its index.html', async () => {
    const home = await get('/');
    expect(home.status).toBe(302);
    expect(home.headers.get('Location')).toBe('/app/');
    expect(await (await get('/app/')).text()).toBe('<h1>front door</h1>');
    expect(await (await get('/frontend/')).text()).toBe('<h1>game</h1>');
    const noSlash = await get('/frontend');
    expect(noSlash.status).toBe(301);
    expect(noSlash.headers.get('Location')).toBe('/frontend/');
  });

  it('answers HEAD without a body, and refuses to write', async () => {
    const head = await get('/app/main.js', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe('9');
    expect(await head.text()).toBe('');
    const post = await get('/app/main.js', 'POST');
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('404s for things that do not exist', async () => {
    expect((await get('/app/nope.js')).status).toBe(404);
    expect((await get('/assets/logos/')).status).toBe(404); // a folder with no index.html
  });
});

describe('what must never be served', () => {
  it('keeps folders that are not on the list private', async () => {
    for (const path of ['/backend/package.json', '/events/wall.csv', '/.git/config', '/node_modules/x']) {
      expect((await get(path)).status, path).toBe(404);
    }
  });

  it('refuses ".." however it is written', async () => {
    for (const path of [
      '/assets/..%2fbackend%2fpackage.json',
      '/assets/%2e%2e/backend/package.json',
      '/assets/..%5cbackend%5cpackage.json',
      '/app/screens/..%2f..%2fbackend%2fpackage.json',
      '/assets/%2e%2e%2f%2e%2e%2foutside.txt',
    ]) {
      const res = await get(path);
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).not.toContain('private');
    }
  });

  it('refuses dotfiles and null bytes', async () => {
    expect((await get('/assets/.hidden')).status).toBe(404);
    expect((await get('/assets/logos/logo.svg%00.png')).status).toBe(404);
  });

  it('refuses a symlink that leads out of the repo', async (ctx) => {
    if (!linked) ctx.skip(); // this machine may not create symlinks; the check still runs where it can
    const res = await get('/assets/escape.txt');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('secret');
  });

  it('refuses a malformed path', async () => {
    expect((await get('/assets/%E0%A4%A')).status).toBe(400);
  });
});

describe('the whole site', () => {
  it('routes /api to the backend and everything else to files', async () => {
    const api: Handler = async () => new Response('{"from":"api"}');
    const site = createSiteHandler(api, handler);
    expect(await (await site(new Request('http://x/api/health'))).text()).toBe('{"from":"api"}');
    expect(await (await site(new Request('http://x/app/'))).text()).toBe('<h1>front door</h1>');
    expect((await site(new Request('http://x/'))).status).toBe(302);
  });
});
