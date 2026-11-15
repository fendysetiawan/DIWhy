// Reads the team's event files (events/*.csv) into typed rows.
//
// Columns (in the team's files): id, event, kind, category, description,
// option_1, option_2, option_3, answer_key
//   kind        snowball (a problem that cascades) or temptation (scope creep)
//   answer_key  one quality per option, in order: good, ok, wrong or excessive
//
// Optional columns, ignored when absent: cost_1..3 and days_1..3. If a file provides them for an
// option, that number replaces the derived consequence (see consequences.ts).
// Also optional: visual, space-separated tokens prop[:variant]@anchor that say what the elevation view
// draws for the event. Only the grammar is checked here; frontend/elevation.js owns the names (a test checks).
//
// Pure: takes text, returns rows. Reading the files from disk happens in the server layer.

import type { Quality } from '../engine/EventEngine';

export type CsvKind = 'snowball' | 'temptation';

export interface CsvEventRow {
  id: string;
  title: string;
  kind: CsvKind;
  category: string;
  description: string;
  options: [string, string, string];
  qualities: [Quality, Quality, Quality];
  /** Hand-set numbers from optional columns. `undefined` means "derive it". */
  costs: [number | undefined, number | undefined, number | undefined];
  days: [number | undefined, number | undefined, number | undefined];
  /** Picture tokens from the optional `visual` column, e.g. `hole@wall`. Empty when absent. */
  visual: string[];
}

const QUALITIES: readonly Quality[] = ['good', 'ok', 'wrong', 'excessive'];
const VISUAL_TOKEN = /^[a-z0-9_-]+(:[a-z0-9_-]+)?@[a-z0-9_-]+$/;
const REQUIRED = ['id', 'event', 'kind', 'category', 'description', 'option_1', 'option_2', 'option_3', 'answer_key'];

/** RFC 4180 style: quoted fields, "" for a quote inside one, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row); // skip blank lines
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('unterminated quote');
  row.push(field);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

const num = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Parse and validate an event file. Errors name the file and the row, so they are easy to fix. */
export function parseEventRows(text: string, source: string): CsvEventRow[] {
  const table = parseCsv(text.replace(/^﻿/, ''));
  if (table.length === 0) throw new Error(`${source}: the file is empty`);
  const header = table[0].map((h) => h.trim());
  for (const col of REQUIRED) {
    if (!header.includes(col)) throw new Error(`${source}: missing column "${col}"`);
  }
  const at = (row: string[], col: string) => (row[header.indexOf(col)] ?? '').trim();

  const seen = new Set<string>();
  return table.slice(1).map((row, i) => {
    const where = `${source} row ${i + 2}`;
    const id = at(row, 'id');
    if (!id) throw new Error(`${where}: id is empty`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id "${id}"`);
    seen.add(id);

    const kind = at(row, 'kind');
    if (kind !== 'snowball' && kind !== 'temptation') {
      throw new Error(`${where} (${id}): kind must be "snowball" or "temptation", not "${kind}"`);
    }
    const options = [at(row, 'option_1'), at(row, 'option_2'), at(row, 'option_3')] as CsvEventRow['options'];
    if (options.some((o) => !o)) throw new Error(`${where} (${id}): all three options need text`);

    const keys = at(row, 'answer_key').split(',').map((k) => k.trim());
    if (keys.length !== 3) throw new Error(`${where} (${id}): answer_key needs three qualities, got "${at(row, 'answer_key')}"`);
    for (const k of keys) {
      if (!QUALITIES.includes(k as Quality)) {
        throw new Error(`${where} (${id}): "${k}" is not a quality (use good, ok, wrong or excessive)`);
      }
    }
    const visual = header.includes('visual') ? at(row, 'visual').split(/\s+/).filter(Boolean) : [];
    for (const tok of visual) {
      if (!VISUAL_TOKEN.test(tok)) throw new Error(`${where} (${id}): visual token "${tok}" must look like prop@anchor or prop:variant@anchor (lowercase letters, digits, - and _)`);
    }
    const col = (name: string, n: number) => (header.includes(`${name}_${n}`) ? num(at(row, `${name}_${n}`)) : undefined);
    return {
      id,
      title: at(row, 'event'),
      kind,
      category: at(row, 'category'),
      description: at(row, 'description'),
      options,
      qualities: keys as CsvEventRow['qualities'],
      costs: [col('cost', 1), col('cost', 2), col('cost', 3)],
      days: [col('days', 1), col('days', 2), col('days', 3)],
      visual,
    };
  });
}
