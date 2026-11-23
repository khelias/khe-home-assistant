// A3 history sheet dialog (Sheet) and its pure chart/range/statistics helpers.
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ icon, esc, NO_VALUE, hasValue, stateOf, words, formatNumber, withUnit, stateWord, num, rowTime, numOf, cap, unitOf, splitValue, valueText, fmtN, A3, a3Color, HOUR, W, H, wirePoint, SEL, actionDetail, priceBars, zoneParts, dayStart, dayStarts, dayName, hh, hourSpan, whenLabel, localZone, nearest, tzOf, hourKeyOf, hourStartIn, dailyRequest, hourlyRequest, dataCutoff, dailySeries, dayStats, dailyKey, seriesTypes, fetchShared, todayHours, durText, colText, a3Palette, navigate } = {}) {
  // The ranges: the statistics period for a measurement and for an energy counter, and the span.
  const RANGES = {
    '24h': { ms: 24 * HOUR, period: '5minute', energy: 'hour' },
    '7d': { ms: 7 * 24 * HOUR, period: 'hour', energy: 'day' },
    '30d': { ms: 30 * 24 * HOUR, period: 'day', energy: 'day' }
  };

  // The WebSocket message for a tile's history config ({ entity, source, type, cost }) over a range.
  function historyRequest(h, range, now = Date.now()) {
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

  // A response as a series: { kind: 'line' | 'bars' | 'step' | 'empty', points, cost }. Points are
  // { t, v } with t in ms; an unavailable or unknown sample is a gap (v null); a step point's v is
  // whether the state counts as active (the tile's `active` list, else 'on').
  function seriesFrom(resp, h) {
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
    const t = rowTime;
    if (known.length && known.every(r => num(r.s) !== null)) {
      return { kind: 'line', points: rows.map(r => ({ t: t(r), v: NO_VALUE.has(r.s) ? null : num(r.s) })), stepped: true };
    }
    const active = h.active || ['on'];
    return { kind: 'step', points: rows.map(r => ({ t: t(r), v: NO_VALUE.has(r.s) ? null : active.includes(r.s), s: r.s })) };
  }

  // A motion sensor's on/off history as how many times it fired: bars per hour over 24 h, per day in
  // HA's zone over a week or a month. Only off-to-on changes count, as on the motion card (ADR-015).
  function countSeries(series, range, now, tz) {
    const starts = range === '24h' ? Array.from({ length: 24 }, (_, i) => hourStartIn(now, tz) - (23 - i) * HOUR) : dayStarts(range === '7d' ? 7 : 30, now, tz);
    const bins = starts.map(t => ({ t, v: 0 }));
    let known = null;
    for (const p of series.points) {
      if (p.v && known === false && p.t >= starts[0] && p.t <= now) {
        let i = starts.length - 1;
        while (i > 0 && starts[i] > p.t) i -= 1;
        bins[i].v += 1;
      }
      if (p.v !== null) known = p.v;
    }
    return { kind: 'bars', points: bins, cost: null };
  }

  // { lo, mean, hi } of a line, time-weighted for a stepped history line, null when it has no value
  function lineStats(series, start, end = Date.now()) {
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
  function stepStats(series, start, end = Date.now()) {
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
  function barStats(series) {
    const vals = series.points.map(p => p.v).filter(v => v !== null);
    if (!vals.length) return null;
    return { total: vals.reduce((a, v) => a + v, 0), peak: vals.reduce((a, v) => Math.max(a, v), -Infinity), cost: series.cost };
  }

  // one bar as SVG path data: a w x h rectangle at x, y
  const barRect = (x, y, w, h) => `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h-${w.toFixed(1)}Z`;

  // SVG path data in a w x h box between t0 and t1: a line (with gaps) and its area, step bands, or bars
  function chartPaths(series, { w = 350, h = 170, top = 14, bot = 12, t0, t1, lo, hi }) {
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
  function axisLabel(range, lang = 'et', tz) {
    const w = words(lang);
    // the locale's short month is the whole name in Estonian
    if (range === '12m') { const zone = tz || localZone(); return t => w.monthsShort[zoneParts(t, zone).m - 1]; }
    const fmt = range === '24h' ? { hour: '2-digit', minute: '2-digit' } : range === '7d' ? { weekday: 'short' } : { day: 'numeric', month: 'numeric' };
    const F = new Intl.DateTimeFormat(w.locale, { ...fmt, timeZone: tz });
    return t => F.format(new Date(t));
  }

  // five axis labels from t0 to t1, the last one now
  function axisLabels(range, t0, t1, lang = 'et', tz) {
    const label = axisLabel(range, lang, tz);
    return [0, 1, 2, 3].map(i => label(t0 + ((t1 - t0) * i) / 4)).concat(words(lang).now);
  }

  // The days sheet's ranges (ADR-013): slots of HA's calendar days or months, the last one now
  const DAYS_RANGES = { '30d': { days: 30 }, '90d': { days: 90 }, '12m': { months: 12 } };

  // { period, before, starts, end } of a days sheet's range in HA's zone: the start of the slot
  // before the window, the slots' starts, oldest first, and the end of the last one
  function daysRange(range, now, tz) {
    const r = DAYS_RANGES[range] || DAYS_RANGES['30d'], p = zoneParts(now, tz), n = r.months || r.days;
    const at = i => (r.months ? dayStart(p.y, p.m - n + 1 + i, 1, tz) : dayStart(p.y, p.m, p.d - n + 1 + i, tz));
    return { period: r.months ? 'month' : 'day', before: at(-1), starts: r.months ? Array.from({ length: n }, (_, i) => at(i)) : dayStarts(n, now, tz), end: at(n) };
  }

  // the WebSocket message for a days sheet (daysSheet's spec) over a range, from the slot before it:
  // whether that one has data tells whether the first slot may be a statistic's partial first
  function daysSheetRequest(spec, range, now, tz) {
    const r = daysRange(range, now, tz);
    return { type: 'recorder/statistics_during_period', start_time: new Date(r.before).toISOString(), statistic_ids: [spec.statistic], period: r.period, types: [spec.type] };
  }

  // a days sheet's slots, { period, end, pts, stats }: pts are { t, v, out } with v scaled, null
  // without data; out says why a slot is kept out of the numbers: 'open' for the last, unfinished
  // one, 'partial' for a statistic's first day or month (it begins mid-period: the slot before it
  // has no data), 'late' past a delayed
  // counter's cutoff. stats over the counted slots, { avg, total, small, big, last } with the
  // last three slots, or null when none counts.
  function slotSeries(resp, spec, range, now, tz, cutoff = Infinity) {
    const { period, before, starts, end } = daysRange(range, now, tz);
    const key = t => { const p = zoneParts(t, tz); return period === 'month' ? `${p.y}-${p.m}` : `${p.y}-${p.m}-${p.d}`; };
    const rows = new Map(((resp || {})[spec.statistic] || []).map(r => [key(r.start), r]));
    const scale = spec.scale || 1;
    const pts = starts.map((t, i) => {
      const r = rows.get(key(t)), v = r ? num(r[spec.type]) : null, e = i + 1 < starts.length ? starts[i + 1] : end;
      return { t, v: v === null ? null : v * scale, out: i === starts.length - 1 ? 'open' : e > cutoff ? 'late' : false };
    });
    const first = pts.findIndex(p => p.v !== null);
    if (first >= 0 && !pts[first].out && (first > 0 || !rows.has(key(before)))) pts[first].out = 'partial';
    const counted = pts.filter(p => p.v !== null && !p.out);
    if (!counted.length) return { period, end, pts, stats: null };
    const total = counted.reduce((a, p) => a + p.v, 0);
    const pick = better => counted.reduce((a, p) => (better(p.v, a.v) ? p : a));
    return { period, end, pts, stats: { avg: total / counted.length, total, small: pick((a, b) => a < b), big: pick((a, b) => a > b), last: counted[counted.length - 1] } };
  }

  // A3's usage sheet: an energy entity's value now, its consumption and cost by hour and by day
  function usageSheet(entity, history, lang = 'et') {
    return { title: words(lang).use, entity, more: entity, decimals: 1, unit: 'kWh', color: 'indigo', history };
  }

  // what a tap on a days card's headline opens: the picked series over 30 days, 90 days and 12
  // months (ADR-013), with the card's cutoff for a counter; `more` is a real entity, since an
  // external statistic has no state
  function daysSheet(conf, i) {
    const s = conf.series[i];
    return {
      days: true, title: s.title || s.name, statistic: s.statistic, type: s.type, color: s.color, unit: s.unit || '',
      scale: s.scale || 1, decimals: s.decimals ?? 1, more: s.more, ...(s.type === 'change' && conf.cutoff ? { cutoff: conf.cutoff } : {})
    };
  }

  // the days card's requests: one daily request per set of types holding every series' and
  // overlay's statistic of those types, and the cutoff's hourly one
  function daysRequests(conf, now, tz) {
    const byType = new Map();
    const add = (types, id) => {
      const k = dailyKey(types);
      if (!byType.has(k)) byType.set(k, { types, ids: [] });
      if (!byType.get(k).ids.includes(id)) byType.get(k).ids.push(id);
    };
    for (const s of conf.series) {
      if (s.stack) { for (const p of s.stack) add(['change'], p.statistic); continue; }
      add(seriesTypes(s), s.statistic);
      if (s.overlay) add([s.overlay.type], s.overlay.statistic);
    }
    const reqs = Object.fromEntries([...byType].map(([k, r]) => [k, dailyRequest(r.ids, r.types, conf.days || 31, now, tz)]));
    return conf.cutoff ? { ...reqs, cutoff: hourlyRequest(conf.cutoff, now) } : reqs;
  }

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
          if (h.counts && series.kind === 'step') series = countSeries(series, range, now, tzOf(hass));
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

  return { RANGES, historyRequest, seriesFrom, countSeries, lineStats, stepStats, barStats, barRect, chartPaths, axisLabel, axisLabels, DAYS_RANGES, daysRange, daysSheetRequest, slotSeries, usageSheet, daysSheet, daysRequests, SHEET_CSS, Sheet };
}
