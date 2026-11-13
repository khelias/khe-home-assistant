// Tests of the demo's recorder (demo/recorder.js, ADR-012) on the profiles the demo ships
// (dashboard_demo.demo_recorder()): HA's response shapes as the house gives them (tests/cards/
// fixtures/), states that agree with the statistics on any day, the zone's days and the prices.
// Run from the repo root: node --test tests/house3d/recorder.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { createRecorder } = await import(new URL('demo/recorder.js', `file://${ROOT}`));
const cards = await import(new URL('cards/khe-cards.js', `file://${ROOT}`));
const { zoneParts, dayStart, lastMonthName, sensorWords } = cards;

const py = `import json, sys; sys.path.insert(0, 'scripts'); import dashboard_demo as d, dashboard_config as dc
m = __import__('house3d_model'); fx = m.with_room_names(m.merge(m.read_layers('tests/house3d/fixture-model.md'), m.CARD))
ids = {k: v['id'] for k, v in d.CATALOGUE.items()}
print(json.dumps({'spec': d.demo_recorder(), 'en': d.demo_states_en(fx)['levels'], 'et': d.demo_states(fx)['levels'],
  'ids': {k: ids[getattr(dc, k)] for k in ('MONTH', 'TODAY', 'YESTERDAY', 'LAST_MONTH', 'BOILER_MONTH', 'BOILER_TODAY', 'VENT_MONTH', 'AHU_ENERGY', 'RECOVERED', 'OUTDOOR', 'HUMIDITY', 'FORECAST', 'PRICE_LEVEL', 'PERGOLA_LIGHT')},
  'stats': {k: d.STATISTICS[getattr(dc, k)] for k in ('CONSUMPTION', 'COST', 'PRICE_STAT')}}))`;
const { spec, en, et, ids, stats } = JSON.parse(execFileSync('python3', ['-I', '-c', py], { cwd: ROOT, encoding: 'utf8' }));
const rec = createRecorder(spec, { zoneParts, dayStart, lastMonthName });
const TZ = spec.zone;
const fixture = f => JSON.parse(readFileSync(new URL(`tests/cards/fixtures/${f}`, `file://${ROOT}`), 'utf8'));
const keys = row => Object.keys(row).sort().join();
const stat = (now, id, period, types, start) => rec.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(start).toISOString(), statistic_ids: [id], period, types }, now);
const sumOf = rows => rows.reduce((a, r) => a + r.change, 0);

test('each request kind answers in the shape the house gives', async () => {
  const now = Date.parse('2026-11-12T14:07:00Z'), f = fixture('recorder.json'), h = fixture('hourly.json'), d = fixture('daily.json');
  const five = (await stat(now, ids.OUTDOOR, '5minute', ['mean', 'min', 'max'], now - 3600e3))[ids.OUTDOOR];
  assert.equal(keys(five[0]), keys(f.statistics_5minute_mean['sensor.a'][0]));
  assert.equal(five[1].start - five[0].start, 300e3);
  const hour = (await stat(now, ids.OUTDOOR, 'hour', ['mean'], now - 48 * 3600e3))[ids.OUTDOOR];
  assert.ok(Object.keys(h.hourly_mean['sensor.a'][0]).every(k => k in hour[0]));
  const day = (await stat(now, stats.CONSUMPTION, 'day', ['change'], now - 10 * 86400e3))[stats.CONSUMPTION];
  assert.equal(keys(day[0]), keys(d.daily_change['sensor.a'][0]));
  const hist = await rec.callWS({ type: 'history/history_during_period', start_time: new Date(now - 86400e3).toISOString(), entity_ids: [ids.OUTDOOR, ids.PERGOLA_LIGHT], minimal_response: true, no_attributes: true }, now);
  assert.deepEqual(Object.keys(hist[ids.OUTDOOR][0]).sort(), ['lu', 's']);
  assert.ok(hist[ids.PERGOLA_LIGHT].some(r => r.s === 'on') && hist[ids.PERGOLA_LIGHT].some(r => r.s === 'off'));
  // the cards read these through their own helpers
  assert.equal(cards.seriesFrom(hist, { entity: ids.OUTDOOR, source: 'history' }).kind, 'line');
  assert.equal(cards.seriesFrom(hist, { entity: ids.PERGOLA_LIGHT, source: 'history' }).kind, 'step');
});

