// @vitest-environment jsdom
// The reference front end in a simulated browser, talking to the real backend in-process
// (every fetch goes straight to the HTTP handler). Dev code is mocked here, so these tests prove
// the plain game never needs it. The real dev module is exercised in src/dev/dev.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './server/app';
import { bridgeFetch } from './testing';

const text = () => document.getElementById('app')!.textContent ?? '';
const settle = () => vi.waitFor(() => expect(document.querySelector('.thinking')).toBeNull());

async function boot(url: string, fetchImpl?: typeof fetch) {
  const bridge = bridgeFetch(createApp().handler);
  vi.stubGlobal('fetch', fetchImpl ?? bridge);
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  history.replaceState(null, '', url);
  await import('./main');
  await settle();
  return bridge;
}

async function playToEnd(pick = 0) {
  for (let i = 0; i < 15 && !document.querySelector('.report-card'); i++) {
    document.querySelector<HTMLButtonElement>(`.choice[data-i="${pick}"]`)!.click();
    await settle();
  }
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.doUnmock('./dev');
  vi.unstubAllGlobals();
});

/** A stand-in for the dev module that records how it is used. */
function mockDev() {
  const unmount = vi.fn();
  const mountDev = vi.fn(() => unmount);
  const factory = vi.fn(() => ({ mountDev }));
  vi.doMock('./dev', factory);
  return { unmount, mountDev, factory };
}

describe('the front end with dev mode off (the default)', () => {
  it('plays start to finish through the API, with no dev UI, no debug data and no dev code', async () => {
    const dev = mockDev();
    const bridge = await boot('/?seed=42');

    expect(text()).toContain('DIWhy');
    expect(text()).toContain('seed 42');
    expect(text()).toContain('Dev mode: off');
    expect(document.getElementById('dev')!.hidden).toBe(true);
    expect(document.getElementById('layout')!.classList.contains('with-dev')).toBe(false);

    await playToEnd();
    expect(document.querySelector('.report-card')).not.toBeNull();
    expect(text()).toContain('Why did you do it yourself?');

    expect(bridge.urls.length).toBeGreaterThan(2);
    expect(bridge.urls.every((u) => u.startsWith('/api/'))).toBe(true);
    expect(bridge.urls.some((u) => u.includes('debug=1'))).toBe(false);
    expect(dev.factory).not.toHaveBeenCalled(); // the dev module was never even imported
  });

  it('replays the same seed to the same ending, and restarts with a new seed', async () => {
    await boot('/?seed=7');
    await playToEnd();
    const firstEnding = document.querySelector('.report-card h2')!.textContent;

    document.querySelector<HTMLButtonElement>('#replay')!.click();
    await settle();
    expect(text()).toContain('seed 7');
    expect(document.querySelector('.report-card')).toBeNull();
    await playToEnd();
    expect(document.querySelector('.report-card h2')!.textContent).toBe(firstEnding);

    document.querySelector<HTMLButtonElement>('#restart')!.click();
    await settle();
    expect(document.querySelector('.report-card')).toBeNull();
    expect(text()).not.toContain('seed 7');
  });

  it('says so when the server cannot be reached, and recovers on retry', async () => {
    const app = createApp();
    let up = false;
    const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!up) throw new TypeError('fetch failed');
      return bridgeFetch(app.handler)(input, init);
    }) as typeof fetch;

    await boot('/?seed=3', flaky);
    expect(text()).toContain("Can't reach the DIWhy server");

    up = true;
    document.querySelector<HTMLButtonElement>('#retry')!.click();
    await settle();
    expect(text()).not.toContain("Can't reach");
    expect(document.querySelector('.choice[data-i="0"]')).not.toBeNull();
  });
});

describe('dev mode switch', () => {
  it('?dev=1 turns it on, loads the dev module, and asks the backend for debug data', async () => {
    const dev = mockDev();
    const bridge = await boot('/?seed=1&dev=1');
    await vi.waitFor(() => expect(dev.mountDev).toHaveBeenCalledTimes(1));
    expect(text()).toContain('Dev mode: on');
    expect(document.getElementById('dev')!.hidden).toBe(false);
    expect(document.getElementById('layout')!.classList.contains('with-dev')).toBe(true);
    expect(bridge.urls.some((u) => u.includes('debug=1'))).toBe(true);
  });

  it('the footer toggle turns it on and off, fetches debug data once on, and remembers the choice', async () => {
    const dev = mockDev();
    const bridge = await boot('/?seed=1');
    expect(dev.factory).not.toHaveBeenCalled();
    expect(bridge.urls.some((u) => u.includes('debug=1'))).toBe(false);

    document.querySelector<HTMLButtonElement>('#toggle-dev')!.click();
    await vi.waitFor(() => expect(dev.mountDev).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(bridge.urls.some((u) => u.includes('debug=1'))).toBe(true)); // refetch with debug
    await settle();
    expect(localStorage.getItem('diwhy.dev')).toBe('1');

    document.querySelector<HTMLButtonElement>('#toggle-dev')!.click();
    expect(dev.unmount).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Dev mode: off');
    expect(document.getElementById('dev')!.hidden).toBe(true);
    expect(document.getElementById('layout')!.classList.contains('with-dev')).toBe(false);
    expect(localStorage.getItem('diwhy.dev')).toBe('0');
  });

  it('a remembered "on" applies next load, and ?dev=0 overrides it', async () => {
    localStorage.setItem('diwhy.dev', '1');
    const dev = mockDev();
    await boot('/?seed=1');
    await vi.waitFor(() => expect(dev.mountDev).toHaveBeenCalledTimes(1));

    dev.mountDev.mockClear();
    await boot('/?seed=1&dev=0');
    expect(text()).toContain('Dev mode: off');
    expect(dev.mountDev).not.toHaveBeenCalled();
  });
});
