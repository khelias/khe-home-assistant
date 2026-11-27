// Tests of A3 Soojuspump (ADR-011), Ventilatsioon and Pergola (ADR-014) card helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cards as A3, st, TZ, NOW, iso, fixture } from './cards-harness.mjs';

const HOURLY = fixture('hourly.json');

test('Soojuspump: the hourly request is 48 whole hours back, the same all hour', () => {
  const r = A3.lineRequest('sensor.a', 48, HOURLY.now);
  assert.deepEqual(r, { type: 'recorder/statistics_during_period', start_time: '2026-11-10T20:00:00.000Z', statistic_ids: ['sensor.a'], period: 'hour', types: ['mean'] });
  assert.deepEqual(A3.lineRequest('sensor.a', 48, Date.parse('2026-11-12T20:59:59Z')), r);
  assert.equal(A3.lineRequest('sensor.a', 48, Date.parse('2026-11-12T21:00:00Z')).start_time, '2026-11-10T21:00:00.000Z');
});

test('Soojuspump: the line from the house ends at the live value', () => {
  const s = A3.lineSeries(HOURLY.hourly_mean, 'sensor.a', 24.463, HOURLY.now);
  assert.equal(s.points.length, 49);
  assert.deepEqual(s.points[48], { t: HOURLY.now, v: 24.463, live: true });
  assert.equal(s.points[0].v, HOURLY.hourly_mean['sensor.a'][0].mean);
  assert.ok(s.points.slice(0, 48).every(p => p.v > 20 && p.v < 26));
  assert.equal(A3.lineSeries(HOURLY.hourly_mean, 'sensor.a', null, HOURLY.now).points.length, 48);
  assert.deepEqual(A3.lineSeries({}, 'sensor.a', null, HOURLY.now).points, []);
  const st = A3.lineStats(s, HOURLY.hourly_mean['sensor.a'][0].start, HOURLY.now);
  assert.equal(st.hi, 24.463);
});

test('Soojuspump: the range takes in a floor outside the data', () => {
  const pts = A3.lineSeries(HOURLY.hourly_mean, 'sensor.b', 55, HOURLY.now).points;
  const stats = A3.lineStats({ kind: 'line', points: pts }, 0, HOURLY.now), floor = Math.floor(stats.lo) - 5;
  // a floor under the data stretches the range down to it
  const r = A3.lineRange(stats, floor);
  assert.ok(r.lo < floor && r.hi > 55);
  assert.ok(A3.lineRange(stats).lo > floor);
  assert.equal(A3.lineRange(null, 45), null);
  // a flat line still has a span
  const flat = A3.lineRange({ lo: 3, hi: 3 });
  assert.ok(flat.hi > flat.lo);
});

test('Soojuspump: the axis says the day by distance, then the weekday', () => {
  const at = (d, h) => new Date(2026, 10, d, h).getTime();
  assert.deepEqual(A3.lineAxis(at(10, 21), at(12, 21)), ['teisipäev 21:00', 'eile 21:00', 'nüüd']);
  assert.deepEqual(A3.lineAxis(at(12, 3), at(12, 21)), ['täna 03:00', 'täna 12:00', 'nüüd']);
});

test('Soojuspump: the shift notes at -1, 0 and +1', () => {
  assert.equal(A3.stepNote(-1), 'Küttevesi 1° jahedam kui kõvera järgi');
  assert.equal(A3.stepNote(0), 'Küttevesi täpselt kõvera järgi');
  assert.equal(A3.stepNote(1), 'Küttevesi 1° soojem kui kõvera järgi');
  assert.deepEqual([-2, 0, 3].map(A3.stepText), ['−2°', '0°', '+3°']);
});

test('Soojuspump: the stepper stays within min and max, and taps that net to zero write nothing', () => {
  const lim = { min: -10, max: 10, step: 1 };
  assert.equal(A3.stepValue(1, 1, lim), 2);
  assert.equal(A3.stepValue(10, 1, lim), 10);
  assert.equal(A3.stepValue(-10, -1, lim), -10);
  assert.equal(A3.stepValue(-9, -1, lim), -10);
  assert.equal(A3.stepValue(0.5, 1, { step: 0.5 }), 1);
  assert.equal(A3.stepWrite(2, 1), 2);
  assert.equal(A3.stepWrite(1, 1), null);
  assert.equal(A3.stepWrite(null, 1), null);
});

const BOILER_CELLS = [
  { name: 'Täna', entity: 'sensor.today', note: 'päev pole läbi' },
  { name: 'Sel kuul', entity: 'sensor.month', share_of: 'sensor.total' },
  { entity: 'sensor.month', last: 'month', note: 'terve kuu' }
];
const boilerStates = (over = {}) => ({
  'sensor.today': st('2', { unit_of_measurement: 'kWh' }),
  'sensor.month': st('50', { unit_of_measurement: 'kWh', October: 106, December: '-', 'Last December': 43 }),
  'sensor.total': st('362', { unit_of_measurement: 'kWh' }), ...over
});

test('Soojuspump: the boiler cells, today, the share of the house and last month', () => {
  assert.deepEqual(A3.dayCells(boilerStates(), BOILER_CELLS, NOW, TZ), [
    { k: 'Täna', v: '2 kWh', l: 'päev pole läbi' }, { k: 'Sel kuul', v: '50 kWh', l: '14 % majast' }, { k: 'Oktoober', v: '106 kWh', l: 'terve kuu' }
  ]);
});

