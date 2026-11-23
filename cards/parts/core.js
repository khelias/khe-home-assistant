// Shared palettes (Kodu and A3 glass), actions, HA time-zone/date helpers, shared fetches and cells.
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ icon, esc, NO_VALUE, hasValue, stateOf, words, sensorWords, joinEt, formatNumber, withUnit, stateWord, num, rowTime, numOf, cap, unitOf, splitValue, valueText, fmtN } = {}) {
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
  function palette(dark) {
    const mode = dark ? 'dark' : 'light';
    return { ...PALETTES[mode], lit: LIT[mode], dark: !!dark };
  }

  // blue is the water pair: a shield reads as blue, not as a temperature
  const litPair = (pal, color) => pal.lit[color === 'blue' ? 'water' : color] || pal.lit.green;

  const cssVars = pal => `:host{${Object.entries(pal).filter(([, v]) => typeof v === 'string').map(([k, v]) => `--${k}:${v}`).join(';')}}`;

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

  function a3Palette(dark) {
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
  .cells button,.cells .cell{display:flex;flex-direction:column;gap:1px;min-width:0;min-height:44px}
  .cells .v{font-size:20px;font-weight:700;letter-spacing:-0.02em}
  .cells .v.bad{color:var(--high)}
  .cells .v.good{color:var(--good)}
  .step{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .step .t{display:flex;flex-direction:column;gap:1px;min-width:0}
  .step .nm{font-size:15px;font-weight:600}
  .step .err{color:var(--high);font-weight:600}
  .stp{flex:none;display:flex;align-items:center;gap:2px;padding:2px;border-radius:12px;background:var(--seg)}
  .stp button{width:44px;height:40px;border-radius:10px;font-size:20px;font-weight:600;text-align:center}
  .stp button:disabled{opacity:.35;cursor:default}
  .stp .sv{min-width:46px;height:40px;border-radius:10px;background:var(--segOn);box-shadow:var(--segShadow);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
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

  // a chart's key: [swatch markup, text] pairs
  const chartKey = (...items) => `<span class="key">${items.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</span>`;

  // a chart key's colour square
  const swatch = (bg, op = 1) => `<i style="width:10px;height:10px;border-radius:3px;background:${bg}${op !== 1 ? `;opacity:${op}` : ''}"></i>`;

  const GRAY = A3_COLORS.gray[0];

  // The hass-action event detail HA's handleAction takes (frontend src/state/action-mixin.ts):
  // it reads config.tap_action for action 'tap' and config.entity for more-info and toggle.
  const acting = a => !!a && a.action !== 'none';

  function actionDetail(entity, tapAction) {
    if (!acting(tapAction)) return null;
    return { config: { ...(entity ? { entity } : {}), tap_action: tapAction }, action: 'tap' };
  }

  // a link to another view; none when the config names no path
  const navigate = path => (path ? actionDetail(null, { action: 'navigate', navigation_path: path }) : null);

  // a tile's body or icon tap; the icon does what the body does unless told otherwise
  function tileAction(conf, which = 'tap') {
    const body = conf.tap_action || { action: 'more-info' };
    return actionDetail(conf.entity, which === 'icon' && conf.icon_tap_action ? conf.icon_tap_action : body);
  }

  // a mode button: its own tap_action (a command, never pressed), else nothing for the running mode
  // and select_option of the entity's domain (select or input_select) after its confirmation
  function modeAction(entity, mode, current) {
    if (mode && mode.tap_action) return actionDetail(entity, mode.tap_action);
    if (!mode || mode.option === current) return null;
    return actionDetail(entity, {
      action: 'perform-action',
      perform_action: `${entity.split('.')[0]}.select_option`,
      target: { entity_id: entity },
      data: { option: mode.option },
      ...(mode.confirm ? { confirmation: { text: mode.confirm } } : {})
    });
  }

  const HOUR = 3600e3, DAY = 24 * HOUR;

  const PRICE_SCALE = 0.32;

  // the generator passes the bands it also colours Energia's chart with
  const priceLevel = (t, [mid, high] = [0.15, 0.25]) => (t < mid ? 'cheap' : t < high ? 'mid' : 'high');

  // One bar per forecast hour from today's local midnight to tomorrow's end: 23, 24 or 25 a day
  // on DST days, tomorrow's once published. null when the forecast has no prices.
  function priceBars(prices, now = new Date(), bands) {
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

  // a price level's tone by the word the level sensor writes in that language
  const levelTone = (word, lang = 'et') => sensorWords(lang).tone[word] || 'mid';

  // a number from an attribute: HA's templates write Estonian ("116,34 €", "32,1 c/kWh"), a utility
  // meter a plain one ("42.589"); null for "-", empty or missing
  function parseEt(s) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : null;
    const m = /-?\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?/.exec(String(s ?? ''));
    return m ? Number(m[0].replace(/[ \u00a0]/g, '').replace(',', '.')) : null;
  }

  // { y, m, d, h, min, s } of a moment in a time zone
  const ZONE_FMT = new Map();

  function zoneParts(t, tz) {
    let f = ZONE_FMT.get(tz);
    if (!f) ZONE_FMT.set(tz, (f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })));
    const p = Object.fromEntries(f.formatToParts(new Date(t)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
  }

  const zoneOffset = (t, tz) => { const p = zoneParts(t, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000; };

  // the moment a calendar day starts in a time zone; d and m may run over (d 0 is the last of the
  // month before), as Date.UTC allows
  function dayStart(y, m, d, tz) {
    const guess = Date.UTC(y, m - 1, d);
    const t = guess - zoneOffset(guess, tz);
    return guess - zoneOffset(t, tz);
  }

  // [start, end) of the month a moment is in, in a time zone
  function monthSpan(t, tz) {
    const p = zoneParts(t, tz);
    return [dayStart(p.y, p.m, 1, tz), dayStart(p.y, p.m + 1, 1, tz)];
  }

  // the starts of the last `days` days to today, oldest first
  function dayStarts(days, now, tz) {
    const p = zoneParts(now, tz);
    return Array.from({ length: days }, (_, i) => dayStart(p.y, p.m, p.d - (days - 1) + i, tz));
  }

  const earlyInMonth = (now, tz) => zoneParts(now, tz).d <= 2;

  // "in <month>" of last month, by the month's number (1-12)
  const inLastMonth = (now, tz, lang = 'et') => words(lang).inMonth[(zoneParts(now, tz).m + 10) % 12];

  // 'kolmapäev 11.11' ('Wednesday 11/11') for a day's start in HA's zone
  // the weekday of a moment in a zone, 0 for Sunday
  const weekdayOf = (t, tz) => { const p = zoneParts(t, tz); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); };

  function dayName(t, tz, lang = 'et') {
    const p = zoneParts(t, tz), w = words(lang);
    return `${w.weekdays[weekdayOf(t, tz)]} ${w.dayMonth(p.d, p.m)}`;
  }

  const hh = n => String(n).padStart(2, '0');

  // an hour's price bar as the house says it: 'täna 18–19', 'homme 03–04'
  const hourSpan = (bar, lang = 'et') => { const h = new Date(bar.s).getHours(), w = words(lang); return `${bar.tomorrow ? w.tomorrow : w.today} ${hh(h)}–${hh((h + 1) % 24)}`; };

  // when a pointed history point was, in the browser's zone like the axis or in tz: an hour's bar or
  // a moment in the 24 h range, the hour in the week, the day in 30 or 90 days or a day's bar, the
  // month in 12 months
  function whenLabel(t, range, bars, now = Date.now(), lang = 'et', tz = localZone()) {
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
    const k = Math.round((date(now) - date(t)) / DAY), w = words(lang);
    return k === 0 ? w.today : k === 1 ? w.yesterday : null;
  }

  // the index of the point with a value nearest to t, null when none has one; on a stepped line the
  // value held at t, the last point at or before it (null before the first)
  function nearest(points, t, stepped = false) {
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
  function lastMonthName(now, tz, locale = 'et-EE') {
    const p = zoneParts(now, tz);
    return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: tz }).format(new Date(dayStart(p.y, p.m - 1, 15, tz)));
  }

  const hourOfDay = (t, tz) => hh(zoneParts(t, tz).h);

  const tzOf = hass => (hass && hass.config && hass.config.time_zone) || localZone();

  const hourKeyOf = (now, tz) => { const p = zoneParts(now, tz); return `${p.y}-${p.m}-${p.d}-${p.h}`; };

  // the minute key a history card redraws on, apart from the hour it loads on
  const minuteKeyOf = now => Math.floor(now / 60e3);

  // the start of the hour that holds `now` in a zone, which a half-hour zone puts at :30
  const hourStartIn = (now, tz) => { const p = zoneParts(now, tz); return now - (p.min * 60 + p.s) * 1000 - (now % 1000); };

  const clockAt = (t, tz) => { const p = zoneParts(t, tz); return `${hh(p.h)}:${hh(p.min)}`; };

  // a moment as a row or a note says it: the time today, the day word before it otherwise
  function shortWhen(t, now, lang = 'et', tz = localZone()) {
    const day = dayWord(t, now, lang, tz), at = clockAt(t, tz);
    return day === words(lang).today ? at : day ? `${day} ${at}` : whenText(new Date(t).toISOString(), lang, tz, now);
  }

  // how long ago, for the headline: minutes within the hour, else the moment
  function agoText(t, now, lang = 'et', tz = localZone()) {
    const m = Math.floor((now - t) / 60e3);
    return m < 60 ? words(lang).minAgo(Math.max(1, m)) : whenText(new Date(t).toISOString(), lang, tz, now);
  }

  // A moment as the house says it, in HA's zone: 'täna 14:19', 'eile 21:00', '20.09 kell 20:17'; a
  // time of day alone ('23:00:00', a time-only input_datetime) as '23:00'; '' without one
  function whenText(v, lang = 'et', tz = localZone(), now = Date.now()) {
    const s = String(v ?? '');
    const time = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(s);
    if (time) return `${time[1]}:${time[2]}`;
    // an input_datetime's date and time carry no offset: they are HA's wall clock
    const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(:\d{2})?$/.exec(s);
    const t = local ? dayStart(+local[1], +local[2], +local[3], tz) + (+local[4] * 60 + +local[5]) * 60e3 : Date.parse(s);
    if (!s || Number.isNaN(t)) return '';
    const p = zoneParts(t, tz), w = words(lang), at = `${hh(p.h)}:${hh(p.min)}`;
    const day = dayWord(t, now, lang, tz);
    return day ? `${day} ${at}` : `${w.dayMonth(p.d, hh(p.m))} ${w.at(at)}`;
  }

  const dateIn = (t, tz) => { const p = zoneParts(t, tz); return `${p.y}-${hh(p.m)}-${hh(p.d)}`; };

  // the WebSocket message for daily statistics of the last `days` days in HA's time zone
  function dailyRequest(ids, types, days, now, tz) {
    return { type: 'recorder/statistics_during_period', start_time: new Date(dayStarts(days, now, tz)[0]).toISOString(), statistic_ids: ids, period: 'day', types };
  }

  // the last `hours` whole hours of a statistic by the hour, by default an energy counter's last two
  // days for the data cutoff (from a whole hour, so one hour's requests are the same message and can
  // be shared)
  const hourlyRequest = (id, now, hours = 48, types = ['change']) => ({ type: 'recorder/statistics_during_period', start_time: new Date(Math.floor(now / HOUR) * HOUR - hours * HOUR).toISOString(), statistic_ids: [id], period: 'hour', types });

  // where a delayed counter's data ends: the end of its last hour with a value, or null
  function dataCutoff(resp, id) {
    const rows = ((resp || {})[id] || []).filter(r => num(r.change) !== null);
    return rows.length ? rows[rows.length - 1].start + HOUR : null;
  }

  // one point per day, oldest first: { t, label, v, max, late }; a day the response lacks is null, a
  // day that had not ended by a delayed counter's cutoff is late
  function dailySeries(resp, id, type, days, now, tz, cutoff = Infinity, lang = 'et') {
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
  function dayStats(points) {
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

  const dailyKey = types => `daily:${types.join(',')}`;

  const seriesTypes = s => (s.peak ? [s.type, 'max'] : [s.type]);

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

  const FRESH = 5 * 60e3;

  // the WebSocket message for the state history of many entities over the last 24 hours
  const stateHistoryRequest = (ids, now) => ({
    type: 'history/history_during_period', start_time: new Date(now - DAY).toISOString(), end_time: new Date(now).toISOString(),
    entity_ids: ids, minimal_response: true, no_attributes: true
  });

  // each entity's off-to-on changes in ms, oldest first; its first row is its state at the start of
  // the period, not an event, and a change from unavailable is none
  function onTimes(resp, ids) {
    const out = {};
    for (const id of ids) {
      const rows = (resp && resp[id]) || [], t = [];
      for (let i = 1; i < rows.length; i++) if (rows[i].s === 'on' && rows[i - 1].s === 'off') t.push(rowTime(rows[i]));
      out[id] = t;
    }
    return out;
  }

  // two lists of moments as one, oldest first, a moment in both (to the second) once
  function mergeTimes(a, b) {
    const seen = new Set(), out = [];
    for (const t of [...a, ...b].sort((x, y) => x - y)) {
      const k = Math.round(t / 1000);
      if (!seen.has(k)) { seen.add(k); out.push(t); }
    }
    return out;
  }

  // { entity: ms } of the entities that went from off to on between two hass states, at their
  // last_changed; none on the first states seen
  function liveOn(prev, states, ids) {
    const out = {};
    if (!prev) return out;
    for (const id of ids) {
      const p = prev[id], n = states[id];
      if (p && n && p !== n && p.state === 'off' && n.state === 'on') { const t = Date.parse(n.last_changed); if (Number.isFinite(t)) out[id] = t; }
    }
    return out;
  }

  // whether a history card's data is older than five minutes (it reloads when connected again)
  const historyStale = (data, now) => !!data && !data.error && now - data.now > FRESH;

  // 24 counts, one per hour of the zone, the last the hour now
  function hourlyCounts(times, now, tz) {
    const end = hourStartIn(now, tz) + HOUR, bins = new Array(24).fill(0);
    for (const t of times) {
      const i = 23 - Math.floor((end - 1 - t) / HOUR);
      if (i >= 0 && t <= now) bins[i] += 1;
    }
    return bins;
  }

  // the first hour of each bin as the zone's clock reads it
  const binHours = (now, tz) => { const end = hourStartIn(now, tz) + HOUR; return Array.from({ length: 24 }, (_, i) => hourOfDay(end - (24 - i) * HOUR, tz)); };

  // a state against a pattern: a `*` at the end matches a prefix, a `!` in front negates
  function stateIs(s, pattern) {
    const not = pattern.startsWith('!'), p = not ? pattern.slice(1) : pattern;
    const hit = p.endsWith('*') ? (s || '').startsWith(p.slice(0, -1)) : s === p;
    return not ? !hit : hit;
  }

  const faultsOn = (states, faults) => (faults || []).filter(f => { const st = states[f.entity]; return !!st && st.state === (f.bad ?? 'on'); });

  // the chips card's status line: { tone, text }; ok only while `entity` is on and every fault reads
  // off. With `above`, a number: above it the `on` text (tone 'on', a blue dot), at or below it `ok`.
  // With `map: [{ entities, state, text, tone }]`, the first rule one of whose entities is in its
  // state (a `*` ends a prefix) wins; tone ok, info (a blue dot) or bad. Faults win over all.
  function statusLine(states, conf, lang = 'et') {
    const s = conf.status, w = words(lang);
    if (!s) return null;
    const faults = conf.faults || [];
    if (faultsOn(states, faults).length) return { tone: 'bad', text: s.bad || w.fault };
    if (s.map) {
      const hit = s.map.find(r => (r.entities || []).some(e => stateIs(stateOf(states, e), r.state)));
      return hit ? { tone: hit.tone === 'info' ? 'on' : hit.tone, text: hit.text } : { tone: 'off', text: w.stateUnknown };
    }
    if (s.above !== undefined) {
      const v = numOf(states[s.entity]);
      if (v === null) return { tone: 'off', text: w.stateUnknown };
      return v > s.above ? { tone: 'on', text: s.on } : { tone: 'ok', text: s.ok };
    }
    const on = stateOf(states, s.entity);
    if (on === 'on' && faults.every(f => stateOf(states, f.entity) === (f.bad === 'off' ? 'on' : 'off'))) return { tone: 'ok', text: s.ok };
    if (on === 'off') return { tone: 'off', text: s.off || w.offState };
    return { tone: 'off', text: w.stateUnknown };
  }

  // a reading cell's history sheet, in the entity's own unit; a cell with its own `words` says its
  // state in them there too
  function cellSheet(x, states, lang = 'et') {
    const spec = { title: x.title || x.name, entity: x.entity, more: x.entity, decimals: x.scale ? 0 : x.decimals ?? 1, unit: unitOf(states[x.entity]), color: x.color, history: { entity: x.entity, ...x.history } };
    if (x.words) spec.text = now => cellValue(x, now, lang);
    return spec;
  }

  // a count cell, `count: { entities: [{ entity, name }], state }`: { value, tone, note }, how many of
  // the entities are in `state` (a stateIs pattern; one without a value never is) as `n / total`,
  // red while one is not, and the names of those that are not, or `note.missing` when none
  function countCell(x, states, lang = 'et') {
    const list = x.count.entities || [];
    const missing = list.filter(e => { const st = states[e.entity]; return !hasValue(st) || !stateIs(st.state, x.count.state); }).map(e => e.name);
    return { value: `${list.length - missing.length} / ${list.length}`, tone: missing.length ? 'bad' : '', note: missing.length ? joinEt(missing, lang) : (x.note || {}).missing || '' };
  }

  // a cell's value: its own word for the state (`words: { off: 'kinni' }`; an exact key first, then
  // the first key that matches as a stateIs pattern, `'*'` any state), else the value with its unit
  function cellValue(x, states, lang = 'et') {
    const st = states[x.entity];
    if (x.words && st) {
      const key = Object.hasOwn(x.words, st.state) ? st.state : Object.keys(x.words).find(k => stateIs(st.state, k));
      if (key !== undefined) return x.words[key];
    }
    return valueText(st, x.decimals ?? 0, lang, x);
  }

  // a cell's tone: 'bad' while one of its `bad_if` rules holds (a rule is one { entity, state } or a
  // list of them that must all hold, `entity` the cell's own by default; stateIs patterns), 'good'
  // while its state is in `good`, else ''
  function cellTone(x, states) {
    const rules = (x.bad_if || []).map(r => (Array.isArray(r) ? r : [r]));
    if (rules.some(r => r.every(c => stateIs(stateOf(states, c.entity || x.entity), c.state)))) return 'bad';
    return (x.good || []).includes(stateOf(states, x.entity)) ? 'good' : '';
  }

  // the reading card's cell row: two to a row, three side by side
  const cellsClass = n => (n > 2 ? 'cells c3' : 'cells');

  // a cell's note: its `caption`, by its value with `note_above: { value, above, below }`, another
  // entity's value after a label with `note: { entity, label }`, or when it last turned on with
  // `note: { last_on: true, label }` from the card's history (ctx.lastOn(entity), ADR-015): the
  // time today, the day before it, "üle 24 h" without one
  function cellNote(x, states, lang = 'et', ctx = {}) {
    const o = x.note;
    if (o && o.last_on) {
      const t = ctx.lastOn ? ctx.lastOn(x.entity) : undefined;
      if (t === undefined) return '';
      return t === null ? words(lang).over24h : [o.label, shortWhen(t, ctx.now ?? Date.now(), lang, ctx.tz)].filter(Boolean).join(' ');
    }
    if (o && o.entity) {
      const st = states[o.entity];
      return hasValue(st) ? [o.label, valueText(st, o.decimals ?? x.decimals ?? 0, lang, {})].filter(Boolean).join(' ') : '';
    }
    const n = x.note_above;
    if (!n) return x.caption || '';
    const v = numOf(states[x.entity]);
    return v === null ? '' : v > n.value ? n.above : n.below;
  }

  // the reading and forecast cards' cells: each a button that opens its history sheet, a count cell
  // plain text, as it has no one history
  function cellRow(card, states, cells, ctx = {}) {
    const list = cells.map((x, i) => {
      const { value, tone, note } = x.count ? countCell(x, states, card._lang) : { value: cellValue(x, states, card._lang), tone: cellTone(x, states), note: cellNote(x, states, card._lang, ctx) };
      const inner = `<span class="lab">${esc(x.name)}</span><span class="v num${tone ? ` ${tone}` : ''}">${esc(value)}</span><span class="sub">${esc(note)}</span>`;
      if (x.count) return `<span class="cell">${inner}</span>`;
      card._sheets.set(`c${i}`, cellSheet(x, states, card._lang));
      return `<button type="button" class="press" data-k="c${i}" aria-label="${esc(card._w.history(`${x.name} ${value}`))}">${inner}</button>`;
    });
    return `<span class="${cellsClass(cells.length)}">${list.join('')}</span>`;
  }

  // watch time in hours as the house says it: '1 t 5 min', '22 min', '2 t'
  function durText(h, lang = 'et') {
    const m = Math.round((h || 0) * 60), u = words(lang).hourShort;
    return m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} ${u} ${m % 60} min` : `${m / 60} ${u}`;
  }

  // a column's value: hours with a decimal from an hour, minutes under one
  const colText = (h, lang = 'et') => (Math.round(h * 60) >= 60 ? `${fmtN(h, 1, lang)} ${words(lang).hourShort}` : `${Math.round(h * 60)} min`);

  // a counter of today's hours: its value, 0 while it still holds yesterday's (it resets only after
  // midnight, so a value last updated before today's start is yesterday's)
  function todayHours(st, now, tz) {
    const v = numOf(st);
    if (v === null) return 0;
    const p = zoneParts(now, tz), t = Date.parse(st.last_updated || '');
    return Number.isFinite(t) && t < dayStart(p.y, p.m, p.d, tz) ? 0 : Math.max(0, v);
  }

  return { LIT, PALETTES, palette, litPair, cssVars, A3, A3_COLORS, a3Palette, a3Color, A3_CSS, TRACK_CSS, PRICE_A3_CSS, READING_CSS, W, wirePoint, SEL, chartKey, swatch, GRAY, acting, actionDetail, navigate, tileAction, modeAction, HOUR, PRICE_SCALE, priceLevel, priceBars, levelTone, parseEt, ZONE_FMT, zoneParts, zoneOffset, dayStart, monthSpan, dayStarts, earlyInMonth, inLastMonth, weekdayOf, dayName, hh, hourSpan, whenLabel, LOCAL_ZONE, localZone, dayWord, nearest, lastMonthName, hourOfDay, tzOf, hourKeyOf, minuteKeyOf, hourStartIn, clockAt, shortWhen, agoText, whenText, dateIn, dailyRequest, hourlyRequest, dataCutoff, dailySeries, dayStats, dailyKey, seriesTypes, FETCHES, fetchShared, FRESH, stateHistoryRequest, onTimes, mergeTimes, liveOn, historyStale, hourlyCounts, binHours, stateIs, faultsOn, statusLine, cellSheet, countCell, cellValue, cellTone, cellsClass, cellNote, cellRow, durText, colText, todayHours, DAY, H };
}
