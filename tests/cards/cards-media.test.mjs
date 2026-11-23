// Tests of A3 Kaamerad (ADR-016) and Teler (ADR-017) card helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards as V, cards as A3, st, TZ } from './cards-harness.mjs';

/* ---------- Kaamerad (ADR-016): the stills, the slots, the count cell ---------- */

const PROXY = '/api/camera_proxy/camera.cam_one_alamvoog?token=abc';

test('Kaamerad: the still URL carries the token and a time, and none without a picture', () => {
  assert.equal(V.cameraUrl(st('idle', { entity_picture: PROXY }), 1700000000000), `${PROXY}&t=1700000000000`);
  assert.equal(V.cameraUrl(st('idle', { entity_picture: '/x.jpg' }), 5), '/x.jpg?t=5');
  assert.equal(V.cameraUrl(st('idle'), 5), null);
  assert.equal(V.cameraUrl(undefined, 5), null);
});

test('Kaamerad: a slot shows the still, the last one dimmed with its time in HA zone, no still yet, or a placeholder', () => {
  const ok = st('idle', { entity_picture: PROXY }), last = Date.parse('2026-11-13T12:11:30Z');
  assert.deepEqual(V.cameraSlot(ok, undefined, false), { kind: 'live', text: '' });
  assert.deepEqual(V.cameraSlot(ok, last, false), { kind: 'live', text: '' });
  assert.deepEqual(V.cameraSlot(st('unavailable'), last, false, 'et', 'Europe/Tallinn'), { kind: 'stale', text: 'Kaamera ei vasta, viimane pilt 14:11' });
  assert.deepEqual(V.cameraSlot(ok, last, true, 'et', 'UTC'), { kind: 'stale', text: 'Kaamera ei vasta, viimane pilt 12:11' }, 'a failed load, in the zone given');
  assert.deepEqual(V.cameraSlot(st('unavailable'), undefined, false), { kind: 'down', text: 'Kaamera ei vasta' });
  assert.deepEqual(V.cameraSlot(ok, undefined, true, 'en'), { kind: 'down', text: 'Camera not responding' });
  assert.deepEqual(V.cameraSlot(undefined, undefined, false), { kind: 'down', text: 'Kaamera ei vasta' });
  assert.deepEqual(V.cameraSlot(st('idle'), undefined, false), { kind: 'none', text: '' }, 'the demo has no picture');
});

test('Kaamerad: a thumbnail becomes the hero and the others keep their order', () => {
  assert.deepEqual(V.cameraThumbs(1, 0), []);
  assert.deepEqual(V.cameraThumbs(2, 0), [1]);
  assert.deepEqual(V.cameraThumbs(2, 1), [0]);
  assert.deepEqual(V.cameraThumbs(4, 0), [1, 2, 3]);
  assert.deepEqual(V.cameraThumbs(4, 2), [0, 1, 3]);
});