test('an unknown id answers empty, an unknown command fails', async () => {
  const now = Date.now();
  assert.deepEqual(await stat(now, 'sensor.none', 'hour', ['mean'], now - 3600e3 * 5), {});
  assert.deepEqual(await rec.callWS({ type: 'history/history_during_period', start_time: new Date(now - 3600e3).toISOString(), entity_ids: ['sensor.none'] }, now), {});
  await assert.rejects(rec.callWS({ type: 'auth/current_user' }, now));
});

test('the counters equal their days on the 1st, the 2nd and the 28th of a month', async () => {
  for (const at of ['2026-11-01T09:30:00Z', '2026-11-02T21:10:00Z', '2026-11-28T00:20:00Z', '2027-01-01T05:00:00Z']) {
    const now = Date.parse(at), s = rec.dated(now, { levels: et });
    const p = zoneParts(now, TZ), m0 = dayStart(p.y, p.m, 1, TZ), m1 = dayStart(p.y, p.m - 1, 1, TZ), d0 = dayStart(p.y, p.m, p.d, TZ);
    const days = id => stat(now, id, 'day', ['change'], m0).then(r => sumOf(r[id] || []));
    assert.equal(s[ids.MONTH].state, (await days(stats.CONSUMPTION)).toFixed(1), at);
    assert.equal(s[ids.BOILER_MONTH].state, (await days(ids.BOILER_MONTH)).toFixed(1), at);
    assert.equal(s[ids.VENT_MONTH].state, (await days(ids.VENT_MONTH)).toFixed(1), at);
    // Ventilatsioon's month cell equals its bars of the unit's electricity
    assert.equal(s[ids.VENT_MONTH].state, (await days(ids.AHU_ENERGY)).toFixed(1), at);
    const today = (await stat(now, stats.CONSUMPTION, 'day', ['change'], d0))[stats.CONSUMPTION];
    assert.equal(s[ids.TODAY].state, (today ? sumOf(today) : 0).toFixed(1), at);
    const last = (await stat(now, stats.CONSUMPTION, 'day', ['change'], m1))[stats.CONSUMPTION].filter(r => r.start < m0);
    assert.equal(s[ids.LAST_MONTH].state, sumOf(last).toFixed(1), at);
    // the month's cost and price come from the same hours, in Estonian
    const cost = await days(stats.COST);
    assert.equal(s[ids.MONTH].attributes.kulu, `${cost.toFixed(2).replace('.', ',')} €`, at);
    assert.equal(cards.parseEt(s[ids.MONTH].attributes.kulu), Number(cost.toFixed(2)));
    // Daikin names last month in English, and last December as Last December
    assert.ok(cards.lastMonthValue(s[ids.BOILER_MONTH], 'month', Date.parse(`${at.slice(0, 8)}10T12:00:00Z`), TZ) !== undefined);
  }
  const jan = rec.dated(Date.parse('2027-01-10T12:00:00Z'));
  assert.ok('Last December' in jan[ids.BOILER_MONTH].attributes);
  assert.ok(cards.lastMonthValue(jan[ids.BOILER_MONTH], 'month', Date.parse('2027-01-10T12:00:00Z'), TZ) > 0);
});

test("Ventilatsioon's days: the house's 24 to 34 kWh recovered, about 1 kWh of electricity, a ratio near the house's", async () => {
  const now = Date.parse('2026-11-12T14:07:00Z'), start = now - 16 * 86400e3;
  const res = await rec.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(start).toISOString(), statistic_ids: [ids.RECOVERED, ids.AHU_ENERGY], period: 'day', types: ['change'] }, now);
  const full = id => res[id].slice(1, -1).map(r => r.change);
  assert.ok(full(ids.RECOVERED).every(v => v > 18 && v < 40), full(ids.RECOVERED).join());
  assert.ok(full(ids.AHU_ENERGY).every(v => v > 0.6 && v < 1.6));
  const ratio = sumOf(res[ids.RECOVERED].slice(1, -1)) / sumOf(res[ids.AHU_ENERGY].slice(1, -1));
  assert.ok(ratio > 15 && ratio < 40, String(ratio));
});

