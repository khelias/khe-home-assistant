// Device and value tile card: TileCard (Kodu and A3 glass, slider, modes, buttons, switch).
// Loaded by cards/khe-cards.js with ?v=; zero imports.

export default function init({ icon, esc, hasValue, stateOf, words, formatNumber, stateWord, attrText, num, numOf, cap, unitOf, splitValue, litPair, a3Palette, a3Color, actionDetail, tileAction, modeAction, zoneParts, whenText, tzOf, stateIs, KheCard, dayStart } = {}) {
  const DEFAULT_ACTIVE = ['on', 'playing', 'armed_*', 'heat', 'performance'];

  // a state list entry ending in * matches a prefix, so ['*'] lights any available state
  function tileActive(st, active = DEFAULT_ACTIVE) {
    return hasValue(st) && active.some(a => stateIs(st.state, a));
  }

  // One part of a tile's second line: 'state', an attribute, another entity or an object of
  // { entity, attribute, label, format, if, text }: another entity's state or attribute, a label
  // before it, `format: 'when'` for a moment (whenText), `if: [{ entity, state }]` to show it only
  // while each holds (`entity` is the tile's own by default) and `text` for a fixed one.
  const partEntity = p => (p && typeof p === 'object' ? p.entity : typeof p === 'string' && p.includes('.') ? p : null);

  const partIfs = p => (p && typeof p === 'object' && p.if) || [];

  function part(p, st, states, lang, ctx = {}) {
    const o = p && typeof p === 'object' ? p : null;
    if (o && !partIfs(o).every(c => stateOf(states, c.entity || ctx.own) === c.state)) return '';
    if (o && o.text !== undefined) return o.text;
    const e = partEntity(p), src = e ? states[e] : st, key = o ? o.attribute : e || p === 'state' ? null : p;
    let v;
    if (o && o.format === 'when') v = whenText(key ? ((src || {}).attributes || {})[key] : hasValue(src) ? src.state : '', lang, ctx.tz, ctx.now);
    else if (key) v = attrText(src, key, lang);
    else if (e) v = hasValue(src) ? stateWord(src, lang) : '';
    else v = stateWord(st, lang);
    return v && o && o.label ? `${o.label} ${v}` : v;
  }

  // { lit, unavailable, text } for the tile's look and its second line; ctx { tz, now } for a 'when'
  // part. A line whose parts are all conditional and all hidden reads the state word.
  function tileState(conf, states, lang = 'et', ctx = {}) {
    const st = states[conf.entity];
    const sc = conf.state_text;
    // a fixed text (a link's description) stays whatever the entity's state
    if (typeof sc === 'string') return { lit: tileActive(st, conf.active), unavailable: false, text: sc };
    if (!hasValue(st)) return { lit: false, unavailable: true, text: words(lang).words.unavailable };
    const lit = tileActive(st, conf.active);
    let text;
    if (Array.isArray(sc)) {
      text = sc.map(p => part(p, st, states, lang, { ...ctx, own: conf.entity })).filter(Boolean).join(' · ');
      if (!text && sc.length && sc.every(p => partIfs(p).length)) text = stateWord(st, lang);
    } else text = stateWord(st, lang);
    return { lit, unavailable: false, text };
  }

  // the entities a tile redraws on: its own, its segment's and its parts' and their conditions'
  function tileWatched(c) {
    const parts = [c.state_text, c.label].filter(Array.isArray).flat();
    return [...new Set([c.entity, c.modes_entity, ...parts.map(partEntity), ...parts.flatMap(partIfs).map(x => x.entity)].filter(Boolean))];
  }

  // a tile's clock: [the day key in HA's zone, the day's end] while a part reads 'when' (today or
  // yesterday), else [0, Infinity]
  function tileDay(c, now, tz) {
    const sc = c.state_text;
    if (!Array.isArray(sc) || !sc.some(p => p && p.format === 'when')) return [0, Infinity];
    const p = zoneParts(now, tz);
    return [`${p.y}-${p.m}-${p.d}`, dayStart(p.y, p.m, p.d + 1, tz)];
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
    _watched() { return tileWatched(this._config); }
    // a 'when' part reads 'täna' or 'eile', so the tile redraws when HA's day changes
    // the day's key until its end, so a push in the house does no date formatting
    _clock() {
      const now = Date.now();
      if (!this._hass) return 0;
      if (!this._day || now >= this._day[1]) this._day = tileDay(this._config, now, tzOf(this._hass));
      return this._day[0];
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

  // a tile's name: the config's, the entity's friendly name, or its id
  const tileName = (conf, st) => conf.name || ((st || {}).attributes || {}).friendly_name || conf.entity;

  // what a tap on a tile with `history` opens: the tile's value now, the history entity's series
  function tileSheet(conf, states, lang = 'et', ctx = {}) {
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
    if (h.source === 'history' && !h.numeric) spec.text = now => tileState(conf, now, lang, ctx).text;
    return spec;
  }

  // a button's look: pressed when the entity is in the button's state
  const buttonOn = (b, st) => !!b.state && !!st && st.state === b.state;

  // the light's brightness in percent, 0 when off; a pointer at x of a w-wide bar, in steps of 5
  function brightnessPct(st) {
    if (!hasValue(st) || st.state !== 'on') return 0;
    const b = Number((st.attributes || {}).brightness);
    return Number.isFinite(b) ? Math.max(1, Math.round((b / 255) * 100)) : 100;
  }

  const pctAt = (x, w) => Math.max(0, Math.min(100, Math.round(((x / (w || 1)) * 100) / 5) * 5));

  const sliderAction = (entity, pct) => actionDetail(entity, {
    action: 'perform-action', perform_action: 'light.turn_on', target: { entity_id: entity }, data: { brightness_pct: pct }
  });

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
  .seg button[aria-current="true"]{background:var(--segOn);box-shadow:var(--segShadow)}
  .sw{flex:none;display:flex;align-items:center;width:51px;height:44px}
  .sw i{position:relative;display:block;width:51px;height:31px;border-radius:16px;background:var(--track);transition:background 200ms ease-out}
  .sw i::after{content:'';position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:14px;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);transition:left 200ms ease-out}
  .sw[aria-checked="true"] i{background:#34c759}
  .sw[aria-checked="true"] i::after{left:22px}
  .sw:disabled{opacity:.4;cursor:default}
  .val{display:flex;flex-direction:column;gap:6px;width:100%;height:100%;box-sizing:border-box;padding:12px 14px;border-radius:22px}
  .val .lb{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--sub)}
  .val .v{font-size:26px;line-height:1;font-weight:700;letter-spacing:-0.025em}
  @media (prefers-reduced-motion: reduce){.sl i,.sw i,.sw i::after{transition:none}}
  `;

  // the tile's A3 look: small, wide with buttons, a slider or modes, or a value
  function tileA3(card, states, pal) {
    const c = card._config, L = card._lang, w = card._w;
    const st = states[c.entity];
    const name = tileName(c, st);
    const ctx = { tz: tzOf(card._hass), now: Date.now() };
    const ts = tileState(c, states, L, ctx);
    const sheet = tileSheet(c, states, L, ctx);
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
      below += `<span class="sl" data-sl role="slider" tabindex="0" aria-label="${esc(w.brightness(name))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct ? `${pct} %` : w.words.off}"><i style="width:${pct}%"></i></span>`;
    }
    if (c.modes) {
      // the segment may read and write another entity than the tile's (the light's tone select)
      const of = c.modes_entity || c.entity, current = stateOf(states, of);
      below += `<span class="seg" role="group" aria-label="${esc(w.mode(name))}">${c.modes.map((m, i) => {
        card._actions.set(`m${i}`, modeAction(of, m, current));
        return `<button type="button" class="press" data-k="m${i}"${modeLook(m, current)}>${esc(m.name)}</button>`;
      }).join('')}</span>`;
    }
    if (c.switch) card._actions.set('sw', actionDetail(c.entity, { action: 'toggle' }));
    const sw = !c.switch ? '' : `<button type="button" class="sw press" data-k="sw" role="switch" aria-checked="${lit}" aria-label="${esc(name)}"${ts.unavailable ? ' disabled' : ''}><i></i></button>`;
    const chev = c.chevron ? `<span class="chev" aria-hidden="true">${icon('chevron', 14, 'currentColor')}</span>` : '';
    if (c.wide) return `<div class="${cls}"><span class="row">${discEl}${body}${extra}${corner}${sw}${chev}</span>${below}</div>`;
    return `<div class="${cls}"><span class="top">${discEl}${corner}</span>${body}${below}</div>`;
  }

  // A mode button's state attributes: a select's option is pressed while it is the current one; a
  // mode with its own tap_action is a command and is never pressed, unless it names an `option`
  // too: then it is marked current while the entity is in it (an alarm's mode opening HA's dialog),
  // in its `color` if it has one, and says it opens a dialog when its tap is more-info.
  function modeLook(m, current) {
    if (!m.tap_action) return ` aria-pressed="${m.option === current}"`;
    const on = m.option !== undefined && m.option === current;
    const [bg, fg] = on && m.color ? a3Color(m.color) : [];
    return `${on ? ' aria-current="true"' : ''}${m.tap_action.action === 'more-info' ? ' aria-haspopup="dialog"' : ''}${bg ? ` style="background:${bg};color:${fg}"` : ''}`;
  }

  // the A3 tile's markup and its taps for a config and states, without an element (the tests')
  function tileA3Markup(conf, states, lang = 'et', hass = {}) {
    const card = { _config: conf, _lang: lang, _w: words(lang), _hass: { states, ...hass } };
    const html = tileA3(card, states, a3Palette(false));
    return { html, actions: card._actions, sheets: card._sheets };
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

  return {
    exports: { tileActive, tileState, tileWatched, tileDay, tileSheet, buttonOn, brightnessPct, pctAt, sliderAction, tileA3Markup },
    elements: [
    ["khe-tile-card", TileCard, "KHE tile", "A device tile that is lit when on, with optional mode buttons."],
  ]
  };
}