test('Kaamerad: a count cell counts, names the missing ones, is red while one is, and has no sheet', () => {
  const cams = [{ entity: 'camera.a', name: 'Üks' }, { entity: 'camera.b', name: 'Kaks' }, { entity: 'camera.c', name: 'Kolm' }];
  const cell = { name: 'Kaamerad', count: { entities: cams, state: '*' }, note: { missing: 'kõik vastavad' } };
  const s = (a, b, c) => ({ 'camera.a': st(a), 'camera.b': st(b), ...(c ? { 'camera.c': st(c) } : {}) });
  assert.deepEqual(V.countCell(cell, s('idle', 'idle', 'idle')), { value: '3 / 3', tone: '', note: 'kõik vastavad' });
  assert.deepEqual(V.countCell(cell, s('idle', 'unavailable', 'unknown')), { value: '1 / 3', tone: 'bad', note: 'Kaks ja Kolm' });
  assert.deepEqual(V.countCell(cell, s('unavailable', 'unavailable'), 'en'), { value: '0 / 3', tone: 'bad', note: 'Üks, Kaks and Kolm' }, 'a missing entity is not counted');
  const on = { name: 'Tuvastus', count: { entities: cams.slice(0, 2), state: 'on' }, note: { missing: 'sees' } };
  assert.equal(V.countCell(on, { 'camera.a': st('on'), 'camera.b': st('off') }).note, 'Kaks');
  assert.deepEqual(V.countCell(on, { 'camera.a': st('on'), 'camera.b': st('on') }), { value: '2 / 2', tone: '', note: 'sees' });
  const nvr = { entity: 'sensor.nvr', name: 'NVR ketas', words: { OK: 'korras', '*': 'viga' } };
  const conf = { cells: [nvr, cell, on] };
  assert.deepEqual(V.readingWatched(conf), ['sensor.nvr', 'camera.a', 'camera.b', 'camera.c']);
  const m = V.readingA3Markup(conf, { 'sensor.nvr': st('OK'), ...s('idle', 'idle', 'idle'), 'camera.a': st('on'), 'camera.b': st('off') }, null, 'et', { config: { time_zone: 'Europe/Tallinn' } });
  assert.deepEqual([...m.sheets.keys()], ['c0'], 'only the NVR cell opens a sheet');
  assert.match(m.html, /<span class="cell"><span class="lab">Kaamerad<\/span><span class="v num">3 \/ 3<\/span><span class="sub">kõik vastavad<\/span><\/span>/);
  assert.match(m.html, /<span class="cell"><span class="lab">Tuvastus<\/span><span class="v num bad">1 \/ 2<\/span><span class="sub">Kaks<\/span><\/span>/);
});

test('Kaamerad: a cell word by the exact state first, then the first matching pattern', () => {
  const nvr = { entity: 'sensor.nvr', words: { OK: 'korras', '*': 'viga' } };
  assert.equal(V.cellValue(nvr, { 'sensor.nvr': st('OK') }), 'korras');
  assert.equal(V.cellValue(nvr, { 'sensor.nvr': st('Rike') }), 'viga');
  assert.equal(V.cellValue(nvr, { 'sensor.nvr': st('unavailable') }), 'viga');
  assert.equal(V.cellValue({ entity: 'sensor.nvr', words: { '!OK': 'viga', OK: 'korras' } }, { 'sensor.nvr': st('OK') }), 'korras', 'the exact key wins over an earlier pattern');
  assert.equal(V.cellValue({ entity: 'sensor.nvr', words: { OK: 'korras' } }, { 'sensor.nvr': st('Rike') }), 'Rike', 'no word without a match');
});

/* ---------- Teler (ADR-017) ---------- */

const TV_NOW = Date.parse('2026-11-13T19:48:00Z'); // 21:48 in Tallinn
const secs = iso => Date.parse(iso) / 1000;
const TV = {
  entity: 'media_player.tv', app: 'sensor.app', sessions: 'sensor.sessions',
  apps: [{ name: 'YouTube', color: '#e53935' }, { name: 'Elisa Elamus', color: '#7e57c2' }],
  entities: [
    { entity: 'sensor.youtube_tana', name: 'YouTube', color: '#e53935' },
    { entity: 'sensor.elisa_tana', name: 'Elisa Elamus', color: '#7e57c2' },
    { entity: 'sensor.go3_tana', name: 'Go3', color: '#fb8c00' }
  ]
};
const SESSIONS = [
  { app: 'Go3', start: secs('2026-11-13T11:24:00Z'), end: secs('2026-11-13T11:24:40Z') },
  { app: 'YouTube', start: secs('2026-11-13T17:41:00Z'), end: secs('2026-11-13T19:07:00Z') },
  { app: 'Elisa Elamus', start: secs('2026-11-13T19:07:00Z'), end: null }
];
const tvStates = (tv, app, list = SESSIONS, date = '2026-11-13') => ({ 'media_player.tv': st(tv), 'sensor.app': st(app), 'sensor.sessions': st(date, { seansid: list }) });