test('Soojuspump: a share with a zero, a missing or a lagging month', () => {
  const share = over => A3.dayCells(boilerStates(over), BOILER_CELLS, NOW, TZ)[1].l;
  assert.equal(share({ 'sensor.month': st('0'), 'sensor.total': st('0') }), '');
  assert.equal(share({ 'sensor.month': st('0') }), '0 % majast');
  assert.equal(share({ 'sensor.total': st('unavailable') }), '');
  // a delayed house total below the boiler's month: never past 100
  assert.equal(share({ 'sensor.total': st('40') }), '100 % majast');
  assert.equal(A3.dayCells(boilerStates({ 'sensor.month': st('unknown') }), BOILER_CELLS, NOW, TZ)[1].v, '–');
});

test('Soojuspump: last month left out on days 1-2, a dash, and Last December in January', () => {
  assert.equal(A3.dayCells(boilerStates(), BOILER_CELLS, Date.parse('2026-11-02T10:00:00Z'), TZ).length, 2);
  const jan = A3.dayCells(boilerStates(), BOILER_CELLS, Date.parse('2027-01-10T10:00:00Z'), TZ)[2];
  assert.deepEqual(jan, { k: 'Detsember', v: '43 kWh', l: 'terve kuu' });
  const dash = A3.dayCells(boilerStates({ 'sensor.month': st('50', { October: '-' }) }), BOILER_CELLS, NOW, TZ)[2];
  assert.equal(dash.v, '–');
  assert.equal(A3.lastMonthValue(st('1', { last_period: '42.589' }), 'last_period', NOW, TZ), 42.589);
});

test('Soojuspump: the status line, ok only with heating on and both faults off', () => {
  const conf = { faults: [{ entity: 'binary_sensor.unit', name: 'Soojuspumba viga' }, { entity: 'binary_sensor.tank', name: 'Boileri viga' }], status: { entity: 'switch.heat', ok: 'Korras, küte ja boiler töötavad', off: 'Küte väljas' } };
  const s = (heat, unit = 'off', tank = 'off') => A3.statusLine({ 'switch.heat': st(heat), 'binary_sensor.unit': st(unit), 'binary_sensor.tank': st(tank) }, conf);
  assert.deepEqual(s('on'), { tone: 'ok', text: 'Korras, küte ja boiler töötavad' });
  assert.deepEqual(s('on', 'on'), { tone: 'bad', text: 'Viga' });
  assert.deepEqual(s('off', 'off', 'on'), { tone: 'bad', text: 'Viga' });
  assert.deepEqual(s('off'), { tone: 'off', text: 'Küte väljas' });
  assert.deepEqual(s('on', 'unavailable'), { tone: 'off', text: 'Seisund pole teada' });
  assert.deepEqual(s('unavailable'), { tone: 'off', text: 'Seisund pole teada' });
  assert.equal(A3.statusLine({}, {}), null);
});

test('Soojuspump: the boiler days from the house, today out of the average', () => {
  const pts = A3.dailySeries(HOURLY.daily_change, 'sensor.c', 'change', 16, HOURLY.now, TZ, A3.dayStarts(1, HOURLY.now, TZ)[0]);
  assert.equal(pts.length, 16);
  assert.deepEqual([pts[0].label, pts[15].label], ['28.10', '12.11']);
  assert.deepEqual(pts.map(p => p.late).filter(Boolean).length, 1);
  assert.ok(pts[15].late);
  const full = pts.slice(0, 15).map(p => p.v);
  assert.ok(Math.abs(A3.dayStats(pts).avg - full.reduce((a, v) => a + v, 0) / 15) < 1e-9);
});

test('Soojuspump: a link tile keeps its fixed text when its entity is unavailable', () => {
  const conf = { entity: 'switch.heat', state_text: 'Küte välja, kütte režiim, boileri siht', active: [] };
  assert.deepEqual(A3.tileState(conf, { 'switch.heat': st('unavailable') }), { lit: false, unavailable: false, text: conf.state_text });
  assert.equal(A3.tileState(conf, { 'switch.heat': st('on') }).lit, false);
});


/* ---------- Ventilatsioon: any unit, the meter, the overlay and the ratio ---------- */

const VENT = fixture('vent.json');

test('Ventilatsioon: a % value and its unit, a W cell scaled to kW, °C as before', () => {
  assert.deepEqual(A3.splitValue(st('41', { unit_of_measurement: '%' })), { value: '41', unit: '%' });
  assert.deepEqual(A3.splitValue(st('84.2', { unit_of_measurement: '%' }), 0), { value: '84', unit: '%' });
  assert.deepEqual(A3.splitValue(st('1274.07', { unit_of_measurement: 'W' }), 1, 'et', { scale: 0.001, unit: 'kW' }), { value: '1,3', unit: 'kW' });
  assert.deepEqual(A3.splitValue(st('1274.07', { unit_of_measurement: 'W' }), 1, 'en', { scale: 0.001, unit: 'kW' }), { value: '1.3', unit: 'kW' });
  assert.deepEqual(A3.splitValue(st('53', { unit_of_measurement: 'W' }), 0), { value: '53', unit: 'W' });
  assert.deepEqual(A3.splitValue(st('21.78', { unit_of_measurement: '°C' }), 1), { value: '21,8°', unit: '' });
  assert.deepEqual(A3.splitValue(st('unavailable', { unit_of_measurement: 'W' }), 1, 'et', { scale: 0.001, unit: 'kW' }), { value: 'pole saadaval', unit: '' });
  assert.deepEqual(A3.splitValue(st('on'), 1, 'et', { scale: 0.001 }), { value: 'sees', unit: '' });
});

