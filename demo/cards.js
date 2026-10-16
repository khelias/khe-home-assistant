// Renders the demo dashboard's Lovelace-shaped config (demo/dashboard.js) to DOM, card by card,
// the way Home Assistant's cards look and behave: a tile's body opens more-info and its icon
// toggles, badges and pictures open more-info, the thermostat and alarm panel act in place.
// Every card updates from hass like HA's do, only when its entity's state object changed.
import { icon } from './house3d.js?v=__HOUSE3D_VERSION__';

const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const domainOf = entity => entity.split('.')[0];
const nf1 = new Intl.NumberFormat('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const SHELL = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  thermostat: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 10v7M17 6h3M17 10h3"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/>',
  cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  car: '<path d="M5 16.5h14v-4l-2-4.5H7l-2 4.5z"/><path d="M5 12.5h14"/><circle cx="8" cy="16.5" r="1.8"/><circle cx="16" cy="16.5" r="1.8"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 7.2a8 8 0 1 0 11.4 0"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1"/>'
};
export const shellIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHELL[k] || ''}</svg>`;

// HA's state colours as the page's CSS variables; an entity at rest shows the inactive grey
export function stateColor(entity, st) {
  if (!st) return 'var(--state-inactive-color)';
  const s = st.state, a = st.attributes || {};
  switch (domainOf(entity)) {
    case 'light': case 'switch': case 'input_boolean': return s === 'on' ? 'var(--state-on-color)' : 'var(--state-inactive-color)';
    case 'fan': return s === 'on' ? 'var(--state-fan-color)' : 'var(--state-inactive-color)';
    case 'cover': return s === 'closed' ? 'var(--state-inactive-color)' : 'var(--state-cover-color)';
    case 'climate': case 'water_heater': return s === 'off' ? 'var(--state-inactive-color)' : 'var(--state-heat-color)';
    case 'binary_sensor': return s !== 'on' ? 'var(--state-inactive-color)' : a.device_class === 'smoke' ? 'var(--state-alert-color)' : 'var(--state-on-color)';
    case 'alarm_control_panel': return s === 'triggered' ? 'var(--state-alert-color)' : s === 'disarmed' ? 'var(--state-inactive-color)' : 'var(--state-armed-color)';
    case 'device_tracker': return s === 'home' ? 'var(--state-armed-color)' : 'var(--state-inactive-color)';
    default: return 'var(--primary-color)';
  }
}

/* ---------- the thermostat's arc, shared with the more-info dialog ---------- */

// 270 degrees open at the bottom, as HA's ha-big-number arc
const ARC = { cx: 100, cy: 100, r: 84, from: 135, sweep: 270 };
const polar = deg => {
  const t = (deg * Math.PI) / 180;
  return [ARC.cx + ARC.r * Math.cos(t), ARC.cy + ARC.r * Math.sin(t)];
};
function arcPath(f0, f1) {
  const a0 = ARC.from + ARC.sweep * f0, a1 = ARC.from + ARC.sweep * f1;
  const [x0, y0] = polar(a0), [x1, y1] = polar(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${ARC.r} ${ARC.r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// the arc with the target in the middle and the current temperature under it, then -/+
export function thermostat(entity, st) {
  const a = st.attributes || {}, off = st.state === 'off';
  const min = a.min_temp ?? 5, max = a.max_temp ?? 30, target = a.temperature;
  const f = Math.min(1, Math.max(0, (target - min) / (max - min)));
  const step = domainOf(entity) === 'water_heater' ? 1 : 0.5;
  const big = off ? 'Väljas' : `${step < 1 ? nf1.format(target) : Math.round(target)}<span class="unit">°C</span>`;
  return `<div class="thermo" style="--c:${stateColor(entity, st)}">
    <svg viewBox="0 0 200 200" aria-hidden="true"><path class="track" d="${arcPath(0, 1)}"/>${off ? '' : `<path class="value" d="${arcPath(0, f)}"/>`}</svg>
    <div class="t-mid"><span class="t-label">${off ? '' : 'Soovitud'}</span><span class="t-big" aria-live="polite">${big}</span>
      <span class="t-now">${icon('climate')} ${nf1.format(a.current_temperature)} °C</span></div>
  </div>
  <div class="t-steps">
    <button type="button" class="round" data-do="down" aria-label="Sihttemperatuur alla"${off ? ' disabled' : ''}>${shellIcon('minus')}</button>
    <button type="button" class="round" data-do="up" aria-label="Sihttemperatuur üles"${off ? ' disabled' : ''}>${shellIcon('plus')}</button>
  </div>`;
}

export const MODE_TEXT = { off: 'Väljas', heat: 'Küte', cool: 'Jahutus', auto: 'Automaatne' };
export function modeButtons(st) {
  const modes = (st.attributes && st.attributes.hvac_modes) || [];
  if (!modes.length) return '';
  return `<div class="modes" role="group" aria-label="Režiim">${modes.map(m => `<button type="button" data-do="mode:${esc(m)}" aria-pressed="${st.state === m}">${esc(MODE_TEXT[m] || m)}</button>`).join('')}</div>`;
}

/* ---------- cards ---------- */

// each card: { el, entities, update(hass) }; ctx carries what HA's frontend would know
// (names, areas, icons, the state formatter) and the demo's actions

function tileCard(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('div');
  el.className = 'card tile';
  el.dataset.entity = e;
  const toggles = conf.icon_tap_action && conf.icon_tap_action.action === 'toggle';
  const name = esc(ctx.nameOf(e));
  el.innerHTML = `${toggles ? `<button type="button" class="t-icon" data-do="toggle" aria-label="Lülita: ${name}">${ctx.iconOf(e)}</button>` : `<span class="t-icon">${ctx.iconOf(e)}</span>`}
    <button type="button" class="t-info"><span class="t-name">${name}</span><span class="t-state"></span></button>`;
  let last;
  return {
    el, entities: [e],
    update(hass) {
      const st = hass.states[e];
      if (st === last) return;
      last = st;
      el.style.setProperty('--c', stateColor(e, st));
      el.querySelector('.t-state').textContent = st ? ctx.format(st) : 'Puudub';
      const b = el.querySelector('button.t-icon');
      if (b) b.setAttribute('aria-pressed', String(!!st && st.state !== 'off' && st.state !== 'closed'));
    }
  };
}

function badge(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'badge';
  el.dataset.entity = e;
  el.innerHTML = `${ctx.iconOf(e)}<span class="b-text"><span class="b-name">${esc(ctx.nameOf(e))}</span><span class="b-state"></span></span>`;
  let last;
  return {
    el, entities: [e],
    update(hass) {
      const st = hass.states[e];
      el.hidden = !visible(conf, hass);
      if (st === last) return;
      last = st;
      el.style.setProperty('--c', stateColor(e, st));
      el.querySelector('.b-state').textContent = st ? ctx.format(st) : 'Puudub';
    }
  };
}

// HA's visibility conditions, the state kind only
function visible(conf, hass) {
  return (conf.visibility || []).every(c => c.condition !== 'state' || (hass.states[c.entity] && hass.states[c.entity].state === c.state));
}

function thermostatCard(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('div');
  el.className = 'card thermostat';
  el.dataset.entity = e;
  let last;
  return {
    el, entities: [e],
    update(hass) {
      const st = hass.states[e];
      if (!st || st === last) return;
      last = st;
      const focused = el.contains(document.activeElement) ? document.activeElement.dataset.do : null;
      el.innerHTML = `<button type="button" class="c-title" data-more>${esc(ctx.nameOf(e))}</button>${thermostat(e, st)}${modeButtons(st)}`;
      const again = focused && [...el.querySelectorAll('[data-do]')].find(b => b.dataset.do === focused);
      if (again && !again.disabled) again.focus();
    }
  };
}

export const ALARM_TEXT = { arm_home: 'Valvesta kodus', arm_away: 'Valvesta eemal', disarm: 'Võta valvest maha' };
function alarmCard(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('div');
  el.className = 'card alarm';
  el.dataset.entity = e;
  let last;
  return {
    el, entities: [e],
    update(hass) {
      const st = hass.states[e];
      if (!st || st === last) return;
      last = st;
      const focused = el.contains(document.activeElement) ? document.activeElement.dataset.do : null;
      const acts = st.state === 'disarmed' ? conf.states || ['arm_home', 'arm_away'] : ['disarm'];
      el.style.setProperty('--c', stateColor(e, st));
      el.innerHTML = `<button type="button" class="c-title" data-more>${esc(ctx.nameOf(e))}</button>
        <div class="a-state">${icon('alarm')}<span>${esc(ctx.format(st))}</span></div>
        <div class="a-actions">${acts.map(a => `<button type="button" data-do="${a}">${ALARM_TEXT[a]}</button>`).join('')}</div>`;
      const again = focused && (el.querySelector(`[data-do="${focused}"]`) || el.querySelector('[data-do]'));
      if (again) again.focus();
    }
  };
}

function pictureCard(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card picture';
  el.dataset.entity = e;
  el.innerHTML = `<span class="p-image" aria-hidden="true">${icon('camera')}</span>
    <span class="p-foot"><span class="p-name">${esc(ctx.nameOf(e))}</span><span class="p-state"></span></span>`;
  let last;
  return {
    el, entities: [e],
    update(hass) {
      const st = hass.states[e];
      if (st === last) return;
      last = st;
      el.querySelector('.p-state').textContent = st ? ctx.format(st) : 'Puudub';
    }
  };
}

function headingCard(conf) {
  const el = document.createElement('h2');
  el.className = 'heading';
  el.textContent = conf.heading;
  return { el, entities: [], update() {} };
}

function stackCard(conf, ctx) {
  const el = document.createElement('div');
  el.className = 'stack';
  const kids = conf.cards.map(c => card(c, ctx));
  kids.forEach(k => el.append(k.el));
  return { el, entities: kids.flatMap(k => k.entities), update: hass => kids.forEach(k => k.update(hass)) };
}

function unknownCard(conf) {
  const el = document.createElement('div');
  el.className = 'card unknown';
  el.textContent = `Tundmatu kaart: ${conf.type}`;
  return { el, entities: [], update() {} };
}

const CARDS = { tile: tileCard, heading: headingCard, 'horizontal-stack': stackCard, thermostat: thermostatCard, 'alarm-panel': alarmCard, 'picture-entity': pictureCard };
const card = (conf, ctx) => (CARDS[conf.type] || unknownCard)(conf, ctx);

/* ---------- views ---------- */

// a sections view: badges on top, then the sections in columns; one delegated listener sends
// taps to more-info or to the action a button names
export function renderSections(view, ctx) {
  const el = document.createElement('div');
  el.className = 'sections';
  const badges = (view.badges || []).map(b => badge(b, ctx));
  const parts = [...badges];
  if (badges.length) {
    const row = document.createElement('div');
    row.className = 'badges';
    badges.forEach(b => row.append(b.el));
    el.append(row);
  }
  const grid = document.createElement('div');
  grid.className = 'columns';
  for (const s of view.sections || []) {
    const sec = document.createElement('section');
    sec.className = 'section';
    for (const c of s.cards) {
      const k = card(c, ctx);
      parts.push(k);
      sec.append(k.el);
    }
    grid.append(sec);
  }
  el.append(grid);
  el.addEventListener('click', ev => {
    const host = ev.target.closest('[data-entity]');
    if (!host) return;
    const b = ev.target.closest('button[data-do]');
    if (b && host.contains(b)) { if (!b.disabled) ctx.act(host.dataset.entity, b.dataset.do); return; }
    ctx.moreInfo(host.dataset.entity);
  });
  return { el, update: hass => parts.forEach(p => p.update(hass)) };
}
