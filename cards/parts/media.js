// Kaamerad stills card (ADR-016) and Teler watch-time cards (ADR-017): CamerasCard, TvCard, UsageCard.
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ icon, esc, hasValue, stateOf, words, num, numOf, cap, a3Color, GRAY, actionDetail, tzOf, shortWhen, dateIn, cellSheet, durText, todayHours, KheCard, HOUR, clockAt, localZone, minuteKeyOf, stateWord } = {}) {
  const pictureOf = st => (st && st.attributes && st.attributes.entity_picture) || null;

  // a camera's still: the state's entity_picture (the camera_proxy URL with its rotating token) with
  // a time parameter so no cache answers; null without a picture. The house's NVR ignores `width`:
  // a thumbnail is the same 1920x1080 frame (2026-11-13).
  function cameraUrl(st, t) {
    const pic = pictureOf(st);
    return pic ? `${pic}${pic.includes('?') ? '&' : '?'}t=${t}` : null;
  }

  // what a camera's slot shows, { kind, text }: 'live' its still; 'stale' the last good still dimmed,
  // with when this card loaded it in HA's zone; 'down' no still yet; 'none' a placeholder, as the
  // state has no picture (the demo)
  function cameraSlot(st, last, failed, lang = 'et', tz = localZone()) {
    const w = words(lang);
    if (!hasValue(st) || failed) return last ? { kind: 'stale', text: w.camLast(clockAt(last, tz)) } : { kind: 'down', text: w.camDown };
    return { kind: pictureOf(st) ? 'live' : 'none', text: '' };
  }

  // the thumbnails under a hero: the other cameras in the config's order
  const cameraThumbs = (n, hero) => [...Array(n).keys()].filter(i => i !== hero);

  const CAM_HERO = 10e3, CAM_THUMB = 30e3;

  const CAMERAS_CSS = `
  .cams{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:26px}
  .hero,.th{position:relative;display:block;width:100%;overflow:hidden;background:#2c2c32}
  .hero{aspect-ratio:16/9;border-radius:18px}
  .th{aspect-ratio:16/10;border-radius:12px}
  .thumbs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .thumbs:empty{display:none}
  .slot,.frame,.pic,.ph,.ov,.shade{position:absolute;inset:0}
  .pic{width:100%;height:100%;object-fit:cover}
  .ph,.ov{display:none;align-items:center;justify-content:center}
  .ph{color:rgba(255,255,255,0.5)}
  .none .ph{display:flex}
  .ov{padding:0 16px;text-align:center;background:rgba(20,20,24,0.74);color:#fff;font-size:15px;font-weight:600}
  .stale .ov,.down .ov{display:flex}
  .th .ov b{display:none}
  .shade{background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,0.55) 100%)}
  .th .shade{background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6) 100%)}
  .cap{position:absolute;left:14px;bottom:12px;display:flex;flex-direction:column;gap:1px;color:#fff}
  .cap .nm{font-size:20px;font-weight:700;letter-spacing:-0.015em}
  .cap .tip{font-size:13px;font-weight:600;opacity:.85}
  .pill{position:absolute;right:12px;bottom:12px;display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;background:rgba(255,255,255,0.22);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;font-size:13px;font-weight:600}
  .th .nm{position:absolute;left:8px;bottom:6px;color:#fff;font-size:12px;font-weight:700}
  .dot{position:absolute;right:7px;top:7px;width:9px;height:9px;border-radius:5px;background:#ff3b30;display:none}
  .th.off .dot{display:block}
  @media (prefers-reduced-transparency: reduce){.pill{background:rgba(20,20,24,0.6);-webkit-backdrop-filter:none;backdrop-filter:none}}
  `;

  // the two drawn at their own stroke, unlike ICONS' 1.9
  const FULLSCREEN = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

  const CAMERA = '<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5h11v9H3zM14 10.5l7-3v9l-7-3"/></svg>';

  // Kaamerad's cameras (ADR-016): the hero still, which opens the camera's live view, and the
  // others as thumbnails that make one the hero. Config: { cameras: [{ entity, name, tap_action }] },
  // `entity` the substream. The DOM is built once and its <img>s kept: a redraw comes only with a
  // camera's state (the token rotation's new state object does not count), and updates the texts and
  // the order. Each still loads into its own Image and replaces the shown one only when it has
  // loaded, so a failure keeps the last good one; one load per camera at a time, the hero every
  // CAM_HERO, the thumbnails every CAM_THUMB, while the card is on the page and the tab visible.
  class CamerasCard extends KheCard {
    static a3only = true;
    static css = CAMERAS_CSS;
    _check(c) { if (!(c.cameras || []).length) throw new Error('khe-cameras-card: cameras is required'); }
    _watched() { return this._config.cameras.map(c => c.entity); }
    _stamp(st) { return st && st.state; }
    setConfig(config) {
      this._stop();
      Object.assign(this, { _cams: null, _hero: 0, _last: {}, _failed: {}, _loads: {} });
      super.setConfig(config);
    }
    _draw() {
      if (!this._config || !this._hass) return;
      this._style();
      if (!this._cams) this._build();
      this._update();
      this._sync();
    }
    // per camera its frame (the still, the placeholder, the overlay) and per slot its button
    _build() {
      const n = this._config.cameras.length, w = this._w;
      const thumbs = Array.from({ length: n - 1 }, (_, j) => `<button type="button" class="th press" data-k="t${j}"><span class="slot"></span><span class="shade"></span><span class="nm"></span><span class="dot"></span></button>`).join('');
      this._root.innerHTML = `<div class="glass cams"><button type="button" class="hero press" data-k="hero"><span class="slot"></span><span class="shade"></span><span class="cap"><span class="nm"></span><span class="tip">${esc(w.camTap)}</span></span><span class="pill">${FULLSCREEN}${esc(w.camLive)}</span></button><span class="thumbs">${thumbs}</span></div>`;
      this._slotEls = [...this._root.querySelectorAll('button')].map(b => ({ b, slot: b.querySelector('.slot'), nm: b.querySelector('.nm') }));
      this._cams = this._config.cameras.map(() => {
        const f = document.createElement('span');
        f.innerHTML = `<span class="ph">${CAMERA}</span><span class="ov"><b></b></span>`;
        return { f, b: f.querySelector('b'), img: null };
      });
    }
    _update() {
      const cams = this._config.cameras, states = this._hass.states, tz = tzOf(this._hass), w = this._w;
      [this._hero, ...cameraThumbs(cams.length, this._hero)].forEach((i, j) => {
        const s = cameraSlot(states[cams[i].entity], this._last[i], this._failed[i], this._lang, tz), c = this._cams[i], el = this._slotEls[j];
        c.f.className = `frame ${s.kind}`;
        c.b.textContent = s.text;
        if (el.slot.firstChild !== c.f) el.slot.replaceChildren(c.f);
        el.nm.textContent = cams[i].name;
        el.b.setAttribute('aria-label', (j ? w.camShow : w.camOpen)(cams[i].name));
        el.b.classList.toggle('off', s.kind === 'stale' || s.kind === 'down');
      });
    }
    // the timers run while the card is on the page, the tab is visible and a camera has a picture;
    // starting them loads every still at once
    _sync() {
      const states = this._hass ? this._hass.states : {};
      const want = this.isConnected && !!this._cams && !document.hidden && this._config.cameras.some(c => pictureOf(states[c.entity]));
      if (want === !!this._timers) return;
      if (!want) { this._stop(); return; }
      const thumbs = () => cameraThumbs(this._config.cameras.length, this._hero).forEach(i => this._load(i));
      this._timers = [setInterval(() => this._load(this._hero), CAM_HERO), setInterval(thumbs, CAM_THUMB)];
      this._load(this._hero);
      thumbs();
    }
    _stop() { (this._timers || []).forEach(clearInterval); this._timers = null; }
    // a load while one for the camera is still on its way waits for the next turn, unless `now`
    // (a new hero) drops the old one
    _load(i, now = false) {
      const busy = this._loads[i];
      if (busy && !now) return;
      if (busy) busy.removeAttribute('src');
      const url = cameraUrl(this._hass && this._hass.states[this._config.cameras[i].entity], Date.now());
      if (!url) { this._loads[i] = null; return; }
      const im = (this._loads[i] = new Image()), c = this._cams[i];
      im.className = 'pic';
      im.alt = '';
      im.onload = () => {
        if (this._loads[i] !== im) return;
        this._loads[i] = null;
        if (c.img) c.img.replaceWith(im); else c.f.prepend(im);
        c.img = im;
        const changed = this._failed[i] || !this._last[i];
        this._last[i] = Date.now();
        this._failed[i] = false;
        if (changed) this._update();
      };
      im.onerror = () => { if (this._loads[i] === im) { this._loads[i] = null; this._failed[i] = true; this._update(); } };
      im.src = url;
    }
    connectedCallback() {
      if (!this._vis) { this._vis = () => this._sync(); document.addEventListener('visibilitychange', this._vis); }
      super.connectedCallback();
      // a reconnect with nothing changed draws nothing, and only this restarts the timers
      if (this._hass) this._sync();
    }
    disconnectedCallback() {
      this._stop();
      if (this._vis) { document.removeEventListener('visibilitychange', this._vis); this._vis = null; }
    }
    _click(ev) {
      const b = ev.target.closest('button[data-k]');
      if (!b) return;
      const cams = this._config.cameras;
      if (b.dataset.k === 'hero') { const c = cams[this._hero]; this._fire(actionDetail(c.entity, c.tap_action || { action: 'more-info' })); return; }
      this._hero = cameraThumbs(cams.length, this._hero)[Number(b.dataset.k.slice(1))];
      this._update();
      this._load(this._hero, true);
    }
  }

  const appColor = (apps, name) => ((apps || []).find(a => a.name === name) || {}).color || GRAY;

  // a card's clock while a session runs is the minute, so its minutes move; otherwise HA's date, read
  // once a minute, for the date gate and the counters' reset
  function watchClock(card, sessions) {
    const now = Date.now(), m = minuteKeyOf(now), list = ((card._hass.states[sessions] || {}).attributes || {}).seansid;
    if (Array.isArray(list) && list.length && list[list.length - 1].end == null) return m;
    if (card._dayAt !== m) { card._dayAt = m; card._day = dateIn(now, tzOf(card._hass)); }
    return card._day;
  }

  // today's sessions [{ app, start, end }] in ms, end null while running: the session sensor's list
  // while its state is today's date in HA's zone (ADR-017), none otherwise
  function todaySessions(st, now, tz) {
    if (!st || st.state !== dateIn(now, tz)) return [];
    const list = (st.attributes || {}).seansid;
    if (!Array.isArray(list)) return [];
    return list.filter(x => x && Number.isFinite(x.start)).map(x => ({ app: String(x.app), start: x.start * 1000, end: Number.isFinite(x.end) ? x.end * 1000 : null }));
  }

  // the now card's text, { kind, label, big, note, color }: 'on' the app with how long its running
  // session has run (none on the home screen, which is no session), 'off' with today's last ended
  // session, 'down' while the TV has no state
  function tvNow(conf, states, now, lang = 'et', tz = localZone()) {
    const w = words(lang), st = states[conf.entity];
    const list = todaySessions(states[conf.sessions], now, tz), last = list[list.length - 1];
    if (!hasValue(st)) return { kind: 'down', label: w.stateNow, big: w.tvDown, note: '', color: GRAY };
    if (st.state === 'off') return { kind: 'off', label: w.offState, big: w.tvIsOff, note: last && last.end !== null ? w.lastUntil(last.app, clockAt(last.end, tz)) : '', color: GRAY };
    const app = states[conf.app], name = hasValue(app) ? app.state : cap(stateWord(st, lang));
    const run = last && last.end === null ? last : null;
    return { kind: 'on', label: w.stateNow, big: name, note: run ? w.since(durText((now - run.start) / HOUR, lang), clockAt(run.start, tz)) : '', color: appColor(conf.apps, name) };
  }

  // today's watch time, { total, rows, bar }: the counters' sum in hours, the apps used for 30 s or
  // more, longest first, and their shares of the bar in per cent
  function usageToday(conf, states, now, tz) {
    const all = conf.entities.map(e => ({ ...e, h: todayHours(states[e.entity], now, tz) }));
    const rows = all.filter(r => r.h * 3600 >= 30).sort((a, b) => b.h - a.h), used = rows.reduce((a, r) => a + r.h, 0);
    return { total: all.reduce((a, r) => a + r.h, 0), rows, bar: rows.map(r => ({ color: r.color, pct: (r.h / used) * 100 })) };
  }

  // today's sessions of a minute or more, newest first: { when, app, color, dur }, the running one
  // to now
  function sessionRows(conf, states, now, lang = 'et', tz = localZone()) {
    const w = words(lang);
    return todaySessions(states[conf.sessions], now, tz).map(s => ({ ...s, to: s.end ?? now })).filter(s => s.to - s.start >= 60e3).reverse()
      .map(s => ({ when: `${clockAt(s.start, tz)}–${s.end === null ? w.nowRow : clockAt(s.end, tz)}`, app: s.app, color: appColor(conf.entities, s.app), dur: durText((s.to - s.start) / HOUR, lang) }));
  }

  const TV_CSS = `
  .box{display:flex;flex-direction:column;gap:16px;padding:16px;border-radius:26px}
  .top{display:flex;align-items:center;gap:14px}
  .ic{flex:none;width:52px;height:52px;border-radius:15px;color:#fff;display:flex;align-items:center;justify-content:center}
  .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .lab{font-size:13px;font-weight:600;color:var(--sub)}
  .big{font-size:26px;line-height:1.12;font-weight:700;letter-spacing:-0.022em;overflow-wrap:anywhere}
  .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 8px;border-radius:14px;background:var(--iconOff);font-size:15px;font-weight:600;text-align:center}
  .btn.stop{background:var(--highBg);color:var(--high)}
  .prof{display:flex;flex-direction:column;gap:8px}
  .hr{height:0.5px;background:var(--hair)}
  .ps{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px}
  .ps .btn{gap:6px;border-radius:12px;font-size:14px}
  `;

  // Teler's now card (ADR-017): what is on, how long, and the TV's controls. Config: { entity, app,
  // sessions, apps: [{ name, color }], buttons: { power_off, power_on, remote }, profiles: [{ name,
  // tap_action, lock }] }; every action is the generator's tap_action, so HA asks for its
  // confirmation. Off it offers power_on and no profiles; without a state only the remote.
  class TvCard extends KheCard {
    static a3only = true;
    static css = TV_CSS;
    _check(c) { if (!c.entity || !c.buttons) throw new Error('khe-tv-card: entity and buttons are required'); }
    _watched() { const c = this._config; return [c.entity, c.app, c.sessions].filter(Boolean); }
    _clock() { return this._hass ? watchClock(this, this._config.sessions) : 0; }
    _html(states, pal) {
      const c = this._config, w = this._w, b = c.buttons, n = tvNow(c, states, Date.now(), this._lang, tzOf(this._hass));
      this._actions = new Map();
      const btn = (k, action, cls, ic, text, aria, after = '') => {
        this._actions.set(k, actionDetail(c.entity, action));
        return `<button type="button" class="press btn${cls}" data-k="${k}" aria-label="${esc(aria)}">${ic ? icon(ic, 17, 'currentColor') : ''}${esc(text)}${after}</button>`;
      };
      const power = n.kind === 'on' ? btn('off', b.power_off, ' stop', 'power', w.turnOff, w.turnOffAria) : n.kind === 'off' && b.power_on ? btn('on', b.power_on, '', 'power', w.turnOn, w.turnOnAria) : '';
      const remote = b.remote ? btn('remote', b.remote, '', 'remote', w.remote, w.remoteAria) : '';
      const profiles = n.kind === 'on' && (c.profiles || []).length
        ? `<span class="prof"><span class="hr"></span><span class="lab">${w.switchProfile}</span><span class="ps">${c.profiles.map((p, i) => btn(`p${i}`, p.tap_action, '', null, p.name, w.profileAria(p.name) + (p.lock ? `, ${w.pinNote}` : ''), p.lock ? icon('lock', 12, pal.sub) : '')).join('')}</span></span>`
        : '';
      const bg = n.kind === 'on' ? n.color : pal.dark ? '#3a3a40' : GRAY;
      return `<div class="glass box"><span class="top"><span class="ic" style="background:${bg}">${icon('tv', 26, '#fff')}</span><span class="tx"><span class="lab">${esc(n.label)}</span><span class="big">${esc(n.big)}</span>${n.note ? `<span class="lab num">${esc(n.note)}</span>` : ''}</span></span>${power || remote ? `<span class="two">${power}${remote}</span>` : ''}${profiles}</div>`;
    }
  }

  const USAGE_CSS = `
  .box{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:24px}
  .box.list{gap:0;padding:6px 16px}
  .hd{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .total{font-size:34px;line-height:1;font-weight:700;letter-spacing:-0.022em}
  .lab{font-size:13px;font-weight:600;color:var(--sub)}
  .bar{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px;background:var(--track)}
  .rows{display:flex;flex-direction:column}
  .row{display:flex;align-items:center;gap:10px;min-height:44px;width:100%}
  .row + .row{border-top:0.5px solid var(--hair)}
  .dot{flex:none;width:10px;height:10px;border-radius:5px}
  .mark{flex:none;width:3px;height:22px;border-radius:2px}
  .nm{flex:1;min-width:0;font-size:15px;font-weight:600}
  .v{font-size:15px;font-weight:600;color:var(--sub)}
  .when{flex:none;width:104px;white-space:nowrap;font-size:14px;font-weight:600;color:var(--sub)}
  .d{font-size:14px;color:var(--sub)}
  .none{padding:10px 0;font-size:15px;color:var(--sub)}
  `;

  // Teler's watch time (ADR-017): `part: 'today'` today's total with yesterday's beside it, a bar by
  // app and the apps used today, each opening its counter's sheet; `part: 'sessions'` today's
  // sessions with their times. Config: { entities: [{ entity, name, color }], compare: { entity },
  // sessions, part }; the counters' units are hours.
  class UsageCard extends KheCard {
    static a3only = true;
    static css = USAGE_CSS;
    _check(c) { if (!(c.entities || []).length) throw new Error('khe-usage-card: entities is required'); }
    _watched() { const c = this._config; return [...c.entities.map(e => e.entity), (c.compare || {}).entity, c.sessions].filter(Boolean); }
    _clock() { return this._hass ? watchClock(this, this._config.sessions) : 0; }
    _html(states) {
      const c = this._config, w = this._w, L = this._lang, now = Date.now(), tz = tzOf(this._hass);
      this._actions = new Map();
      this._sheets = new Map();
      const none = `<span class="none">${esc(w.notWatched)}</span>`;
      if (c.part === 'sessions') {
        const rows = sessionRows(c, states, now, L, tz).map(r => `<span class="row"><span class="when num">${esc(r.when)}</span><span class="mark" style="background:${r.color}"></span><span class="nm">${esc(r.app)}</span><span class="d num">${esc(r.dur)}</span></span>`);
        return `<div class="glass box list"><span class="rows">${rows.join('') || none}</span></div>`;
      }
      const u = usageToday(c, states, now, tz), cmp = c.compare && states[c.compare.entity];
      const rows = u.rows.map((r, i) => {
        this._sheets.set(`a${i}`, cellSheet({ name: r.name, entity: r.entity, decimals: 2, history: { source: 'history' } }, states, L));
        return `<button type="button" class="press row" data-k="a${i}" aria-label="${esc(w.history(`${r.name} ${durText(r.h, L)}`))}"><span class="dot" style="background:${r.color}"></span><span class="nm">${esc(r.name)}</span><span class="v num">${esc(durText(r.h, L))}</span></button>`;
      });
      const bar = u.bar.map(x => `<i style="flex:${x.pct.toFixed(1)};background:${x.color}"></i>`).join('');
      return `<div class="glass box"><span class="hd"><span class="total num">${esc(durText(u.total, L))}</span>${numOf(cmp) !== null ? `<span class="lab num">${esc(w.yesterdayDur(durText(numOf(cmp), L)))}</span>` : ''}</span>${rows.length ? `<span class="bar" aria-hidden="true">${bar}</span><span class="rows">${rows.join('')}</span>` : none}</div>`;
    }
  }

  return {
    exports: { cameraUrl, cameraSlot, cameraThumbs, todaySessions, tvNow, usageToday, sessionRows },
    elements: [
    ["khe-cameras-card", CamerasCard, "KHE cameras", "The cameras' stills, one large with the others as thumbnails (A3)."],
    ["khe-tv-card", TvCard, "KHE TV", "What is on the TV now, for how long, and its controls (A3)."],
    ["khe-usage-card", UsageCard, "KHE usage", "Today's watch time by app, or today's sessions (A3)."],
  ]
  };
}
