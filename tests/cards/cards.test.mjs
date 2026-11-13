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

/* ---------- A3 Energia (ADR-008): time in HA's zone, daily statistics, the month and the split ---------- */

const DAILY = JSON.parse(readFileSync(new URL('./fixtures/daily.json', import.meta.url), 'utf-8'));
const TZ = 'Europe/Tallinn';
const iso = t => new Date(t).toISOString();

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

/* ---------- A3 Soojuspump (ADR-011): hourly lines, the shift stepper, the boiler's cells ---------- */

const HOURLY = JSON.parse(readFileSync(new URL('./fixtures/hourly.json', import.meta.url), 'utf-8'));

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
  assert.deepEqual(A3.lineAxis(at(10, 21), at(12, 21)), ['teisipäev 21', 'eile 21', 'nüüd']);
  assert.deepEqual(A3.lineAxis(at(12, 3), at(12, 21)), ['täna 03', 'täna 12', 'nüüd']);
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

const VENT = JSON.parse(readFileSync(new URL('./fixtures/vent.json', import.meta.url), 'utf-8'));

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

/* ---------- the cards' languages (ADR-012) ---------- */

const keysOf = o => Object.entries(o).map(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? `${k}{${keysOf(v)}}` : Array.isArray(v) ? `${k}[${v.length}]` : k)).sort().join(',');

test('languages: English has every Estonian key, list length and sensor tone', () => {
  assert.deepEqual(A3.LANGUAGES, ['et', 'en']);
  assert.equal(keysOf(A3.words('en')), keysOf(A3.words('et')));
  const tones = lang => Object.values(A3.sensorWords(lang).tone).sort().join();
  assert.equal(tones('en'), tones('et'));
  assert.equal(keysOf(A3.sensorWords('en')).replace(/tone\{[^}]*\}|phrase\{[^}]*\}/g, ''), keysOf(A3.sensorWords('et')).replace(/tone\{[^}]*\}|phrase\{[^}]*\}/g, ''));
  // an unknown language reads Estonian
  assert.equal(A3.words('fr'), A3.words('et'));
});

test('languages: no Estonian letter outside the Estonian tables and comments', () => {
  const src = readFileSync(new URL('../../cards/khe-cards.js', import.meta.url), 'utf8');
  const code = src.replace(/const ET(_SENSOR)? = \{[\s\S]*?\n\};/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, ''));
  assert.deepEqual(code.filter(l => /[õäöüšž]/i.test(l)).map(l => l.trim()), []);
});

