// Pergola hourly weather forecast card: ForecastCard (ADR-014).
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ esc, words, num, cap, fmtN, a3Palette, a3Color, READING_CSS, HOUR, wirePoint, chartKey, hourOfDay, localZone, tzOf, cellRow, barRect, LoadingCard } = {}) {
  // the WebSocket message for a weather entity's hourly forecast, a service call with its response
  const forecastRequest = entity => ({
    type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type: 'hourly' },
    target: { entity_id: entity }, return_response: true
  });

  // the conditions the house's rain rule also closes the roof on
  const WET = new Set(['rainy', 'pouring', 'lightning', 'lightning-rainy', 'snowy', 'snowy-rainy', 'hail']);

  const wetCondition = c => WET.has(c);

  // The next `hours` hours from the one now: [{ t, p, temp, cond }], p in mm, 0 when missing; []
  // for an empty or failed answer
  function forecastHours(resp, entity, now, hours = 14) {
    const rows = ((((resp || {}).response || {})[entity] || {}).forecast) || [];
    return rows
      .map(r => ({ t: Date.parse(r.datetime), p: Math.max(0, num(r.precipitation) ?? 0), temp: num(r.temperature), cond: r.condition || '' }))
      .filter(r => Number.isFinite(r.t) && r.t + HOUR > now)
      .sort((a, b) => a.t - b.t)
      .slice(0, hours);
  }

  // { total, dry }: the hours' precipitation, and while any hour is wet the first dry stretch of two
  // hours or more as [first, end) indices (null without one)
  function forecastSummary(rows) {
    const total = rows.reduce((a, r) => a + r.p, 0);
    let dry = null;
    for (let i = 0; total > 0 && !dry && i < rows.length; i++) {
      if (rows[i].p > 0) continue;
      let j = i;
      while (j < rows.length && rows[j].p === 0) j++;
      if (j - i >= 2) dry = [i, j];
      i = j;
    }
    return { total, dry };
  }

  // the hour that starts at t: 'kell 16–17'
  const hourAt = (t, lang = 'et', tz = localZone()) => words(lang).at(`${hourOfDay(t, tz)}–${hourOfDay(t + HOUR, tz)}`);

  // the line under the total: 'kogu aeg kuiv', the first dry stretch 'kuiv kell 17–19', or ''
  function forecastNote(rows, lang = 'et', tz = localZone(), summary = forecastSummary(rows)) {
    const w = words(lang), { total, dry } = summary;
    if (!rows.length) return '';
    if (!total) return w.allDry;
    return dry ? w.dryAt(`${hourOfDay(rows[dry[0]].t, tz)}–${hourOfDay(rows[dry[1] - 1].t + HOUR, tz)}`) : '';
  }

  // The chart's SVG path data in a FW x FH box, one slot an hour: precipitation bars (1 mm reaches
  // near the top, more scales them down), the temperature line over the bars' room, and a mark under
  // each hour whose condition is wet
  const FW = 341, FH = 104, FBASE = 92;

  function forecastPaths(rows) {
    const n = rows.length, slot = FW / (n || 1), bw = Math.max(1, slot - 4), mid = i => i * slot + slot / 2;
    const top = Math.max(1, ...rows.map(r => r.p));
    let bars = '', marks = '', line = '', pen = 'M';
    const temps = rows.map(r => r.temp).filter(v => v !== null);
    const lo = Math.min(...temps) - 1, hi = Math.max(...temps) + 1;
    rows.forEach((r, i) => {
      if (r.p > 0) { const h = Math.max(2, (r.p / top) * (FBASE - 30)); bars += barRect(i * slot + (slot - bw) / 2, FBASE - h, bw, h); }
      if (wetCondition(r.cond)) marks += `M${mid(i).toFixed(1)} ${FBASE + 5}v6`;
      if (r.temp === null) { pen = 'M'; return; }
      line += `${pen}${mid(i).toFixed(1)} ${(8 + (1 - (r.temp - lo) / (hi - lo)) * 44).toFixed(1)}`;
      pen = 'L';
    });
    return { bars, line, marks, slot };
  }

  // what pointing at hour i reads: [the hour, its mm or 'Kuiv', its temperature and condition]
  function forecastPoint(rows, i, lang = 'et', tz = localZone()) {
    const r = rows[i], w = words(lang);
    const cond = w.conditions[r.cond] || '';
    return [cap(hourAt(r.t, lang, tz)), r.p > 0 ? `${fmtN(r.p, 1, lang)} mm` : w.dry, [r.temp === null ? '' : `${fmtN(r.temp, 1, lang)}°`, cond].filter(Boolean).join(' · ')];
  }

  // the forecast card: loading, the chart, or without hours "Prognoos pole teada"; then the cells
  function forecastA3(card, states, pal) {
    const c = card._config, d = card._data, w = card._w;
    card._actions = new Map();
    card._sheets = new Map();
    card._point = null;
    const rows = d && !d.error ? forecastHours(d.res.fc, c.entity, Date.now(), c.hours || 14) : [];
    const top = !d ? `<span class="msg">${w.loading}</span>` : rows.length ? card._chart(rows, pal) : `<span class="msg">${w.noWeather}</span>`;
    const parts = [top];
    if ((c.cells || []).length) parts.push(cellRow(card, states, c.cells));
    return `<div class="glass main">${parts.join('<span class="hr"></span>')}</div>`;
  }

  // the forecast card's markup for a config, states and loaded data, without an element (the tests')
  function forecastA3Markup(conf, states, data, lang = 'et', hass = {}) {
    const card = { _config: conf, _lang: lang, _w: words(lang), _hass: { states, ...hass }, _data: data };
    card._chart = (rows, pal) => ForecastCard.prototype._chart.call(card, rows, pal);
    return { html: forecastA3(card, states, a3Palette(false)), sheets: card._sheets };
  }

  // the price card's head and the reading card's cells, with the forecast chart
  const FORECAST_CSS = `${READING_CSS}
  svg.fc{display:block;width:100%;height:${FH}px;touch-action:pan-y}
  .hd.pointing .sub{visibility:visible}
  `;

  // Pergola's weather (ADR-014): the precipitation of the next hours as the big value with the first
  // dry stretch, the hours as bars with the temperature line and marks under wet conditions, pointing
  // an hour reads it; then cells that open their history sheets. The big value opens nothing.
  class ForecastCard extends LoadingCard {
    static css = FORECAST_CSS;
    _check(c) { if (!c.entity) throw new Error('khe-forecast-card: entity is required'); }
    _watched() { const c = this._config; return [c.entity, ...(c.cells || []).map(x => x.entity)]; }
    _requests() { return { fc: forecastRequest(this._config.entity) }; }
    _html(states, pal) { return forecastA3(this, states, pal); }
    _chart(rows, pal) {
      const w = this._w, L = this._lang, tz = tzOf(this._hass), sum = forecastSummary(rows), P = forecastPaths(rows);
      this._point = { rows, slot: P.slot, tz };
      const big = sum.total > 0 ? `${fmtN(sum.total, 1, L)} mm` : w.dry;
      const head = `<span class="hd"><span class="l"><span class="lab">${esc(w.nextHours(rows.length))}</span><span class="big"><span class="n num">${esc(big)}</span></span><span class="sub">${esc(forecastNote(rows, L, tz, sum))}</span></span></span>`;
      const blue = a3Color('blue')[0], orange = a3Color('orange')[0];
      const n = rows.length, at = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (n - 1))).filter((i, k, a) => a.indexOf(i) === k);
      const ax = at.map(i => `<span style="left:${(((i + 0.5) * P.slot) / FW * 100).toFixed(1)}%;transform:translateX(-50%)">${hourOfDay(rows[i].t, tz)}</span>`).join('');
      const svg = `<svg class="fc" viewBox="0 0 ${FW} ${FH}" preserveAspectRatio="none" role="img" aria-label="${esc(w.forecastAria(n))}"><rect class="sel" y="0" width="${P.slot.toFixed(1)}" height="${FH}" fill="${pal.text}" fill-opacity="0.08" visibility="hidden"/><path d="M0 ${FBASE}H${FW}" stroke="${pal.hair}" fill="none" vector-effect="non-scaling-stroke"/><path d="${P.bars}" fill="${blue}" fill-opacity="0.75"/><path d="${P.line}" fill="none" stroke="${orange}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${P.marks}" stroke="${pal.text}" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
      const key = chartKey([`<i style="height:10px;border-radius:3px;background:${blue}"></i>`, w.precipKey], [`<i style="height:3px;border-radius:2px;background:${orange}"></i>`, w.tempKey],
        ...(P.marks ? [[`<i style="width:2px;height:8px;background:${pal.sub}"></i>`, w.rainKey]] : []));
      return `${head}<span class="ch">${svg}<span class="ax" aria-hidden="true">${ax}</span></span>${key}`;
    }
    // pointing at an hour shows its time, mm, temperature and condition in place of the total
    _wire() {
      const P = this._point, svg = P && this._root.querySelector('svg.fc');
      if (!svg) return;
      const hd = this._root.querySelector('.hd'), els = ['.lab', '.n', '.sub'].map(q => hd.querySelector(q)), sel = svg.querySelector('.sel');
      const was = els.map(e => e.textContent);
      wirePoint(svg, f => Math.min(P.rows.length - 1, Math.floor(f * P.rows.length)), i => {
        hd.classList.toggle('pointing', i !== null);
        sel.setAttribute('visibility', i === null ? 'hidden' : 'visible');
        const texts = i === null ? was : forecastPoint(P.rows, i, this._lang, P.tz);
        if (i !== null) sel.setAttribute('x', (i * P.slot).toFixed(1));
        els.forEach((e, k) => { e.textContent = texts[k]; });
      });
    }
  }

  return {
    exports: { forecastRequest, wetCondition, forecastHours, forecastSummary, hourAt, forecastNote, forecastPaths, forecastPoint, forecastA3Markup },
    elements: [
    ["khe-forecast-card", ForecastCard, "KHE forecast", "The next hours' precipitation and temperature from a weather entity, with cells (A3)."],
  ]
  };
}
