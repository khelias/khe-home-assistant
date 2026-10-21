// The demo's stand-in for Home Assistant: the states from states.json as HA state objects and
// the services the dashboard calls, acting on them as HA's integrations would, closely enough to
// see a tap land. No DOM and no imports, so the tests run it in Node.

const domainOf = entity => entity.split('.')[0];
const TOGGLES = new Set(['light', 'switch', 'fan', 'input_boolean', 'cover', 'media_player', 'script']);

export const canToggle = entity => TOGGLES.has(domainOf(entity));

const clamp = (st, v) => {
  const a = st.attributes, step = a.step || 1;
  const n = Math.round(Math.min(a.max ?? Infinity, Math.max(a.min ?? -Infinity, v)) / step) * step;
  return String(Number(n.toFixed(4)));
};

// the services the dashboard, the dialogs and the scenarios use, each acting on one entity through
// the sim's own set, toggle and cover; anything else is an error, as HA's would be
const TURN = {
  toggle: ({ e, toggle }) => toggle(e),
  turn_on: ({ e, st, d, data, set, toggle }) => {
    if (d === 'light' && data.brightness_pct !== undefined) set(e, 'on', { brightness: Math.round(data.brightness_pct * 2.55) });
    else if (d === 'fan' && data.percentage !== undefined) set(e, 'on', { percentage: data.percentage });
    else if (st.state === 'off' || st.state === 'idle') toggle(e);
  },
  turn_off: ({ e, st, set }) => { if (st.state !== 'off') set(e, 'off'); }
};
const option = ({ e, st, data, set }) => {
  if (!(st.attributes.options || []).includes(data.option)) throw new Error(`${e}: no option ${data.option}`);
  set(e, data.option);
};
const value = ({ e, st, data, set }) => set(e, clamp(st, Number(data.value)));
const temperature = ({ e, st, data, set }) => set(e, st.state, { temperature: Math.min(st.attributes.max_temp, Math.max(st.attributes.min_temp, Number(data.temperature))) });
const to = state => ({ e, set }) => set(e, state);
const HANDLERS = {
  ...Object.fromEntries(['homeassistant', ...[...TOGGLES].filter(d => d !== 'script')].flatMap(d => Object.entries(TURN).map(([s, fn]) => [`${d}.${s}`, fn]))),
  'fan.set_percentage': ({ e, data, set }) => set(e, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage }),
  'cover.open_cover': ({ e, cover }) => cover(e, 'open'),
  'cover.close_cover': ({ e, cover }) => cover(e, 'close'),
  'cover.stop_cover': ({ e, cover }) => cover(e, 'stop'),
  'select.select_option': option,
  'input_select.select_option': option,
  'number.set_value': value,
  'input_number.set_value': value,
  'input_datetime.set_datetime': ({ e, data, set }) => set(e, data.datetime),
  'water_heater.set_operation_mode': ({ e, data, set }) => set(e, data.operation_mode),
  'water_heater.set_temperature': temperature,
  'climate.set_temperature': temperature,
  'climate.set_hvac_mode': ({ e, data, set }) => set(e, data.hvac_mode),
  'alarm_control_panel.alarm_arm_away': to('armed_away'),
  'alarm_control_panel.alarm_arm_home': to('armed_home'),
  'alarm_control_panel.alarm_arm_night': to('armed_night'),
  'alarm_control_panel.alarm_disarm': to('disarmed'),
  'alarm_control_panel.alarm_trigger': to('triggered'),
  'button.press': ({ e, set, iso }) => set(e, iso()),
  'update.install': ({ e, st, set }) => set(e, 'off', { installed_version: st.attributes.latest_version }),
  'device_tracker.see': ({ e, data, set }) => set(e, data.location_name, data.attributes || {})
};

// every domain.service callService accepts; a script runs by any name
export const SERVICES = new Set(Object.keys(HANDLERS));

