// Home Assistant cards of the redesigned views (ADR-002, ADR-005): khe-summary-card,
// khe-price-card, khe-tile-card and, for Kodu A3, khe-chips-card, khe-heading-card and
// khe-status-card, with `style: a3` drawing glass boxes and a tap opening a history sheet.
// The A2 and A3 designs are linked from the ADRs. Actions go through HA as a hass-action event, so HA runs the confirmation,
// more-info, navigation and service call. No build step and no CDN; the pure helpers are
// exported for the Node tests, where there is no DOM.
// Bump KHE_CARDS_VERSION on every change to this file, and the same ?v= on the Lovelace
// resource URL: HA's /local and the phone app cache aggressively.
export const KHE_CARDS_VERSION = 3;

/* ---------- palette: the canvas's, with KHE Family's ink and paper ---------- */

const LIT = {
  light: { warm: ['#F6D9C4', '#A3471A'], water: ['#CFE3F0', '#1F5F8A'], green: ['#CDEBDD', '#1F6B52'], violet: ['#E3D9F2', '#5B3E8F'] },
  dark: { warm: ['#E9A06B', '#2A1608'], water: ['#7DB8E0', '#0A2232'], green: ['#6CC49E', '#0A2419'], violet: ['#B9A3E3', '#1E1235'] }
};
const PALETTES = {
  light: {
    ink: '#17191a', ink2: '#3d4241', muted: '#4E5B56', rule: '#dedbd3', card: '#FFFFFF', inset: '#F2F5F3',
    tile: '#EEF2F0', tileLit: '#FFFFFF', disc: 'rgba(24,33,30,0.08)', icon: '#3A4642', accent: '#1F6B52', onAccent: '#FFFFFF',
    cheap: '#2F8A66', mid: '#C9A03A', high: '#C4572B'
  },
  dark: {
    ink: '#eef1f0', ink2: '#c4cac7', muted: '#9BA8A3', rule: '#232827', card: '#161C1A', inset: '#1E2623',
    tile: '#141917', tileLit: '#26302C', disc: '#232B28', icon: '#9BA8A3', accent: '#6CC49E', onAccent: '#0b0d0d',
    cheap: '#4FAE84', mid: '#C9A03A', high: '#D46A3F'
  }
};

// the palette for HA's dark flag: base colours plus [disc, icon] per lit colour
export function palette(dark) {
  const mode = dark ? 'dark' : 'light';
  return { ...PALETTES[mode], lit: LIT[mode], dark: !!dark };
}
// blue is the water pair: a shield reads as blue, not as a temperature
const litPair = (pal, color) => pal.lit[color === 'blue' ? 'water' : color] || pal.lit.green;

const cssVars = pal => `:host{${Object.entries(pal).filter(([, v]) => typeof v === 'string').map(([k, v]) => `--${k}:${v}`).join(';')}}`;

/* ---------- icons: 24-px stroke drawings from the canvas ---------- */

const SHIELD = '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/>';
const ICONS = {
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  shield: SHIELD,
  'shield-check': `${SHIELD}<path d="M9 12l2 2 4-4"/>`,
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3-1 5M14 12c4 0 7 1 7 4 0 2-3 2-5-1M12 14c0 4-1 7-4 7-2 0-2-3 1-5M10 12c-4 0-7-1-7-4 0-2 3-2 5 1"/>',
  pergola: '<path d="M3 9h18M5 9v12M19 9v12M3 5h18"/><path d="M7 13h10M7 17h10"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  thermometer: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 2.2 5 5"/>',
  alert: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
  person: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/>',
  roof: '<path d="M3 9h18M5 9v11M19 9v11M3 9l2-4h14l2 4M8 9v3M12 9v3M16 9v3"/>',
  vent: '<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 16h7"/>',
  power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  waves: '<path d="M7 4c-2 3 2 5 0 8s2 5 0 8M12 4c-2 3 2 5 0 8s2 5 0 8M17 4c-2 3 2 5 0 8s2 5 0 8"/>',
  supply: '<path d="M4 12h12M12 8l4 4-4 4M20 5v14"/>',
  extract: '<path d="M8 12h12M16 8l4 4-4 4M4 5v14"/>',
  wash: '<path d="M5 3h14v18H5zM5 7h14M12 15m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"/>',
  sauna: '<path d="M4 20h16M6 15h12v5H6zM9 4c-1 2 1 3 0 5M12 4c-1 2 1 3 0 5M15 4c-1 2 1 3 0 5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>'
};
const icon = (key, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] || ICONS.bolt}</svg>`;

/* ---------- text ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const NO_VALUE = new Set(['unavailable', 'unknown', '']);
const hasValue = st => !!st && !NO_VALUE.has(st.state);
const stateOf = (states, entity) => (states[entity] || {}).state;

// "a", "a ja b", "a, b ja c"
export function joinEt(list) {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} ja ${list[list.length - 1]}`;
}

// a number with the Estonian decimal comma, as many decimals as given or as the string carries
const NF = [0, 1, 2].map(d => new Intl.NumberFormat('et-EE', { minimumFractionDigits: d, maximumFractionDigits: d }));
export function formatNumber(v, decimals) {
  const s = String(v ?? ''), n = Number(s);
  if (s.trim() === '' || !Number.isFinite(n)) return null;
  return NF[Math.min(2, decimals ?? (s.split('.')[1] || '').length)].format(n);
}
const withUnit = (n, unit) => (unit === '°C' ? `${n}°` : unit ? `${n} ${unit}` : n);

// the lower-case state words the canvas uses in a tile's second line; HA's formatEntityState
// capitalises and names each armed mode, where the design wants one "valves"
const WORDS = {
  on: 'sees', off: 'väljas', open: 'lahti', closed: 'kinni', opening: 'avaneb', closing: 'sulgub', playing: 'mängib',
  paused: 'pausil', idle: 'ootel', standby: 'ootel', buffering: 'laeb', home: 'kodus', not_home: 'eemal', disarmed: 'valveta',
  arming: 'valvestub', pending: 'sisenemisviivitus', triggered: 'häire', heat: 'küte', eco: 'säästlik',
  performance: 'kiirsoojendus', unknown: 'teadmata', unavailable: 'pole saadaval'
};
export function stateWord(st) {
  if (!st) return WORDS.unavailable;
  const s = st.state;
  if (s.startsWith('armed_')) return 'valves';
  if (WORDS[s]) return WORDS[s];
  const n = formatNumber(s);
  return n === null ? s : withUnit(n, (st.attributes || {}).unit_of_measurement);
}
const TEMPERATURE_ATTRS = new Set(['current_temperature', 'temperature']);
function attrText(st, key) {
  const v = st && st.attributes ? st.attributes[key] : undefined;
  if (v === undefined || v === null || v === '') return '';
  const n = typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? formatNumber(v) : null;
  if (n === null) return String(v);
  return TEMPERATURE_ATTRS.has(key) ? `${n}°` : n;
}

/* ---------- actions: what a tap hands to HA ---------- */

// The hass-action event detail HA's handleAction takes (frontend src/state/action-mixin.ts):
// it reads config.tap_action for action 'tap' and config.entity for more-info and toggle.
const acting = a => !!a && a.action !== 'none';
export function actionDetail(entity, tapAction) {
  if (!acting(tapAction)) return null;
  return { config: { ...(entity ? { entity } : {}), tap_action: tapAction }, action: 'tap' };
}

// a link to another view; none when the config names no path
const navigate = path => (path ? actionDetail(null, { action: 'navigate', navigation_path: path }) : null);

// a tile's body or icon tap; the icon does what the body does unless told otherwise
export function tileAction(conf, which = 'tap') {
  const body = conf.tap_action || { action: 'more-info' };
  return actionDetail(conf.entity, which === 'icon' && conf.icon_tap_action ? conf.icon_tap_action : body);
}

// a mode button: nothing for the running mode, else select_option after its confirmation
export function modeAction(entity, mode, current) {
  if (!mode || mode.option === current) return null;
  return actionDetail(entity, {
    action: 'perform-action',
    perform_action: 'select.select_option',
    target: { entity_id: entity },
    data: { option: mode.option },
    ...(mode.confirm ? { confirmation: { text: mode.confirm } } : {})
  });
}

/* ---------- summary: the sentence and the chips ---------- */

const PRICE_WORD = { tavaline: 'tavalise hinnaga' };
const faultsOn = (states, faults) => (faults || []).filter(f => { const st = states[f.entity]; return !!st && st.state === (f.bad ?? 'on'); });

// { text, warn }: the house in one or two sentences
export function sentence(states, conf) {
  const triggered = (conf.alarms || []).filter(a => stateOf(states, a.entity) === 'triggered');
  const faults = faultsOn(states, conf.faults);
  let text, warn = true;
  if (triggered.length) text = `Valve on häires: ${joinEt(triggered.map(a => a.name))}.`;
  else if (faults.length) text = `Vajab tähelepanu: ${joinEt(faults.map(f => f.name))}.`;
  else { text = 'Kõik on korras.'; warn = false; }
  const level = conf.price && states[conf.price];
  if (hasValue(level)) text += ` Elekter on praegu ${PRICE_WORD[level.state] || level.state}.`;
  return { text, warn };
}

// the security chip's line: what is armed, arming, delayed or alarming, per partition
export function securityText(states, alarms) {
  const groups = [['triggered', 'häires'], ['pending', 'sisenemisviivitus'], ['arming', 'valvestub'], ['armed', 'valves']];
  const of = a => { const s = stateOf(states, a.entity) || 'unavailable'; return s.startsWith('armed_') ? 'armed' : s; };
  const parts = [];
  for (const [key, word] of groups) {
    const names = alarms.filter(a => of(a) === key).map(a => a.name.toLowerCase());
    if (names.length) parts.push(`${joinEt(names)} ${word}`);
  }
  if (parts.length) return parts.join(', ');
  return alarms.every(a => of(a) === 'disarmed') ? 'kõik valveta' : 'pole teada';
}