test('a measurement ends at its state, in English with a decimal point', async () => {
  const now = Date.parse('2026-11-12T14:07:00Z');
  const s = rec.dated(now, { comma: false, levels: en });
  for (const id of [ids.OUTDOOR, ids.HUMIDITY]) {
    const h = (await rec.callWS({ type: 'history/history_during_period', start_time: new Date(now - 3600e3).toISOString(), entity_ids: [id] }, now))[id];
    assert.equal(h.at(-1).s, s[id].state, id);
  }
  assert.match(s[ids.MONTH].attributes.kulu, /^\d+\.\d\d €$/);
  assert.match(s[ids.MONTH].attributes.hind, /^\d+\.\d c\/kWh$/);
});

test('day buckets start at midnight in the set zone, across the October change', async () => {
  const now = Date.parse('2026-10-27T10:00:00Z');
  const rows = (await stat(now, stats.CONSUMPTION, 'day', ['change'], Date.parse('2026-10-23T12:00:00Z')))[stats.CONSUMPTION];
  for (const r of rows) assert.deepEqual([zoneParts(r.start, TZ).h, zoneParts(r.start, TZ).min], [0, 0]);
  const long = rows.find(r => zoneParts(r.start, TZ).d === 25);
  assert.equal(long.end - long.start, 25 * 3600e3);
  const price = (await stat(now, stats.PRICE_STAT, 'day', ['mean', 'max'], Date.parse('2026-10-20T00:00:00Z')))[stats.PRICE_STAT];
  assert.ok(price.every(r => r.max >= r.mean));
});

test("the prices cover today and tomorrow, and the level reads the hour's price", () => {
  for (const at of ['2026-11-12T14:07:00Z', '2026-10-24T12:00:00Z']) {
    const now = Date.parse(at), s = rec.dated(now, { levels: et }), p = zoneParts(now, TZ);
    const prices = s[ids.FORECAST].attributes.prices;
    assert.equal(prices[0].s * 1000, dayStart(p.y, p.m, p.d, TZ));
    assert.equal(prices.at(-1).s * 1000 + 3600e3, dayStart(p.y, p.m, p.d + 2, TZ));
    // the bars split days in the browser's zone, so only the hour now is compared
    const bars = cards.priceBars(prices, new Date(now));
    assert.equal(bars.bars[bars.current].s, Math.floor(now / 3600e3) * 3600e3);
    const level = s[ids.PRICE_LEVEL];
    assert.equal(level.attributes.arvel, Number((bars.bars[bars.current].t * 100).toFixed(1)));
    assert.ok(et.some(([, w]) => w === level.state));
  }
  assert.equal(rec.dated(Date.parse('2026-10-24T12:00:00Z'))[ids.FORECAST].attributes.prices.length, 49);
});

test("the level words of each language are the cards' own sensor words", () => {
  for (const [lang, levels] of [['et', et], ['en', en]]) {
    const tones = sensorWords(lang).tone;
    for (const [, w] of levels) assert.ok(w in tones, `${lang}: ${w}`);
    assert.deepEqual(levels.map(([, w]) => tones[w]), ['good', 'good', 'mid', 'mid', 'high', 'high']);
  }
});

test("the level's sentence reads the price now against the day's average", () => {
  const hinnang = { below: 'B', near: 'N', above: 'A' };
  const said = ['2026-11-12T01:00:00Z', '2026-11-12T16:30:00Z'].map(at => rec.dated(Date.parse(at), { levels: et, hinnang })[ids.PRICE_LEVEL].attributes.hinnang);
  assert.deepEqual(said, ['B', 'A']);
});

