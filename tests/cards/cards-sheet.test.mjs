// Tests of the A3 history sheet (ADR-005) and long-range days sheet (ADR-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards as A3, st, TZ, NOW, iso, fixture } from './cards-harness.mjs';

const { priceBars, formatNumber } = A3;
const REC = fixture('recorder.json');

test('A3 sheet: the request per range and source', () => {
  const meas = { entity: 'sensor.a', source: 'statistics', type: 'mean' };
  const r24 = A3.historyRequest(meas, '24h', NOW);
  assert.deepEqual(r24, {
    type: 'recorder/statistics_during_period', start_time: '2026-11-11T14:00:00.000Z', end_time: '2026-11-12T14:00:00.000Z',
    statistic_ids: ['sensor.a'], period: '5minute', types: ['mean', 'min', 'max']
  });
  assert.equal(A3.historyRequest(meas, '7d', NOW).period, 'hour');
  assert.equal(A3.historyRequest(meas, '30d', NOW).period, 'day');
  assert.equal(A3.historyRequest(meas, '30d', NOW).start_time, '2026-10-13T14:00:00.000Z');
  const energy = { entity: 'stat:energy', cost: 'stat:cost', source: 'statistics', type: 'change' };
  assert.deepEqual(A3.historyRequest(energy, '24h', NOW).statistic_ids, ['stat:energy', 'stat:cost']);
  assert.deepEqual(A3.historyRequest(energy, '24h', NOW).types, ['change']);
  assert.equal(A3.historyRequest(energy, '24h', NOW).period, 'hour');
  assert.equal(A3.historyRequest(energy, '7d', NOW).period, 'day');
  assert.deepEqual(A3.historyRequest({ entity: 'light.a', source: 'history' }, '7d', NOW), {
    type: 'history/history_during_period', start_time: '2026-11-05T14:00:00.000Z', end_time: '2026-11-12T14:00:00.000Z',
    entity_ids: ['light.a'], minimal_response: true, no_attributes: true
  });
});

test('A3 sheet: responses to points, empty, unavailable and energy change', () => {
  const meas = A3.seriesFrom(REC.statistics_5minute_mean, { entity: 'sensor.a', source: 'statistics' });
  assert.equal(meas.kind, 'line');
  assert.equal(meas.points.length, 36);
  assert.ok(meas.points.every(p => Number.isFinite(p.t) && Number.isFinite(p.v)));
  assert.equal(A3.seriesFrom(REC.statistics_empty, { entity: 'sensor.a', source: 'statistics' }).kind, 'empty');
  const e = A3.seriesFrom(REC.statistics_hour_change, { entity: 'stat:energy', cost: 'stat:cost', source: 'statistics', type: 'change' });
  assert.equal(e.kind, 'bars');
  const sum = REC.statistics_hour_change['stat:cost'].reduce((a, r) => a + r.change, 0);
  assert.ok(Math.abs(e.cost - sum) < 1e-9);
  const onoff = A3.seriesFrom(REC.history_onoff, { entity: 'light.a', source: 'history' });
  assert.equal(onoff.kind, 'step');
  const gap = onoff.points.find(p => p.s === 'unavailable');
  assert.ok(gap && gap.v === null, 'an unavailable sample is a gap');
  assert.equal(onoff.points[0].t, Math.round(REC.history_onoff['light.a'][0].lu * 1000));
  const sel = A3.seriesFrom(REC.history_select, { entity: 'select.a', source: 'history', active: ['kitchen', 'boost'] });
  assert.equal(sel.kind, 'step');
  assert.ok(sel.points.every(p => p.v === null || p.v === false));
  const n = A3.seriesFrom(REC.history_number, { entity: 'sensor.b', source: 'history' });
  assert.equal(n.kind, 'line');
  assert.equal(n.stepped, true);
});