export function peopleText(states, people) {
  const home = people.filter(p => stateOf(states, p.entity) === 'home').map(p => p.name);
  return home.length ? `${joinEt(home)} kodus` : 'keegi pole kodus';
}

// [{ key, icon, color, label, value, warn, tap }]: the faults that are on, then the four summaries
export function chips(states, conf) {
  const out = faultsOn(states, conf.faults).map(f => ({ key: `fault:${f.entity}`, icon: 'alert', label: f.name, warn: true, tap: actionDetail(f.entity, { action: 'more-info' }) }));
  const level = conf.price && states[conf.price];
  if (conf.price) {
    const arvel = level && formatNumber((level.attributes || {}).arvel, 1);
    const value = hasValue(level) ? `${arvel ? `${arvel} s, ` : ''}${level.state}` : 'pole teada';
    out.push({ key: 'price', icon: 'bolt', color: 'green', label: 'Elekter', value, tap: navigate(conf.energy_path) });
  }
  const alarms = conf.alarms || [];
  if (alarms.length) {
    const armed = alarms.some(a => (stateOf(states, a.entity) || '').startsWith('armed_'));
    const alarming = alarms.some(a => ['triggered', 'pending'].includes(stateOf(states, a.entity)));
    out.push({ key: 'security', icon: armed ? 'shield-check' : 'shield', color: 'blue', label: 'Turvalisus', value: securityText(states, alarms), warn: alarming, tap: actionDetail(alarms[0].entity, { action: 'more-info' }) });
  }
  const c = conf.climate || {};
  const t = states[c.temperature], h = states[c.humidity];
  const tn = hasValue(t) && formatNumber(t.state, 1), hn = hasValue(h) && formatNumber(h.state, 0);
  const climate = [tn && `${tn}°`, hn && `${hn} %`].filter(Boolean);
  if (climate.length) out.push({ key: 'climate', icon: 'thermometer', color: 'warm', label: 'Kliima', value: climate.join(' · ') });
  const people = conf.people || [];
  if (people.length) out.push({ key: 'people', icon: 'people', label: 'Inimesed', value: peopleText(states, people), tap: actionDetail(people[0].entity, { action: 'more-info' }) });
  return out;
}

/* ---------- price: the bars ---------- */

const HOUR = 3600e3;
const PRICE_SCALE = 0.32;
// the generator passes the bands it also colours Energia's chart with
export const priceLevel = (t, [mid, high] = [0.15, 0.25]) => (t < mid ? 'cheap' : t < high ? 'mid' : 'high');

// One bar per forecast hour from today's local midnight to tomorrow's end: 23, 24 or 25 a day
// on DST days, tomorrow's once published. null when the forecast has no prices.
export function priceBars(prices, now = new Date(), bands) {
  if (!Array.isArray(prices) || !prices.length) return null;
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const day0 = new Date(y, m, d).getTime(), day1 = new Date(y, m, d + 1).getTime(), day2 = new Date(y, m, d + 2).getTime();
  const t = now.getTime();
  const bars = prices
    .filter(p => p && Number.isFinite(p.s) && Number.isFinite(p.t) && p.s * 1000 >= day0 && p.s * 1000 < day2)
    .sort((a, b) => a.s - b.s)
    .map(p => {
      const at = p.s * 1000;
      return { t: p.t, level: priceLevel(p.t, bands), height: Math.max(0, Math.min(1, p.t / PRICE_SCALE)), past: at + HOUR <= t, now: at <= t && t < at + HOUR, tomorrow: at >= day1 };
    });
  if (!bars.length) return null;
  return { bars, today: bars.filter(b => !b.tomorrow).length, current: bars.findIndex(b => b.now) };
}

/* ---------- tile ---------- */

const DEFAULT_ACTIVE = ['on', 'playing', 'armed_*', 'heat', 'performance'];
// a state list entry ending in * matches a prefix, so ['*'] lights any available state
export function tileActive(st, active = DEFAULT_ACTIVE) {
  if (!hasValue(st)) return false;
  return active.some(a => (a.endsWith('*') ? st.state.startsWith(a.slice(0, -1)) : st.state === a));
}

// one part of a tile's second line: 'state', an attribute, another entity or { entity|attribute, label }
const partEntity = p => (p && typeof p === 'object' ? p.entity : typeof p === 'string' && p.includes('.') ? p : null);
function part(p, st, states) {
  const e = partEntity(p);
  const v = e ? (hasValue(states[e]) ? stateWord(states[e]) : '') : p === 'state' ? stateWord(st) : attrText(st, typeof p === 'object' ? p.attribute : p);
  return v && p.label ? `${p.label} ${v}` : v;
}

// { lit, unavailable, text } for the tile's look and its second line
export function tileState(conf, states) {
  const st = states[conf.entity];
  if (!hasValue(st)) return { lit: false, unavailable: true, text: 'pole saadaval' };
  const lit = tileActive(st, conf.active);
  const sc = conf.state_text;
  let text;
  if (typeof sc === 'string') text = sc;
  else if (Array.isArray(sc)) text = sc.map(p => part(p, st, states)).filter(Boolean).join(' · ');
  else text = stateWord(st);
  return { lit, unavailable: false, text };
}

/* ---------- the elements ---------- */

const BASE_CSS = `
:host{display:block;container-type:inline-size;color:var(--ink);font-family:inherit}
:host([hidden]){display:none}
ha-card{display:block;height:100%;box-sizing:border-box;background:transparent;border:none;box-shadow:none;border-radius:0;color:inherit;
  --ha-card-background:transparent;--ha-card-border-width:0;--ha-card-box-shadow:none}
button{font:inherit;color:inherit;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.muted{color:var(--muted)}
.root{display:contents}
`;

// the card shell: a shadow root that redraws when a watched state, the dark flag or the clock key
// changes. It draws into a content container, so a sheet <dialog> beside it survives redraws, and
// holds them while a slider is being dragged.
const Base = typeof HTMLElement === 'function' ? HTMLElement : class {};
class KheCard extends Base {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = '<style></style><div class="root"></div>';
    this._styleEl = this.shadowRoot.firstChild;
    this._root = this.shadowRoot.lastChild;
    this.shadowRoot.addEventListener('click', ev => this._click(ev));
  }
  setConfig(config) {
    this._check(config || {});
    this._config = config;
    this._a3 = config.style === 'a3' || !!this.constructor.a3only;
    this._cssDark = null;
    this._ids = this._watched();
    this._seen = null;
    this._draw();
  }
  // HA sets hass on every state change in the house: compare by identity, build nothing
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const dark = !!(hass.themes && hass.themes.darkMode), clock = this._clock(), seen = this._seen;
    if (seen && seen[0] === dark && seen[1] === clock && this._ids.every((e, i) => seen[i + 2] === hass.states[e])) return;
    this._seen = [dark, clock, ...this._ids.map(e => hass.states[e])];
    this._draw();
    if (this._sheet) this._sheet.live();
  }
  get hass() { return this._hass; }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 'full' }; }
  _check() {}
  _watched() { return []; }
  _clock() { return 0; }
  _draw() {
    if (!this._config || !this._hass) return;
    if (this._holding) { this._stale = true; return; }
    const dark = !!(this._hass.themes && this._hass.themes.darkMode);
    const pal = this._a3 ? a3Palette(dark) : palette(dark);
    // the style changes only with the theme
    if (this._cssDark !== dark) {
      const C = this.constructor, own = this._a3 && C.a3css !== undefined ? C.a3css : C.css;
      this._styleEl.textContent = `${cssVars(pal)}${BASE_CSS}${this._a3 ? A3_CSS : ''}${own}`;
      this._cssDark = dark;
    }
    // keep the focus on the same control across a redraw
    const focused = this.shadowRoot.activeElement && this.shadowRoot.activeElement.dataset.k;
    this._root.innerHTML = this._html(this._hass.states, pal);
    if (focused) { const el = this._root.querySelector(`[data-k="${CSS.escape(focused)}"]`); if (el) el.focus(); }
    if (this._wire) this._wire();
  }
  // a drag holds redraws; its end draws what changed meanwhile
  _hold(on) {
    this._holding = on;
    if (!on && this._stale) { this._stale = false; this._draw(); }
  }
  _fire(detail) {
    if (detail) this.dispatchEvent(new CustomEvent('hass-action', { detail, bubbles: true, composed: true }));
  }
  _click(ev) {
    const b = ev.target.closest('button[data-k]');
    if (!b || b.closest('dialog')) return;
    const k = b.dataset.k;
    if (this._sheets && this._sheets.has(k)) { this._openSheet(this._sheets.get(k)); return; }
    this._fire(this._actions && this._actions.get(k));
  }
  _openSheet(spec) {
    if (!this._sheet) this._sheet = new Sheet(this);
    this._sheet.open(spec);
  }
}

