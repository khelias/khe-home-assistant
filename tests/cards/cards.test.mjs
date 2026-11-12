// Tests of the dashboard cards' pure helpers (cards/khe-cards.js): the sentence, the chips, the
// price bars, the tile state and the actions they hand to HA. Under Node the elements are not
// defined, so only the helpers are tested; the demo test mounts nothing either.
// Run from the repo root: node --test tests/cards/cards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

// the DST cases need a zone with DST; Node rereads TZ when it is set
process.env.TZ = 'Europe/Tallinn';
const { sentence, chips, securityText, peopleText, priceBars, priceLevel, tileState, tileActive, tileAction, modeAction, palette, joinEt, formatNumber, stateWord } = await import('../../cards/khe-cards.js');

const st = (state, attributes = {}) => ({ state, attributes });
const FAULTS = [
  { entity: 'binary_sensor.smoke', name: 'Tulekahju' },
  { entity: 'binary_sensor.boiler', name: 'Boileri viga' },
  { entity: 'binary_sensor.vent', name: 'Ventilatsiooni viga' },
  { entity: 'binary_sensor.fresh', name: 'Estfeedi andmed hilinevad', bad: 'off' }
];
const ALARMS = [{ entity: 'alarm_control_panel.maja', name: 'Maja' }, { entity: 'alarm_control_panel.garaaz', name: 'Garaaž' }];
const PEOPLE = [{ entity: 'person.mari', name: 'Mari' }, { entity: 'person.jaan', name: 'Jaan' }];
const CONF = { faults: FAULTS, alarms: ALARMS, people: PEOPLE, price: 'sensor.level', climate: { temperature: 'sensor.t', humidity: 'sensor.h' }, energy_path: '/lovelace/energia' };
const calm = (over = {}) => ({
  'binary_sensor.smoke': st('off'), 'binary_sensor.boiler': st('off'), 'binary_sensor.vent': st('off'), 'binary_sensor.fresh': st('on'),
  'alarm_control_panel.maja': st('disarmed'), 'alarm_control_panel.garaaz': st('armed_away'),
  'person.mari': st('home'), 'person.jaan': st('not_home'),
  'sensor.level': st('odav', { arvel: 8.8, hinnang: 'Odav päev, praegu alla keskmise' }),
  'sensor.t': st('21.4'), 'sensor.h': st('41'),
  ...over
});

test('the Estonian list join', () => {
  assert.equal(joinEt([]), '');
  assert.equal(joinEt(['a']), 'a');
  assert.equal(joinEt(['a', 'b']), 'a ja b');
  assert.equal(joinEt(['a', 'b', 'c']), 'a, b ja c');
});

test('the sentence: no fault, one, two and three, a bad-off fault, an alarm, no price', () => {
  assert.deepEqual(sentence(calm(), CONF), { text: 'Kõik on korras. Elekter on praegu odav.', warn: false });
  assert.equal(sentence(calm({ 'binary_sensor.boiler': st('on') }), CONF).text, 'Vajab tähelepanu: Boileri viga. Elekter on praegu odav.');
  assert.equal(sentence(calm({ 'binary_sensor.boiler': st('on'), 'binary_sensor.vent': st('on') }), CONF).text, 'Vajab tähelepanu: Boileri viga ja Ventilatsiooni viga. Elekter on praegu odav.');
  const three = sentence(calm({ 'binary_sensor.smoke': st('on'), 'binary_sensor.boiler': st('on'), 'binary_sensor.vent': st('on') }), CONF);
  assert.equal(three.text, 'Vajab tähelepanu: Tulekahju, Boileri viga ja Ventilatsiooni viga. Elekter on praegu odav.');
  assert.equal(three.warn, true);
  // the freshness flag is bad when off; its on state and an unavailable fault are no fault
  assert.match(sentence(calm({ 'binary_sensor.fresh': st('off') }), CONF).text, /^Vajab tähelepanu: Estfeedi andmed hilinevad\./);
  assert.match(sentence(calm({ 'binary_sensor.boiler': st('unavailable') }), CONF).text, /^Kõik on korras\./);
  const alarm = sentence(calm({ 'alarm_control_panel.garaaz': st('triggered'), 'binary_sensor.boiler': st('on') }), CONF);
  assert.deepEqual(alarm, { text: 'Valve on häires: Garaaž. Elekter on praegu odav.', warn: true });
  assert.equal(sentence(calm({ 'sensor.level': st('unavailable') }), CONF).text, 'Kõik on korras.');
  assert.equal(sentence(calm({ 'sensor.level': undefined }), CONF).text, 'Kõik on korras.');
  assert.equal(sentence(calm({ 'sensor.level': st('tavaline') }), CONF).text, 'Kõik on korras. Elekter on praegu tavalise hinnaga.');
});