test('Ventilatsioon: the range note carries the unit in both languages, ° stays °', () => {
  assert.equal(A3.words('et').rangeNote(48, '30 %', '47 %'), '48 tunniga 30 % kuni 47 %');
  assert.equal(A3.words('en').rangeNote(48, '30 %', '47 %'), '30 % to 47 % in 48 hours');
  assert.equal(A3.words('et').rangeNote(48, '22,1°', '24,5°'), '48 tunniga 22,1° kuni 24,5°');
});

test('Ventilatsioon: a cell sheet reads its entity unit, a scaled one whole', () => {
  const states = { 'sensor.w': st('1274', { unit_of_measurement: 'W' }), 'sensor.t': st('21.7', { unit_of_measurement: '°C' }), 'sensor.p': st('100', { unit_of_measurement: '%' }) };
  const w = A3.cellSheet({ entity: 'sensor.w', name: 'Tagastab', scale: 0.001, unit: 'kW', decimals: 1, history: { source: 'statistics', type: 'mean' } }, states);
  assert.deepEqual([w.unit, w.decimals, w.history.entity], ['W', 0, 'sensor.w']);
  assert.deepEqual([A3.cellSheet({ entity: 'sensor.t', name: 'Tuppa' }, states).unit, A3.cellSheet({ entity: 'sensor.t', name: 'Tuppa' }, states).decimals], ['°C', 1]);
  assert.deepEqual([A3.cellSheet({ entity: 'sensor.p', name: 'Vaheti', decimals: 0 }, states).unit, A3.cellSheet({ entity: 'sensor.p', name: 'Vaheti', decimals: 0 }, states).decimals], ['%', 0]);
});

test('Ventilatsioon: three cells sit side by side, one or two as before', () => {
  assert.deepEqual([1, 2, 3].map(A3.cellsClass), ['cells', 'cells', 'cells c3']);
});

test("Ventilatsioon: the tile's second line names the mode and ECO", () => {
  const conf = { entity: 'select.komfovent_operation_mode', state_text: [{ entity: 'sensor.ventilatsiooni_reziim' }, { entity: 'switch.komfovent_eco_mode', label: 'ECO' }] };
  const states = { 'select.komfovent_operation_mode': st('normal'), 'sensor.ventilatsiooni_reziim': st('Tavaline'), 'switch.komfovent_eco_mode': st('on') };
  assert.equal(A3.tileState(conf, states).text, 'Tavaline · ECO sees');
  assert.equal(A3.tileState(conf, { ...states, 'switch.komfovent_eco_mode': st('off') }).text, 'Tavaline · ECO väljas');
  assert.equal(A3.tileState(conf, { ...states, 'sensor.ventilatsiooni_reziim': st('Kamin') }).text, 'Kamin · ECO sees');
});

test('Ventilatsioon: the meter at 0, 34 and over its max, and without a value', () => {
  const m = { entity: 'sensor.f', name: 'Filter', note: 'ummistunud', max: 100 };
  const at = v => A3.meterRow({ 'sensor.f': st(v, { unit_of_measurement: '%' }) }, m);
  assert.deepEqual(at('34'), { name: 'Filter', value: '34 %', pct: 34, note: 'ummistunud' });
  assert.equal(at('0').pct, 0);
  assert.deepEqual([at('130').pct, at('130').value], [100, '130 %']);
  assert.equal(A3.meterRow({ 'sensor.f': st('-5') }, m).pct, 0);
  assert.deepEqual([at('unknown').pct, at('unknown').value], [0, 'teadmata']);
  assert.equal(A3.meterRow({ 'sensor.f': st('17') }, { entity: 'sensor.f', max: 50 }).pct, 34);
});

const PAYBACK = { days: 16, series: [{ name: 'kWh', statistic: 'sensor.r', type: 'change', headline: 'ratio', overlay: { statistic: 'sensor.e', type: 'change', name: 'seadme elekter' } }] };

test('Ventilatsioon: the overlay rides in the same request, its own when its type differs', () => {
  const same = A3.daysRequests(PAYBACK, VENT.now, TZ);
  assert.deepEqual(Object.keys(same), ['daily:change']);
  assert.deepEqual(same['daily:change'].statistic_ids, ['sensor.r', 'sensor.e']);
  const other = A3.daysRequests({ ...PAYBACK, series: [{ ...PAYBACK.series[0], overlay: { statistic: 'sensor.m', type: 'mean' } }] }, VENT.now, TZ);
  assert.deepEqual(Object.keys(other), ['daily:change', 'daily:mean']);
  assert.deepEqual([other['daily:change'].statistic_ids, other['daily:mean'].statistic_ids, other['daily:mean'].types], [['sensor.r'], ['sensor.m'], ['mean']]);
});

test('Energia and Soojuspump: their days requests are as before', () => {
  const energia = { days: 31, cutoff: 'sensor.a', series: [{ statistic: 'sensor.a', type: 'change' }, { statistic: 'sensor.b', type: 'change' }] };
  assert.deepEqual(A3.daysRequests(energia, NOW, TZ), { 'daily:change': A3.dailyRequest(['sensor.a', 'sensor.b'], ['change'], 31, NOW, TZ), cutoff: A3.hourlyRequest('sensor.a', NOW) });
  const price = { days: 30, series: [{ statistic: 'sensor.c', type: 'mean', peak: true }] };
  assert.deepEqual(A3.daysRequests(price, NOW, TZ), { 'daily:mean,max': A3.dailyRequest(['sensor.c'], ['mean', 'max'], 30, NOW, TZ) });
  const boiler = { days: 16, series: [{ statistic: 'sensor.c', type: 'change' }] };
  assert.deepEqual(A3.daysRequests(boiler, NOW, TZ), { 'daily:change': A3.dailyRequest(['sensor.c'], ['change'], 16, NOW, TZ) });
});

