// Home Assistant cards of the redesigned views (ADR-002, ADR-005): khe-summary-card,
// khe-price-card, khe-tile-card and, for Kodu A3, khe-chips-card, khe-heading-card and
// khe-status-card, with `style: a3` drawing glass boxes and a tap opening a history sheet;
// Energia's month, days and split cards (ADR-008), a days card's long-range sheet (ADR-013) and
// Soojuspump's reading card (ADR-011).
// The A2 and A3 designs are linked from the ADRs. Actions go through HA as a hass-action event, so HA runs the confirmation,
// more-info, navigation and service call. No build step and no CDN; the pure helpers are
// exported for the Node tests, where there is no DOM.
// Bump KHE_CARDS_VERSION on every change to this file, and the same ?v= on the Lovelace
// resource URL: HA's /local and the phone app cache aggressively.
export const KHE_CARDS_VERSION = 14;


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
  home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  tune: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4"/>'
};
const icon = (key, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] || ICONS.bolt}</svg>`;

/* ---------- text ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const NO_VALUE = new Set(['unavailable', 'unknown', '']);
const hasValue = st => !!st && !NO_VALUE.has(st.state);
const stateOf = (states, entity) => (states[entity] || {}).state;

// The cards' own words, one table per language, chosen by the card's `language` config and never
// by the HA profile (ADR-012): a household member with an English profile still reads Estonian.
// Every Estonian letter in this file stays inside ET and ET_SENSOR; a test holds the line.
const ET = {
  locale: 'et-EE', and: 'ja',
  words: {
    on: 'sees', off: 'väljas', open: 'lahti', closed: 'kinni', opening: 'avaneb', closing: 'sulgub', playing: 'mängib',
    paused: 'pausil', idle: 'ootel', standby: 'ootel', buffering: 'laeb', home: 'kodus', not_home: 'eemal', disarmed: 'valveta',
    arming: 'valvestub', pending: 'sisenemisviivitus', triggered: 'häire', heat: 'küte', eco: 'säästlik',
    performance: 'kiirsoojendus', unknown: 'teadmata', unavailable: 'pole saadaval'
  },
  armed: 'valves', notKnown: 'pole teada', away: 'eemal', home: 'kodus',
  alarmOn: l => `Valve on häires: ${l}.`, attention: l => `Vajab tähelepanu: ${l}.`, allOk: 'Kõik on korras.',
  priceNow: w => ` Elekter on praegu ${w}.`,
  security: { triggered: 'häires', pending: 'sisenemisviivitus', arming: 'valvestub', armed: 'valves' },
  allDisarmed: 'kõik valveta', peopleHome: l => `${l} kodus`, nobodyHome: 'keegi pole kodus',
  electricity: 'Elekter', securityLabel: 'Turvalisus', climate: 'Kliima', people: 'Inimesed', centShort: 's',
  cents: 'senti/kWh', priceUnknown: 'Hind pole teada', energyLink: 'Energia ›', noForecast: 'Hinnaprognoosi pole',
  today: 'täna', tomorrow: 'homme', yesterday: 'eile', now: 'nüüd', hourPrices: both => `Tunnihinnad, täna${both ? ' ja homme' : ''}`,
  hourPrice: both => `Tunnihind täna${both ? ' ja homme' : ''}`, mode: n => `${n}: režiim`, brightness: n => `${n}: heledus`,
  ranges: { '24h': '24 h', '7d': '7 päeva', '30d': '30 päeva', '90d': '90 päeva', '12m': '12 kuud' }, range: 'Ajavahemik',
  close: 'Sulge', more: 'Rohkem', systemPage: 'Süsteemi leht', loading: 'Laen…', historyFailed: 'Ajalugu ei saanud lugeda',
  dataFailed: 'Andmeid ei saanud lugeda', noData: 'Selle aja kohta andmeid pole', noDataShort: 'Andmeid pole',
  history: n => `${n}, ajalugu`, lowest: 'Madalaim', mean: 'Keskmine', highest: 'Kõrgeim', cheapest: 'Odavaim', dearest: 'Kalleim',
  stateNow: 'Praegu', times: 'Kordi', total: 'Kokku', cost: 'Kulu', peakHour: 'Suurim tund', peakDay: 'Suurim päev',
  outdoors: 'Õues', outside: v => `${v}° õues`, homeTitle: 'Kodu', system: 'Süsteem', update: l => `Uuendus: ${l}`,
  priceTitle: 'Elekter, kõigi tasudega', exchange: v => `börsil ${v} senti`, priceAria: 'Elektri hind, ajalugu',
  use: 'Tarbimine', useAria: 'Tarbimine, ajalugu',
  weekdays: ['pühapäev', 'esmaspäev', 'teisipäev', 'kolmapäev', 'neljapäev', 'reede', 'laupäev'],
  // "in <month>": the inessive is not one suffix for all
  monthsShort: ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'],
  inMonth: ['jaanuaris', 'veebruaris', 'märtsis', 'aprillis', 'mais', 'juunis', 'juulis', 'augustis', 'septembris', 'oktoobris', 'novembris', 'detsembris'],
  dayMonth: (d, m) => `${d}.${m}`, at: h => `kell ${h}`,
  rest: 'Ülejäänud maja', restNote: 'kõik, mida eraldi ei mõõdeta', late: 'andmed hilinevad', todayLate: 'täna, andmed hilinevad',
  inLast: (m, v) => `${m} ${v} kWh`, splitAria: (n, v) => `${n}, ${v} kWh sel kuul, ajalugu`,
  curve: v => (!v ? 'Küttevesi täpselt kõvera järgi' : `Küttevesi ${Math.abs(v)}° ${v > 0 ? 'soojem' : 'jahedam'} kui kõvera järgi`),
  ofHouse: p => `${p} % majast`, fault: 'Viga', offState: 'Väljas', stateUnknown: 'Seisund pole teada',
  compare: { high: m => `Kallim kui ${m}`, good: m => `Odavam kui ${m}`, mid: m => `Sama hinnaga kui ${m}` },
  thisMonth: 'Sel kuul', costUnknown: 'Kulu pole teada', average: v => `, keskmiselt ${v} senti/kWh`,
  dayOf: (d, n) => `${d} päeva ${n}-st`, pace: v => `Selle tempoga umbes ${v} €`, todayCell: 'Täna', yesterdayCell: 'Eile',
  noFees: 'Eurod ilma kuutasudeta.', monthAria: 'Sel kuul, tarbimise ajalugu', monthDate: (m, d) => `${m}, ${d}. päev`, energy: 'Energia',
  unitSwitch: 'Ühik', dayAvg: 'päeva keskmine', dearestHour: 'kalleim tund', dearestHourAt: v => `kalleim tund ${v}`,
  cheapestDay: 'Odavaim päev', dearestDay: 'Kalleim päev', largest: 'Suurim', smallest: 'Väikseim', todaySoFar: 'Täna seni', dayNotOver: 'päev pole läbi',
  target: t => `Siht ${t}`, notBelow: v => `, mitte alla ${v}°`, rangeNote: (h, a, b) => `${h} tunniga ${a} kuni ${b}`, limit: v => `${v}° piir`,
  ratio: v => `${v} korda`, inLastShort: (m, v) => `${m} ${v}`,
  failed: 'Ei õnnestunud', shiftDown: 'Nihe ühe kraadi võrra alla', shiftUp: 'Nihe ühe kraadi võrra üles',
  perDayAvg: 'päevas keskmiselt', perMonthAvg: 'kuus keskmiselt', smallestDay: 'Väikseim päev', smallestMonth: 'Väikseim kuu',
  largestMonth: 'Suurim kuu', last: 'Viimane', monthNotOver: 'kuu pole läbi', partialMonth: 'osaline kuu', partialDay: 'osaline päev'
};
const EN = {
  locale: 'en-GB', and: 'and',
  words: {
    on: 'on', off: 'off', open: 'open', closed: 'closed', opening: 'opening', closing: 'closing', playing: 'playing',
    paused: 'paused', idle: 'idle', standby: 'standby', buffering: 'buffering', home: 'home', not_home: 'away', disarmed: 'disarmed',
    arming: 'arming', pending: 'entry delay', triggered: 'alarm', heat: 'heating', eco: 'eco',
    performance: 'boost', unknown: 'unknown', unavailable: 'unavailable'
  },
  armed: 'armed', notKnown: 'not known', away: 'away', home: 'home',
  alarmOn: l => `Alarm triggered: ${l}.`, attention: l => `Needs attention: ${l}.`, allOk: 'All is well.',
  priceNow: w => ` Electricity is ${w} right now.`,
  security: { triggered: 'alarm triggered', pending: 'entry delay', arming: 'arming', armed: 'armed' },
  allDisarmed: 'all disarmed', peopleHome: l => `${l} home`, nobodyHome: 'nobody home',
  electricity: 'Electricity', securityLabel: 'Security', climate: 'Climate', people: 'People', centShort: 'c',
  cents: 'cents/kWh', priceUnknown: 'Price not known', energyLink: 'Energy ›', noForecast: 'No price forecast',
  today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday', now: 'now', hourPrices: both => `Hourly prices, today${both ? ' and tomorrow' : ''}`,
  hourPrice: both => `Hourly price today${both ? ' and tomorrow' : ''}`, mode: n => `${n}: mode`, brightness: n => `${n}: brightness`,
  ranges: { '24h': '24 h', '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months' }, range: 'Time range',
  close: 'Close', more: 'More', systemPage: 'System page', loading: 'Loading…', historyFailed: 'Could not read the history',
  dataFailed: 'Could not read the data', noData: 'No data for this period', noDataShort: 'No data',
  history: n => `${n}, history`, lowest: 'Lowest', mean: 'Average', highest: 'Highest', cheapest: 'Cheapest', dearest: 'Dearest',
  stateNow: 'Now', times: 'Times', total: 'Total', cost: 'Cost', peakHour: 'Largest hour', peakDay: 'Largest day',
  outdoors: 'Outdoors', outside: v => `${v}° outside`, homeTitle: 'Home', system: 'System', update: l => `Update: ${l}`,
  priceTitle: 'Electricity, all fees included', exchange: v => `${v} cents on the exchange`, priceAria: 'Electricity price, history',
  use: 'Use', useAria: 'Use, history',
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  inMonth: ['in January', 'in February', 'in March', 'in April', 'in May', 'in June', 'in July', 'in August', 'in September', 'in October', 'in November', 'in December'],
  dayMonth: (d, m) => `${d}/${m}`, at: h => `at ${h}`,
  rest: 'Rest of the house', restNote: 'everything not metered on its own', late: 'data delayed', todayLate: 'today, data delayed',
  inLast: (m, v) => `${v} kWh ${m}`, splitAria: (n, v) => `${n}, ${v} kWh this month, history`,
  curve: v => (!v ? 'Heating water right on the curve' : `Heating water ${Math.abs(v)}° ${v > 0 ? 'warmer' : 'cooler'} than the curve`),
  ofHouse: p => `${p} % of the house`, fault: 'Fault', offState: 'Off', stateUnknown: 'State not known',
  compare: { high: m => `Dearer than ${m}`, good: m => `Cheaper than ${m}`, mid: m => `Same price as ${m}` },
  thisMonth: 'This month', costUnknown: 'Cost not known', average: v => `, on average ${v} cents/kWh`,
  dayOf: (d, n) => `Day ${d} of ${n}`, pace: v => `At this pace about ${v} €`, todayCell: 'Today', yesterdayCell: 'Yesterday',
  noFees: 'Euros without monthly fees.', monthAria: 'This month, use history', monthDate: (m, d) => `${m}, day ${d}`, energy: 'Energy',
  unitSwitch: 'Unit', dayAvg: 'day average', dearestHour: 'dearest hour', dearestHourAt: v => `dearest hour ${v}`,
  cheapestDay: 'Cheapest day', dearestDay: 'Dearest day', largest: 'Largest', smallest: 'Smallest', todaySoFar: 'Today so far', dayNotOver: 'day not over',
  target: t => `Target ${t}`, notBelow: v => `, not below ${v}°`, rangeNote: (h, a, b) => `${a} to ${b} in ${h} hours`, limit: v => `${v}° limit`,
  ratio: v => `${v} times`, inLastShort: (m, v) => `${v} ${m}`,
  failed: 'Did not work', shiftDown: 'Shift one degree down', shiftUp: 'Shift one degree up',
  perDayAvg: 'a day on average', perMonthAvg: 'a month on average', smallestDay: 'Smallest day', smallestMonth: 'Smallest month',
  largestMonth: 'Largest month', last: 'Last', monthNotOver: 'month not over', partialMonth: 'partial month', partialDay: 'partial day'
};
// The words the house's sensors write (the price level, the tomorrow line's lead word), as they
// arrive in each language: the house's templates write Estonian, the English demo English.
const ET_SENSOR = {
  tone: { 'väga odav': 'good', odav: 'good', tavaline: 'mid', 'kõrgevõitu': 'mid', kallis: 'high', 'väga kallis': 'high' },
  phrase: { tavaline: 'tavalise hinnaga' }, lead: 'Homme'
};
const EN_SENSOR = {
  tone: { 'very cheap': 'good', cheap: 'good', normal: 'mid', 'fairly high': 'mid', expensive: 'high', 'very expensive': 'high' },
  phrase: { normal: 'at its normal price' }, lead: 'Tomorrow'
};
const LANGS = { et: [ET, ET_SENSOR], en: [EN, EN_SENSOR] };
// the table of a language, Estonian for any other
export const words = lang => (LANGS[lang] || LANGS.et)[0];
export const sensorWords = lang => (LANGS[lang] || LANGS.et)[1];
export const LANGUAGES = Object.keys(LANGS);

// "a", "a ja b", "a, b ja c", in English "a, b and c"
export function joinEt(list, lang = 'et') {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${words(lang).and} ${list[list.length - 1]}`;
}