class SummaryCard extends KheCard {
  static css = `
ha-card{display:flex;flex-direction:column;gap:14px;padding:8px 4px 16px}
h1{margin:0;font-size:34px;line-height:1.1;font-weight:700}
.sentence{margin:4px 0 0;font-size:17px;line-height:1.35;color:var(--ink2)}
.sentence.warn{color:var(--high);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:flex;align-items:center;gap:8px;min-height:52px;padding:0 14px 0 10px;border-radius:26px;border:0;background:var(--card);text-align:left}
span.chip{cursor:default}
.chip .t{display:flex;flex-direction:column;line-height:1.15;font-size:13px}
.chip .l{font-weight:700}
.chip .v{color:var(--muted)}
.chip.warn{color:var(--high)}
.chip.warn .v{color:var(--high)}
@container (min-width:420px){.sentence{font-size:24px}.chip .t{font-size:14px}}
`;
  _watched() {
    const c = this._config;
    return [...(c.faults || []).map(f => f.entity), ...(c.alarms || []).map(a => a.entity), ...(c.people || []).map(p => p.entity), c.price, (c.climate || {}).temperature, (c.climate || {}).humidity].filter(Boolean);
  }
  _html(states, pal) {
    const c = this._config;
    const s = sentence(states, c);
    this._actions = new Map();
    const list = chips(states, c).map(ch => {
      if (ch.tap) this._actions.set(ch.key, ch.tap);
      const color = ch.warn ? pal.high : ch.color ? litPair(pal, ch.color)[pal.dark ? 0 : 1] : pal.icon;
      const inner = `${icon(ch.icon, 22, color)}<span class="t"><span class="l">${esc(ch.label)}</span>${ch.value ? `<span class="v">${esc(ch.value)}</span>` : ''}</span>`;
      const cls = `chip${ch.warn ? ' warn' : ''}`;
      return ch.tap ? `<button type="button" class="${cls}" data-k="${esc(ch.key)}">${inner}</button>` : `<span class="${cls}">${inner}</span>`;
    });
    const line = `<p class="sentence${s.warn ? ' warn' : ''}">${esc(s.text)}</p>`;
    return `<ha-card>${c.title ? `<header><h1>${esc(c.title)}</h1>${line}</header>` : line}<div class="chips">${list.join('')}</div></ha-card>`;
  }
}

