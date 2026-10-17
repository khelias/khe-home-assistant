// Renders the generated dashboard (dashboard.json) the way Home Assistant's frontend does: a
// sections view is columns of sections, each a 12-column grid per column it spans with 56 px
// rows, its cards placed by their grid_options or their type's default size. The card types,
// tile features, badges, visibility conditions and tap actions are the ones the generator uses;
// the charts are demo/charts.js. Every card updates from hass only when a state it shows
// changed. The pure parts (conditions, actions, markdown, state text) need no DOM, so the tests
// load this module in Node.
import { svg, iconFor, entityIcon } from './icons.js?v=__DEMO_VERSION__';
import { CHARTS } from './charts.js?v=__DEMO_VERSION__';
import { canToggle } from './sim.js?v=__DEMO_VERSION__';

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const domainOf = entity => entity.split('.')[0];
const nf = d => new Intl.NumberFormat('et-EE', { minimumFractionDigits: d, maximumFractionDigits: d });
const nf1 = nf(1);
const rtf = new Intl.RelativeTimeFormat('et-EE', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('et-EE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const CARD_TYPES = ['tile', 'heading', 'horizontal-stack', 'vertical-stack', 'entities', 'markdown', 'button', 'statistics-graph', 'history-graph', 'custom:apexcharts-card', 'weather-forecast', 'picture-glance', 'custom:advanced-camera-card', 'custom:house3d-card', 'custom:khe-summary-card', 'custom:khe-price-card', 'custom:khe-tile-card'];
export const FEATURE_TYPES = ['cover-open-close', 'light-brightness', 'select-options', 'numeric-input', 'target-temperature', 'bar-gauge', 'alarm-modes'];
export const ACTIONS = ['more-info', 'toggle', 'navigate', 'perform-action', 'url', 'none'];

/* ---------- state text, as HA's formatEntityState in Estonian ---------- */

const TEXT = {
  on: 'Sees', off: 'Väljas', idle: 'Ootel', home: 'Kodus', not_home: 'Eemal', open: 'Avatud', closed: 'Suletud',
  opening: 'Avaneb', closing: 'Sulgub', heat: 'Küte', eco: 'Säästlik', performance: 'Jõudlus',
  disarmed: 'Valvest maas', armed_home: 'Valves (kodus)', armed_away: 'Valves (eemal)', armed_night: 'Valves (öö)',
  triggered: 'Häire!', playing: 'Mängib', paused: 'Pausil', standby: 'Ootel', unknown: 'Teadmata', unavailable: 'Pole saadaval',
  cloudy: 'Pilves', partlycloudy: 'Vahelduv pilvisus', rainy: 'Vihmane', sunny: 'Päikseline'
};
const BINARY = {
  door: ['Suletud', 'Avatud'], motion: ['Vaikne', 'Liikumine'], smoke: ['Korras', 'Suits!'], problem: ['OK', 'Probleem'],
  connectivity: ['Ühenduseta', 'Ühendatud'], tamper: ['Korras', 'Rikkumine'], sound: ['Vaikne', 'Heli']
};

function ago(iso, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  if (s > -45) return 'just praegu';
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute');
  if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
export { ago };

// a number as its state string carries it, with the Estonian decimal comma
function number(v) {
  const s = String(v), n = Number(s);
  if (s === '' || !Number.isFinite(n)) return null;
  return nf((s.split('.')[1] || '').length).format(n);
}

export function formatState(st) {
  if (!st) return 'Puudub';
  const a = st.attributes || {}, s = st.state, d = domainOf(st.entity_id);
  if (d === 'binary_sensor' && BINARY[a.device_class]) return BINARY[a.device_class][s === 'on' ? 1 : 0];
  if (d === 'update') return s === 'on' ? 'Uuendus saadaval' : s === 'off' ? 'Ajakohane' : TEXT[s] || s;
  if (d === 'button' || (d === 'sensor' && a.device_class === 'timestamp')) return s === 'unknown' ? 'Pole vajutatud' : ago(s);
  if (d === 'input_datetime') return a.has_date ? dtf.format(new Date(s.replace(' ', 'T'))) : s.slice(0, 5);
  if (d === 'water_heater') return `${TEXT[s] || s}, ${nf(0).format(a.temperature)} °C`;
  if (d === 'light' && s === 'on' && a.brightness) return `Sees, ${nf(0).format(a.brightness / 2.55)} %`;
  const n = number(s);
  if (n !== null) return a.unit_of_measurement ? `${n} ${a.unit_of_measurement}` : n;
  return TEXT[s] ?? s;
}

// one state_content item: the state, the name, a time, or an attribute as HA shows it
export function contentPart(key, st, name) {
  if (!st) return '';
  if (key === 'state') return formatState(st);
  if (key === 'name') return name;
  if (key === 'last_changed' || key === 'last_updated') return ago(st[key]);
  const v = st.attributes[key];
  if (v === undefined || v === null) return '';
  if (key === 'current_temperature' || key === 'temperature') return `${nf1.format(v)} °C`;
  return typeof v === 'number' ? nf1.format(v) : String(v);
}

/* ---------- colours: HA's named colours and its state colours ---------- */

const NAMED = { red: '#f44336', green: '#4caf50', orange: '#ff9800', blue: '#2196f3', purple: '#926bc7', grey: '#9e9e9e', 'light-blue': '#03a9f4', amber: '#ffc107', teal: '#009688' };
const INACTIVE = new Set(['off', 'closed', 'idle', 'standby', 'disarmed', 'not_home', 'unavailable', 'unknown']);

export function isActive(entity, st) {
  if (!st) return false;
  const d = domainOf(entity);
  if (['sensor', 'number', 'input_number', 'select', 'input_select', 'input_datetime', 'weather', 'button', 'camera'].includes(d)) return true;
  return !INACTIVE.has(st.state);
}

export function stateColor(entity, st) {
  if (!st) return 'var(--state-inactive-color)';
  const s = st.state, a = st.attributes || {};
  switch (domainOf(entity)) {
    case 'light': case 'switch': case 'input_boolean': return s === 'on' ? 'var(--state-on-color)' : 'var(--state-inactive-color)';
    case 'fan': return s === 'on' ? 'var(--state-fan-color)' : 'var(--state-inactive-color)';
    case 'cover': return s === 'closed' ? 'var(--state-inactive-color)' : 'var(--state-cover-color)';
    case 'climate': case 'water_heater': return s === 'off' ? 'var(--state-inactive-color)' : 'var(--state-heat-color)';
    case 'binary_sensor': return s !== 'on' ? 'var(--state-inactive-color)' : ['smoke', 'problem', 'tamper', 'sound'].includes(a.device_class) ? 'var(--state-alert-color)' : a.device_class === 'connectivity' ? 'var(--state-armed-color)' : 'var(--state-on-color)';
    case 'alarm_control_panel': return s === 'triggered' ? 'var(--state-alert-color)' : s === 'disarmed' ? 'var(--state-inactive-color)' : 'var(--state-armed-color)';
    case 'device_tracker': case 'person': return s === 'home' ? 'var(--state-armed-color)' : 'var(--state-inactive-color)';
    case 'update': return s === 'on' ? 'var(--state-update-color)' : 'var(--state-inactive-color)';
    case 'media_player': return s === 'off' ? 'var(--state-inactive-color)' : 'var(--state-media-color)';
    default: return 'var(--primary-color)';
  }
}

// a card's colour: its own named colour while the entity is active, grey when not or "disabled"
export function cardColor(conf, entity, st) {
  if (conf.color === 'disabled') return 'var(--state-inactive-color)';
  if (!isActive(entity, st)) return 'var(--state-inactive-color)';
  if (conf.color) return NAMED[conf.color] || conf.color;
  return stateColor(entity, st);
}

/* ---------- visibility conditions ---------- */

const asList = v => (Array.isArray(v) ? v : [v]);
export function visible(conditions, states) {
  return (conditions || []).every(c => {
    const st = c.entity ? states[c.entity] : null;
    const s = st ? st.state : 'unavailable';
    switch (c.condition) {
      case 'state':
        if (c.state !== undefined) return asList(c.state).map(String).includes(s);
        if (c.state_not !== undefined) return !asList(c.state_not).map(String).includes(s);
        return true;
      case 'numeric_state': {
        const n = Number(s);
        if (s === '' || !Number.isFinite(n)) return false;
        return (c.above === undefined || n > c.above) && (c.below === undefined || n < c.below);
      }
      case 'or': return (c.conditions || []).some(x => visible([x], states));
      case 'and': return visible(c.conditions, states);
      default: return true;
    }
  });
}

/* ---------- actions ---------- */

// the action a tap runs, with HA's defaults: the body opens more-info, a tile's icon toggles
// what can be toggled; a button card toggles
export function actionFor(conf, which = 'tap') {
  const own = which === 'icon' ? conf.icon_tap_action : conf.tap_action;
  if (own) return own;
  const e = conf.entity;
  if (which === 'icon') return { action: e && canToggle(e) ? 'toggle' : 'more-info' };
  if (conf.type === 'button') return { action: e ? 'toggle' : 'none' };
  return { action: e ? 'more-info' : 'none' };
}

// api: { confirm(text) -> Promise<bool>, moreInfo(entity), toggle(entity), callService(d, s, data, target), navigate(path), openUrl(url) }
export async function runAction(action, entity, api) {
  if (!action || action.action === 'none') return false;
  if (action.confirmation && !(await api.confirm(action.confirmation.text || 'Kas oled kindel?'))) return false;
  switch (action.action) {
    case 'more-info': api.moreInfo(action.entity || entity); break;
    case 'toggle': api.toggle(action.entity || entity); break;
    case 'navigate': api.navigate(action.navigation_path); break;
    case 'url': api.openUrl(action.url_path); break;
    case 'perform-action': {
      const [d, s] = action.perform_action.split('.');
      api.callService(d, s, action.data || {}, action.target || {});
      break;
    }
    default: return false;
  }
  return true;
}

const acting = a => a && a.action && a.action !== 'none';

/* ---------- markdown: the subset the sample texts use ---------- */

const mdEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(s) {
  return mdEsc(s)
    .replace(/&lt;ha-icon icon=&quot;mdi:([a-z0-9-]+)&quot;&gt;&lt;\/ha-icon&gt;/g, (_, n) => svg(n, 'md-icon'))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
export function markdown(text) {
  const out = [];
  for (const block of String(text).split(/\n{2,}/)) {
    const b = block.trim();
    if (!b) continue;
    const alert = /^<ha-alert alert-type="(success|info|warning|error)">([\s\S]*)<\/ha-alert>$/.exec(b);
    if (alert) { out.push(`<div class="md-alert ${alert[1]}">${svg(alert[1] === 'success' ? 'check-circle' : 'alert-circle', 'md-alert-icon')}<span>${inline(alert[2])}</span></div>`); continue; }
    const h = /^(#{1,3}) (.*)$/.exec(b);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const lines = b.split('\n');
    if (lines.every(l => l.trim().startsWith('|'))) {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const align = cells(lines[1] || '').map(c => (c.endsWith(':') ? 'right' : 'left'));
      const row = (l, tag) => `<tr>${cells(l).map((c, i) => `<${tag} style="text-align:${align[i] || 'left'}">${inline(c)}</${tag}>`).join('')}</tr>`;
      out.push(`<table><thead>${row(lines[0], 'th')}</thead><tbody>${lines.slice(2).map(l => row(l, 'td')).join('')}</tbody></table>`);
      continue;
    }
    if (lines.every(l => /^- /.test(l))) { out.push(`<ul>${lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`); continue; }
    out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

/* ---------- grid placement ---------- */

// [columns, rows] a card takes in a section, before its grid_options
function defaultSize(conf) {
  if (conf.type === 'tile') {
    const feats = conf.features_position === 'inline' ? 0 : (conf.features || []).length;
    return [6, (conf.vertical ? 2 : 1) + feats];
  }
  if (conf.type === 'heading') return ['full', 'auto'];
  return [12, 'auto'];
}
export function gridSize(conf) {
  const [c, r] = defaultSize(conf), g = conf.grid_options || {};
  return [g.columns ?? c, g.rows ?? r];
}
// the column span is set by renderSections' layout, which knows the section's column count
function place(el, conf) {
  const [c, r] = gridSize(conf);
  el.dataset.span = String(c);
  if (c === 'full') el.style.gridColumn = '1 / -1';
  if (r !== 'auto') { el.style.gridRow = `span ${r}`; el.style.height = `calc(${r} * var(--row) + ${r - 1} * var(--gap))`; }
}

/* ---------- cards ---------- */

// each card: { el, update(hass) }; ctx: { nameOf, act(action, entity), series, now(), resize(el, fn), house3d(conf), khe(conf) }
const tracked = (entities, fn) => {
  let last = [];
  return hass => {
    const now = entities.map(e => hass.states[e]);
    if (now.length === last.length && now.every((s, i) => s === last[i])) return;
    last = now;
    fn(hass);
  };
};

function withVisibility(conf, card) {
  if (!conf.visibility) return card;
  const inner = card.update;
  return { el: card.el, update: hass => { card.el.hidden = !visible(conf.visibility, hass.states); inner(hass); } };
}

const tappable = (cls, act, label) => (acting(act) ? `<button type="button" class="${cls}" data-tap="${cls}" aria-label="${esc(label)}">` : `<span class="${cls}">`);
const closeTap = act => (acting(act) ? '</button>' : '</span>');

function tileCard(conf, ctx) {
  const e = conf.entity;
  const el = document.createElement('div');
  el.className = `card tile${conf.vertical ? ' vertical' : ''}${conf.features_position === 'inline' ? ' inline' : ''}`;
  const tap = actionFor(conf, 'tap'), iconTap = actionFor(conf, 'icon');
  const name = () => conf.name || ctx.nameOf(e);
  el.innerHTML = `<div class="t-main">${tappable('t-icon', iconTap, name())}${closeTap(iconTap)}${tappable('t-info', tap, name())}<span class="t-name"></span><span class="t-state"></span>${closeTap(tap)}</div>${(conf.features || []).length ? '<div class="t-features"></div>' : ''}`;
  el.querySelector('.t-name').textContent = name();
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-tap]');
    if (b) ctx.act(b.dataset.tap === 't-icon' ? iconTap : tap, e);
  });
  const feats = (conf.features || []).map(f => feature(f, e, ctx));
  feats.forEach(f => el.querySelector('.t-features').append(f.el));
  return {
    el,
    update: tracked([e], hass => {
      const st = hass.states[e];
      el.style.setProperty('--c', cardColor(conf, e, st));
      el.querySelector('.t-icon').innerHTML = svg(iconFor(conf, e, st));
      const sc = conf.state_content ? asList(conf.state_content) : ['state'];
      el.querySelector('.t-state').textContent = conf.hide_state ? '' : sc.map(k => contentPart(k, st, name())).filter(Boolean).join(' · ');
      el.querySelector('.t-state').hidden = !!conf.hide_state;
      el.classList.toggle('off', !isActive(e, st));
      feats.forEach(f => f.update(st));
    })
  };
}

// tile features: each acts in place through ctx.act, as HA's do
function feature(f, e, ctx) {
  const el = document.createElement('div');
  el.className = `feature f-${f.type}`;
  const call = (domain, service, data = {}) => ctx.act({ action: 'perform-action', perform_action: `${domain}.${service}`, target: { entity_id: e }, data }, e);
  const d = domainOf(e);
  let update = () => {};
  switch (f.type) {
    case 'cover-open-close':
      el.innerHTML = [['open_cover', 'arrow-up', 'Ava'], ['stop_cover', 'stop', 'Peata'], ['close_cover', 'arrow-down', 'Sulge']]
        .map(([s, i, l]) => `<button type="button" data-s="${s}" aria-label="${l}">${svg(i)}</button>`).join('');
      el.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) call('cover', b.dataset.s); });
      update = st => {
        el.querySelector('[data-s="open_cover"]').disabled = st && st.state === 'opening';
        el.querySelector('[data-s="close_cover"]').disabled = st && st.state === 'closing';
      };
      break;
    case 'light-brightness':
      el.innerHTML = '<input type="range" min="1" max="100" aria-label="Heledus"><span class="fill"></span>';
      el.querySelector('input').addEventListener('change', ev => call('light', 'turn_on', { brightness_pct: Number(ev.target.value) }));
      update = st => {
        const v = st && st.state === 'on' ? Math.round((st.attributes.brightness || 255) / 2.55) : 0;
        el.querySelector('input').value = String(v || 1);
        el.style.setProperty('--v', `${v}%`);
      };
      break;
    case 'select-options':
      el.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) call(d, 'select_option', { option: b.dataset.o }); });
      update = st => {
        const opts = (st && st.attributes.options) || [];
        el.innerHTML = opts.map(o => `<button type="button" data-o="${esc(o)}" aria-pressed="${st.state === o}">${esc(o)}</button>`).join('');
      };
      break;
    case 'numeric-input': case 'target-temperature': {
      const temp = f.type === 'target-temperature';
      el.innerHTML = `<button type="button" data-d="-1" aria-label="Vähem">${svg('minus')}</button><span class="value"></span><button type="button" data-d="1" aria-label="Rohkem">${svg('plus')}</button>`;
      let cur = null;
      el.addEventListener('click', ev => {
        const b = ev.target.closest('button');
        if (!b || !cur) return;
        const a = cur.attributes, sign = Number(b.dataset.d);
        if (temp) call(d, 'set_temperature', { temperature: a.temperature + sign * (a.target_temp_step || 1) });
        else call(d, 'set_value', { value: Number(cur.state) + sign * (a.step || 1) });
      });
      update = st => {
        cur = st;
        if (!st) return;
        const a = st.attributes;
        el.querySelector('.value').textContent = temp ? `${nf(0).format(a.temperature)} °C` : formatState(st);
        const v = temp ? a.temperature : Number(st.state), lo = temp ? a.min_temp : a.min, hi = temp ? a.max_temp : a.max;
        el.querySelector('[data-d="-1"]').disabled = v <= lo;
        el.querySelector('[data-d="1"]').disabled = v >= hi;
      };
      break;
    }
    case 'bar-gauge':
      el.innerHTML = '<span class="bar"><span class="fill"></span></span>';
      update = st => {
        const v = st ? Number(st.state) : 0, lo = f.min ?? 0, hi = f.max ?? 100;
        el.style.setProperty('--v', `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`);
      };
      break;
    case 'alarm-modes': {
      const MODE = { armed_away: ['shield-lock', 'alarm_arm_away', 'Valves (eemal)'], armed_home: ['shield-home', 'alarm_arm_home', 'Valves (kodus)'], armed_night: ['shield-moon', 'alarm_arm_night', 'Valves (öö)'], disarmed: ['shield-off', 'alarm_disarm', 'Valvest maas'] };
      const modes = (f.modes || Object.keys(MODE)).filter(m => MODE[m]);
      el.innerHTML = modes.map(m => `<button type="button" data-m="${m}" aria-label="${MODE[m][2]}" title="${MODE[m][2]}">${svg(MODE[m][0])}</button>`).join('');
      el.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) call('alarm_control_panel', MODE[b.dataset.m][1]); });
      update = st => modes.forEach(m => el.querySelector(`[data-m="${m}"]`).setAttribute('aria-pressed', String(!!st && st.state === m)));
      break;
    }
    default:
      el.textContent = f.type;
  }
  return { el, update };
}