const ventDays = () => {
  const today = A3.dayStarts(1, VENT.now, TZ)[0], days = (id) => A3.dailySeries(VENT.daily_change, id, 'change', 16, VENT.now, TZ, today);
  return A3.withOverlay(days('sensor.r'), days('sensor.e'));
};

test('Ventilatsioon: the ratio of complete-day sums from the house, today out', () => {
  const pts = ventDays();
  assert.equal(pts.length, 16);
  assert.ok(pts[15].late && pts.slice(0, 15).every(p => !p.late && p.v !== null && p.o !== null));
  const full = pts.slice(0, 15), want = full.reduce((a, p) => a + p.v, 0) / full.reduce((a, p) => a + p.o, 0);
  assert.ok(Math.abs(A3.dayRatio(pts) - want) < 1e-9);
  assert.ok(want > 15 && want < 30);
  assert.deepEqual(A3.ratioHeadline(want, { caption: 'rohkem', caption_below: 'vähem' }), [`${Math.round(want)} korda`, 'rohkem']);
  assert.equal(A3.ratioHeadline(want, { caption: 'more' }, 'en')[0], `${Math.round(want)} times`);
});

test('Ventilatsioon: a zero electricity day, none at all, and a ratio below 1', () => {
  const day = (v, o, late = false) => ({ v, o, late });
  assert.equal(A3.dayRatio([day(20, 0), day(10, 1)]), 30);
  assert.equal(A3.dayRatio([day(20, 0), day(10, 0)]), null);
  assert.equal(A3.dayRatio([day(20, null), day(10, 2), day(99, 1, true)]), 5);
  assert.equal(A3.dayRatio([]), null);
  const below = A3.dayRatio([day(1, 2), day(0.5, 2)]);
  assert.deepEqual(A3.ratioHeadline(below, { caption: 'rohkem soojust tagasi', caption_below: 'vähem soojust tagasi' }), ['0,4 korda', 'vähem soojust tagasi']);
  assert.deepEqual(A3.ratioHeadline(null, { caption: 'x' }), ['–', '']);
  assert.equal(A3.ratioHeadline(3.44, {})[0], '3,4 korda');
  // the caption follows the number shown, so 0.97 reads as 1,0 and not as less
  assert.deepEqual(A3.ratioHeadline(0.97, { caption: 'rohkem', caption_below: 'vähem' }), ['1,0 korda', 'rohkem']);
  assert.deepEqual(A3.ratioHeadline(0.94, { caption: 'rohkem', caption_below: 'vähem' }), ['0,9 korda', 'vähem']);
});

test('Ventilatsioon: the scale takes the overlay in, so a day with no recovered heat still fits', () => {
  const pts = ventDays();
  const top = A3.daysTop(pts);
  assert.ok(top >= Math.max(...pts.map(p => p.v)));
  assert.equal(A3.daysTop([{ v: 0, o: 1.3, max: null }]), 1.3 * 1.05);
  assert.equal(A3.daysTop([{ v: 0, o: 0, max: null }]), 1);
  assert.equal(A3.daysTop([{ v: null, o: null, max: null }]), 1);
});

const VENT_CELLS = [
  { kind: 'avg', name: 'Tagastas', note: 'päevas keskmiselt' },
  { name: 'Elekter sel kuul', entity: 'sensor.vm', unit: 'kWh', decimals: 1, note_last: 'last_period' },
  { name: 'Järelküte', entity: 'sensor.hm', unit: 'kWh', note: 'sel kuul', bad_above: 0 }
];
const ventStates = (over = {}) => ({ 'sensor.vm': st('16.718', { last_period: '42.589' }), 'sensor.hm': st('0', { last_period: '0' }), ...over });

test('Ventilatsioon: the average cell, last month in a note and the heater red above 0', () => {
  assert.deepEqual(A3.dayCells(ventStates(), VENT_CELLS, NOW, TZ, 'et', { avg: '27,9 kWh' }), [
    { k: 'Tagastas', v: '27,9 kWh', l: 'päevas keskmiselt' }, { k: 'Elekter sel kuul', v: '16,7 kWh', l: 'oktoobris 42,6' }, { k: 'Järelküte', v: '0 kWh', l: 'sel kuul' }
  ]);
  assert.equal(A3.dayCells(ventStates(), VENT_CELLS, NOW, TZ)[0].v, '–');
  const hot = A3.dayCells(ventStates({ 'sensor.hm': st('2.5') }), VENT_CELLS, NOW, TZ)[2];
  assert.deepEqual(hot, { k: 'Järelküte', v: '2,5 kWh', l: 'sel kuul', bad: true });
  assert.equal(A3.dayCells(ventStates(), VENT_CELLS, NOW, TZ, 'en')[1].l, '42.6 in October');
});

test('Ventilatsioon: last month\'s note is empty on days 1-2', () => {
  for (const day of ['2026-11-01T10:00:00Z', '2026-11-02T10:00:00Z']) assert.equal(A3.dayCells(ventStates(), VENT_CELLS, Date.parse(day), TZ)[1].l, '');
  assert.equal(A3.dayCells(ventStates(), VENT_CELLS, Date.parse('2026-11-03T10:00:00Z'), TZ)[1].l, 'oktoobris 42,6');
});

