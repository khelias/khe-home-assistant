// Home Assistant card for the house 3D view. The model (every layer but showcase) arrives in
// the card config, written by scripts/ha-dashboard.py; this file carries no house data.
// Bump HOUSE3D_VERSION on every change to this file or the engine, and the same ?v= on the
// Lovelace resource URL: HA's /local and the phone app cache aggressively.
const HOUSE3D_VERSION = 67;

// importRetry(load, urlFor, opts) -> the module load(url) gives, tried `tries` times `delay` ms
// apart. A failed module URL stays failed in the browser's module map, so each try asks urlFor()
// for a new one; every failure is logged with its URL.
export async function importRetry(load, urlFor, { tries = 2, delay = 2000, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let err;
  for (let n = 0; n < tries; n++) {
    if (n) await wait(delay);
    const url = urlFor(n);
    try {
      return await load(url);
    } catch (e) {
      err = e;
      console.error(`house3d: loading ${url} failed: ${(e && e.message) || e}`, e);
    }
  }
  throw err;
}

// The engine loads once per page; after a failure the next card render (Proovi uuesti) loads it
// again. A retry's extra query reaches the engine's scene/ modules, which take its query.
let engine = null, loads = 0;
const engineUrl = n => `./house3d.js?v=${HOUSE3D_VERSION}${n ? `&r=${n}` : ''}`;
function loadEngine() {
  if (!engine) engine = importRetry(u => import(u), () => engineUrl(loads++)).catch(e => { engine = null; throw e; });
  return engine;
}

// The card's strings: Estonian, or English with `language: en` in the card config, which only the
// public demo sets (ADR-003), so the house's own card stays Estonian whatever HA's profile says.
export const TEXT = {
  et: {
    locale: 'et-EE',
    layers: { markers: 'Seadmed', fans: 'Kaamerate vaated', trees: 'Puud', car: 'Auto', surroundings: 'Ümbrus', future: 'Tulevik', winter: 'Talv' },
    view: 'Vaade',
    roof: 'Katusega',
    open: 'Katuseta',
    resetView: 'Lähtesta vaade',
    fullView: 'Ava 3D-vaade',
    layersTitle: 'Kihid',
    loadFailed: '3D-vaate laadimine ebaõnnestus.',
    retry: 'Proovi uuesti',
    noWebGL: 'See seade ei toeta WebGL-i, mistõttu 3D-vaadet ei saa näidata.',
    time: 'Kellaaeg',
    date: 'Kuupäev',
    now: 'Praegu',
    credit: 'Ümbrus: Maa- ja Ruumiamet, ETAK',
    missing: 'puudub',
    onPlan: (no, area) => `Plaanil ${no} · ${area} m²`,
    close: 'Sulge',
    noDevices: 'Selles ruumis seadmeid pole.',
    style: 'Stiil',
    simple: 'Lihtne',
    real: 'Päris',
    photo: 'Foto',
    noLayers: 'Lülitatavaid kihte pole.',
    plan: 'Plaan',
    planAsOf: date => `Plaan · hinnang ${date}`,
    at: (day, hhmm) => `${day} kell ${hhmm}`,
    pvUpTo: (when, kw) => `${when} selge taevaga kuni ${kw} kW`,
    pvSunset: when => `${when} on päike loojunud`,
    noFacts: 'Numbreid pole veel lisatud.',
    temperature: v => `temperatuur ${v}`,
    motion: 'liikumine',
    motions: n => `liikumine, ${n} andurit`,
    light: 'valgus põleb',
    lights: n => `${n} valgustit põleb`,
    door: 'uks on lahti',
    doors: n => `${n} ust on lahti`,
    smoke: 'suitsuandur annab häiret',
    smokes: n => `${n} suitsuandurit annab häiret`,
    alarm: 'häire',
    armed: 'valve on peal',
    prevCamera: 'Eelmine kaamera',
    nextCamera: 'Järgmine kaamera',
    fullScreen: 'Täisekraan',
    noStill: 'Pilti pole',
    stillAt: hhmm => `Pilt kell ${hhmm}`
  },
  en: {
    locale: 'en-GB',
    layers: { markers: 'Devices', fans: 'Camera views', trees: 'Trees', car: 'Car', surroundings: 'Surroundings', future: 'Future', winter: 'Winter' },
    view: 'View',
    roof: 'Roof on',
    open: 'Roof off',
    resetView: 'Reset view',
    fullView: 'Open the 3D view',
    layersTitle: 'Layers',
    loadFailed: 'Loading the 3D view failed.',
    retry: 'Try again',
    noWebGL: 'This device does not support WebGL, so the 3D view cannot be shown.',
    time: 'Time',
    date: 'Date',
    now: 'Now',
    credit: 'Surroundings: Estonian Land and Spatial Development Board, ETAK',
    missing: 'missing',
    onPlan: (no, area) => `Room ${no} on the plan · ${area} m²`,
    close: 'Close',
    noDevices: 'No devices in this room.',
    style: 'Style',
    simple: 'Simple',
    real: 'Real',
    photo: 'Photo',
    noLayers: 'No layers to switch.',
    plan: 'Plan',
    planAsOf: date => `Plan · estimate of ${date}`,
    at: (day, hhmm) => `${day} at ${hhmm}`,
    pvUpTo: (when, kw) => `${when} up to ${kw} kW under a clear sky`,
    pvSunset: when => `${when} the sun has set`,
    noFacts: 'No figures added yet.',
    temperature: v => `temperature ${v}`,
    motion: 'motion',
    motions: n => `motion, ${n} sensors`,
    light: 'light on',
    lights: n => `${n} lights on`,
    door: 'door open',
    doors: n => `${n} doors open`,
    smoke: 'smoke alarm going off',
    smokes: n => `${n} smoke alarms going off`,
    alarm: 'alarm',
    armed: 'armed',
    prevCamera: 'Previous camera',
    nextCamera: 'Next camera',
    fullScreen: 'Full screen',
    noStill: 'No picture',
    stillAt: hhmm => `Picture at ${hhmm}`
  }
};
const FORMATS = Object.fromEntries(Object.entries(TEXT).map(([lang, { locale }]) => [lang, {
  nf1: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  dayFmt: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }),
  dateFmt: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}]));
const langOf = lang => (lang === 'en' ? 'en' : 'et');
const textFor = lang => TEXT[langOf(lang)];
const formatsFor = lang => FORMATS[langOf(lang)];

const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

// cameraStillUrl(st, t) -> a camera's still: the state's entity_picture (camera_proxy with its
// rotating token, so read from the current state at each load) with a time parameter so no cache
// answers; null without a picture. The twin of cards/parts/media.js cameraUrl, which this card,
// deployed apart from the cards, cannot import.
export function cameraStillUrl(st, t) {
  const pic = st && st.attributes && st.attributes.entity_picture;
  return pic ? `${pic}${pic.includes('?') ? '&' : '?'}t=${t}` : null;
}

// an outdoor camera's marker is drawn this far ahead along its look, on its view fan, so two
// cameras on one corner looking apart are two markers; the fan itself starts at the camera
const CAM_AHEAD = 3;
function camAt(d) {
  const n = d.pos && d.look ? Math.hypot(d.look[0], d.look[1]) : 0;
  return n ? [d.pos[0] + d.look[0] / n * CAM_AHEAD, d.pos[1], d.pos[2] + d.look[1] / n * CAM_AHEAD] : d.pos;
}

