// Tests of the demo's English UI (ADR-003): demo/strings.js picks English from ?lang=en, and
// cards.js and charts.js format with it. The formatters are fixed when the modules load, so this
// file sets location before importing them, in its own process; demo.test.mjs keeps Estonian.
// Run from the repo root: node --test tests/house3d/demo-en.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.location = new URL('https://khe.ee/ha/?lang=en#kodu');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const mod = f => import(new URL(`demo/${f}`, `file://${ROOT}`));
const { lang, locale, t, STRINGS } = await mod('strings.js');
const { formatState, runAction } = await mod('cards.js');
const { CHARTS } = await mod('charts.js');

test('?lang=en picks English and en-GB', () => {
  assert.equal(lang, 'en');
  assert.equal(locale, 'en-GB');
  assert.equal(t, STRINGS.en);
});

test('state text in English', () => {
  const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
  assert.equal(formatState(st('binary_sensor.x', 'on', { device_class: 'door' })), 'Open');
  assert.equal(formatState(st('sensor.x', '21.4', { unit_of_measurement: '°C' })), '21.4 °C');
  assert.equal(formatState(st('update.x', 'on')), 'Update available');
  assert.equal(formatState(st('input_datetime.x', '23:00:00', { has_time: true })), '23:00');
  assert.equal(formatState(st('alarm_control_panel.x', 'armed_away')), 'Armed away');
  assert.equal(formatState(null), 'Missing');
});

test('an action without its own confirmation text asks in English', async () => {
  let asked = null;
  await runAction({ action: 'toggle', confirmation: true }, 'switch.x', { confirm: q => { asked = q; return Promise.resolve(false); } });
  assert.equal(asked, 'Are you sure?');
});

test('a chart without data says so in English', () => {
  assert.match(CHARTS['history-graph']({ entities: [{ entity: 'sensor.none' }] }, {}, new Date()), /No data/);
});

// the English build: its charts draw from series.en.json, and Teler's cards (ADR-017) carry English
test('every English chart draws from series.en.json, and the TV card is in English', () => {
  const out = mkdtempSync(join(tmpdir(), 'house3d-demo-en-'));
  let dashboard, series;
  try {
    execFileSync('python3', ['-I', join(ROOT, 'scripts/house3d-build.py'), '--demo', out], { stdio: ['ignore', 'ignore', 'inherit'] });
    [dashboard, series] = ['dashboard.en.json', 'series.en.json'].map(f => JSON.parse(readFileSync(join(out, f), 'utf8')));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  const charts = [];
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (CHARTS[o.type]) charts.push(o); Object.values(o).forEach(walk); } };
  walk(dashboard.views);
  // no view draws a stock chart; a new one must draw from the series
  for (const c of charts) assert.doesNotMatch(CHARTS[c.type](c, series, new Date(), 400, e => e), /No data/, c.type);

  const teler = dashboard.views.find(v => v.path === 'teler'), cards = [];
  const all = o => { if (Array.isArray(o)) o.forEach(all); else if (o && typeof o === 'object') { if (String(o.type).startsWith('custom:khe-')) cards.push(o); Object.values(o).forEach(all); } };
  all(teler);
  assert.ok(cards.length && cards.every(c => c.language === 'en'));
  const tv = cards.find(c => c.type === 'custom:khe-tv-card');
  assert.deepEqual(tv.profiles.map(p => [p.name, p.lock, p.tap_action.confirmation.text]), [
    ['Main profile', true, 'Switch the TV to the Main profile? The PIN is entered on the TV.'],
    ['Kids', false, 'Switch the TV to the Kids profile?']
  ]);
  assert.equal(tv.buttons.power_off.confirmation.text, 'Turn off the TV?');
  assert.equal(tv.apps.at(-1).name, 'Other');
  const days = cards.find(c => c.type === 'custom:khe-days-card');
  assert.deepEqual(days.series[0].stack.map(x => x.name), tv.apps.map(a => a.name));
});

test('both languages have the same strings', () => {
  const shape = o => Object.keys(o).sort().map(k => (o[k] && typeof o[k] === 'object' ? [k, shape(o[k])] : k));
  assert.deepEqual(shape(STRINGS.en), shape(STRINGS.et));
});