test('people: none, one or all home, unknown and unavailable count as away', () => {
  assert.equal(peopleText(calm({ 'person.mari': st('not_home') }), PEOPLE), 'keegi pole kodus');
  assert.equal(peopleText(calm(), PEOPLE), 'Mari kodus');
  assert.equal(peopleText(calm({ 'person.jaan': st('home') }), PEOPLE), 'Mari ja Jaan kodus');
  assert.equal(peopleText(calm({ 'person.mari': st('unknown'), 'person.jaan': st('unavailable') }), PEOPLE), 'keegi pole kodus');
  // no people file: no chip at all
  assert.ok(!chips(calm(), { ...CONF, people: [] }).some(c => c.key === 'people'));
  assert.ok(chips(calm(), CONF).some(c => c.key === 'people'));
});

test('Turvalisus for every alarm state', () => {
  const garage = s => securityText(calm({ 'alarm_control_panel.garaaz': st(s) }), ALARMS);
  assert.equal(garage('disarmed'), 'kõik valveta');
  assert.equal(garage('armed_away'), 'garaaž valves');
  assert.equal(garage('armed_home'), 'garaaž valves');
  assert.equal(garage('armed_night'), 'garaaž valves');
  assert.equal(garage('arming'), 'garaaž valvestub');
  assert.equal(garage('pending'), 'garaaž sisenemisviivitus');
  assert.equal(garage('triggered'), 'garaaž häires');
  assert.equal(securityText(calm({ 'alarm_control_panel.maja': st('armed_home') }), ALARMS), 'maja ja garaaž valves');
  assert.equal(securityText(calm({ 'alarm_control_panel.maja': st('triggered') }), ALARMS), 'maja häires, garaaž valves');
  assert.equal(securityText(calm({ 'alarm_control_panel.garaaz': st('unavailable') }), ALARMS), 'pole teada');
  const chip = s => chips(calm({ 'alarm_control_panel.garaaz': st(s) }), CONF).find(c => c.key === 'security');
  assert.equal(chip('armed_away').icon, 'shield-check');
  assert.equal(chip('disarmed').icon, 'shield');
  assert.equal(chip('triggered').warn, true);
  assert.equal(chip('pending').warn, true);
  assert.ok(!chip('arming').warn);
});

test('chips: faults first in red, then price, security, climate and people, with their taps', () => {
  const list = chips(calm({ 'binary_sensor.vent': st('on') }), CONF);
  assert.deepEqual(list.map(c => c.key), ['fault:binary_sensor.vent', 'price', 'security', 'climate', 'people']);
  assert.equal(list[0].warn, true);
  assert.deepEqual(list[0].tap, { config: { entity: 'binary_sensor.vent', tap_action: { action: 'more-info' } }, action: 'tap' });
  const by = k => list.find(c => c.key === k);
  assert.equal(by('price').value, '8,8 s, odav');
  assert.deepEqual(by('price').tap.config.tap_action, { action: 'navigate', navigation_path: '/lovelace/energia' });
  assert.equal(by('climate').value, '21,4° · 41 %');
  assert.equal(by('climate').tap, undefined);
  assert.equal(chips(calm({ 'sensor.t': st('error') }), CONF).find(c => c.key === 'climate').value, '41 %');
  assert.equal(by('security').tap.config.entity, 'alarm_control_panel.maja');
  assert.equal(by('people').tap.config.entity, 'person.mari');
  assert.equal(chips(calm({ 'sensor.level': st('unavailable') }), CONF).find(c => c.key === 'price').value, 'pole teada');
  // no path, no link
  assert.equal(chips(calm(), { ...CONF, energy_path: undefined }).find(c => c.key === 'price').tap, null);
});