// data: { states: { entity: { state, attributes, ago? } }, mirrors: { target: { from, map } } }
export function createSim(data, { now = () => new Date(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const iso = (d = now()) => d.toISOString();
  // the starting states, each override's state, attributes and ago laid over its entity's
  const initial = (start = {}) => Object.fromEntries(Object.entries(data.states || {}).map(([e, s0]) => {
    const o = start[e] || {};
    const s = { ...s0, ...o, attributes: { ...s0.attributes, ...o.attributes } };
    const at = iso(new Date(now().getTime() - (s.ago || 0) * 60000));
    return [e, { entity_id: e, state: s.state, attributes: s.attributes, last_changed: at, last_updated: at }];
  }));
  const mirrors = data.mirrors || {};
  const listeners = new Set();
  const timers = new Map();
  const api = { states: initial(), set, callService, toggle, reset, pulse, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };

  // HA-shaped: a change makes a new state object and a new states map, so cards compare by
  // identity; last_changed moves only when the state does
  function set(entity, state, attrs = {}) {
    const old = api.states[entity] || { entity_id: entity, state: 'unknown', attributes: {}, last_changed: iso() };
    const next = { ...old, state: String(state), attributes: { ...old.attributes, ...attrs }, last_changed: old.state !== String(state) ? iso() : old.last_changed, last_updated: iso() };
    api.states = { ...api.states, [entity]: next };
    for (const [target, m] of Object.entries(mirrors)) {
      if (m.from === entity && next.state in m.map && api.states[target]) {
        const t = api.states[target];
        api.states = { ...api.states, [target]: { ...t, state: m.map[next.state], last_changed: t.state !== m.map[next.state] ? iso() : t.last_changed, last_updated: iso() } };
      }
    }
    listeners.forEach(fn => fn(api.states));
  }

  function later(entity, ms, fn) {
    cancel(timers.get(entity));
    timers.set(entity, schedule(fn, ms));
  }

  // back to the starting states with start's overrides; a cover or script still moving and a
  // pending pulse stop where they are
  function reset(start = {}) {
    timers.forEach(id => cancel(id));
    timers.clear();
    api.states = initial(start);
    listeners.forEach(fn => fn(api.states));
  }

  // a motion sensor sees something for ms
  function pulse(e, ms) {
    set(e, 'on');
    later(e, ms, () => set(e, 'off'));
  }

  function cover(e, what) {
    const a = api.states[e].attributes;
    const pos = 'current_position' in a;
    // a stop halfway leaves it open; a cover at rest stays as it is
    if (what === 'stop') {
      cancel(timers.get(e));
      const s = api.states[e].state;
      return s === 'opening' || s === 'closing' ? set(e, 'open', pos ? { current_position: 50 } : {}) : undefined;
    }
    const [moving, done, p] = what === 'open' ? ['opening', 'open', 100] : ['closing', 'closed', 0];
    set(e, moving);
    later(e, 1800, () => set(e, done, pos ? { current_position: p } : {}));
  }

  function toggle(e) {
    const st = api.states[e];
    if (!st) return;
    const d = domainOf(e);
    if (d === 'cover') return cover(e, st.state === 'closed' || st.state === 'closing' ? 'open' : 'close');
    if (d === 'script') return callService('script', e.split('.')[1]);
    const on = st.state === 'off' || st.state === 'idle' || st.state === 'standby';
    if (d === 'light') return set(e, on ? 'on' : 'off', on ? { brightness: st.attributes.brightness || 255 } : {});
    if (d === 'media_player') return set(e, on ? 'playing' : 'off');
    return set(e, on ? 'on' : 'off');
  }

  function callService(domain, service, data = {}, target = {}) {
    let ids = target.entity_id ?? data.entity_id ?? [];
    ids = Array.isArray(ids) ? ids : [ids];
    if (domain === 'script') {
      // a script runs for a moment and its entity shows it
      const e = `script.${service}`;
      set(e, 'on');
      later(e, 1500, () => set(e, 'off'));
      return;
    }
    const handler = HANDLERS[`${domain}.${service}`];
    if (!handler) throw new Error(`no service ${domain}.${service}`);
    for (const e of ids) {
      const st = api.states[e];
      if (!st) throw new Error(`no entity ${e}`);
      const d = domainOf(e);
      // a domain's own toggle or turn_on reaches only that domain's entities
      if (domain !== 'homeassistant' && service in TURN && domain !== d) throw new Error(`no service ${domain}.${service} for ${e}`);
      handler({ e, st, d, data, set, toggle, cover, iso });
    }
  }

  return api;
}