test('A3 sheet: min, mean and max; on count and hours; energy totals', () => {
  const meas = A3.seriesFrom(REC.statistics_day_mean, { entity: 'sensor.a', source: 'statistics' });
  const rows = REC.statistics_day_mean['sensor.a'];
  const s = A3.lineStats(meas, 0, NOW);
  assert.equal(s.lo, Math.min(...rows.map(r => r.min)));
  assert.equal(s.hi, Math.max(...rows.map(r => r.max)));
  assert.ok(Math.abs(s.mean - rows.reduce((a, r) => a + r.mean, 0) / rows.length) < 1e-9);
  // a stepped history line is weighted by time: 10 for 3 h, then 20 for 1 h
  const T = 1.8e12, H = 3600e3;
  const st = A3.lineStats({ kind: 'line', stepped: true, points: [{ t: T, v: 10 }, { t: T + 3 * H, v: 20 }] }, T, T + 4 * H);
  assert.equal(st.mean, 12.5);
  const step = { kind: 'step', points: [{ t: T - H, v: true }, { t: T + H, v: false }, { t: T + 2 * H, v: true }, { t: T + 3 * H, v: null }, { t: T + 4 * H, v: false }] };
  assert.deepEqual(A3.stepStats(step, T, T + 5 * H), { times: 1, hours: 2 });
  // on, a restart's unavailable gap, on again: no new switch
  const gap = { kind: 'step', points: [{ t: T, v: false }, { t: T + H, v: true }, { t: T + 2 * H, v: null }, { t: T + 2.1 * H, v: true }] };
  assert.equal(A3.stepStats(gap, T - 1, T + 3 * H).times, 1);
  const e = A3.barStats({ kind: 'bars', points: [{ t: 0, v: 1.5 }, { t: 1, v: null }, { t: 2, v: 2.5 }], cost: 0.7 });
  assert.deepEqual(e, { total: 4, peak: 2.5, cost: 0.7 });
  assert.equal(A3.barStats({ kind: 'bars', points: [] }), null);
  assert.equal(A3.lineStats({ kind: 'line', points: [{ t: 0, v: null }] }, 0, 1), null);
});

test('A3 sheet: points to SVG paths, gaps split the line', () => {
  const p = A3.chartPaths({ kind: 'line', points: [{ t: 0, v: 0 }, { t: 50, v: 10 }, { t: 60, v: null }, { t: 100, v: 5 }] }, { w: 100, h: 100, top: 0, bot: 0, t0: 0, t1: 100, lo: 0, hi: 10 });
  assert.equal(p.line, 'M0.0 100.0L50.0 0.0M100.0 50.0');
  assert.equal((p.area.match(/Z/g) || []).length, 2);
  const b = A3.chartPaths({ kind: 'step', points: [{ t: 0, v: true }, { t: 50, v: false }] }, { w: 100, h: 100, top: 10, bot: 10, t0: 0, t1: 100 });
  assert.equal(b.bands, 'M0.0 10H50.0V90H0.0Z');
  const bars = A3.chartPaths({ kind: 'bars', points: [{ t: 0, v: 2 }, { t: 50, v: 1 }] }, { w: 100, h: 100, top: 0, bot: 0, t0: 0, t1: 100, lo: 0, hi: 2 });
  assert.equal((bars.bars.match(/Z/g) || []).length, 2);
  assert.match(bars.bars, /^M\d+\.\d 0\.0h/);
});

test('A3: the price bars are 48 with the current hour, and decimal commas', () => {
  const now = new Date('2026-11-12T14:20:00+02:00');
  const day0 = new Date('2026-11-12T00:00:00+02:00').getTime() / 1000;
  const prices = Array.from({ length: 48 }, (_, i) => ({ s: day0 + i * 3600, t: 0.1 + i / 1000, p: 0.05 }));
  const b = priceBars(prices, now);
  assert.equal(b.bars.length, 48);
  assert.equal(b.today, 24);
  assert.equal(b.current, 14);
  assert.equal(formatNumber('32.0'), '32,0');
  assert.equal(formatNumber('5.087', 1), '5,1');
  assert.deepEqual(A3.splitValue(st('43', { unit_of_measurement: '%' })), { value: '43', unit: '%' });
  assert.deepEqual(A3.splitValue(st('5.087', { unit_of_measurement: '°C' }), 1), { value: '5,1°', unit: '' });
  assert.deepEqual(A3.splitValue(st('unavailable')), { value: 'pole saadaval', unit: '' });
  assert.equal(A3.levelTone('väga kallis'), 'high');
  assert.equal(A3.levelTone('odav'), 'good');
});