test('Teler: watch time as "1 t 5 min", "22 min" and whole hours; a column in hours from an hour', () => {
  assert.equal(A3.durText(65 / 60), '1 t 5 min');
  assert.equal(A3.durText(22 / 60), '22 min');
  assert.equal(A3.durText(2), '2 t');
  assert.equal(A3.durText(65 / 60, 'en'), '1 h 5 min');
  assert.equal(A3.colText(3.24), '3,2 t');
  assert.equal(A3.colText(0.5), '30 min');
  assert.equal(A3.colText(3.24, 'en'), '3.2 h');
});

test("Teler: now, the app with its running session's minutes, nothing on the home screen", () => {
  const on = A3.tvNow(TV, tvStates('on', 'Elisa Elamus'), TV_NOW, 'et', TZ);
  assert.deepEqual(on, { kind: 'on', label: 'Praegu', big: 'Elisa Elamus', note: '41 min, alates 21:07', color: '#7e57c2' });
  const home = A3.tvNow(TV, tvStates('on', 'Avaleht', SESSIONS.slice(0, 2)), TV_NOW, 'et', TZ);
  assert.deepEqual([home.big, home.note, home.color], ['Avaleht', '', '#8e8e93']);
  // the clock in HA's zone, not the browser's
  assert.equal(A3.tvNow(TV, tvStates('on', 'Elisa Elamus'), TV_NOW, 'en', 'UTC').note, '41 min, since 19:07');
});

test("Teler: off with today's last ended session; none while it is open or the list is yesterday's; no state", () => {
  const off = A3.tvNow(TV, tvStates('off', 'Väljas', SESSIONS.slice(0, 2)), TV_NOW, 'et', TZ);
  assert.deepEqual([off.kind, off.label, off.big, off.note], ['off', 'Väljas', 'Teler on väljas', 'viimati YouTube, kuni 21:07']);
  assert.equal(A3.tvNow(TV, tvStates('off', 'Väljas'), TV_NOW, 'et', TZ).note, '');
  assert.equal(A3.tvNow(TV, tvStates('off', 'Väljas', SESSIONS.slice(0, 2), '2026-11-12'), TV_NOW, 'et', TZ).note, '');
  for (const s of ['unavailable', 'unknown']) assert.deepEqual(A3.tvNow(TV, tvStates(s, 'Väljas'), TV_NOW, 'et', TZ).kind, 'down');
  assert.equal(A3.tvNow(TV, {}, TV_NOW, 'en', TZ).big, 'The TV is not responding');
});

test("Teler: today's sessions of a minute or more, newest first, the running one to now, only today's list", () => {
  const rows = A3.sessionRows(TV, tvStates('on', 'Elisa Elamus'), TV_NOW, 'et', TZ);
  assert.deepEqual(rows, [
    { when: '21:07–praegu', app: 'Elisa Elamus', color: '#7e57c2', dur: '41 min' },
    { when: '19:41–21:07', app: 'YouTube', color: '#e53935', dur: '1 t 26 min' }
  ]);
  assert.deepEqual(A3.sessionRows(TV, tvStates('on', 'Elisa Elamus', SESSIONS, '2026-11-12'), TV_NOW, 'et', TZ), []);
  assert.deepEqual(A3.sessionRows(TV, tvStates('on', 'Avaleht', []), TV_NOW, 'et', TZ), []);
  assert.deepEqual(A3.sessionRows(TV, { 'sensor.sessions': st('2026-11-13', {}) }, TV_NOW, 'et', TZ), []);
  // an app outside the list is grey
  const other = A3.sessionRows(TV, tvStates('on', 'Teliatv', [{ app: 'Teliatv', start: secs('2026-11-13T19:00:00Z'), end: null }]), TV_NOW, 'en', TZ);
  assert.deepEqual([other[0].when, other[0].color], ['21:00–now', '#8e8e93']);
});