// HA's entity badge: icon, an optional name over the state, coloured while active
function badge(conf, ctx, cls = 'badge') {
  const e = conf.entity;
  const tap = actionFor(conf, 'tap');
  const el = document.createElement(acting(tap) ? 'button' : 'div');
  if (acting(tap)) { el.type = 'button'; el.addEventListener('click', () => ctx.act(tap, e)); }
  el.className = cls;
  const name = () => conf.name || ctx.nameOf(e);
  const showName = conf.show_name ?? false, showState = conf.show_state ?? true;
  const watched = [e, ...(JSON.stringify(conf.visibility || []).match(/"entity":"[^"]+"/g) || []).map(m => m.slice(10, -1))];
  return {
    el,
    update: tracked(watched, hass => {
      const st = hass.states[e];
      el.hidden = !visible(conf.visibility, hass.states);
      el.style.setProperty('--c', cardColor(conf, e, st));
      const content = conf.state_content ? asList(conf.state_content).map(k => contentPart(k, st, name())).join(' · ') : showState ? formatState(st) : '';
      const label = conf.state_content ? '' : showName ? name() : '';
      el.innerHTML = `${conf.show_icon === false ? '' : svg(iconFor(conf, e, st))}<span class="b-text">${label && content ? `<span class="b-name">${esc(label)}</span>` : ''}<span class="b-state">${esc(content || label)}</span></span>`;
      el.setAttribute('aria-label', content && content !== name() ? `${name()}: ${content}` : name());
    })
  };
}

function headingCard(conf, ctx) {
  const tap = conf.tap_action;
  const el = document.createElement('div');
  el.className = `heading ${conf.heading_style === 'subtitle' ? 'subtitle' : 'title'}`;
  const text = `${esc(conf.heading)}${acting(tap) ? svg('chevron-right', 'h-more') : ''}`;
  el.innerHTML = acting(tap) ? `<button type="button" class="h-text">${text}</button>` : `<span class="h-text">${text}</span>`;
  if (acting(tap)) el.querySelector('button').addEventListener('click', () => ctx.act(tap));
  const badges = (conf.badges || []).map(b => badge(b, ctx, 'h-badge'));
  if (badges.length) {
    const row = document.createElement('div');
    row.className = 'h-badges';
    badges.forEach(b => row.append(b.el));
    el.append(row);
  }
  return { el, update: hass => badges.forEach(b => b.update(hass)) };
}

function stackCard(conf, ctx) {
  const el = document.createElement('div');
  el.className = conf.type === 'horizontal-stack' ? 'hstack' : 'vstack';
  const kids = conf.cards.map(c => card(c, ctx));
  kids.forEach(k => el.append(k.el));
  return { el, update: hass => kids.forEach(k => k.update(hass)) };
}

function entitiesCard(conf, ctx) {
  const el = document.createElement('div');
  el.className = 'card entities';
  const rows = conf.entities.map(r => (typeof r === 'string' ? { entity: r } : r));
  el.innerHTML = `${conf.title ? `<h3 class="c-title">${esc(conf.title)}</h3>` : ''}<div class="rows"></div>`;
  const box = el.querySelector('.rows');
  const parts = rows.map(r => {
    if (r.type === 'section') {
      const s = document.createElement('div');
      s.className = 'e-section';
      s.textContent = r.label || '';
      box.append(s);
      return null;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'e-row';
    b.addEventListener('click', () => ctx.act(r.tap_action || { action: 'more-info' }, r.entity));
    box.append(b);
    return { r, b };
  }).filter(Boolean);
  return {
    el,
    update: tracked(parts.map(p => p.r.entity), hass => parts.forEach(({ r, b }) => {
      const st = hass.states[r.entity], name = r.name || ctx.nameOf(r.entity);
      const color = conf.state_color || domainOf(r.entity) === 'update' ? stateColor(r.entity, st) : 'var(--state-icon-color)';
      const sub = r.secondary_info === 'last-changed' && st ? `<span class="e-sub">${esc(ago(st.last_changed))}</span>` : '';
      b.innerHTML = `<span class="e-icon" style="--c:${color}">${svg(iconFor(r, r.entity, st))}</span><span class="e-name"><span>${esc(name)}</span>${sub}</span><span class="e-state">${esc(formatState(st))}</span>`;
    }))
  };
}

function markdownCard(conf) {
  const el = document.createElement('div');
  el.className = 'card markdown';
  el.innerHTML = markdown(conf.content);
  return { el, update() {} };
}

function buttonCard(conf, ctx) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card button-card';
  el.innerHTML = `${svg(iconFor(conf, conf.entity, null))}<span>${esc(conf.name || '')}</span>`;
  el.addEventListener('click', () => ctx.act(actionFor(conf), conf.entity));
  return { el, update() {} };
}

function chartCard(conf, ctx) {
  const el = document.createElement('div');
  el.className = `card chart-card c-${conf.type.replace(':', '-')}`;
  const draw = () => { el.innerHTML = CHARTS[conf.type](conf, ctx.series, ctx.now(), Math.max(240, Math.round(el.clientWidth - 24)), ctx.nameOf); };
  ctx.resize(el, draw);
  return { el, update() { if (!el.firstChild) draw(); } };
}

function pictureGlance(conf, ctx) {
  const el = document.createElement('div');
  el.className = 'card picture';
  const tap = actionFor(conf);
  el.innerHTML = `<button type="button" class="p-image" aria-label="${esc(conf.title || '')}">${svg('cctv')}</button>
    <div class="p-foot"><span class="p-name">${esc(conf.title || '')}</span><span class="p-ents"></span></div>`;
  el.querySelector('.p-image').addEventListener('click', () => ctx.act(tap, conf.entity));
  const ents = (conf.entities || []).map(x => (typeof x === 'string' ? { entity: x } : x));
  const box = el.querySelector('.p-ents');
  const btns = ents.map(x => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'p-ent';
    b.addEventListener('click', () => ctx.act({ action: 'more-info' }, x.entity));
    box.append(b);
    return [x, b];
  });
  return {
    el,
    update: tracked(ents.map(x => x.entity), hass => btns.forEach(([x, b]) => {
      const st = hass.states[x.entity];
      b.style.setProperty('--c', isActive(x.entity, st) ? 'var(--state-on-color)' : 'rgba(255, 255, 255, .7)');
      b.innerHTML = svg(entityIcon(x.entity, st));
      b.setAttribute('aria-label', `${ctx.nameOf(x.entity)}: ${formatState(st)}`);
    }))
  };
}

// the camera viewer: no stream in the demo, the camera's name in the status bar, and the
// arrows the card's swipe moves on with
function cameraCard(conf) {
  const cams = conf.cameras || [];
  let i = 0;
  const el = document.createElement('div');
  el.className = 'camera-card';
  el.innerHTML = `<div class="cam-stage" role="img" aria-label="Kaamerapildi asemik">${svg('cctv')}<p>Päris majas on siin kaamera otsepilt, mida saab suumida.</p></div>
    <div class="cam-bar"><button type="button" data-d="-1" aria-label="Eelmine kaamera">${svg('arrow-left')}</button><span class="cam-name"></span><button type="button" data-d="1" aria-label="Järgmine kaamera">${svg('chevron-right')}</button></div>`;
  const show = () => { el.querySelector('.cam-name').textContent = (cams[i] || {}).title || ''; };
  el.querySelector('.cam-bar').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b || !cams.length) return;
    i = (i + Number(b.dataset.d) + cams.length) % cams.length;
    show();
  });
  show();
  return { el, update() {} };
}

