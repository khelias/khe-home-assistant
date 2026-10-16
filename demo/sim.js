// The demo's stand-in for Home Assistant: the states from states.json as HA state objects and
// the services the dashboard calls, acting on them as HA's integrations would, closely enough to
// see a tap land. No DOM and no imports, so the tests run it in Node.

const domainOf = entity => entity.split('.')[0];
const TOGGLES = new Set(['light', 'switch', 'fan', 'input_boolean', 'cover', 'media_player', 'script']);

export const canToggle = entity => TOGGLES.has(domainOf(entity));

// data: { states: { entity: { state, attributes, ago? } }, mirrors: { target: { from, map } } }
export function createSim(data, { now = () => new Date(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const iso = (d = now()) => d.toISOString();
  const states = {};
  for (const [e, s] of Object.entries(data.states || {})) {
    const at = iso(new Date(now().getTime() - (s.ago || 0) * 60000));
    states[e] = { entity_id: e, state: s.state, attributes: { ...s.attributes }, last_changed: at, last_updated: at };
  }
  const mirrors = data.mirrors || {};
  const listeners = new Set();
  const timers = new Map();
  const api = { states, set, callService, toggle, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };

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

  const clamp = (st, v) => {
    const a = st.attributes, step = a.step || 1;
    const n = Math.round(Math.min(a.max ?? Infinity, Math.max(a.min ?? -Infinity, v)) / step) * step;
    return String(Number(n.toFixed(4)));
  };

  // the services the dashboard and the dialogs use; anything else is an error, as HA's would be
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
    for (const e of ids) {
      const st = api.states[e];
      if (!st) throw new Error(`no entity ${e}`);
      const d = domainOf(e);
      switch (`${domain}.${service}`) {
        case 'homeassistant.toggle': case `${d}.toggle`: toggle(e); break;
        case 'homeassistant.turn_on': case `${d}.turn_on`:
          if (d === 'light' && data.brightness_pct !== undefined) set(e, 'on', { brightness: Math.round(data.brightness_pct * 2.55) });
          else if (d === 'fan' && data.percentage !== undefined) set(e, 'on', { percentage: data.percentage });
          else if (st.state === 'off' || st.state === 'idle') toggle(e);
          break;
        case 'homeassistant.turn_off': case `${d}.turn_off`:
          if (st.state !== 'off') set(e, 'off');
          break;
        case 'fan.set_percentage': set(e, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage }); break;
        case 'cover.open_cover': cover(e, 'open'); break;
        case 'cover.close_cover': cover(e, 'close'); break;
        case 'cover.stop_cover': cover(e, 'stop'); break;
        case 'select.select_option': case 'input_select.select_option':
          if (!(st.attributes.options || []).includes(data.option)) throw new Error(`${e}: no option ${data.option}`);
          set(e, data.option);
          break;
        case 'number.set_value': case 'input_number.set_value': set(e, clamp(st, Number(data.value))); break;
        case 'water_heater.set_operation_mode': set(e, data.operation_mode); break;
        case 'water_heater.set_temperature': case 'climate.set_temperature':
          set(e, st.state, { temperature: Math.min(st.attributes.max_temp, Math.max(st.attributes.min_temp, Number(data.temperature))) });
          break;
        case 'climate.set_hvac_mode': set(e, data.hvac_mode); break;
        case 'alarm_control_panel.alarm_arm_away': set(e, 'armed_away'); break;
        case 'alarm_control_panel.alarm_arm_home': set(e, 'armed_home'); break;
        case 'alarm_control_panel.alarm_arm_night': set(e, 'armed_night'); break;
        case 'alarm_control_panel.alarm_disarm': set(e, 'disarmed'); break;
        case 'alarm_control_panel.alarm_trigger': set(e, 'triggered'); break;
        case 'button.press': set(e, iso()); break;
        case 'update.install': set(e, 'off', { installed_version: st.attributes.latest_version }); break;
        case 'device_tracker.see': set(e, data.location_name, data.attributes || {}); break;
        default: throw new Error(`no service ${domain}.${service}`);
      }
    }
  }

  return api;
}