test('A3: the tile sheet, the slider and the system dots', () => {
  const states = { 'sensor.h': st('43', { unit_of_measurement: '%' }), 'light.p': st('on', { brightness: 128 }) };
  const sh = A3.tileSheet({ entity: 'sensor.h', name: 'Niiskus', color: 'blue', history: { source: 'statistics', type: 'mean' } }, states);
  assert.deepEqual([sh.title, sh.unit, sh.history.entity], ['Niiskus', '%', 'sensor.h']);
  assert.equal(A3.tileSheet({ entity: 'sensor.h' }, states), null);
  const boost = A3.tileSheet({ entity: 'water_heater.w', name: 'Kiirsoojendus', history: { entity: 'sensor.h', source: 'statistics', type: 'mean', title: 'Boileri vesi' } }, { ...states, 'water_heater.w': st('on') });
  assert.deepEqual([boost.title, boost.entity, boost.more], ['Boileri vesi', 'sensor.h', 'water_heater.w']);
  const onoff = A3.tileSheet({ entity: 'light.p', name: 'Valgus', history: { source: 'history' } }, states);
  assert.equal(onoff.text(states), 'sees');
  assert.equal(A3.brightnessPct(states['light.p']), 50);
  assert.equal(A3.brightnessPct(st('off')), 0);
  assert.equal(A3.pctAt(73, 200), 35);
  assert.equal(A3.pctAt(-5, 200), 0);
  assert.deepEqual(A3.sliderAction('light.p', 40), { config: { entity: 'light.p', tap_action: { action: 'perform-action', perform_action: 'light.turn_on', target: { entity_id: 'light.p' }, data: { brightness_pct: 40 } } }, action: 'tap' });
  assert.equal(A3.buttonOn({ state: 'open' }, st('open')), true);
  assert.equal(A3.buttonOn({ state: 'open' }, st('unknown')), false);
  const conf = {
    items: [
      { entity: 'sensor.nvr', name: 'NVR ketas', ok: { state: ['OK'] } },
      { entity: 'sensor.wan', name: 'Internet', value: true },
      { entity: 'sensor.bat', name: 'Telefon', value: true, ok: { above: 30 } }
    ],
    updates: [{ entity: 'update.a', name: 'A' }, { entity: 'update.b', name: 'B' }]
  };
  const dots = A3.statusItems({ 'sensor.nvr': st('OK'), 'sensor.wan': st('12', { unit_of_measurement: 'ms' }), 'sensor.bat': st('20', { unit_of_measurement: '%' }), 'update.a': st('on'), 'update.b': st('off') }, conf);
  assert.deepEqual(dots.map(d => [d.text, d.tone]), [['NVR ketas', 'ok'], ['Internet 12 ms', 'ok'], ['Telefon 20 %', 'bad'], ['Uuendus: A', 'mid']]);
  assert.equal(A3.statusItems({}, conf)[1].tone, 'bad');
});


/* ---------- A3 days sheet (ADR-013): 30 days, 90 days and 12 months in HA's slots ---------- */

const day = (y, m, d) => A3.dayStart(y, m, d, TZ);
const rowsOf = (starts, f) => starts.map((t, i) => ({ start: t, ...f(i) }));

test('days sheet: 90 days across the October change start at HA midnight, today last', () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), r = A3.daysRange('90d', now, TZ);
  assert.equal(r.period, 'day');
  assert.equal(r.starts.length, 90);
  assert.equal(iso(r.starts[0]), '2026-08-15T21:00:00.000Z');
  assert.equal(r.starts[89], day(2026, 11, 13));
  assert.equal(r.end, day(2026, 11, 14));
  // the day of the change is 25 hours long
  const i = r.starts.indexOf(day(2026, 10, 25));
  assert.equal((r.starts[i + 1] - r.starts[i]) / 3600e3, 25);
  assert.equal(iso(r.before), '2026-08-14T21:00:00.000Z');
  const msg = A3.daysSheetRequest({ statistic: 'sensor.a', type: 'change' }, '90d', now, TZ);
  assert.deepEqual(msg, { type: 'recorder/statistics_during_period', start_time: '2026-08-14T21:00:00.000Z', statistic_ids: ['sensor.a'], period: 'day', types: ['change'] });
  assert.equal(A3.daysRange('30d', now, TZ).starts[0], day(2026, 10, 15));
});

