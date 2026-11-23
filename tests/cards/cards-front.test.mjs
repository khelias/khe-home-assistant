// Tests of front-page card helpers (sentence, chips, price bars, tiles, palette) and languages (ADR-012).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { cards as A3, st, FAULTS, ALARMS, PEOPLE, CONF, calm } from './cards-harness.mjs';

const { sentence, chips, securityText, peopleText, priceBars, priceLevel, tileState, tileActive, tileAction, modeAction, palette, joinEt, formatNumber, stateWord } = A3;

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
  const cardsDir = new URL('../../cards/', import.meta.url);
  const partsDir = new URL('../../cards/parts/', import.meta.url);
  const files = [
    ['khe-cards.js', new URL('khe-cards.js', cardsDir)],
    ...readdirSync(partsDir).filter(f => f.endsWith('.js')).sort().map(f => [`parts/${f}`, new URL(f, partsDir)])
  ];
  const leaks = [];
  for (const [label, url] of files) {
    let src = readFileSync(url, 'utf8');
    if (label === 'parts/i18n.js') src = src.replace(/const ET(_SENSOR)? = \{[\s\S]*?\n\};/g, '');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, ''));
    for (const l of code) {
      if (/[õäöüšž]/i.test(l)) leaks.push(`${label}: ${l.trim()}`);
    }
  }
  assert.deepEqual(leaks, []);
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