test('Ventilatsioon: pointing shows both values of a day, its end restores the ratio', () => {
  const pts = ventDays(), head = A3.ratioHeadline(A3.dayRatio(pts), { caption: 'rohkem' });
  const P = { pts, fmt: v => A3.formatNumber(v.toFixed(1), 1), unit: 'kWh', over: { name: 'seadme elekter', unit: 'kWh', fmt: v => A3.formatNumber(v.toFixed(2), 2) }, tz: TZ, lang: 'et', avg: head, unfinished: true };
  const [n, u] = A3.dayPoint(P, 14);
  assert.equal(n, A3.formatNumber(pts[14].v.toFixed(1), 1));
  assert.equal(u, `kWh · seadme elekter ${A3.formatNumber(pts[14].o.toFixed(2), 2)} kWh · ${A3.dayName(pts[14].t, TZ)}`);
  assert.match(A3.dayPoint(P, 15)[1], /päev pole läbi$/);
  assert.equal(A3.dayPoint(P, null), head);
  // without an overlay, as Energia and Soojuspump point
  assert.equal(A3.dayPoint({ ...P, over: undefined }, 14)[1], `kWh · ${A3.dayName(pts[14].t, TZ)}`);
});

test('Ventilatsioon: the humidity line from the house', () => {
  const s = A3.lineSeries(VENT.hourly_mean, 'sensor.h', 41, VENT.now);
  assert.equal(s.points.length, 49);
  const r = A3.lineStats(s, VENT.hourly_mean['sensor.h'][0].start, VENT.now);
  assert.ok(r.lo > 25 && r.hi < 60 && r.hi > r.lo);
});

test('Ventilatsioon: flow down is a note, not a fault, in the status line', () => {
  const conf = { faults: [{ entity: 'binary_sensor.f', name: 'Ventilatsiooni viga' }, { entity: 'binary_sensor.w', name: 'Ventilatsiooni hoiatus' }], notes: [{ entity: 'binary_sensor.d', name: 'Õhuvool alandatud' }], status: { entity: 'switch.p', ok: 'Korras, vigu ega hoiatusi pole', off: 'Seade väljas' } };
  const s = (p, d = 'off', f = 'off', w = 'off') => A3.statusLine({ 'switch.p': st(p), 'binary_sensor.d': st(d), 'binary_sensor.f': st(f), 'binary_sensor.w': st(w) }, conf);
  assert.equal(s('on', 'on').tone, 'ok');
  assert.equal(s('on', 'off', 'off', 'on').tone, 'bad');
  assert.deepEqual(s('off'), { tone: 'off', text: 'Seade väljas' });
});


/* ---------- A3 Pergola (ADR-014): the forecast, the tile's new parts, the status by a number ---------- */

const FC = JSON.parse(readFileSync(new URL('./fixtures/forecast.json', import.meta.url), 'utf8'));
const FC_ID = 'weather.test_forecast';
const fcRows = (now = FC.now, hours = 14) => A3.forecastHours(FC, FC_ID, now, hours);
const hourRow = (iso, p, cond = p > 0 ? 'rainy' : 'cloudy', temp = 3) => ({ datetime: iso, precipitation: p, temperature: temp, condition: cond });
const answer = rows => ({ response: { [FC_ID]: { forecast: rows } } });
const hoursFrom = (h0, ps) => ps.map((p, i) => hourRow(new Date(Date.UTC(2026, 10, 13, h0 + i)).toISOString(), p));

test('Pergola: the forecast request is a get_forecasts call with its response', () => {
  assert.deepEqual(A3.forecastRequest('weather.x'), {
    type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type: 'hourly' },
    target: { entity_id: 'weather.x' }, return_response: true
  });
});

test('Pergola: the house forecast from the hour now, 14 hours, its total and the dry stretch', () => {
  const rows = fcRows();
  assert.equal(rows.length, 14);
  // at 14:20 UTC the house answers from the next hour, 15:00; an hour on, 15:00 is the hour now
  assert.equal(new Date(rows[0].t).toISOString(), '2026-11-13T15:00:00.000Z');
  assert.equal(new Date(A3.forecastHours(FC, FC_ID, FC.now + 3600e3)[0].t).toISOString(), '2026-11-13T15:00:00.000Z');
  assert.equal(new Date(A3.forecastHours(FC, FC_ID, FC.now + 2 * 3600e3)[0].t).toISOString(), '2026-11-13T16:00:00.000Z');
  assert.equal(A3.forecastHours(FC, FC_ID, FC.now + 2 * 3600e3).length, 14);
  const s = A3.forecastSummary(rows);
  assert.equal(Number(s.total.toFixed(1)), 2.7);
  // dry 15-17 UTC is 17-19 in Tallinn, the first two dry hours
  assert.deepEqual(s.dry, [0, 2]);
  assert.equal(A3.forecastNote(rows, 'et', TZ), 'kuiv kell 17–19');
  assert.equal(A3.forecastNote(rows, 'en', TZ), 'dry 17–19');
});

