// Tests of house3d-card.js on the synthetic fixture: markers and room chips, its two languages,
// the hero's sizing and layer switches, the winter season, the future items' text and the
// loading picture. The dashboard cards' tests are tests/cards/cards.test.mjs. The set-up is in
// engine-harness.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { E, seasonOn, seasonWindow, card, model, futureItem } from './engine-harness.mjs';

test('card: importRetry tries again on a new URL after a failure', async () => {
  const urls = [], waits = [];
  const load = async url => { urls.push(url); if (urls.length === 1) throw new Error('fetch failed'); return { mod: url }; };
  const { result, seen } = await (async () => {
    const seen = [], orig = console.error;
    console.error = (...a) => seen.push(a.map(String).join(' '));
    try { return { result: await card.importRetry(load, n => `./house3d.js?v=1${n ? `&r=${n}` : ''}`, { wait: async ms => waits.push(ms) }), seen }; } finally { console.error = orig; }
  })();
  assert.deepEqual(result, { mod: './house3d.js?v=1&r=1' });
  assert.deepEqual(urls, ['./house3d.js?v=1', './house3d.js?v=1&r=1']);
  assert.notEqual(urls[0], urls[1]);
  assert.deepEqual(waits, [2000]);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^house3d: loading \.\/house3d\.js\?v=1 failed: fetch failed/);
  // two failures reject with the last error
  const quiet = console.error;
  console.error = () => {};
  try {
    await assert.rejects(card.importRetry(async () => { throw new Error('down'); }, n => `u${n}`, { wait: async () => {} }), /down/);
  } finally { console.error = quiet; }
});

