// A mock Home Assistant dashboard on the made-up test house. The views are the house's own
// Overview, made by the same generator (dashboard.json, scripts/dashboard_demo.py), drawn by
// demo/cards.js on one simulated hass (demo/sim.js, starting from states.json) with a simulated
// recorder (demo/recorder.js, recorder.json, ADR-012); A3's hero and the 3D view are the real
// house3d card, A3's cards the house's own (khe-cards.js). Taps run as HA runs them: more-info
// opens a dialog like HA's, toggles and service calls change the simulated states, navigate opens
// a view or a subview. This file names no entity: the data names them, so it works for any
// generated dashboard. ?light shows HA's light theme, which the dashboard cards follow; ?lang=en
// shows the English demo, the .en.json files and demo/strings.js (ADR-003). The toolbar's
// scenarios (scenarios.json, played by scenario.js) tell short stories on the same simulated hass.
import './house3d-card.js?v=__HOUSE3D_VERSION__';
import { zoneParts, dayStart, lastMonthName } from './khe-cards.js?v=__KHE_CARDS_VERSION__';
import { createRecorder } from './recorder.js?v=__DEMO_VERSION__';
import { svg, entityIcon } from './icons.js?v=__DEMO_VERSION__';
import { createSim } from './sim.js?v=__DEMO_VERSION__';
import { play } from './scenario.js?v=__DEMO_VERSION__';
import { renderSections, renderPanel, runAction, formatState, stateColor, ago } from './cards.js?v=__DEMO_VERSION__';
import { lang, locale, t } from './strings.js?v=__DEMO_VERSION__';

const toolbar = document.querySelector('.toolbar');
const tabs = document.querySelector('.tabs');
const titleEl = document.querySelector('.main-title');
const backBtn = document.querySelector('[data-act="back"]');
const menuBtn = document.querySelector('[data-act="menu"]');
const viewsEl = document.querySelector('.views');
const drawer = document.querySelector('dialog.drawer');
const dialog = document.querySelector('dialog.info');
const confirmDlg = document.querySelector('dialog.confirm');
const sceneDlg = document.querySelector('dialog.scenarios');
const sceneBtn = document.querySelector('[data-act="scenarios"]');
const sceneBar = document.querySelector('.scene');
const nf1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const domainOf = entity => entity.split('.')[0];

menuBtn.innerHTML = svg('menu');
sceneBtn.innerHTML = svg('playlist-play');
sceneBar.querySelector('.s-icon').outerHTML = svg('robot');
backBtn.innerHTML = svg('arrow-left');
document.querySelectorAll('[data-act="close"].icon-button').forEach(b => { b.innerHTML = svg('close'); });
document.querySelector('.d-icon').outerHTML = svg('home');
document.documentElement.lang = lang;
document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t[el.dataset.t]; });
document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t[el.dataset.tAria]); });

const load = name => fetch(`./${name}?v=__DEMO_VERSION__`).then(r => { if (!r.ok) throw new Error(name); return r.json(); });
const suffix = lang === 'en' ? '.en.json' : '.json';
let model, dashboard, data, series, scenarios, recorderSpec;
try {
  [model, dashboard, data, series, scenarios, recorderSpec] = await Promise.all([...['model', 'dashboard', 'states', 'series', 'scenarios'].map(n => load(n + suffix)), load('recorder.json')]);
} catch (e) {
  viewsEl.innerHTML = `<div class="fallback">${esc(t.loadFailed)}</div>`;
  throw e;
}