class PriceCard extends KheCard {
  static css = `
ha-card{display:flex;flex-direction:column;padding:0 4px}
.part{padding:14px 0;border-top:1px solid var(--rule)}
.part:last-child{border-bottom:1px solid var(--rule)}
.top{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px}
.num{font-size:40px;font-weight:700;line-height:1;letter-spacing:-0.02em}
.unit{font-size:16px;color:var(--muted)}
.link{margin-left:auto;min-height:44px;padding:0 4px;border:0;background:none;color:var(--accent);font-size:15px;font-weight:600}
.hint{margin:6px 0 0;font-size:15px;color:var(--ink2)}
.bars{display:flex;align-items:flex-end;gap:2px;height:72px}
.bar{flex:1;min-height:2px;border-radius:2px;background:var(--cheap)}
.bar.mid{background:var(--mid)}
.bar.high{background:var(--high)}
.bar.past{opacity:.35}
.bar.tomorrow{opacity:.55}
.bar.now{outline:2px solid var(--ink);outline-offset:1px}
.axis{display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--muted)}
.axis .day{font-weight:600;color:var(--ink2)}
.boxes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:14px}
.box{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:var(--inset)}
.box .l{color:var(--muted)}
.box .v{font-weight:600}
.tomorrow-line{margin:10px 0 0;font-size:14px;color:var(--ink2)}
.empty{margin:0;color:var(--muted)}
@container (min-width:420px){.num{font-size:52px}.bars{height:110px;gap:3px}.boxes{font-size:15px}}
`;
  static get a3css() { return PRICE_A3_CSS; }
  _check(c) { if (!c.level || !c.forecast) throw new Error('khe-price-card: level and forecast are required'); }
  _watched() {
    const c = this._config;
    return [c.level, c.forecast, c.tomorrow, c.tomorrow_flag, ...(c.windows || []).map(w => w.entity), ...(c.usage || []).map(u => u.entity)].filter(Boolean);
  }
  // the past and current hour move with the clock, not with a state
  _clock() { return Math.floor(Date.now() / HOUR); }
  // a redraw at each hour boundary; Estonia's offset is whole hours, so UTC's hours are local ones
  connectedCallback() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { if (this._hass) this.hass = this._hass; this.connectedCallback(); }, HOUR - (Date.now() % HOUR) + 1000);
  }
  disconnectedCallback() { clearTimeout(this._timer); }
  _html(states, pal) {
    if (this._a3) return priceA3(this, states, pal);
    const c = this._config;
    const level = states[c.level], fc = states[c.forecast];
    const link = navigate(c.energy_path);
    this._actions = new Map([['energy', link]]);
    const arvel = hasValue(level) && formatNumber((level.attributes || {}).arvel, 1);
    const hinnang = hasValue(level) && (level.attributes || {}).hinnang;
    const top = `<div class="top">${arvel ? `<span class="num">${arvel}</span><span class="unit">senti/kWh · ${esc(level.state)}</span>` : '<span class="unit">Hind pole teada</span>'}${link ? '<button type="button" class="link" data-k="energy">Energia ›</button>' : ''}</div>${hinnang ? `<p class="hint">${esc(hinnang)}.</p>` : ''}`;
    const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), c.bands);
    let chart;
    if (!b) chart = '<p class="empty">Hinnaprognoosi pole</p>';
    else {
      const bars = b.bars.map(x => `<div class="bar ${x.level}${x.past ? ' past' : ''}${x.tomorrow ? ' tomorrow' : ''}${x.now ? ' now' : ''}" style="height:${(x.height * 100).toFixed(1)}%"></div>`).join('');
      const axis = b.bars.length > b.today ? ['00', '12', '<span class="day">homme</span>', '12', '24'] : ['00', '06', '12', '18', '24'];
      const label = `Tunnihinnad, täna${b.bars.length > b.today ? ' ja homme' : ''}`;
      chart = `<div class="bars" role="img" aria-label="${label}">${bars}</div><div class="axis" aria-hidden="true">${axis.map(a => `<span>${a}</span>`).join('')}</div>`;
    }
    const windows = (c.windows || []).map(w => [w.name, (states[w.entity] && states[w.entity].attributes || {}).tekst]).filter(([, t]) => t);
    const tomorrow = hasValue(states[c.tomorrow]) && (states[c.tomorrow].attributes || {}).tekst;
    const usage = (c.usage || []).map(u => {
      const st = states[u.entity];
      if (!hasValue(st)) return [u.name, 'pole saadaval'];
      const kulu = (st.attributes || {}).kulu;
      return [u.name, `${stateWord(st)}${kulu ? ` · ${kulu}` : ''}`];
    });
    const boxes = list => `<div class="boxes">${list.map(([l, v]) => `<div class="box"><span class="l">${esc(l)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>`;
    const parts = [top, chart];
    if (windows.length || tomorrow) parts.push(`${windows.length ? boxes(windows) : ''}${tomorrow ? `<p class="tomorrow-line">${esc(tomorrow)}</p>` : ''}`);
    if (usage.length) parts.push(boxes(usage));
    return `<ha-card>${parts.map(p => `<div class="part">${p}</div>`).join('')}</ha-card>`;
  }
}

class TileCard extends KheCard {
  static css = `
:host{height:100%}
ha-card{position:relative;border-radius:18px;background:var(--tile);min-height:68px;overflow:hidden}
ha-card.lit{background:var(--tileLit)}
ha-card.off{opacity:.55}
.body{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:0;padding:12px 14px;border:0;background:none;text-align:left;border-radius:18px}
span.body{cursor:default}
.disc{position:absolute;top:9px;left:11px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;padding:0;background:none;border-radius:22px;z-index:1}
span.disc.pass{pointer-events:none}
.disc i{width:38px;height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;background:var(--disc)}
.name{font-size:15px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.state{font-size:14px;line-height:1.2;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
ha-card.modes{display:flex;flex-direction:column;gap:10px;padding:12px}
.modes .head{display:flex;align-items:center;gap:10px;min-height:44px}
.modes .head .body{position:static;padding:0;flex:1;min-width:0;min-height:44px;flex-direction:row;align-items:center;justify-content:flex-start;gap:10px}
.txt{display:flex;flex-direction:column;min-width:0}
.modes .disc{position:static;flex:0 0 auto;margin:-3px}
.seg{display:grid;grid-auto-columns:minmax(0,1fr);grid-auto-flow:column;gap:4px;padding:4px;border-radius:14px;background:var(--inset)}
.seg button{height:44px;border-radius:10px;border:0;background:transparent;font-size:15px;font-weight:500;text-align:center}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--onAccent);font-weight:600;cursor:default}
`;
  static get a3css() { return TILE_A3_CSS; }
  _check(c) { if (!c.entity) throw new Error('khe-tile-card: entity is required'); }
  _watched() {
    const c = this._config;
    const parts = [c.state_text, c.label].filter(Array.isArray).flat();
    return [c.entity, ...parts.map(partEntity).filter(Boolean)];
  }
  // the size for a hand-written config; the generator's grid_options win in HA and the demo
  getCardSize() { return this._config && this._config.modes ? 3 : 2; }
  getGridOptions() {
    const c = this._config || {};
    if (this._a3) return { columns: c.wide ? 'full' : 6 };
    return c.modes ? { columns: 'full' } : { columns: 6, rows: 2 };
  }
  _wire() { if (this._a3) wireSlider(this); }
  _html(states, pal) {
    if (this._a3) return tileA3(this, states, pal);
    const c = this._config;
    const ts = tileState(c, states);
    const name = c.name || ((states[c.entity] || {}).attributes || {}).friendly_name || c.entity;
    const [discBg, iconColor] = ts.lit ? litPair(pal, c.color) : [pal.disc, pal.icon];
    const key = ts.lit && c.icon_on ? c.icon_on : c.icon;
    const tap = tileAction(c, 'tap');
    const iconTap = c.icon_tap_action ? tileAction(c, 'icon') : null;
    this._actions = new Map([['body', tap], ['icon', iconTap]]);
    const pressed = (c.tap_action || {}).action === 'toggle' ? ` aria-pressed="${ts.lit}"` : '';
    const disc = `<i style="background:${discBg}">${icon(key, 20, iconColor)}</i>`;
    // The disc is its own button only when its tap differs from the body's. Without an icon action
    // of its own a tap on it reaches the body (on a mode tile the disc sits inside the body); with
    // one that is none it does nothing.
    const passes = !c.icon_tap_action;
    const discEl = iconTap ? `<button type="button" class="disc" data-k="icon" aria-label="${esc(c.icon_label || name)}">${disc}</button>` : `<span class="disc${passes ? ' pass' : ''}">${disc}</span>`;
    const inner = `${c.modes && passes ? discEl : ''}<span class="txt"><span class="name">${esc(name)}</span><span class="state">${esc(ts.text)}</span></span>`;
    const body = tap ? `<button type="button" class="body" data-k="body"${pressed} aria-label="${esc(`${name}: ${ts.text}`)}">${inner}</button>` : `<span class="body">${inner}</span>`;
    const cls = `${ts.lit ? 'lit' : ''}${ts.unavailable ? ' off' : ''}`;
    if (!c.modes) return `<ha-card class="${cls}">${body}${discEl}</ha-card>`;
    const current = stateOf(states, c.entity);
    const seg = c.modes.map((m, i) => {
      const k = `mode:${i}`;
      this._actions.set(k, modeAction(c.entity, m, current));
      return `<button type="button" data-k="${k}" aria-pressed="${m.option === current}">${esc(m.name)}</button>`;
    }).join('');
    return `<ha-card class="modes ${cls}"><div class="head">${passes ? '' : discEl}${body}</div><div class="seg" role="group" aria-label="${esc(`${name}: režiim`)}">${seg}</div></ha-card>`;
  }
}

/* ---------- A3: glass palette (ADR-005, estate ADR-025) ---------- */

const A3 = {
  light: {
    text: '#1c1c1e', sub: '#4b4b52', glass: 'rgba(255,255,255,0.60)', glassOn: 'rgba(255,255,255,0.92)', solid: '#f4f5f7', solidOn: '#ffffff',
    edge: 'inset 0 0.5px 0 rgba(255,255,255,0.9), 0 6px 20px rgba(30,40,60,0.08)', iconOff: 'rgba(118,118,128,0.16)',
    seg: 'rgba(118,118,128,0.14)', segOn: '#ffffff', segShadow: '0 2px 6px rgba(0,0,0,0.12)', track: 'rgba(118,118,128,0.18)',
    hair: 'rgba(60,60,67,0.14)', sheet: 'rgba(248,248,250,0.94)', sheetSolid: '#f8f8fa', grab: 'rgba(60,60,67,0.3)',
    goodBg: 'rgba(52,199,89,0.16)', good: '#1b7f37', midBg: 'rgba(255,159,10,0.18)', mid: '#9a5b00', highBg: 'rgba(255,69,58,0.14)', high: '#c4281c',
    dotRing: '#ffffff', press: '#1c1c1e', onPress: '#ffffff', accent: '#0a84ff', fill: '#ffd60a',
    cheap: '#34c759', midBar: '#ff9f0a', highBar: '#ff453a'
  },
  dark: {
    text: '#f5f5f7', sub: 'rgba(235,235,245,0.72)', glass: 'rgba(44,44,50,0.56)', glassOn: 'rgba(66,66,74,0.72)', solid: '#26262b', solidOn: '#3a3a40',
    edge: 'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 6px 20px rgba(0,0,0,0.22)', iconOff: 'rgba(118,118,128,0.32)',
    seg: 'rgba(118,118,128,0.30)', segOn: 'rgba(99,99,102,0.95)', segShadow: '0 2px 6px rgba(0,0,0,0.3)', track: 'rgba(118,118,128,0.34)',
    hair: 'rgba(255,255,255,0.12)', sheet: 'rgba(28,28,32,0.92)', sheetSolid: '#1c1c20', grab: 'rgba(235,235,245,0.3)',
    goodBg: 'rgba(48,209,88,0.20)', good: '#30d158', midBg: 'rgba(255,159,10,0.22)', mid: '#ffb340', highBg: 'rgba(255,69,58,0.22)', high: '#ff6961',
    dotRing: '#1c1c1e', press: 'rgba(235,235,245,0.9)', onPress: '#1c1c1e', accent: '#0a84ff', fill: 'rgba(255,214,10,0.9)',
    cheap: '#34c759', midBar: '#ff9f0a', highBar: '#ff453a'
  }
};
// the tile colours by name: [disc, icon on it]
const A3_COLORS = {
  teal: ['#30b0c7', '#fff'], yellow: ['#ffcc00', '#1c1c1e'], blue: ['#0a84ff', '#fff'], orange: ['#ff9f0a', '#fff'],
  indigo: ['#5e5ce6', '#fff'], green: ['#34c759', '#fff'], red: ['#ff453a', '#fff'], heat: ['#ff6b35', '#fff']
};
export function a3Palette(dark) {
  return { ...A3[dark ? 'dark' : 'light'], dark: !!dark };
}
const a3Color = name => A3_COLORS[name] || A3_COLORS.blue;

const A3_CSS = `
:host{color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
button{border:0;padding:0;background:none;text-align:left}
button:focus-visible{outline-color:var(--accent)}
.glass{background:var(--glass);box-shadow:var(--edge);border-radius:22px;-webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%)}
.glass.on{background:var(--glassOn)}
.press{transition:transform 120ms ease-out}
.press:active{transform:scale(0.97)}
.sub{font-size:13px;color:var(--sub)}
.num{font-variant-numeric:tabular-nums}
@media (prefers-reduced-transparency: reduce){.glass{background:var(--solid);-webkit-backdrop-filter:none;backdrop-filter:none}.glass.on{background:var(--solidOn)}}
@media (prefers-reduced-motion: reduce){.press:active{transform:none}}
`;

/* ---------- A3: the history sheet's pure helpers ---------- */

// The ranges: the statistics period for a measurement and for an energy counter, and the span.
export const RANGES = {
  '24h': { name: '24 h', ms: 24 * HOUR, period: '5minute', energy: 'hour' },
  '7d': { name: '7 päeva', ms: 7 * 24 * HOUR, period: 'hour', energy: 'day' },
  '30d': { name: '30 päeva', ms: 30 * 24 * HOUR, period: 'day', energy: 'day' }
};

// The WebSocket message for a tile's history config ({ entity, source, type, cost }) over a range.
export function historyRequest(h, range, now = Date.now()) {
  const r = RANGES[range] || RANGES['24h'];
  const start_time = new Date(now - r.ms).toISOString(), end_time = new Date(now).toISOString();
  if (h.source === 'statistics') {
    const change = h.type === 'change';
    return {
      type: 'recorder/statistics_during_period', start_time, end_time,
      statistic_ids: [h.entity, ...(h.cost ? [h.cost] : [])],
      period: change ? r.energy : r.period,
      types: change ? ['change'] : ['mean', 'min', 'max']
    };
  }
  return { type: 'history/history_during_period', start_time, end_time, entity_ids: [h.entity], minimal_response: true, no_attributes: true };
}

const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// A response as a series: { kind: 'line' | 'bars' | 'step' | 'empty', points, cost }. Points are
// { t, v } with t in ms; an unavailable or unknown sample is a gap (v null); a step point's v is
// whether the state counts as active (the tile's `active` list, else 'on').
export function seriesFrom(resp, h) {
  const rows = (resp && resp[h.entity]) || [];
  if (!rows.length) return { kind: 'empty', points: [] };
  if (h.source === 'statistics') {
    if (h.type === 'change') {
      const cost = ((resp[h.cost] || []).reduce((s, r) => s + (num(r.change) || 0), 0));
      return { kind: 'bars', points: rows.map(r => ({ t: r.start, v: num(r.change) })), cost: h.cost && resp[h.cost] ? cost : null };
    }
    return { kind: 'line', points: rows.map(r => ({ t: r.start, v: num(r.mean), min: num(r.min), max: num(r.max) })) };
  }
  const known = rows.filter(r => !NO_VALUE.has(r.s));
  const t = r => Math.round((r.lu ?? r.lc ?? 0) * 1000);
  if (known.length && known.every(r => num(r.s) !== null)) {
    return { kind: 'line', points: rows.map(r => ({ t: t(r), v: NO_VALUE.has(r.s) ? null : num(r.s) })), stepped: true };
  }
  const active = h.active || ['on'];
  return { kind: 'step', points: rows.map(r => ({ t: t(r), v: NO_VALUE.has(r.s) ? null : active.includes(r.s), s: r.s })) };
}

// { lo, mean, hi } of a line, time-weighted for a stepped history line, null when it has no value
export function lineStats(series, start, end = Date.now()) {
  const pts = series.points.filter(p => p.v !== null);
  if (!pts.length) return null;
  // a loop, not Math.min(...): a month of raw history can outgrow the argument limit
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { lo = Math.min(lo, p.min ?? p.v); hi = Math.max(hi, p.max ?? p.v); }
  let mean;
  if (series.stepped) {
    let w = 0, s = 0;
    series.points.forEach((p, i) => {
      if (p.v === null) return;
      const d = Math.max(0, Math.min(i + 1 < series.points.length ? series.points[i + 1].t : end, end) - Math.max(p.t, start));
      w += d; s += d * p.v;
    });
    mean = w ? s / w : pts[pts.length - 1].v;
  } else mean = pts.reduce((a, p) => a + p.v, 0) / pts.length;
  return { lo, mean, hi };
}

// { times, hours } of a step series from start to end: switches into active after the start, and
// the active time
export function stepStats(series, start, end = Date.now()) {
  let times = 0, ms = 0, known = null;
  series.points.forEach((p, i) => {
    // an unavailable gap (a restart) between two on states is no new switch
    if (p.v && known === false && p.t > start) times += 1;
    if (p.v !== null) known = p.v;
    if (!p.v) return;
    const a = Math.max(p.t, start), b = Math.min(i + 1 < series.points.length ? series.points[i + 1].t : end, end);
    if (b > a) ms += b - a;
  });
  return { times, hours: ms / HOUR };
}

// { total, peak, cost } of an energy series
export function barStats(series) {
  const vals = series.points.map(p => p.v).filter(v => v !== null);
  if (!vals.length) return null;
  return { total: vals.reduce((a, v) => a + v, 0), peak: vals.reduce((a, v) => Math.max(a, v), -Infinity), cost: series.cost };
}

// one bar as SVG path data: a w x h rectangle at x, y
export const barRect = (x, y, w, h) => `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h-${w.toFixed(1)}Z`;

// SVG path data in a w x h box between t0 and t1: a line (with gaps) and its area, step bands, or bars
export function chartPaths(series, { w = 350, h = 170, top = 14, bot = 12, t0, t1, lo, hi }) {
  const x = t => ((Math.min(Math.max(t, t0), t1) - t0) / ((t1 - t0) || 1)) * w;
  const span = (hi - lo) || 1;
  const y = v => h - bot - ((v - lo) / span) * (h - top - bot);
  const f = n => n.toFixed(1);
  if (series.kind === 'bars') {
    const n = series.points.length, bw = Math.max(1, (w / Math.max(n, 1)) * 0.72);
    const bars = series.points.filter(p => p.v !== null && p.t >= t0).map(p => {
      const bh = Math.max(1, ((p.v - lo) / span) * (h - top - bot));
      return barRect(x(p.t) + (w / n - bw) / 2, h - bot - bh, bw, bh);
    }).join('');
    return { bars };
  }
  if (series.kind === 'step') {
    let bands = '';
    series.points.forEach((p, i) => {
      if (!p.v) return;
      const a = x(p.t), b = x(i + 1 < series.points.length ? series.points[i + 1].t : t1);
      if (b > a) bands += `M${f(a)} ${top}H${f(b)}V${h - bot}H${f(a)}Z`;
    });
    return { bands };
  }
  let line = '', area = '', run = [];
  const flush = () => {
    if (!run.length) return;
    const d = run.map((q, i) => `${i ? 'L' : 'M'}${f(q[0])} ${f(q[1])}`).join('');
    line += d;
    area += `${d}L${f(run[run.length - 1][0])} ${h - bot}L${f(run[0][0])} ${h - bot}Z`;
    run = [];
  };
  series.points.forEach((p, i) => {
    if (p.v === null) { flush(); return; }
    if (series.stepped && run.length) run.push([x(p.t), run[run.length - 1][1]]);
    run.push([x(p.t), y(p.v)]);
    if (series.stepped && i === series.points.length - 1) run.push([x(t1), y(p.v)]);
  });
  flush();
  return { line, area };
}

// five axis labels from t0 to t1: hours for a day, weekdays for a week, dates for a month
export function axisLabels(range, t0, t1) {
  const fmt = range === '24h' ? { hour: '2-digit', minute: '2-digit' } : range === '7d' ? { weekday: 'short' } : { day: 'numeric', month: 'numeric' };
  const F = new Intl.DateTimeFormat('et-EE', fmt);
  return [0, 1, 2, 3].map(i => F.format(new Date(t0 + ((t1 - t0) * i) / 4))).concat('nüüd');
}

const LEVEL_TONE = { 'väga odav': 'good', odav: 'good', tavaline: 'mid', 'kõrgevõitu': 'mid', kallis: 'high', 'väga kallis': 'high' };
export const levelTone = word => LEVEL_TONE[word] || 'mid';
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

// a value split for display: { value, unit } with the decimal comma, or the state word
export function splitValue(st, decimals) {
  if (!hasValue(st)) return { value: stateWord(st), unit: '' };
  const n = formatNumber(st.state, decimals);
  if (n === null) return { value: stateWord(st), unit: '' };
  const u = (st.attributes || {}).unit_of_measurement || '';
  return u === '°C' ? { value: `${n}°`, unit: '' } : { value: n, unit: u };
}

/* ---------- A3: the history sheet ---------- */

const SHEET_CSS = `
dialog{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:560px;max-height:92vh;box-sizing:border-box;padding:0;border:0;
  border-radius:30px 30px 0 0;background:var(--sheet);color:var(--text);box-shadow:0 -10px 40px rgba(0,0,0,0.18);overflow:auto;
  -webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);animation:rise 380ms cubic-bezier(.2,.9,.25,1)}