test('card: roomChips from the markers, alert and on parts first, counts past one', () => {
  const ms = [
    { id: 'sensor.a_temp', icon: 'sensor', room: 'r1', state: 'idle', value: '21,2°' },
    { id: 'climate.a_floor', icon: 'climate', room: 'r1', state: 'on', value: '23,0°' },
    { id: 'light.a1', icon: 'light', room: 'r1', state: 'on' },
    { id: 'light.a2', icon: 'light', room: 'r1', state: 'on' },
    { id: 'light.a3', icon: 'light', room: 'r1', state: 'idle' },
    { id: 'binary_sensor.a_motion', icon: 'motion', room: 'r1', state: 'on' },
    { id: 'binary_sensor.b_door', icon: 'door', room: 'r2', state: 'alert' },
    { id: 'climate.c_floor', icon: 'climate', room: 'r3', state: 'on', value: '22,5°' },
    { id: 'water_heater.c_boiler', icon: 'climate', room: 'r3', state: 'idle', value: '48,0°' },
    { id: 'binary_sensor.x_motion', icon: 'motion', room: 'carport', state: 'on' },
    { id: 'binary_sensor.d_smoke', icon: 'smoke', room: 'r4', state: 'alert' },
    { id: 'sensor.d_temp', icon: 'sensor', room: 'r4', state: 'idle', value: '20,0°' }
  ];
  const chips = card.roomChips(ms, model.rooms);
  assert.deepEqual(chips.map(c => c.room), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'], 'house rooms only, not the carport');
  const [r1, r2, r3, r4] = chips;
  assert.deepEqual(r1.parts.map(q => [q.icon, q.text]), [['motion', undefined], ['light', '2'], ['climate', '21,2°']], 'motion before the temperature');
  assert.equal(r1.state, 'on');
  assert.equal(r1.parts[1].label, '2 valgustit põleb');
  assert.deepEqual(r1.ids, ['binary_sensor.a_motion', 'light.a1', 'light.a2'], 'the counted markers, not the heating climate unit');
  assert.deepEqual(r2.parts.map(q => q.icon), ['door']);
  assert.equal(r2.state, 'alert');
  assert.deepEqual(r2.ids, ['binary_sensor.b_door']);
  assert.deepEqual(r3.parts.map(q => q.text), ['22,5°'], 'a climate unit\'s, not the boiler\'s');
  assert.equal(r3.state, 'idle', 'heating alone is no activity');
  assert.deepEqual(r3.ids, []);
  assert.deepEqual(r4.parts.map(q => [q.icon, q.state, q.label]), [['smoke', 'alert', 'suitsuandur annab häiret'], ['climate', undefined, 'temperatuur 20,0°']]);
  assert.equal(r4.state, 'alert');
  assert.deepEqual(r4.ids, ['binary_sensor.d_smoke']);
  const none = card.roomChips([], model.rooms).find(c => c.room === 'r4');
  assert.deepEqual(none, { room: 'r4', parts: [], state: 'idle', ids: [] });
});

test('card: roomChips on the test house\'s own devices', () => {
  const ms = model.devices.map(d => card.toMarker(d, d.type === 'motion' ? { state: 'on' } : undefined));
  const r1 = card.roomChips(ms, model.rooms).find(c => c.room === 'r1');
  assert.equal(r1.parts.find(q => q.icon === 'motion').text, '2', 'the kitchen and the living room sensors');
});

test('card: roomChips and toMarker in English with language en, Estonian by default', () => {
  const ms = [
    { id: 'light.a1', icon: 'light', room: 'r1', state: 'on' },
    { id: 'light.a2', icon: 'light', room: 'r1', state: 'on' },
    { id: 'binary_sensor.b_door', icon: 'door', room: 'r2', state: 'alert' },
    { id: 'binary_sensor.d_smoke', icon: 'smoke', room: 'r4', state: 'alert' },
    { id: 'sensor.d_temp', icon: 'sensor', room: 'r4', state: 'idle', value: '20.0°' },
    { id: 'alarm_control_panel.e', icon: 'alarm', room: 'r5', state: 'on' }
  ];
  const [r1, r2, , r4, r5] = card.roomChips(ms, model.rooms, 'en');
  assert.equal(r1.parts[0].label, '2 lights on');
  assert.equal(r2.parts[0].label, 'door open');
  assert.deepEqual(r4.parts.map(q => q.label), ['smoke alarm going off', 'temperature 20.0°']);
  assert.equal(r5.parts[0].label, 'armed');
  assert.equal(card.roomChips(ms, model.rooms)[0].parts[0].label, '2 valgustit põleb');
  const d = { entity: 'sensor.t', type: 'sensor', room: 'r1', pos: [0, 0, 0], name: 't' };
  assert.equal(card.toMarker(d, { state: '21.44' }, new Date(), 'en').value, '21.4°');
  assert.equal(card.toMarker(d, { state: '21.44' }).value, '21,4°');
});

test('card: both languages have the same strings', () => {
  const shape = o => Object.keys(o).sort().map(k => (o[k] && typeof o[k] === 'object' ? [k, shape(o[k])] : k));
  assert.deepEqual(shape(card.TEXT.en), shape(card.TEXT.et));
});

test('card: motionGlow lights a room while motion is on and 15 minutes after', () => {
  const now = new Date('2026-10-17T21:00:00Z'), ago = min => new Date(now - min * 60000).toISOString();
  assert.equal(card.motionGlow({ state: 'on', last_changed: ago(60) }, now), 0.8);
  assert.equal(card.motionGlow({ state: 'off', last_changed: ago(5) }, now), 0.8);
  assert.equal(card.motionGlow({ state: 'off', last_changed: ago(20) }, now), 0);
  assert.equal(card.motionGlow({ state: 'unavailable', last_changed: ago(1) }, now), 0);
  assert.equal(card.motionGlow(undefined, now), 0);
  const d = { entity: 'binary_sensor.m', type: 'motion', room: 'r1', pos: [0, 0, 0], name: 'm' };
  assert.equal(card.toMarker(d, { state: 'off', last_changed: ago(5) }, now).glow, 0.8);
  assert.equal(card.toMarker(d, { state: 'off', last_changed: ago(5) }, now).state, 'idle');
  assert.equal('glow' in card.toMarker(d, { state: 'off', last_changed: ago(20) }, now), false);
});

test('card: featureText gives the facts, the date in Estonian, and the PV line by day and at night', () => {
  const pv = futureItem('pv'), tub = futureItem('tub');
  const t = card.featureText(pv, '2026-10-14', null);
  assert.equal(t.title, 'Päikesejaam');
  assert.equal(t.sub, 'Plaan · hinnang 14. oktoober 2026');
  assert.deepEqual(t.facts, pv.facts);
  assert.equal(t.empty, null);
  assert.equal(t.pv, null, 'no sun, no line');
  const none = card.featureText(tub, '2026-10-14', null);
  assert.deepEqual(none.facts, []);
  assert.equal(none.empty, 'Numbreid pole veel lisatud.');
  assert.equal(card.featureText(tub, undefined, null).sub, 'Plaan');
  const day = new Date(2026, 5, 21, 13, 0), night = new Date(2026, 5, 21, 23, 45);
  assert.equal(card.featureText(pv, null, { kw: 4.236, alt: 54, time: day, live: true }).pv, 'Praegu selge taevaga kuni 4,2 kW');
  assert.equal(card.featureText(pv, null, { kw: 4.236, alt: 54, time: day, live: false }).pv, '21. juuni kell 13:00 selge taevaga kuni 4,2 kW');
  assert.equal(card.featureText(pv, null, { kw: 0, alt: -3, time: night, live: true }).pv, 'Praegu on päike loojunud');
  assert.equal(card.featureText(pv, null, { kw: 0, alt: -3, time: night, live: false }).pv, '21. juuni kell 23:45 on päike loojunud');
});

test('card: featureText in English', () => {
  const pv = futureItem('pv'), tub = futureItem('tub');
  assert.equal(card.featureText(pv, '2026-10-14', null, 'en').sub, 'Plan · estimate of 14 October 2026');
  assert.equal(card.featureText(tub, '2026-10-14', null, 'en').empty, 'No figures added yet.');
  assert.equal(card.featureText(tub, undefined, null, 'en').sub, 'Plan');
  const day = new Date(2026, 5, 21, 13, 0), night = new Date(2026, 5, 21, 23, 45);
  assert.equal(card.featureText(pv, null, { kw: 4.236, alt: 54, time: day, live: true }, 'en').pv, 'Now up to 4.2 kW under a clear sky');
  assert.equal(card.featureText(pv, null, { kw: 4.236, alt: 54, time: day, live: false }, 'en').pv, '21 June at 13:00 up to 4.2 kW under a clear sky');
  assert.equal(card.featureText(pv, null, { kw: 0, alt: -3, time: night, live: false }, 'en').pv, '21 June at 23:45 the sun has set');
});

test('card: heroSize keeps the default without a height and sizes the rows for one', () => {
  assert.deepEqual(card.heroSize({}), { height: null, rows: 8 });
  assert.deepEqual(card.heroSize(undefined), { height: null, rows: 8 });
  assert.deepEqual(card.heroSize({ height: 'tall' }), { height: null, rows: 8 });
  assert.deepEqual(card.heroSize({ height: 300 }), { height: 300, rows: 5 });
  assert.deepEqual(card.heroSize({ height: 248 }), { height: 248, rows: 4 });
  assert.deepEqual(card.heroSize({ height: 249.6 }), { height: 250, rows: 5 });
});

test('card: stretchBox keeps a stretching hero in the box its rows gave it', () => {
  assert.equal(card.stretchBox({ height: 300, stretch: true }), 312);
  assert.equal(card.stretchBox({ height: 300 }), null);
  assert.equal(card.stretchBox({ stretch: true }), null);
  assert.equal(card.stretchBox(undefined), null);
});

test('card: stretchHeight follows the tallest section on its row, within the screen and over its minimum', () => {
  const at = { min: 312, top: 80, rest: 109 };
  assert.equal(card.stretchHeight({ ...at, beside: [], bottom: 796 }), 312);
  assert.equal(card.stretchHeight({ ...at, beside: [686, 599], bottom: 796 }), 497);
  assert.equal(card.stretchHeight({ ...at, beside: [1100], bottom: 796 }), 607);
  assert.equal(card.stretchHeight({ ...at, beside: [400], bottom: 796 }), 312);
  assert.equal(card.stretchHeight({ ...at, beside: [686], bottom: 366 }), 312);
});

test('card: a stretching hero leaves its grid rows at auto', () => {
  const el = Object.create(card.House3dCard.prototype);
  el._config = { height: 300, stretch: true };
  assert.deepEqual(el.getGridOptions(), { columns: 'full', rows: 'auto' });
  el._config = { height: 300 };
  assert.deepEqual(el.getGridOptions(), { columns: 'full', rows: 5 });
});

test('card: heroMount puts a hero in the real style with its layers as given, and leaves any other card as stored', () => {
  const stored = { surroundings: true, garden: false };
  assert.deepEqual(card.heroMount(true, 'simple', stored),
    { style: 'real', layers: { future: false, surroundings: true, garden: false }, snowfall: false });
  assert.deepEqual(card.heroMount(false, 'simple', stored),
    { style: 'simple', layers: { future: false, surroundings: true, garden: false }, snowfall: true });
  assert.deepEqual(card.heroMount(false, 'real', undefined), { style: 'real', layers: { future: false }, snowfall: true });
  assert.deepEqual(stored, { surroundings: true, garden: false });
  // the season's defaults sit under the switches
  assert.deepEqual(card.heroMount(true, 'simple', {}, { winter: true }), { style: 'real', layers: { future: false, winter: true }, snowfall: false });
  assert.deepEqual(card.heroMount(true, 'simple', { winter: false }, { winter: true }).layers.winter, false);
});

test('card: a winter switch holds for its season window only, the other switches as they were', () => {
  const d = (y, m, day) => seasonWindow(new Date(y, m - 1, day, 12));
  const stored = card.storeLayer({ trees: false }, 'winter', false, d(2026, 11, 5));
  assert.deepEqual(stored, { trees: false, winter: { on: false, window: '2026-11' } });
  assert.deepEqual(card.resolveLayers(stored, d(2027, 1, 20)), { trees: false, winter: false });
  assert.deepEqual(card.resolveLayers(stored, d(2027, 11, 5)), { trees: false }, 'dropped next year');
  assert.deepEqual(card.resolveLayers(stored, d(2027, 5, 1)), { trees: false }, 'dropped in the gap');
  // a new switch drops the expired one; a plain boolean for the seasonal layer is never taken
  assert.deepEqual(card.storeLayer(stored, 'trees', true, d(2027, 11, 5)), { trees: true });
  assert.deepEqual(card.resolveLayers({ winter: true }, d(2026, 11, 5)), {});
});

test('card: the minute check turns winter on from 31 October to 1 November, unless a switch holds it', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  try {
    const mod = { seasonOn, seasonWindow }, calls = [];
    const el = Object.create(card.House3dCard.prototype);
    Object.assign(el, { _heroLayers: {}, _isHero: false, _mod: mod, _view: { setLayer: (id, on) => calls.push([id, on]) } });
    el._season = seasonOn(new Date(2026, 9, 31, 23, 59));
    el._checkSeason(new Date(2026, 9, 31, 23, 59));
    assert.deepEqual(calls, []);
    el._checkSeason(new Date(2026, 10, 1, 0, 0));
    assert.deepEqual(calls, [['winter', true]]);
    el._checkSeason(new Date(2026, 10, 1, 0, 1));
    assert.equal(calls.length, 1, 'once per change');
    // a switch flipped in the new window holds
    calls.length = 0;
    el._season = false;
    el._writeLayers(card.storeLayer({}, 'winter', false, seasonWindow(new Date(2026, 10, 1, 0, 1))));
    el._checkSeason(new Date(2026, 10, 1, 0, 2));
    assert.deepEqual(calls, []);
  } finally { delete globalThis.localStorage; }
});