// hourly points from local midnight of the day `now` is in, as the forecast sensor carries them
function prices(now, hours, start = 0) {
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  return Array.from({ length: hours }, (_, i) => ({ s: day0 + (start + i) * 3600, p: 0.05, t: 0.1 + (i % 3) * 0.08 }));
}

test('bars: 48 points, 24 before tomorrow is published, and the current hour', () => {
  const now = new Date(2026, 9, 16, 14, 30);
  const b = priceBars(prices(now, 48), now);
  assert.equal(b.bars.length, 48);
  assert.equal(b.today, 24);
  assert.equal(b.current, 14);
  assert.ok(b.bars[13].past && !b.bars[14].past && b.bars[14].now);
  assert.ok(!b.bars[23].tomorrow && b.bars[24].tomorrow);
  const only = priceBars(prices(now, 24), now);
  assert.equal(only.bars.length, 24);
  assert.equal(only.today, 24);
  // yesterday's and the day after tomorrow's hours are left out
  assert.equal(priceBars(prices(now, 80, -10), now).bars.length, 48);
});

test('bars: 23 and 25 hours on the DST days', () => {
  const spring = new Date(2026, 2, 29, 12);
  assert.equal(priceBars(prices(spring, 23), spring).today, 23);
  const autumn = new Date(2026, 9, 25, 12);
  const b = priceBars(prices(autumn, 25 + 24), autumn);
  assert.equal(b.today, 25);
  assert.equal(b.bars.length, 49);
  // at noon on the 25-hour day the current bar is the 13th hour since midnight
  assert.equal(b.current, 13);
});

test('bars: missing prices, a price above the scale and the colour bands', () => {
  const now = new Date(2026, 9, 16, 14, 30);
  assert.equal(priceBars(undefined, now), null);
  assert.equal(priceBars([], now), null);
  const high = prices(now, 24).map((p, i) => (i === 3 ? { ...p, t: 0.9 } : p));
  const b = priceBars(high, now);
  assert.equal(b.bars[3].height, 1);
  assert.ok(b.bars[0].height > 0 && b.bars[0].height < 1);
  assert.deepEqual([0.149, 0.15, 0.249, 0.25].map(t => priceLevel(t)), ['cheap', 'mid', 'mid', 'high']);
  assert.equal(priceLevel(0.12, [0.1, 0.2]), 'mid');
  assert.equal(priceBars(prices(now, 24), now, [0.01, 0.02]).bars[0].level, 'high');
});

test('tile: active states, state text and the unavailable state', () => {
  assert.ok(tileActive(st('on')));
  assert.ok(tileActive(st('armed_night')));
  assert.ok(tileActive(st('performance')));
  assert.ok(!tileActive(st('off')));
  assert.ok(!tileActive(st('disarmed')));
  assert.ok(tileActive(st('kitchen'), ['*']));
  assert.ok(!tileActive(st('unavailable'), ['*']));
  assert.ok(tileActive(st('open'), ['open', 'opening']));
  const states = { 'switch.heat': st('on'), 'sensor.water': st('32.5', { unit_of_measurement: '°C' }), 'water_heater.dhw': st('on', { current_temperature: 51 }), 'select.mode': st('normal'), 'sensor.in': st('19.6', { unit_of_measurement: '°C' }), 'cover.roof': st('closed') };
  assert.deepEqual(tileState({ entity: 'switch.heat', state_text: ['state', 'sensor.water'] }, states), { lit: true, unavailable: false, text: 'sees · 32,5°' });
  assert.equal(tileState({ entity: 'water_heater.dhw', state_text: ['current_temperature'] }, states).text, '51°');
  assert.equal(tileState({ entity: 'select.mode', active: ['*'], state_text: [{ entity: 'sensor.in', label: 'sisse' }, { entity: 'sensor.out', label: 'välja' }] }, states).text, 'sisse 19,6°');
  assert.equal(tileState({ entity: 'cover.roof' }, states).text, 'kinni');
  assert.equal(tileState({ entity: 'cover.roof', state_text: 'Katus' }, states).text, 'Katus');
  assert.deepEqual(tileState({ entity: 'light.gone' }, states), { lit: false, unavailable: true, text: 'pole saadaval' });
  assert.deepEqual(tileState({ entity: 'switch.heat' }, { 'switch.heat': st('unavailable') }), { lit: false, unavailable: true, text: 'pole saadaval' });
});