dialog::backdrop{background:rgba(0,0,0,0.32);animation:fade 220ms ease-out}
dialog .in{display:flex;flex-direction:column;gap:14px;padding:8px 20px calc(26px + env(safe-area-inset-bottom,0px))}
dialog .grab{align-self:center;width:38px;height:5px;border-radius:3px;background:var(--grab)}
dialog .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
dialog .title{font-size:15px;font-weight:600;color:var(--sub)}
dialog .now{display:flex;align-items:baseline;gap:6px}
dialog .now .v{font-size:40px;line-height:1.05;font-weight:700;letter-spacing:-0.03em}
dialog .now .u{font-size:15px;font-weight:600;color:var(--sub)}
dialog .x{flex:none;width:44px;height:44px;margin:-6px -8px 0 0;display:flex;align-items:center;justify-content:center}
dialog .x i{width:32px;height:32px;border-radius:16px;background:var(--seg);display:flex;align-items:center;justify-content:center}
dialog .ranges{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:2px;border-radius:10px;background:var(--seg)}
dialog .ranges button{height:32px;border-radius:8px;font-size:13px;font-weight:600;text-align:center}
dialog .ranges button[aria-pressed="true"]{background:var(--segOn);box-shadow:var(--segShadow)}
dialog .chart{position:relative;height:170px}
dialog .chart svg{display:block;width:100%;height:170px}
dialog .chart .dot{position:absolute;width:10px;height:10px;margin:-7px 0 0 -7px;border-radius:7px;border:2px solid var(--dotRing)}
dialog .chart .msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--sub)}
dialog .axis{position:relative;display:flex;justify-content:space-between;font-size:11px;font-weight:600;color:var(--sub)}
dialog .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
dialog .stats > span{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:var(--seg)}
dialog .stats .k{font-size:12px;font-weight:600;color:var(--sub)}
dialog .stats .v{font-size:17px;font-weight:700;letter-spacing:-0.01em}
dialog .acts{display:flex;gap:8px}
dialog .more{flex:1;height:44px;border-radius:14px;background:var(--seg);font-size:15px;font-weight:600;text-align:center;color:var(--accent)}
@keyframes rise{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){dialog{animation:fade 200ms ease-out}}
@media (prefers-reduced-transparency: reduce){dialog{background:var(--sheetSolid);-webkit-backdrop-filter:none;backdrop-filter:none}}
`;

const W = 350, H = 170;

// One <dialog> per card, opened with showModal() into the top layer. spec: { title, entity, more,
// decimals, unit, color, history } or { title, price: { forecast, level, bands } }.
class Sheet {
  constructor(card) {
    this.card = card;
    const d = (this.el = document.createElement('dialog'));
    d.innerHTML = `<style>${SHEET_CSS}</style><div class="in"></div>`;
    card.shadowRoot.appendChild(d);
    this.body = d.lastChild;
    d.addEventListener('click', ev => {
      if (ev.target === d) { d.close(); return; }
      const b = ev.target.closest('button[data-s]');
      if (!b) return;
      const s = b.dataset.s;
      if (s === 'close') d.close();
      else if (s === 'more') { d.close(); this.card._fire(actionDetail(this.spec.more || this.spec.entity, { action: 'more-info' })); }
      else if (s === 'view') { d.close(); this.card._fire(navigate(this.spec.view)); }
      else if (RANGES[s]) { this.range = s; this.load(); }
    });
    d.addEventListener('close', () => { this.token = null; });
  }
  open(spec) {
    this.spec = spec;
    this.range = '24h';
    this.data = null;
    this.load();
    if (!this.el.open) this.el.showModal();
  }
  // the value now follows the house while the sheet is open
  live() {
    if (!this.el.open) return;
    const v = this.el.querySelector('.now');
    if (v) v.innerHTML = this.nowHtml();
  }
  nowHtml() {
    const sp = this.spec, st = this.card._hass.states[sp.entity];
    if (sp.price) {
      const a = hasValue(st) && formatNumber((st.attributes || {}).arvel, 1);
      return a ? `<span class="v num">${a}</span><span class="u">senti/kWh</span>` : '<span class="v">pole teada</span>';
    }
    if (sp.text) return `<span class="v">${esc(sp.text(this.card._hass.states))}</span>`;
    const { value, unit } = splitValue(st, sp.decimals);
    return `<span class="v num">${esc(value)}</span>${unit ? `<span class="u">${esc(unit)}</span>` : ''}`;
  }
  async load() {
    const sp = this.spec;
    if (sp.price || !sp.history) { this.render(); return; }
    const token = (this.token = {}), range = this.range, now = Date.now();
    this.data = { loading: true };
    this.render();
    let series;
    try {
      const h = sp.history, hass = this.card._hass;
      series = seriesFrom(await hass.callWS(historyRequest(h, range, now)), h);
      // an entity whose statistics come back empty (none kept, or a new one) falls back to history
      if (series.kind === 'empty' && h.source === 'statistics' && h.type !== 'change') {
        const hh = { ...h, source: 'history' };
        series = seriesFrom(await hass.callWS(historyRequest(hh, range, now)), hh);
      }
    } catch (e) {
      series = { kind: 'error', points: [] };
    }
    if (this.token !== token) return;
    this.data = { series, range, now };
    this.render();
  }
  render() {
    const sp = this.spec, ranged = !sp.price && sp.history;
    const ranges = ranged ? `<div class="ranges" role="group" aria-label="Ajavahemik">${Object.entries(RANGES).map(([k, r]) => `<button type="button" data-s="${k}" aria-pressed="${k === this.range}">${r.name}</button>`).join('')}</div>` : '';
    const chart = sp.price ? this.priceChart() : this.seriesChart();
    this.body.innerHTML = `<span class="grab" aria-hidden="true"></span>
      <div class="top"><div><div class="title">${esc(sp.title)}</div><div class="now">${this.nowHtml()}</div></div>
      <button type="button" class="x" data-s="close" aria-label="Sulge"><i>${icon('close', 14, 'currentColor')}</i></button></div>
      ${ranges}${chart}<div class="acts"><button type="button" class="more" data-s="more">Rohkem</button>${sp.view ? '<button type="button" class="more" data-s="view">Süsteemi leht</button>' : ''}</div>`;
    this.el.setAttribute('aria-label', sp.title);
  }
  stats(list) {
    return `<div class="stats">${list.map(([k, v]) => `<span><span class="k">${esc(k)}</span><span class="v num">${esc(v)}</span></span>`).join('')}</div>`;
  }
  priceChart() {
    const sp = this.spec, fc = this.card._hass.states[sp.price.forecast];
    const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), sp.price.bands);
    if (!b) return '<div class="chart"><div class="msg">Hinnaprognoosi pole</div></div>';
    const pal = a3Palette(this.card._hass.themes && this.card._hass.themes.darkMode);
    const n = b.bars.length, slot = W / n, bw = slot * 0.74;
    const paths = { cheap: '', mid: '', high: '' };
    b.bars.forEach((x, i) => {
      const bh = Math.max(2, x.height * (H - 26));
      paths[x.level] += barRect(i * slot + (slot - bw) / 2, H - 12 - bh, bw, bh);
    });
    const cur = b.bars[b.current];
    const dot = cur ? `<span class="dot" style="left:${(((b.current + 0.5) * slot) / W * 100).toFixed(2)}%;top:${((H - 12 - Math.max(2, cur.height * (H - 26))) / H * 100).toFixed(2)}%;background:${pal.text}"></span>` : '';
    const ts = b.bars.map(x => x.t * 100), mean = ts.reduce((a, v) => a + v, 0) / ts.length;
    const lab = b.bars.length > b.today ? ['täna 00', '12', 'homme 00', '12', '24'] : ['00', '06', '12', '18', '24'];
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Tunnihind täna${b.bars.length > b.today ? ' ja homme' : ''}">
      <path d="M0 42.5H${W}M0 85H${W}M0 127.5H${W}" stroke="${pal.hair}" vector-effect="non-scaling-stroke"/>
      <path d="${paths.cheap}" fill="${pal.cheap}"/><path d="${paths.mid}" fill="${pal.midBar}"/><path d="${paths.high}" fill="${pal.highBar}"/></svg>${dot}</div>
      <div class="axis" aria-hidden="true">${lab.map(l => `<span>${l}</span>`).join('')}</div>
      ${this.stats([['Odavaim', formatNumber(Math.min(...ts).toFixed(1), 1)], ['Keskmine', formatNumber(mean.toFixed(1), 1)], ['Kalleim', formatNumber(Math.max(...ts).toFixed(1), 1)]])}`;
  }
  seriesChart() {
    const sp = this.spec, d = this.data;
    const blank = msg => `<div class="chart"><div class="msg">${msg}</div></div><div class="axis"><span>&nbsp;</span></div>${this.stats([['', '–'], ['', '–'], ['', '–']])}`;
    if (!d || d.loading) return blank('Laen…');
    const { series, range, now } = d;
    if (series.kind === 'error') return blank('Ajalugu ei saanud lugeda');
    const t0 = now - RANGES[range].ms, t1 = now;
    const color = a3Color(sp.color)[0];
    const pal = a3Palette(this.card._hass.themes && this.card._hass.themes.darkMode);
    const grid = `<path d="M0 42.5H${W}M0 85H${W}M0 127.5H${W}" stroke="${pal.hair}" vector-effect="non-scaling-stroke"/>`;
    const axis = `<div class="axis" aria-hidden="true">${axisLabels(range, t0, t1).map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    const svg = inner => `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(sp.title)}, ajalugu">${grid}${inner}</svg></div>${axis}`;
    const fmt = v => formatNumber(v.toFixed(sp.decimals ?? 1), sp.decimals ?? 1);
    const unit = sp.unit ? (sp.unit === '°C' ? '°' : ` ${sp.unit}`) : '';
    if (series.kind === 'step') {
      const p = chartPaths(series, { t0, t1, lo: 0, hi: 1 });
      const s = stepStats(series, t0, now);
      const hrs = s.hours < 10 ? formatNumber(s.hours.toFixed(1), 1) : String(Math.round(s.hours));
      return `${svg(`<path d="${p.bands}" fill="${color}" fill-opacity="0.55"/>`)}${this.stats([['Praegu', sp.text ? sp.text(this.card._hass.states) : stateWord(this.card._hass.states[sp.entity])], ['Kordi', String(s.times)], ['Kokku', `${hrs} h`]])}`;
    }
    if (series.kind === 'bars') {
      const s = barStats(series);
      if (!s) return blank('Selle aja kohta andmeid pole');
      const p = chartPaths(series, { t0, t1, lo: 0, hi: s.peak || 1 });
      const per = RANGES[range].energy === 'hour' ? 'Suurim tund' : 'Suurim päev';
      const middle = s.cost === null || s.cost === undefined ? ['Keskmine', `${fmt(s.total / series.points.length)}${unit}`] : ['Kulu', `${formatNumber(s.cost.toFixed(2), 2)} €`];
      return `${svg(`<path d="${p.bars}" fill="${color}"/>`)}${this.stats([['Kokku', `${fmt(s.total)}${unit}`], middle, [per, `${fmt(s.peak)}${unit}`]])}`;
    }
    const s = series.kind === 'line' && lineStats(series, t0, now);
    if (!s) return blank('Selle aja kohta andmeid pole');
    const pad = (s.hi - s.lo) * 0.08 || 0.5;
    const p = chartPaths(series, { t0, t1, lo: s.lo - pad, hi: s.hi + pad });
    return `${svg(`<path d="${p.area}" fill="${color}" fill-opacity="0.16"/><path d="${p.line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`)}${this.stats([['Madalaim', `${fmt(s.lo)}${unit}`], ['Keskmine', `${fmt(s.mean)}${unit}`], ['Kõrgeim', `${fmt(s.hi)}${unit}`]])}`;
  }
}