test('card: the hero mounts with the season\'s default and no snowfall, keeping its switch to itself', () => {
  const mod = { seasonOn, seasonWindow }, now = new Date(2026, 11, 15, 12);
  const el = Object.create(card.House3dCard.prototype);
  Object.assign(el, { _heroLayers: {}, _isHero: true, _mod: mod, _view: { setLayer() {} }, _renderLayers() {} });
  const start = card.heroMount(true, 'simple', card.resolveLayers(el._readLayers(), seasonWindow(now)), { winter: mod.seasonOn(now) });
  assert.deepEqual(start, { style: 'real', layers: { future: false, winter: true }, snowfall: false });
  el._switchLayer('winter', false);
  assert.deepEqual(card.resolveLayers(el._heroLayers, seasonWindow(new Date())), { winter: false });
});

test('card: a hero keeps its layer switches to itself and a full view stores them', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  try {
    const el = Object.create(card.House3dCard.prototype);
    el._heroLayers = {};
    el._isHero = true;
    el._writeLayers({ ...el._readLayers(), garden: true });
    assert.equal(store.size, 0);
    assert.deepEqual(el._readLayers(), { garden: true });
    el._isHero = false;
    el._writeLayers({ ...el._readLayers(), garden: true });
    assert.equal(store.size, 1);
  } finally { delete globalThis.localStorage; }
});

