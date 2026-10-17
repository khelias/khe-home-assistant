// Home Assistant cards of the redesigned views (ADR-002): khe-summary-card, khe-price-card and
// khe-tile-card. Kodu is the first view drawn with them; the design is the A2 canvas linked
// from the ADR. Actions go through HA as a hass-action event, so HA runs the confirmation,
// more-info, navigation and service call. No build step and no CDN; the pure helpers are
// exported for the Node tests, where there is no DOM.
// Bump KHE_CARDS_VERSION on every change to this file, and the same ?v= on the Lovelace
// resource URL: HA's /local and the phone app cache aggressively.
export const KHE_CARDS_VERSION = 1;

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
  alert: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>'
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
`;

// the card shell: a shadow root that redraws when a watched state, the dark flag or the clock key changes
const Base = typeof HTMLElement === 'function' ? HTMLElement : class {};
class KheCard extends Base {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('click', ev => this._click(ev));
  }
  setConfig(config) {
    this._check(config || {});
    this._config = config;
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
  }
  get hass() { return this._hass; }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 'full' }; }
  _check() {}
  _watched() { return []; }
  _clock() { return 0; }
  _draw() {
    if (!this._config || !this._hass) return;
    const pal = palette(this._hass.themes && this._hass.themes.darkMode);
    // keep the focus on the same control across a redraw
    const focused = this.shadowRoot.activeElement && this.shadowRoot.activeElement.dataset.k;
    this.shadowRoot.innerHTML = `<style>${cssVars(pal)}${BASE_CSS}${this.constructor.css}</style>${this._html(this._hass.states, pal)}`;
    if (focused) { const el = this.shadowRoot.querySelector(`[data-k="${CSS.escape(focused)}"]`); if (el) el.focus(); }
  }
  _click(ev) {
    const b = ev.target.closest('button[data-k]');
    const detail = b && this._actions && this._actions.get(b.dataset.k);
    if (detail) this.dispatchEvent(new CustomEvent('hass-action', { detail, bubbles: true, composed: true }));
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
  _check(c) { if (!c.level || !c.forecast) throw new Error('khe-price-card: level and forecast are required'); }
  _watched() {
    const c = this._config;
    return [c.level, c.forecast, c.tomorrow, ...(c.windows || []).map(w => w.entity), ...(c.usage || []).map(u => u.entity)].filter(Boolean);
  }
  // the past and current hour move with the clock, not with a state
  _clock() { return Math.floor(Date.now() / HOUR); }
  // a redraw at each hour boundary; Estonia's offset is whole hours, so UTC's hours are local ones
  connectedCallback() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { if (this._hass) this.hass = this._hass; this.connectedCallback(); }, HOUR - (Date.now() % HOUR) + 1000);
  }
  disconnectedCallback() { clearTimeout(this._timer); }
  _html(states) {
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
  _check(c) { if (!c.entity) throw new Error('khe-tile-card: entity is required'); }
  _watched() {
    const c = this._config;
    return [c.entity, ...(Array.isArray(c.state_text) ? c.state_text.map(partEntity).filter(Boolean) : [])];
  }
  // the size for a hand-written config; the generator's grid_options win in HA and the demo
  getCardSize() { return this._config && this._config.modes ? 3 : 2; }
  getGridOptions() { return this._config && this._config.modes ? { columns: 'full' } : { columns: 6, rows: 2 }; }
  _html(states, pal) {
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

const ELEMENTS = [
  ['khe-summary-card', SummaryCard, 'KHE summary', 'The house in one sentence, with summary chips.'],
  ['khe-price-card', PriceCard, 'KHE price', 'The electricity price now, the hourly bars and the cheapest windows.'],
  ['khe-tile-card', TileCard, 'KHE tile', 'A device tile that is lit when on, with optional mode buttons.']
];
if (typeof customElements !== 'undefined') {
  window.customCards = window.customCards || [];
  for (const [tag, cls, name, description] of ELEMENTS) {
    if (customElements.get(tag)) continue;
    customElements.define(tag, cls);
    window.customCards.push({ type: tag, name, description });
  }
}
