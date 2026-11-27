// Base card classes: KheCard (shadow DOM, throttling, actions, sheet) and LoadingCard (shared recorder loads).
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ cssVars, palette, a3Palette, A3_CSS, words, DAY, tzOf, hourKeyOf, minuteKeyOf, fetchShared, stateHistoryRequest, onTimes, mergeTimes, liveOn, historyStale, Sheet } = {}) {
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
      if (this._hass && this.isConnected) this._refresh();
    }
    // HA sets hass on every state change in the house: compare by identity, build nothing. HA's
    // hui-card takes a hidden card out of the DOM and still sets hass on it, so a card out of the
    // DOM draws only when it is connected again.
    set hass(hass) {
      this._hass = hass;
      if (this._config && this.isConnected) this._refresh();
    }
    get hass() { return this._hass; }
    connectedCallback() {
      if (this._config && this._hass) this._refresh();
    }
    _refresh() {
      const hass = this._hass;
      const dark = !!(hass.themes && hass.themes.darkMode), clock = this._clock(), seen = this._seen;
      if (seen && seen[0] === dark && seen[1] === clock && this._ids.every((e, i) => seen[i + 2] === this._stamp(hass.states[e]))) return;
      this._seen = [dark, clock, ...this._ids.map(e => this._stamp(hass.states[e]))];
      this._draw();
      if (this._sheet) this._sheet.live();
    }
    getCardSize() { return 3; }
    getGridOptions() { return { columns: 'full' }; }
    _check() {}
    _watched() { return []; }
    // what of a watched state redraws the card: any new state object by default
    _stamp(st) { return st; }
    _clock() { return 0; }
    _draw() {
      if (!this._config || !this._hass) return;
      if (this._holding) { this._stale = true; return; }
      const pal = this._style();
      // keep the focus on the same control across a redraw, without scrolling to it: a redraw
      // comes with any watched state change, long after the operator scrolled away
      const focused = this.shadowRoot.activeElement && this.shadowRoot.activeElement.dataset.k;
      this._root.innerHTML = this._html(this._hass.states, pal);
      if (focused) { const el = this._root.querySelector(`[data-k="${CSS.escape(focused)}"]`); if (el) el.focus({ preventScroll: true }); }
      if (this._wire) this._wire();
    }
    // the palette of HA's theme; the style changes only with it
    _style() {
      const dark = !!(this._hass.themes && this._hass.themes.darkMode);
      const pal = this._a3 ? a3Palette(dark) : palette(dark);
      if (this._cssDark !== dark) {
        const C = this.constructor, own = this._a3 && C.a3css !== undefined ? C.a3css : C.css;
        this._styleEl.textContent = `${cssVars(pal)}${BASE_CSS}${this._a3 ? A3_CSS : ''}${own}`;
        this._cssDark = dark;
      }
      return pal;
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

  // a card that loads recorder data before it draws: the load runs when the HA-zone hour changes,
  // a result redraws the card, a newer load wins; after an error the next try waits a minute.
  // _requests() names its messages ({ cutoff: msg, ... }); the data has the responses by those names.
  // A card with _historyIds() also reads their state history (ADR-015): under the name `hist`, not
  // shared, reloaded when it is connected again with data older than five minutes, its live
  // off-to-on changes merged in between, and redrawn on a minute key of its own.
  // each config's last load, so a card HA rebuilds or configures again (on every dashboard save)
  // draws its data at once instead of collapsing to "loading", which pulls the page up under the
  // reader's finger; a stale one still reloads (_ensure, connectedCallback) over it
  const LOADED = new Map();

  class LoadingCard extends KheCard {
    static a3only = true;
    _loadKey() { return this._hass ? hourKeyOf(Date.now(), tzOf(this._hass)) : 0; }
    _clock() { return this._hist().length && this._hass ? minuteKeyOf(Date.now()) : this._loadKey(); }
    _requests() { return {}; }
    _historyIds() { return []; }
    // the history entities, once per config
    _hist() { return (this._hids ??= this._config ? this._historyIds() : []); }
    // another config asks for other data
    setConfig(config) {
      const key = JSON.stringify(config), kept = LOADED.get(key);
      this._key = key; this._loadedFor = kept ? kept.loadedFor : null; this._data = kept ? kept.data : null;
      this._live = {}; this._prev = null; this._hids = null;
      super.setConfig(config);
    }
    set hass(hass) {
      const ids = this._hist();
      if (ids.length) {
        const seen = liveOn(this._prev, hass.states, ids), day = Date.now() - DAY;
        for (const [id, t] of Object.entries(seen)) this._live[id] = [...(this._live[id] || []).filter(x => x > day), t];
        this._prev = Object.fromEntries(ids.map(id => [id, hass.states[id]]));
      }
      super.hass = hass;
    }
    get hass() { return this._hass; }
    _draw() { this._ensure(); super._draw(); }
    _ensure() {
      if (!this._hass || !this._config || !this.isConnected) return;
      const hour = this._loadKey(), now = Date.now();
      if (this._loadedFor === hour || now < (this._retryAt || 0)) return;
      this._loadedFor = hour;
      const tz = tzOf(this._hass), token = (this._token = {}), ids = this._hist();
      const named = Object.entries({ ...this._requests(now, tz), ...(ids.length ? { hist: stateHistoryRequest(ids, now) } : {}) });
      Promise.all(named.map(([k, m]) => (k === 'hist' ? this._hass.callWS(m) : fetchShared(this._hass, m, hour))))
        .then(res => {
          const out = Object.fromEntries(named.map(([k], i) => [k, res[i]]));
          // the raw rows are not kept: only their off-to-on changes
          if (out.hist) out.hist = onTimes(out.hist, ids);
          return { res: out, now, tz };
        }, () => ({ error: true }))
        .then(d => {
          if (this._token !== token) return;
          this._data = d;
          if (d.error) { this._loadedFor = null; this._retryAt = Date.now() + 60e3; }
          else LOADED.set(this._key, { data: d, loadedFor: hour });
          super._draw();
        });
    }
    // each history entity's off-to-on changes in ms, the loaded ones and the live ones since; null
    // until a history has loaded
    _onTimes() {
      const d = this._data;
      if (!d || d.error || !d.res.hist) return null;
      const day = Date.now() - DAY;
      return Object.fromEntries(Object.entries(d.res.hist).map(([id, t]) => [id, mergeTimes(t, this._live[id] || []).filter(x => x > day)]));
    }
    connectedCallback() {
      if (this._config && this._hist().length && historyStale(this._data, Date.now())) this._loadedFor = null;
      // a reconnect draws, so _ensure retries a failed load or reloads a stale history
      this._seen = null;
      super.connectedCallback();
    }
  }

  return { BASE_CSS, Base, KheCard, LOADED, LoadingCard };
}