test("months for the days sheet's 12 months (ADR-013): a month is the sum or the mean of its days", async () => {
  const now = Date.parse('2026-11-13T10:00:00Z'), p = zoneParts(now, TZ);
  const sep = dayStart(p.y, 9, 1, TZ), oct = dayStart(p.y, 10, 1, TZ);
  const month = async (id, types) => (await stat(now, id, 'month', types, sep))[id];
  const days = async (id, types) => (await stat(now, id, 'day', types, sep))[id].filter(r => r.start < oct);
  const [m] = await month(stats.CONSUMPTION, ['change']);
  assert.equal(m.start, sep);
  assert.equal(m.end, oct);
  assert.ok(Math.abs(m.change - sumOf(await days(stats.CONSUMPTION, ['change']))) < 0.05);
  const [pm] = await month(stats.PRICE_STAT, ['mean']), pd = await days(stats.PRICE_STAT, ['mean']);
  assert.ok(pm.mean >= Math.min(...pd.map(r => r.mean)) && pm.mean <= Math.max(...pd.map(r => r.mean)));
  // the sheet's own request: twelve months, quickly, this month so far included
  const t0 = performance.now();
  const msg = cards.daysSheetRequest({ statistic: stats.COST, type: 'change' }, '12m', now, TZ);
  const rows = (await rec.callWS(msg, now))[stats.COST];
  assert.ok(performance.now() - t0 < 1000);
  assert.ok(rows.length >= 12 && rows.length <= 13);
  const s = cards.slotSeries({ [stats.COST]: rows }, { statistic: stats.COST, type: 'change' }, '12m', now, TZ);
  assert.equal(s.pts.filter(x => x.v !== null).length, 12);
  assert.equal(s.pts[11].out, 'open');
});

const py2 = `import json, sys; sys.path.insert(0, 'scripts'); import dashboard_demo as d, dashboard_config as dc
ids = {k: v['id'] for k, v in d.CATALOGUE.items()}
print(json.dumps({k: ids[getattr(dc, k)] for k in ('RAIN_NOW', 'RAIN_2H', 'WEATHER', 'RAIN_RULE', 'SUNSET_RULE')}))`;
const P = JSON.parse(execFileSync('python3', ['-I', '-c', py2], { cwd: ROOT, encoding: 'utf8' }));
const fcCall = (entity, now) => rec.callWS({ type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type: 'hourly' }, target: { entity_id: entity }, return_response: true }, now);

test("the forecast (ADR-014): 24 hours from the hour now in the house's shape, agreeing with the rain and outdoor profiles", async () => {
  const now = Date.parse('2026-11-12T14:07:00Z'), house = fixture('forecast.json');
  const r = await fcCall(P.WEATHER, now);
  const rows = r.response[P.WEATHER].forecast;
  assert.equal(rows.length, 24);
  assert.equal(rows[0].datetime, '2026-11-12T14:00:00.000Z');
  assert.equal(keys(rows[0]), keys(house.response['weather.test_forecast'].forecast[0]));
  const dated = rec.dated(now, { comma: false });
  // the rain sensor now is the forecast's first hour, the two-hour sensor its next two
  assert.equal(Number(dated[P.RAIN_NOW].state), rows[0].precipitation);
  assert.ok(Math.abs(Number(dated[P.RAIN_2H].state) - (rows[1].precipitation + rows[2].precipitation)) < 0.11);
  assert.ok(Math.abs(rows[0].temperature - Number(dated[ids.OUTDOOR].state)) < 1);
  assert.equal(dated[P.WEATHER].state, rows[0].condition);
  for (const x of rows) assert.equal(x.condition === 'rainy' || x.condition === 'snowy', x.precipitation > 0, x.datetime);
  // the house's own card reads it
  const hours = cards.forecastHours(r, P.WEATHER, now, 14);
  assert.equal(hours.length, 14);
  await assert.rejects(fcCall('weather.other', now));
});

