// @vitest-environment jsdom
// Dev mode with the real dev module, against the real backend (in-process) and a fake model.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appWithFakeModel, bridgeFetch } from '../testing';

const settle = () => vi.waitFor(() => expect(document.querySelector('.thinking')).toBeNull());
const devEl = () => document.getElementById('dev')!;
const panelReady = () => vi.waitFor(() => expect(devEl().textContent).toContain('Dev mode'));
const debugReady = () => vi.waitFor(() => expect(devEl().textContent).toContain('Event director'));

async function boot(url: string, app = appWithFakeModel()) {
  vi.stubGlobal('fetch', bridgeFetch(app.handler));
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  history.replaceState(null, '', url);
  await import('../main');
  await panelReady();
  await debugReady();
  await settle();
  return app;
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('dev mode with the Jev director', () => {
  it('shows the decision log (inputs and output, expanded, first) after a model decision', async () => {
    const app = await boot('/?seed=42&dev=1&director=jev');

    // The opening event has one candidate, so no model call yet.
    expect(app.model.calls).toHaveLength(0);
    expect(devEl().textContent).toContain('Jev decision log');
    expect(devEl().textContent).toContain('No model decisions yet');

    document.querySelector<HTMLButtonElement>('.choice[data-i="1"]')!.click();
    await settle();
    await vi.waitFor(() => expect(devEl().textContent).toContain('INPUT: state Jev sees'));

    expect(app.model.calls).toHaveLength(1);
    const dev = devEl().textContent!;
    expect(dev).toContain('INPUT: question and options Jev can choose');
    expect(dev).toContain('OUTPUT: raw model response');
    expect(dev).toContain('sampled with seeded roll');
    expect(dev).toContain('Download trace JSON');
    expect(dev).not.toContain('No model decisions yet');

    const open = [...devEl().querySelectorAll('details[open] > summary')].map((e) => e.textContent ?? '');
    for (const label of ['INPUT: state Jev sees', 'INPUT: question and options', 'OUTPUT: raw model response']) {
      expect(open.some((t) => t.includes(label))).toBe(true);
    }
    expect(devEl().innerHTML.indexOf('Jev decision log')).toBeLessThan(devEl().innerHTML.indexOf('<h4>State</h4>'));
  });

  it('switching to the random director replays the seed and stops model calls', async () => {
    const app = await boot('/?seed=42&dev=1&director=jev');
    document.querySelector<HTMLButtonElement>('.choice[data-i="1"]')!.click();
    await settle();
    expect(app.model.calls).toHaveLength(1);

    devEl().querySelector<HTMLButtonElement>('.seg[data-director="random"]')!.click();
    await settle();
    await vi.waitFor(() => expect(devEl().textContent).toContain('Director pool (random)'));
    expect(devEl().textContent).not.toContain('Jev decision log');
    expect(document.getElementById('app')!.textContent).toContain('seed 42');

    document.querySelector<HTMLButtonElement>('.choice[data-i="1"]')!.click();
    await settle();
    expect(app.model.calls).toHaveLength(1); // no new calls
  });

  it('turning dev mode off removes the panel and returns to the plain game', async () => {
    const app = await boot('/?seed=42&dev=1&director=jev');
    document.querySelector<HTMLButtonElement>('.choice[data-i="1"]')!.click();
    await settle();
    const callsBefore = app.model.calls.length;

    document.querySelector<HTMLButtonElement>('#toggle-dev')!.click();
    await settle(); // the game restarts on the random director
    expect(devEl().hidden).toBe(true);
    expect(devEl().innerHTML).toBe('');
    expect(document.getElementById('app')!.textContent).toContain('Dev mode: off');
    expect(localStorage.getItem('diwhy.dev')).toBe('0');
    expect(new URLSearchParams(location.search).has('director')).toBe(false);

    for (let i = 0; i < 15 && !document.querySelector('.report-card'); i++) {
      document.querySelector<HTMLButtonElement>('.choice[data-i="0"]')!.click();
      await settle();
    }
    expect(document.querySelector('.report-card')).not.toBeNull();
    expect(app.model.calls.length).toBe(callsBefore); // the model is never asked again
  });
});

describe('dev mode panel', () => {
  it('shows live state, flags and the director pool for the random director', async () => {
    await boot('/?seed=42&dev=1');
    document.querySelector<HTMLButtonElement>('.choice[data-i="0"]')!.click();
    await settle();
    await vi.waitFor(() => expect(devEl().textContent).toContain('valve-stuck'));

    const dev = devEl().textContent!;
    expect(dev).toContain('Director pool (random)');
    expect(dev).toContain('riskDebt');
    expect(dev).toContain('Event history');
  });

  it('remembers dev mode across page loads without a URL flag', async () => {
    vi.stubGlobal('fetch', bridgeFetch(appWithFakeModel().handler));
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    history.replaceState(null, '', '/?seed=5');
    await import('../main');
    await settle();
    expect(document.getElementById('app')!.textContent).toContain('Dev mode: off');
    document.querySelector<HTMLButtonElement>('#toggle-dev')!.click();
    await debugReady();

    await boot('/?seed=5'); // a "reload": same storage, no ?dev=1
    expect(document.getElementById('app')!.textContent).toContain('Dev mode: on');
  });
});
