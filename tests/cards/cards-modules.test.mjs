// Structural invariants for cards/khe-cards.js and cards/parts/*.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { cards } from './cards-harness.mjs';

const PARTS_DIR = new URL('../../cards/parts/', import.meta.url);
const ENTRY_URL = new URL('../../cards/khe-cards.js', import.meta.url);

test('cards/parts modules have zero import or re-export statements', () => {
  const files = readdirSync(PARTS_DIR).filter(f => f.endsWith('.js')).sort();
  assert.ok(files.length >= 8);
  const bad = [];
  for (const name of files) {
    const src = readFileSync(new URL(name, PARTS_DIR), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    if (/^\s*import\b/m.test(src) || /\bexport\s+(?:\*|\{[^}]*\})\s+from\b/.test(src)) {
      bad.push(name);
    }
  }
  assert.deepEqual(bad, []);
});

test('cards/khe-cards.js loads every cards/parts module with ?v=KHE_CARDS_VERSION', () => {
  const entry = readFileSync(ENTRY_URL, 'utf8');
  assert.match(entry, /`\.\/parts\/\$\{name\}\.js\?v=\$\{KHE_CARDS_VERSION\}/);
  const onDisk = readdirSync(PARTS_DIR).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')).sort();
  const listed = [...entry.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]).filter(n => onDisk.includes(n)).sort();
  assert.deepEqual(listed, onDisk);
});

test('cards/khe-cards.js exports only defined values', () => {
  const undef = Object.entries(cards).filter(([, v]) => v === undefined).map(([k]) => k);
  assert.deepEqual(undef, []);
  assert.equal(typeof cards.KHE_CARDS_VERSION, 'number');
  assert.ok(cards.KHE_CARDS_VERSION >= 29);
});