function unknownCard(conf) {
  const el = document.createElement('div');
  el.className = 'card unknown';
  el.textContent = `Tundmatu kaart: ${conf.type}`;
  return { el, update() {} };
}

const kheCard = (conf, ctx) => ctx.khe(conf);

const CARDS = {
  tile: tileCard, heading: headingCard, 'horizontal-stack': stackCard, 'vertical-stack': stackCard, entities: entitiesCard,
  markdown: markdownCard, button: buttonCard, 'statistics-graph': chartCard, 'history-graph': chartCard,
  'custom:apexcharts-card': chartCard, 'weather-forecast': chartCard, 'picture-glance': pictureGlance,
  'custom:advanced-camera-card': cameraCard, 'custom:house3d-card': (conf, ctx) => ctx.house3d(conf),
  'custom:khe-summary-card': kheCard, 'custom:khe-price-card': kheCard, 'custom:khe-tile-card': kheCard
};

export function card(conf, ctx) {
  return withVisibility(conf, (CARDS[conf.type] || unknownCard)(conf, ctx));
}

/* ---------- views ---------- */

// HA's sections view: columns of 320-500 px, as many as fit up to max_columns; a section spans
// column_span of them, or all when fewer fit
export function columnsFor(width, max) {
  return Math.max(1, Math.min(max || 4, Math.floor((width + 32) / (320 + 32))));
}