const light = new URLSearchParams(location.search).has('light');
document.documentElement.classList.toggle('light', light);
// the states that follow the date (today's use, this month's, the prices) start from the
// recorder's own data, so the cards' numbers agree with their history on any day
const recorder = createRecorder(recorderSpec, { zoneParts, dayStart, lastMonthName });
const dated = recorder.dated(Date.now(), { comma: lang !== 'en', levels: data.levels, hinnang: data.hinnang });
for (const [e, s] of Object.entries(dated)) {
  const s0 = data.states[e];
  if (s0) data.states[e] = { ...s0, state: s.state, attributes: { ...s0.attributes, ...(s.attributes || {}) } };
}
// a mirror follows a dated state it has a word for and the recorder left it (the TV's app while off)
for (const [target, m] of Object.entries(data.mirrors || {})) {
  const from = dated[m.from];
  if (from && !dated[target] && from.state in m.map && data.states[target]) data.states[target] = { ...data.states[target], state: m.map[from.state] };
}
const sim = createSim(data);
const byEntity = new Map((model.devices || []).map(d => [d.entity, d]));
const roomName = id => (id === 'oues' ? t.outdoors : ((model.rooms || []).find(r => r.id === id) || {}).name || '');
const nameOf = e => (sim.states[e] && sim.states[e].attributes.friendly_name) || (byEntity.get(e) || {}).name || e;
const areaOf = e => (byEntity.has(e) ? roomName(byEntity.get(e).room) : '');
const carEntity = model.car && model.car.entity;
// HA's hass as the cards use it: the recorder over WebSocket, a service call as a Promise
const hass = () => ({
  states: sim.states,
  config: { latitude: 58.6, longitude: 25.0, time_zone: recorderSpec.zone },
  themes: { darkMode: !light },
  formatEntityState: formatState,
  callWS: msg => recorder.callWS(msg),
  callService: (d, s, dt, t) => Promise.resolve().then(() => sim.callService(d, s, dt, t))
});

/* ---------- confirmation, as HA asks before an action that has one ---------- */

let answer = null;
function confirm(text) {
  // one question at a time: a second tap while one is open is no answer
  if (confirmDlg.open) return Promise.resolve(false);
  confirmDlg.querySelector('.c-text').textContent = text;
  confirmDlg.showModal();
  return new Promise(resolve => { answer = resolve; });
}
confirmDlg.addEventListener('click', ev => {
  const b = ev.target.closest('button[data-ok]');
  if (b) confirmDlg.close(b.dataset.ok);
});
confirmDlg.addEventListener('close', () => { if (answer) answer(confirmDlg.returnValue === 'yes'); answer = null; confirmDlg.returnValue = ''; });

/* ---------- views and routing ---------- */

const isHouse3d = v => v.type === 'panel' && (v.cards || [])[0] && v.cards[0].type === 'custom:house3d-card';
const pathOf = nav => (/^\/lovelace\/([\w-]+)$/.exec(nav || '') || [])[1];
const panes = dashboard.views.map(view => {
  const el = document.createElement('div');
  el.className = `view view-${view.type}`;
  el.setAttribute('role', 'tabpanel');
  el.setAttribute('aria-label', view.title);
  el.hidden = true;
  viewsEl.append(el);
  let tab = null;
  if (!view.subview) {
    tab = document.createElement('a');
    tab.className = 'tab';
    tab.href = `#${view.path}`;
    tab.setAttribute('role', 'tab');
    tab.title = view.title;
    tab.setAttribute('aria-label', view.title);
    tab.innerHTML = svg(view.icon);
    tabs.append(tab);
  }
  return { view, tab, el, rendered: null };
});
// a subview's way back: the view whose cards or badges link to it, else the first view
const linksTo = (view, path) => JSON.stringify(view).includes(`"navigation_path":"/lovelace/${path}"`);
const parentOf = pane => panes.find(p => !p.view.subview && linksTo(p.view, pane.view.path)) || panes.find(p => p.view.subview && p !== pane && linksTo(p.view, pane.view.path)) || panes[0];

// the 3D cards: A3's hero and the 3D view's; scenarios and the car's drive-in take the one shown
let current = null, cameFrom = null;
const cards3d = [];
const shown3d = () => (current && cards3d.find(el => current.el.contains(el))) || null;

