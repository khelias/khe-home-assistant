// Tests of A3 Energia helpers: HA time zone, daily statistics, pace and split (ADR-008).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards as A3, st, TZ, NOW, iso, fixture } from './cards-harness.mjs';

const DAILY = fixture('daily.json');

test('Energia: Estonian numbers from the templates, null for a dash or nothing', () => {
  assert.equal(A3.parseEt('116,34 €'), 116.34);
  assert.equal(A3.parseEt('32,1 c/kWh'), 32.1);
  assert.equal(A3.parseEt('1 234,5'), 1234.5);
  assert.equal(A3.parseEt(49), 49);
  assert.equal(A3.parseEt('42.589'), 42.589);
  assert.equal(A3.parseEt('- c/kWh'), null);
  assert.equal(A3.parseEt(undefined), null);
  assert.equal(A3.parseEt('-'), null);
});

test('Energia: days start at midnight in HA zone, across the October change', () => {
  assert.equal(iso(A3.dayStart(2026, 10, 25, TZ)), '2026-10-24T21:00:00.000Z');
  assert.equal(iso(A3.dayStart(2026, 10, 26, TZ)), '2026-10-25T22:00:00.000Z');
  assert.equal(iso(A3.dayStart(2026, 3, 29, TZ)), '2026-03-28T22:00:00.000Z');
  assert.equal(iso(A3.dayStart(2026, 3, 30, TZ)), '2026-03-29T21:00:00.000Z');
  // a day 0 is the last of the month before
  assert.equal(iso(A3.dayStart(2026, 11, 0, TZ)), '2026-10-30T22:00:00.000Z');
  const starts = A3.dayStarts(31, NOW, TZ);
  assert.equal(starts.length, 31);
  assert.equal(iso(starts[0]), '2026-10-12T21:00:00.000Z');
  assert.equal(iso(starts[30]), '2026-11-11T22:00:00.000Z');
});

test('Energia: another zone gives its own days, whatever the browser zone', () => {
  assert.equal(iso(A3.dayStarts(1, NOW, 'America/New_York')[0]), '2026-11-12T05:00:00.000Z');
  assert.equal(iso(A3.dayStarts(1, NOW, 'UTC')[0]), '2026-11-12T00:00:00.000Z');
});

test('Energia: month spans by their real length', () => {
  const hours = t => { const [a, b] = A3.monthSpan(t, TZ); return (b - a) / 3600e3; };
  assert.equal(hours(Date.parse('2026-10-10T12:00:00Z')), 745);
  assert.equal(hours(Date.parse('2026-03-10T12:00:00Z')), 743);
  assert.equal(hours(NOW), 720);
});

test('Energia: last month by name, in Estonian and as Daikin names it, and January', () => {
  assert.equal(A3.lastMonthName(NOW, TZ), 'oktoober');
  assert.equal(A3.lastMonthName(NOW, TZ, 'en-US'), 'October');
  assert.equal(A3.lastMonthName(Date.parse('2027-01-10T12:00:00Z'), TZ, 'en-US'), 'December');
  assert.equal(A3.inLastMonth(NOW, TZ), 'oktoobris');
  assert.equal(A3.inLastMonth(Date.parse('2027-01-10T12:00:00Z'), TZ), 'detsembris');
  assert.equal(A3.inLastMonth(Date.parse('2026-10-10T12:00:00Z'), TZ), 'septembris');
});

test('Energia: the daily request starts at the first day midnight, the hourly one two days back', () => {
  const r = A3.dailyRequest(['sensor.a'], ['change'], 31, NOW, TZ);
  assert.deepEqual(r, { type: 'recorder/statistics_during_period', start_time: '2026-10-12T21:00:00.000Z', statistic_ids: ['sensor.a'], period: 'day', types: ['change'] });
  assert.equal(A3.hourlyRequest('sensor.a', NOW).start_time, '2026-11-10T14:00:00.000Z');
  // from a whole hour, so the same hour asks the same thing
  assert.equal(A3.hourlyRequest('sensor.a', NOW + 1234e3).start_time, '2026-11-10T14:00:00.000Z');
});

