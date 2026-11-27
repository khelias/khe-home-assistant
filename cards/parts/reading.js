// Soojuspump and Ventilatsioon reading card: ReadingCard (hourly line, cells, meter, shift stepper).
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ esc, hasValue, stateOf, words, withUnit, attrText, num, numOf, cap, unitOf, valueText, fmtN, a3Palette, a3Color, READING_CSS, HOUR, SEL, wirePoint, hh, dayWord, whenLabel, nearest, tzOf, hourlyRequest, cellSheet, cellRow, seriesFrom, lineStats, chartPaths, LoadingCard } = {}) {
  // the WebSocket message for the hourly means of the last `hours` whole hours
  const lineRequest = (id, hours, now) => hourlyRequest(id, now, hours, ['mean']);

  // the hourly means as a line that ends at the live value, so its last point agrees with the big
  // number while the hour's statistics are not compiled yet
  function lineSeries(resp, id, live, now) {
    const { points } = seriesFrom(resp, { entity: id, source: 'statistics', type: 'mean' });
    if (live != null) points.push({ t: now, v: live, live: true });
    return { kind: 'line', points };
  }

  // { lo, hi } a line is drawn between: its lineStats and a floor, padded; null without a value
  function lineRange(stats, floor) {
    if (!stats) return null;
    const lo = floor == null ? stats.lo : Math.min(stats.lo, floor), hi = floor == null ? stats.hi : Math.max(stats.hi, floor);
    const pad = (hi - lo) * 0.1 || 0.5;
    return { lo: lo - pad, hi: hi + pad };
  }

  // three labels under a line from t0 to now: its start, its middle and 'nüüd', each as the day
  // ('täna', 'eile' or the weekday) and the hour in the browser's zone
  function lineAxis(t0, now, lang = 'et') {
    const w = words(lang);
    const at = t => { const d = new Date(t); return `${dayWord(t, now, lang) ?? w.weekdays[d.getDay()]} ${hh(d.getHours())}:00`; };
    return [at(t0), at((t0 + now) / 2), w.now];
  }

  // the shift as the stepper shows it and the line under its name
  const stepText = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`;

  const stepNote = (v, lang = 'et') => words(lang).curve(v);

  // a number entity's value and its { min, max, step }
  function stepState(st) {
    const a = (st || {}).attributes || {};
    return { cur: hasValue(st) ? num(st.state) : null, lim: { min: num(a.min) ?? -Infinity, max: num(a.max) ?? Infinity, step: num(a.step) || 1 } };
  }

  // the value one step up (dir 1) or down (-1) from v, within the entity's min, max and step
  function stepValue(v, dir, { min = -Infinity, max = Infinity, step = 1 } = {}) {
    const n = Math.round((v + dir * step) / step) * step;
    return Math.max(min, Math.min(max, Number(n.toFixed(6))));
  }

  // the write a settled stepper sends: none when the taps net to the value the entity has
  const stepWrite = (pending, current) => (pending === null || pending === current ? null : pending);

  // the reading card's meter: { name, value, pct, note }, the value's share of `max` (100 by
  // default) held to 0-100, and no fill without a value
  function meterRow(states, m, lang = 'et') {
    const st = states[m.entity], v = numOf(st);
    return { name: m.name || '', value: valueText(st, m.decimals ?? 0, lang, { unit: m.unit }), pct: v === null ? 0 : Math.max(0, Math.min(100, (v / (m.max || 100)) * 100)), note: m.note || '' };
  }

  // the entities a reading card redraws on: its own, its line's, chip's, note's, meter's and
  // stepper's, and its cells' with their notes', rules' and counts'
  function readingWatched(c) {
    const chip = c.chip || {}, cells = c.cells || [];
    const ruled = cells.flatMap(x => (x.bad_if || []).flat().map(r => r.entity));
    const counted = cells.flatMap(x => ((x.count || {}).entities || []).map(e => e.entity));
    return [...new Set([c.entity, (c.line || {}).statistic, chip.entity, chip.fault, ((c.note || {}).target || {}).entity, (c.meter || {}).entity, ...cells.map(x => x.entity), ...cells.map(x => (x.note || {}).entity), ...ruled, ...counted, (c.stepper || {}).entity].filter(Boolean))];
  }

  const LW = 341, LH = 88, LTOP = 8, LBOT = 4;

  // One reading big, with a note, a chip, a meter, its hourly line, the reading and cells that open
  // their history sheets and a stepper: Soojuspump's Küte and Soe vesi (ADR-011), Ventilatsioon's Toaõhk and Seade.
  // Every value reads its entity's unit, or the config's `unit` after its `scale`. The stepper's value moves at once and is
  // written once the taps settle (STEP_SETTLE); a pending value outlives redraws.
  const STEP_SETTLE = 1500, STEP_WAIT = 60e3;

  class ReadingCard extends LoadingCard {
    static css = READING_CSS;
    _check(c) { if (!c.entity && !(c.cells || []).length) throw new Error('khe-reading-card: entity or cells is required'); }
    _watched() { return readingWatched(this._config); }
    _historyIds() { return (this._config.cells || []).filter(x => (x.note || {}).last_on).map(x => x.entity); }
    _requests(now) { const l = this._config.line; return l ? { line: lineRequest(l.statistic, l.hours || 48, now) } : {}; }
    _html(states, pal) {
      const c = this._config, now = Date.now(), st = states[c.entity], w = this._w, L = this._lang;
      this._actions = new Map();
      this._sheets = new Map();
      this._point = null;
      // the cells alone (Valve's doors and Süsteem), with the note's text under them
      if (!c.entity) {
        const parts = [this._cells(states)];
        if ((c.note || {}).text) parts.push(`<span class="sub">${esc(c.note.text)}</span>`);
        return `<div class="glass main">${parts.join('<span class="hr"></span>')}</div>`;
      }
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
      const on = this._onTimes();
      const lastOn = on ? id => { const t = on[id] || []; return t.length ? t[t.length - 1] : null; } : () => undefined;
      return cellRow(this, states, this._config.cells, { lastOn, now: Date.now(), tz: tzOf(this._hass) });
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

  // the reading card's markup for a config, states and loaded data (`hist` the off-to-on times),
  // without an element (the tests')
  function readingA3Markup(conf, states, data, lang = 'et', hass = {}) {
    const card = Object.assign(Object.create(ReadingCard.prototype), { _config: conf, _lang: lang, _w: words(lang), _hass: { states, ...hass }, _data: data, _live: {} });
    return { html: card._html(states, a3Palette(false)), sheets: card._sheets, history: card._hist() };
  }

  return {
    exports: { lineRequest, lineSeries, lineRange, lineAxis, stepText, stepNote, stepValue, stepWrite, meterRow, readingWatched, readingA3Markup },
    elements: [
    ["khe-reading-card", ReadingCard, "KHE reading", "One reading with its hourly line, cells and a stepper (A3)."],
  ]
  };
}