test('tile actions: body, icon and the unavailable tile still acting', () => {
  const nav = { action: 'navigate', navigation_path: '/lovelace/soojuspump' };
  assert.deepEqual(tileAction({ entity: 'switch.heat', tap_action: nav }), { config: { entity: 'switch.heat', tap_action: nav }, action: 'tap' });
  // the icon does what the body does unless it has its own action
  assert.deepEqual(tileAction({ entity: 'switch.heat', tap_action: nav }, 'icon').config.tap_action, nav);
  const off = { action: 'perform-action', perform_action: 'media_player.turn_off', target: { entity_id: 'media_player.tv' }, confirmation: { text: 'Lülitad teleri välja?' } };
  assert.deepEqual(tileAction({ entity: 'media_player.tv', tap_action: nav, icon_tap_action: off }, 'icon').config.tap_action, off);
  assert.deepEqual(tileAction({ entity: 'sensor.x' }).config.tap_action, { action: 'more-info' });
  assert.equal(tileAction({ entity: 'sensor.x', tap_action: { action: 'none' } }), null);
});

test('modes: the running one does nothing, another emits select_option with its confirmation', () => {
  const mode = { name: 'Köök', option: 'kitchen', confirm: 'Ventilatsioon režiimile Köök?' };
  assert.equal(modeAction('select.mode', mode, 'kitchen'), null);
  const a = modeAction('select.mode', mode, 'normal');
  assert.deepEqual(a, {
    config: {
      entity: 'select.mode',
      tap_action: { action: 'perform-action', perform_action: 'select.select_option', target: { entity_id: 'select.mode' }, data: { option: 'kitchen' }, confirmation: { text: 'Ventilatsioon režiimile Köök?' } }
    },
    action: 'tap'
  });
  assert.equal(modeAction('select.mode', { name: 'X', option: 'boost' }, 'normal').config.tap_action.confirmation, undefined);
});

test('the dark flag flips the palette', () => {
  const light = palette(false), dark = palette(true);
  assert.equal(light.ink, '#17191a');
  assert.equal(dark.ink, '#eef1f0');
  assert.equal(dark.onAccent, '#0b0d0d');
  assert.notEqual(light.tile, dark.tile);
  assert.deepEqual(light.lit.warm, ['#F6D9C4', '#A3471A']);
  assert.deepEqual(dark.lit.warm, ['#E9A06B', '#2A1608']);
  assert.equal(dark.dark, true);
});

test('numbers and state words in Estonian', () => {
  assert.equal(formatNumber('21.4'), '21,4');
  assert.equal(formatNumber(8.8, 1), '8,8');
  assert.equal(formatNumber('x'), null);
  assert.equal(stateWord(st('9.2', { unit_of_measurement: 'kWh' })), '9,2 kWh');
  assert.equal(stateWord(st('armed_home')), 'valves');
  assert.equal(stateWord(st('disarmed')), 'valveta');
  assert.equal(stateWord(undefined), 'pole saadaval');
});

/* ---------- A3 (ADR-005): the history sheet's helpers, on recorder responses captured from the house ---------- */

const A3 = await import('../../cards/khe-cards.js');
const { readFileSync } = await import('node:fs');
const REC = JSON.parse(readFileSync(new URL('./fixtures/recorder.json', import.meta.url), 'utf-8'));
const NOW = Date.parse('2026-11-12T14:00:00Z');

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