const resizers = new Map();
const ro = new ResizeObserver(entries => entries.forEach(en => { const fn = resizers.get(en.target); if (fn && en.contentRect.width) fn(); }));
const ctx = {
  nameOf,
  series,
  now: () => new Date(),
  act: (action, entity) => runAction(action, entity, api),
  resize: (el, fn) => { resizers.set(el, fn); ro.observe(el); },
  // the card's own config from the dashboard, as HA passes it: in English it carries language: en
  house3d: conf => {
    const el = document.createElement('house3d-card');
    el.setAttribute('aria-label', t.house3d);
    el.setConfig({ ...conf, model });
    cards3d.push(el);
    return { el, update: h => { el.hass = h; } };
  },
  // a dashboard card from khe-cards.js, as HA mounts a custom: type
  khe: conf => {
    const el = document.createElement(conf.type.slice('custom:'.length));
    el.setConfig(conf);
    return { el, update: h => { el.hass = h; } };
  }
};
const api = {
  confirm,
  moreInfo: openInfo,
  toggle: e => sim.toggle(e),
  callService: (d, s, dt, t) => sim.callService(d, s, dt, t),
  navigate: nav => {
    const p = pathOf(nav);
    if (p && panes.some(x => x.view.path === p)) location.hash = p;
    else note(t.noPage);
  },
  openUrl: url => window.open(url, '_blank', 'noopener')
};

function show(pane) {
  if (current === pane) return;
  if (pane.view.subview && current && current !== pane) cameFrom = current.view.subview ? cameFrom : current;
  current = pane;
  for (const p of panes) {
    p.el.hidden = p !== pane;
    if (p.tab) { p.tab.setAttribute('aria-selected', String(p === pane)); p.tab.tabIndex = p === pane ? 0 : -1; }
  }
  const v = pane.view;
  toolbar.classList.toggle('sub', !!v.subview);
  titleEl.textContent = v.subview ? v.title : dashboard.title;
  if (!pane.rendered) {
    pane.rendered = v.type === 'panel' ? renderPanel(v, ctx) : renderSections(v, ctx);
    pane.el.append(pane.rendered.el);
  }
  const c3 = shown3d();
  if (isHouse3d(v) && c3) c3.isPanel = true;
  // a view's own background, as HA draws it behind the view
  document.body.style.background = v.background || '';
  document.body.style.backgroundAttachment = v.background ? 'fixed' : '';
  pane.rendered.update(hass());
  if (pane.tab) pane.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  window.scrollTo(0, 0);
  carOnFirstShow(!!c3);
}

