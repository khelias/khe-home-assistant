// A mock Home Assistant dashboard on the made-up test house: the 3D view (the real house3d card)
// and three sections views (demo/dashboard.js, drawn by demo/cards.js), all fed by one simulated
// hass instead of Home Assistant. Taps open a more-info dialog like HA's, whose controls change
// the simulated states. Devices come from model.json by domain and type, so this file names no
// entity and works for any model.
import './house3d-card.js?v=__HOUSE3D_VERSION__';
import { icon } from './house3d.js?v=__HOUSE3D_VERSION__';
import { buildViews } from './dashboard.js?v=__DEMO_VERSION__';
import { renderSections, shellIcon, stateColor, thermostat, modeButtons } from './cards.js?v=__DEMO_VERSION__';

const tabs = document.querySelector('.tabs');
const viewsEl = document.querySelector('.views');
const drawer = document.querySelector('dialog.drawer');
const dialog = document.querySelector('dialog.info');
const nf1 = new Intl.NumberFormat('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 });
const rtf = new Intl.RelativeTimeFormat('et-EE', { numeric: 'auto' });
const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const domainOf = entity => entity.split('.')[0];

document.querySelector('[data-act="menu"]').innerHTML = shellIcon('menu');
document.querySelectorAll('[data-act="close"].icon-button').forEach(b => { b.innerHTML = icon('close'); });
document.querySelector('.d-icon').outerHTML = shellIcon('home');

let model;
try {
  model = await (await fetch('./model.json')).json();
} catch (e) {
  viewsEl.innerHTML = '<div class="fallback">Mudeli laadimine ebaõnnestus.</div>';
  throw e;
}

const list = model.devices || [];
const byEntity = new Map(list.map(d => [d.entity, d]));
const roomName = id => (id === 'oues' ? 'Õu' : ((model.rooms || []).find(r => r.id === id) || {}).name || '');
const carEntity = model.car && model.car.entity;
const nameOf = e => (e === carEntity ? model.car.name || e : (byEntity.get(e) || {}).name || e);
const areaOf = e => (byEntity.has(e) ? roomName(byEntity.get(e).room) : '');
const iconOf = e => (e === carEntity ? shellIcon('car') : icon((byEntity.get(e) || {}).type));

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

// HA-shaped state objects; the cards compare them by identity, so every change makes a new one
const now = () => new Date().toISOString();
let states = {};
list.forEach((d, i) => {
  const [state, attributes] = initial(d, i);
  states[d.entity] = { entity_id: d.entity, state, attributes: { friendly_name: d.name, ...attributes }, last_changed: now(), last_updated: now() };
});
if (carEntity) states[carEntity] = { entity_id: carEntity, state: 'not_home', attributes: { friendly_name: nameOf(carEntity), arrived_at: null }, last_changed: now(), last_updated: now() };

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
  if (domainOf(st.entity_id) === 'water_heater') return `${TEXT[st.state] || st.state}, ${nf0.format(a.temperature)} °C`;
  return TEXT[st.state] || st.state;
}

/* ---------- views and routing ---------- */

const views = buildViews(model);
const panes = views.map(view => {
  const tab = document.createElement('a');
  tab.className = 'tab';
  tab.href = `#${view.path}`;
  tab.setAttribute('role', 'tab');
  tab.title = view.title;
  tab.setAttribute('aria-label', view.title);
  tab.innerHTML = shellIcon(view.icon);
  tabs.append(tab);
  const el = document.createElement('div');
  el.className = `view ${view.type}`;
  el.setAttribute('role', 'tabpanel');
  el.setAttribute('aria-label', view.title);
  el.hidden = true;
  viewsEl.append(el);
  return { view, tab, el, rendered: null };
});
let current = null;
let card = null;

const ctx = { nameOf, iconOf, format: formatEntityState, moreInfo: openInfo, act };

function hass() {
  return { states, config: { latitude: 58.6, longitude: 25.0 }, formatEntityState };
}

