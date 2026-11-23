// Shared setup and fixtures for tests/cards/cards-*.test.mjs.
// Node rereads TZ when set before loading the cards module (DST tests need Europe/Tallinn).
import { readFileSync } from 'node:fs';

process.env.TZ = 'Europe/Tallinn';

export const TZ = 'Europe/Tallinn';
export const NOW = Date.parse('2026-11-12T14:00:00Z');
export const iso = t => new Date(t).toISOString();
export const cards = await import('../../cards/khe-cards.js');
export const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8'));

export const st = (state, attributes = {}) => ({ state, attributes });
export const FAULTS = [
  { entity: 'binary_sensor.smoke', name: 'Tulekahju' },
  { entity: 'binary_sensor.boiler', name: 'Boileri viga' },
  { entity: 'binary_sensor.vent', name: 'Ventilatsiooni viga' },
  { entity: 'binary_sensor.fresh', name: 'Estfeedi andmed hilinevad', bad: 'off' }
];
export const ALARMS = [{ entity: 'alarm_control_panel.maja', name: 'Maja' }, { entity: 'alarm_control_panel.garaaz', name: 'Garaaž' }];
export const PEOPLE = [{ entity: 'person.mari', name: 'Mari' }, { entity: 'person.jaan', name: 'Jaan' }];
export const CONF = { faults: FAULTS, alarms: ALARMS, people: PEOPLE, price: 'sensor.level', climate: { temperature: 'sensor.t', humidity: 'sensor.h' }, energy_path: '/lovelace/energia' };
export const calm = (over = {}) => ({
  'binary_sensor.smoke': st('off'), 'binary_sensor.boiler': st('off'), 'binary_sensor.vent': st('off'), 'binary_sensor.fresh': st('on'),
  'alarm_control_panel.maja': st('disarmed'), 'alarm_control_panel.garaaz': st('armed_away'),
  'person.mari': st('home'), 'person.jaan': st('not_home'),
  'sensor.level': st('odav', { arvel: 8.8, hinnang: 'Odav päev, praegu alla keskmise' }),
  'sensor.t': st('21.4'), 'sensor.h': st('41'),
  ...over
});