// houseCentre(rooms) -> [x, z], the middle of the house rooms (every room but a paved one)
export function houseCentre(rooms) {
  const rects = (rooms || []).filter(r => r.floor !== 'paving').flatMap(r => r.rects || []);
  if (!rects.length) return null;
  const xs = rects.flatMap(([x0, , x1]) => [x0, x1]), zs = rects.flatMap(([, z0, , z1]) => [z0, z1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

// cameraRing(devices, id, centre) -> the camera entities the panel's arrows walk, id first: round
// the house as seen from above, the next one to the right of a viewer looking out through the
// camera (clockwise), the last one to its left, by each marker's place round centre ([x, z], else
// the cameras' own middle); cameras without a place last in config order. [] when id is not a
// camera device.
export function cameraRing(devices, id, centre = null) {
  const cams = devices.filter(d => d.entity.startsWith('camera.'));
  if (!cams.some(d => d.entity === id)) return [];
  const placed = cams.filter(d => d.pos), rest = cams.filter(d => !d.pos);
  const mid = centre || (placed.length ? [0, 2].map(k => placed.reduce((a, d) => a + camAt(d)[k], 0) / placed.length) : [0, 0]);
  const angle = d => Math.atan2(camAt(d)[2] - mid[1], camAt(d)[0] - mid[0]);
  const order = [...placed.sort((a, b) => angle(a) - angle(b)), ...rest].map(d => d.entity);
  const i = order.indexOf(id);
  return [...order.slice(i), ...order.slice(0, i)];
}

// a still is fetched every CAM_STILL_MS while its panel shows, as Kaamerad's large still (ADR-016)
const CAM_STILL_MS = 10e3, CAM_STALL_MS = 15e3;
const CHEVRON = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const PREV = CHEVRON('M15 5l-7 7 7 7'), NEXT = CHEVRON('M9 5l7 7-7 7');

// hh:mm of date in HA's time zone, else the browser's; one formatter per language and zone
const CLOCKS = new Map();
function clockIn(date, lang, tz) {
  const key = `${langOf(lang)} ${tz || ''}`;
  if (!CLOCKS.has(key)) {
    const opts = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, locale = textFor(lang).locale;
    let fmt;
    try { fmt = new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz || undefined }); } catch { fmt = new Intl.DateTimeFormat(locale, opts); }
    CLOCKS.set(key, fmt);
  }
  return CLOCKS.get(key).format(date);
}

// The car drives in once per arrival per browser: the last arrival key seen is stored per entity.
// Storage can throw (private mode, blocked site data), so a module-level copy keeps a remount from
// replaying even then.
const seenMemory = new Map();
const seenKey = entity => `house3d-car-seen:${entity}`;
function readSeen(entity) {
  try {
    const v = localStorage.getItem(seenKey(entity));
    if (v !== null) return v;
  } catch (e) { /* the in-memory copy answers */ }
  return seenMemory.get(seenKey(entity)) ?? null;
}
function writeSeen(entity, key) {
  seenMemory.set(seenKey(entity), key);
  try { localStorage.setItem(seenKey(entity), key); } catch (e) { /* the in-memory copy stands */ }
}

// The Kihid sheet's switches, in this order; the choice is kept per browser like the arrival key.
const LAYER_ORDER = ['markers', 'fans', 'trees', 'car', 'surroundings', 'future', 'winter'];
// switched off until the user turns it on: what the house does not have yet
const LAYERS_KEY = 'house3d-layers';
const LAYERS_OFF = { future: false };
function readLayers() {
  try {
    const v = JSON.parse(localStorage.getItem(LAYERS_KEY));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch (e) { /* the in-memory copy answers */ }
  return { ...(seenMemory.get(LAYERS_KEY) || {}) };
}
function writeLayers(layers) {
  seenMemory.set(LAYERS_KEY, layers);
  try { localStorage.setItem(LAYERS_KEY, JSON.stringify(layers)); } catch (e) { /* the in-memory copy stands */ }
}

// The style is kept per browser too; the time of day is not.
const STYLE_KEY = 'house3d-style';
const STYLES = ['simple', 'real', 'photo'];
function readStyle() {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    if (STYLES.includes(v)) return v;
  } catch (e) { /* the in-memory copy answers */ }
  const v = seenMemory.get(STYLE_KEY);
  return STYLES.includes(v) ? v : 'simple';
}
function writeStyle(v) {
  seenMemory.set(STYLE_KEY, v);
  try { localStorage.setItem(STYLE_KEY, v); } catch (e) { /* the in-memory copy stands */ }
}

// A picture of the view, per hero or full view and style, shown at once on the next load until the
// first live frame covers it; a first visit shows a slow wave instead. It is taken when a fresh
// mount (home view, live time, no scene) first settles, since a next load starts from just that;
// a picture taken on leaving would show the last orbit and time, and jump. Only a failed write
// keeps it in memory, since it is an image; that newer copy then wins over the stored one.
const POSTER_W = 640;
export const posterKey = (hero, style) => `house3d-poster:${hero ? 'hero' : 'full'}:${style}`;
export function readPoster(key) {
  if (seenMemory.has(key)) return seenMemory.get(key);
  try {
    const v = localStorage.getItem(key);
    if (v && v.startsWith('data:image/')) return v;
  } catch (e) { /* none */ }
  return null;
}
export function writePoster(key, url) {
  try { localStorage.setItem(key, url); } catch (e) { seenMemory.set(key, url); }
}

// The lit styles' sliders: the time of day in quarter hours (96 is 24:00) and the day of this year.
const pad = n => String(n).padStart(2, '0');
const yearStart = () => new Date(new Date().getFullYear(), 0, 1);
const dayOfYear = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - yearStart()) / 86400000);
const hourText = q => `${pad(Math.floor(q / 4))}:${pad((q % 4) * 15)}`;
const dayDate = n => new Date(yearStart().getFullYear(), 0, 1 + n);

// featureText(item, asOf, pv, lang) -> the future item's sheet: { title, sub, facts, empty, pv }.
// asOf is the future block's 'YYYY-MM-DD'; pv is null (the line is left out) or { kw, alt, time,
// live }, the clear-sky estimate at the sun's time, live when that is now rather than a slider's.
export function featureText(item, asOf, pv, lang = 'et') {
  const t = textFor(lang), { nf1, dayFmt, dateFmt } = formatsFor(lang);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf || '');
  const sub = m ? t.planAsOf(dateFmt.format(new Date(+m[1], +m[2] - 1, +m[3]))) : t.plan;
  const facts = Array.isArray(item.facts) ? item.facts : [];
  let line = null;
  if (pv) {
    const when = pv.live ? t.now : t.at(dayFmt.format(pv.time), `${pad(pv.time.getHours())}:${pad(pv.time.getMinutes())}`);
    line = pv.alt > 0 ? t.pvUpTo(when, nf1.format(pv.kw)) : t.pvSunset(when);
  }
  return { title: item.name, sub, facts, empty: facts.length ? null : t.noFacts, pv: line };
}

// true when the car is home ('home' from a tracker, 'on' from the arrival helper), null when the
// state says nothing (unavailable, unknown), false otherwise and for a missing entity
export function carHome(st) {
  if (!st) return false;
  if (st.state === 'unavailable' || st.state === 'unknown') return null;
  return st.state === 'home' || st.state === 'on';
}

// the arrival helper's arrived_at when the entity has that attribute (null: parked without a
// drive-in), else last_changed
export function arrivalKey(st) {
  const a = st.attributes || {};
  if ('arrived_at' in a) return a.arrived_at === null || a.arrived_at === undefined ? null : String(a.arrived_at);
  return st.last_changed ? String(st.last_changed) : null;
}

// A room glows after dark while its motion sensor is on and for GLOW_MINUTES after it went off.
const GLOW_MINUTES = 15, MOTION_GLOW = 0.8;

// motionGlow(st, now) -> the glow a motion sensor's state gives its room: MOTION_GLOW while on or
// off since less than GLOW_MINUTES before now (the wall clock, never the time slider), else 0
export function motionGlow(st, now) {
  if (st && st.state === 'on') return MOTION_GLOW;
  if (!st || st.state !== 'off') return 0;
  const age = now - new Date(st.last_changed);
  return age < GLOW_MINUTES * 60000 ? MOTION_GLOW : 0;
}