// the card is mounted on the 3D view's first show and kept, hidden, afterwards: its camera,
// style and Kihid state survive tab switches
function mountCard(el) {
  card = document.createElement('house3d-card');
  card.setAttribute('aria-label', 'Maja kolmemõõtmeline mudel');
  card.setConfig({ model });
  el.append(card);
  card.isPanel = true;
  card.hass = hass();
}

function show(pane) {
  if (current === pane) return;
  current = pane;
  for (const p of panes) {
    p.el.hidden = p !== pane;
    p.tab.setAttribute('aria-selected', String(p === pane));
    p.tab.tabIndex = p === pane ? 0 : -1;
  }
  const v = pane.view;
  if (v.type === 'panel') {
    if (!card) mountCard(pane.el);
    else { card.hass = hass(); card.isPanel = true; }
  } else {
    if (!pane.rendered) {
      pane.rendered = renderSections(v, ctx);
      pane.el.append(pane.rendered.el);
    }
    pane.rendered.update(hass());
  }
  pane.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  carOnFirstShow(v.type === 'panel');
}

// the hash is matched against the views' paths, never used as a selector; anything else is 3D
function route() {
  let path;
  try { path = decodeURIComponent(location.hash.slice(1)); } catch (e) { path = null; }
  const pane = panes.find(p => p.view.path === path);
  if (!pane && location.hash) history.replaceState(null, '', `#${panes[0].view.path}`);
  show(pane || panes[0]);
}
window.addEventListener('hashchange', route);

// HA's tab bar: arrow keys move between tabs
tabs.addEventListener('keydown', ev => {
  const i = panes.indexOf(current), d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
  if (!d) return;
  const next = panes[(i + d + panes.length) % panes.length];
  location.hash = next.view.path;
  next.tab.focus();
  ev.preventDefault();
});

/* ---------- the simulated hass ---------- */