test('Pergola: the dry stretch is the first of two hours or more, none, or dry throughout', () => {
  const rows = ps => A3.forecastHours(answer(hoursFrom(10, ps)), FC_ID, Date.UTC(2026, 10, 13, 10, 5), 14);
  // one dry hour is no stretch; the run from 13 to 16 UTC is 15-18 in Tallinn
  assert.deepEqual(A3.forecastSummary(rows([0.2, 0, 0.3, 0, 0, 0, 0.1])).dry, [3, 6]);
  assert.equal(A3.forecastNote(rows([0.2, 0, 0.3, 0, 0, 0, 0.1]), 'et', TZ), 'kuiv kell 15–18');
  // a stretch that runs to the window's end
  assert.equal(A3.forecastNote(rows([0.5, 0, 0]), 'et', TZ), 'kuiv kell 13–15');
  assert.equal(A3.forecastNote(rows([0.2, 0, 0.3, 0.1]), 'et', TZ), '');
  assert.deepEqual(A3.forecastSummary(rows([0, 0, 0])), { total: 0, dry: null });
  assert.equal(A3.forecastNote(rows([0, 0, 0]), 'et', TZ), 'kogu aeg kuiv');
  assert.equal(A3.forecastNote([], 'et', TZ), '');
});

test('Pergola: bars, the temperature line and a mark under each wet condition', () => {
  const rows = A3.forecastHours(answer([
    hourRow('2026-11-13T10:00:00Z', 0, 'cloudy', 2), hourRow('2026-11-13T11:00:00Z', 0.5, 'rainy', 3),
    hourRow('2026-11-13T12:00:00Z', 0, 'snowy', 1), hourRow('2026-11-13T13:00:00Z', 2, 'pouring', 4)
  ]), FC_ID, Date.UTC(2026, 10, 13, 10), 14);
  const P = A3.forecastPaths(rows);
  assert.equal(P.slot, 341 / 4);
  // two bars; 2 mm is the top, so 0.5 mm is a quarter of the room
  assert.equal((P.bars.match(/M/g) || []).length, 2);
  assert.match(P.bars, /^M\d+\.\d 76\.5h/);
  // a mark under the rain, the snow and the downpour, none under the cloud
  assert.equal((P.marks.match(/M/g) || []).length, 3);
  assert.ok(!P.marks.includes(`M${(341 / 8).toFixed(1)} `));
  assert.equal((P.line.match(/[ML]/g) || []).length, 4);
  // under 1 mm a bar is drawn against 1 mm, not against itself
  const small = A3.forecastPaths(A3.forecastHours(answer([hourRow('2026-11-13T10:00:00Z', 0.4)]), FC_ID, Date.UTC(2026, 10, 13, 10), 14));
  assert.match(small.bars, / 67\.2h/);
  assert.equal(A3.wetCondition('lightning-rainy'), true);
  assert.equal(A3.wetCondition('partlycloudy'), false);
});

test("Pergola: pointing an hour reads it in HA's zone, in both languages", () => {
  const rows = fcRows();
  assert.deepEqual(A3.forecastPoint(rows, 2, 'et', TZ), ['Kell 19–20', '0,4 mm', '3,3° · vihm']);
  assert.deepEqual(A3.forecastPoint(rows, 0, 'et', TZ), ['Kell 17–18', 'Kuiv', '2,6° · pilves']);
  assert.deepEqual(A3.forecastPoint(rows, 2, 'en', TZ), ['At 19–20', '0.4 mm', '3.3° · rain']);
  // the hour is HA's, not the browser's
  assert.deepEqual(A3.forecastPoint(rows, 2, 'et', 'UTC')[0], 'Kell 17–18');
  assert.equal(A3.hourAt(Date.UTC(2026, 10, 13, 22), 'et', TZ), 'kell 00–01');
});

test('Pergola: an empty, a failed and a missing answer give no hours', () => {
  assert.deepEqual(A3.forecastHours(answer([]), FC_ID, FC.now), []);
  assert.deepEqual(A3.forecastHours(undefined, FC_ID, FC.now), []);
  assert.deepEqual(A3.forecastHours({ response: {} }, FC_ID, FC.now), []);
  // hours all in the past
  assert.deepEqual(A3.forecastHours(FC, FC_ID, FC.now + 30 * 3600e3), []);
});

test('Pergola: a cell note by its value, else its caption', () => {
  const x = { entity: 'sensor.r', name: 'Praegu', note_above: { value: 0, above: 'sajab', below: 'ei saja' } };
  assert.equal(A3.cellNote(x, { 'sensor.r': st('0.4') }), 'sajab');
  assert.equal(A3.cellNote(x, { 'sensor.r': st('0.0') }), 'ei saja');
  assert.equal(A3.cellNote(x, { 'sensor.r': st('unknown') }), '');
  assert.equal(A3.cellNote({ entity: 'sensor.r', caption: 'maja juures' }, {}), 'maja juures');
});

test('Pergola: when, today, yesterday, older and a time alone, in a zone other than the machine', () => {
  // the machine runs Tallinn (TZ above); HA here is in New York
  const ny = 'America/New_York', now = Date.parse('2026-11-13T20:00:00Z');
  assert.equal(A3.whenText('2026-11-13T12:19:30+00:00', 'et', ny, now), 'täna 07:19');
  assert.equal(A3.whenText('2026-11-13T02:00:00+00:00', 'et', ny, now), 'eile 21:00');
  assert.equal(A3.whenText('2026-09-21T00:17:00+00:00', 'et', ny, now), '20.09 kell 20:17');
  assert.equal(A3.whenText('2026-09-21T00:17:00+00:00', 'en', ny, now), '20/09 at 20:17');
  assert.equal(A3.whenText('2026-11-13T02:00:00+00:00', 'en', ny, now), 'yesterday 21:00');
  assert.equal(A3.whenText('23:00:00'), '23:00');
  assert.equal(A3.whenText(null), '');
  assert.equal(A3.whenText('unknown'), '');
});