// One device and its entity state -> a generic engine marker; a motion marker carries glow while
// motionGlow() at now gives one. lang picks the decimal mark of a temperature.
export function toMarker(d, st, now = new Date(), lang = 'et') {
  const { nf1 } = formatsFor(lang);
  const m = { id: d.entity, pos: d.pos, icon: d.type, room: d.room, label: d.name, state: 'idle' };
  if (d.look) m.look = d.look;
  if (d.type === 'camera' && d.look && d.pos && !d.room) m.at = camAt(d);
  if (d.role) m.role = d.role;
  if (!st || st.state === 'unavailable') { m.state = 'off'; return m; }
  const s = st.state, domain = d.entity.split('.')[0];
  if (domain === 'alarm_control_panel') {
    m.state = s === 'triggered' ? 'alert' : s === 'disarmed' || s === 'unknown' ? 'idle' : 'on';
    m.warm = false;
    m.pulse = s === 'triggered';
  } else if (d.type === 'door' || d.type === 'smoke') {
    if (s === 'on') { m.state = 'alert'; m.pulse = true; }
  } else if (d.type === 'motion') {
    if (s === 'on') { m.state = 'on'; m.pulse = true; }
    const glow = motionGlow(st, now);
    if (glow > 0) m.glow = glow;
  } else if (domain === 'light') {
    if (s === 'on') {
      m.state = 'on';
      const b = num(st.attributes && st.attributes.brightness);
      m.level = b === null ? 1 : b / 255;
    }
  } else if (domain === 'sensor') {
    const v = num(s);
    if (v !== null) m.value = `${nf1.format(v)}°`;
  } else if (domain === 'water_heater' || domain === 'climate') {
    const v = num(st.attributes && st.attributes.current_temperature);
    if (v !== null) m.value = `${nf1.format(v)}°`;
    // a heating unit at work is on, but it is no lamp: the room's floor stays as it is
    if (domain === 'climate' && s !== 'off' && s !== 'unknown') { m.state = 'on'; m.warm = false; }
  } else if (domain === 'switch' || domain === 'fan' || domain === 'input_boolean') {
    if (s === 'on') { m.state = 'on'; m.warm = false; }
  }
  // cover (the pergola reports no position), select and camera stay idle
  return m;
}

// roomChips(markers, rooms) -> the engine's setRoomChips list from toMarker's results: for
// every house room (not a paved one, the carport) what is going on there now, each with its icon
// and a count past one: motion, lights on, open doors, smoke alarms going off, the alarm armed or
// triggered; and its temperature (a sensor's, else a climate unit's). Alert parts come first, then
// 'on' ones, then the rest, so the compact chip (its first part) is the most urgent. A room with
// none of these shows its name alone. The chip is 'alert' with a door open, smoke or the alarm
// triggered, 'on' with motion or a light. ids are the markers counted in a part, which the engine
// then draws in the chip instead of beside it (scene/overlay.js's inChip()).
export function roomChips(markers, rooms, lang = 'et') {
  const t = textFor(lang);
  const domain = m => m.id.split('.')[0];
  const RANK = { alert: 0, on: 1 };
  return rooms.filter(r => r.floor !== 'paving').map(r => {
    const ms = markers.filter(m => m.room === r.id), parts = [], ids = [];
    const count = (list, one, many) => {
      if (!list.length) return;
      ids.push(...list.map(m => m.id));
      parts.push({ ...one, text: list.length > 1 ? String(list.length) : undefined, label: list.length > 1 ? many(list.length) : one.label });
    };
    const temp = ms.find(m => domain(m) === 'sensor' && m.value) || ms.find(m => domain(m) === 'climate' && m.value);
    if (temp) parts.push({ icon: 'climate', text: temp.value, label: t.temperature(temp.value) });
    count(ms.filter(m => m.icon === 'motion' && m.state === 'on'), { icon: 'motion', state: 'on', label: t.motion }, t.motions);
    count(ms.filter(m => domain(m) === 'light' && m.state === 'on'), { icon: 'light', state: 'on', label: t.light }, t.lights);
    count(ms.filter(m => m.icon === 'door' && m.state === 'alert'), { icon: 'door', state: 'alert', label: t.door }, t.doors);
    count(ms.filter(m => m.icon === 'smoke' && m.state === 'alert'), { icon: 'smoke', state: 'alert', label: t.smoke }, t.smokes);
    const alarm = ms.filter(m => domain(m) === 'alarm_control_panel' && (m.state === 'on' || m.state === 'alert'));
    if (alarm.length) {
      ids.push(...alarm.map(m => m.id));
      parts.push(alarm.some(m => m.state === 'alert') ? { icon: 'alarm', state: 'alert', label: t.alarm } : { icon: 'alarm', label: t.armed });
    }
    parts.sort((p, q) => (RANK[p.state] ?? 2) - (RANK[q.state] ?? 2));
    const state = parts.some(q => q.state === 'alert') ? 'alert' : parts.some(q => q.state === 'on') ? 'on' : 'idle';
    return { room: r.id, parts, state, ids };
  });
}

// heroSize(config) -> { height, rows }: a card with `height` (px) is a dashboard's hero at that
// height; HA's sections grid gives a row 56 px plus an 8 px gap, so it asks for enough rows.
// Without one it keeps the 480 px default and its 8 rows. A panel view fills the screen either way.
export function heroSize(config) {
  const h = Number(config && config.height);
  if (!Number.isFinite(h) || h <= 0) return { height: null, rows: 8 };
  return { height: Math.round(h), rows: Math.ceil((Math.round(h) + 8) / 64) };
}

const viewHeight = () => (window.visualViewport ? window.visualViewport.height : window.innerHeight);

// stretchBox(config) -> px or null: the height of a hero with `stretch` (true or 'beside'), before
// it measures its row: the box its rows gave it, so a phone's sections stay where they were with the
// grid's rows at auto.
export function stretchBox(config) {
  const hero = heroSize(config);
  return config && config.stretch && hero.height ? hero.rows * 64 - 8 : null;
}

// besideBottoms(own, rects, mode) -> the bottoms of the sections a hero's section stretches to
// (rects { left, right, top, bottom } in page coordinates, `own` its section's). `true`: those
// starting on its row (ADR-010). 'beside': those right of it from its top down, as Elekter,
// Juhtimine and Kliima beside a hero two columns wide and three rows high (ADR-018). Not only
// those within its rows: a section measures to its content, not to the rows it spans, so the
// hero's rows cannot be read from its rect, and Kliima starts below it until it has grown.
// A hidden section measures 0 high and is left out.
export function besideBottoms(own, rects, mode) {
  return rects.filter(r => r.bottom > r.top && (mode === 'beside'
    ? r.left >= own.right - 2 && r.top >= own.top - 2
    : Math.abs(r.top - own.top) <= 2)).map(r => r.bottom);
}

// stretchHeight({ min, top, rest, beside, bottom }) -> px: in HA's sections view a hero with
// `stretch` grows until its section ends where the lowest section `beside` it ends (page
// coordinates), never past `bottom` and never under `min`; `rest` is what its section holds
// besides it. With nothing beside it, one column, it stays `min`. Floored: a section half a pixel
// taller than the rows it spans grows them, and the sections beside it with them, so it would creep.
export function stretchHeight({ min, top, rest, beside, bottom }) {
  if (!beside.length) return min;
  return Math.max(min, Math.floor(Math.min(bottom, Math.max(...beside)) - top - rest));
}

// heroMount(hero, style, layers, season) -> { style, layers, snowfall, ao }: what the engine mounts
// with. A hero (a card with `height`, a dashboard's top) is always the real style with the live
// sun; it keeps its layer switches to itself, not in the stored ones of the full 3D view (ADR-006,
// ADR-009). Any other card is as the visitor left it. season holds the seasonal layers' defaults
// for today ({ winter: seasonOn(now) }), under the switches; snow falls and the contact shadows
// show in the full view only, since the hero sits on an always-on dashboard.
export function heroMount(hero, style, layers, season) {
  const all = { ...LAYERS_OFF, ...(season || {}), ...(layers || {}) };
  return { style: hero ? 'real' : style, layers: all, snowfall: !hero, ao: !hero };
}

// The seasonal layer's switch holds only for the season window, or the gap between windows, it
// was flipped in: it is stored as { on, window } (the engine's seasonWindow), and a value from
// another window is dropped, so the next season starts from its default again.
const SEASONAL = 'winter';
// the stored switches without a seasonal one from another window than win
const fresh = (stored, win) => Object.fromEntries(Object.entries(stored || {})
  .filter(([id, v]) => id !== SEASONAL || (v && typeof v === 'object' && v.window === win)));
// resolveLayers(stored, win) -> { id: bool }: the stored switches as the engine takes them, win
// being today's seasonWindow
export function resolveLayers(stored, win) {
  return Object.fromEntries(Object.entries(fresh(stored, win)).map(([id, v]) => [id, id === SEASONAL ? !!v.on : v]));
}
// storeLayer(stored, id, on, win) -> the stored switches with id set, the seasonal one stamped
// with today's window and an expired one dropped
export function storeLayer(stored, id, on, win) {
  return { ...fresh(stored, win), [id]: id === SEASONAL ? { on: !!on, window: win } : on };
}