function publish() {
  const h = hass();
  if (card && current && current.view.type === 'panel') card.hass = h;
  if (current && current.rendered) current.rendered.update(h);
  if (dialog.open && states[openEntity] !== shownState) renderInfo();
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

// The car drives in by itself once, on the 3D view's first show and not at page load: a card
// that is hidden would take the arrival without the drive. Leaving the view before it comes
// puts it off to the next show; driving it from its badge first cancels it.
let carDone = !carEntity;
let carTimer = null;
function carOnFirstShow(visible) {
  clearTimeout(carTimer);
  if (carDone || !visible) return;
  carTimer = setTimeout(() => { carDone = true; set(carEntity, 'home', { arrived_at: now() }); }, 3000);
}

function act(e, what, value) {
  const st = states[e], a = st.attributes, dom = domainOf(e);
  if (what === 'toggle') {
    if (dom === 'cover') return act(e, st.state === 'closed' || st.state === 'closing' ? 'open' : 'close');
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
  if (what === 'arrive' || what === 'leave') {
    carDone = true;
    clearTimeout(carTimer);
    return set(e, what === 'arrive' ? 'home' : 'not_home', { arrived_at: what === 'arrive' ? now() : null });
  }
}

/* ---------- more-info dialog ---------- */

let openEntity = null;
// the state object the dialog shows; a change to another entity leaves the dialog alone
let shownState = null;
let dragging = false;

function ago(iso) {
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (s > -45) return 'just praegu';
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute');
  return rtf.format(Math.round(s / 3600), 'hour');
}

const btn = (act, label, extra = '') => `<button type="button" data-do="${act}" ${extra}>${esc(label)}</button>`;
const iconBtn = (act, label, k, off) => `<button type="button" data-do="${act}" aria-label="${esc(label)}"${off ? ' disabled' : ''}>${shellIcon(k)}</button>`;
const power = on => `<button type="button" class="round" data-do="toggle" aria-pressed="${on}" aria-label="${on ? 'Lülita välja' : 'Lülita sisse'}">${shellIcon('power')}</button>`;
const slider = (label, value, min) => `<div class="pill slider" role="slider" tabindex="0" data-level aria-label="${esc(label)}"
  aria-valuemin="${min}" aria-valuemax="100" aria-valuenow="${value}" aria-valuetext="${value}%" style="--v:${value}%"><span class="fill"></span></div>`;

function controls(e, st) {
  const a = st.attributes, s = st.state, on = s === 'on';
  switch (domainOf(e)) {
    case 'light':
      return slider('Heledus', on ? Math.round((a.brightness || 255) / 2.55) : 0, 1) + power(on);
    case 'fan':
      return slider('Kiirus', on ? a.percentage || 40 : 0, 10) + power(on);
    case 'switch': case 'input_boolean':
      return `<button type="button" class="pill switch" role="switch" data-do="toggle" aria-checked="${on}" aria-label="Lülita"><span class="fill"></span></button>`;
    case 'cover':
      return `<div class="pill buttons" role="group" aria-label="Juhtimine">
        ${iconBtn('open', 'Ava', 'up', s === 'open' || s === 'opening')}${iconBtn('stop', 'Peata', 'stop', s !== 'opening' && s !== 'closing')}${iconBtn('close', 'Sulge', 'down', s === 'closed' || s === 'closing')}</div>`
        + ('current_position' in a ? '' : '<p class="note">See seade asendit ei teata, nii et olek on viimane käsk.</p>');
    case 'climate':
      return `<div class="thermostat">${thermostat(e, st)}${modeButtons(st)}</div>`;
    case 'water_heater':
      return `<div class="thermostat">${thermostat(e, st)}</div>`;
    case 'alarm_control_panel':
      return `<div class="pill seg" role="group" aria-label="Valvestus">${btn('arm_away', 'Valves (eemal)', `aria-pressed="${s === 'armed_away'}"`)}${btn('arm_home', 'Valves (kodus)', `aria-pressed="${s === 'armed_home'}"`)}${btn('disarm', 'Valvest maas', `aria-pressed="${s === 'disarmed'}"`)}</div>`
        + (s === 'disarmed' ? '' : `<div class="row">${btn('trigger', 'Testhäire', s === 'triggered' ? 'disabled' : '')}</div>`);
    case 'binary_sensor':
      if (a.device_class === 'door') return `<div class="row">${btn('flip', s === 'on' ? 'Sulge uks' : 'Ava uks')}</div><p class="note">Simulatsioon: päris majas muudab seda andur.</p>`;
      if (a.device_class === 'motion') return `<div class="row">${btn('pulse', 'Simuleeri liikumist', s === 'on' ? 'disabled' : '')}</div>`;
      return `<div class="row">${s === 'on' ? btn('flip', 'Lähtesta') : btn('flip', 'Testi andurit')}</div>`;
    case 'sensor':
      return `<div class="row">${btn('down', 'Jahedamaks')}${btn('up', 'Soojemaks')}</div><p class="note">Simulatsioon: päris majas tuleb väärtus andurilt.</p>`;
    case 'camera':
      return `<div class="cam" role="img" aria-label="Kaamerapildi asemik">${icon('camera')}</div><p class="note">Päris majas näitab Home Assistant siin otsepilti. 3D-vaates on kaamera vaatesektor.</p>`;
    case 'device_tracker':
      return `<div class="row">${btn('arrive', 'Saabub', s === 'home' ? 'disabled' : '')}${btn('leave', 'Lahkub', s === 'home' ? '' : 'disabled')}</div>`;
    default:
      return '';
  }
}

function renderInfo() {
  const e = openEntity, st = states[e];
  if (!st) return dialog.close();
  shownState = st;
  dialog.querySelector('.state').textContent = formatEntityState(st);
  dialog.querySelector('.when').textContent = `Muudetud ${ago(st.last_changed)}`;
  const box = dialog.querySelector('.controls');
  box.style.setProperty('--c', stateColor(e, st));
  // a slider in use keeps its element and only moves; any other control is rebuilt and gets its focus back
  const live = box.querySelector('[data-level]');
  if (live && (dragging || live === document.activeElement) && st.state === 'on') {
    const v = domainOf(e) === 'light' ? Math.round((st.attributes.brightness || 255) / 2.55) : st.attributes.percentage || 40;
    live.style.setProperty('--v', `${v}%`);
    live.setAttribute('aria-valuenow', String(v));
    live.setAttribute('aria-valuetext', `${v}%`);
    const p = box.querySelector('[data-do="toggle"]');
    if (p) { p.setAttribute('aria-pressed', 'true'); p.setAttribute('aria-label', 'Lülita välja'); }
    return;
  }
  const focused = box.contains(document.activeElement) ? document.activeElement : null;
  const key = focused && (focused.dataset.do || (focused.hasAttribute('data-level') ? 'level' : null));
  box.innerHTML = controls(e, st);
  const again = key && (key === 'level' ? box.querySelector('[data-level]') : [...box.querySelectorAll('[data-do]')].find(b => b.dataset.do === key));
  if (again && !again.disabled) again.focus();
}

function openInfo(entity) {
  if (!states[entity]) return;
  openEntity = entity;
  dialog.querySelector('.i-name').textContent = nameOf(entity);
  const area = areaOf(entity);
  dialog.querySelector('.i-area').textContent = area;
  dialog.querySelector('.i-area').hidden = !area;
  dialog.querySelector('.controls').innerHTML = '';
  renderInfo();
  if (!dialog.open) dialog.showModal();
}
setInterval(() => {
  if (dialog.open && states[openEntity]) dialog.querySelector('.when').textContent = `Muudetud ${ago(states[openEntity].last_changed)}`;
}, 30000);

// taps on a dialog's backdrop land on the dialog element, outside its box
const outside = (d, ev) => {
  const r = d.getBoundingClientRect();
  return ev.target === d && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom);
};

dialog.addEventListener('click', ev => {
  if (outside(dialog, ev) || ev.target.closest('[data-act="close"]')) return dialog.close();
  const b = ev.target.closest('button[data-do]');
  if (b && !b.disabled) act(openEntity, b.dataset.do);
});

// the big slider: drag along it, or arrow keys and Page Up/Down
function levelAt(el, y) {
  const r = el.getBoundingClientRect(), min = Number(el.getAttribute('aria-valuemin'));
  return Math.max(min, Math.min(100, Math.round(((r.bottom - y) / r.height) * 100)));
}
function slide(el, v) {
  el.style.setProperty('--v', `${v}%`);
  act(openEntity, 'level', v);
}
dialog.addEventListener('pointerdown', ev => {
  const el = ev.target.closest('[data-level]');
  if (!el) return;
  dragging = true;
  el.setPointerCapture(ev.pointerId);
  el.focus();
  slide(el, levelAt(el, ev.clientY));
});
dialog.addEventListener('pointermove', ev => {
  const el = ev.target.closest('[data-level]');
  if (dragging && el) slide(el, levelAt(el, ev.clientY));
});
const stopDrag = () => { dragging = false; };
dialog.addEventListener('pointerup', stopDrag);
dialog.addEventListener('pointercancel', stopDrag);
dialog.addEventListener('keydown', ev => {
  const el = ev.target.closest('[data-level]');
  if (!el) return;
  const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[ev.key];
  if (!step) return;
  ev.preventDefault();
  const now = Number(el.getAttribute('aria-valuenow'));
  // turning down leaves an off device off; the power button switches it
  if (now === 0 && step < 0) return;
  const min = Number(el.getAttribute('aria-valuemin'));
  slide(el, Math.max(min, Math.min(100, now + step)));
});
dialog.addEventListener('close', () => { dragging = false; });

/* ---------- the drawer and the card's taps ---------- */

document.querySelector('[data-act="menu"]').addEventListener('click', () => drawer.showModal());
drawer.addEventListener('click', ev => {
  if (outside(drawer, ev) || ev.target.closest('[data-act="close"]')) drawer.close();
});

// what HA's frontend does with the card's taps
viewsEl.addEventListener('hass-more-info', ev => openInfo(ev.detail && ev.detail.entityId));

route();