/* ---------- A3: the sheet spec of a tile, and the tile's parts ---------- */

// a tile's name: the config's, the entity's friendly name, or its id
const tileName = (conf, st) => conf.name || ((st || {}).attributes || {}).friendly_name || conf.entity;

// what a tap on a tile with `history` opens: the tile's value now, the history entity's series
export function tileSheet(conf, states) {
  const h = conf.history;
  if (!h) return null;
  // a measurement read from another entity (the boost tile's boiler water) is also the sheet's value
  const valueOf = h.entity && h.entity !== conf.entity && h.type !== 'change' ? h.entity : conf.entity;
  const st = states[valueOf];
  const unit = h.unit || ((st || {}).attributes || {}).unit_of_measurement || '';
  const spec = {
    title: h.title || tileName(conf, states[conf.entity]),
    entity: valueOf,
    more: conf.entity,
    // a percentage reads in whole numbers, a temperature or energy to one decimal
    decimals: conf.decimals ?? (unit === '%' ? 0 : 1),
    unit,
    color: conf.color,
    view: h.view,
    history: { ...h, entity: h.entity || conf.entity }
  };
  if (h.source === 'history' && !h.numeric) spec.text = now => tileState(conf, now).text;
  return spec;
}

// a button's look: pressed when the entity is in the button's state
export const buttonOn = (b, st) => !!b.state && !!st && st.state === b.state;

// the light's brightness in percent, 0 when off; a pointer at x of a w-wide bar, in steps of 5
export function brightnessPct(st) {
  if (!hasValue(st) || st.state !== 'on') return 0;
  const b = Number((st.attributes || {}).brightness);
  return Number.isFinite(b) ? Math.max(1, Math.round((b / 255) * 100)) : 100;
}
export const pctAt = (x, w) => Math.max(0, Math.min(100, Math.round(((x / (w || 1)) * 100) / 5) * 5));
export const sliderAction = (entity, pct) => actionDetail(entity, {
  action: 'perform-action', perform_action: 'light.turn_on', target: { entity_id: entity }, data: { brightness_pct: pct }
});

/* ---------- A3: the elements ---------- */

class HeadingCard extends KheCard {
  static a3only = true;
  static css = `
.h{display:flex;align-items:center;gap:4px;margin:14px 4px 0;min-height:44px;font-size:22px;line-height:1.15;font-weight:700;letter-spacing:-0.015em}
.h svg{opacity:.45}
`;
  getCardSize() { return 1; }
  getGridOptions() { return { columns: 'full', rows: 1 }; }
  _check(c) { if (!c.heading) throw new Error('khe-heading-card: heading is required'); }
  _html() {
    const c = this._config, link = actionDetail(null, c.tap_action);
    this._actions = new Map([['h', link]]);
    const inner = `${esc(c.heading)}${link ? icon('chevron', 18, 'currentColor') : ''}`;
    return link ? `<button type="button" class="h" data-k="h"><span role="heading" aria-level="2">${inner}</span></button>` : `<h2 class="h">${inner}</h2>`;
  }
}