const RULE = 'input_boolean.roof_auto', AUTO = 'automation.rain_closes_roof', LIGHT = 'light.p', OFF = 'input_datetime.off', LAUTO = 'input_boolean.light_auto';
const ruleConf = { entity: RULE, wide: true, switch: true, state_text: [{ entity: AUTO, attribute: 'last_triggered', format: 'when', label: 'viimati', if: [{ state: 'on' }] }] };

test('Pergola: a part shows another entity attribute, a fixed text and only while its conditions hold', () => {
  const ctx = { tz: TZ, now: Date.parse('2026-11-13T15:00:00Z') };
  const states = { [RULE]: st('on'), [AUTO]: st('on', { last_triggered: '2026-11-13T12:19:04+00:00' }) };
  assert.equal(A3.tileState(ruleConf, states, 'et', ctx).text, 'viimati täna 14:19');
  // the rule off: every part hidden, the state word
  assert.equal(A3.tileState(ruleConf, { ...states, [RULE]: st('off') }, 'et', ctx).text, 'väljas');
  const light = { entity: LIGHT, state_text: [{ entity: OFF, format: 'when', label: 'kustub', if: [{ state: 'on' }, { entity: LAUTO, state: 'on' }] }] };
  const ls = { [LIGHT]: st('on'), [OFF]: st('23:00:00'), [LAUTO]: st('on') };
  assert.equal(A3.tileState(light, ls, 'et', ctx).text, 'kustub 23:00');
  assert.equal(A3.tileState(light, { ...ls, [LAUTO]: st('off') }, 'et', ctx).text, 'sees');
  assert.equal(A3.tileState(light, { ...ls, [LIGHT]: st('off') }, 'et', ctx).text, 'väljas');
  assert.equal(A3.tileState({ entity: LIGHT, state_text: [{ text: 'Poole peal' }, 'state'] }, ls).text, 'Poole peal · sees');
  assert.equal(A3.tileState({ entity: LIGHT, state_text: [{ entity: AUTO, attribute: 'mode' }] }, { ...ls, [AUTO]: st('on', { mode: 'single' }) }).text, 'single');
  // the parts' and their conditions' entities are watched, once each
  assert.deepEqual(A3.tileWatched(light), [LIGHT, OFF, LAUTO]);
  assert.deepEqual(A3.tileWatched({ entity: LIGHT, modes_entity: 'input_select.tone', modes: [] }), [LIGHT, 'input_select.tone']);
});

test('Pergola: the rule switch toggles its entity, with role switch and aria-checked', () => {
  const hass = { config: { time_zone: TZ } };
  const on = A3.tileA3Markup(ruleConf, { [RULE]: st('on'), [AUTO]: st('on') }, 'et', hass);
  assert.match(on.html, /<button type="button" class="sw press" data-k="sw" role="switch" aria-checked="true" aria-label="input_boolean.roof_auto">/);
  assert.deepEqual(on.actions.get('sw'), { config: { entity: RULE, tap_action: { action: 'toggle' } }, action: 'tap' });
  assert.match(A3.tileA3Markup(ruleConf, { [RULE]: st('off') }, 'et', hass).html, /role="switch" aria-checked="false"/);
  assert.doesNotMatch(A3.tileA3Markup({ ...ruleConf, switch: false }, { [RULE]: st('on') }, 'et', hass).html, /role="switch"/);
});

test("Pergola: the tone segment reads and writes its own select, under the light's slider", () => {
  const conf = { entity: LIGHT, wide: true, slider: { attribute: 'brightness' }, modes_entity: 'input_select.tone', modes: [{ name: 'Soe', option: 'Soe' }, { name: 'Valge', option: 'Valge' }] };
  const m = A3.tileA3Markup(conf, { [LIGHT]: st('on', { brightness: 76 }), 'input_select.tone': st('Soe') });
  assert.ok(m.html.indexOf('class="sl"') < m.html.indexOf('class="seg"') && m.html.includes('class="sl"'));
  assert.match(m.html, /data-k="m0" aria-pressed="true">Soe/);
  assert.match(m.html, /data-k="m1" aria-pressed="false">Valge/);
  assert.equal(m.actions.get('m0'), null);
  assert.deepEqual(m.actions.get('m1').config.tap_action, { action: 'perform-action', perform_action: 'input_select.select_option', target: { entity_id: 'input_select.tone' }, data: { option: 'Valge' } });
});

test('Pergola: a mode with its own tap_action runs it and is never pressed', () => {
  const close = { action: 'perform-action', perform_action: 'cover.close_cover', target: { entity_id: 'cover.roof' } };
  const conf = { entity: 'cover.roof', wide: true, state_text: 'Poole peal peata Stopiga', modes: [{ name: 'Ava', tap_action: { ...close, perform_action: 'cover.open_cover' } }, { name: 'Sulge', tap_action: close }] };
  const m = A3.tileA3Markup(conf, { 'cover.roof': st('unknown') });
  assert.doesNotMatch(m.html, /aria-pressed/);
  assert.deepEqual(m.actions.get('m1'), { config: { entity: 'cover.roof', tap_action: close }, action: 'tap' });
  assert.deepEqual(A3.modeAction('cover.roof', { name: 'Sulge', tap_action: close }, 'closed').config.tap_action, close);
  // the fixed second line stays while the roof's state is unknown
  assert.match(m.html, /Poole peal peata Stopiga/);
});

