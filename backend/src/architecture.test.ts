// Guards the layering. If someone adds an import that breaks a rule, this fails.
//
//   engine, data   pure rules; know nothing else
//   directors      pick events (random, Jev); use the engine
//   content        turns the team's event files into engine events (pure: takes text, not files)
//   service        the backend core; uses engine, data, directors, content
//   server         HTTP, Node and file access; use the service and content layers
//   client, ui, dev, main   the front end. It may use ONLY the JSON contract, as types
//                  (service/types), so a different front end can replace it. Dev tools are
//                  loaded lazily and only through main.

import { describe, expect, it } from 'vitest';

const files = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Source files only: tests and test support are not bound by the layering. */
const source = Object.entries(files)
  .map(([p, src]) => [p.replace(/^\.\//, ''), src] as const)
  .filter(([p]) => !p.endsWith('.test.ts') && p !== 'testing.ts');

const layerOf = (path: string) => path.split('/')[0].replace(/\.(ts|css)$/, '');

interface Import {
  spec: string;
  typeOnly: boolean;
  dynamic: boolean;
}
function importsOf(src: string): Import[] {
  const found: Import[] = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^;'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    found.push({ spec: m[2], typeOnly: Boolean(m[1]), dynamic: false });
  }
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.push({ spec: m[1], typeOnly: false, dynamic: false });
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]/g)) found.push({ spec: m[1], typeOnly: false, dynamic: true });
  return found;
}
const resolve = (from: string, spec: string) => new URL(spec, `http://x/${from}`).pathname.replace(/^\//, '');

/** Which layers each layer may import from at runtime. */
const allowed: Record<string, string[]> = {
  engine: ['engine'],
  data: ['engine', 'data'],
  directors: ['engine', 'directors'],
  content: ['engine', 'data', 'content'],
  service: ['engine', 'data', 'directors', 'content', 'service'],
  server: ['service', 'content', 'server'],
  client: ['client'],
  ui: ['ui'],
  dev: ['dev', 'ui'],
  devHost: [],
  main: ['client', 'ui', 'style'],
};
const FRONT_END = new Set(['client', 'ui', 'dev', 'devHost', 'main', 'style']);

describe('layering', () => {
  it('sees the files it is supposed to check', () => {
    const layers = new Set(source.map(([p]) => layerOf(p)));
    for (const l of ['engine', 'data', 'directors', 'content', 'service', 'server', 'client', 'ui', 'dev', 'main']) {
      expect(layers.has(l), `no files found in ${l}`).toBe(true);
    }
  });

  it('every layer imports only what it is allowed to', () => {
    for (const [path, src] of source) {
      const layer = layerOf(path);
      for (const imp of importsOf(src)) {
        if (!imp.spec.startsWith('.')) continue; // packages and node: builtins are checked below
        const target = layerOf(resolve(path, imp.spec));
        if (target === layer) continue;
        const isContractType = resolve(path, imp.spec) === 'service/types' && imp.typeOnly;
        if (FRONT_END.has(layer) && isContractType) continue; // the one thing a front end may use
        if (layer === 'main' && target === 'dev' && imp.dynamic) continue; // lazy dev tools
        if (layer === 'main' && ['devHost', 'service'].includes(target) && imp.typeOnly) continue; // types only
        if (layer === 'dev' && target === 'devHost' && imp.typeOnly) continue;
        expect(allowed[layer] ?? [], `${path} must not import ${imp.spec} (${target})`).toContain(target);
      }
    }
  });

  it('the front end uses the contract as types only, never as runtime code', () => {
    for (const [path, src] of source.filter(([p]) => FRONT_END.has(layerOf(p)))) {
      for (const imp of importsOf(src)) {
        if (imp.spec.startsWith('.') && resolve(path, imp.spec).startsWith('service/')) {
          expect(imp.typeOnly, `${path} imports ${imp.spec} at runtime`).toBe(true);
        }
      }
    }
  });

  it('main loads dev tools lazily, never statically', () => {
    const main = source.find(([p]) => p === 'main.ts')![1];
    expect(main).toContain("import('./dev')");
    expect(importsOf(main).filter((i) => i.spec === './dev' && !i.dynamic)).toEqual([]);
  });

  it('the front end never touches Node', () => {
    for (const [path, src] of source.filter(([p]) => FRONT_END.has(layerOf(p)))) {
      expect(importsOf(src).filter((i) => i.spec.startsWith('node:')), `${path} imports a Node module`).toEqual([]);
    }
  });

  it('only the server layer talks HTTP framing and Node', () => {
    for (const [path, src] of source.filter(([p]) => !['server'].includes(layerOf(p)))) {
      expect(importsOf(src).filter((i) => i.spec.startsWith('node:')), `${path} imports a Node module`).toEqual([]);
    }
  });
});