// the page's title, the outdoor temperature with its sheet, then people, alarms and live faults
class ChipsCard extends KheCard {
  static a3only = true;
  static css = `
.wrap{display:flex;flex-direction:column;gap:12px;padding:4px 0 2px}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 4px}
h1{margin:0;font-size:34px;line-height:1.05;font-weight:700;letter-spacing:-0.022em}
.out{min-height:44px;font-size:15px;font-weight:600;color:var(--sub)}
.row{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:flex;align-items:center;gap:7px;min-height:36px;padding:6px 12px 6px 6px;border-radius:18px;font-size:14px}
.chip i{width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--iconOff);color:var(--sub)}
.chip.ok i{background:var(--cheap);color:#fff}
.chip.bad i{background:var(--highBar);color:#fff}
.chip.bad{color:var(--high)}
.chip b{font-weight:600}
`;
  _watched() {
    const c = this._config;
    return [...(c.people || []), ...(c.alarms || []), ...(c.faults || [])].map(x => x.entity).concat(c.outdoor ? [c.outdoor.entity] : []);
  }
  _html(states) {
    const c = this._config;
    this._actions = new Map();
    this._sheets = new Map();
    const chip = (key, entity, cls, ic, name, word) => {
      this._actions.set(key, actionDetail(entity, { action: 'more-info' }));
      return `<button type="button" class="glass press chip ${cls}" data-k="${esc(key)}"><i>${icon(ic, 14, 'currentColor')}</i><span><b>${esc(name)}</b>${word ? ` ${esc(word)}` : ''}</span></button>`;
    };
    const list = [
      ...faultsOn(states, c.faults).map(f => chip(`f:${f.entity}`, f.entity, 'bad', 'alert', f.name, '')),
      ...(c.people || []).map(p => { const s = stateOf(states, p.entity); return chip(`p:${p.entity}`, p.entity, s === 'home' ? 'ok' : '', 'person', p.name, s === 'home' ? 'kodus' : hasValue(states[p.entity]) ? 'eemal' : 'pole teada'); }),
      ...(c.alarms || []).map(a => {
        const st = states[a.entity], s = (st || {}).state || '';
        const cls = ['triggered', 'pending'].includes(s) ? 'bad' : s.startsWith('armed_') ? 'ok' : '';
        return chip(`a:${a.entity}`, a.entity, cls, s.startsWith('armed_') ? 'shield-check' : 'shield', a.name, stateWord(st));
      })
    ];
    let out = '';
    if (c.outdoor) {
      const st = states[c.outdoor.entity];
      const v = hasValue(st) && formatNumber(st.state, c.outdoor.decimals ?? 1);
      this._sheets.set('out', { title: c.outdoor.name || 'Õues', entity: c.outdoor.entity, more: c.outdoor.entity, decimals: c.outdoor.decimals ?? 1, unit: '°C', color: 'teal', history: { entity: c.outdoor.entity, ...c.outdoor.history } });
      if (v) out = `<button type="button" class="out" data-k="out">${v}° õues</button>`;
    }
    return `<div class="wrap"><div class="head"><h1>${esc(c.title || 'Kodu')}</h1>${out}</div><div class="row">${list.join('')}</div></div>`;
  }
}

// system health as dots: green while fine, red when not, orange for pending updates
export function statusItems(states, conf) {
  const ok = (it, st) => {
    if (!hasValue(st)) return false;
    const o = it.ok || {};
    if (o.state) return o.state.includes(st.state);
    if (o.above !== undefined) return Number(st.state) > o.above;
    return true;
  };
  const out = (conf.items || []).map(it => {
    const st = states[it.entity];
    const good = ok(it, st);
    const value = it.value && hasValue(st) ? ` ${stateWord(st)}` : '';
    return { entity: it.entity, text: `${it.name}${value}`, tone: good ? 'ok' : 'bad' };
  });
  const pending = (conf.updates || []).filter(u => stateOf(states, u.entity) === 'on');
  if (pending.length) out.push({ entity: pending[0].entity, text: `Uuendus: ${joinEt(pending.map(u => u.name))}`, tone: 'mid' });
  return out;
}

class StatusCard extends KheCard {
  static a3only = true;
  static css = `
.box{display:flex;flex-direction:column;gap:8px;padding:14px 16px}
.t{font-size:15px;font-weight:600;display:flex;align-items:center;gap:2px;min-height:24px}
.t svg{opacity:.45}
.dots{display:flex;flex-wrap:wrap;gap:2px 14px}
.d{display:flex;align-items:center;gap:6px;min-height:32px;font-size:13px;color:var(--sub)}
.d i{width:7px;height:7px;border-radius:4px;background:var(--cheap)}
.d.bad{color:var(--high);font-weight:600}
.d.bad i{background:var(--highBar)}
.d.mid i{background:var(--midBar)}
`;
  _watched() { const c = this._config; return [...(c.items || []), ...(c.updates || [])].map(x => x.entity); }
  _html(states) {
    const c = this._config;
    const link = actionDetail(null, c.tap_action);
    this._actions = new Map([['t', link]]);
    const dots = statusItems(states, c).map((d, i) => {
      this._actions.set(`d${i}`, actionDetail(d.entity, { action: 'more-info' }));
      return `<button type="button" class="d ${d.tone}" data-k="d${i}"><i></i>${esc(d.text)}</button>`;
    }).join('');
    const title = `${esc(c.title || 'Süsteem')}${link ? icon('chevron', 16, 'currentColor') : ''}`;
    return `<div class="glass box">${link ? `<button type="button" class="t" data-k="t">${title}</button>` : `<span class="t">${title}</span>`}<div class="dots">${dots}</div></div>`;
  }
}

const PRICE_A3_CSS = `
.stack{display:flex;flex-direction:column;gap:10px}
.main{display:flex;flex-direction:column;gap:12px;width:100%;padding:16px 16px 14px;border-radius:24px}
.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.hd .l{display:flex;flex-direction:column;gap:2px}
.lab{font-size:13px;font-weight:600;color:var(--sub)}
.big{display:flex;align-items:baseline;gap:6px}
.big .n{font-size:46px;line-height:1;font-weight:700;letter-spacing:-0.035em}
.big .u{font-size:15px;font-weight:600;color:var(--sub)}
.badge{flex:none;padding:5px 11px;border-radius:14px;font-size:13px;font-weight:700}
.badge.good{background:var(--goodBg);color:var(--good)}
.badge.mid{background:var(--midBg);color:var(--mid)}
.badge.high{background:var(--highBg);color:var(--high)}
.ch{display:block}
.bars{display:block;width:100%;height:64px}
.ax{display:block;position:relative;height:14px;margin-top:4px;font-size:11px;font-weight:600;color:var(--sub)}
.ax span{position:absolute;top:0;white-space:nowrap}
.hr{height:1px;background:var(--hair)}
.lines{display:flex;flex-direction:column;gap:9px;font-size:14px;line-height:1.3}
.ln{display:flex;gap:10px;align-items:flex-start}
.ln svg{flex:none;margin-top:-1px}
.ln b{font-weight:600}
.use{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;padding:14px 16px;border-radius:22px}
.use > span{display:flex;flex-direction:column;gap:1px;min-width:0}
.use .v{font-size:20px;font-weight:700;letter-spacing:-0.02em}
.use .v small{font-size:13px;font-weight:600;color:var(--sub)}
.empty{font-size:14px;color:var(--sub)}
`;

// the price card's A3 look: the price now, the 48 bars, the window lines; the use row under it
function priceA3(card, states, pal) {
  const c = card._config;
  const level = states[c.level], fc = states[c.forecast];
  card._actions = new Map();
  card._sheets = new Map([['price', { title: 'Elekter, kõigi tasudega', entity: c.level, more: c.level, price: { forecast: c.forecast, bands: c.bands } }]]);
  const a = level && hasValue(level) ? level.attributes || {} : null;
  const arvel = a && formatNumber(a.arvel, 1), senti = a && formatNumber(a.senti, 1);
  const sub = a ? [a.hinnang, senti && `börsil ${senti} senti`].filter(Boolean).join(', ') : '';
  const badge = a ? `<span class="badge ${levelTone(level.state)}">${esc(cap(level.state))}</span>` : '';
  const top = `<span class="hd"><span class="l"><span class="lab">Praegu</span>${arvel ? `<span class="big"><span class="n num">${arvel}</span><span class="u">senti/kWh</span></span>` : '<span class="big"><span class="u">Hind pole teada</span></span>'}${sub ? `<span class="sub">${esc(cap(sub))}</span>` : ''}</span>${badge}</span>`;
  const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), c.bands);
  let chart = '<span class="empty">Hinnaprognoosi pole</span>';
  if (b) {
    const n = b.bars.length, slot = 336 / n, bw = Math.max(1, slot - 2);
    const paths = { cheap: '', mid: '', high: '' }, past = { cheap: '', mid: '', high: '' };
    let now = '';
    b.bars.forEach((x, i) => {
      const bh = Math.max(2, x.height * 62);
      (x.past ? past : paths)[x.level] += barRect(i * slot, 64 - bh, bw, bh);
      if (x.now) now = barRect(i * slot - 1, 64 - bh - 1, bw + 2, bh + 1);
    });
    const col = { cheap: pal.cheap, mid: pal.midBar, high: pal.highBar };
    const fill = (set, op) => Object.entries(set).map(([k, d]) => (d ? `<path d="${d}" fill="${col[k]}"${op ? ` fill-opacity="${op}"` : ''}/>` : '')).join('');
    const pct = i => `${((i * slot) / 336 * 100).toFixed(1)}%`;
    const marks = [`<span style="left:0">täna</span>`];
    if (b.current >= 0 && b.current > 2 && (n <= b.today || b.current < b.today - 4)) marks.push(`<span style="left:${pct(b.current)};transform:translateX(-50%)">nüüd</span>`);
    if (n > b.today) marks.push(`<span style="left:${pct(b.today)}">homme</span>`);
    chart = `<span class="ch"><svg class="bars" viewBox="0 0 336 64" preserveAspectRatio="none" aria-hidden="true">${fill(past, 0.35)}${fill(paths)}${now ? `<path d="${now}" fill="none" stroke="${pal.text}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ''}</svg><span class="ax" aria-hidden="true">${marks.join('')}</span></span>`;
  }
  const line = (ic, name, text) => `<span class="ln">${icon(ic, 20, pal.sub)}<span>${name ? `<b>${esc(name)}</b> ` : ''}${esc(text)}</span></span>`;
  const windows = (c.windows || []).map(w => [w.icon || 'bolt', w.name, ((states[w.entity] || {}).attributes || {}).tekst]).filter(([, , t]) => t);
  const tm = c.tomorrow && hasValue(states[c.tomorrow]) && (!c.tomorrow_flag || stateOf(states, c.tomorrow_flag) === 'on') && (states[c.tomorrow].attributes || {}).tekst;
  const lines = [...windows.map(([i, n, t]) => line(i, n, t)), ...(tm ? [line('moon', tm.startsWith('Homme ') ? 'Homme' : '', tm.startsWith('Homme ') ? tm.slice(6) : tm)] : [])];
  const main = `<button type="button" class="glass press main" data-k="price" aria-label="Elektri hind, ajalugu">${top}${chart}${lines.length ? `<span class="hr"></span><span class="lines">${lines.join('')}</span>` : ''}</button>`;
  let use = '';
  if ((c.usage || []).length) {
    const cells = c.usage.map(u => {
      const st = states[u.entity];
      const n = hasValue(st) && formatNumber(st.state);
      const kulu = hasValue(st) && (st.attributes || {}).kulu;
      return `<span><span class="lab">${esc(u.name)}</span><span class="v num">${n ? `${n} <small>${esc((st.attributes || {}).unit_of_measurement || '')}</small>` : '–'}</span><span class="sub">${esc(kulu || '')}</span></span>`;
    }).join('');
    const h = c.usage_history;
    if (h) card._sheets.set('use', { title: 'Tarbimine', entity: c.usage[0].entity, more: c.usage[0].entity, decimals: 1, unit: 'kWh', color: 'indigo', history: h });
    use = h ? `<button type="button" class="glass press use" data-k="use" aria-label="Tarbimine, ajalugu">${cells}</button>` : `<div class="glass use">${cells}</div>`;
  }
  return `<div class="stack">${main}${use}</div>`;
}