test('languages: the helpers in English', () => {
  assert.equal(joinEt(['a', 'b', 'c'], 'en'), 'a, b and c');
  assert.equal(formatNumber('21.4', undefined, 'en'), '21.4');
  assert.equal(formatNumber(8.8, 1, 'en'), '8.8');
  assert.equal(stateWord(st('armed_home'), 'en'), 'armed');
  assert.equal(stateWord(st('9.2', { unit_of_measurement: 'kWh' }), 'en'), '9.2 kWh');
  const calmEn = calm({ 'sensor.level': st('normal', { arvel: 14.2 }) });
  assert.deepEqual(sentence(calmEn, CONF, 'en'), { text: 'All is well. Electricity is at its normal price right now.', warn: false });
  assert.equal(sentence(calm({ 'binary_sensor.smoke': st('on'), 'binary_sensor.vent': st('on') }), { faults: FAULTS }, 'en').text, 'Needs attention: Tulekahju and Ventilatsiooni viga.');
  assert.equal(peopleText(calm({ 'person.jaan': st('home') }), PEOPLE, 'en'), 'Mari and Jaan home');
  assert.equal(A3.levelTone('very expensive', 'en'), 'high');
  assert.equal(A3.levelTone('cheap', 'en'), 'good');
  // an Estonian sensor word on an English card has no tone of its own
  assert.equal(A3.levelTone('kallis', 'en'), 'mid');
  assert.equal(A3.dayName(Date.parse('2026-11-10T22:00:00Z'), 'Europe/Tallinn', 'en'), 'Wednesday 11/11');
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime(), now = at(12, 21);
  assert.equal(A3.hourSpan({ s: at(13, 23), tomorrow: true }, 'en'), 'tomorrow 23–00');
  assert.equal(A3.whenLabel(at(11, 22), '24h', true, now, 'en'), 'yesterday 22–23');
  assert.equal(A3.whenLabel(at(11, 9), '7d', false, now, 'en'), 'Wednesday 11/11 at 09');
  assert.deepEqual(A3.lineAxis(at(10, 21), at(12, 21), 'en'), ['Tuesday 21', 'yesterday 21', 'now']);
  assert.equal(A3.inLastMonth(Date.parse('2027-01-10T12:00:00Z'), 'Europe/Tallinn', 'en'), 'in December');
  assert.equal(A3.stepNote(0, 'en'), 'Heating water right on the curve');
  assert.equal(A3.stepNote(-2, 'en'), 'Heating water 2° cooler than the curve');
  assert.deepEqual(A3.splitValue(st('5.087', { unit_of_measurement: '°C' }), 1, 'en'), { value: '5.1°', unit: '' });
  assert.equal(A3.axisLabels('24h', 0, 3600e3, 'en')[4], 'now');
  assert.equal(A3.usageSheet('sensor.m', {}, 'en').title, 'Use');
  assert.equal(A3.statusLine({}, { status: { entity: 'binary_sensor.x', ok: 'Works' } }, 'en').text, 'State not known');
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
  const css = readFileSync(new URL('../../cards/khe-cards.js', import.meta.url), 'utf8');
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

test('Pergola: the forecast card draws loading, the chart, and the cells with "Prognoos pole teada" for an empty or failed answer', () => {
  const conf = { entity: FC_ID, hours: 14, cells: [{ entity: 'sensor.r', name: 'Praegu', decimals: 1, note_above: { value: 0, above: 'sajab', below: 'ei saja' } }] };
  const states = { 'sensor.r': st('0.4', { unit_of_measurement: 'mm' }) };
  const hass = { config: { time_zone: TZ } };
  const draw = (data, lang) => A3.forecastA3Markup(conf, states, data, lang, hass);
  const now = Date.now();
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

/* ---------- Valve (ADR-015): state history, the plan slice, the trail ---------- */

const V = await import('../../cards/khe-cards.js');
const PLAN = JSON.parse(readFileSync(new URL('./fixtures/plan.json', import.meta.url), 'utf8'));
const T0 = Date.parse('2026-11-13T16:24:00+02:00');
const min = n => T0 - n * 60e3;
const sec = t => t / 1000;

test('Valve: one history message for every entity over 24 h, minimal and without attributes', () => {
  const m = V.stateHistoryRequest(['binary_sensor.a', 'binary_sensor.b'], T0);
  assert.deepEqual(m, {
    type: 'history/history_during_period', start_time: new Date(T0 - 24 * 3600e3).toISOString(), end_time: new Date(T0).toISOString(),
    entity_ids: ['binary_sensor.a', 'binary_sensor.b'], minimal_response: true, no_attributes: true
  });
});

test('Valve: only off-to-on changes count; the first row is the state at the start, not an event', () => {
  const resp = {
    'binary_sensor.a': [{ s: 'on', lu: sec(min(600)) }, { s: 'off', lu: sec(min(500)) }, { s: 'on', lu: sec(min(400)) }, { s: 'off', lu: sec(min(399)) }],
    'binary_sensor.b': [{ s: 'off', lu: sec(min(600)) }, { s: 'unavailable', lu: sec(min(300)) }, { s: 'on', lu: sec(min(299)) }, { s: 'off', lu: sec(min(200)) }, { s: 'on', lu: sec(min(100)) }]
  };
  assert.deepEqual(V.onTimes(resp, ['binary_sensor.a', 'binary_sensor.b', 'binary_sensor.c']), {
    'binary_sensor.a': [min(400)], 'binary_sensor.b': [min(100)], 'binary_sensor.c': []
  });
});

test("Valve: 24 hourly counts in HA's zone, the last the hour now; a half-hour zone starts its hours at :30", () => {
  const now = Date.parse('2026-11-13T16:24:00Z');
  const t = [Date.parse('2026-11-13T16:01:00Z'), Date.parse('2026-11-13T15:59:00Z'), Date.parse('2026-11-12T16:30:00Z'), Date.parse('2026-11-12T16:59:00Z'), now + 60e3];
  const utc = V.hourlyCounts(t, now, 'UTC');
  assert.equal(utc.length, 24);
  assert.deepEqual([utc[23], utc[22], utc[0]], [1, 1, 0]);
  assert.equal(utc.reduce((a, v) => a + v, 0), 2, 'yesterday 16:xx is out, a moment after now is out');
  // Kolkata is UTC+5:30: its hour now began at 15:30 UTC, so 15:59 and 16:01 share the last bin
  const ist = V.hourlyCounts(t, now, 'Asia/Kolkata');
  assert.equal(ist[23], 2);
  assert.equal(ist[0], 2, '16:30 and 16:59 yesterday UTC are 22:00 and 22:29 IST, the first of the 24 hours');
  assert.deepEqual(V.binHours(now, 'Asia/Kolkata').slice(-2), ['20', '21']);
});

test('Valve: a history card reloads on connect only after five minutes, and redraws by the minute', () => {
  assert.equal(V.historyStale({ now: T0 - 4 * 60e3, res: {} }, T0), false);
  assert.equal(V.historyStale({ now: T0 - 6 * 60e3, res: {} }, T0), true);
  assert.equal(V.historyStale({ error: true }, T0), false, 'an error waits for its own retry');
  assert.equal(V.historyStale(null, T0), false);
  assert.equal(V.minuteKeyOf(T0 + 59e3), V.minuteKeyOf(T0));
  assert.notEqual(V.minuteKeyOf(T0 + 60e3), V.minuteKeyOf(T0));
});

test('Valve: live off-to-on changes merge with the history, once to the second', () => {
  const off = { state: 'off', last_changed: new Date(min(5)).toISOString() };
  const on = { state: 'on', last_changed: new Date(min(2)).toISOString() };
  assert.deepEqual(V.liveOn(null, { 'binary_sensor.a': on }, ['binary_sensor.a']), {}, 'the first states seen are no change');
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': off }, { 'binary_sensor.a': on }, ['binary_sensor.a']), { 'binary_sensor.a': min(2) });
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': on }, { 'binary_sensor.a': { ...on, state: 'off' } }, ['binary_sensor.a']), {});
  assert.deepEqual(V.liveOn({ 'binary_sensor.a': on }, { 'binary_sensor.a': on }, ['binary_sensor.a']), {});
  assert.deepEqual(V.mergeTimes([min(30), min(2) + 120], [min(2), min(1)]), [min(30), min(2), min(1)], 'the same second once');
});

const fixtureGraph = () => V.planGraph(PLAN);
const inside = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
const rectsOf = id => PLAN.rooms.find(r => r.id === id).rects;

test('Valve: the plan slice carries rooms, walls with doors and the placed PIRs, no devices', () => {
  assert.deepEqual(Object.keys(PLAN).sort(), ['pirs', 'rooms', 'walls']);
  assert.ok(PLAN.walls.some(w => w.doors.length));
  assert.ok(!PLAN.pirs.some(p => p.entity === 'binary_sensor.demo_room_a_motion'), 'a PIR the model does not place is not in it');
});

test('Valve: an open passage joins two rooms with no wall between them', () => {
  const g = fixtureGraph();
  // the hall opens into the gallery and the gallery into the kitchen and living room, no door in either
  const p = V.shortestPath(g, g.anchor.r3, g.anchor.r1);
  assert.ok(p, 'hall to kitchen');
  assert.ok(p.some(q => rectsOf('r8').some(r => inside(q, r))), 'through the gallery');
  assert.equal(V.sharedEdge([0, 0, 2, 2], [2.1, 1, 4, 4]).axis, 0);
  assert.equal(V.sharedEdge([0, 0, 2, 2], [3, 0, 4, 2]), null, 'too far apart');
});

test('Valve: an L-shaped hall is walked through its rects, and a door joins the rooms on both sides', () => {
  const g = fixtureGraph();
  const p = V.shortestPath(g, g.anchor.r5, g.anchor.r4);
  assert.ok(p, "children's room to bathroom");
  for (const r of rectsOf('r3')) assert.ok(p.some(q => inside(q, r)), `through ${r}`);
  assert.ok(V.shortestPath(g, g.anchor.carport, g.anchor.r3), 'carport through the utility room');
});

test('Valve: a room with no way to the next is a gap in the trail, not a reason to drop it', () => {
  const closed = { ...PLAN, walls: PLAN.walls.map(w => ({ ...w, doors: w.doors.filter(([c]) => !(w.a[0] === 31 && w.a[1] === 4 && c === 4)) })) };
  const g = V.planGraph(closed);
  assert.equal(V.shortestPath(g, g.anchor.carport, g.anchor.r3), null);
  const runs = V.trailRuns(g, [{ room: 'carport', t: min(10) }, { room: 'r3', t: min(5) }, { room: 'r1', t: min(1) }]);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].length, 1);
  assert.ok(runs[1].length > 2);
  assert.match(V.catmullRom(runs[0]), /^M[\d.]+ [\d.]+h0\.01$/);
  assert.equal((V.catmullRom(runs[1]).match(/C/g) || []).length, runs[1].length - 1);
});

test('Valve: two rooms are one walk only when they are next to each other and the second fired soon after the first', () => {
  const g = fixtureGraph(), sensed = new Set(PLAN.pirs.map(p => p.room));
  const at = (room, t, times = [t]) => ({ room, t, times });
  const walk = V.trailRuns(g, [at('r1', min(5)), at('r3', min(4))], sensed);
  assert.equal(walk.length, 1, 'kitchen to hall a minute later: one person');
  assert.equal(V.trailRuns(g, [at('r1', min(9)), at('r3', min(1))], sensed).length, 2, 'the hall fired eight minutes after the kitchen: two people');
  assert.equal(V.trailRuns(g, [at('r1', min(9)), at('r3', min(1), [min(8), min(1)])], sensed).length, 1, 'the hall fired a minute after the kitchen, and again since');
  assert.equal(V.trailRuns(g, [at('r1', min(3)), at('r5', min(2))], sensed).length, 2, "kitchen to the children's room crosses the hall, which did not fire: two people");
  assert.equal(V.trailRuns(g, [at('r1', min(3)), at('r5', min(2))]).length, 1, 'without the sensed rooms a path alone joins them');
});

const row = (entity, last, on = false) => ({ entity, name: entity, times: last === null ? [] : [last], on, last: on ? T0 : last });

test('Valve: the trail is each room once by its last motion, the last five, inside 15 minutes', () => {
  const rows = [
    row('binary_sensor.test_kitchen_motion', min(9)), row('binary_sensor.test_living_motion', min(4)),
    row('binary_sensor.test_hall_motion', min(6)), row('binary_sensor.test_bath_motion', min(15)),
    row('binary_sensor.test_bedroom_motion', min(16)), row('binary_sensor.test_carport_motion', null),
    row('binary_sensor.demo_room_a_motion', min(1))
  ];
  assert.deepEqual(V.trailRooms(PLAN, rows, T0).map(x => x.room), ['r4', 'r3', 'r1'], 'the bedroom is past 15 minutes, the unplaced PIR is out, two PIRs light r1 once');
  assert.deepEqual(V.trailRooms(PLAN, rows, T0, 15, 2).map(x => x.room), ['r3', 'r1']);
  assert.deepEqual(V.trailRooms(PLAN, rows, T0, 20).map(x => x.room), ['r2', 'r4', 'r3', 'r1']);
  const every = { ...PLAN, pirs: PLAN.rooms.map(r => ({ entity: `binary_sensor.${r.id}`, room: r.id })) };
  const busy = PLAN.rooms.map((r, i) => row(`binary_sensor.${r.id}`, min(10 - i)));
  assert.deepEqual(V.trailRooms(every, busy, T0).map(x => x.room), PLAN.rooms.slice(-5).map(r => r.id), 'six rooms or more keep the last five');
});

test('Valve: the plan fills the room in motion now, tints the trail, and is left out without a slice', () => {
  const rows = [row('binary_sensor.test_hall_motion', min(1)), row('binary_sensor.test_kitchen_motion', null, true), row('binary_sensor.test_living_motion', null)];
  const p = V.planSvg(PLAN, rows, T0, V.a3Palette(false));
  assert.match(p.svg, /<svg class="plan"/);
  assert.match(p.svg, /fill="rgba\(48,176,199,0\.55\)"\/>/, 'r1 tinted strongly while its kitchen PIR is on');
  assert.match(p.svg, /fill="rgba\(48,176,199,0\.18\)"\/>/, 'the hall tinted for the trail');
  assert.match(p.svg, /fill="#55555b"\/>/, 'the outer walls');
  assert.match(p.svg, /stroke="url\(#trail0\)"/, 'the hall a minute before the kitchen: one walk');
  assert.match(p.svg, /class="ring"/);
  assert.equal(p.aria, 'Maja plaan, liikumise tee viimase veerandtunniga: Eeskoda ja Pere köök-elutuba');
  assert.deepEqual(V.planSvg(null, rows, T0, V.a3Palette(false)), { svg: '', aria: '' });
  const quiet = V.planSvg(PLAN, [row('binary_sensor.test_hall_motion', min(60))], T0, V.a3Palette(false));
  assert.doesNotMatch(quiet.svg, /url\(#trail/);
  assert.match(quiet.aria, /pole$/);
});

const ALARM_CONF = [{ entity: 'alarm_control_panel.maja', name: 'Maja' }, { entity: 'alarm_control_panel.garaaz', name: 'Garaaž' }];
const alarmStates = (maja = 'disarmed', since = min(60), extra = {}) => ({
  'alarm_control_panel.maja': { state: maja, last_changed: new Date(since).toISOString() },
  'alarm_control_panel.garaaz': { state: 'disarmed', last_changed: new Date(min(600)).toISOString() }, ...extra
});

test('Valve: the headline: motion now, the last motion and how long ago, quiet', () => {
  const tz = 'Europe/Tallinn';
  const on = { state: 'on', last_changed: new Date(min(1)).toISOString() };
  const live = [{ ...row('binary_sensor.k', min(1), true), name: 'Köök' }, { ...row('binary_sensor.e', min(3)), name: 'Elutuba' }];
  assert.deepEqual(V.motionHeadline(live, alarmStates('disarmed', min(60), { 'binary_sensor.k': on }), ALARM_CONF, T0, 'et', tz), { tone: 'live', label: 'Liikumine praegu', big: 'Köök', note: '' });
  const past = [{ ...row('binary_sensor.k', min(12)), name: 'Köök' }, { ...row('binary_sensor.e', min(3)), name: 'Elutuba' }];
  assert.deepEqual(V.motionHeadline(past, alarmStates(), ALARM_CONF, T0, 'et', tz), { tone: 'last', label: 'Viimane liikumine 3 min tagasi', big: 'Elutuba', note: '' });
  const old = [{ ...row('binary_sensor.k', min(130)), name: 'Köök' }];
  assert.equal(V.motionHeadline(old, alarmStates(), ALARM_CONF, T0, 'et', tz).label, 'Viimane liikumine täna 14:14');
  assert.equal(V.motionHeadline(old, alarmStates(), ALARM_CONF, T0, 'en', tz).label, 'Last motion today 14:14');
  assert.deepEqual(V.motionHeadline([{ ...row('binary_sensor.k', null), name: 'Köök' }], alarmStates(), ALARM_CONF, T0, 'et', tz), { tone: 'quiet', label: 'Ööpäeva jooksul liikumist pole', big: 'Vaikne', note: '' });
});

test('Valve: while a partition is pending or triggered, the room that fired last before it changed', () => {
  const tz = 'Europe/Tallinn';
  const rows = [
    { entity: 'binary_sensor.c', name: 'Koridor', times: [min(20), min(8)], on: false, last: min(8) },
    { entity: 'binary_sensor.k', name: 'Köök', times: [min(7), min(2)], on: false, last: min(2) }
  ];
  // Maja went into alarm 5 minutes ago: the kitchen at 16:17 fired last before it, not at 16:22
  assert.deepEqual(V.motionHeadline(rows, alarmStates('triggered', min(5)), ALARM_CONF, T0, 'et', tz), { tone: 'bad', label: 'Häire, Maja', big: 'Köök', note: 'andur käivitus kell 16:17', entity: 'binary_sensor.k' });
  assert.equal(V.motionHeadline(rows, alarmStates('pending', min(7.5)), ALARM_CONF, T0, 'et', tz).big, 'Koridor');
  assert.equal(V.motionHeadline(rows, alarmStates('pending', min(7.5)), ALARM_CONF, T0, 'en', tz).label, 'Entry delay, Maja');
  assert.deepEqual(V.motionHeadline(rows, alarmStates('triggered', min(30)), ALARM_CONF, T0, 'et', tz), { tone: 'bad', label: 'Häire, Maja', big: 'Pole teada', note: 'andur pole teada', entity: null });
  assert.equal(V.motionHeadline(rows, alarmStates('armed_away', min(30)), ALARM_CONF, T0, 'et', tz).tone, 'last', 'armed alone is no alarm');
});

test("Valve: a row's last time is 'praegu', the time today, the day before or 'üle 24 h'", () => {
  const tz = 'Europe/Tallinn';
  assert.equal(V.rowLast(row('x', null, true), T0, 'et', tz), 'praegu');
  assert.equal(V.rowLast(row('x', min(5)), T0, 'et', tz), '16:19');
  assert.equal(V.rowLast(row('x', min(20 * 60)), T0, 'et', tz), 'eile 20:24');
  assert.equal(V.rowLast(row('x', null), T0, 'et', tz), 'üle 24 h');
  assert.equal(V.rowLast(row('x', null), T0, 'en', tz), 'over 24 h');
});

test('Valve: the motion card draws loading, then the headline, the plan and a row per room that opens its history', () => {
  const conf = { plan: PLAN, groups: [{ name: 'Ühisruumid', rooms: [{ entity: 'binary_sensor.test_hall_motion', name: 'Eeskoda' }] }, { name: 'Toad', rooms: [{ entity: 'binary_sensor.demo_room_a_motion', name: 'Tuba 1' }] }], alarms: ALARM_CONF };
  const states = alarmStates('disarmed', min(60), { 'binary_sensor.test_hall_motion': { state: 'off' }, 'binary_sensor.demo_room_a_motion': { state: 'off' } });
  const hass = { config: { time_zone: 'Europe/Tallinn' } };
  assert.match(V.motionA3Markup(conf, states, null, T0, 'et', hass).html, /Laen…/);
  const m = V.motionA3Markup(conf, states, { 'binary_sensor.test_hall_motion': [min(4)] }, T0, 'et', hass);
  assert.match(m.html, /Viimane liikumine 4 min tagasi/);
  assert.match(m.html, /<svg class="plan"/);
  assert.match(m.html, /aria-label="Eeskoda, viimati 16:20, ajalugu"/);
  assert.match(m.html, /aria-label="Tuba 1, viimati üle 24 h, ajalugu"/);
  assert.deepEqual(m.sheets.get('r0').history, { entity: 'binary_sensor.test_hall_motion', source: 'history', counts: true });
  assert.equal(m.sheets.get('r0').unit, 'korda');
  assert.equal(m.sheets.get('r0').text(states), 'vaikne', 'a motion sensor is quiet, not off');
  assert.equal(m.sheets.get('r0').text({ 'binary_sensor.test_hall_motion': { state: 'on' } }), 'liikumine');
  assert.doesNotMatch(V.motionA3Markup({ ...conf, plan: undefined }, states, {}, T0, 'et', hass).html, /<svg class="plan"/, 'no slice, no plan, the rows stay');
});

test('Valve: the motion card split in two, the plan with its headline and the rows on their own', () => {
  const conf = { plan: PLAN, groups: [{ name: 'Ühisruumid', rooms: [{ entity: 'binary_sensor.test_hall_motion', name: 'Eeskoda' }] }], alarms: ALARM_CONF };
  const states = alarmStates('disarmed', min(60), { 'binary_sensor.test_hall_motion': { state: 'off' } });
  const hass = { config: { time_zone: 'Europe/Tallinn' } }, on = { 'binary_sensor.test_hall_motion': [min(4)] };
  const plan = V.motionA3Markup({ ...conf, part: 'plan' }, states, on, T0, 'et', hass).html;
  const rows = V.motionA3Markup({ ...conf, part: 'rows' }, states, on, T0, 'et', hass).html;
  assert.match(plan, /Viimane liikumine 4 min tagasi/);
  assert.match(plan, /<svg class="plan"/);
  assert.doesNotMatch(plan, /class="mr /);
  assert.doesNotMatch(rows, /<svg|Viimane liikumine/);
  assert.match(rows, /aria-label="Eeskoda, viimati 16:20, ajalugu"/);
});

test('Valve: a motion sheet counts the times a sensor fired, per hour over a day and per day over a week', () => {
  const tz = 'Europe/Tallinn', step = (pairs) => ({ kind: 'step', points: pairs.map(([m, v]) => ({ t: min(m), v })) });
  const day = V.countSeries(step([[30 * 60, false], [125, true], [124, false], [64, true], [63, false], [61, true], [60, null], [59, true], [58, false]]), '24h', T0, tz);
  assert.equal(day.kind, 'bars');
  assert.equal(day.points.length, 24);
  assert.equal(day.points.reduce((a, p) => a + p.v, 0), 3, 'off to on only, an unavailable gap between two on states is none');
  assert.ok(day.points.every((p, i) => !i || p.t - day.points[i - 1].t === 3600e3));
  const week = V.countSeries(step([[9 * 24 * 60, false], [8 * 24 * 60, true], [2 * 24 * 60, false], [2 * 24 * 60 - 1, true]]), '7d', T0, tz);
  assert.equal(week.points.length, 7);
  assert.equal(week.points.reduce((a, p) => a + p.v, 0), 1, 'a firing before the week is out');
});

test('Valve: a wall is drawn in pieces between its door openings, at least a hairline thick', () => {
  const box = [0, 0, 10, 10];
  const one = V.wallPieces({ a: [0, 0], b: [4, 0], t: 0.2, doors: [] }, box);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].map(p => p.map(v => +v.toFixed(2))), [[-0.1, 0.1], [4.1, 0.1], [4.1, -0.1], [-0.1, -0.1]], 'carried on by half its thickness at each end');
  const cut = V.wallPieces({ a: [0, 0], b: [4, 0], t: 0.2, doors: [[3, 1], [1, 0.8]] }, box);
  assert.deepEqual(cut.map(q => [+q[0][0].toFixed(2), +q[1][0].toFixed(2)]), [[-0.1, 0.6], [1.4, 2.5], [3.5, 4.1]], 'two openings, in any order, leave three pieces');
  assert.equal(V.wallPieces({ a: [0, 0], b: [4, 0], t: 0.2, doors: [[0.4, 1]] }, box).length, 1, 'an opening at the end leaves one piece');
  assert.ok(Math.abs(V.wallPieces({ a: [0, 0], b: [0, 4], t: 0.02 }, box, 0.1)[0][0][0]) > 0.04, 'a thin wall drawn at the least thickness');
  assert.equal(V.wallPieces({ a: [20, 20], b: [24, 20], t: 0.2 }, box), null, 'an outbuilding wall is left out');
});

test('Valve: the footprint grows each nearby room by half a wall, so walls and the garage close into one shape', () => {
  const plan = { rooms: [{ id: 'a', rects: [[0, 0, 3, 5]] }, { id: 'b', rects: [[3.6, 0, 8, 5]] }, { id: 'far', rects: [[20, 20, 24, 24]] }] };
  const box = [0, 0, 8, 5];
  const out = V.houseRects(plan, box);
  assert.equal(out.length, 2, 'a room well outside the box is left out');
  assert.ok(out[0][2] >= out[1][0], 'a 0.6 m wall between two rooms closes');
  assert.deepEqual(out[0].slice(0, 2), [0, 0], 'clipped to the box');
  const svg = V.planSvg(PLAN, [], T0, { dark: false, text: '#000', sub: '#666' }).svg;
  assert.ok(svg.startsWith('<svg class="plan"'));
});

test('Valve: the status by state over two partitions, first match wins, faults over all', () => {
  const alarms = ['alarm_control_panel.maja', 'alarm_control_panel.garaaz'];
  const map = [
    { entities: alarms, state: 'triggered', text: 'Häire', tone: 'bad' },
    { entities: alarms, state: 'pending', text: 'Sisenemise viivitus', tone: 'bad' },
    { entities: alarms, state: 'arming', text: 'Valvesse minek', tone: 'info' },
    { entities: alarms, state: 'armed_*', text: 'Valves', tone: 'info' },
    { entities: alarms, state: 'disarmed', text: 'Valvest maas', tone: 'ok' }
  ];
  const conf = { status: { map }, faults: [{ entity: 'binary_sensor.smoke', name: 'Tulekahju' }] };
  const s = (m, g, smoke = 'off') => V.statusLine({ 'alarm_control_panel.maja': st(m), 'alarm_control_panel.garaaz': st(g), 'binary_sensor.smoke': st(smoke) }, conf);
  assert.deepEqual(s('disarmed', 'disarmed'), { tone: 'ok', text: 'Valvest maas' });
  assert.deepEqual(s('disarmed', 'armed_away'), { tone: 'on', text: 'Valves' });
  assert.deepEqual(s('arming', 'armed_night'), { tone: 'on', text: 'Valvesse minek' });
  assert.deepEqual(s('armed_home', 'triggered'), { tone: 'bad', text: 'Häire' });
  assert.deepEqual(s('pending', 'disarmed'), { tone: 'bad', text: 'Sisenemise viivitus' });
  assert.deepEqual(s('unavailable', 'unavailable'), { tone: 'off', text: 'Seisund pole teada' });
  assert.deepEqual(s('disarmed', 'disarmed', 'on'), { tone: 'bad', text: 'Viga' });
  assert.equal(V.stateIs('armed_away', 'armed_*'), true);
  assert.equal(V.stateIs('offline', '!online'), true);
  assert.equal(V.stateIs('online', '!online'), false);
});

test("Valve: an alarm's modes open HA's dialog, the current one marked in its colour, none pressed", () => {
  const conf = {
    entity: 'alarm_control_panel.maja', name: 'Maja', wide: true,
    modes: [
      { name: 'Eemal', option: 'armed_away', tap_action: { action: 'more-info' }, color: 'teal' },
      { name: 'Maas', option: 'disarmed', tap_action: { action: 'more-info' } }
    ]
  };
  const { html, actions } = V.tileA3Markup(conf, { 'alarm_control_panel.maja': st('armed_away') });
  assert.match(html, /data-k="m0" aria-current="true" aria-haspopup="dialog" style="background:#30b0c7;color:#fff">Eemal/);
  assert.match(html, /data-k="m1" aria-haspopup="dialog">Maas/);
  assert.doesNotMatch(html, /aria-pressed/);
  assert.deepEqual(actions.get('m1'), { config: { entity: 'alarm_control_panel.maja', tap_action: { action: 'more-info' } }, action: 'tap' });
  assert.deepEqual(actions.get('m0'), actions.get('m1'), 'the running mode opens the dialog too');
});

test('Valve: a cell says its state in its own words, red by its rules, a note of another entity or its last opening', () => {
  const door = { entity: 'binary_sensor.door', name: 'Peauks', words: { off: 'kinni', on: 'lahti' }, note: { last_on: true, label: 'avati' },
    bad_if: [[{ entity: 'binary_sensor.door', state: 'on' }, { entity: 'alarm_control_panel.maja', state: 'armed_*' }], [{ state: 'on' }, { entity: 'alarm_control_panel.garaaz', state: 'armed_*' }]] };
  const s = (d, m, g = 'disarmed') => ({ 'binary_sensor.door': st(d), 'alarm_control_panel.maja': st(m), 'alarm_control_panel.garaaz': st(g) });
  assert.equal(V.cellValue(door, s('off', 'disarmed')), 'kinni');
  assert.equal(V.cellValue(door, s('on', 'disarmed'), 'et'), 'lahti');
  assert.equal(V.cellTone(door, s('on', 'disarmed')), '', 'open while disarmed');
  assert.equal(V.cellTone(door, s('on', 'armed_home')), 'bad');
  assert.equal(V.cellTone(door, s('on', 'disarmed', 'armed_away')), 'bad', 'the second rule, its entity the cell own');
  assert.equal(V.cellTone(door, s('off', 'armed_home')), '');
  const tz = 'Europe/Tallinn', ctx = t => ({ lastOn: () => t, now: T0, tz });
  assert.equal(V.cellNote(door, {}, 'et', ctx(min(13))), 'avati 16:11');
  assert.equal(V.cellNote(door, {}, 'et', ctx(min(20 * 60))), 'avati eile 20:24');
  assert.equal(V.cellNote(door, {}, 'et', ctx(null)), 'üle 24 h');
  assert.equal(V.cellNote(door, {}, 'et', { lastOn: () => undefined }), '', 'nothing before the history loads');
  const aku = { entity: 'sensor.aku', name: 'Aku', decimals: 1, note: { entity: 'sensor.toide', label: 'toide', decimals: 1 } };
  const volts = { 'sensor.aku': st('13.8', { unit_of_measurement: 'V' }), 'sensor.toide': st('13.1', { unit_of_measurement: 'V' }) };
  assert.equal(V.cellValue(aku, volts), '13,8 V');
  assert.equal(V.cellNote(aku, volts), 'toide 13,1 V');
  assert.equal(V.cellNote(aku, { 'sensor.toide': st('unavailable') }), '');
  const link = { entity: 'binary_sensor.link', words: { on: 'olemas', off: 'katkes' }, good: ['on'], bad_if: [[{ state: 'off' }], [{ entity: 'sensor.raw', state: '!online' }]] };
  assert.equal(V.cellTone(link, { 'binary_sensor.link': st('on'), 'sensor.raw': st('online') }), 'good');
  assert.equal(V.cellTone(link, { 'binary_sensor.link': st('on'), 'sensor.raw': st('offline') }), 'bad');
  assert.equal(V.cellValue({ entity: 'binary_sensor.siren', words: { off: 'korras' } }, { 'binary_sensor.siren': st('unavailable') }), 'pole saadaval');
  const sheet = V.cellSheet(door, s('on', 'disarmed'), 'et');
  assert.equal(sheet.text(s('off', 'disarmed')), 'kinni', 'the sheet says it in the same words');
});

test('Valve: a reading card of cells alone draws no big value, its cells with their last opening, and the note under them', () => {
  const conf = {
    cells: [{ entity: 'binary_sensor.door', name: 'Peauks', words: { off: 'kinni', on: 'lahti' }, note: { last_on: true, label: 'avati' }, bad_if: [[{ state: 'on' }, { entity: 'alarm_control_panel.maja', state: 'armed_*' }]], history: { source: 'history' } },
      { entity: 'sensor.aku', name: 'Aku', decimals: 1 }],
    note: { text: 'Teavitus tuleb tulekahjust.' }
  };
  const states = { 'binary_sensor.door': st('on'), 'alarm_control_panel.maja': st('armed_away'), 'sensor.aku': st('13.8', { unit_of_measurement: 'V' }) };
  const hass = { config: { time_zone: 'Europe/Tallinn' } };
  const loading = V.readingA3Markup(conf, states, null, 'et', hass);
  assert.deepEqual(loading.history, ['binary_sensor.door'], 'only the last_on cell reads history');
  assert.doesNotMatch(loading.html, /class="hd"/);
  assert.match(loading.html, /<span class="v num bad">lahti<\/span><span class="sub"><\/span>/, 'red while open and armed, no note before the load');
  const now = Date.now(), d = { res: { hist: { 'binary_sensor.door': [now - 5 * 60e3] } }, now, tz: 'Europe/Tallinn' };
  const m = V.readingA3Markup(conf, states, d, 'et', hass);
  assert.match(m.html, /<span class="sub">avati \d\d:\d\d<\/span>/);
  assert.match(m.html, /13,8 V/);
  assert.match(m.html, /<span class="hr"><\/span><span class="sub">Teavitus tuleb tulekahjust\.<\/span><\/div>$/);
  assert.equal(m.sheets.get('c0').text(states), 'lahti');
  assert.match(V.readingA3Markup(conf, states, { res: { hist: { 'binary_sensor.door': [] } }, now }, 'en', hass).html, /over 24 h/);
});

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