test('days sheet: 12 months across a year end, each on the 1st in HA zone', () => {
  const now = Date.parse('2027-01-10T12:00:00Z'), r = A3.daysRange('12m', now, TZ);
  assert.equal(r.period, 'month');
  assert.equal(r.starts.length, 12);
  assert.equal(iso(r.starts[0]), '2026-01-31T22:00:00.000Z');
  assert.equal(r.before, day(2026, 1, 1));
  r.starts.forEach(t => assert.equal(A3.zoneParts(t, TZ).d, 1));
  r.starts.forEach(t => assert.equal(A3.zoneParts(t, TZ).h, 0));
  assert.equal(r.starts[11], day(2027, 1, 1));
  assert.equal(r.starts[10], day(2026, 12, 1));
  assert.equal(r.end, day(2027, 2, 1));
  assert.equal(A3.daysSheetRequest({ statistic: 'sensor.a', type: 'mean' }, '12m', now, TZ).period, 'month');
});

test('days sheet: empty months stay empty, this month and the first partial one are out', () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), r = A3.daysRange('12m', now, TZ);
  // data from July; 100 kWh a month, this month so far 40
  const rows = rowsOf(r.starts.slice(6), i => ({ change: i === 5 ? 40 : 100 + i }));
  const s = A3.slotSeries({ 'sensor.a': rows }, { statistic: 'sensor.a', type: 'change' }, '12m', now, TZ);
  assert.equal(s.pts.length, 12);
  assert.deepEqual(s.pts.slice(0, 6).map(p => p.v), [null, null, null, null, null, null]);
  assert.equal(s.pts[6].out, 'partial');
  assert.equal(s.pts[11].out, 'open');
  assert.deepEqual(s.pts.filter(p => !p.out && p.v !== null).map(p => p.v), [101, 102, 103, 104]);
  assert.equal(s.stats.total, 410);
  assert.equal(s.stats.avg, 102.5);
  assert.equal(s.stats.small.v, 101);
  assert.equal(s.stats.big.v, 104);
  // data in the month before the window: the first month counts; none there, it is the
  // statistic's first and may be partial
  const full = rowsOf([r.before, ...r.starts], () => ({ change: 10 }));
  assert.equal(A3.slotSeries({ 'sensor.a': full }, { statistic: 'sensor.a', type: 'change' }, '12m', now, TZ).pts[0].out, false);
  assert.equal(A3.slotSeries({ 'sensor.a': full.slice(1) }, { statistic: 'sensor.a', type: 'change' }, '12m', now, TZ).pts[0].out, 'partial');
  assert.equal(A3.slotSeries({}, { statistic: 'sensor.a', type: 'change' }, '12m', now, TZ).stats, null);
});

test('days sheet: a statistic that begins inside 90 days has its first day out', () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), r = A3.daysRange('90d', now, TZ);
  const rows = rowsOf(r.starts.slice(5), () => ({ change: 2 }));
  rows[0].change = 0.3;
  const s = A3.slotSeries({ 'sensor.a': rows }, { statistic: 'sensor.a', type: 'change' }, '90d', now, TZ);
  assert.equal(s.pts[5].out, 'partial');
  assert.equal(s.stats.small.v, 2);
  assert.equal(s.stats.total, 2 * 83);
});

test('days sheet: days past the cutoff are late, today is open', () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), r = A3.daysRange('30d', now, TZ);
  const rows = rowsOf([r.before, ...r.starts], i => ({ change: i }));
  // the counter's data ends at 15:00 on the 11th: the 11th and the 12th are late
  const cutoff = day(2026, 11, 11) + 15 * 3600e3;
  const s = A3.slotSeries({ 'sensor.a': rows }, { statistic: 'sensor.a', type: 'change' }, '30d', now, TZ, cutoff);
  assert.deepEqual(s.pts.slice(-4).map(p => p.out), [false, 'late', 'late', 'open']);
  assert.equal(s.stats.total, (27 * 28) / 2);
  assert.equal(s.stats.last.v, 27);
});

test('days sheet: the price is a line of day means at scale 100', () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), r = A3.daysRange('30d', now, TZ);
  // the day means swing 0.10 to 0.20 €/kWh; a dear single hour (max) is not a day mean
  const rows = rowsOf([r.before, ...r.starts], i => ({ mean: 0.1 + ((i + 10) % 11) / 100, max: 0.9 }));
  const s = A3.slotSeries({ 'sensor.c': rows }, { statistic: 'sensor.c', type: 'mean', scale: 100 }, '30d', now, TZ);
  assert.ok(Math.abs(s.stats.small.v - 10) < 1e-9);
  assert.ok(Math.abs(s.stats.big.v - 20) < 1e-9);
  assert.ok(s.pts.every(p => p.v <= 20 + 1e-9));
  assert.ok(Math.abs(s.stats.last.v - (0.1 + (28 % 11) / 100) * 100) < 1e-9);
});