// a short line at the bottom, as HA's toast, for a link the demo cannot follow
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
toast.hidden = true;
document.body.append(toast);
let toastTimer = null;
function note(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

// the hash is matched against the views' paths, never used as a selector; anything else is the first view
function route() {
  let path;
  try { path = decodeURIComponent(location.hash.slice(1)); } catch (e) { path = null; }
  const pane = panes.find(p => p.view.path === path);
  if (!pane && location.hash) history.replaceState(null, '', `#${panes[0].view.path}`);
  show(pane || panes[0]);
}
window.addEventListener('hashchange', route);
// back as HA goes back: through history when the subview was opened from here, else to the
// view that links it
backBtn.addEventListener('click', () => {
  const came = cameFrom && cameFrom !== current;
  cameFrom = null;
  if (came) history.back();
  else location.hash = parentOf(current).view.path;
});

// HA's tab bar: arrow keys move between tabs
tabs.addEventListener('keydown', ev => {
  const list = panes.filter(p => p.tab), i = list.indexOf(current), d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
  if (!d) return;
  const next = list[(Math.max(0, i) + d + list.length) % list.length];
  location.hash = next.view.path;
  next.tab.focus();
  ev.preventDefault();
});

/* ---------- the simulated hass reaching the page ---------- */

sim.subscribe(() => {
  const h = hass();
  if (current && current.rendered) current.rendered.update(h);
  // a 3D card follows every change, also while another view is current, so it sees each arrival
  for (const el of cards3d) if (!(current && current.el.contains(el))) el.hass = h;
  if (dialog.open && sim.states[openEntity] !== shownState) renderInfo();
});

// The car drives in by itself once, on the first show of a view with a 3D card (the hero) and not
// at page load: a card that is hidden would take the arrival without the drive. Leaving the view
// before it comes puts it off to the next show; driving it from its dialog first cancels it.
let carDone = !carEntity;
let carTimer = null;
// a tap on the car's dialog or a scenario takes the car over: the first show's drive-in is off
function takeCar() {
  carDone = true;
  clearTimeout(carTimer);
}
function carOnFirstShow(visible) {
  clearTimeout(carTimer);
  if (carDone || !visible) return;
  carTimer = setTimeout(() => { carDone = true; sim.set(carEntity, 'home', { arrived_at: new Date().toISOString() }); }, 3000);
}

/* ---------- more-info dialog ---------- */

let openEntity = null;
let shownState = null;
let dragging = false;

const btn = (act, label, extra = '') => `<button type="button" data-do="${esc(act)}" ${extra}>${esc(label)}</button>`;
const iconBtn = (act, label, k, off) => `<button type="button" data-do="${act}" aria-label="${esc(label)}"${off ? ' disabled' : ''}>${svg(k)}</button>`;
const power = on => `<button type="button" class="round" data-do="toggle" aria-pressed="${on}" aria-label="${on ? t.turnOff : t.turnOn}">${svg('power')}</button>`;
const slider = (label, value, min) => `<div class="pill slider" role="slider" tabindex="0" data-level aria-label="${esc(label)}"
  aria-valuemin="${min}" aria-valuemax="100" aria-valuenow="${value}" aria-valuetext="${value}%" style="--v:${value}%"><span class="fill"></span></div>`;

// the arc of HA's thermostat card, 270 degrees open at the bottom
const ARC = { cx: 100, cy: 100, r: 84, from: 135, sweep: 270 };
const polar = deg => { const t = (deg * Math.PI) / 180; return [ARC.cx + ARC.r * Math.cos(t), ARC.cy + ARC.r * Math.sin(t)]; };
function arcPath(f0, f1) {
  const a0 = ARC.from + ARC.sweep * f0, a1 = ARC.from + ARC.sweep * f1;
  const [x0, y0] = polar(a0), [x1, y1] = polar(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${ARC.r} ${ARC.r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function thermostat(e, st) {
  const a = st.attributes || {}, off = st.state === 'off';
  const min = a.min_temp ?? 5, max = a.max_temp ?? 30, target = a.temperature;
  const f = Math.min(1, Math.max(0, (target - min) / (max - min)));
  const step = domainOf(e) === 'water_heater' ? 1 : 0.5;
  const big = off ? t.modes.off : `${step < 1 ? nf1.format(target) : Math.round(target)}<span class="unit">°C</span>`;
  return `<div class="thermo" style="--c:${stateColor(e, st)}">
    <svg viewBox="0 0 200 200" aria-hidden="true"><path class="track" d="${arcPath(0, 1)}"/>${off ? '' : `<path class="value" d="${arcPath(0, f)}"/>`}</svg>
    <div class="t-mid"><span class="t-label">${off ? '' : t.target}</span><span class="t-big" aria-live="polite">${big}</span>
      <span class="t-now">${svg('thermometer')} ${nf1.format(a.current_temperature)} °C</span></div>
  </div>
  <div class="t-steps">${iconBtn('down', t.targetDown, 'minus', off)}${iconBtn('up', t.targetUp, 'plus', off)}</div>`;
}
const modeButtons = (modes, s, prefix) => (modes.length ? `<div class="modes" role="group" aria-label="${t.mode}">${modes.map(m => btn(`${prefix}:${m}`, t.modes[m] || m, `aria-pressed="${s === m}"`)).join('')}</div>` : '');
const options = (st, label) => `<div class="pill seg options" role="group" aria-label="${esc(label)}">${(st.attributes.options || []).map(o => btn(`option:${o}`, o, `aria-pressed="${st.state === o}"`)).join('')}</div>`;

function controls(e, st) {
  const a = st.attributes, s = st.state, on = s === 'on';
  switch (domainOf(e)) {
    case 'light': return slider(t.brightness, on ? Math.round((a.brightness || 255) / 2.55) : 0, 1) + power(on);
    case 'fan': return slider(t.speed, on ? a.percentage || 40 : 0, 10) + power(on);
    case 'switch': case 'input_boolean':
      return `<button type="button" class="pill switch" role="switch" data-do="toggle" aria-checked="${on}" aria-label="${t.toggle}"><span class="fill"></span></button>`;
    case 'cover':
      return `<div class="pill buttons" role="group" aria-label="${t.controls}">
        ${iconBtn('open', t.open, 'chevron-up', s === 'open' && 'current_position' in a)}${iconBtn('stop', t.stop, 'stop')}${iconBtn('close', t.close, 'chevron-down', s === 'closed' && 'current_position' in a)}</div>`
        + ('current_position' in a ? '' : `<p class="note">${t.noPosition}</p>`);
    case 'climate': return `<div class="thermostat">${thermostat(e, st)}${modeButtons(a.hvac_modes || [], s, 'hvac')}</div>`;
    case 'water_heater': return `<div class="thermostat">${thermostat(e, st)}${modeButtons(a.operation_list || [], s, 'op')}</div>`;
    case 'alarm_control_panel':
      return `<div class="pill seg" role="group" aria-label="${t.arming}">${btn('arm_away', t.state.armed_away, `aria-pressed="${s === 'armed_away'}"`)}${btn('arm_home', t.state.armed_home, `aria-pressed="${s === 'armed_home'}"`)}${btn('arm_night', t.state.armed_night, `aria-pressed="${s === 'armed_night'}"`)}${btn('disarm', t.state.disarmed, `aria-pressed="${s === 'disarmed'}"`)}</div>`
        + (s === 'disarmed' ? '' : `<div class="row">${btn('trigger', t.testAlarm, s === 'triggered' ? 'disabled' : '')}</div>`);
    case 'binary_sensor':
      if (a.device_class === 'door') return `<div class="row">${btn('flip', on ? t.closeDoor : t.openDoor)}</div><p class="note">${t.simSensor}</p>`;
      if (a.device_class === 'motion') return `<div class="row">${btn('pulse', t.simMotion, on ? 'disabled' : '')}</div>`;
      return `<div class="row">${on ? btn('flip', t.reset) : btn('flip', t.testSensor)}</div><p class="note">${t.simSensor}</p>`;
    case 'sensor':
      if (a.device_class === 'temperature') return `<div class="row">${btn('down', t.cooler)}${btn('up', t.warmer)}</div><p class="note">${t.simValue}</p>`;
      return '';
    case 'select': case 'input_select': return options(st, t.options);
    case 'number': case 'input_number':
      return `<div class="row stepper">${iconBtn('dec', t.less, 'minus', Number(s) <= a.min)}${iconBtn('inc', t.more, 'plus', Number(s) >= a.max)}</div>`;
    case 'media_player': return power(s !== 'off') + (a.app_name && s !== 'off' ? `<p class="note">${esc(t.app(a.app_name))}</p>` : '');
    case 'update':
      return `<p class="note">${esc(t.installed(a.installed_version, a.latest_version))}</p>${on ? `<div class="row">${btn('install', t.install)}</div>` : ''}`;
    case 'button': return `<div class="row">${btn('press', t.press)}</div>`;
    case 'camera':
      return `<div class="cam" role="img" aria-label="${t.camPlaceholder}">${svg('cctv')}</div><p class="note">${t.camNote}</p>`;
    case 'device_tracker':
      return `<div class="row">${btn('arrive', t.arrive, s === 'home' ? 'disabled' : '')}${btn('leave', t.leave, s === 'home' ? '' : 'disabled')}</div>`;
    default: return '';
  }
}

// what a dialog control does: the service HA's dialog would call, or for a sensor, a simulated reading
function act(e, what) {
  const st = sim.states[e], a = st.attributes, d = domainOf(e);
  const call = (dom, service, dt = {}) => sim.callService(dom, service, dt, { entity_id: e });
  if (what === 'toggle') return sim.toggle(e);
  if (what === 'open' || what === 'close' || what === 'stop') return call('cover', `${what}_cover`);
  if (what.startsWith('option:')) return call(d, 'select_option', { option: what.slice(7) });
  if (what.startsWith('hvac:')) return call('climate', 'set_hvac_mode', { hvac_mode: what.slice(5) });
  if (what.startsWith('op:')) return call('water_heater', 'set_operation_mode', { operation_mode: what.slice(3) });
  if (what === 'inc' || what === 'dec') return call(d, 'set_value', { value: Number(st.state) + (what === 'inc' ? 1 : -1) * (a.step || 1) });
  if (what === 'up' || what === 'down') {
    const sign = what === 'up' ? 1 : -1;
    if (d === 'sensor') return sim.set(e, (Math.round((Number(st.state) + sign * 0.5) * 10) / 10).toFixed(1));
    return call(d, 'set_temperature', { temperature: a.temperature + sign * (d === 'water_heater' ? 1 : 0.5) });
  }
  if (what === 'arm_home' || what === 'arm_away' || what === 'arm_night' || what === 'disarm' || what === 'trigger') return call('alarm_control_panel', `alarm_${what}`);
  if (what === 'install') return call('update', 'install');
  if (what === 'press') return call('button', 'press');
  if (what === 'flip') return sim.set(e, st.state === 'on' ? 'off' : 'on');
  if (what === 'pulse') return sim.pulse(e, 4000);
  if (what === 'arrive' || what === 'leave') {
    takeCar();
    return sim.set(e, what === 'arrive' ? 'home' : 'not_home', { arrived_at: what === 'arrive' ? new Date().toISOString() : null });
  }
}

function level(e, v) {
  if (domainOf(e) === 'light') sim.callService('light', 'turn_on', { brightness_pct: v }, { entity_id: e });
  else sim.callService('fan', 'set_percentage', { percentage: v }, { entity_id: e });
}

function renderInfo() {
  const e = openEntity, st = sim.states[e];
  if (!st) return dialog.close();
  shownState = st;
  dialog.querySelector('.state').textContent = formatState(st);
  dialog.querySelector('.when').textContent = t.changed(ago(st.last_changed));
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
    if (p) { p.setAttribute('aria-pressed', 'true'); p.setAttribute('aria-label', t.turnOff); }
    return;
  }
  const focused = box.contains(document.activeElement) ? document.activeElement : null;
  const key = focused && (focused.dataset.do || (focused.hasAttribute('data-level') ? 'level' : null));
  box.innerHTML = controls(e, st);
  const again = key && (key === 'level' ? box.querySelector('[data-level]') : [...box.querySelectorAll('[data-do]')].find(b => b.dataset.do === key));
  if (again && !again.disabled) again.focus();
}

function openInfo(entity) {
  if (!sim.states[entity]) return;
  openEntity = entity;
  dialog.querySelector('.i-icon').innerHTML = svg(entityIcon(entity, sim.states[entity]));
  dialog.querySelector('.i-name').textContent = nameOf(entity);
  const area = areaOf(entity);
  dialog.querySelector('.i-area').textContent = area;
  dialog.querySelector('.i-area').hidden = !area;
  dialog.querySelector('.controls').innerHTML = '';
  renderInfo();
  if (!dialog.open) dialog.showModal();
}
setInterval(() => {
  if (dialog.open && sim.states[openEntity]) dialog.querySelector('.when').textContent = t.changed(ago(sim.states[openEntity].last_changed));
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
  level(openEntity, v);
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
  const v = Number(el.getAttribute('aria-valuenow'));
  // turning down leaves an off device off; the power button switches it
  if (v === 0 && step < 0) return;
  const min = Number(el.getAttribute('aria-valuemin'));
  slide(el, Math.max(min, Math.min(100, v + step)));
});
dialog.addEventListener('close', () => { dragging = false; });

/* ---------- the drawer and the card's taps ---------- */

menuBtn.addEventListener('click', () => drawer.showModal());
drawer.addEventListener('click', ev => {
  if (outside(drawer, ev) || ev.target.closest('[data-act="close"]')) drawer.close();
});

/* ---------- scenarios: a story played on the simulated house (scenario.js) ---------- */

let stopScene = null;
const sceneBody = sceneBar.querySelector('.s-body');
const sceneButton = what => sceneBar.querySelector(`[data-scene="${what}"]`);

sceneDlg.querySelector('.sc-list').innerHTML = scenarios.map((s, i) => `<button type="button" data-scenario="${i}">
  <span class="sc-title">${esc(s.title)}</span><span class="sc-line">${esc(s.summary)}</span></button>`).join('');

// the bar pushes the views down; the 3D card measures its height from its top, which just moved.
// Within a scenario the bar only grows, so a shorter beat does not move the 3D view back up.
const fitScene = () => {
  if (!sceneBar.hidden && sceneBar.offsetHeight > (parseFloat(sceneBar.style.minHeight) || 0)) sceneBar.style.minHeight = `${sceneBar.offsetHeight}px`;
  document.documentElement.style.setProperty('--scene-h', sceneBar.hidden ? '0px' : `${sceneBar.offsetHeight}px`);
  for (const el of cards3d) if (el.hasAttribute('panel')) el.isPanel = true;
};
new ResizeObserver(fitScene).observe(sceneBar);

function beat(head, alias, text) {
  sceneBody.classList.toggle('auto', !!alias);
  sceneBody.querySelector('.s-label').textContent = alias ? t.automation : head;
  sceneBody.querySelector('.s-alias').textContent = alias || '';
  sceneBody.querySelector('.s-caption').textContent = text;
  sceneBody.classList.remove('fresh');
  void sceneBody.offsetWidth;
  sceneBody.classList.add('fresh');
}

function sceneDone(done) {
  sceneButton('stop').hidden = done;
  sceneButton('restart').hidden = !done;
  sceneButton('close').hidden = !done;
}

function startScenario(s) {
  haltScene();
  takeCar();
  const pane = panes.find(p => p.view.path === s.view) || panes[0];
  show(pane);
  if (location.hash.slice(1) !== pane.view.path) location.hash = pane.view.path;
  // the scenario's sky is the shown view's 3D card's for the whole story, also while the visitor
  // looks at another view; every other card returns to its own style and time
  const c3 = s.time ? shown3d() : null;
  // play() checks the scenario before anything changes, so one it rejects leaves no bar or scene
  stopScene = play(s, sim, {
    car: carEntity,
    onStep: st => { if (st.caption) beat(s.title, st.automation, st.caption); },
    onTime: at => { if (c3) c3.setScene({ time: at }); },
    onEnd: () => sceneDone(true)
  });
  for (const el of cards3d) if (el !== c3) el.clearScene();
  if (c3) c3.setScene({ style: 'real', time: s.time });

  sceneBar.style.minHeight = '';
  beat(s.title, null, s.summary);
  sceneDone(false);
  sceneBar.hidden = false;
}

function haltScene() {
  if (stopScene) stopScene();
  stopScene = null;
}

function endScenario(restart) {
  haltScene();
  sceneBar.hidden = true;
  if (!restart) return;
  sim.reset();
  for (const el of cards3d) el.clearScene();
}

sceneBtn.addEventListener('click', () => sceneDlg.showModal());
sceneDlg.addEventListener('click', ev => {
  if (outside(sceneDlg, ev) || ev.target.closest('[data-act="close"]')) return sceneDlg.close();
  const b = ev.target.closest('[data-scenario]');
  if (!b) return;
  sceneDlg.close();
  startScenario(scenarios[Number(b.dataset.scenario)]);
});
// stop keeps what has happened so far and offers the same two ways out as the end
sceneBar.addEventListener('click', ev => {
  const b = ev.target.closest('[data-scene]');
  if (!b) return;
  if (b.dataset.scene !== 'stop') return endScenario(b.dataset.scene === 'restart');
  haltScene();
  sceneDone(true);
  sceneButton('restart').focus();
});

// what HA's frontend does with the cards' taps: more-info from the 3D card, hass-action from
// the dashboard cards, run as HA's handleAction runs it
viewsEl.addEventListener('hass-more-info', ev => openInfo(ev.detail && ev.detail.entityId));
viewsEl.addEventListener('hass-action', ev => {
  const d = ev.detail;
  if (d && d.action === 'tap' && d.config) ctx.act(d.config.tap_action, d.config.entity);
});

route();