// _fit on a stand-in element: Node has no DOM, so only the sizing logic runs
function fitted(attrs, hero) {
  const el = Object.create(card.House3dCard.prototype);
  const props = {};
  el.style = { height: '', setProperty: (k, v) => { props[k] = v; }, removeProperty: k => { delete props[k]; } };
  Object.defineProperty(el, 'isConnected', { value: true });
  el.hasAttribute = a => attrs.includes(a);
  el.getBoundingClientRect = () => ({ top: 100 });
  if (hero) el.style.setProperty('--house3d-height', `${hero}px`);
  globalThis.window = { innerHeight: 900 };
  try { el._fit(); } finally { delete globalThis.window; }
  return { height: el.style.height, props };
}

test('card: a hero keeps its height outside a panel view, and a panel view still fills the screen', () => {
  assert.deepEqual(fitted(['hero'], 300), { height: '', props: { '--house3d-height': '300px' } });
  assert.equal(fitted(['panel'], null).height, '800px');
  assert.equal(fitted(['panel', 'hero'], 300).height, '800px');
});

test('card: the hero rule lets vertical swipes scroll the page only outside a panel view', () => {
  const src = readFileSync(new URL('house3d-card.js', E), 'utf-8');
  assert.match(src, /:host\(\[hero\]:not\(\[panel\]\)\) canvas \{ touch-action: pan-y !important; \}/);
  assert.match(src, /:host \{ display: block; height: var\(--house3d-height, 480px\); \}/);
});

test('card: a poster is kept per hero or full view and per style', () => {
  const keys = [[true, 'real'], [true, 'simple'], [false, 'real'], [false, 'simple']].map(([h, s]) => card.posterKey(h, s));
  assert.equal(new Set(keys).size, 4);
  keys.forEach(k => assert.match(k, /^house3d-poster:/));
});

test('card: a poster reads back only as an image, and a failed write keeps the newer one in memory', () => {
  const store = new Map(), full = { value: false };
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { if (full.value) throw new Error('quota'); store.set(k, v); }
  };
  try {
    const key = card.posterKey(false, 'real') + ':test';
    assert.equal(card.readPoster(key), null);
    store.set(key, 'not an image');
    assert.equal(card.readPoster(key), null, 'a stored value that is no image is ignored');
    card.writePoster(key, 'data:image/jpeg;base64,AAA');
    assert.equal(card.readPoster(key), 'data:image/jpeg;base64,AAA');
    full.value = true;
    card.writePoster(key, 'data:image/jpeg;base64,BBB');
    assert.equal(card.readPoster(key), 'data:image/jpeg;base64,BBB', 'the newer picture wins over the stored one');
  } finally {
    delete globalThis.localStorage;
  }
});