const TILE_A3_CSS = `
:host{height:100%}
.t{display:flex;flex-direction:column;gap:10px;height:100%;box-sizing:border-box;padding:12px;border-radius:22px}
.t.wide{gap:10px}
.t.off{opacity:.6}
.row{display:flex;align-items:center;gap:12px;min-width:0}
.ic{flex:none;width:44px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:var(--iconOff);color:var(--sub)}
.tx{flex:1;min-width:0;min-height:44px;display:flex;flex-direction:column;justify-content:center;gap:1px}
.nm{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tx .sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btns{flex:none;display:flex;gap:6px}
.btns button{min-width:58px;height:40px;padding:0 12px;border-radius:20px;background:var(--seg);font-size:14px;font-weight:600;text-align:center}
.btns button[aria-pressed="true"]{background:var(--press);color:var(--onPress)}
.corner{flex:none;width:44px;height:44px;border-radius:22px;background:var(--seg);display:flex;align-items:center;justify-content:center;margin-left:auto}
.top{display:flex;justify-content:space-between;align-items:center}
.sl{position:relative;display:block;height:36px;border-radius:18px;background:var(--track);overflow:hidden;cursor:pointer;touch-action:pan-y}
.sl i{position:absolute;left:0;top:0;bottom:0;background:var(--fill);transition:width 220ms cubic-bezier(.2,.9,.25,1)}
.sl.drag i{transition:none}
.seg{display:grid;grid-auto-columns:minmax(0,1fr);grid-auto-flow:column;gap:2px;padding:2px;border-radius:12px;background:var(--seg)}
.seg button{height:40px;border-radius:10px;font-size:14px;font-weight:600;text-align:center}
.seg button[aria-pressed="true"]{background:var(--segOn);box-shadow:var(--segShadow);cursor:default}
.val{display:flex;flex-direction:column;gap:6px;width:100%;height:100%;box-sizing:border-box;padding:12px 14px;border-radius:22px}
.val .lb{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--sub)}
.val .v{font-size:26px;line-height:1;font-weight:700;letter-spacing:-0.025em}
@media (prefers-reduced-motion: reduce){.sl i{transition:none}}
`;

// the tile's A3 look: small, wide with buttons, a slider or modes, or a value
function tileA3(card, states, pal) {
  const c = card._config;
  const st = states[c.entity];
  const ts = tileState(c, states);
  const name = tileName(c, st);
  const sheet = tileSheet(c, states);
  card._actions = new Map();
  card._sheets = new Map(sheet ? [['body', sheet]] : []);
  if (!sheet) card._actions.set('body', tileAction(c, 'tap'));
  const [disc, fg] = a3Color(c.color);
  const lit = ts.lit;
  const ic = icon((lit && c.icon_on) || c.icon, 22, 'currentColor');
  if (c.layout === 'value') {
    const label = Array.isArray(c.label) ? c.label.map(p => part(p, st, states)).filter(Boolean).join(' · ') : name;
    const { value, unit } = splitValue(st, c.decimals);
    return `<button type="button" class="glass press val" data-k="body" aria-label="${esc(`${name}: ${value}${unit ? ` ${unit}` : ''}`)}"><span class="lb">${icon(c.icon, 16, disc)}${esc(cap(label))}</span><span class="v num">${esc(value)}${unit ? ` ${esc(unit)}` : ''}</span><span class="sub">${esc(c.caption || '')}</span></button>`;
  }
  const iconAct = c.icon_tap_action ? tileAction(c, 'icon') : null;
  card._actions.set('icon', iconAct);
  const discStyle = lit ? ` style="background:${disc};color:${fg}"` : '';
  const discEl = iconAct
    ? `<button type="button" class="ic press" data-k="icon" aria-label="${esc(c.icon_label || name)}"${discStyle}>${ic}</button>`
    : `<span class="ic"${discStyle}>${ic}</span>`;
  const text = c.hide_state ? '' : ts.text;
  const body = `<button type="button" class="tx press" data-k="body" aria-label="${esc(text ? `${name}: ${text}` : name)}"><span class="nm">${esc(name)}</span>${text ? `<span class="sub">${esc(cap(text))}</span>` : ''}</button>`;
  const cls = `glass t${lit ? ' on' : ''}${c.wide ? ' wide' : ''}${ts.unavailable && !c.hide_state ? ' off' : ''}`;
  let extra = '';
  if (c.buttons) {
    extra = `<span class="btns">${c.buttons.map((b, i) => {
      card._actions.set(`b${i}`, actionDetail(c.entity, b.tap_action));
      return `<button type="button" class="press" data-k="b${i}" aria-pressed="${buttonOn(b, st)}">${esc(b.name)}</button>`;
    }).join('')}</span>`;
  }
  let corner = '';
  if (c.corner && lit) {
    card._actions.set('corner', actionDetail(c.entity, c.corner.tap_action));
    corner = `<button type="button" class="corner press" data-k="corner" aria-label="${esc(c.corner.label)}">${icon(c.corner.icon, 18, 'currentColor')}</button>`;
  }
  let below = '';
  if (c.slider) {
    const pct = brightnessPct(st);
    below = `<span class="sl" data-sl role="slider" tabindex="0" aria-label="${esc(`${name}: heledus`)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct ? `${pct} %` : 'väljas'}"><i style="width:${pct}%"></i></span>`;
  }
  if (c.modes) {
    const current = stateOf(states, c.entity);
    below = `<span class="seg" role="group" aria-label="${esc(`${name}: režiim`)}">${c.modes.map((m, i) => {
      card._actions.set(`m${i}`, modeAction(c.entity, m, current));
      return `<button type="button" class="press" data-k="m${i}" aria-pressed="${m.option === current}">${esc(m.name)}</button>`;
    }).join('')}</span>`;
  }
  if (c.wide) return `<div class="${cls}"><span class="row">${discEl}${body}${extra}${corner}</span>${below}</div>`;
  return `<div class="${cls}"><span class="top">${discEl}${corner}</span>${body}${below}</div>`;
}

// the slider: a drag holds redraws and moves the fill; the release, or an arrow key, sets the light
function wireSlider(card) {
  const el = card._root.querySelector('[data-sl]');
  if (!el) return;
  const entity = card._config.entity;
  const fill = el.firstChild;
  let pct = null, rect = null;
  const at = ev => pctAt(ev.clientX - rect.left, rect.width);
  const show = p => {
    if (p === pct) return;
    pct = p; fill.style.width = `${p}%`; el.setAttribute('aria-valuenow', String(p));
  };
  el.addEventListener('pointerdown', ev => {
    rect = el.getBoundingClientRect();
    el.setPointerCapture(ev.pointerId);
    card._hold(true);
    el.classList.add('drag');
    show(at(ev));
  });
  el.addEventListener('pointermove', ev => { if (el.hasPointerCapture(ev.pointerId)) show(at(ev)); });
  const end = ev => {
    if (!el.hasPointerCapture(ev.pointerId)) return;
    el.releasePointerCapture(ev.pointerId);
    el.classList.remove('drag');
    if (ev.type === 'pointerup' && pct !== null) card._fire(sliderAction(entity, pct));
    else show(brightnessPct(card._hass.states[entity]));
    card._hold(false);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', ev => {
    const step = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[ev.key];
    if (!step) return;
    ev.preventDefault();
    const p = Math.max(0, Math.min(100, brightnessPct(card._hass.states[entity]) + step));
    show(p);
    card._fire(sliderAction(entity, p));
  });
}

const ELEMENTS = [
  ['khe-summary-card', SummaryCard, 'KHE summary', 'The house in one sentence, with summary chips.'],
  ['khe-price-card', PriceCard, 'KHE price', 'The electricity price now, the hourly bars and the cheapest windows.'],
  ['khe-tile-card', TileCard, 'KHE tile', 'A device tile that is lit when on, with optional mode buttons.'],
  ['khe-chips-card', ChipsCard, 'KHE chips', 'The page title, the outdoor temperature, people, alarms and faults (A3).'],
  ['khe-heading-card', HeadingCard, 'KHE heading', 'A section heading, a link when it has a tap action (A3).'],
  ['khe-status-card', StatusCard, 'KHE status', 'System health as dots (A3).']
];
if (typeof customElements !== 'undefined') {
  window.customCards = window.customCards || [];
  for (const [tag, cls, name, description] of ELEMENTS) {
    if (customElements.get(tag)) continue;
    customElements.define(tag, cls);
    window.customCards.push({ type: tag, name, description });
  }
}