// a number in the language's format (the Estonian decimal comma), as many decimals as given or as
// the string carries
const NF = new Map();
export function formatNumber(v, decimals, lang = 'et') {
  const s = String(v ?? ''), n = Number(s);
  if (s.trim() === '' || !Number.isFinite(n)) return null;
  const d = Math.min(2, decimals ?? (s.split('.')[1] || '').length), loc = words(lang).locale, k = `${loc}|${d}`;
  if (!NF.has(k)) NF.set(k, new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d }));
  return NF.get(k).format(n);
}
const withUnit = (n, unit) => (unit === '°C' ? `${n}°` : unit ? `${n} ${unit}` : n);

// the lower-case state words the canvas uses in a tile's second line; HA's formatEntityState
// capitalises and names each armed mode, where the design wants one "valves"
export function stateWord(st, lang = 'et') {
  const w = words(lang);
  if (!st) return w.words.unavailable;
  const s = st.state;
  if (s.startsWith('armed_')) return w.armed;
  if (Object.hasOwn(w.words, s)) return w.words[s];
  const n = formatNumber(s, undefined, lang);
  return n === null ? s : withUnit(n, (st.attributes || {}).unit_of_measurement);
}
const TEMPERATURE_ATTRS = new Set(['current_temperature', 'temperature']);
function attrText(st, key, lang) {
  const v = st && st.attributes ? st.attributes[key] : undefined;
  if (v === undefined || v === null || v === '') return '';
  const n = typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? formatNumber(v, undefined, lang) : null;
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


const faultsOn = (states, faults) => (faults || []).filter(f => { const st = states[f.entity]; return !!st && st.state === (f.bad ?? 'on'); });

// { text, warn }: the house in one or two sentences
export function sentence(states, conf, lang = 'et') {
  const triggered = (conf.alarms || []).filter(a => stateOf(states, a.entity) === 'triggered');
  const faults = faultsOn(states, conf.faults);
  const w = words(lang);
  let text, warn = true;
  if (triggered.length) text = w.alarmOn(joinEt(triggered.map(a => a.name), lang));
  else if (faults.length) text = w.attention(joinEt(faults.map(f => f.name), lang));
  else { text = w.allOk; warn = false; }
  const level = conf.price && states[conf.price];
  if (hasValue(level)) text += w.priceNow(sensorWords(lang).phrase[level.state] || level.state);
  return { text, warn };
}

// the security chip's line: what is armed, arming, delayed or alarming, per partition
export function securityText(states, alarms, lang = 'et') {
  const w = words(lang), groups = Object.entries(w.security);
  const of = a => { const s = stateOf(states, a.entity) || 'unavailable'; return s.startsWith('armed_') ? 'armed' : s; };
  const parts = [];
  for (const [key, word] of groups) {
    const names = alarms.filter(a => of(a) === key).map(a => a.name.toLowerCase());
    if (names.length) parts.push(`${joinEt(names, lang)} ${word}`);
  }
  if (parts.length) return parts.join(', ');
  return alarms.every(a => of(a) === 'disarmed') ? w.allDisarmed : w.notKnown;
}

export function peopleText(states, people, lang = 'et') {
  const home = people.filter(p => stateOf(states, p.entity) === 'home').map(p => p.name), w = words(lang);
  return home.length ? w.peopleHome(joinEt(home, lang)) : w.nobodyHome;
}

// [{ key, icon, color, label, value, warn, tap }]: the faults that are on, then the four summaries
export function chips(states, conf, lang = 'et') {
  const w = words(lang);
  const out = faultsOn(states, conf.faults).map(f => ({ key: `fault:${f.entity}`, icon: 'alert', label: f.name, warn: true, tap: actionDetail(f.entity, { action: 'more-info' }) }));
  const level = conf.price && states[conf.price];
  if (conf.price) {
    const arvel = level && formatNumber((level.attributes || {}).arvel, 1, lang);
    const value = hasValue(level) ? `${arvel ? `${arvel} ${w.centShort}, ` : ''}${level.state}` : w.notKnown;
    out.push({ key: 'price', icon: 'bolt', color: 'green', label: w.electricity, value, tap: navigate(conf.energy_path) });
  }
  const alarms = conf.alarms || [];
  if (alarms.length) {
    const armed = alarms.some(a => (stateOf(states, a.entity) || '').startsWith('armed_'));
    const alarming = alarms.some(a => ['triggered', 'pending'].includes(stateOf(states, a.entity)));
    out.push({ key: 'security', icon: armed ? 'shield-check' : 'shield', color: 'blue', label: w.securityLabel, value: securityText(states, alarms, lang), warn: alarming, tap: actionDetail(alarms[0].entity, { action: 'more-info' }) });
  }
  const c = conf.climate || {};
  const t = states[c.temperature], h = states[c.humidity];
  const tn = hasValue(t) && formatNumber(t.state, 1, lang), hn = hasValue(h) && formatNumber(h.state, 0, lang);
  const climate = [tn && `${tn}°`, hn && `${hn} %`].filter(Boolean);
  if (climate.length) out.push({ key: 'climate', icon: 'thermometer', color: 'warm', label: w.climate, value: climate.join(' · ') });
  const people = conf.people || [];
  if (people.length) out.push({ key: 'people', icon: 'people', label: w.people, value: peopleText(states, people, lang), tap: actionDetail(people[0].entity, { action: 'more-info' }) });
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
      return { t: p.t, s: at, level: priceLevel(p.t, bands), height: Math.max(0, Math.min(1, p.t / PRICE_SCALE)), past: at + HOUR <= t, now: at <= t && t < at + HOUR, tomorrow: at >= day1 };
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
function part(p, st, states, lang) {
  const e = partEntity(p);
  const v = e ? (hasValue(states[e]) ? stateWord(states[e], lang) : '') : p === 'state' ? stateWord(st, lang) : attrText(st, typeof p === 'object' ? p.attribute : p, lang);
  return v && p.label ? `${p.label} ${v}` : v;
}

// { lit, unavailable, text } for the tile's look and its second line
export function tileState(conf, states, lang = 'et') {
  const st = states[conf.entity];
  const sc = conf.state_text;
  // a fixed text (a link's description) stays whatever the entity's state
  if (typeof sc === 'string') return { lit: tileActive(st, conf.active), unavailable: false, text: sc };
  if (!hasValue(st)) return { lit: false, unavailable: true, text: words(lang).words.unavailable };
  const lit = tileActive(st, conf.active);
  let text;
  if (Array.isArray(sc)) text = sc.map(p => part(p, st, states, lang)).filter(Boolean).join(' · ');
  else text = stateWord(st, lang);
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
    this._lang = config.language;
    this._w = words(config.language);
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
    const s = sentence(states, c, this._lang);
    this._actions = new Map();
    const list = chips(states, c, this._lang).map(ch => {
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
  // a mouse over the bars shows that hour's price in place of the price now; a tap opens the sheet
  _wire() {
    const P = this._a3 && this._point, svg = P && this._root.querySelector('svg.bars');
    if (!svg) return;
    const hd = this._root.querySelector('.hd'), lab = hd.querySelector('.lab'), n = hd.querySelector('.n'), sel = svg.querySelector('.sel');
    const was = [lab.textContent, n.textContent];
    wirePoint(svg, f => Math.min(P.bars.length - 1, Math.floor(f * P.bars.length)), i => {
      hd.classList.toggle('pointing', i !== null);
      sel.setAttribute('visibility', i === null ? 'hidden' : 'visible');
      if (i === null) { [lab.textContent, n.textContent] = was; return; }
      sel.setAttribute('x', (i * P.slot - 1).toFixed(1));
      lab.textContent = cap(hourSpan(P.bars[i], this._lang));
      n.textContent = formatNumber((P.bars[i].t * 100).toFixed(1), 1, this._lang);
    }, false);
  }
  _html(states, pal) {
    if (this._a3) return priceA3(this, states, pal);
    const c = this._config, w = this._w;
    const level = states[c.level], fc = states[c.forecast];
    const link = navigate(c.energy_path);
    this._actions = new Map([['energy', link]]);
    const arvel = hasValue(level) && formatNumber((level.attributes || {}).arvel, 1, this._lang);
    const hinnang = hasValue(level) && (level.attributes || {}).hinnang;
    const top = `<div class="top">${arvel ? `<span class="num">${arvel}</span><span class="unit">${w.cents} · ${esc(level.state)}</span>` : `<span class="unit">${w.priceUnknown}</span>`}${link ? `<button type="button" class="link" data-k="energy">${esc(w.energyLink)}</button>` : ''}</div>${hinnang ? `<p class="hint">${esc(hinnang)}.</p>` : ''}`;
    const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), c.bands);
    let chart;
    if (!b) chart = `<p class="empty">${w.noForecast}</p>`;
    else {
      const bars = b.bars.map(x => `<div class="bar ${x.level}${x.past ? ' past' : ''}${x.tomorrow ? ' tomorrow' : ''}${x.now ? ' now' : ''}" style="height:${(x.height * 100).toFixed(1)}%"></div>`).join('');
      const axis = b.bars.length > b.today ? ['00', '12', `<span class="day">${w.tomorrow}</span>`, '12', '24'] : ['00', '06', '12', '18', '24'];
      const label = w.hourPrices(b.bars.length > b.today);
      chart = `<div class="bars" role="img" aria-label="${label}">${bars}</div><div class="axis" aria-hidden="true">${axis.map(a => `<span>${a}</span>`).join('')}</div>`;
    }
    const windows = (c.windows || []).map(w => [w.name, (states[w.entity] && states[w.entity].attributes || {}).tekst]).filter(([, t]) => t);
    const tomorrow = hasValue(states[c.tomorrow]) && (states[c.tomorrow].attributes || {}).tekst;
    const usage = (c.usage || []).map(u => {
      const st = states[u.entity];
      if (!hasValue(st)) return [u.name, w.words.unavailable];
      const kulu = (st.attributes || {}).kulu;
      return [u.name, `${stateWord(st, this._lang)}${kulu ? ` · ${kulu}` : ''}`];
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
    const ts = tileState(c, states, this._lang);
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
    return `<ha-card class="modes ${cls}"><div class="head">${passes ? '' : discEl}${body}</div><div class="seg" role="group" aria-label="${esc(this._w.mode(name))}">${seg}</div></ha-card>`;
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
  indigo: ['#5e5ce6', '#fff'], green: ['#34c759', '#fff'], red: ['#ff453a', '#fff'], heat: ['#ff6b35', '#fff'], gray: ['#8e8e93', '#fff']
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
  '24h': { ms: 24 * HOUR, period: '5minute', energy: 'hour' },
  '7d': { ms: 7 * 24 * HOUR, period: 'hour', energy: 'day' },
  '30d': { ms: 30 * 24 * HOUR, period: 'day', energy: 'day' }
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

// an axis label of a moment: hours for a day, weekdays for a week, dates for 30 or 90 days,
// months for 12; in the browser's zone, or in tz
export function axisLabel(range, lang = 'et', tz) {
  const w = words(lang);
  // the locale's short month is the whole name in Estonian
  if (range === '12m') { const zone = tz || localZone(); return t => w.monthsShort[zoneParts(t, zone).m - 1]; }
  const fmt = range === '24h' ? { hour: '2-digit', minute: '2-digit' } : range === '7d' ? { weekday: 'short' } : { day: 'numeric', month: 'numeric' };
  const F = new Intl.DateTimeFormat(w.locale, { ...fmt, timeZone: tz });
  return t => F.format(new Date(t));
}
// five axis labels from t0 to t1, the last one now
export function axisLabels(range, t0, t1, lang = 'et', tz) {
  const label = axisLabel(range, lang, tz);
  return [0, 1, 2, 3].map(i => label(t0 + ((t1 - t0) * i) / 4)).concat(words(lang).now);
}

// a price level's tone by the word the level sensor writes in that language
export const levelTone = (word, lang = 'et') => sensorWords(lang).tone[word] || 'mid';
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

const unitOf = st => ((st || {}).attributes || {}).unit_of_measurement || '';

// a value split for display: { value, unit } with the decimal comma, or the state word; `scale`
// and `unit` show it in another unit than the entity's (HA states carry no display precision,
// so `decimals` sets it)
export function splitValue(st, decimals, lang = 'et', { scale = 1, unit } = {}) {
  if (!hasValue(st)) return { value: stateWord(st, lang), unit: '' };
  const v = num(st.state), n = v === null ? null : formatNumber(scale === 1 ? st.state : String(v * scale), decimals, lang);
  if (n === null) return { value: stateWord(st, lang), unit: '' };
  const u = unit ?? unitOf(st);
  return u === '°C' ? { value: `${n}°`, unit: '' } : { value: n, unit: u };
}
// a split value as one string, "41 %" or "21,8°"
const valueText = (st, decimals, lang, opts) => { const r = splitValue(st, decimals, lang, opts); return withUnit(r.value, r.unit); };

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
dialog .chart svg{display:block;width:100%;height:170px;touch-action:pan-y}
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

// pointing at a chart: pick(f) turns the pointer's place across el (0 to 1) into an index or null,
// show(index or null, f) draws it. A mouse shows what is under it and clears on leaving; a finger
// keeps what it touched until it taps the same again, unless touch is false: the tap is the card's
function wirePoint(el, pick, show, touch = true) {
  let shown = null, before = null, f = 0;
  const at = ev => { const r = el.getBoundingClientRect(); f = Math.max(0, Math.min(1, (ev.clientX - r.left) / (r.width || 1))); return pick(f); };
  const set = j => { shown = j; show(j, f); };
  const mouse = ev => ev.pointerType === 'mouse';
  el.addEventListener('pointermove', ev => { if (mouse(ev) || (touch && ev.buttons)) set(at(ev)); });
  el.addEventListener('pointerleave', ev => { if (mouse(ev)) set(null); });
  if (!touch) return;
  el.addEventListener('pointerdown', ev => { if (!mouse(ev)) { before = shown; set(at(ev)); } });
  el.addEventListener('pointerup', ev => { if (!mouse(ev) && at(ev) === before) set(null); });
}
const SEL = color => `<path class="sel" d="" stroke="${color}" stroke-opacity="0.45" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;

// One <dialog> per card, opened with showModal() into the top layer. spec: { title, entity, more,
// decimals, unit, color, history }, { title, price: { forecast, level, bands } } or a days card's
// { days: true, title, statistic, type, ... } (daysSheet).
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
      else if ((this.spec.days ? DAYS_RANGES : RANGES)[s]) { this.range = s; this.load(); }
    });
    d.addEventListener('close', () => { this.token = null; });
  }
  open(spec) {
    this.spec = spec;
    this.range = spec.days ? '30d' : '24h';
    this.data = null;
    this.load();
    if (!this.el.open) this.el.showModal();
  }
  // the value now follows the house while the sheet is open; a days sheet's is its data's average
  live() {
    if (!this.el.open || this.pointing || this.spec.days) return;
    const v = this.el.querySelector('.now');
    if (v) v.innerHTML = this.nowHtml();
  }
  nowHtml() {
    const sp = this.spec, st = this.card._hass.states[sp.entity], L = this.card._lang, w = this.card._w;
    if (sp.days) {
      const d = this.data && this.data.series, s = d && d.stats;
      if (!s) return '<span class="v">–</span>';
      return `<span class="v num">${esc(fmtN(s.avg, sp.decimals, L))}</span><span class="u">${esc(`${sp.unit} ${d.period === 'month' ? w.perMonthAvg : w.perDayAvg}`.trim())}</span>`;
    }
    if (sp.price) {
      const a = hasValue(st) && formatNumber((st.attributes || {}).arvel, 1, L);
      return a ? `<span class="v num">${a}</span><span class="u">${w.cents}</span>` : `<span class="v">${w.notKnown}</span>`;
    }
    if (sp.text) return `<span class="v">${esc(sp.text(this.card._hass.states))}</span>`;
    const { value, unit } = splitValue(st, sp.decimals, L);
    return `<span class="v num">${esc(value)}</span>${unit ? `<span class="u">${esc(unit)}</span>` : ''}`;
  }
  async load() {
    const sp = this.spec;
    if (sp.price || !(sp.history || sp.days)) { this.render(); return; }
    const token = (this.token = {}), range = this.range, now = Date.now();
    this.data = { loading: true };
    this.render();
    let series;
    try {
      const hass = this.card._hass;
      if (sp.days) {
        // the card's own cutoff request, shared with it in the same hour; without it only the
        // last slot is out, as the card does
        const tz = tzOf(hass);
        const cutReq = sp.cutoff ? fetchShared(hass, hourlyRequest(sp.cutoff, now), hourKeyOf(now, tz)).catch(() => null) : null;
        const [resp, cut] = await Promise.all([hass.callWS(daysSheetRequest(sp, range, now, tz)), cutReq]);
        series = { kind: 'slots', tz, ...slotSeries(resp, sp, range, now, tz, (cut && dataCutoff(cut, sp.cutoff)) ?? Infinity) };
      } else {
        const h = sp.history;
        series = seriesFrom(await hass.callWS(historyRequest(h, range, now)), h);
        // an entity whose statistics come back empty (none kept, or a new one) falls back to history
        if (series.kind === 'empty' && h.source === 'statistics' && h.type !== 'change') {
          const hh = { ...h, source: 'history' };
          series = seriesFrom(await hass.callWS(historyRequest(hh, range, now)), hh);
        }
      }
    } catch (e) {
      series = { kind: 'error', points: [] };
    }
    if (this.token !== token) return;
    this.data = { series, range, now };
    this.render();
  }
  render() {
    const sp = this.spec, ranged = !sp.price && (sp.history || sp.days), w = this.card._w;
    const ranges = ranged ? `<div class="ranges" role="group" aria-label="${w.range}">${Object.keys(sp.days ? DAYS_RANGES : RANGES).map(k => `<button type="button" data-s="${k}" aria-pressed="${k === this.range}">${w.ranges[k]}</button>`).join('')}</div>` : '';
    this.point = null;
    const chart = sp.price ? this.priceChart() : this.seriesChart();
    this.body.innerHTML = `<span class="grab" aria-hidden="true"></span>
      <div class="top"><div><div class="title">${esc(sp.title)}</div><div class="now">${this.nowHtml()}</div></div>
      <button type="button" class="x" data-s="close" aria-label="${w.close}"><i>${icon('close', 14, 'currentColor')}</i></button></div>
      ${ranges}${chart}<div class="acts"><button type="button" class="more" data-s="more">${w.more}</button>${sp.view ? `<button type="button" class="more" data-s="view">${w.systemPage}</button>` : ''}</div>`;
    this.el.setAttribute('aria-label', sp.title);
    this.wire();
  }
  // pointing at the chart shows that point's value and time in place of the value now
  wire() {
    const P = this.point, svg = this.body.querySelector('.chart svg');
    this.pointing = false;
    if (!P || !svg) return;
    const now = this.body.querySelector('.now'), sel = svg.querySelector('.sel');
    wirePoint(svg, P.pick, (j, f) => {
      this.pointing = j !== null;
      if (j === null) { sel.setAttribute('d', ''); now.innerHTML = this.nowHtml(); return; }
      const r = P.read(j, f);
      sel.setAttribute('d', `M${r.x.toFixed(1)} 0V${H}`);
      now.innerHTML = `<span class="v num">${esc(r.v)}</span><span class="u">${esc(r.u)}</span>`;
    });
  }
  stats(list) {
    return `<div class="stats">${list.map(([k, v]) => `<span><span class="k">${esc(k)}</span><span class="v num">${esc(v)}</span></span>`).join('')}</div>`;
  }
  priceChart() {
    const sp = this.spec, fc = this.card._hass.states[sp.price.forecast], L = this.card._lang, w = this.card._w;
    const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), sp.price.bands);
    if (!b) return `<div class="chart"><div class="msg">${w.noForecast}</div></div>`;
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
    const lab = b.bars.length > b.today ? [`${w.today} 00`, '12', `${w.tomorrow} 00`, '12', '24'] : ['00', '06', '12', '18', '24'];
    const f1 = v => formatNumber(v.toFixed(1), 1, L);
    this.point = {
      pick: f => Math.min(n - 1, Math.floor(f * n)),
      read: i => ({ x: (i + 0.5) * slot, v: f1(b.bars[i].t * 100), u: `${w.cents} · ${hourSpan(b.bars[i], L)}` })
    };
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${w.hourPrice(b.bars.length > b.today)}">
      <path d="M0 42.5H${W}M0 85H${W}M0 127.5H${W}" stroke="${pal.hair}" vector-effect="non-scaling-stroke"/>
      <path d="${paths.cheap}" fill="${pal.cheap}"/><path d="${paths.mid}" fill="${pal.midBar}"/><path d="${paths.high}" fill="${pal.highBar}"/>${SEL(pal.text)}</svg>${dot}</div>
      <div class="axis" aria-hidden="true">${lab.map(l => `<span>${l}</span>`).join('')}</div>
      ${this.stats([[w.cheapest, f1(Math.min(...ts))], [w.mean, f1(mean)], [w.dearest, f1(Math.max(...ts))]])}`;
  }
  blank(msg) {
    return `<div class="chart"><div class="msg">${msg}</div></div><div class="axis"><span>&nbsp;</span></div>${this.stats([['', '–'], ['', '–'], ['', '–']])}`;
  }
  // a days sheet: bars or a line in equal slots of HA's days or months, the slots out of the
  // numbers lighter (ADR-013)
  slotChart() {
    const sp = this.spec, { series, range, now } = this.data, L = this.card._lang, w = this.card._w;
    const { pts, stats, period, tz } = series;
    if (!stats) return this.blank(w.noData);
    const n = pts.length, slot = W / n, bars = sp.type === 'change', month = period === 'month';
    const color = a3Color(sp.color)[0], pal = a3Palette(this.card._hass.themes && this.card._hass.themes.darkMode);
    const vals = pts.filter(p => p.v !== null).map(p => p.v);
    let lo = 0, hi = Math.max(...vals) || 1;
    if (!bars) { const a = Math.min(...vals), pad = (hi - a) * 0.08 || 0.5; lo = a - pad; hi += pad; }
    const y = v => H - 12 - ((v - lo) / ((hi - lo) || 1)) * (H - 26), x = i => (i + 0.5) * slot, f = v => v.toFixed(1);
    const d = { in: '', out: '' };
    pts.forEach((p, i) => {
      if (p.v === null) return;
      if (bars) {
        const bw = slot * 0.72, bh = Math.max(1, H - 12 - y(p.v));
        d[p.out ? 'out' : 'in'] += barRect(i * slot + (slot - bw) / 2, H - 12 - bh, bw, bh);
        return;
      }
      // a line from the slot before, or a dot where it stands alone
      const q = pts[i - 1], r = pts[i + 1];
      if (q && q.v !== null) d[p.out || q.out ? 'out' : 'in'] += `M${f(x(i - 1))} ${f(y(q.v))}L${f(x(i))} ${f(y(p.v))}`;
      else if (!r || r.v === null) d[p.out ? 'out' : 'in'] += `M${f(x(i))} ${f(y(p.v))}h0.01`;
    });
    const draw = (k, op) => {
      const o = op < 1 ? ` ${bars ? 'fill' : 'stroke'}-opacity="${op}"` : '';
      return bars ? `<path d="${d[k]}" fill="${color}"${o}/>` : `<path d="${d[k]}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"${o}/>`;
    };
    const fmt = v => fmtN(v, sp.decimals, L), u = v => withUnit(fmt(v), sp.unit);
    const note = { open: month ? w.monthNotOver : w.dayNotOver, partial: month ? w.partialMonth : w.partialDay, late: w.late };
    this.point = {
      pick: q => Math.min(n - 1, Math.floor(q * n)),
      read: i => ({ x: x(i), v: pts[i].v === null ? '–' : fmt(pts[i].v), u: [sp.unit, whenLabel(pts[i].t, range, true, now, L, tz), note[pts[i].out]].filter(Boolean).join(' · ') })
    };
    const grid = `<path d="M0 42.5H${W}M0 85H${W}M0 127.5H${W}" stroke="${pal.hair}" vector-effect="non-scaling-stroke"/>`;
    // a label at the slot under each quarter of the width: months are not equally long
    const label = axisLabel(range, L, tz), marks = [0, 1, 2, 3].map(q => label(pts[Math.round((q * n) / 4)].t)).concat(w.now);
    const axis = `<div class="axis" aria-hidden="true">${marks.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    const list = bars
      ? [[w.total, u(stats.total)], [month ? w.smallestMonth : w.smallestDay, u(stats.small.v)], [month ? w.largestMonth : w.peakDay, u(stats.big.v)]]
      : [[w.lowest, u(stats.small.v)], [w.highest, u(stats.big.v)], [w.last, u(stats.last.v)]];
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(w.history(sp.title))}">${grid}${draw('in', 1)}${draw('out', 0.4)}${SEL(pal.text)}</svg></div>${axis}${this.stats(list)}`;
  }
  seriesChart() {
    const sp = this.spec, d = this.data, L = this.card._lang, w = this.card._w;
    if (!d || d.loading) return this.blank(w.loading);
    const { series, range, now } = d;
    if (series.kind === 'error') return this.blank(w.historyFailed);
    if (series.kind === 'slots') return this.slotChart();
    const t0 = now - RANGES[range].ms, t1 = now;
    const color = a3Color(sp.color)[0];
    const pal = a3Palette(this.card._hass.themes && this.card._hass.themes.darkMode);
    const grid = `<path d="M0 42.5H${W}M0 85H${W}M0 127.5H${W}" stroke="${pal.hair}" vector-effect="non-scaling-stroke"/>`;
    const axis = `<div class="axis" aria-hidden="true">${axisLabels(range, t0, t1, L).map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    const svg = inner => `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(w.history(sp.title))}">${grid}${inner}${SEL(pal.text)}</svg></div>${axis}`;
    const fmt = v => formatNumber(v.toFixed(sp.decimals ?? 1), sp.decimals ?? 1, L);
    const unit = sp.unit ? (sp.unit === '°C' ? '°' : ` ${sp.unit}`) : '';
    // a bar is read at its middle, a line at its point
    if (series.kind !== 'step') {
      const pts = series.points.filter(p => p.t >= t0 || series.kind === 'line'), bars = series.kind === 'bars';
      const half = bars ? (t1 - t0) / series.points.length / 2 : 0;
      const xOf = t => ((Math.min(Math.max(t + half, t0), t1) - t0) / (t1 - t0)) * W;
      this.point = {
        pick: f => nearest(pts, t0 + f * (t1 - t0) - half, !!series.stepped),
        // a stepped line holds its value: it is read at the pointer, not where it last changed
        read: (i, f) => {
          const t = series.stepped ? t0 + f * (t1 - t0) : pts[i].t;
          return { x: series.stepped ? f * W : xOf(t), v: sp.unit === '°C' ? `${fmt(pts[i].v)}°` : fmt(pts[i].v), u: [sp.unit === '°C' ? '' : sp.unit, whenLabel(t, range, bars, now, L)].filter(Boolean).join(' · ') };
        }
      };
    }
    if (series.kind === 'step') {
      const p = chartPaths(series, { t0, t1, lo: 0, hi: 1 });
      const s = stepStats(series, t0, now);
      const hrs = s.hours < 10 ? formatNumber(s.hours.toFixed(1), 1, L) : String(Math.round(s.hours));
      return `${svg(`<path d="${p.bands}" fill="${color}" fill-opacity="0.55"/>`)}${this.stats([[w.stateNow, sp.text ? sp.text(this.card._hass.states) : stateWord(this.card._hass.states[sp.entity], L)], [w.times, String(s.times)], [w.total, `${hrs} h`]])}`;
    }
    if (series.kind === 'bars') {
      const s = barStats(series);
      if (!s) return this.blank(w.noData);
      const p = chartPaths(series, { t0, t1, lo: 0, hi: s.peak || 1 });
      const per = RANGES[range].energy === 'hour' ? w.peakHour : w.peakDay;
      const middle = s.cost === null || s.cost === undefined ? [w.mean, `${fmt(s.total / series.points.length)}${unit}`] : [w.cost, `${formatNumber(s.cost.toFixed(2), 2, L)} €`];
      return `${svg(`<path d="${p.bars}" fill="${color}"/>`)}${this.stats([[w.total, `${fmt(s.total)}${unit}`], middle, [per, `${fmt(s.peak)}${unit}`]])}`;
    }
    const s = series.kind === 'line' && lineStats(series, t0, now);
    if (!s) return this.blank(w.noData);
    const pad = (s.hi - s.lo) * 0.08 || 0.5;
    const p = chartPaths(series, { t0, t1, lo: s.lo - pad, hi: s.hi + pad });
    return `${svg(`<path d="${p.area}" fill="${color}" fill-opacity="0.16"/><path d="${p.line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`)}${this.stats([[w.lowest, `${fmt(s.lo)}${unit}`], [w.mean, `${fmt(s.mean)}${unit}`], [w.highest, `${fmt(s.hi)}${unit}`]])}`;
  }
}

/* ---------- A3: the sheet spec of a tile, and the tile's parts ---------- */

// a tile's name: the config's, the entity's friendly name, or its id
const tileName = (conf, st) => conf.name || ((st || {}).attributes || {}).friendly_name || conf.entity;

// what a tap on a tile with `history` opens: the tile's value now, the history entity's series
export function tileSheet(conf, states, lang = 'et') {
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
  if (h.source === 'history' && !h.numeric) spec.text = now => tileState(conf, now, lang).text;
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

// the page's title, the outdoor temperature with its sheet, then people, alarms and live faults;
// `part` 'title' or 'chips' draws one of the two, for a layout that puts the hero between them
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
.status{display:flex;align-items:center;gap:7px;margin-top:-6px;padding:0 4px;font-size:15px;font-weight:600;color:var(--sub)}
.status i{flex:none;width:8px;height:8px;border-radius:4px;background:var(--sub);opacity:.6}
.status.ok i{background:var(--cheap);opacity:1}
.status.bad{color:var(--high)}
.status.bad i{background:var(--highBar);opacity:1}
/* a heading card's 14 + 44 px, so the title's baseline meets the section headings' beside it */
.title{padding:0}
.title .head{margin-top:14px;height:44px}
`;
  _watched() {
    const c = this._config;
    return [...(c.people || []), ...(c.alarms || []), ...(c.faults || []), ...(c.notes || []), ...(c.status ? [c.status] : [])].map(x => x.entity).concat(c.outdoor ? [c.outdoor.entity] : []);
  }
  _html(states) {
    const c = this._config, w = this._w, L = this._lang;
    this._actions = new Map();
    this._sheets = new Map();
    const chip = (key, entity, cls, ic, name, word) => {
      this._actions.set(key, actionDetail(entity, { action: 'more-info' }));
      return `<button type="button" class="glass press chip ${cls}" data-k="${esc(key)}"><i>${icon(ic, 14, 'currentColor')}</i><span><b>${esc(name)}</b>${word ? ` ${esc(word)}` : ''}</span></button>`;
    };
    const list = [
      ...faultsOn(states, c.faults).map(f => chip(`f:${f.entity}`, f.entity, 'bad', 'alert', f.name, '')),
      // a state worth knowing that is not a fault, while it is on
      ...(c.notes || []).filter(n => stateOf(states, n.entity) === 'on').map(n => chip(`n:${n.entity}`, n.entity, '', n.icon || 'alert', n.name, '')),
      ...(c.people || []).map(p => { const s = stateOf(states, p.entity); return chip(`p:${p.entity}`, p.entity, s === 'home' ? 'ok' : '', 'person', p.name, s === 'home' ? w.home : hasValue(states[p.entity]) ? w.away : w.notKnown); }),
      ...(c.alarms || []).map(a => {
        const st = states[a.entity], s = (st || {}).state || '';
        const cls = ['triggered', 'pending'].includes(s) ? 'bad' : s.startsWith('armed_') ? 'ok' : '';
        return chip(`a:${a.entity}`, a.entity, cls, s.startsWith('armed_') ? 'shield-check' : 'shield', a.name, stateWord(st, L));
      })
    ];
    let out = '';
    if (c.outdoor) {
      const st = states[c.outdoor.entity];
      const v = hasValue(st) && formatNumber(st.state, c.outdoor.decimals ?? 1, L);
      this._sheets.set('out', { title: c.outdoor.name || w.outdoors, entity: c.outdoor.entity, more: c.outdoor.entity, decimals: c.outdoor.decimals ?? 1, unit: '°C', color: 'teal', history: { entity: c.outdoor.entity, ...c.outdoor.history } });
      if (v) out = `<button type="button" class="out" data-k="out">${esc(w.outside(v))}</button>`;
    }
    const line = statusLine(states, c, L);
    const status = line ? `<span class="status ${line.tone}"><i></i>${esc(line.text)}</span>` : '';
    const head = `<div class="head"><h1>${esc(c.title || w.homeTitle)}</h1>${out}</div>${status}`, row = list.length ? `<div class="row">${list.join('')}</div>` : '';
    const body = { title: head, chips: row }[c.part] ?? head + row;
    return `<div class="wrap${c.part === 'title' ? ' title' : ''}">${body}</div>`;
  }
}

// system health as dots: green while fine, red when not, orange for pending updates
export function statusItems(states, conf, lang = 'et') {
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
    const value = it.value && hasValue(st) ? ` ${stateWord(st, lang)}` : '';
    return { entity: it.entity, text: `${it.name}${value}`, tone: good ? 'ok' : 'bad' };
  });
  const pending = (conf.updates || []).filter(u => stateOf(states, u.entity) === 'on');
  if (pending.length) out.push({ entity: pending[0].entity, text: words(lang).update(joinEt(pending.map(u => u.name), lang)), tone: 'mid' });
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
    const dots = statusItems(states, c, this._lang).map((d, i) => {
      this._actions.set(`d${i}`, actionDetail(d.entity, { action: 'more-info' }));
      return `<button type="button" class="d ${d.tone}" data-k="d${i}"><i></i>${esc(d.text)}</button>`;
    }).join('');
    const title = `${esc(c.title || this._w.system)}${link ? icon('chevron', 16, 'currentColor') : ''}`;
    return `<div class="glass box">${link ? `<button type="button" class="t" data-k="t">${title}</button>` : `<span class="t">${title}</span>`}<div class="dots">${dots}</div></div>`;
  }
}

// a progress track, the month card's and the reading card's meter
const TRACK_CSS = `
.track{position:relative;display:block;height:8px;border-radius:4px;background:var(--track);overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
`;

const PRICE_A3_CSS = `
.stack{display:flex;flex-direction:column;gap:10px}
.main{display:flex;flex-direction:column;gap:12px;width:100%;padding:16px 16px 14px;border-radius:24px}
.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.hd .l{display:flex;flex-direction:column;gap:2px}
.hd.pointing .sub,.hd.pointing .badge{visibility:hidden}
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
  const c = card._config, L = card._lang, w = card._w;
  const level = states[c.level], fc = states[c.forecast];
  card._actions = new Map();
  card._sheets = new Map([['price', { title: w.priceTitle, entity: c.level, more: c.level, price: { forecast: c.forecast, bands: c.bands } }]]);
  const a = level && hasValue(level) ? level.attributes || {} : null;
  const arvel = a && formatNumber(a.arvel, 1, L), senti = a && formatNumber(a.senti, 1, L);
  const sub = a ? [a.hinnang, senti && w.exchange(senti)].filter(Boolean).join(', ') : '';
  const badge = a ? `<span class="badge ${levelTone(level.state, L)}">${esc(cap(level.state))}</span>` : '';
  const top = `<span class="hd"><span class="l"><span class="lab">${w.stateNow}</span>${arvel ? `<span class="big"><span class="n num">${arvel}</span><span class="u">${w.cents}</span></span>` : `<span class="big"><span class="u">${w.priceUnknown}</span></span>`}${sub ? `<span class="sub">${esc(cap(sub))}</span>` : ''}</span>${badge}</span>`;
  const b = priceBars(fc && fc.attributes && fc.attributes.prices, new Date(), c.bands);
  card._point = null;
  let chart = `<span class="empty">${w.noForecast}</span>`;
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
    card._point = arvel && { bars: b.bars, slot, bw };
    const marks = [`<span style="left:0">${w.today}</span>`];
    if (b.current >= 0 && b.current > 2 && (n <= b.today || b.current < b.today - 4)) marks.push(`<span style="left:${pct(b.current)};transform:translateX(-50%)">${w.now}</span>`);
    if (n > b.today) marks.push(`<span style="left:${pct(b.today)}">${w.tomorrow}</span>`);
    chart = `<span class="ch"><svg class="bars" viewBox="0 0 336 64" preserveAspectRatio="none" aria-hidden="true"><rect class="sel" y="0" width="${(bw + 2).toFixed(1)}" height="64" rx="2" fill="${pal.text}" fill-opacity="0.12" visibility="hidden"/>${fill(past, 0.35)}${fill(paths)}${now ? `<path d="${now}" fill="none" stroke="${pal.text}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ''}</svg><span class="ax" aria-hidden="true">${marks.join('')}</span></span>`;
  }
  const line = (ic, name, text) => `<span class="ln">${icon(ic, 20, pal.sub)}<span>${name ? `<b>${esc(name)}</b> ` : ''}${esc(text)}</span></span>`;
  const windows = (c.windows || []).map(w => [w.icon || 'bolt', w.name, ((states[w.entity] || {}).attributes || {}).tekst]).filter(([, , t]) => t);
  const tm = c.tomorrow && hasValue(states[c.tomorrow]) && (!c.tomorrow_flag || stateOf(states, c.tomorrow_flag) === 'on') && (states[c.tomorrow].attributes || {}).tekst;
  // the tomorrow line leads with its day word in bold
  const lead = sensorWords(L).lead, led = !!tm && tm.startsWith(`${lead} `);
  const lines = [...windows.map(([i, n, t]) => line(i, n, t)), ...(tm ? [line('moon', led ? lead : '', led ? tm.slice(lead.length + 1) : tm)] : [])];
  const main = `<button type="button" class="glass press main" data-k="price" aria-label="${w.priceAria}">${top}${chart}${lines.length ? `<span class="hr"></span><span class="lines">${lines.join('')}</span>` : ''}</button>`;
  let use = '';
  if ((c.usage || []).length) {
    const cells = c.usage.map(u => {
      const st = states[u.entity];
      const n = hasValue(st) && formatNumber(st.state, undefined, L);
      const kulu = hasValue(st) && (st.attributes || {}).kulu;
      return `<span><span class="lab">${esc(u.name)}</span><span class="v num">${n ? `${n} <small>${esc((st.attributes || {}).unit_of_measurement || '')}</small>` : '–'}</span><span class="sub">${esc(kulu || '')}</span></span>`;
    }).join('');
    const h = c.usage_history;
    if (h) card._sheets.set('use', usageSheet(c.usage[0].entity, h, L));
    use = h ? `<button type="button" class="glass press use" data-k="use" aria-label="${w.useAria}">${cells}</button>` : `<div class="glass use">${cells}</div>`;
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
.chev{flex:none;display:flex;color:var(--sub);pointer-events:none}
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
  const c = card._config, L = card._lang, w = card._w;
  const st = states[c.entity];
  const ts = tileState(c, states, L);
  const name = tileName(c, st);
  const sheet = tileSheet(c, states, L);
  card._actions = new Map();
  card._sheets = new Map(sheet ? [['body', sheet]] : []);
  if (!sheet) card._actions.set('body', tileAction(c, 'tap'));
  const [disc, fg] = a3Color(c.color);
  const lit = ts.lit;
  const ic = icon((lit && c.icon_on) || c.icon, 22, 'currentColor');
  if (c.layout === 'value') {
    const label = Array.isArray(c.label) ? c.label.map(p => part(p, st, states, L)).filter(Boolean).join(' · ') : name;
    const { value, unit } = splitValue(st, c.decimals, L);
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
    below = `<span class="sl" data-sl role="slider" tabindex="0" aria-label="${esc(w.brightness(name))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct ? `${pct} %` : w.words.off}"><i style="width:${pct}%"></i></span>`;
  }
  if (c.modes) {
    const current = stateOf(states, c.entity);
    below = `<span class="seg" role="group" aria-label="${esc(w.mode(name))}">${c.modes.map((m, i) => {
      card._actions.set(`m${i}`, modeAction(c.entity, m, current));
      return `<button type="button" class="press" data-k="m${i}" aria-pressed="${m.option === current}">${esc(m.name)}</button>`;
    }).join('')}</span>`;
  }
  const chev = c.chevron ? `<span class="chev" aria-hidden="true">${icon('chevron', 14, 'currentColor')}</span>` : '';
  if (c.wide) return `<div class="${cls}"><span class="row">${discEl}${body}${extra}${corner}${chev}</span>${below}</div>`;
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

/* ---------- A3 Energia: time in HA's zone, daily statistics, the month and the split ---------- */

// a number from an attribute: HA's templates write Estonian ("116,34 €", "32,1 c/kWh"), a utility
// meter a plain one ("42.589"); null for "-", empty or missing
export function parseEt(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const m = /-?\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?/.exec(String(s ?? ''));
  return m ? Number(m[0].replace(/[ \u00a0]/g, '').replace(',', '.')) : null;
}

// { y, m, d, h, min, s } of a moment in a time zone
const ZONE_FMT = new Map();
export function zoneParts(t, tz) {
  let f = ZONE_FMT.get(tz);
  if (!f) ZONE_FMT.set(tz, (f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })));
  const p = Object.fromEntries(f.formatToParts(new Date(t)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}
const zoneOffset = (t, tz) => { const p = zoneParts(t, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000; };

// the moment a calendar day starts in a time zone; d and m may run over (d 0 is the last of the
// month before), as Date.UTC allows
export function dayStart(y, m, d, tz) {
  const guess = Date.UTC(y, m - 1, d);
  const t = guess - zoneOffset(guess, tz);
  return guess - zoneOffset(t, tz);
}

// [start, end) of the month a moment is in, in a time zone
export function monthSpan(t, tz) {
  const p = zoneParts(t, tz);
  return [dayStart(p.y, p.m, 1, tz), dayStart(p.y, p.m + 1, 1, tz)];
}

// the starts of the last `days` days to today, oldest first
export function dayStarts(days, now, tz) {
  const p = zoneParts(now, tz);
  return Array.from({ length: days }, (_, i) => dayStart(p.y, p.m, p.d - (days - 1) + i, tz));
}

// the WebSocket message for daily statistics of the last `days` days in HA's time zone
export function dailyRequest(ids, types, days, now, tz) {
  return { type: 'recorder/statistics_during_period', start_time: new Date(dayStarts(days, now, tz)[0]).toISOString(), statistic_ids: ids, period: 'day', types };
}

// the last `hours` whole hours of a statistic by the hour, by default an energy counter's last two
// days for the data cutoff (from a whole hour, so one hour's requests are the same message and can
// be shared)
export const hourlyRequest = (id, now, hours = 48, types = ['change']) => ({ type: 'recorder/statistics_during_period', start_time: new Date(Math.floor(now / HOUR) * HOUR - hours * HOUR).toISOString(), statistic_ids: [id], period: 'hour', types });

// where a delayed counter's data ends: the end of its last hour with a value, or null
export function dataCutoff(resp, id) {
  const rows = ((resp || {})[id] || []).filter(r => num(r.change) !== null);
  return rows.length ? rows[rows.length - 1].start + HOUR : null;
}

// one point per day, oldest first: { t, label, v, max, late }; a day the response lacks is null, a
// day that had not ended by a delayed counter's cutoff is late
export function dailySeries(resp, id, type, days, now, tz, cutoff = Infinity, lang = 'et') {
  const key = t => { const p = zoneParts(t, tz); return `${p.y}-${p.m}-${p.d}`; };
  const rows = new Map(((resp || {})[id] || []).map(r => [key(r.start), r]));
  const starts = dayStarts(days, now, tz);
  return starts.map((t, i) => {
    const r = rows.get(key(t)), p = zoneParts(t, tz);
    return { t, label: words(lang).dayMonth(p.d, p.m), v: r ? num(r[type]) : null, max: r ? num(r.max) : null, late: (i + 1 < days ? starts[i + 1] : Infinity) > cutoff };
  });
}

// { avg, big, small, peak } over the days with a value that are not late; big and small are those
// days, peak is { v, label } of the dearest max; null when no day counts
export function dayStats(points) {
  const full = points.filter(p => p.v !== null && !p.late);
  if (!full.length) return null;
  const pick = better => full.reduce((a, p) => (better(p.v, a.v) ? p : a));
  const withMax = full.filter(p => p.max !== null);
  const peak = withMax.length ? withMax.reduce((a, p) => (p.max > a.max ? p : a)) : null;
  return {
    avg: full.reduce((a, p) => a + p.v, 0) / full.length,
    big: pick((a, b) => a > b), small: pick((a, b) => a < b),
    peak: peak && { v: peak.max, label: peak.label }
  };
}

// The days sheet's ranges (ADR-013): slots of HA's calendar days or months, the last one now
export const DAYS_RANGES = { '30d': { days: 30 }, '90d': { days: 90 }, '12m': { months: 12 } };

// { period, starts, end } of a days sheet's range in HA's zone: the slots' starts, oldest first,
// and the end of the last one
export function daysRange(range, now, tz) {
  const r = DAYS_RANGES[range] || DAYS_RANGES['30d'], p = zoneParts(now, tz);
  if (!r.months) return { period: 'day', starts: dayStarts(r.days, now, tz), end: dayStart(p.y, p.m, p.d + 1, tz) };
  const at = i => dayStart(p.y, p.m - r.months + 1 + i, 1, tz);
  return { period: 'month', starts: Array.from({ length: r.months }, (_, i) => at(i)), end: at(r.months) };
}

// the WebSocket message for a days sheet (daysSheet's spec) over a range
export function daysSheetRequest(spec, range, now, tz) {
  const r = daysRange(range, now, tz);
  return { type: 'recorder/statistics_during_period', start_time: new Date(r.starts[0]).toISOString(), statistic_ids: [spec.statistic], period: r.period, types: [spec.type] };
}

// a days sheet's slots, { period, end, pts, stats }: pts are { t, v, out } with v scaled, null
// without data; out says why a slot is kept out of the numbers: 'open' for the last, unfinished
// one, 'partial' for the first day or month with data after the window's start (a statistic
// begins mid-period), 'late' past a delayed
// counter's cutoff. stats over the counted slots, { avg, total, small, big, last } with the
// last three slots, or null when none counts.
export function slotSeries(resp, spec, range, now, tz, cutoff = Infinity) {
  const { period, starts, end } = daysRange(range, now, tz);
  const key = t => { const p = zoneParts(t, tz); return period === 'month' ? `${p.y}-${p.m}` : `${p.y}-${p.m}-${p.d}`; };
  const rows = new Map(((resp || {})[spec.statistic] || []).map(r => [key(r.start), r]));
  const scale = spec.scale || 1;
  const pts = starts.map((t, i) => {
    const r = rows.get(key(t)), v = r ? num(r[spec.type]) : null, e = i + 1 < starts.length ? starts[i + 1] : end;
    return { t, v: v === null ? null : v * scale, out: i === starts.length - 1 ? 'open' : e > cutoff ? 'late' : false };
  });
  const first = pts.findIndex(p => p.v !== null);
  if (first > 0 && !pts[first].out) pts[first].out = 'partial';
  const counted = pts.filter(p => p.v !== null && !p.out);
  if (!counted.length) return { period, end, pts, stats: null };
  const total = counted.reduce((a, p) => a + p.v, 0);
  const pick = better => counted.reduce((a, p) => (better(p.v, a.v) ? p : a));
  return { period, end, pts, stats: { avg: total / counted.length, total, small: pick((a, b) => a < b), big: pick((a, b) => a > b), last: counted[counted.length - 1] } };
}

const earlyInMonth = (now, tz) => zoneParts(now, tz).d <= 2;

// the month's cost at its pace: cost over the elapsed share of the month up to the data cutoff;
// null on the first two days, before any data, or without a cost
export function monthPace(cost, cutoff, now, tz) {
  if (cost === null || cost === undefined || earlyInMonth(now, tz)) return null;
  const [a, b] = monthSpan(now, tz);
  const frac = (Math.min(cutoff ?? now, now) - a) / (b - a);
  return frac > 0 ? cost / frac : null;
}

// "in <month>" of last month, by the month's number (1-12)
export const inLastMonth = (now, tz, lang = 'et') => words(lang).inMonth[(zoneParts(now, tz).m + 10) % 12];
// 'kolmapäev 11.11' ('Wednesday 11/11') for a day's start in HA's zone
export function dayName(t, tz, lang = 'et') {
  const p = zoneParts(t, tz), w = words(lang);
  return `${w.weekdays[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]} ${w.dayMonth(p.d, p.m)}`;
}

const hh = n => String(n).padStart(2, '0');
// an hour's price bar as the house says it: 'täna 18–19', 'homme 03–04'
export const hourSpan = (bar, lang = 'et') => { const h = new Date(bar.s).getHours(), w = words(lang); return `${bar.tomorrow ? w.tomorrow : w.today} ${hh(h)}–${hh((h + 1) % 24)}`; };
// when a pointed history point was, in the browser's zone like the axis or in tz: an hour's bar or
// a moment in the 24 h range, the hour in the week, the day in 30 or 90 days or a day's bar, the
// month in 12 months
export function whenLabel(t, range, bars, now = Date.now(), lang = 'et', tz = localZone()) {
  const w = words(lang);
  if (range === '12m') return new Intl.DateTimeFormat(w.locale, { month: 'long', year: 'numeric', timeZone: tz }).format(new Date(t));
  const p = zoneParts(t, tz), day = dayName(t, tz, lang);
  if (range === '24h') {
    const at = bars ? `${hh(p.h)}–${hh((p.h + 1) % 24)}` : `${hh(p.h)}:${hh(p.min)}`;
    return `${dayWord(t, now, lang, tz) ?? day} ${at}`;
  }
  return range === '7d' && !bars ? `${day} ${w.at(hh(p.h))}` : day;
}
let LOCAL_ZONE;
const localZone = () => (LOCAL_ZONE ??= Intl.DateTimeFormat().resolvedOptions().timeZone);
// 'täna' or 'eile' for a moment in a zone, null for an earlier day
function dayWord(t, now, lang, tz) {
  const date = x => { const p = zoneParts(x, tz); return Date.UTC(p.y, p.m - 1, p.d); };
  const k = Math.round((date(now) - date(t)) / (24 * HOUR)), w = words(lang);
  return k === 0 ? w.today : k === 1 ? w.yesterday : null;
}
// the index of the point with a value nearest to t, null when none has one; on a stepped line the
// value held at t, the last point at or before it (null before the first)
export function nearest(points, t, stepped = false) {
  if (stepped) {
    let i = -1;
    while (i + 1 < points.length && points[i + 1].t <= t) i++;
    return i >= 0 && points[i].v !== null ? i : null;
  }
  let best = null;
  points.forEach((p, i) => { if (p.v !== null && (best === null || Math.abs(p.t - t) < Math.abs(points[best].t - t))) best = i; });
  return best;
}

// last month's name, Estonian ("oktoober") and as Daikin's month attributes name it ("October")
export function lastMonthName(now, tz, locale = 'et-EE') {
  const p = zoneParts(now, tz);
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: tz }).format(new Date(dayStart(p.y, p.m - 1, 15, tz)));
}

// Last month's value from a sensor's attributes: a utility meter's own one (`last_period`), or
// 'month', Daikin's month attributes, which name this year's months and the previous year's as
// `Last <Month>` (last month in January is `Last December`). null on the first two days of a
// month, when it may still be the one before, and for "-" or a missing value.
export function lastMonthValue(st, key, now, tz) {
  if (!key || !st || earlyInMonth(now, tz)) return null;
  const a = st.attributes || {};
  if (key !== 'month') return parseEt(a[key]);
  const en = lastMonthName(now, tz, 'en-US');
  return parseEt(a[zoneParts(now, tz).m === 1 ? `Last ${en}` : en]);
}

// the split card's rows: each part's kWh this month, its share and last month's, and the rest of
// the house. Shares are of the larger of the total and the parts, so a delayed total cannot push
// them past 100; last month is left out on the first two days, when it may still be the one before.
export function splitRows(states, conf, now, tz, lang = 'et') {
  const v = e => (hasValue(states[e]) ? num(states[e].state) : null);
  const last = (p, st) => lastMonthValue(st, p.last, now, tz);
  const parts = (conf.parts || []).map(p => ({ ...p, kwh: v(p.entity), last: last(p, states[p.entity]) }))
    .filter(p => p.kwh !== null && !(p.hide_zero && p.kwh <= 0));
  const total = v(conf.total), sum = parts.reduce((a, p) => a + p.kwh, 0);
  const rest = total === null ? null : Math.max(0, total - sum);
  const denom = Math.max(total ?? 0, sum) || 1;
  const rows = parts.map(p => ({ ...p, share: Math.round((p.kwh / denom) * 100) }));
  if (rest !== null) rows.push({ name: (conf.rest || {}).name || words(lang).rest, icon: 'home', color: 'gray', kwh: rest, share: Math.round((rest / denom) * 100), last: null, rest: true });
  return { rows, stale: !!conf.fresh && stateOf(states, conf.fresh) === 'off' };
}

// A3's usage sheet: an energy entity's value now, its consumption and cost by hour and by day
export function usageSheet(entity, history, lang = 'et') {
  return { title: words(lang).use, entity, more: entity, decimals: 1, unit: 'kWh', color: 'indigo', history };
}

/* ---------- A3 Soojuspump (ADR-011): hourly lines, the shift stepper, the boiler's cells ---------- */

// the WebSocket message for the hourly means of the last `hours` whole hours
export const lineRequest = (id, hours, now) => hourlyRequest(id, now, hours, ['mean']);

// the hourly means as a line that ends at the live value, so its last point agrees with the big
// number while the hour's statistics are not compiled yet
export function lineSeries(resp, id, live, now) {
  const { points } = seriesFrom(resp, { entity: id, source: 'statistics', type: 'mean' });
  if (live != null) points.push({ t: now, v: live, live: true });
  return { kind: 'line', points };
}

// { lo, hi } a line is drawn between: its lineStats and a floor, padded; null without a value
export function lineRange(stats, floor) {
  if (!stats) return null;
  const lo = floor == null ? stats.lo : Math.min(stats.lo, floor), hi = floor == null ? stats.hi : Math.max(stats.hi, floor);
  const pad = (hi - lo) * 0.1 || 0.5;
  return { lo: lo - pad, hi: hi + pad };
}

// three labels under a line from t0 to now: its start, its middle and 'nüüd', each as the day
// ('täna', 'eile' or the weekday) and the hour in the browser's zone
export function lineAxis(t0, now, lang = 'et') {
  const w = words(lang);
  const at = t => { const d = new Date(t); return `${dayWord(t, now, lang) ?? w.weekdays[d.getDay()]} ${hh(d.getHours())}`; };
  return [at(t0), at((t0 + now) / 2), w.now];
}

// the shift as the stepper shows it and the line under its name
export const stepText = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`;
export const stepNote = (v, lang = 'et') => words(lang).curve(v);
// a number entity's value and its { min, max, step }
function stepState(st) {
  const a = (st || {}).attributes || {};
  return { cur: hasValue(st) ? num(st.state) : null, lim: { min: num(a.min) ?? -Infinity, max: num(a.max) ?? Infinity, step: num(a.step) || 1 } };
}
// the value one step up (dir 1) or down (-1) from v, within the entity's min, max and step
export function stepValue(v, dir, { min = -Infinity, max = Infinity, step = 1 } = {}) {
  const n = Math.round((v + dir * step) / step) * step;
  return Math.max(min, Math.min(max, Number(n.toFixed(6))));
}
// the write a settled stepper sends: none when the taps net to the value the entity has
export const stepWrite = (pending, current) => (pending === null || pending === current ? null : pending);

/* ---------- A3 Ventilatsioon: any unit, the meter, the overlay series and the ratio ---------- */

// a reading cell's history sheet, in the entity's own unit
export function cellSheet(x, states) {
  return { title: x.title || x.name, entity: x.entity, more: x.entity, decimals: x.scale ? 0 : x.decimals ?? 1, unit: unitOf(states[x.entity]), color: x.color, history: { entity: x.entity, ...x.history } };
}

// the reading card's cell row: two to a row, three side by side
export const cellsClass = n => (n > 2 ? 'cells c3' : 'cells');

// the reading card's meter: { name, value, pct, note }, the value's share of `max` (100 by
// default) held to 0-100, and no fill without a value
export function meterRow(states, m, lang = 'et') {
  const st = states[m.entity], v = hasValue(st) ? num(st.state) : null;
  return { name: m.name || '', value: valueText(st, m.decimals ?? 0, lang, { unit: m.unit }), pct: v === null ? 0 : Math.max(0, Math.min(100, (v / (m.max || 100)) * 100)), note: m.note || '' };
}

// what a tap on a days card's headline opens: the picked series over 30 days, 90 days and 12
// months (ADR-013), with the card's cutoff for a counter; `more` is a real entity, since an
// external statistic has no state
export function daysSheet(conf, i) {
  const s = conf.series[i];
  return {
    days: true, title: s.title || s.name, statistic: s.statistic, type: s.type, color: s.color, unit: s.unit || '',
    scale: s.scale || 1, decimals: s.decimals ?? 1, more: s.more, ...(s.type === 'change' && conf.cutoff ? { cutoff: conf.cutoff } : {})
  };
}
const dailyKey = types => `daily:${types.join(',')}`;
const seriesTypes = s => (s.peak ? [s.type, 'max'] : [s.type]);
// the days card's requests: one daily request per set of types holding every series' and
// overlay's statistic of those types, and the cutoff's hourly one
export function daysRequests(conf, now, tz) {
  const byType = new Map();
  const add = (types, id) => {
    const k = dailyKey(types);
    if (!byType.has(k)) byType.set(k, { types, ids: [] });
    if (!byType.get(k).ids.includes(id)) byType.get(k).ids.push(id);
  };
  for (const s of conf.series) {
    add(seriesTypes(s), s.statistic);
    if (s.overlay) add([s.overlay.type], s.overlay.statistic);
  }
  const reqs = Object.fromEntries([...byType].map(([k, r]) => [k, dailyRequest(r.ids, r.types, conf.days || 31, now, tz)]));
  return conf.cutoff ? { ...reqs, cutoff: hourlyRequest(conf.cutoff, now) } : reqs;
}

// the overlay's value of each day, as the primary points' `o`
export function withOverlay(pts, overlay) {
  const by = new Map(overlay.map(p => [p.t, p.v]));
  return pts.map(p => ({ ...p, o: by.get(p.t) ?? null }));
}
// the top of a days chart: its largest bar, dearest hour or overlay bar with headroom, 1 when all are 0
export const daysTop = (pts, peak) => Math.max(0, ...pts.map(p => Math.max(p.v ?? 0, peak ? p.max ?? 0 : 0, p.o ?? 0))) * 1.05 || 1;
// the primary sum over the overlay's on the complete days that have both; null unless the
// overlay's sum is above 0
export function dayRatio(pts) {
  const full = pts.filter(p => p.v !== null && p.o != null && !p.late);
  const a = full.reduce((x, p) => x + p.v, 0), b = full.reduce((x, p) => x + p.o, 0);
  return b > 0 ? a / b : null;
}
// the ratio headline: [the ratio, the series' caption for the side of 1 the shown number is on]
export function ratioHeadline(r, s, lang = 'et') {
  if (r === null) return ['–', ''];
  const d = r >= 10 ? 0 : 1, shown = Number(r.toFixed(d));
  return [words(lang).ratio(fmtN(r, d, lang)), (shown < 1 ? s.caption_below : s.caption) || ''];
}

// the days card's headline while pointing at day j: [its value, its unit, the overlay's value,
// the day and a note]; the headline itself (the average or the ratio) when j is null
export function dayPoint(P, j) {
  if (j === null) return P.avg;
  const p = P.pts[j], last = j === P.pts.length - 1, w = words(P.lang);
  const note = p.late ? (last && P.unfinished ? w.dayNotOver : last ? w.todayLate : w.late) : P.peak && p.max !== null ? w.dearestHourAt(P.fmt(p.max)) : '';
  const over = P.over && p.o !== null ? `${P.over.name} ${withUnit(P.over.fmt(p.o), P.over.unit)}` : '';
  return [p.v === null ? '–' : P.fmt(p.v), [P.unit, over, dayName(p.t, P.tz, P.lang), note].filter(Boolean).join(' · ')];
}

// the days card's own cells: [{ k, v, l, bad }], a sensor's value with its unit (or the cell's
// `unit` and `decimals`), its share of another (of the larger of the two, as splitRows does, so a
// delayed total cannot pass 100), last month's value by name, or `kind: 'avg'`, the series'
// average the card passes in `ctx`; a last-month cell is left out on the first two days of a
// month, a `note_last` note is empty then, and `bad` is set above `bad_above`
export function dayCells(states, cells, now, tz, lang = 'et', ctx = {}) {
  const out = [], w = words(lang);
  for (const c of cells || []) {
    if (c.kind === 'avg') { out.push({ k: c.name, v: ctx.avg ?? '–', l: c.note || '' }); continue; }
    const st = states[c.entity], unit = c.unit ?? unitOf(st);
    const show = v => (v === null ? '–' : `${formatNumber(String(v), c.decimals, lang)}${unit ? ` ${unit}` : ''}`);
    if (c.last) {
      if (earlyInMonth(now, tz)) continue;
      out.push({ k: c.name || cap(lastMonthName(now, tz, w.locale)), v: show(lastMonthValue(st, c.last, now, tz)), l: c.note || '' });
      continue;
    }
    const v = hasValue(st) ? num(st.state) : null;
    let l = c.note || '';
    if (c.share_of) {
      const t = states[c.share_of], total = hasValue(t) ? num(t.state) : null, denom = Math.max(total ?? 0, v ?? 0);
      l = v !== null && total !== null && denom > 0 ? w.ofHouse(Math.round((v / denom) * 100)) : '';
    }
    if (c.note_last) {
      const lv = lastMonthValue(st, c.note_last, now, tz);
      l = lv === null ? '' : w.inLastShort(inLastMonth(now, tz, lang), formatNumber(String(lv), c.decimals, lang));
    }
    const cell = { k: c.name, v: show(v), l };
    if (c.bad_above != null && v !== null && v > c.bad_above) cell.bad = true;
    out.push(cell);
  }
  return out;
}

// the chips card's status line: { tone, text }; ok only while `entity` is on and every fault reads off
export function statusLine(states, conf, lang = 'et') {
  const s = conf.status, w = words(lang);
  if (!s) return null;
  const faults = conf.faults || [];
  if (faultsOn(states, faults).length) return { tone: 'bad', text: s.bad || w.fault };
  const on = stateOf(states, s.entity);
  if (on === 'on' && faults.every(f => stateOf(states, f.entity) === (f.bad === 'off' ? 'on' : 'off'))) return { tone: 'ok', text: s.ok };
  if (on === 'off') return { tone: 'off', text: s.off || w.offState };
  return { tone: 'off', text: w.stateUnknown };
}

// one fetch per message and HA-zone hour, shared by the cards on a page (the month and days cards
// both ask for the data cutoff); a daily request is the same message all day, so the hour is part
// of the key. A failed fetch is forgotten so a later draw tries again.
const FETCHES = new Map();
function fetchShared(hass, msg, hour) {
  const key = `${hour}|${JSON.stringify(msg)}`;
  if (!FETCHES.has(key)) {
    const p = hass.callWS(msg);
    FETCHES.set(key, p);
    p.catch(() => FETCHES.delete(key));
    while (FETCHES.size > 24) FETCHES.delete(FETCHES.keys().next().value);
  }
  return FETCHES.get(key);
}

const tzOf = hass => (hass && hass.config && hass.config.time_zone) || localZone();
const hourKeyOf = (now, tz) => { const p = zoneParts(now, tz); return `${p.y}-${p.m}-${p.d}-${p.h}`; };
const fmtN = (v, d, lang) => formatNumber(v.toFixed(d), d, lang);

// a card that loads recorder data before it draws: the load runs when the HA-zone hour changes,
// a result redraws the card, a newer load wins; after an error the next try waits a minute.
// _requests() names its messages ({ cutoff: msg, ... }); the data has the responses by those names.
class LoadingCard extends KheCard {
  static a3only = true;
  _clock() { return this._hass ? hourKeyOf(Date.now(), tzOf(this._hass)) : 0; }
  _requests() { return {}; }
  // another config asks for other data
  setConfig(config) { this._loadedFor = null; this._data = null; super.setConfig(config); }
  _draw() { this._ensure(); super._draw(); }
  _ensure() {
    if (!this._hass || !this._config || !this.isConnected) return;
    const hour = this._clock(), now = Date.now();
    if (this._loadedFor === hour || now < (this._retryAt || 0)) return;
    this._loadedFor = hour;
    const tz = tzOf(this._hass), token = (this._token = {});
    const named = Object.entries(this._requests(now, tz));
    Promise.all(named.map(([, m]) => fetchShared(this._hass, m, hour)))
      .then(res => ({ res: Object.fromEntries(named.map(([k], i) => [k, res[i]])), now, tz }), () => ({ error: true }))
      .then(d => {
        if (this._token !== token) return;
        this._data = d;
        if (d.error) { this._loadedFor = null; this._retryAt = Date.now() + 60e3; }
        super._draw();
      });
  }
  connectedCallback() { this._draw(); }
}

// the price card's look (.main, .hd, .lab, .big, .badge, .hr), and the month's own parts
const MONTH_CSS = `${PRICE_A3_CSS}${TRACK_CSS}
.head{display:flex;flex-direction:column;gap:4px;padding:4px 4px 2px}
h1{margin:0;font-size:34px;line-height:1.05;font-weight:700;letter-spacing:-0.022em}
.date{font-size:15px;font-weight:600;color:var(--sub)}
.wrap{display:flex;flex-direction:column;gap:12px}
.main{padding:16px}
.big .u{font-size:17px}
.prog{display:flex;flex-direction:column;gap:6px}
.track i{background:#5e5ce6}
.pl{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:var(--sub)}
.cells{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cells > span{display:flex;flex-direction:column;gap:1px;min-width:0}
.cells .v{font-size:20px;font-weight:700;letter-spacing:-0.02em}
.cells .v small{font-size:13px;font-weight:600;color:var(--sub)}
.foot{font-size:12px;color:var(--sub)}
`;

// Energia's top: the title and date, the month's cost and pace, today, yesterday and last month
class MonthCard extends LoadingCard {
  static css = MONTH_CSS;
  _check(c) { if (!c.month) throw new Error('khe-month-card: month is required'); }
  _watched() { const c = this._config; return [c.month, c.last_month, c.today, c.yesterday].filter(Boolean); }
  _requests(now) { return this._config.consumption ? { cutoff: hourlyRequest(this._config.consumption, now) } : {}; }
  _html(states) {
    const c = this._config, now = Date.now(), tz = tzOf(this._hass), p = zoneParts(now, tz), w = this._w, L = this._lang;
    const d = this._data && !this._data.error ? this._data : null;
    const cutoff = d && d.res.cutoff ? dataCutoff(d.res.cutoff, c.consumption) : null;
    const st = states[c.month], a = hasValue(st) ? st.attributes || {} : {};
    const cost = parseEt(a.kulu), price = parseEt(a.hind), kwh = hasValue(st) ? formatNumber(st.state, 0, L) : null;
    const lm = states[c.last_month], la = hasValue(lm) ? lm.attributes || {} : {};
    const lastName = lastMonthName(now, tz, w.locale), early = earlyInMonth(now, tz), lastPrice = early ? null : parseEt(la.hind);
    let badge = '';
    if (price !== null && lastPrice) {
      const r = price / lastPrice;
      const tone = r > 1.03 ? 'high' : r < 0.97 ? 'good' : 'mid';
      badge = `<span class="badge ${tone}">${esc(w.compare[tone](lastName))}</span>`;
    }
    const [m0, m1] = monthSpan(now, tz), days = Math.round((m1 - m0) / (24 * HOUR));
    const pace = monthPace(cost, cutoff, now, tz);
    const monthName = cap(new Intl.DateTimeFormat(w.locale, { month: 'long', timeZone: tz }).format(new Date(now)));
    this._sheets = new Map(c.usage_history ? [['m', usageSheet(c.month, c.usage_history, L)]] : []);
    this._actions = new Map();
    const cell = (name, e, dec, show = true) => {
      const s = states[e], ok = show && hasValue(s);
      return `<span><span class="lab">${esc(name)}</span><span class="v num">${ok ? `${formatNumber(s.state, dec, L)} <small>kWh</small>` : '–'}</span><span class="sub">${ok ? esc((s.attributes || {}).kulu || '') : ''}</span></span>`;
    };
    const top = `<span class="hd"><span class="l"><span class="lab">${w.thisMonth}</span>${cost !== null ? `<span class="big"><span class="n num">${fmtN(cost, 2, L)}</span><span class="u">€</span></span>` : `<span class="big"><span class="u">${w.costUnknown}</span></span>`}${kwh ? `<span class="sub">${kwh} kWh${price !== null ? w.average(fmtN(price, 1, L)) : ''}</span>` : ''}</span>${badge}</span>`;
    const prog = `<span class="prog"><span class="track" aria-hidden="true"><i style="width:${(((now - m0) / (m1 - m0)) * 100).toFixed(1)}%"></i></span><span class="pl"><span>${w.dayOf(p.d, days)}</span>${pace !== null ? `<span>${w.pace(Math.round(pace))}</span>` : ''}</span></span>`;
    const cells = `<span class="cells">${cell(w.todayCell, c.today, 1)}${cell(w.yesterdayCell, c.yesterday, 1)}${cell(cap(lastName), c.last_month, 0, !early)}</span>`;
    const inner = `${top}${prog}<span class="hr"></span>${cells}<span class="foot">${w.noFees}</span>`;
    const main = c.usage_history ? `<button type="button" class="glass press main" data-k="m" aria-label="${w.monthAria}">${inner}</button>` : `<div class="glass main">${inner}</div>`;
    return `<div class="wrap"><div class="head"><h1>${esc(c.title || w.energy)}</h1><span class="date">${esc(w.monthDate(monthName, p.d))}</span></div>${main}</div>`;
  }
}

const DAYS_CSS = `
.box{display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:24px}
.seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:2px;border-radius:12px;background:var(--seg)}
.seg button{height:34px;border-radius:10px;font-size:14px;font-weight:600;text-align:center;color:var(--text)}
.seg button[aria-pressed="true"]{background:var(--segOn);box-shadow:var(--segShadow)}
.avg{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.avg .n{font-size:28px;font-weight:700;letter-spacing:-0.025em}
.avg .u{font-size:14px;font-weight:600;color:var(--sub)}
svg.c{display:block;width:100%;height:120px;touch-action:pan-y}
.ax{display:flex;justify-content:space-between;margin-top:4px;font-size:11px;font-weight:600;color:var(--sub)}
.key{display:flex;gap:14px;font-size:12px;font-weight:600;color:var(--sub)}
.key span{display:flex;align-items:center;gap:5px}
.key i{display:inline-block}
.hr{height:1px;background:var(--hair)}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.stats > span{display:flex;flex-direction:column;gap:1px;min-width:0}
.stats .k{font-size:13px;font-weight:600;color:var(--sub)}
.stats .v{font-size:17px;font-weight:700}
.stats .v.bad{color:var(--high)}
.msg{display:flex;align-items:center;justify-content:center;height:120px;font-size:14px;color:var(--sub)}
.foot{font-size:12px;color:var(--sub)}
`;

// daily bars of one statistic, or several behind a segmented control: the last `days` days in
// HA's zone, the days past a delayed counter's cutoff lighter and out of the numbers. The
// headline opens the picked series' sheet over 30 days, 90 days and 12 months (ADR-013). A series'
// `overlay` draws a second statistic as narrow bars in front, and `headline: 'ratio'` puts the
// ratio of the two in the average's place.
class DaysCard extends LoadingCard {
  static css = DAYS_CSS;
  _check(c) { if (!(c.series || []).length) throw new Error('khe-days-card: series is required'); }
  _watched() {
    const c = this._config;
    return [...(c.series || []).map(s => s.today && s.today.entity), ...(c.cells || []).flatMap(x => [x.entity, x.share_of])].filter(Boolean);
  }
  _requests(now, tz) { return daysRequests(this._config, now, tz); }
  _html(states, pal) {
    const c = this._config, list = c.series, w = this._w, L = this._lang;
    const i = Math.min(this._pick || 0, list.length - 1), s = list[i];
    this._actions = new Map();
    this._sheets = new Map();
    const seg = list.length > 1 ? `<span class="seg" role="group" aria-label="${w.unitSwitch}">${list.map((x, j) => `<button type="button" data-p="${j}" aria-pressed="${j === i}">${esc(x.name)}</button>`).join('')}</span>` : '';
    const d = this._data;
    const shell = body => `<div class="glass box">${seg}${body}</div>`;
    this._point = null;
    if (!d) return shell(`<div class="msg">${w.loading}</div>`);
    if (d.error) return shell(`<div class="msg">${w.dataFailed}</div>`);
    const daily = d.res[dailyKey(seriesTypes(s))], o = s.overlay;
    // a delayed counter's days after its cutoff are late; a price is known ahead
    // with no hour of data in two days the cutoff is today's start: only today is late, as it is
    // for a counter without a cutoff, whose today has not ended
    const today = dayStarts(1, d.now, d.tz)[0];
    const cutoff = s.type !== 'change' ? Infinity : c.cutoff ? dataCutoff(d.res.cutoff, c.cutoff) ?? today : today;
    const days = (res, id, type) => dailySeries(res, id, type, c.days || 31, d.now, d.tz, cutoff, L);
    const pts = o ? withOverlay(days(daily, s.statistic, s.type), days(d.res[dailyKey([o.type])], o.statistic, o.type)) : days(daily, s.statistic, s.type);
    const scale = s.scale || 1, dec = s.decimals ?? 1, u = s.unit ? ` ${s.unit}` : '';
    const fmt = v => fmtN(v * scale, dec, L);
    const stats = dayStats(pts);
    const cellHtml = x => `<span><span class="k">${esc(x.k)}</span><span class="v num${x.bad ? ' bad' : ''}">${esc(x.v)}</span><span class="sub">${esc(x.l)}</span></span>`;
    const own = c.cells && dayCells(states, c.cells, d.now, d.tz, L, stats ? { avg: `${fmt(stats.avg)}${u}` } : {});
    // the entity cells do not need the statistics
    if (!stats) return shell(`<div class="msg">${w.noData}</div>${own ? `<span class="hr"></span><span class="stats">${own.map(cellHtml).join('')}</span>` : ''}`);
    const W = 341, H = 120, TOP = 8, BOT = 2, N = pts.length, GAP = 2, bw = (W - GAP * (N - 1)) / N;
    const hi = daysTop(pts, s.peak);
    const y = v => H - BOT - (v / hi) * (H - TOP - BOT);
    const col = { cheap: pal.cheap, mid: pal.midBar, high: pal.highBar };
    const paths = new Map();
    let peak = '';
    pts.forEach((p, j) => {
      if (p.v === null) return;
      const x = j * (bw + GAP);
      const fill = s.bands ? col[priceLevel(p.v, s.bands)] : a3Color(s.color)[0];
      const k = `${fill}|${p.late ? 0.4 : 1}`;
      paths.set(k, (paths.get(k) || '') + barRect(x, y(p.v), bw, Math.max(2, H - BOT - y(p.v))));
      if (s.peak && p.max !== null) peak += `M${x.toFixed(1)} ${y(p.max).toFixed(1)}h${bw.toFixed(1)}`;
    });
    // the overlay as narrow bars in front, the text colour at 0.55 unless it names one
    if (o) {
      const fill = o.color ? a3Color(o.color)[0] : pal.text, ow = bw * 0.4;
      pts.forEach((p, j) => {
        if (p.o === null) return;
        const k = `${fill}|${(o.color ? 1 : 0.55) * (p.late ? 0.4 : 1)}`;
        paths.set(k, (paths.get(k) || '') + barRect(j * (bw + GAP) + (bw - ow) / 2, y(p.o), ow, Math.max(1.5, H - BOT - y(p.o))));
      });
    }
    const bars = [...paths].map(([k, dd]) => { const [f, op] = k.split('|'); return `<path d="${dd}" fill="${f}"${op !== '1' ? ` fill-opacity="${op}"` : ''}/>`; }).join('');
    const grid = [0.25, 0.5, 0.75].map(f => `M0 ${(TOP + (H - TOP - BOT) * f).toFixed(1)}H${W}`).join('');
    // pointing at a day shows its value in the average's place (_wire)
    const head = s.headline === 'ratio' ? ratioHeadline(dayRatio(pts), s, L) : [fmt(stats.avg), s.caption || ''];
    const over = o && { name: o.name || '', unit: o.unit || '', fmt: v => fmtN(v, o.decimals ?? 2, L) };
    this._point = { pts, fmt, unit: s.unit || '', peak: s.peak, over, tz: d.tz, lang: L, avg: head, step: bw + GAP, unfinished: !c.cutoff };
    const sel = `<rect class="sel" y="0" width="${bw.toFixed(1)}" height="${H}" fill="${pal.text}" fill-opacity="0.1" visibility="hidden"/>`;
    const svg = `<svg class="c" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(s.aria || s.name)}">${sel}<path d="${grid}" stroke="${pal.hair}" fill="none" vector-effect="non-scaling-stroke"/>${bars}${peak ? `<path d="${peak}" stroke="${pal.text}" stroke-opacity="0.55" stroke-width="1.5" fill="none" vector-effect="non-scaling-stroke"/>` : ''}</svg>`;
    const marks = [0, Math.round(N / 4), Math.round(N / 2), Math.round((3 * N) / 4)].map(j => pts[j].label).concat(w.today);
    const axis = `<div class="ax" aria-hidden="true">${marks.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    const swatch = (bg, op = 1) => `<i style="width:10px;height:10px;border-radius:3px;background:${bg}${op !== 1 ? `;opacity:${op}` : ''}"></i>`;
    const keyOf = (...items) => `<span class="key">${items.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</span>`;
    let key = '';
    if (o) key = keyOf([swatch(a3Color(s.color)[0]), s.legend || s.name], [o.color ? swatch(a3Color(o.color)[0]) : swatch(pal.text, 0.55), o.name || '']);
    else if (s.peak) key = keyOf([swatch(pal.sub), w.dayAvg], [`<i style="width:12px;height:2px;background:${pal.text};opacity:.55"></i>`, w.dearestHour]);
    let three;
    if (own) three = own;
    else if (s.peak) {
      three = [[w.cheapestDay, stats.small], [w.dearestDay, stats.big], [w.dearestHour, stats.peak]].map(([k, x]) => ({ k: cap(k), v: x ? fmt(x.v) : '–', l: x ? x.label : '' }));
    } else {
      const t = s.today && states[s.today.entity];
      const tv = t && hasValue(t) ? (s.today.attribute ? parseEt((t.attributes || {})[s.today.attribute]) : num(t.state)) : null;
      three = [[w.largest, `${fmt(stats.big.v)}${u}`, stats.big.label], [w.smallest, `${fmt(stats.small.v)}${u}`, stats.small.label], [w.todaySoFar, tv === null ? '–' : `${fmtN(tv, dec, L)}${u}`, w.dayNotOver]].map(([k, v, l]) => ({ k, v, l }));
    }
    const cells = three.map(cellHtml).join('');
    const sheet = daysSheet(c, i);
    this._sheets.set('h', sheet);
    return shell(`<button type="button" class="avg press" data-k="h" aria-label="${esc(w.history(sheet.title))}"><span class="n num">${esc(head[0])}</span><span class="u">${esc(head[1])}</span></button><span>${svg}${axis}</span>${key}<span class="hr"></span><span class="stats">${cells}</span>${c.foot ? `<span class="foot">${esc(c.foot)}</span>` : ''}`);
  }
  // pointing at a day shows it in the average's place
  _wire() {
    const P = this._point, svg = this._root.querySelector('svg.c');
    if (!P || !svg) return;
    const n = this._root.querySelector('.avg .n'), u = this._root.querySelector('.avg .u'), sel = svg.querySelector('.sel');
    wirePoint(svg, f => Math.min(P.pts.length - 1, Math.floor(f * P.pts.length)), j => {
      sel.setAttribute('visibility', j === null ? 'hidden' : 'visible');
      if (j !== null) sel.setAttribute('x', (j * P.step).toFixed(1));
      [n.textContent, u.textContent] = dayPoint(P, j);
    });
  }
  _click(ev) {
    const b = ev.target.closest('button[data-p]');
    if (b) { this._pick = Number(b.dataset.p); this._draw(); return; }
    super._click(ev);
  }
}

const SPLIT_CSS = `
.box{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:24px}
.bar{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px}
.rows{display:flex;flex-direction:column}
.r{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;color:var(--text)}
.r + .r{border-top:1px solid var(--hair)}
.r i{flex:none;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;color:#fff}
.r .m{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.r .n{font-size:15px;font-weight:600}
.r .e{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.r .e b{font-size:15px;font-weight:700}
`;

// who used the month's energy: a split bar and a row per sub-meter, then the rest of the house
class SplitCard extends KheCard {
  static a3only = true;
  static css = SPLIT_CSS;
  _check(c) { if (!c.total) throw new Error('khe-split-card: total is required'); }
  _watched() { const c = this._config; return [c.total, c.fresh, ...(c.parts || []).map(p => p.entity)].filter(Boolean); }
  _clock() { return this._hass ? zoneParts(Date.now(), tzOf(this._hass)).d : 0; }
  _html(states) {
    const c = this._config, L = this._lang, w = this._w, { rows, stale } = splitRows(states, c, Date.now(), tzOf(this._hass), L);
    this._actions = new Map();
    this._sheets = new Map();
    const color = r => a3Color(r.color)[0];
    const bar = rows.filter(r => r.kwh > 0).map(r => `<span style="flex:${r.kwh.toFixed(2)};background:${color(r)}"></span>`).join('');
    const kwh = v => fmtN(v, v < 100 ? 1 : 0, L);
    const list = rows.map((r, i) => {
      const note = r.rest ? (stale ? w.late : w.restNote) : r.last !== null ? w.inLast(inLastMonth(Date.now(), tzOf(this._hass), L), kwh(r.last)) : '';
      const body = `<i style="background:${color(r)}">${icon(r.icon || 'bolt', 18, 'currentColor')}</i><span class="m"><span class="n">${esc(r.name)}</span><span class="sub">${esc(note)}</span></span><span class="e"><b class="num">${kwh(r.kwh)} kWh</b><span class="sub">${r.share} %</span></span>`;
      if (r.rest) return `<div class="r">${body}</div>`;
      this._sheets.set(`r${i}`, { title: r.name, entity: r.entity, more: r.entity, decimals: 1, unit: 'kWh', color: r.color, view: r.view, history: { source: 'statistics', type: 'change', entity: r.entity } });
      return `<button type="button" class="r press" data-k="r${i}" aria-label="${esc(w.splitAria(r.name, kwh(r.kwh)))}">${body}</button>`;
    }).join('');
    return `<div class="glass box">${bar ? `<span class="bar" aria-hidden="true">${bar}</span>` : ''}<span class="rows">${list || `<span class="sub">${w.noDataShort}</span>`}</span></div>`;
  }
}

// the reading card's look: the price card's head (.main, .hd, .lab, .big, .badge, .hr) and its own parts
const READING_CSS = `${PRICE_A3_CSS}${TRACK_CSS}
.main{padding:16px;box-sizing:border-box}
.badge.off{background:var(--seg);color:var(--sub)}
svg.ln{display:block;width:100%;height:88px;touch-action:pan-y}
.lx{display:flex;justify-content:space-between;margin-top:4px;font-size:11px;font-weight:600;color:var(--sub)}
.key{display:flex;gap:14px;font-size:12px;font-weight:600;color:var(--sub)}
.key span{display:flex;align-items:center;gap:5px}
.key i{display:inline-block;width:12px}
.msg{display:flex;align-items:center;justify-content:center;height:88px;font-size:14px;color:var(--sub)}
.cells{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cells.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.meter{display:flex;flex-direction:column;gap:6px}
.meter .mh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:15px;font-weight:600}
.meter .mv{font-weight:700}
.cells button{display:flex;flex-direction:column;gap:1px;min-width:0;min-height:44px}
.cells .v{font-size:20px;font-weight:700;letter-spacing:-0.02em}
.step{display:flex;align-items:center;justify-content:space-between;gap:12px}
.step .t{display:flex;flex-direction:column;gap:1px;min-width:0}
.step .nm{font-size:15px;font-weight:600}
.step .err{color:var(--high);font-weight:600}
.stp{flex:none;display:flex;align-items:center;gap:2px;padding:2px;border-radius:12px;background:var(--seg)}
.stp button{width:44px;height:40px;border-radius:10px;font-size:20px;font-weight:600;text-align:center}
.stp button:disabled{opacity:.35;cursor:default}
.stp .sv{min-width:46px;height:40px;border-radius:10px;background:var(--segOn);box-shadow:var(--segShadow);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
`;

const LW = 341, LH = 88, LTOP = 8, LBOT = 4;

// One reading big, with a note, a chip, a meter, its hourly line, the reading and cells that open
// their history sheets and a stepper: Soojuspump's Küte and Soe vesi (ADR-011), Ventilatsioon's Toaõhk and Seade.
// Every value reads its entity's unit, or the config's `unit` after its `scale`. The stepper's value moves at once and is
// written once the taps settle (STEP_SETTLE); a pending value outlives redraws.
const STEP_SETTLE = 1500, STEP_WAIT = 60e3;
class ReadingCard extends LoadingCard {
  static css = READING_CSS;
  _check(c) { if (!c.entity) throw new Error('khe-reading-card: entity is required'); }
  _watched() {
    const c = this._config, chip = c.chip || {};
    return [c.entity, (c.line || {}).statistic, chip.entity, chip.fault, ((c.note || {}).target || {}).entity, (c.meter || {}).entity, ...(c.cells || []).map(x => x.entity), (c.stepper || {}).entity].filter(Boolean);
  }
  _requests(now) { const l = this._config.line; return l ? { line: lineRequest(l.statistic, l.hours || 48, now) } : {}; }
  _html(states, pal) {
    const c = this._config, now = Date.now(), st = states[c.entity], w = this._w, L = this._lang;
    this._actions = new Map();
    this._sheets = new Map();
    this._point = null;
    const value = valueText(st, c.decimals, L, c);
    const l = c.line, hours = (l && l.hours) || 48, floor = l ? l.floor : undefined;
    const { chart = '', key = '', range = null, unit = '' } = l ? this._line(states, pal, l, hours, now) : {};
    const n = c.note || {};
    let note = n.text || '';
    if (n.target) {
      const t = attrText(states[n.target.entity], n.target.attribute, L);
      note = t ? `${w.target(t)}${floor != null ? w.notBelow(fmtN(floor, 0, L)) : ''}` : '';
    } else if (n.range && range) {
      const at = v => withUnit(fmtN(v, c.decimals ?? 1, L), unit);
      note = w.rangeNote(hours, at(range.lo), at(range.hi));
    }
    this._sheets.set('v', cellSheet({ entity: c.entity, name: c.label, decimals: c.decimals, scale: c.scale, unit: c.unit, color: (l || {}).color, history: c.history }, states));
    const top = `<span class="hd"><button type="button" class="l press" data-k="v" aria-label="${esc(w.history(`${c.label || ''} ${value}`))}"><span class="lab">${esc(c.label || '')}</span><span class="big"><span class="n num">${esc(value)}</span></span>${note ? `<span class="sub">${esc(note)}</span>` : ''}</button>${this._chip(states)}</span>`;
    const parts = [`${top}${c.meter ? this._meter(states) : ''}${chart ? `<span class="ch">${chart}</span>${key}` : ''}`];
    if ((c.cells || []).length) parts.push(this._cells(states));
    if (c.stepper) parts.push(this._stepper(states));
    return `<div class="glass main">${parts.join('<span class="hr"></span>')}</div>`;
  }
  // the hourly line, its floor key and its { lo, hi } for the note; sets what pointing reads
  _line(states, pal, l, hours, now) {
    const d = this._data, w = this._w, L = this._lang;
    if (!d) return { chart: `<span class="msg">${w.loading}</span>` };
    if (d.error) return { chart: `<span class="msg">${w.dataFailed}</span>` };
    const lst = states[l.statistic], live = hasValue(lst) ? num(lst.state) : null, unit = unitOf(lst);
    const series = lineSeries(d.res.line, l.statistic, live, now);
    const t0 = Math.floor(d.now / HOUR) * HOUR - hours * HOUR;
    const range = lineStats(series, t0, now), r = lineRange(range, l.floor);
    if (!r) return { chart: `<span class="msg">${w.noData}</span>` };
    const color = a3Color(l.color)[0], dec = this._config.decimals ?? 1;
    const p = chartPaths(series, { w: LW, h: LH, top: LTOP, bot: LBOT, t0, t1: now, lo: r.lo, hi: r.hi });
    const y = v => LH - LBOT - ((v - r.lo) / (r.hi - r.lo)) * (LH - LTOP - LBOT);
    const grid = [1 / 3, 2 / 3].map(f => `M0 ${(LH * f).toFixed(1)}H${LW}`).join('');
    const floored = l.floor != null;
    const floor = floored ? `<path d="M0 ${y(l.floor).toFixed(1)}H${LW}" stroke="${pal.sub}" stroke-dasharray="3 3" stroke-opacity="0.7" fill="none" vector-effect="non-scaling-stroke"/>` : '';
    const pts = series.points;
    this._point = {
      pick: f => nearest(pts, t0 + f * (now - t0)),
      read: i => ({ x: ((pts[i].t - t0) / (now - t0)) * LW, v: withUnit(fmtN(pts[i].v, dec, L), unit), when: pts[i].live ? w.now : whenLabel(pts[i].t, '24h', true, now, L) })
    };
    const chart = `<svg class="ln" viewBox="0 0 ${LW} ${LH}" preserveAspectRatio="none" role="img" aria-label="${esc(l.aria || this._config.label)}"><path d="${grid}" stroke="${pal.hair}" fill="none" vector-effect="non-scaling-stroke"/>${floor}<path d="${p.area}" fill="${color}" fill-opacity="0.16"/><path d="${p.line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${SEL(pal.text)}</svg><span class="lx" aria-hidden="true">${lineAxis(t0, now, L).map(x => `<span>${esc(x)}</span>`).join('')}</span>`;
    const key = floored ? `<span class="key"><span><i style="height:2px;background:${color}"></i>${esc(l.name || '')}</span><span><i style="border-top:1px dashed ${pal.sub}"></i>${esc(w.limit(fmtN(l.floor, 0, L)))}</span></span>` : '';
    return { chart, key, range, unit };
  }
  // Küte sees, Küte väljas, or Küte seisab while the fault is on
  _chip(states) {
    const ch = this._config.chip;
    if (!ch) return '';
    const st = states[ch.entity];
    let tone, word;
    if (ch.fault && stateOf(states, ch.fault) === 'on') [tone, word] = ['high', ch.fault_text];
    else if (!hasValue(st)) return '';
    else [tone, word] = st.state === 'on' ? ['mid', ch.on] : ['off', ch.off];
    return `<span class="badge ${tone}">${esc(word)}</span>`;
  }
  // the filter's clogging and the like: a share of its max in one neutral colour
  _meter(states) {
    const m = meterRow(states, this._config.meter, this._lang);
    return `<span class="meter"><span class="mh"><span>${esc(m.name)}</span><span class="mv num">${esc(m.value)}</span></span><span class="track" aria-hidden="true"><i style="width:${m.pct.toFixed(1)}%;background:${a3Color('gray')[0]}"></i></span>${m.note ? `<span class="sub">${esc(m.note)}</span>` : ''}</span>`;
  }
  _cells(states) {
    const cells = this._config.cells;
    const list = cells.map((x, i) => {
      const value = valueText(states[x.entity], x.decimals ?? 0, this._lang, x);
      this._sheets.set(`c${i}`, cellSheet(x, states));
      return `<button type="button" class="press" data-k="c${i}" aria-label="${esc(this._w.history(`${x.name} ${value}`))}"><span class="lab">${esc(x.name)}</span><span class="v num">${esc(value)}</span><span class="sub">${esc(x.caption || '')}</span></button>`;
    });
    return `<span class="${cellsClass(cells.length)}">${list.join('')}</span>`;
  }
  _stepper(states) {
    const sp = this._config.stepper, { cur, lim } = stepState(states[sp.entity]), w = this._w;
    const p = this._pend;
    // the entity reports the written value: the pending one is done
    if (p && p.sent && cur === p.v) { this._pend = null; clearTimeout(this._dropTimer); }
    const v = this._pend ? this._pend.v : cur;
    const note = this._err ? `<span class="sub err">${w.failed}</span>` : `<span class="sub">${v === null ? w.words.unavailable : esc(stepNote(v, this._lang))}</span>`;
    const btn = (dir, ch, label) => `<button type="button" class="press" data-k="st${dir}" data-st="${dir}" aria-label="${label}"${v === null || stepValue(v, dir, lim) === v ? ' disabled' : ''}>${ch}</button>`;
    return `<span class="step"><span class="t"><span class="nm">${esc(sp.name)}</span>${note}</span><span class="stp" role="group" aria-label="${esc(sp.name)}">${btn(-1, '−', w.shiftDown)}<span class="sv num" aria-live="polite">${v === null ? '–' : stepText(v)}</span>${btn(1, '+', w.shiftUp)}</span></span>`;
  }
  _tap(dir) {
    const { cur, lim } = stepState(this._hass.states[this._config.stepper.entity]);
    if (cur === null) return;
    this._err = false;
    this._pend = { v: stepValue(this._pend ? this._pend.v : cur, dir, lim), sent: false };
    clearTimeout(this._dropTimer);
    clearTimeout(this._stepTimer);
    this._stepTimer = setTimeout(() => this._flush(), STEP_SETTLE);
    this._draw();
  }
  // the settled value goes to HA as one number.set_value, unless the taps netted to the current one;
  // an error, or no report within STEP_WAIT, drops it
  _flush() {
    clearTimeout(this._stepTimer);
    this._stepTimer = null;
    const p = this._pend;
    if (!p || p.sent || !this._hass) return;
    const entity = this._config.stepper.entity;
    const w = stepWrite(p.v, num(stateOf(this._hass.states, entity)));
    if (w === null) { this._pend = null; this._draw(); return; }
    p.sent = true;
    const drop = err => { if (this._pend !== p) return; this._pend = null; this._err = err; this._draw(); };
    // a direct call, not a hass-action event: this can run after the card has left the page (ADR-011)
    Promise.resolve(this._hass.callService('number', 'set_value', { entity_id: entity, value: w })).catch(() => drop(true));
    this._dropTimer = setTimeout(() => drop(false), STEP_WAIT);
  }
  disconnectedCallback() { if (this._stepTimer) this._flush(); }
  _click(ev) {
    const b = ev.target.closest('button[data-st]');
    if (b) { if (!b.disabled) this._tap(Number(b.dataset.st)); return; }
    super._click(ev);
  }
  // pointing at the line shows that hour's value and time in place of the value now
  _wire() {
    const P = this._point, svg = this._root.querySelector('svg.ln');
    if (!P || !svg) return;
    const hd = this._root.querySelector('.hd'), lab = hd.querySelector('.lab'), n = hd.querySelector('.n'), sel = svg.querySelector('.sel');
    const was = [lab.textContent, n.textContent];
    wirePoint(svg, P.pick, i => {
      hd.classList.toggle('pointing', i !== null);
      if (i === null) { sel.setAttribute('d', ''); [lab.textContent, n.textContent] = was; return; }
      const r = P.read(i);
      sel.setAttribute('d', `M${r.x.toFixed(1)} 0V${LH}`);
      lab.textContent = cap(r.when);
      n.textContent = r.v;
    });
  }
}

const ELEMENTS = [
  ['khe-summary-card', SummaryCard, 'KHE summary', 'The house in one sentence, with summary chips.'],
  ['khe-price-card', PriceCard, 'KHE price', 'The electricity price now, the hourly bars and the cheapest windows.'],
  ['khe-tile-card', TileCard, 'KHE tile', 'A device tile that is lit when on, with optional mode buttons.'],
  ['khe-chips-card', ChipsCard, 'KHE chips', 'The page title, the outdoor temperature, people, alarms and faults (A3).'],
  ['khe-heading-card', HeadingCard, 'KHE heading', 'A section heading, a link when it has a tap action (A3).'],
  ['khe-status-card', StatusCard, 'KHE status', 'System health as dots (A3).'],
  ['khe-month-card', MonthCard, 'KHE month', "The month's energy cost, its pace, today, yesterday and last month (A3)."],
  ['khe-days-card', DaysCard, 'KHE days', 'Daily bars of a statistic, several behind a switch (A3).'],
  ['khe-split-card', SplitCard, 'KHE split', "Who used the month's energy (A3)."],
  ['khe-reading-card', ReadingCard, 'KHE reading', 'One reading with its hourly line, cells and a stepper (A3).']
];
if (typeof customElements !== 'undefined') {
  window.customCards = window.customCards || [];
  for (const [tag, cls, name, description] of ELEMENTS) {
    if (customElements.get(tag)) continue;
    customElements.define(tag, cls);
    window.customCards.push({ type: tag, name, description });
  }
}