const STYLE = `
:host { display: block; height: var(--house3d-height, 480px); }
/* a hero leaves vertical swipes to the page; the important beats OrbitControls' inline none */
:host([hero]:not([panel])) canvas { touch-action: pan-y !important; }
.wrap { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px);
  --ink: #e4ecff; --muted: #8a9bc2; --line: #6fe3ff; --amber: #ffc56e; --alert: #ff8b7b; --bg: #060c1b;
  --glass: rgba(26, 30, 42, 0.62); --glass-edge: rgba(255, 255, 255, 0.2); --row: rgba(255, 255, 255, 0.08); --pressed: rgba(255, 255, 255, 0.92);
  --blur: blur(16px);
  color: var(--ink); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", var(--paper-font-body1_-_font-family, system-ui), sans-serif; }
:host([panel]) .wrap { border-radius: 0; }
.view { position: absolute; inset: 0; }
.view.loading { background: linear-gradient(100deg, transparent 35%, rgba(111, 227, 255, 0.06) 50%, transparent 65%) 0 0 / 300% 100%;
  animation: wave 1.8s linear infinite; }
@keyframes wave { from { background-position: 100% 0; } to { background-position: 0 0; } }
.poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; transition: opacity 0.3s ease; }
.poster.gone { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .view.loading { animation: none; } .poster { transition: none; } }
/* glass: what stays still blurs what is under it; the moving markers are the engine's, unblurred */
.bar, .sheet, .campanel { background: var(--glass); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  border: 0.5px solid var(--glass-edge); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
.bar { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; padding: 4px; border-radius: 999px; }
.seg { display: flex; padding: 3px; gap: 2px; background: var(--row); border-radius: 999px; }
.bar .seg { padding: 0; background: transparent; }
.seg button, .icon-btn { font: inherit; font-size: 14px; font-weight: 600; line-height: 1; color: rgba(255, 255, 255, 0.75); background: transparent; border: 0; border-radius: 999px; padding: 0 16px; height: 44px; cursor: pointer; white-space: nowrap; }
.seg button[aria-pressed="true"], .now[aria-pressed="true"] { color: #10131a; background: var(--pressed); }
.icon-btn { display: grid; place-items: center; width: 44px; padding: 0; color: rgba(255, 255, 255, 0.85); }
.icon-btn svg { width: 20px; height: 20px; }
button:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
.sheet[hidden] { display: none; }
.sheet { position: absolute; top: 72px; right: 12px; width: 320px; max-height: calc(100% - 88px); overflow: auto;
  border-radius: 24px; display: grid; gap: 14px; padding: 16px; box-sizing: border-box; }
.head { display: grid; grid-template-columns: 1fr 40px; gap: 12px; align-items: start; }
.head h2 { margin: 0; font-size: 19px; font-weight: 600; line-height: 1.2; }
.head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.close { width: 40px; height: 40px; margin: -6px -6px 0 0; border-radius: 20px; border: 0; background: var(--row); color: var(--ink); cursor: pointer; display: grid; place-items: center; }
.close svg { width: 18px; height: 18px; }
.list { display: grid; gap: 6px; }
.list button { display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center; text-align: left; width: 100%; min-height: 44px;
  font: inherit; font-size: 14px; line-height: 1.2; color: var(--ink); background: var(--row); border: 0; border-radius: 14px; padding: 10px 12px; cursor: pointer; }
.list button svg { width: 18px; height: 18px; color: rgba(255, 255, 255, 0.8); }
.list button.on svg { color: var(--amber); }
.list button.alert svg { color: var(--alert); }
.list .st { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.empty { color: var(--muted); }
.pv { margin: 0; padding: 10px 12px; border-radius: 14px; background: var(--row); font-variant-numeric: tabular-nums; }
.facts { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.list.switches button { grid-template-columns: 1fr auto; }
.sw { position: relative; width: 44px; height: 26px; border-radius: 13px; background: rgba(255, 255, 255, 0.16); transition: background-color .15s; }
.sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform .15s; }
[aria-checked="true"] .sw { background: var(--line); }
[aria-checked="true"] .sw::after { transform: translateX(18px); }
@media (prefers-reduced-motion: reduce) { .sw, .sw::after { transition: none; } }
.row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.sheet .seg button { height: 34px; padding: 0 12px; font-size: 13px; }
.slider { display: grid; gap: 6px; }
.slider output { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.slider input { width: 100%; margin: 0; accent-color: #fff; }
.now { justify-self: start; font: inherit; font-size: 13px; font-weight: 600; line-height: 1; color: var(--ink); background: var(--row); border: 0; border-radius: 999px; padding: 0 14px; height: 34px; cursor: pointer; }
.msg { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px; padding: 16px; color: var(--muted); text-align: center; background: var(--bg); }
.msg small { font-size: 12px; opacity: .8; }
.msg .now { justify-self: center; }
.credit { position: absolute; top: 10px; left: 12px; max-width: calc(100% - 24px); font-size: 11px; line-height: 1.3; color: var(--ink); opacity: .85; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7); pointer-events: none; }
/* narrow follows the card's own width: a panel view on a wide screen can still be narrow */
.narrow .bar { top: auto; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); right: 50%; transform: translateX(50%); }
/* a hero keeps its buttons in the corner and drops its sheet from them */
:host([hero]) .credit { max-width: calc(100% - 84px); }
:host([hero]) .to-full .credit { max-width: calc(100% - 132px); }
:host([hero]) .narrow .bar { top: 12px; bottom: auto; right: 12px; transform: none; }
:host([hero]) .narrow .sheet { top: 68px; bottom: 8px; max-height: none; }
/* the sheet ends above the bar, so its buttons stay in reach */
.narrow .sheet { top: auto; left: 8px; right: 8px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); width: auto;
  max-height: calc(100% - 92px - env(safe-area-inset-bottom, 0px)); }
/* a camera's picture: bottom left, above the bar when narrow, across the bottom of a hero */
.campanel[hidden] { display: none; }
.campanel { position: absolute; left: 12px; bottom: 12px; width: 360px; max-width: calc(100% - 24px); box-sizing: border-box; padding: 8px; border-radius: 26px; }
.campanel .pic { position: relative; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden; background: rgba(0, 0, 0, 0.35); }
.campanel .pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.campanel .pic img:not([src]) { display: none; }
.campanel .pic.stale img { opacity: 0.45; }
.campanel .ph { position: absolute; inset: 0; display: none; place-items: center; color: var(--muted); font-size: 13px; }
.campanel .pic.none .ph { display: grid; }
.campanel .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 2px 2px 10px; }
.campanel .txt { min-width: 0; }
.campanel .nm { font-size: 17px; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.campanel .sub { margin-top: 2px; font-size: 13px; color: rgba(255, 255, 255, 0.6); font-variant-numeric: tabular-nums; }
.campanel .sub:empty { display: none; }
.campanel .acts { display: flex; gap: 6px; flex: none; }
.campanel .acts button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 20px; background: var(--row); color: var(--ink); cursor: pointer; }
.campanel .acts button[hidden] { display: none; }
.campanel .acts svg { width: 18px; height: 18px; }
.narrow .campanel { left: 8px; right: 8px; width: auto; max-width: none; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
:host([hero]) .campanel { left: 8px; right: 8px; bottom: 8px; width: auto; max-width: 420px; }
:host([hero]) .campanel .pic { aspect-ratio: auto; height: min(236px, calc(var(--house3d-height, 480px) - 150px)); }
@media (prefers-reduced-transparency: reduce) {
  .bar, .sheet, .campanel { background: rgba(26, 30, 42, 0.97); -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

// the helpers above are imported by the Node tests, where there is no DOM to define the card in
const Base = typeof HTMLElement === 'function' ? HTMLElement : class {};

export class House3dCard extends Base {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._states = new Map();
    this._room = null;
    this._style = readStyle();
    this._heroLayers = {};
    this._time = null; // null: live
  }

  setConfig(config) {
    if (!config || !config.model || !Array.isArray(config.model.walls)) throw new Error('house3d-card: config.model with walls is required');
    const hero = !!heroSize(config).height;
    const heroChanged = this._config && hero !== this._isHero;
    const changed = this._config && (heroChanged || this._config.model !== config.model || this._config.language !== config.language || this._config.full_view !== config.full_view);
    this._config = config;
    this._lang = langOf(config.language);
    this._t = TEXT[this._lang];
    // a custom property, not the inline height _fit() clears outside a panel view
    this._hero = heroSize(config);
    // a stretched hero keeps its height through a config update with the same box
    const box = stretchBox(config);
    if (box !== this._box) { this._box = box; this._stretched = null; }
    if (this._hero.height) this.style.setProperty('--house3d-height', `${this._stretched || this._box || this._hero.height}px`);
    else this.style.removeProperty('--house3d-height');
    this.toggleAttribute('hero', !!this._hero.height);
    this._isHero = hero;
    this._style = heroMount(hero, heroChanged ? readStyle() : this._style).style;
    this._devices = config.model.devices || [];
    this._car = config.model.car && config.model.car.profile && config.model.car.path ? config.model.car : null;
    // another model starts from its own home view; another language, a hero or full_view redraws the card
    if (changed) { this._unmount(); this._states.clear(); this._keep = null; }
    this._render();
    this._queueStretch();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._view) return;
    if (!this._sunSet) this._applySun(hass);
    // the first push after mount always runs, so entities missing from HA still show dimmed
    let changed = !this._pushed;
    for (const d of this._devices) {
      const st = hass.states[d.entity];
      if (this._states.get(d.entity) !== st) { this._states.set(d.entity, st); changed = true; }
    }
    const carEntity = this._car && this._car.entity;
    if (carEntity && this._carSt !== hass.states[carEntity]) { this._carSt = hass.states[carEntity]; changed = true; }
    if (changed) this._push();
  }
  get hass() { return this._hass; }

  // panel views set isPanel; the card then fills the screen below its own top edge. HA's header
  // height varies (view tabs, the phone's safe area), so it is measured rather than assumed,
  // which kept the bottom button bar off screen in the phone app.
  set isPanel(v) { this.toggleAttribute('panel', !!v); this._fit(); }
  _fit() {
    if (!this.hasAttribute('panel') || !this.isConnected) { this.style.height = ''; return; }
    const vh = viewHeight();
    const top = Math.max(0, this.getBoundingClientRect().top);
    this.style.height = `${Math.max(320, Math.floor(vh - top))}px`;
  }
  getCardSize() { return (this._hero || heroSize(this._config)).rows; }
  // a stretching hero sets its own height, so the grid must not fix it
  getGridOptions() {
    return { columns: 'full', rows: stretchBox(this._config) ? 'auto' : (this._hero || heroSize(this._config)).rows };
  }

  // the hero's `.section` in hui-sections-view's `.content` (HA 2026.11), or null
  _section() {
    for (let n = this.parentNode || this.host; n; n = n.parentNode || n.host) {
      if (n.classList && n.classList.contains('section') && n.parentElement && n.parentElement.classList.contains('content')) return n;
    }
    return null;
  }
  _queueStretch() {
    if (this._box && !this._stretchFrame) this._stretchFrame = requestAnimationFrame(() => this._stretch());
  }
  _stretch() {
    this._stretchFrame = 0;
    if (!this._box || !this.isConnected) return;
    const sec = this._section();
    let h = this._box;
    if (sec) {
      const others = [...sec.parentElement.children].filter(s => s !== sec && s.classList.contains('section'));
      if (sec !== this._stretchSec && typeof ResizeObserver === 'function') {
        if (this._stretchRo) this._stretchRo.disconnect();
        this._stretchRo = new ResizeObserver(() => this._queueStretch());
        [sec, ...others].forEach(s => this._stretchRo.observe(s));
        this._stretchSec = sec;
      }
      const y = window.scrollY;
      const page = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top + y, bottom: r.bottom + y }; };
      const own = page(sec);
      const beside = besideBottoms(own, others.map(page), this._config.stretch);
      // 24 px: the view's own bottom padding
      h = stretchHeight({ min: this._box, top: own.top, rest: own.bottom - own.top - this.getBoundingClientRect().height, beside, bottom: viewHeight() - 24 });
    }
    if (h !== this._stretched) { this._stretched = h; this.style.setProperty('--house3d-height', `${h}px`); }
  }

  connectedCallback() {
    this._onResize = this._onResize || (() => { this._fit(); this._queueStretch(); });
    // only an Escape from the card or the bare page: one in HA's more-info dialog closes the dialog alone
    this._onKey = this._onKey || (ev => {
      const from = ev.composedPath()[0];
      if (ev.key === 'Escape' && this._sheet && (ev.composedPath().includes(this) || from === document.body || from === document.documentElement)) this._closeAny();
    });
    // back on a hidden tab, an open camera's still is fetched at once
    this._onVisible = this._onVisible || (() => { if (this._cam) this._runStill(); });
    document.addEventListener('visibilitychange', this._onVisible);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKey);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize);
    requestAnimationFrame(this._onResize);
    this._render();
  }
  // leaving the view and coming back (HA disconnects the card) starts from the same camera and roof
  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._onVisible);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onResize);
    if (this._stretchRo) { this._stretchRo.disconnect(); this._stretchRo = null; this._stretchSec = null; }
    if (this._stretchFrame) { cancelAnimationFrame(this._stretchFrame); this._stretchFrame = 0; }
    if (this._view && !this._view.failed) this._keep = { mode: this._view.mode, view: this._view.view };
    this._unmount();
  }

  // removed after its fade by a timer, since under reduced motion no transitionend comes
  _unveil() {
    const sr = this.shadowRoot, view = sr.querySelector('.view'), img = sr.querySelector('.poster');
    if (view) view.classList.remove('loading');
    if (!img) return;
    img.classList.add('gone');
    setTimeout(() => img.remove(), 400);
  }
  _savePoster() {
    if (!this._posterDue || !this._view) return;
    this._posterDue = false;
    const url = this._view.snapshot(POSTER_W);
    if (url) writePoster(posterKey(this._isHero, this._style), url);
  }

  _unmount() {
    this._stopStill();
    this._glowTick(false);
    if (this._seasonTimer) { clearInterval(this._seasonTimer); this._seasonTimer = null; }
    if (this._view) { this._view.dispose(); this._view = null; }
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    this._mounting = null;
    this._pushed = false;
    this._carSt = undefined;
    this._carHome = undefined;
  }

  _render() {
    if (!this._config || !this.isConnected || this._view || this._mounting) return;
    const sr = this.shadowRoot, t = this._t;
    // a hero is the page's picture: its corner buttons, the view's controls in its sheet
    // a remount (a new style, a scene) swaps the canvas in place, as it carries the view over
    const fresh = !this._keep, poster = fresh && readPoster(posterKey(this._isHero, this._style));
    // a hero's expand button opens the dashboard's own 3D view (`full_view`): the browser's
    // fullscreen is no use, as an iPhone grants it to a video only
    const full = this._isHero && typeof this._config.full_view === 'string' && this._config.full_view ? this._config.full_view : null;
    sr.innerHTML = `<style>${STYLE}</style><ha-card class="wrap${full ? ' to-full' : ''}"><div class="view${fresh && !poster ? ' loading' : ''}"></div>${poster ? `<img class="poster" alt="" src="${esc(poster)}">` : ''}
      <div class="bar">${this._isHero ? '' : `${this._modeSeg('roof')}
        <button type="button" class="icon-btn" data-act="reset" aria-label="${t.resetView}" title="${t.resetView}"></button>`}${full ? `
        <button type="button" class="icon-btn" data-act="full" aria-label="${t.fullView}" title="${t.fullView}"></button>` : ''}
        <button type="button" class="icon-btn" data-act="layers" aria-label="${this._isHero ? t.view : t.layersTitle}" title="${this._isHero ? t.view : t.layersTitle}" aria-expanded="false"></button></div>
      <aside class="sheet" hidden aria-live="polite"></aside><section class="campanel" hidden></section>${this._credit()}</ha-card>`;
    this._sheet = null;
    this._cam = null;
    const wrap = sr.querySelector('.wrap');
    // a hero lets the wheel scroll the page, where OrbitControls on the canvas would zoom the house
    wrap.addEventListener('wheel', ev => { if (this.hasAttribute('hero') && !this.hasAttribute('panel')) ev.stopPropagation(); }, { capture: true });
    if (this._ro) this._ro.disconnect();
    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => wrap.classList.toggle('narrow', wrap.clientWidth < 600));
      this._ro.observe(wrap);
    }
    const token = (this._mounting = {});
    const keep = this._keep || {};
    loadEngine().then(mod => {
      if (this._mounting !== token || !this.isConnected) return;
      this._mounting = null;
      this._keep = null;
      this._mod = mod;
      this._posterDue = fresh && !this._time && this._sceneTime === undefined;
      const now = new Date();
      this._season = mod.seasonOn(now);
      const start = heroMount(this._isHero, this._style, resolveLayers(this._readLayers(), mod.seasonWindow(now)), { [SEASONAL]: this._season });
      const reset = sr.querySelector('.bar [data-act="reset"]');
      if (reset) reset.innerHTML = mod.icon('reset');
      const expand = sr.querySelector('.bar [data-act="full"]');
      if (expand) expand.innerHTML = mod.icon('expand');
      sr.querySelector('[data-act="layers"]').innerHTML = mod.icon('layers');
      this._view = mod.mount(sr.querySelector('.view'), this._config.model, {
        onMarker: id => this._open(id),
        // a tap on empty space closes either sheet
        onRoom: id => (id || this._sheet !== 'layers' ? this._openRoom(id) : this._closeSheet()),
        onMode: m => {
          sr.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
          // the roof going on closes a room sheet; a future item's and a camera's stay
          if (m === 'roof' && this._sheet !== 'feature' && this._sheet !== 'camera') this._openRoom(null);
        },
        onFeature: id => this._openFeature(id),
        // the sun moves on once a minute and with the sliders; an open PV sheet follows it
        onSun: sun => { if (this._view && this._sheet === 'feature') this._renderPv(sun); },
        onFirstFrame: () => this._unveil(),
        onIdle: () => this._savePoster(),
        layers: start.layers,
        snowfall: start.snowfall,
        ao: start.ao,
        style: this._style,
        mode: keep.mode,
        view: keep.view,
        car: this._car ? { profile: this._car.profile, path: this._car.path } : undefined,
        surroundings: this._config.model.surroundings,
        // a tap on the car replays the drive-in; the stored arrival stays as it is
        onCar: () => { if (this._carHome) this._view.setCar('arrive'); },
        noWebGL: t.noWebGL
      });
      if (this._view.failed) this._unveil();
      this._seasonTimer = setInterval(() => this._checkSeason(), 60000);
      sr.querySelector('.bar').addEventListener('click', ev => {
        const mode = ev.target.closest('[data-mode]');
        if (mode) this._view.setMode(mode.dataset.mode);
        else if (ev.target.closest('[data-act="reset"]')) this._view.reset();
        else if (ev.target.closest('[data-act="full"]')) this._navigate(full);
      });
      sr.querySelector('[data-act="layers"]').addEventListener('click', () => (this._sheet === 'layers' ? this._closeSheet() : this._openLayers()));
      sr.querySelector('.sheet').addEventListener('click', ev => {
        const mode = ev.target.closest('[data-mode]');
        if (mode) return this._view.setMode(mode.dataset.mode);
        if (ev.target.closest('[data-act="reset"]')) return this._view.reset();
        const row = ev.target.closest('[data-entity]');
        if (row) return this._open(row.dataset.entity);
        const sw = ev.target.closest('[data-layer]');
        if (sw) return this._switchLayer(sw.dataset.layer, sw.getAttribute('aria-checked') !== 'true');
        const st = ev.target.closest('[data-style]');
        if (st) return this._restyle(st.dataset.style);
        if (ev.target.closest('[data-act="now"]')) {
          this._setTime(null);
          // the simple style shows the button only while a slider time is kept
          return !this._lit() ? this._openLayers() : undefined;
        }
        if (ev.target.closest('[data-act="close"]')) return this._sheet === 'layers' ? this._closeSheet() : this._openRoom(null);
      });
      sr.querySelector('.campanel').addEventListener('click', ev => {
        const b = ev.target.closest('[data-cam]'), cam = this._cam;
        if (!b || !cam) return;
        const step = { prev: -1, next: 1 }[b.dataset.cam], i = cam.ring.indexOf(cam.id), n = cam.ring.length;
        if (step) this._openCamera(cam.ring[(i + step + n) % n], cam.ring);
        else if (b.dataset.cam === 'full') this._go(cam.id);
        else this._closeCamera();
      });
      sr.querySelector('.sheet').addEventListener('input', ev => { if (ev.target.closest('[data-time]')) this._setTime(this._sliderTime()); });
      this._states.clear();
      this._pushed = false;
      this._carSt = undefined;
      this._carHome = undefined;
      this._sunSet = false;
      if (this._time) this._view.setTime(this._time);
      if (this._hass) this.hass = this._hass;
      if (keep.layers) this._openLayers();
      if (keep.camera) this._openCamera(keep.camera.id, keep.camera.ring);
    }).catch(err => {
      // a newer render or a disconnect owns the card now; a mount that threw has cleared the token
      if ((this._mounting && this._mounting !== token) || !this.isConnected) return;
      this._mounting = null;
      this._unveil();
      sr.querySelector('.view').innerHTML = `<div class="msg"><span>${t.loadFailed}</span>
        <button type="button" class="now" data-act="retry">${t.retry}</button><small>${esc(err && err.message || err)}</small></div>`;
      sr.querySelector('[data-act="retry"]').addEventListener('click', () => this._render());
    });
  }

  // a new style remounts the engine; the mode, the camera, the time and the open Kihid sheet carry over
  _restyle(style) {
    // during a scene, picking the style it shows is still the visitor's choice for clearScene()
    if (style === this._style && this._sceneTime !== undefined) writeStyle(style);
    if (style === this._style || !this._view) return;
    this._style = style;
    writeStyle(style);
    this._remount();
  }

  // setScene({ style, time }): a page's scene (the demo's scenarios) shows a style and a fixed
  // instant for a while, before the engine mounts too. The style is not stored, so clearScene()
  // goes back to the visitor's own; a call with a time only moves the sky without a remount.
  setScene({ style, time } = {}) {
    const at = time ? new Date(time) : null;
    this._sceneTime = at;
    if (style) style = heroMount(this._isHero, style).style;
    if (!style || style === this._style) return this._setTime(at);
    this._style = style;
    this._time = at;
    this._remount();
  }

  // the stored style and the live time again; a style or time the visitor picked during the scene
  // stays, as their own choice
  clearScene() {
    if (this._sceneTime === undefined) return;
    const live = this._time === this._sceneTime;
    this._sceneTime = undefined;
    const style = heroMount(this._isHero, readStyle()).style;
    if (style === this._style) return live ? this._setTime(null) : undefined;
    this._style = style;
    if (live) this._time = null;
    this._remount();
  }

  _readLayers() {
    return this._isHero ? this._heroLayers : readLayers();
  }

  _writeLayers(layers) {
    if (this._isHero) this._heroLayers = layers;
    else writeLayers(layers);
  }

  _remount() {
    if (this._view) this._keep = { mode: this._view.mode, view: this._view.view, layers: this._sheet === 'layers', camera: this._cam };
    this._unmount();
    this._render();
  }

  // the sun needs the house's place: HA's location and the model's grid bearing; without any of
  // them a lit style keeps its fixed sun
  _applySun(hass) {
    const c = hass.config || {}, geo = this._config.model.georef || {};
    const place = { lat: num(c.latitude), lon: num(c.longitude), bearing: num(geo.x_axis_bearing_deg) };
    if (place.lat === null || place.lon === null || place.bearing === null) return;
    this._view.setSun(place);
    this._sunSet = true;
  }

  // a lit style (Päris, Foto) has the sun, its time sliders and a night; asked once the engine is in
  _lit() {
    return this._mod.resolveStyle({ style: this._style }).lit;
  }

  _sliderTime() {
    const sr = this.shadowRoot;
    const q = Number(sr.querySelector('[data-time="hour"]').value), d = Number(sr.querySelector('[data-time="day"]').value);
    return new Date(yearStart().getFullYear(), 0, 1 + d, 0, q * 15);
  }

  _setTime(t) {
    this._time = t;
    if (this._view) this._view.setTime(t);
    this._syncTime();
  }

  // the sliders show the time in use; live, they jump to now and the hour shows to the minute
  _syncTime() {
    const sr = this.shadowRoot, hour = sr.querySelector('[data-time="hour"]'), day = sr.querySelector('[data-time="day"]');
    if (!hour || !day) return;
    const now = new Date(), at = this._time || now;
    hour.value = String(at.getHours() * 4 + Math.floor(at.getMinutes() / 15));
    day.value = String(dayOfYear(at));
    sr.querySelector('[data-out="hour"]').textContent = this._time ? hourText(Number(hour.value)) : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    sr.querySelector('[data-out="day"]').textContent = formatsFor(this._lang).dayFmt.format(dayDate(Number(day.value)));
    sr.querySelector('[data-act="now"]').setAttribute('aria-pressed', String(!this._time));
  }

  _timeRows() {
    const days = Math.round((new Date(yearStart().getFullYear() + 1, 0, 1) - yearStart()) / 86400000), t = this._t;
    return `<div class="slider"><div class="row"><label for="h3d-hour">${t.time}</label><output data-out="hour"></output></div>
        <input id="h3d-hour" type="range" min="0" max="96" step="1" data-time="hour"></div>
      <div class="slider"><div class="row"><label for="h3d-day">${t.date}</label><output data-out="day"></output></div>
        <input id="h3d-day" type="range" min="0" max="${days - 1}" step="1" data-time="day"></div>
      <button type="button" class="now" data-act="now" aria-pressed="true">${t.now}</button>`;
  }

  // the licence asks for the licensor, the dataset and its date; the bottom corners hold the
  // phone's button bar, so the line sits top left. Only ETAK data is credited: a made-up
  // surroundings layer (the demo's test house) names no licensor.
  _credit() {
    const sur = this._config.model.surroundings;
    if (!sur || !String(sur.source || '').startsWith('ETAK,')) return '';
    const d = /(\d{4})-(\d{2})-(\d{2})/.exec(sur.source || '');
    return `<div class="credit">${this._t.credit}${d ? `, ${d[3]}.${d[2]}.${d[1]}` : ''}</div>`;
  }

  _push() {
    this._pushed = true;
    const now = new Date();
    // the state goes into the marker's accessible name; toMarker has no hass to format it
    const markers = this._devices.map(d => {
      const st = this._states.get(d.entity);
      return { ...toMarker(d, st, now, this._lang), stateText: this._stateText(st) };
    });
    this._view.setMarkers(markers);
    // a motion glow goes out with no state change, so the markers are pushed again once a minute
    this._glowTick(markers.some(m => m.glow));
    this._view.setRoomChips(roomChips(markers, this._config.model.rooms || [], this._lang));
    this._pushCar();
    if (this._sheet === 'room') this._refreshRoom();
    else if (this._sheet === 'layers') { this._renderLayers(); this._syncTime(); }
  }

  _glowTick(on) {
    if (on && !this._glowTimer) this._glowTimer = setInterval(() => { if (this._view) this._push(); }, 60000);
    else if (!on && this._glowTimer) { clearInterval(this._glowTimer); this._glowTimer = null; }
  }

  // acts only when home/away changes, so attribute updates (a new location) never replay the drive-in
  _pushCar() {
    const car = this._car;
    if (!car) return;
    const st = car.entity ? this._carSt : undefined;
    const first = this._carHome === undefined, was = this._carHome;
    const now = carHome(st);
    // unavailable and unknown keep the last known value; on the first push they count as away
    const home = now === null ? !!was : now;
    this._carHome = home;
    if (!first && home === was) return;
    if (!home) return this._view.setCar('away');
    const key = arrivalKey(st);
    if (key === null) return this._view.setCar('parked');
    // also on a later push: an outage seen as away must not replay an arrival this browser saw
    if (readSeen(car.entity) === key) return this._view.setCar('parked');
    writeSeen(car.entity, key);
    this._view.setCar('arrive');
  }

  // update the open sheet's rows in place: replacing them would drop focus and a tap in progress
  _refreshRoom() {
    this.shadowRoot.querySelectorAll('.sheet [data-entity]').forEach(row => {
      const d = this._devices.find(x => x.entity === row.dataset.entity);
      const st = this._states.get(d.entity);
      row.className = toMarker(d, st).state;
      row.querySelector('.st').textContent = this._stateText(st);
    });
  }

  // a camera opens its picture over the view, its arrows walking cameraRing(); anything else goes
  // where _go() sends it
  _open(entityId) {
    if (entityId.startsWith('camera.') && this._ring(entityId).length) this._openCamera(entityId);
    else this._go(entityId);
  }

  // config.views maps an entity to the view it opens instead of more-info: a camera's full screen
  _go(entityId) {
    const path = (this._config.views || {})[entityId];
    if (path) this._navigate(path);
    else this._moreInfo(entityId);
  }

  // the cameras the panel's arrows walk from id, round this house's middle
  _ring(id) {
    return cameraRing(this._devices, id, houseCentre(this._config.model.rooms));
  }

  // a camera's picture over the view: config.stills maps it to the entity its still comes from
  // (the substream, ADR-016), fetched now and every CAM_STILL_MS while the tab shows; ring is the
  // order the arrows walk, kept while they walk it. One panel or sheet is open at a time, and the
  // camera's marker is the engine's selection, which replaces a room's focus.
  _openCamera(id, ring = this._ring(id)) {
    if (!this._view || !this._mod || !ring.length) return;
    const sec = this.shadowRoot.querySelector('.campanel');
    // an arrow's step keeps the panel and its buttons, so keyboard focus stays on the arrow
    if (this._sheet !== 'camera') {
      this._closeAny();
      const t = this._t, mod = this._mod;
      const btn = (act, label, svg) => `<button type="button" data-cam="${act}" aria-label="${label}" title="${label}">${svg}</button>`;
      sec.innerHTML = `<div class="pic"><img alt=""><div class="ph">${t.noStill}</div></div>
        <div class="foot"><div class="txt"><div class="nm"></div><div class="sub"></div></div>
          <div class="acts">${btn('prev', t.prevCamera, PREV)}${btn('next', t.nextCamera, NEXT)}${btn('full', t.fullScreen, mod.icon('expand'))}${btn('close', t.close, mod.icon('close'))}</div></div>`;
      sec.hidden = false;
    }
    this._cam = { id, ring, loading: 0, shown: false };
    this._sheet = 'camera';
    this._view.setSelection(id);
    const d = this._devices.find(x => x.entity === id), name = d.name || id, pic = sec.querySelector('.pic');
    sec.setAttribute('aria-label', name);
    sec.querySelector('.nm').textContent = name;
    sec.querySelector('.sub').textContent = '';
    sec.querySelectorAll('[data-cam="prev"], [data-cam="next"]').forEach(b => { b.hidden = ring.length < 2; });
    pic.className = 'pic';
    pic.querySelector('img').replaceWith(Object.assign(document.createElement('img'), { alt: '' }));
    this._runStill();
  }

  // a still now and every CAM_STILL_MS while the tab shows; a hidden tab stops the timer and
  // showing again starts it afresh, so no load follows another a moment later
  _runStill() {
    this._stopStill();
    if (document.visibilityState !== 'visible') return;
    this._loadStill();
    this._camTimer = setInterval(() => this._loadStill(), CAM_STILL_MS);
  }

  // the still loads into its own Image and replaces the shown one only once decoded, so a failure
  // keeps the last good one, dimmed as stale; with none yet, or no picture in the state, the panel
  // says so. The URL is read from the state at each load, as its token rotates. A load that has
  // not finished in CAM_STALL_MS no longer holds the next one back.
  _loadStill() {
    const cam = this._cam, now = Date.now();
    if (!cam || !this._hass || (cam.loading && now - cam.loading < CAM_STALL_MS)) return;
    const pic = () => this._cam === cam && this.shadowRoot.querySelector('.campanel .pic');
    const url = cameraStillUrl(this._hass.states[(this._config.stills || {})[cam.id] || cam.id], now);
    if (!url) { if (pic()) pic().className = cam.shown ? 'pic stale' : 'pic none'; return; }
    cam.loading = now;
    const img = new Image();
    img.alt = '';
    img.src = url;
    // decoded before the swap, so a large still does not stall the frame that shows it
    img.decode().then(() => {
      const el = pic();
      if (!el) return;
      el.querySelector('img').replaceWith(img);
      el.className = 'pic';
      cam.shown = true;
      el.closest('.campanel').querySelector('.sub').textContent = this._t.stillAt(clockIn(new Date(), this._lang, (this._hass.config || {}).time_zone));
    }, () => {
      if (pic()) pic().className = cam.shown ? 'pic stale' : 'pic none';
    }).finally(() => { if (cam.loading === now) cam.loading = 0; });
  }

  _stopStill() {
    if (this._camTimer) { clearInterval(this._camTimer); this._camTimer = null; }
  }

  _closeCamera() {
    this._stopStill();
    this._cam = null;
    if (this._sheet === 'camera') this._sheet = null;
    const sec = this.shadowRoot.querySelector('.campanel');
    if (!sec) return;
    // focus on the panel goes back to the bar, not to the page
    const focused = sec.contains(this.shadowRoot.activeElement);
    sec.hidden = true;
    sec.innerHTML = '';
    if (this._view) this._view.setSelection(null);
    if (focused) this.shadowRoot.querySelector('[data-act="layers"]').focus();
  }

  _navigate(path) {
    this.dispatchEvent(new CustomEvent('hass-action', { detail: { action: 'tap', config: { tap_action: { action: 'navigate', navigation_path: path } } }, bubbles: true, composed: true }));
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  _stateText(st) {
    if (!st) return this._t.missing;
    if (this._hass && typeof this._hass.formatEntityState === 'function') return this._hass.formatEntityState(st);
    return st.state;
  }

  _closeAny() {
    if (this._sheet === 'layers') this._closeSheet();
    else if (this._sheet === 'camera') this._closeCamera();
    else this._openRoom(null);
  }

  _closeSheet() {
    const sheet = this.shadowRoot.querySelector('.sheet');
    this._sheet = null;
    sheet.hidden = true;
    sheet.innerHTML = '';
    this.shadowRoot.querySelector('[data-act="layers"]').setAttribute('aria-expanded', 'false');
  }

  // a room sheet and Kihid replace each other; a tap on empty space and the roof going on close
  // only a room sheet
  _openRoom(id) {
    if (this._sheet === 'camera') this._closeCamera();
    const sheet = this.shadowRoot.querySelector('.sheet');
    const room = id && this._config.model.rooms.find(r => r.id === id);
    if (!room && this._sheet === 'layers') return;
    this._room = room ? id : null;
    // the camera moves in on an opened room and stays where it is when the sheet closes
    if (this._view) this._view.focusRoom(this._room);
    if (!room) return this._closeSheet();
    this.shadowRoot.querySelector('[data-act="layers"]').setAttribute('aria-expanded', 'false');
    const mod = this._mod;
    const devs = this._devices.filter(d => d.room === id);
    const rows = devs.map(d => {
      const st = this._states.get(d.entity), m = toMarker(d, st);
      return `<button type="button" data-entity="${esc(d.entity)}" class="${m.state}">${mod.icon(d.type)}<span>${esc(d.name)}</span><span class="st">${esc(this._stateText(st))}</span></button>`;
    }).join('');
    const t = this._t;
    sheet.innerHTML = `<div class="head"><div><h2>${esc(room.name)}</h2><p>${esc(t.onPlan(room.no, formatsFor(this._lang).nf1.format(mod.roomArea(room))))}</p></div>
      <button type="button" class="close" data-act="close" aria-label="${t.close}">${mod.icon('close')}</button></div>
      ${rows ? `<div class="list">${rows}</div>` : `<div class="empty">${t.noDevices}</div>`}`;
    sheet.hidden = false;
    this._sheet = 'room';
  }

  // a future item's sheet: its facts, and for PV the clear-sky estimate at the sun's time
  _openFeature(id) {
    const fut = this._config.model.future || {}, item = (fut.items || []).find(it => it.id === id);
    if (!item || !this._mod) return;
    if (this._sheet === 'camera') this._closeCamera();
    const sheet = this.shadowRoot.querySelector('.sheet');
    this._room = null;
    if (this._view) this._view.focusRoom(null);
    this._feature = item;
    const t = featureText(item, fut.as_of, null, this._lang);
    sheet.innerHTML = `<div class="head"><div><h2>${esc(t.title)}</h2><p>${esc(t.sub)}</p></div>
      <button type="button" class="close" data-act="close" aria-label="${this._t.close}">${this._mod.icon('close')}</button></div>
      <p class="pv" hidden></p>
      ${t.facts.length ? `<ul class="facts">${t.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : `<div class="empty">${esc(t.empty)}</div>`}`;
    this._sheet = 'feature';
    this.shadowRoot.querySelector('[data-act="layers"]').setAttribute('aria-expanded', 'false');
    sheet.hidden = false;
    this._renderPv(this._view ? this._view.sun : null);
  }

  // the PV line, left out without a sun (no place) or for another kind
  _renderPv(sun) {
    const el = this.shadowRoot.querySelector('.sheet .pv'), item = this._feature, mod = this._mod;
    if (!el || !item) return;
    const roofs = this._config.model.roofs || {};
    if (item.kind !== 'pv' || !sun || !roofs[item.roof] || !(item.kwp > 0)) { el.hidden = true; return; }
    const kw = mod.pvNow(item.kwp, mod.roofNormal(this._config.model, item.roof, item.pos), sun);
    el.textContent = featureText(item, null, { kw, alt: sun.alt, time: sun.time, live: !this._time }, this._lang).pv;
    el.hidden = false;
  }

  // the roof on and off, pressed for mode
  _modeSeg(mode) {
    const t = this._t, b = (m, label) => `<button type="button" data-mode="${m}" aria-pressed="${mode === m}">${label}</button>`;
    return `<div class="seg" role="group" aria-label="${t.view}">${b('roof', t.roof)}${b('open', t.open)}</div>`;
  }

  _openLayers() {
    if (this._sheet === 'camera') this._closeCamera();
    const sheet = this.shadowRoot.querySelector('.sheet');
    this._room = null;
    if (this._view) this._view.focusRoom(null);
    const t = this._t;
    sheet.innerHTML = `<div class="head"><div><h2>${this._isHero ? t.view : t.layersTitle}</h2></div>
      <button type="button" class="close" data-act="close" aria-label="${t.close}">${this._mod.icon('close')}</button></div>
      ${this._isHero ? `<div class="row">${this._modeSeg(this._view.mode)}<button type="button" class="now" data-act="reset">${t.resetView}</button></div>` : `<div class="row"><span>${t.style}</span><div class="seg" role="group" aria-label="${t.style}">
        ${STYLES.map(s => `<button type="button" data-style="${s}" aria-pressed="${this._style === s}">${t[s]}</button>`).join('')}</div></div>`}
      ${this._lit() ? this._timeRows() : this._time ? `<button type="button" class="now" data-act="now" aria-pressed="false">${t.now}</button>` : ''}
      <div class="list switches"></div>`;
    this._sheet = 'layers';
    this._syncTime();
    this._renderLayers();
    sheet.hidden = false;
    this.shadowRoot.querySelector('[data-act="layers"]').setAttribute('aria-expanded', 'true');
  }

  // rows are replaced only when the set of layers changes, so a switch keeps its focus
  _renderLayers() {
    const list = this.shadowRoot.querySelector('.sheet .switches');
    if (!list || !this._view) return;
    const rank = id => (LAYER_ORDER.includes(id) ? LAYER_ORDER.indexOf(id) : LAYER_ORDER.length);
    const layers = [...this._view.layers].sort((a, b) => rank(a.id) - rank(b.id));
    const ids = layers.map(l => l.id).join(' ');
    if (list.dataset.ids !== ids || !layers.length) {
      list.dataset.ids = ids;
      list.innerHTML = layers.length ? layers.map(l => `<button type="button" role="switch" data-layer="${esc(l.id)}" aria-checked="${l.on}">
        <span>${esc(this._t.layers[l.id] || l.id)}</span><span class="sw" aria-hidden="true"></span></button>`).join('')
        : `<div class="empty">${this._t.noLayers}</div>`;
      return;
    }
    list.querySelectorAll('[data-layer]').forEach((row, i) => row.setAttribute('aria-checked', String(layers[i].on)));
  }

  _switchLayer(id, on) {
    this._view.setLayer(id, on);
    this._writeLayers(storeLayer(this._readLayers(), id, on, this._mod.seasonWindow(new Date())));
    this._renderLayers();
  }

  // once a minute while mounted: a season that starts or ends (a tablet mounted on 31 October)
  // switches its layer to the new default, unless a switch flipped in the new window holds it
  _checkSeason(now = new Date()) {
    if (!this._view || !this._mod) return;
    const on = this._mod.seasonOn(now);
    if (on === this._season) return;
    this._season = on;
    if (SEASONAL in resolveLayers(this._readLayers(), this._mod.seasonWindow(now))) return;
    this._view.setLayer(SEASONAL, on);
    if (this._sheet === 'layers') this._renderLayers();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('house3d-card')) {
  customElements.define('house3d-card', House3dCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'house3d-card', name: 'House 3D', description: 'The house as a 3D model with live device markers.' });
}