test('Energia: daily series from the house, a missing day as null, tomorrow left out', () => {
  const pts = A3.dailySeries(DAILY.daily_change, 'sensor.a', 'change', 31, DAILY.now, TZ);
  assert.equal(pts.length, 31);
  assert.ok(pts.every(p => p.v !== null));
  assert.equal(pts[30].label, '12.11');
  const price = A3.dailySeries(DAILY.daily_price, 'sensor.c', 'mean', 30, DAILY.now, TZ);
  assert.equal(price.length, 30);
  assert.ok(price.every(p => p.max !== null && p.max >= p.v));
  const gap = A3.dailySeries({ 'sensor.a': DAILY.daily_change['sensor.a'].slice(2) }, 'sensor.a', 'change', 31, DAILY.now, TZ);
  assert.equal(gap[0].v, null);
  assert.deepEqual(A3.dailySeries({}, 'sensor.a', 'change', 3, DAILY.now, TZ).map(p => p.v), [null, null, null]);
});

test('Energia: the cutoff of a delayed counter, and the days it keeps out', () => {
  const cutoff = A3.dataCutoff(DAILY.hourly_change, 'sensor.a');
  const rows = DAILY.hourly_change['sensor.a'];
  assert.equal(cutoff, rows[rows.length - 1].start + 3600e3);
  assert.equal(A3.dataCutoff({}, 'sensor.a'), null);
  const pts = A3.dailySeries(DAILY.daily_change, 'sensor.a', 'change', 31, DAILY.now, TZ, cutoff);
  assert.deepEqual(pts.map(p => p.late).slice(-2), [false, true]);
  const s = A3.dayStats(pts);
  // today's partial day is not the smallest day, and the average is of complete days only
  assert.notEqual(s.small.label, '12.11');
  const full = pts.slice(0, 30).map(p => p.v);
  assert.ok(Math.abs(s.avg - full.reduce((a, v) => a + v, 0) / 30) < 1e-9);
  assert.equal(s.big.v, Math.max(...full));
  // a cutoff a day further back keeps yesterday out too
  const earlier = A3.dailySeries(DAILY.daily_change, 'sensor.a', 'change', 31, DAILY.now, TZ, pts[30].t - 3600e3);
  assert.equal(A3.dayStats(earlier).big.v, Math.max(...full.slice(0, 29)));
  assert.equal(A3.dayStats(pts.map(p => ({ ...p, v: null }))), null);
});

test('Energia: price stats with the dearest hour', () => {
  const pts = A3.dailySeries(DAILY.daily_price, 'sensor.c', 'mean', 30, DAILY.now, TZ);
  const s = A3.dayStats(pts);
  assert.equal(s.peak.v, Math.max(...pts.map(p => p.max)));
  assert.equal(s.small.v, Math.min(...pts.map(p => p.v)));
});

test('Energia: the pace to the cutoff, hidden on the first two days and without data', () => {
  const now = Date.parse('2026-11-16T10:00:00Z'), cutoff = Date.parse('2026-11-15T22:00:00Z');
  // 15 of 30 days to the cutoff: twice the cost so far
  assert.ok(Math.abs(A3.monthPace(100, cutoff, now, TZ) - 200) < 1e-9);
  assert.equal(A3.monthPace(100, null, Date.parse('2026-11-02T10:00:00Z'), TZ), null);
  assert.equal(A3.monthPace(null, cutoff, now, TZ), null);
  assert.equal(A3.monthPace(100, Date.parse('2026-10-30T00:00:00Z'), now, TZ), null);
  // a cutoff in the future counts to now
  assert.ok(Math.abs(A3.monthPace(100, now + 1e9, now, TZ) - A3.monthPace(100, now, now, TZ)) < 1e-9);
});

const SPLIT = {
  total: 'sensor.total', fresh: 'binary_sensor.fresh',
  parts: [
    { entity: 'sensor.boiler', name: 'Boiler', last: 'month' },
    { entity: 'sensor.vent', name: 'Ventilatsioon', last: 'last_period' },
    { entity: 'sensor.heater', name: 'Järelküte', last: 'last_period', hide_zero: true }
  ]
};
const splitStates = (over = {}) => ({
  'sensor.total': st('362'), 'binary_sensor.fresh': st('on'),
  'sensor.boiler': st('50', { October: 106, December: '-', 'Last December': 43 }), 'sensor.vent': st('15.879', { last_period: '42.589' }),
  'sensor.heater': st('0', { last_period: '0' }), ...over
});

