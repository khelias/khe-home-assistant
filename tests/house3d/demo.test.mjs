// Tests of the demo dashboard (demo/dashboard.js) on the model the demo ships: the model.json of
// a house3d-build.py --demo run, which has the fixture's private room names applied.
// Run from the repo root: node --test tests/house3d/demo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { buildViews, chunk, rowsOf, tileSections, tile } = await import(new URL('demo/dashboard.js', `file://${ROOT}`));

const out = mkdtempSync(join(tmpdir(), 'house3d-demo-'));
let model;
try {
  execFileSync('python3', ['-I', join(ROOT, 'scripts/house3d-build.py'), '--demo', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  model = JSON.parse(readFileSync(join(out, 'model.json'), 'utf8'));
} finally {
  rmSync(out, { recursive: true, force: true });
}

// every entity a card or badge names, nested stacks included
function entities(view) {
  const found = [];
  const walk = c => { if (c.entity) found.push(c.entity); (c.cards || []).forEach(walk); };
  (view.badges || []).forEach(walk);
  (view.cards || []).forEach(walk);
  (view.sections || []).forEach(walk);
  return found;
}

// the house idiom: rows of 2-4 tiles, no lone tile, a full-width card on its own
function idiomProblems(views) {
  const problems = [];
  for (const v of views) {
    if (v.type === 'panel') { if ((v.cards || []).length !== 1) problems.push(`${v.path}: a panel view holds one card`); continue; }
    if (!(v.sections || []).length) problems.push(`${v.path}: no sections`);
    v.sections.forEach((s, i) => {
      const body = s.cards.filter(c => c.type !== 'heading');
      if (!body.length) problems.push(`${v.path} section ${i}: empty`);
      for (const c of body) {
        if (c.type === 'tile') problems.push(`${v.path} section ${i}: a tile outside a row`);
        if (c.type !== 'horizontal-stack') continue;
        if (c.cards.length < 2 || c.cards.length > 4) problems.push(`${v.path} section ${i}: a row of ${c.cards.length}`);
        if (c.cards.some(x => x.type !== 'tile')) problems.push(`${v.path} section ${i}: a row with a full-width card`);
      }
    });
  }
  return problems;
}

const views = buildViews(model);

test('the shipped model is the demo build with room names', () => {
  assert.ok(model.devices.length > 0);
  assert.ok(model.car && model.car.entity);
  assert.ok(!('room_names' in model));
});

test('the first view is the 3D panel', () => {
  assert.equal(views[0].type, 'panel');
  assert.equal(views[0].path, '3d');
  assert.deepEqual(views[0].cards, [{ type: 'custom:house3d-card' }]);
  assert.deepEqual(views.map(v => v.path), ['3d', 'kodu', 'kliima', 'valve']);
});

test('every device and the car appear in a view besides 3D', () => {
  const shown = new Set(views.slice(1).flatMap(entities));
  for (const d of model.devices) assert.ok(shown.has(d.entity), d.entity);
  assert.ok(shown.has(model.car.entity));
});

test('rows keep the house idiom and no view or section is empty', () => {
  assert.deepEqual(idiomProblems(views), []);
});

test('views use only the card types cards.js renders', () => {
  const types = new Set();
  const walk = c => { types.add(c.type); (c.cards || []).forEach(walk); };
  views.forEach(v => [...(v.cards || []), ...(v.sections || [])].forEach(walk));
  const known = ['custom:house3d-card', 'grid', 'heading', 'tile', 'horizontal-stack', 'thermostat', 'alarm-panel', 'picture-entity'];
  assert.deepEqual([...types].filter(t => !known.includes(t)), []);
});

test('section headings are room names or no device name', () => {
  const names = new Set(model.devices.map(d => d.name));
  for (const v of views.slice(1)) for (const s of v.sections) for (const c of s.cards) {
    if (c.type === 'heading') assert.ok(!names.has(c.heading), c.heading);
  }
});

test('rows: 2-4 tiles, singles share, a lone tile joins the row before', () => {
  const n = k => Array.from({ length: k }, (_, i) => i);
  assert.deepEqual(chunk(n(5)).map(r => r.length), [3, 2]);
  assert.deepEqual(chunk(n(7)).map(r => r.length), [4, 3]);
  assert.deepEqual(chunk(n(9)).map(r => r.length), [3, 3, 3]);
  assert.deepEqual(rowsOf([[1, 2], [3], [4]]), [[1, 2], [3, 4]]);
  assert.deepEqual(rowsOf([[1, 2, 3, 4], [5]]), [[1, 2, 3], [4, 5]]);
  assert.deepEqual(rowsOf([[1, 2], [3]]), [[1, 2, 3]]);
});

test('a room with one tile shares a section; a last lone one joins the section before', () => {
  const t = e => tile(e);
  const shared = tileSections([{ title: 'A', parts: [[t('light.a')]] }, { title: 'B', parts: [[t('light.b')]] }], 'Muud ruumid');
  assert.equal(shared.length, 1);
  assert.equal(shared[0].cards[0].heading, 'Muud ruumid');
  const joined = tileSections([{ title: 'A', parts: [[t('light.a'), t('light.c')]] }, { title: 'B', parts: [[t('light.b')]] }], 'Muud ruumid');
  assert.equal(joined.length, 1);
  assert.equal(joined[0].cards[1].cards.length, 3);
});

test('a device of an unknown type still shows, and a thinned house keeps the idiom', () => {
  const extra = { ...model, devices: [...model.devices, { entity: 'select.test_mode', type: 'mode', room: 'r1', name: 'x', pos: [0, 0, 0] }] };
  assert.ok(buildViews(extra).slice(1).flatMap(entities).includes('select.test_mode'));
  // every other device gone: rooms drop to one tile and pool
  const thin = { ...model, devices: model.devices.filter((d, i) => i % 2) };
  const tv = buildViews(thin);
  assert.deepEqual(idiomProblems(tv), []);
  const shown = new Set(tv.slice(1).flatMap(entities));
  for (const d of thin.devices) assert.ok(shown.has(d.entity), d.entity);
});

test('the demo files name no fixture entity or device and hold no devices key', () => {
  const dir = join(ROOT, 'demo');
  const files = readdirSync(dir).filter(f => f.endsWith('.js') || f === 'index.html');
  assert.ok(files.includes('dashboard.js'));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strings = [...model.devices.flatMap(d => [d.entity, d.name]), model.car.entity, model.car.name].filter(Boolean);
  const devicesKey = /["']?\bdevices["']?\s*:/;
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const s of strings) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}_])${esc(s)}(?![\\p{L}\\p{N}_])`, 'u').test(text), `${f}: ${s}`);
    assert.ok(!devicesKey.test(text), `${f}: a devices key`);
  }
});
