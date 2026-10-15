// The house3d card on the made-up test house, fed by a simulated hass instead of Home Assistant.
// A tap on a marker or a room sheet row opens a more-info dialog like HA's, whose controls change
// the simulated states. Devices come from model.json by domain and type, so this file names no
// entity and works for any model.
import './house3d-card.js?v=__HOUSE3D_VERSION__';

const card = document.querySelector('house3d-card');
const dialog = document.querySelector('dialog.info');
const carButton = document.querySelector('[data-act="car"]');
const nf1 = new Intl.NumberFormat('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 });
const rtf = new Intl.RelativeTimeFormat('et-EE', { numeric: 'auto' });
const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const domainOf = entity => entity.split('.')[0];

let model;
try {
  model = await (await fetch('./model.json')).json();
} catch (e) {
  card.outerHTML = '<div class="fallback">Mudeli laadimine ebaõnnestus.</div>';
  throw e;
}

const list = model.devices || [];
const byEntity = new Map(list.map(d => [d.entity, d]));
const roomName = id => (id === 'oues' ? 'Õues' : ((model.rooms || []).find(r => r.id === id) || {}).name || '');
const carEntity = model.car && model.car.entity;

// a starting state per domain, varied by position in the list so the house is not all off
function initial(d, i) {
  const temp = d.room === 'oues' ? 7.5 : 20.6 + (i % 4) * 0.4;
  switch (domainOf(d.entity)) {
    case 'light': return i % 2 ? ['off', {}] : ['on', { brightness: 200 }];
    case 'sensor': return [temp.toFixed(1), { unit_of_measurement: '°C', device_class: 'temperature' }];
    case 'binary_sensor': return ['off', { device_class: d.type === 'door' ? 'door' : d.type }];
    case 'switch': case 'input_boolean': return [i % 2 ? 'off' : 'on', {}];
    case 'fan': return ['on', { percentage: 40 }];
    case 'cover': return i % 2 ? ['closed', {}] : ['open', { current_position: 100 }];
    case 'climate': return ['heat', { hvac_modes: ['off', 'heat'], current_temperature: 20.8 + (i % 3) * 0.4, temperature: 21, min_temp: 5, max_temp: 30 }];
    case 'water_heater': return ['eco', { current_temperature: 48, temperature: 50, min_temp: 40, max_temp: 65 }];
    case 'alarm_control_panel': return ['disarmed', {}];
    case 'camera': return ['idle', {}];
    default: return ['off', {}];
  }
}

// HA-shaped state objects; the card compares them by identity, so every change makes a new one
const now = () => new Date().toISOString();
let states = {};
list.forEach((d, i) => {
  const [state, attributes] = initial(d, i);
  states[d.entity] = { entity_id: d.entity, state, attributes: { friendly_name: d.name, ...attributes }, last_changed: now(), last_updated: now() };
});
if (carEntity) states[carEntity] = { entity_id: carEntity, state: 'not_home', attributes: { arrived_at: null }, last_changed: now(), last_updated: now() };

const TEXT = {
  on: 'Sees', off: 'Väljas', idle: 'Ootel', home: 'Kodus', not_home: 'Eemal',
  open: 'Avatud', closed: 'Suletud', opening: 'Avaneb', closing: 'Sulgub',
  heat: 'Küte', eco: 'Säästlik', performance: 'Jõudlus',
  disarmed: 'Valvest maas', armed_home: 'Valves (kodus)', armed_away: 'Valves (eemal)', triggered: 'Häire!'
};
const BINARY = { door: ['Suletud', 'Avatud'], motion: ['Vaikne', 'Liikumine'], smoke: ['Korras', 'Suits!'] };

function formatEntityState(st) {
  const a = st.attributes || {};
  if (domainOf(st.entity_id) === 'binary_sensor' && BINARY[a.device_class]) return BINARY[a.device_class][st.state === 'on' ? 1 : 0];
  const n = Number(st.state);
  if (a.unit_of_measurement && st.state !== '' && Number.isFinite(n)) return `${nf1.format(n)} ${a.unit_of_measurement}`;
  if (domainOf(st.entity_id) === 'light' && st.state === 'on' && a.brightness) return `Sees, ${nf0.format(a.brightness / 2.55)}%`;
  return TEXT[st.state] || st.state;
}

function publish() {
  card.hass = { states, config: { latitude: 58.6, longitude: 25.0 }, formatEntityState };
  carButton.hidden = !carEntity;
  if (carEntity) carButton.textContent = states[carEntity].state === 'home' ? 'Auto lahkub' : 'Auto saabub';
  if (dialog.open) renderInfo();
}

// last_changed moves only when the state does, as in HA
function set(entity, state, attrs = {}) {
  const old = states[entity];
  const changed = old.state !== state;
  states = { ...states, [entity]: { ...old, state, attributes: { ...old.attributes, ...attrs }, last_changed: changed ? now() : old.last_changed, last_updated: now() } };
  publish();
}

const timers = new Map();
function later(entity, ms, fn) {
  clearTimeout(timers.get(entity));
  timers.set(entity, setTimeout(fn, ms));
}

/* ---------- more-info dialog ---------- */

let openEntity = null;

function ago(iso) {
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (s > -45) return 'just praegu';
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute');
  return rtf.format(Math.round(s / 3600), 'hour');
}

const btn = (act, label, extra = '') => `<button type="button" data-do="${act}" ${extra}>${esc(label)}</button>`;
const toggle = on => `<button type="button" class="big-toggle" data-do="toggle" role="switch" aria-checked="${on}">
  <span>${on ? 'Sees' : 'Väljas'}</span><span class="sw" aria-hidden="true"></span></button>`;
const stepper = (label, value) => `<div class="stepper" role="group" aria-label="${esc(label)}">
  ${btn('down', '−', `aria-label="${esc(label)} alla"`)}<output>${value}</output>${btn('up', '+', `aria-label="${esc(label)} üles"`)}</div>`;
const slider = (label, value, min, max) => `<label class="slider"><span>${esc(label)}</span>
  <input type="range" data-do="level" min="${min}" max="${max}" value="${value}"><output>${nf0.format(value)}%</output></label>`;

function controls(d, st) {
  const a = st.attributes, s = st.state;
  switch (domainOf(d.entity)) {
    case 'light':
      return toggle(s === 'on') + (s === 'on' ? slider('Heledus', Math.round((a.brightness || 255) / 2.55), 1, 100) : '');
    case 'switch': case 'input_boolean':
      return toggle(s === 'on');
    case 'fan':
      return toggle(s === 'on') + (s === 'on' ? slider('Kiirus', a.percentage || 40, 10, 100) : '');
    case 'cover':
      return `<div class="row">${btn('open', 'Ava', s === 'open' || s === 'opening' ? 'disabled' : '')}${btn('stop', 'Peata', s === 'opening' || s === 'closing' ? '' : 'disabled')}${btn('close', 'Sulge', s === 'closed' || s === 'closing' ? 'disabled' : '')}</div>`
        + ('current_position' in a ? '' : '<p class="note">See seade asendit ei teata, nii et olek on viimane käsk.</p>');
    case 'climate':
      return `<div class="row seg" role="group" aria-label="Režiim">${(a.hvac_modes || ['off', 'heat']).map(m => btn(`mode:${m}`, TEXT[m] || m, `aria-pressed="${s === m}"`)).join('')}</div>`
        + (s === 'off' ? '' : stepper('Sihttemperatuur', `${nf1.format(a.temperature)} °C`))
        + `<p class="note">Praegu ${nf1.format(a.current_temperature)} °C</p>`;
    case 'water_heater':
      return stepper('Sihttemperatuur', `${nf0.format(a.temperature)} °C`) + `<p class="note">Vesi praegu ${nf0.format(a.current_temperature)} °C</p>`;
    case 'alarm_control_panel':
      return `<div class="row wrap">${btn('arm_home', 'Valvesta kodus', `aria-pressed="${s === 'armed_home'}"`)}${btn('arm_away', 'Valvesta eemal', `aria-pressed="${s === 'armed_away'}"`)}${btn('disarm', 'Võta valvest maha', `aria-pressed="${s === 'disarmed'}"`)}</div>`
        + (s === 'disarmed' ? '' : `<div class="row">${btn('trigger', 'Testhäire', s === 'triggered' ? 'disabled' : '')}</div>`);
    case 'binary_sensor':
      if (a.device_class === 'door') return `<div class="row">${btn('flip', s === 'on' ? 'Sulge uks' : 'Ava uks')}</div><p class="note">Simulatsioon: päris majas muudab seda andur.</p>`;
      if (a.device_class === 'motion') return `<div class="row">${btn('pulse', 'Simuleeri liikumist', s === 'on' ? 'disabled' : '')}</div>`;
      return `<div class="row">${s === 'on' ? btn('flip', 'Lähtesta') : btn('flip', 'Testi andurit')}</div>`;
    case 'sensor':
      return `<div class="row">${btn('down', 'Jahedamaks')}${btn('up', 'Soojemaks')}</div><p class="note">Simulatsioon: päris majas tuleb väärtus andurilt.</p>`;
    case 'camera':
      return `<div class="cam" role="img" aria-label="Kaamerapildi asemik"><span>Kaamerapilt</span></div><p class="note">Päris majas näitab Home Assistant siin otsepilti. 3D-vaates on kaamera vaatesektor.</p>`;
    default:
      return '';
  }
}

function renderInfo() {
  const d = byEntity.get(openEntity), st = states[openEntity];
  if (!d || !st) return dialog.close();
  dialog.querySelector('.state').textContent = formatEntityState(st);
  dialog.querySelector('.when').textContent = `Muudetud ${ago(st.last_changed)}`;
  // a slider in use keeps its element; any other control is rebuilt and gets its focus back
  const focused = dialog.querySelector('.controls').contains(document.activeElement) ? document.activeElement : null;
  if (focused && focused.type === 'range') return;
  dialog.querySelector('.controls').innerHTML = controls(d, st);
  const again = focused && dialog.querySelector(`.controls [data-do="${focused.dataset.do}"]`);
  if (again && !again.disabled) again.focus();
}

function openInfo(entity) {
  const d = byEntity.get(entity);
  if (!d) return;
  openEntity = entity;
  dialog.querySelector('h2').textContent = d.name;
  dialog.querySelector('.room').textContent = roomName(d.room);
  renderInfo();
  if (!dialog.open) dialog.showModal();
}
setInterval(() => {
  if (dialog.open && states[openEntity]) dialog.querySelector('.when').textContent = `Muudetud ${ago(states[openEntity].last_changed)}`;
}, 30000);

function act(what, value) {
  const e = openEntity, st = states[e], a = st.attributes, dom = domainOf(e);
  if (what === 'toggle') {
    const on = st.state !== 'on';
    if (dom === 'light') return set(e, on ? 'on' : 'off', on ? { brightness: a.brightness || 255 } : {});
    return set(e, on ? 'on' : 'off');
  }
  if (what === 'level') {
    if (dom === 'light') return set(e, 'on', { brightness: Math.round(value * 2.55) });
    return set(e, 'on', { percentage: Number(value) });
  }
  if (what === 'open' || what === 'close') {
    const [moving, done, pos] = what === 'open' ? ['opening', 'open', 100] : ['closing', 'closed', 0];
    set(e, moving);
    return later(e, 1800, () => set(e, done, 'current_position' in a ? { current_position: pos } : {}));
  }
  if (what === 'stop') { clearTimeout(timers.get(e)); return set(e, 'open', 'current_position' in a ? { current_position: 50 } : {}); }
  if (what.startsWith('mode:')) return set(e, what.slice(5));
  if (what === 'up' || what === 'down') {
    const sign = what === 'up' ? 1 : -1;
    if (dom === 'sensor') return set(e, (Math.round((Number(st.state) + sign * 0.5) * 10) / 10).toFixed(1));
    const step = dom === 'water_heater' ? 1 : 0.5;
    const t = Math.min(a.max_temp, Math.max(a.min_temp, a.temperature + sign * step));
    return set(e, st.state, { temperature: t });
  }
  if (what === 'arm_home') return set(e, 'armed_home');
  if (what === 'arm_away') return set(e, 'armed_away');
  if (what === 'disarm') return set(e, 'disarmed');
  if (what === 'trigger') return set(e, 'triggered');
  if (what === 'flip') return set(e, st.state === 'on' ? 'off' : 'on');
  if (what === 'pulse') { set(e, 'on'); return later(e, 4000, () => set(e, 'off')); }
}

dialog.addEventListener('click', ev => {
  // the backdrop's taps land on the dialog element too, but outside its box
  const r = dialog.getBoundingClientRect();
  if (ev.target === dialog && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)) return dialog.close();
  const b = ev.target.closest('button[data-do]');
  if (b && !b.disabled) act(b.dataset.do);
  if (ev.target.closest('[data-act="close"]')) dialog.close();
});
dialog.addEventListener('input', ev => {
  const r = ev.target.closest('input[data-do="level"]');
  if (!r) return;
  r.nextElementSibling.textContent = `${nf0.format(r.value)}%`;
  act('level', Number(r.value));
});

// what HA's frontend does with the card's taps
card.addEventListener('hass-more-info', ev => openInfo(ev.detail && ev.detail.entityId));

carButton.addEventListener('click', () => {
  const home = states[carEntity].state === 'home';
  set(carEntity, home ? 'not_home' : 'home', { arrived_at: home ? null : now() });
});

card.setConfig({ model });
publish();