test('Energia: the split, Järelküte out at 0, last month per sensor, the rest of the house', () => {
  const { rows, stale } = A3.splitRows(splitStates(), SPLIT, NOW, TZ);
  assert.deepEqual(rows.map(r => [r.name, r.kwh, r.share, r.last]), [
    ['Boiler', 50, 14, 106], ['Ventilatsioon', 15.879, 4, 42.589], ['Ülejäänud maja', 362 - 50 - 15.879, 82, null]
  ]);
  assert.equal(stale, false);
  const heated = A3.splitRows(splitStates({ 'sensor.heater': st('3.2', { last_period: '0' }) }), SPLIT, NOW, TZ).rows;
  assert.equal(heated[2].name, 'Järelküte');
});

test('Energia: a delayed total never makes the rest negative or the shares pass 100', () => {
  const { rows, stale } = A3.splitRows(splitStates({ 'sensor.total': st('40'), 'binary_sensor.fresh': st('off') }), SPLIT, NOW, TZ);
  const rest = rows[rows.length - 1];
  assert.equal(rest.kwh, 0);
  assert.ok(rows.reduce((a, r) => a + r.share, 0) <= 101);
  assert.equal(stale, true);
});

test('Energia: last month hidden on the first two days, and a dash or missing month left out', () => {
  const early = A3.splitRows(splitStates(), SPLIT, Date.parse('2026-11-01T10:00:00Z'), TZ).rows;
  assert.ok(early.every(r => r.last === null));
  // in January last month is Daikin's `Last December`, not this year's December ("-")
  const jan = A3.splitRows(splitStates(), SPLIT, Date.parse('2027-01-10T10:00:00Z'), TZ).rows;
  assert.equal(jan[0].last, 43);
  const gone = A3.splitRows(splitStates({ 'sensor.vent': st('unavailable') }), SPLIT, NOW, TZ).rows;
  assert.deepEqual(gone.map(r => r.name), ['Boiler', 'Ülejäänud maja']);
});

test('Energia: the usage sheet spec both the price card and the month card open', () => {
  const h = { entity: 'stat:a', cost: 'stat:b', source: 'statistics', type: 'change' };
  assert.deepEqual(A3.usageSheet('sensor.m', h), { title: 'Tarbimine', entity: 'sensor.m', more: 'sensor.m', decimals: 1, unit: 'kWh', color: 'indigo', history: h });
});

test('dayName: the weekday and date in HA\'s zone', () => {
  assert.equal(A3.dayName(Date.parse('2026-11-10T22:00:00Z'), 'Europe/Tallinn'), 'kolmapäev 11.11');
  assert.equal(A3.dayName(Date.parse('2026-10-24T21:00:00Z'), 'Europe/Tallinn'), 'pühapäev 25.10');
  assert.equal(A3.dayName(Date.parse('2026-11-10T22:00:00Z'), 'UTC'), 'teisipäev 10.11');
});

test('pointing: an hour bar, a history moment and the nearest point with a value', () => {
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
  assert.equal(A3.hourSpan({ s: at(12, 18), tomorrow: false }), 'täna 18–19');
  assert.equal(A3.hourSpan({ s: at(13, 23), tomorrow: true }), 'homme 23–00');
  const now = at(12, 21);
  assert.equal(A3.whenLabel(at(12, 14, 35), '24h', false, now), 'täna 14:35');
  assert.equal(A3.whenLabel(at(11, 22), '24h', true, now), 'eile 22–23');
  // by day distance: across midnight it is yesterday, two days back the weekday and date
  assert.equal(A3.whenLabel(at(12, 23, 50), '24h', false, at(13, 0, 30)), 'eile 23:50');
  assert.equal(A3.whenLabel(at(13, 0, 10), '24h', false, at(13, 0, 30)), 'täna 00:10');
  assert.equal(A3.whenLabel(at(10, 22), '24h', true, now), 'teisipäev 10.11 22–23');
  assert.equal(A3.whenLabel(at(11, 9), '7d', false, now), 'kolmapäev 11.11 kell 09');
  assert.equal(A3.whenLabel(at(11, 0), '7d', true, now), 'kolmapäev 11.11');
  assert.equal(A3.whenLabel(at(1, 0), '30d', false, now), 'pühapäev 1.11');
  const pts = [{ t: 0, v: 1 }, { t: 10, v: null }, { t: 20, v: 3 }];
  assert.equal(A3.nearest(pts, 9), 0);
  assert.equal(A3.nearest(pts, 12), 2);
  assert.equal(A3.nearest([{ t: 0, v: null }], 0), null);
  assert.equal(A3.nearest(pts, 19, true), null);
  assert.equal(A3.nearest(pts, 9, true), 0);
  assert.equal(A3.nearest(pts, 25, true), 2);
  assert.equal(A3.nearest(pts, -1, true), null);
});