export function renderSections(view, ctx) {
  const el = document.createElement('div');
  el.className = 'sections';
  const parts = [];
  const badges = (view.badges || []).map(b => badge(b, ctx));
  if (badges.length) {
    const row = document.createElement('div');
    row.className = `badges${(view.header || {}).badges_wrap === 'scroll' ? ' scroll' : ''}`;
    badges.forEach(b => row.append(b.el));
    el.append(row);
    parts.push(...badges);
  }
  const grid = document.createElement('div');
  grid.className = 'columns';
  const secs = (view.sections || []).map(s => {
    const sec = document.createElement('section');
    sec.className = 'section';
    for (const c of s.cards) {
      const k = card(c, ctx);
      place(k.el, c);
      parts.push(k);
      sec.append(k.el);
    }
    if (s.visibility) parts.push({ update: hass => { sec.hidden = !visible(s.visibility, hass.states); } });
    grid.append(sec);
    return [s, sec];
  });
  el.append(grid);
  const layout = width => {
    const n = columnsFor(width, view.max_columns);
    el.style.setProperty('--n', String(n));
    for (const [s, sec] of secs) {
      const span = Math.min(s.column_span || 1, n);
      sec.style.gridColumn = `span ${span}`;
      sec.style.setProperty('--cols', String(12 * span));
      for (const c of sec.children) if (c.dataset.span && c.dataset.span !== 'full') c.style.gridColumn = `span ${Math.min(Number(c.dataset.span), 12 * span)}`;
    }
  };
  // measured on the view, not on this box, whose width follows the column count
  ctx.resize(el, () => layout((el.parentElement || el).clientWidth - 32));
  return { el, update: hass => parts.forEach(p => p.update(hass)), layout };
}

// a panel view: its one card fills the area under the bar
export function renderPanel(view, ctx) {
  const k = card(view.cards[0], ctx);
  k.el.classList.add('panel-card');
  return k;
}