test("Pergola: Kodu's and Ventilatsioon's mode rows and Kodu's light are as before", () => {
  const vent = { entity: 'select.mode', wide: true, modes: [{ name: 'Tavaline', option: 'normal' }, { name: 'Köök', option: 'kitchen', confirm: 'Köök?' }] };
  const v = A3.tileA3Markup(vent, { 'select.mode': st('normal') });
  assert.match(v.html, /data-k="m0" aria-pressed="true">Tavaline/);
  assert.equal(v.actions.get('m1').config.tap_action.perform_action, 'select.select_option');
  assert.equal(v.actions.get('m1').config.tap_action.target.entity_id, 'select.mode');
  assert.deepEqual(A3.tileWatched(vent), ['select.mode']);
  const kodu = A3.tileA3Markup({ entity: LIGHT, wide: true, slider: { attribute: 'brightness' }, icon_tap_action: { action: 'toggle' } }, { [LIGHT]: st('on', { brightness: 76 }) });
  assert.match(kodu.html, /class="sl"/);
  assert.doesNotMatch(kodu.html, /class="seg"|role="switch"/);
});

test('Pergola: the status by a number, Sajab with a blue dot above 0, Kuiv at 0, unknown as before', () => {
  const conf = { status: { entity: 'sensor.r', above: 0, on: 'Sajab', ok: 'Kuiv' } };
  assert.deepEqual(A3.statusLine({ 'sensor.r': st('0.4') }, conf), { tone: 'on', text: 'Sajab' });
  assert.deepEqual(A3.statusLine({ 'sensor.r': st('0.0') }, conf), { tone: 'ok', text: 'Kuiv' });
  assert.deepEqual(A3.statusLine({ 'sensor.r': st('unavailable') }, conf), { tone: 'off', text: 'Seisund pole teada' });
  assert.deepEqual(A3.statusLine({}, conf, 'en'), { tone: 'off', text: 'State not known' });
  // the dots: blue for on, green for ok, grey for off
  const css = readFileSync(new URL('../../cards/parts/front.js', import.meta.url), 'utf8');
  assert.match(css, /\.status\.on i\{background:var\(--accent\);opacity:1\}/);
  assert.match(css, /\.status\.ok i\{background:var\(--cheap\);opacity:1\}/);
});

test('Pergola: a date and time without an offset is HA wall clock, and one hour reads in the singular', () => {
  const ny = 'America/New_York', now = Date.parse('2026-11-13T20:00:00Z');
  assert.equal(A3.whenText('2026-11-13 14:20:00', 'et', ny, now), 'täna 14:20');
  assert.equal(A3.whenText('2026-10-14 16:20:00', 'et', TZ, now), '14.10 kell 16:20');
  assert.equal(A3.words('et').nextHours(1), 'Järgmine tund');
  assert.equal(A3.words('en').nextHours(14), 'Next 14 hours');
});

test("Pergola: a 'when' tile's clock is HA's day, turning at HA's midnight; other tiles have none", () => {
  const ny = 'America/New_York';
  const [k1, end] = A3.tileDay(ruleConf, Date.parse('2026-11-14T04:59:00Z'), ny);
  assert.equal(k1, '2026-11-13');
  assert.equal(end, Date.parse('2026-11-14T05:00:00Z'));
  assert.equal(A3.tileDay(ruleConf, Date.parse('2026-11-14T05:00:00Z'), ny)[0], '2026-11-14');
  // Tallinn's midnight is no change for a New York house
  assert.equal(A3.tileDay(ruleConf, Date.parse('2026-11-13T22:30:00Z'), ny)[0], '2026-11-13');
  assert.deepEqual(A3.tileDay({ entity: LIGHT, state_text: ['state'] }, Date.now(), ny), [0, Infinity]);
  assert.deepEqual(A3.tileDay({ entity: LIGHT }, Date.now(), ny), [0, Infinity]);
});

test('Pergola: the forecast card draws loading, the chart, and the cells with "Prognoos pole teada" for an empty or failed answer', t => {
  // the card reads the clock itself: a fixed time keeps its hours and the test's in the same hour
  const now = Date.parse('2026-11-13T14:30:00Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  const conf = { entity: FC_ID, hours: 14, cells: [{ entity: 'sensor.r', name: 'Praegu', decimals: 1, note_above: { value: 0, above: 'sajab', below: 'ei saja' } }] };
  const states = { 'sensor.r': st('0.4', { unit_of_measurement: 'mm' }) };
  const hass = { config: { time_zone: TZ } };
  const draw = (data, lang) => A3.forecastA3Markup(conf, states, data, lang, hass);
  const live = answer(hoursFrom(new Date(now).getUTCHours(), [0, 0.4, 0]).map((r, i) => ({ ...r, datetime: new Date(Math.floor(now / 3600e3) * 3600e3 + i * 3600e3).toISOString() })));
  assert.match(draw(null).html, /class="msg">Laen/);
  const ok = draw({ res: { fc: live }, now, tz: TZ });
  assert.match(ok.html, /<svg class="fc"/);
  assert.match(ok.html, />0,4 mm</);
  assert.match(ok.html, /data-k="c0"/);
  for (const data of [{ error: true }, { res: { fc: answer([]) }, now, tz: TZ }]) {
    const m = draw(data);
    assert.match(m.html, /class="msg">Prognoos pole teada</);
    assert.doesNotMatch(m.html, /<svg/);
    assert.match(m.html, /Praegu.*0,4 mm.*sajab/);
    assert.deepEqual([...m.sheets.keys()], ['c0']);
  }
  assert.match(draw({ error: true }, 'en').html, /Forecast not known/);
});