test('the rain is never negative, mostly dry, and has dry days and wet ones', async () => {
  const now = Date.parse('2026-11-30T23:00:00Z');
  const rows = (await stat(now, P.RAIN_NOW, 'hour', ['mean'], now - 30 * 86400e3))[P.RAIN_NOW];
  assert.ok(rows.length >= 700);
  assert.ok(rows.every(r => r.mean >= 0 && r.min >= 0));
  const wet = rows.filter(r => r.mean > 0).length;
  assert.ok(wet > 0 && wet < rows.length * 0.15, String(wet));
  const byDay = new Map();
  for (const r of rows) { const p = zoneParts(r.start, TZ), k = `${p.m}-${p.d}`; byDay.set(k, (byDay.get(k) || 0) + r.mean); }
  const sums = [...byDay.values()];
  assert.ok(sums.some(v => v === 0) && sums.some(v => v > 0));
  // the two-hour sensor is never negative either
  assert.ok((await stat(now, P.RAIN_2H, 'hour', ['mean'], now - 2 * 86400e3))[P.RAIN_2H].every(r => r.mean >= 0));
});

test("each rule's last run is today at its time once it has passed, else yesterday", () => {
  const at = iso => rec.dated(Date.parse(iso), { comma: false });
  assert.equal(at('2026-11-13T13:00:00Z')[P.RAIN_RULE].attributes.last_triggered, '2026-11-13T12:19:00.000Z');
  assert.equal(at('2026-11-13T12:00:00Z')[P.RAIN_RULE].attributes.last_triggered, '2026-11-12T12:19:00.000Z');
  assert.equal(at('2026-11-13T14:00:00Z')[P.SUNSET_RULE].attributes.last_triggered, '2026-11-13T13:45:00.000Z');
  assert.equal(at('2026-11-13T14:00:00Z')[P.SUNSET_RULE].state, 'on');
  assert.equal(cards.whenText(at('2026-11-13T14:00:00Z')[P.RAIN_RULE].attributes.last_triggered, 'et', TZ, Date.parse('2026-11-13T14:00:00Z')), 'täna 14:19');
});

test("a rule's last run keeps its clock time across the October change", () => {
  // 2026-10-25: Tallinn goes from +03:00 to +02:00 at 04:00
  const r = rec.dated(Date.parse('2026-10-25T20:00:00Z'), { comma: false })[P.RAIN_RULE].attributes.last_triggered;
  assert.equal(cards.whenText(r, 'et', TZ, Date.parse('2026-10-25T20:00:00Z')), 'täna 14:19');
  const before = rec.dated(Date.parse('2026-10-25T09:00:00Z'), { comma: false })[P.RAIN_RULE].attributes.last_triggered;
  assert.equal(before, '2026-10-24T11:19:00.000Z');
});

test("motion and doors (ADR-015): pulses by the hour that end at the catalogue's state and age, quiet before it", async () => {
  const now = Date.parse('2026-11-13T15:24:00Z');
  const pulses = Object.entries(spec.profiles).filter(([, p]) => p.kind === 'pulses');
  assert.equal(pulses.length, 12, 'nine PIRs and three doors');
  const msg = { type: 'history/history_during_period', start_time: new Date(now - 86400e3).toISOString(), entity_ids: pulses.map(([id]) => id), minimal_response: true, no_attributes: true };
  const hist = await rec.callWS(msg, now), again = await rec.callWS(msg, now);
  assert.deepEqual(hist, again, 'the same on every load');
  const on = cards.onTimes(hist, pulses.map(([id]) => id));
  for (const [id, p] of pulses) {
    const rows = hist[id], last = rows.at(-1);
    assert.equal(rows[0].s, 'off', `${id} starts off`);
    assert.deepEqual(Object.keys(last).sort(), ['lu', 's']);
    assert.equal(last.s, p.state, `${id} ends at its state`);
    if (p.ago < 24 * 60) assert.equal(Math.round(last.lu), Math.round((now - p.ago * 60e3) / 1000), `${id} last changed ${p.ago} min ago`);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i].lu >= rows[i - 1].lu, `${id} in order`);
    const quiet = now - Math.max(p.ago, p.quiet) * 60e3 - 60e3, events = on[id];
    assert.ok(events.slice(0, -1).every(t => t < quiet), `${id}: only its last change in the quiet minutes`);
    if (p.hours.length && p.ago < 600) assert.ok(events.length >= 2, `${id} moves during the day`);
  }
  const back = pulses.find(([, p]) => !p.hours.length);
  assert.equal(on[back[0]].length, 0, 'the back door has not opened in a day');
});
