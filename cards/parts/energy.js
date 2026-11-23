// Energia and daily series cards: MonthCard, DaysCard, SplitCard and stacked-days helpers.
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ esc, hasValue, stateOf, words, formatNumber, withUnit, num, numOf, cap, unitOf, fmtN, a3Color, TRACK_CSS, PRICE_A3_CSS, W, SEL, wirePoint, chartKey, swatch, GRAY, parseEt, zoneParts, dayStart, monthSpan, dayStarts, earlyInMonth, inLastMonth, dayName, lastMonthName, tzOf, dailyRequest, hourlyRequest, dataCutoff, dailySeries, dayStats, dailyKey, seriesTypes, durText, colText, todayHours, barRect, usageSheet, daysSheet, daysRequests, KheCard, LoadingCard, DAY, icon, priceLevel, weekdayOf } = {}) {
  // the month's cost at its pace: cost over the elapsed share of the month up to the data cutoff;
  // null on the first two days, before any data, or without a cost
  function monthPace(cost, cutoff, now, tz) {
    if (cost === null || cost === undefined || earlyInMonth(now, tz)) return null;
    const [a, b] = monthSpan(now, tz);
    const frac = (Math.min(cutoff ?? now, now) - a) / (b - a);
    return frac > 0 ? cost / frac : null;
  }

  // Last month's value from a sensor's attributes: a utility meter's own one (`last_period`), or
  // 'month', Daikin's month attributes, which name this year's months and the previous year's as
  // `Last <Month>` (last month in January is `Last December`). null on the first two days of a
  // month, when it may still be the one before, and for "-" or a missing value.
  function lastMonthValue(st, key, now, tz) {
    if (!key || !st || earlyInMonth(now, tz)) return null;
    const a = st.attributes || {};
    if (key !== 'month') return parseEt(a[key]);
    const en = lastMonthName(now, tz, 'en-US');
    return parseEt(a[zoneParts(now, tz).m === 1 ? `Last ${en}` : en]);
  }

  // the split card's rows: each part's kWh this month, its share and last month's, and the rest of
  // the house. Shares are of the larger of the total and the parts, so a delayed total cannot push
  // them past 100; last month is left out on the first two days, when it may still be the one before.
  function splitRows(states, conf, now, tz, lang = 'et') {
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

  // the overlay's value of each day, as the primary points' `o`
  function withOverlay(pts, overlay) {
    const by = new Map(overlay.map(p => [p.t, p.v]));
    return pts.map(p => ({ ...p, o: by.get(p.t) ?? null }));
  }

  // the top of a days chart: its largest bar, dearest hour or overlay bar with headroom, 1 when all are 0
  const daysTop = (pts, peak) => Math.max(0, ...pts.map(p => Math.max(p.v ?? 0, peak ? p.max ?? 0 : 0, p.o ?? 0))) * 1.05 || 1;

  // the primary sum over the overlay's on the complete days that have both; null unless the
  // overlay's sum is above 0
  function dayRatio(pts) {
    const full = pts.filter(p => p.v !== null && p.o != null && !p.late);
    const a = full.reduce((x, p) => x + p.v, 0), b = full.reduce((x, p) => x + p.o, 0);
    return b > 0 ? a / b : null;
  }

  // the ratio headline: [the ratio, the series' caption for the side of 1 the shown number is on]
  function ratioHeadline(r, s, lang = 'et') {
    if (r === null) return ['–', ''];
    const d = r >= 10 ? 0 : 1, shown = Number(r.toFixed(d));
    return [words(lang).ratio(fmtN(r, d, lang)), (shown < 1 ? s.caption_below : s.caption) || ''];
  }

  // the days card's headline while pointing at day j: [its value, its unit, the overlay's value,
  // the day and a note]; the headline itself (the average or the ratio) when j is null
  function dayPoint(P, j) {
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
  function dayCells(states, cells, now, tz, lang = 'et', ctx = {}) {
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
      const [m0, m1] = monthSpan(now, tz), days = Math.round((m1 - m0) / DAY);
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
  .wk{display:flex;flex-direction:column;gap:2px}
  .wk .n{font-size:26px;line-height:1.1;font-weight:700;letter-spacing:-0.022em}
  .cols,.lbl{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:10px}
  .cols{align-items:end;height:150px}
  .col{display:flex;flex-direction:column;justify-content:flex-end;gap:6px;height:100%;min-width:0}
  .col .v{font-size:11px;font-weight:600;text-align:center;color:var(--sub);white-space:nowrap}
  .stk{display:flex;flex-direction:column-reverse;gap:1.5px;border-radius:6px;overflow:hidden}
  .stk.none{background:var(--track)}
  .stk.old{opacity:.82}
  .lbl span{font-size:12px;font-weight:600;text-align:center;color:var(--sub)}
  .lbl b{font-size:12px;font-weight:700;text-align:center}
  .box{display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:24px}
  .seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:2px;border-radius:12px;background:var(--seg)}
  .seg button{height:34px;border-radius:10px;font-size:14px;font-weight:600;text-align:center;color:var(--text)}
  .seg button[aria-pressed="true"]{background:var(--segOn);box-shadow:var(--segShadow)}
  .avg{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .avg .n{font-size:28px;font-weight:700;letter-spacing:-0.025em}
  .avg .u{font-size:14px;font-weight:600;color:var(--sub)}
  svg.c{display:block;width:100%;height:120px;touch-action:pan-y}
  .ax{display:flex;justify-content:space-between;margin-top:4px;font-size:11px;font-weight:600;color:var(--sub)}
  .key{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;font-weight:600;color:var(--sub)}
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

  // A stacked series (ADR-017): `stack: [{ statistic, name, color, today: { entity } }]`, `color` a
  // hex colour of the part's own (the TV's apps carry theirs), daily
  // change statistics of parts that add up; today's column comes from each part's live counter. One
  // point per day, { t, label, parts, v, today }, v the parts' sum, null when no part has a value
  // `per`, each part's dailySeries, may come from an earlier draw over the same response
  function stackPoints(resp, stack, days, now, tz, states, per = stack.map(p => dailySeries(resp, p.statistic, 'change', days, now, tz))) {
    return per[0].map((pt, j) => {
      const today = j === days - 1;
      const parts = stack.map((p, k) => (today && p.today ? todayHours(states[p.today.entity], now, tz) : per[k][j].v));
      const known = parts.filter(v => v !== null);
      return { t: pt.t, label: pt.label, parts, v: known.length ? known.reduce((a, v) => a + v, 0) : null, today };
    });
  }

  // { total, avg }: the days' sum with today, the average of the ended days that have a value
  function stackStats(pts) {
    const ended = pts.filter(p => !p.today && p.v !== null);
    return { total: pts.reduce((a, p) => a + (p.v ?? 0), 0), avg: ended.length ? ended.reduce((a, p) => a + p.v, 0) / ended.length : null };
  }

  // a day's short label under its column: the weekday, 'täna' for today
  function stackLabel(p, tz, lang = 'et') {
    const w = words(lang);
    return p.today ? w.today : w.weekdaysShort[weekdayOf(p.t, tz)];
  }

  // the chart's text for a screen reader: each day's total and its parts by name
  function stackAria(pts, stack, tz, lang = 'et') {
    return words(lang).byDay(pts.map(p => {
      const parts = stack.map((s, k) => [s.name, p.parts[k]]).filter(([, v]) => v > 0).map(([n, v]) => `${n} ${durText(v, lang)}`);
      return `${dayName(p.t, tz, lang)} ${p.v === null ? '–' : durText(p.v, lang)}${parts.length ? ` (${parts.join(', ')})` : ''}`;
    }).join('; '));
  }

  // a stacked series' body: the total and the ended days' average, the columns with their values and
  // days, and a legend of the parts that have a value; no sheet, as the parts have no one statistic
  function stackHtml(s, d, states, days, lang) {
    // the statistics change only with the hourly load, the counters with every draw
    const resp = d.res[dailyKey(['change'])];
    const per = (d.stack ??= new Map()).get(s) || d.stack.set(s, s.stack.map(p => dailySeries(resp, p.statistic, 'change', days, d.now, d.tz))).get(s);
    const w = words(lang), pts = stackPoints(resp, s.stack, days, d.now, d.tz, states, per);
    if (pts.every(p => p.v === null)) return `<div class="msg">${w.noData}</div>`;
    const { total, avg } = stackStats(pts), top = Math.max(...pts.map(p => p.v ?? 0)) || 1;
    const cols = pts.map(p => {
      const parts = s.stack.map((x, k) => [x, p.parts[k]]).filter(([, v]) => v > 0);
      const bar = parts.map(([x, v]) => `<i style="flex:${v.toFixed(4)};background:${x.color}"></i>`).join('');
      return `<span class="col"><span class="v num">${p.v === null ? '' : esc(colText(p.v, lang))}</span><span class="stk${p.today ? '' : ' old'}${parts.length ? '' : ' none'}" style="height:${p.v === null ? 0 : Math.max(4, Math.round((118 * p.v) / top))}px">${bar}</span></span>`;
    }).join('');
    const labels = pts.map(p => (p.today ? `<b>${esc(stackLabel(p, d.tz, lang))}</b>` : `<span>${esc(stackLabel(p, d.tz, lang))}</span>`)).join('');
    const used = s.stack.filter((x, k) => pts.some(p => p.parts[k] > 0));
    return `<span class="wk"><span class="n num">${esc(durText(total, lang))}</span><span class="sub">${avg === null ? '' : esc(w.perDay(durText(avg, lang)))}</span></span><span class="cols" role="img" aria-label="${esc(stackAria(pts, s.stack, d.tz, lang))}">${cols}</span><span class="lbl" aria-hidden="true">${labels}</span>${used.length ? chartKey(...used.map(x => [swatch(x.color), x.name])) : ''}`;
  }

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
      const todays = s => (s.stack ? s.stack.map(p => p.today) : [s.today]).map(t => t && t.entity);
      return [...(c.series || []).flatMap(todays), ...(c.cells || []).flatMap(x => [x.entity, x.share_of])].filter(Boolean);
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
      if (s.stack) return shell(stackHtml(s, d, states, c.days || 7, L));
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
      let key = '';
      if (o) key = chartKey([swatch(a3Color(s.color)[0]), s.legend || s.name], [o.color ? swatch(a3Color(o.color)[0]) : swatch(pal.text, 0.55), o.name || '']);
      else if (s.peak) key = chartKey([swatch(pal.sub), w.dayAvg], [`<i style="width:12px;height:2px;background:${pal.text};opacity:.55"></i>`, w.dearestHour]);
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

  return {
    exports: { monthPace, lastMonthValue, splitRows, withOverlay, daysTop, dayRatio, ratioHeadline, dayPoint, dayCells, stackPoints, stackStats, stackLabel, stackAria },
    elements: [
    ["khe-month-card", MonthCard, "KHE month", "The month's energy cost, its pace, today, yesterday and last month (A3)."],
    ["khe-days-card", DaysCard, "KHE days", "Daily bars of a statistic, several behind a switch (A3)."],
    ["khe-split-card", SplitCard, "KHE split", "Who used the month's energy (A3)."],
  ]
  };
}