test("Teler: today's total, the apps used 30 s or more longest first, their shares, yesterday's counter as 0", () => {
  const fresh = '2026-11-13T19:40:00Z', old = '2026-11-12T21:59:00Z';
  const states = {
    'sensor.youtube_tana': { state: '1.5', last_updated: fresh },
    'sensor.elisa_tana': { state: '3.0', last_updated: fresh },
    'sensor.go3_tana': { state: '0.005', last_updated: fresh }
  };
  const u = A3.usageToday(TV, states, TV_NOW, TZ);
  assert.equal(u.total.toFixed(3), '4.505');
  assert.deepEqual(u.rows.map(r => r.name), ['Elisa Elamus', 'YouTube']);
  assert.deepEqual(u.bar.map(b => Math.round(b.pct)), [67, 33]);
  // reset lag: a counter last updated before today's start still holds yesterday's hours
  const lag = A3.usageToday(TV, { ...states, 'sensor.elisa_tana': { state: '3.0', last_updated: old } }, TV_NOW, TZ);
  assert.deepEqual([lag.total.toFixed(3), lag.rows.map(r => r.name)], ['1.505', ['YouTube']]);
  assert.deepEqual(A3.usageToday(TV, {}, TV_NOW, TZ), { total: 0, rows: [], bar: [] });
});

test('Teler: a stacked days series asks once for every part and reads today from the counters', () => {
  const stack = [
    { statistic: 'sensor.youtube_vaadatud', name: 'YouTube', color: '#e53935', today: { entity: 'sensor.youtube_tana' } },
    { statistic: 'sensor.elisa_vaadatud', name: 'Elisa Elamus', color: '#7e57c2', today: { entity: 'sensor.elisa_tana' } },
    { statistic: 'sensor.go3_vaadatud', name: 'Go3', color: '#fb8c00', today: { entity: 'sensor.go3_tana' } }
  ];
  const conf = { days: 7, series: [{ name: 'Nädal', stack }] };
  assert.deepEqual(A3.daysRequests(conf, TV_NOW, TZ), { 'daily:change': A3.dailyRequest(stack.map(s => s.statistic), ['change'], 7, TV_NOW, TZ) });
  const starts = A3.dayStarts(7, TV_NOW, TZ);
  // YouTube every day, Elisa from the 5th day; Go3 has no statistics; today's rows are partial
  const resp = {
    'sensor.youtube_vaadatud': starts.map((t, i) => ({ start: t, change: i + 1 })),
    'sensor.elisa_vaadatud': starts.slice(4).map(t => ({ start: t, change: 2 }))
  };
  const states = { 'sensor.youtube_tana': { state: '0.5', last_updated: '2026-11-13T19:40:00Z' }, 'sensor.elisa_tana': { state: '1.25', last_updated: '2026-11-13T19:40:00Z' } };
  const pts = A3.stackPoints(resp, stack, 7, TV_NOW, TZ, states);
  assert.deepEqual(pts.map(p => p.v), [1, 2, 3, 4, 7, 8, 1.75]);
  assert.deepEqual(pts[4].parts, [5, 2, null]);
  assert.deepEqual(pts[6].parts, [0.5, 1.25, 0]);
  assert.deepEqual(pts.map(p => p.today), [false, false, false, false, false, false, true]);
  // the total counts today, the average leaves it out
  assert.deepEqual(A3.stackStats(pts), { total: 26.75, avg: 25 / 6 });
  assert.deepEqual(pts.map(p => A3.stackLabel(p, TZ)), ['L', 'P', 'E', 'T', 'K', 'N', 'täna']);
  assert.deepEqual(pts.map(p => A3.stackLabel(p, TZ, 'en')), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'today']);
  const aria = A3.stackAria(pts, stack, TZ);
  assert.ok(aria.startsWith('Päevade kaupa: laupäev 7.11 1 t (YouTube 1 t); '));
  assert.ok(aria.endsWith('reede 13.11 1 t 45 min (YouTube 30 min, Elisa Elamus 1 t 15 min)'));
  assert.deepEqual(A3.stackStats(A3.stackPoints({}, stack, 7, TV_NOW, TZ, {})), { total: 0, avg: null });
});
