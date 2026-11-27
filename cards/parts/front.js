// Front-page and A3 summary cards: SummaryCard, PriceCard, HeadingCard, ChipsCard, StatusCard.
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ icon, esc, hasValue, stateOf, words, sensorWords, joinEt, formatNumber, stateWord, num, numOf, cap, unitOf, splitValue, valueText, fmtN, litPair, a3Palette, a3Color, PRICE_A3_CSS, actionDetail, navigate, priceBars, levelTone, hourSpan, wirePoint, faultsOn, statusLine, barRect, usageSheet, KheCard, HOUR } = {}) {
  // { text, warn }: the house in one or two sentences
  function sentence(states, conf, lang = 'et') {
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
  function securityText(states, alarms, lang = 'et') {
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

  function peopleText(states, people, lang = 'et') {
    const home = people.filter(p => stateOf(states, p.entity) === 'home').map(p => p.name), w = words(lang);
    return home.length ? w.peopleHome(joinEt(home, lang)) : w.nobodyHome;
  }

  // [{ key, icon, color, label, value, warn, tap }]: the faults that are on, then the four summaries
  function chips(states, conf, lang = 'et') {
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
      this._timer = setTimeout(() => this.connectedCallback(), HOUR - (Date.now() % HOUR) + 1000);
      super.connectedCallback();
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
  .status.on i{background:var(--accent);opacity:1}
  .status.bad{color:var(--high)}
  .status.bad i{background:var(--highBar);opacity:1}
  /* a heading card's 14 + 44 px, so the title's baseline meets the section headings' beside it */
  .title{padding:0}
  .title .head{margin-top:14px;height:44px}
  `;
    _watched() {
      const c = this._config;
      const mapped = ((c.status || {}).map || []).flatMap(r => r.entities || []);
      return [...(c.people || []), ...(c.alarms || []), ...(c.faults || []), ...(c.notes || []), ...(c.status ? [c.status] : [])].map(x => x.entity).concat(c.outdoor ? [c.outdoor.entity] : [], mapped).filter(Boolean);
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
  function statusItems(states, conf, lang = 'et') {
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

  return {
    exports: { sentence, securityText, peopleText, chips, statusItems },
    elements: [
    ["khe-summary-card", SummaryCard, "KHE summary", "The house in one sentence, with summary chips."],
    ["khe-price-card", PriceCard, "KHE price", "The electricity price now, the hourly bars and the cheapest windows."],
    ["khe-chips-card", ChipsCard, "KHE chips", "The page title, the outdoor temperature, people, alarms and faults (A3)."],
    ["khe-heading-card", HeadingCard, "KHE heading", "A section heading, a link when it has a tap action (A3)."],
    ["khe-status-card", StatusCard, "KHE status", "System health as dots (A3)."],
  ]
  };
}