test('days sheet: when and the axis in HA zone, not the browser one', () => {
  const ny = 'America/New_York', t = A3.dayStart(2026, 11, 4, ny), now = Date.parse('2026-11-13T10:00:00Z');
  // 05:00 UTC is the 4th in New York and in Tallinn
  assert.equal(A3.whenLabel(t, '30d', true, now, 'et', ny), 'kolmapäev 4.11');
  assert.equal(A3.whenLabel(A3.dayStart(2026, 11, 1, ny), '90d', true, now, 'et', ny), 'pühapäev 1.11');
  // in the browser's zone (Tallinn) New York's 1st of November is still 1.11 at 06:00, so a
  // late-evening start shows the difference: 22:30 on 31.10 in New York is 1.11 in Tallinn
  const eve = Date.parse('2026-11-01T02:30:00Z');
  assert.equal(A3.whenLabel(eve, '30d', true, now, 'et', ny), 'laupäev 31.10');
  assert.equal(A3.whenLabel(eve, '30d', true, now, 'et'), 'pühapäev 1.11');
  assert.equal(A3.whenLabel(A3.dayStart(2026, 10, 1, ny), '12m', true, now, 'et', ny), 'oktoober 2026');
  assert.equal(A3.whenLabel(A3.dayStart(2026, 10, 1, ny), '12m', true, now, 'en', ny), 'October 2026');
  assert.equal(A3.whenLabel(eve, '24h', true, eve + 3600e3, 'en', ny), 'today 22–23');
  const r = A3.daysRange('12m', now, ny);
  const ax = A3.axisLabels('12m', r.starts[0], r.end, 'et', ny);
  assert.equal(ax.length, 5);
  assert.equal(ax[0], 'dets');
  assert.equal(ax[4], 'nüüd');
  assert.equal(A3.axisLabels('30d', eve, eve + 30 * 864e5, 'et', ny)[0], '31.10');
  assert.equal(A3.axisLabels('30d', eve, eve + 30 * 864e5, 'et')[0], '1.11');
});

test('days sheet: the spec from the picked series, with more and the cutoff', () => {
  const conf = {
    cutoff: 'estfeed:c', series: [
      { name: 'kWh', title: 'Maja elekter', statistic: 'estfeed:c', type: 'change', unit: 'kWh', decimals: 1, color: 'indigo', more: 'sensor.today' },
      { name: 'Hind', title: 'Elektri hind', statistic: 'estfeed:p', type: 'mean', scale: 100, decimals: 1, unit: 'senti/kWh', more: 'sensor.level' }
    ]
  };
  assert.deepEqual(A3.daysSheet(conf, 0), { days: true, title: 'Maja elekter', statistic: 'estfeed:c', type: 'change', color: 'indigo', unit: 'kWh', scale: 1, decimals: 1, more: 'sensor.today', cutoff: 'estfeed:c' });
  assert.deepEqual(A3.daysSheet(conf, 1), { days: true, title: 'Elektri hind', statistic: 'estfeed:p', type: 'mean', color: undefined, unit: 'senti/kWh', scale: 100, decimals: 1, more: 'sensor.level' });
  const eur = A3.daysSheet({ series: [{ name: 'Eurod', statistic: 'estfeed:k', type: 'change', unit: '€', decimals: 2, scale: 0.5, more: 'sensor.today' }], cutoff: 'estfeed:c' }, 0);
  assert.equal(eur.scale, 0.5);
  assert.equal(eur.cutoff, 'estfeed:c');
  const boiler = A3.daysSheet({ series: [{ name: 'kWh', title: 'Boileri elekter', statistic: 'sensor.b', type: 'change', unit: 'kWh', more: 'sensor.b' }] }, 0);
  assert.equal(boiler.cutoff, undefined);
  assert.equal(boiler.decimals, 1);
});

test('days sheet: tile sheets keep 24 h, 7 and 30 days; the days sheet has its own three', () => {
  assert.deepEqual(Object.keys(A3.RANGES), ['24h', '7d', '30d']);
  assert.deepEqual(Object.keys(A3.DAYS_RANGES), ['30d', '90d', '12m']);
  for (const L of A3.LANGUAGES) for (const k of [...Object.keys(A3.RANGES), ...Object.keys(A3.DAYS_RANGES)]) assert.ok(A3.words(L).ranges[k], `${L} ${k}`);
});

