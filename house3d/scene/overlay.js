// The marker and label overlay over the 3D view: the markers, the room labels and the room
// chips, their DOM and CSS, the collision pass that places them every frame, and the hover and
// tap rectangles. createOverlay(deps) makes one mount's overlay; collide(), inChip(), hitRect(),
// markerClass() and drawnAt() are pure and exported for the tests.
//
// The core (house3d.js) owns everything else and passes in what the overlay reads, the deps
// createOverlay() lists. The overlay's CSS reads the --h3d-* variables the core sets on .h3d,
// and the core appends OVERLAY_STYLE to its own style.

export const OVERLAY_STYLE = `
.h3d-overlay { position: absolute; inset: 0; pointer-events: none; overflow: hidden; touch-action: none; }
.h3d-marker { position: absolute; left: 0; top: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px; min-width: 40px; padding: 0 12px 0 10px; box-sizing: border-box; border-radius: 20px;
  border: 0.5px solid rgba(255, 255, 255, 0.3); background: var(--h3d-fill); color: var(--h3d-ink);
  font: 600 13px/1 var(--h3d-ui); font-variant-numeric: tabular-nums; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  transition: background-color .2s, color .2s; will-change: transform; }
.h3d-marker svg { width: 19px; height: 19px; flex: none; }
.h3d-marker.round { width: 40px; padding: 0; }
.h3d-marker.cam { border-radius: 13px; color: #10131a; background: rgba(255, 255, 255, 0.92); border-color: #fff; }
.h3d-marker.on { color: #2b1d00; background: var(--h3d-amber); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 18px rgba(255, 190, 90, 0.45); }
.h3d-marker.alert { color: #280500; background: var(--h3d-alert); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 18px rgba(255, 90, 76, 0.5); }
.h3d-marker.off { color: rgba(255, 255, 255, 0.55); background: var(--h3d-fill); border: 1px dashed rgba(255, 255, 255, 0.45); box-shadow: none; }
.h3d-marker.sel { outline: 3px solid var(--h3d-line); outline-offset: 2px; }
.h3d-marker.pulse::after { content: ""; position: absolute; inset: -6px; border-radius: 26px;
  border: 1.5px solid var(--h3d-amber); animation: h3d-ring 1.2s ease-out infinite; }
.h3d-marker.cam.pulse::after { border-radius: 19px; }
.h3d-marker.alert.pulse::after { border-color: var(--h3d-alert); }
.h3d-marker:focus-visible { outline: 2px solid var(--h3d-amber); outline-offset: 2px; }
@keyframes h3d-ring { from { opacity: .9; transform: scale(.85); } to { opacity: 0; transform: scale(1.35); } }
.h3d-marker.hover { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4); }
@media (prefers-reduced-motion: reduce) { .h3d-marker.pulse::after { animation: none; opacity: .6; } }
.h3d-label { position: absolute; left: 0; top: 0; font: 500 10px/1 var(--h3d-mono); letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--h3d-muted); white-space: nowrap; pointer-events: none; will-change: transform; }
.h3d.h3d-narrow .h3d-label { display: none !important; }
.h3d-marker.dot { width: 12px; min-width: 12px; height: 12px; padding: 0; border: 2px solid var(--h3d-ink); border-radius: 6px; font-size: 0; gap: 0; transition: none; }
.h3d-marker.dot > * { display: none; }
.h3d-marker.dot.off { border: 2px dashed rgba(255, 255, 255, 0.45); }
.h3d-marker.dot.pulse::after { inset: -5px; border-radius: 11px; }
.h3d-chip { position: absolute; left: 0; top: 0; pointer-events: none; display: flex; align-items: center; gap: 7px;
  height: 32px; padding: 0 12px; box-sizing: border-box; border-radius: 16px; white-space: nowrap; cursor: pointer;
  border: 0.5px solid rgba(255, 255, 255, 0.28); background: var(--h3d-fill); color: var(--h3d-ink);
  font: 600 12px/1 var(--h3d-ui); font-variant-numeric: tabular-nums; will-change: transform; transition: border-color .2s;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3); }
.h3d-chip .nm { color: rgba(255, 255, 255, 0.65); }
.h3d-chip .pt { display: flex; align-items: center; gap: 3px; }
.h3d-chip svg { width: 15px; height: 15px; flex: none; }
.h3d-chip.on { border-color: var(--h3d-amber); }
.h3d-chip.on .pt.on { color: var(--h3d-amber); }
.h3d-chip.alert { border-color: var(--h3d-alert); }
.h3d-chip.alert .pt.alert { color: var(--h3d-alert); }
.h3d-chip.compact .nm, .h3d-chip.compact .pt ~ .pt { display: none; }
.h3d-chip.hover { border-color: var(--h3d-ink); }
.h3d-chip:focus-visible { outline: 2px solid var(--h3d-amber); outline-offset: 2px; }
.h3d.h3d-narrow .h3d-chip .nm { display: none; }
.h3d.h3d-real .h3d-label { color: #1d2636; }
`;

/**
 * hitRect(rects, x, y, pad = 0) -> the id of the rectangle { id, x, y, w, h } (centre and size
 * in CSS pixels) that holds (x, y) grown by pad on every side; of several, the one whose centre
 * is nearest. null for none.
 */
export function hitRect(rects, x, y, pad = 0) {
  let best = null, bestD = Infinity;
  for (const r of rects) {
    if (Math.abs(x - r.x) > r.w / 2 + pad || Math.abs(y - r.y) > r.h / 2 + pad) continue;
    const d = Math.hypot(x - r.x, y - r.y);
    if (d < bestD) { bestD = d; best = r.id; }
  }
  return best;
}

/**
 * collide(items, pad = 4) -> Map id -> level: the size index each item is drawn at, -1 hidden.
 * items: [{ id, kind: 'alert' | 'marker' | 'chip', chip?, keep?, x, y, dist, was, sizes: [[w, h, dx?, dy?], ...] }],
 * centre in CSS pixels, dist from the camera, was whether it showed last frame, sizes from the
 * full one down, each optionally moved off the centre by (dx, dy). A chip's sizes are its full
 * form, then its compact form in one or more places; a marker's its full form, then a dot. A chip
 * in alert is kind 'alert' with chip true.
 * Greedy, in passes: alerts (an alert never hides, so it takes its place even over another), a
 * marker at full size, a chip at its first compact size that fits, else its first compact size
 * anyway; every other chip at its first compact size that fits, so a room's summary survives a
 * crowd; markers at full size; each placed chip grown back to full where that fits; the markers
 * that did not fit at their smaller sizes; then a keep marker that still did not fit at its dot
 * even where that overlaps, after every other marker had its try; what is left hides. Within a pass nearest first, and
 * what showed last frame counts as 15% nearer, so a tie keeps last frame's winner. A size fits
 * when its rectangle, grown by pad, overlaps nothing placed.
 */
export function collide(items, pad = 4) {
  const score = it => it.dist * (it.was ? 0.85 : 1);
  const of = kind => items.filter(it => it.kind === kind).sort((a, b) => score(a) - score(b));
  const placed = new Map(), out = new Map();
  const box = (it, i) => { const [w, h, dx = 0, dy = 0] = it.sizes[i]; return { x: it.x + dx, y: it.y + dy, w, h }; };
  const free = (b, self) => {
    for (const [id, r] of placed) if (id !== self && Math.abs(b.x - r.x) * 2 < b.w + r.w + 2 * pad && Math.abs(b.y - r.y) * 2 < b.h + r.h + 2 * pad) return false;
    return true;
  };
  const put = (it, level) => { placed.set(it.id, box(it, level)); out.set(it.id, level); };
  // the first size in [from, to) that fits
  const fit = (it, from, to = it.sizes.length) => {
    for (let i = from; i < to; i++) if (free(box(it, i))) { put(it, i); return true; }
    return false;
  };
  const small = it => (it.sizes.length > 1 ? 1 : 0);
  const alerts = of('alert'), chips = of('chip'), grow = [...alerts.filter(it => it.chip), ...chips];
  alerts.forEach(it => { if (!it.chip) put(it, 0); else if (!fit(it, small(it))) put(it, small(it)); });
  chips.forEach(it => { if (!fit(it, small(it))) out.set(it.id, -1); });
  const late = of('marker').filter(it => !fit(it, 0, 1));
  grow.forEach(it => { if (out.get(it.id) > 0 && free(box(it, 0), it.id)) put(it, 0); });
  const forced = late.filter(it => !fit(it, 1));
  forced.forEach(it => { if (it.keep) put(it, 1); else out.set(it.id, -1); });
  return out;
}

// where a marker is drawn: its own at, else the device's pos (which a view fan keeps)
export const drawnAt = m => m.at || m.pos;

const hasValue = m => m.value !== undefined && m.value !== null && m.value !== '';

/**
 * markerClass(m, selected) -> a marker's class list: round without a value, its state, pulse,
 * cam for a camera (drawn apart, since its tap opens a picture) and sel while selected.
 */
export function markerClass(m, selected = false) {
  const c = ['h3d-marker'];
  if (!hasValue(m)) c.push('round');
  if (m.icon === 'camera') c.push('cam');
  if (m.state === 'on' || m.state === 'alert' || m.state === 'off') c.push(m.state);
  if (m.pulse) c.push('pulse');
  if (selected) c.push('sel');
  return c.join(' ');
}

// a crowded marker's dot as drawn, and as tapped: a whole marker
const DOT = [12, 12], DOT_HIT = [40, 40];

/**
 * inChip(m, chip, focus) -> true when marker m is counted in its room's chip instead of drawn
 * alone. chip is the setRoomChips entry of m's room, or null when that room shows no chip (the
 * roof on). Its room must not be the focused one, and the marker either quiet (neither 'alert'
 * nor 'on') or listed in the chip's ids; an active marker the chip does not count still shows.
 */
export function inChip(m, chip, focus) {
  if (!chip || !m.room || chip.room !== m.room || m.room === focus) return false;
  return (m.state !== 'alert' && m.state !== 'on') || (!!chip.ids && chip.ids.includes(m.id));
}

/**
 * createOverlay(deps) -> { setMarkers(list), setRoomChips(list), rerender(), at(ev), hover(key),
 *                          frame(dt), resized(narrow), count }
 * deps: THREE (for a scratch Vector3), root (the .h3d element) and el (the .h3d-overlay div the
 *   core made), camera, width() and height() of the view, rooms and roomById, options (labels,
 *   onMarker, onRoom), reduceMotion, the core's toScreen and icon, getters roofFade(), mode(),
 *   selection(), focus() and markersOn() (the markers switch), invalidate, and narrowBelow, the
 *   width under which the view is narrow.
 * setMarkers and setRoomChips are mount()'s DOM part (the core forwards the list to the layers);
 * rerender() redraws the markers after the selection changed; at(ev) is the marker or chip under
 * a pointer as 'm:<id>' or 'c:<room>', hover(key) gives it the hover border; frame(dt) places
 * everything for this frame and is true while a fade runs; resized(narrow) re-measures the chips
 * when the view crosses narrowBelow; count is the number of markers.
 */
export function createOverlay(deps) {
  const { THREE, root, el: overlay, camera, rooms, roomById, options, reduceMotion, toScreen, icon, narrowBelow } = deps;
  const v = new THREE.Vector3();

  const esc = t => String(t).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
  const roomName = r => (options.labels && options.labels(r.id)) || r.name;
  const labels = rooms.map(r => {
    const el = document.createElement('div');
    el.className = 'h3d-label';
    el.textContent = roomName(r);
    overlay.appendChild(el);
    const [x0, z0, x1, z1] = r.rects[0];
    const [lx, lz] = r.label || [(x0 + x1) / 2, (z0 + z1) / 2];
    return { room: r.id, el, pos: new THREE.Vector3(lx, 0.05, lz), disp: '', op: -1, tf: '' };
  });
  const labelPos = Object.fromEntries(labels.map(l => [l.room, l.pos]));
  // the house rooms: every room but a paved one (the carport), as homeBox() frames them
  const houseRooms = new Set(rooms.filter(r => r.floor !== 'paving').map(r => r.id));

  const markers = new Map(); // id -> { data, el }
  const isIndoor = m => !!(m.room && roomById[m.room]);

  // a change of class or content can change the size, which is measured again on the next frame
  // that shows the marker (a hidden one measures 0)
  function renderMarker(rec) {
    const m = rec.data;
    const cls = markerClass(m, deps.selection() === m.id);
    if (rec.cls !== cls) { rec.el.className = cls + (rec.hover ? ' hover' : ''); rec.cls = cls; rec.size = null; }
    const html = icon(m.icon) + (hasValue(m) ? `<span>${esc(m.value)}</span>` : '');
    if (rec.html !== html) { rec.el.innerHTML = html; rec.html = html; rec.size = null; }
    const label = m.label || m.id, aria = m.stateText ? `${label}, ${m.stateText}` : label;
    if (rec.aria !== aria) { rec.el.setAttribute('aria-label', aria); rec.el.title = aria; rec.aria = aria; }
  }
  // the markers on screen now, as hitRect() takes them; a marker fading in or out under the roof
  // takes taps only once it is mostly there; a dot is drawn small but tapped as a whole marker
  const shownRects = () => {
    const out = [];
    for (const [id, rec] of markers) if (rec.shown && rec.size && rec.op >= 0.5) { const [w, h] = rec.level === 1 ? DOT_HIT : rec.size; out.push({ id: `m:${id}`, x: rec.sx, y: rec.sy, w, h }); }
    for (const [room, rec] of chips) if (rec.shown && rec.size && rec.op >= 0.5) { const [w, h] = rec.level >= 1 ? rec.compact : rec.size; out.push({ id: `c:${room}`, x: rec.sx, y: rec.sy, w, h }); }
    return out;
  };

  function setMarkers(list) {
    const seen = new Set();
    list.forEach(m => {
      seen.add(m.id);
      let rec = markers.get(m.id);
      if (!rec) {
        const el = document.createElement('button');
        el.type = 'button';
        // markers take no pointer (a drag over one orbits), so this is the keyboard's Enter and Space
        el.addEventListener('click', ev => { ev.stopPropagation(); if (options.onMarker) options.onMarker(m.id); });
        overlay.appendChild(el);
        rec = { el, html: '', cls: '', aria: '', size: null, shown: false, disp: '', op: -1, tf: '', sx: 0, sy: 0, hover: false, alpha: 0, level: -1 };
        markers.set(m.id, rec);
      }
      rec.data = m;
      renderMarker(rec);
    });
    for (const [id, rec] of markers) if (!seen.has(id)) { rec.el.remove(); markers.delete(id); }
    deps.invalidate();
  }

  // room chips: one per house room, at its label's place, in place of the label while the roof is
  // off; a chip's parts are generic { icon, text? }, its state colours the border
  const chips = new Map(); // room -> { data, el, ... }
  function setRoomChips(list) {
    const seen = new Set();
    (list || []).forEach(c => {
      if (!houseRooms.has(c.room)) return;
      seen.add(c.room);
      let rec = chips.get(c.room);
      if (!rec) {
        const el = document.createElement('button');
        el.type = 'button';
        el.addEventListener('click', ev => { ev.stopPropagation(); if (options.onRoom) options.onRoom(c.room); });
        overlay.appendChild(el);
        rec = { el, html: '', cls: '', size: null, compact: null, shown: false, disp: '', op: -1, tf: '', sx: 0, sy: 0, hover: false, alpha: 0, level: -1 };
        chips.set(c.room, rec);
      }
      rec.data = c;
      const parts = c.parts || [], name = roomName(roomById[c.room]);
      const cls = `h3d-chip${c.state === 'on' || c.state === 'alert' ? ` ${c.state}` : ''}`;
      if (rec.cls !== cls) { rec.el.className = cls + (rec.hover ? ' hover' : ''); rec.cls = cls; }
      const html = `<span class="nm">${esc(name)}</span>` + parts.map(q => `<span class="pt${q.state ? ` ${q.state}` : ''}">${icon(q.icon)}${q.text ? `<span>${esc(q.text)}</span>` : ''}</span>`).join('');
      if (rec.html !== html) { rec.el.innerHTML = html; rec.html = html; rec.size = null; }
      const aria = [name, ...parts.map(q => q.label || q.text).filter(Boolean)].join(', ');
      if (rec.aria !== aria) { rec.el.setAttribute('aria-label', aria); rec.aria = aria; }
    });
    for (const [room, rec] of chips) if (!seen.has(room)) { rec.el.remove(); chips.delete(room); }
    deps.invalidate();
  }

  // the marker or chip under a pointer, in the overlay's CSS pixels, as 'm:<id>' or 'c:<room>';
  // a touch gets a little slack
  function markerAt(ev) {
    const rect = root.getBoundingClientRect();
    return hitRect(shownRects(), ev.clientX - rect.left, ev.clientY - rect.top, ev.pointerType === 'mouse' ? 0 : 6);
  }
  const recOf = k => (k ? (k[0] === 'm' ? markers : chips).get(k.slice(2)) : null);
  let hoverMarker = null;
  function setHoverMarker(id) {
    if (id === hoverMarker) return;
    // the hover border keeps the size, so the item stays measured and tappable
    [hoverMarker, id].forEach(k => { const rec = recOf(k); if (rec) { rec.hover = k === id; rec.el.classList.toggle('hover', rec.hover); } });
    hoverMarker = id;
  }

  // the overlay writes a style only when its value changed
  function place(rec, el, disp, op, tf) {
    if (rec.disp !== disp) { el.style.display = disp; rec.disp = disp; }
    if (disp === 'none') return;
    if (rec.op !== op) { el.style.opacity = op.toFixed(2); rec.op = op; }
    if (rec.tf !== tf) { el.style.transform = tf; rec.tf = tf; }
  }
  const at = p => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
  // An item is measured once per content change, shown for that read at its current opacity.
  // The full size is read without last frame's dot or compact class, which a content change keeps.
  const measure = rec => {
    if (rec.disp !== '') { rec.el.style.display = ''; rec.disp = ''; }
    const small = ['dot', 'compact'].filter(c => rec.el.classList.contains(c));
    small.forEach(c => rec.el.classList.remove(c));
    rec.size = [rec.el.offsetWidth, rec.el.offsetHeight];
    // a chip's compact form is its first part alone, in the same padding and border
    if (rec.compact !== undefined) {
      const pt = rec.el.querySelector('.pt');
      rec.compact = pt ? [pt.offsetWidth + rec.size[0] - rec.el.clientWidth + 18, rec.size[1]] : null;
    }
    small.forEach(c => rec.el.classList.add(c));
  };
  // Which markers and chips are candidates, the collision pass over them, then each one's opacity
  // eased towards shown or hidden (times the roof's fade). True while a fade runs.
  function overlayFrame(dt) {
    const width = deps.width(), height = deps.height(), focus = deps.focus(), markersOn = deps.markersOn();
    const roofOpen = Math.max(0, 1 - deps.roofFade() * 1.6);
    // chips stand in for their rooms' quiet markers only while the roof is off
    const chipsOn = markersOn && deps.mode() === 'open' && roofOpen > 0.02;
    // a chip off screen still stands in for its quiet markers, but not for the active ones it counts;
    // it reads this frame's rec.p, so the chips are projected before the markers
    const chipOf = room => {
      const rec = chipsOn && room ? chips.get(room) : null;
      return !rec ? null : rec.p ? rec.data : rec.quiet || (rec.quiet = { room });
    };
    const narrow = width < narrowBelow, items = [];
    for (const [room, rec] of chips) {
      const parts = rec.data.parts || [];
      const p = chipsOn && room !== focus && !(narrow && !parts.length) ? toScreen(camera, labelPos[room], width, height, v) : null;
      rec.fac = roofOpen;
      rec.p = p;
      if (!p) continue;
      if (!rec.size) measure(rec);
      // a crowded chip tries its first part alone, at its place, then just above, then just below
      const c = rec.compact, off = rec.size[1] + 6;
      items.push({ id: `c:${room}`, kind: rec.data.state === 'alert' ? 'alert' : 'chip', chip: true, x: p.x, y: p.y, dist: camera.position.distanceTo(labelPos[room]), was: rec.level >= 0, sizes: c ? [rec.size, c, [c[0], c[1], 0, -off], [c[0], c[1], 0, off]] : [rec.size] });
      rec.offs = [0, 0, -off, off];
    }
    for (const [id, rec] of markers) {
      // an alert indoors shows through the roof, so a closed view never hides it
      const m = rec.data, covered = isIndoor(m) && m.state !== 'alert';
      const p = (markersOn || m.state === 'alert') && !(covered && roofOpen <= 0.02) && !inChip(m, chipOf(m.room), focus) ? toScreen(camera, drawnAt(m), width, height, v) : null;
      rec.fac = covered ? roofOpen : 1;
      rec.p = p;
      if (!p) continue;
      if (!rec.size) measure(rec);
      items.push({ id: `m:${id}`, kind: m.state === 'alert' ? 'alert' : 'marker', x: p.x, y: p.y, dist: camera.position.distanceTo(v.set(...drawnAt(m))), was: rec.level >= 0, keep: m.icon === 'camera', sizes: [rec.size, DOT] });
    }
    const levels = collide(items);
    let fading = false;
    const step = reduceMotion ? 1 : dt / 0.2;
    const apply = (key, rec, small) => {
      const level = rec.p ? levels.get(key) : -1;
      const goal = level >= 0 ? 1 : 0;
      rec.alpha = goal > rec.alpha ? Math.min(goal, rec.alpha + step) : Math.max(goal, rec.alpha - step);
      if (rec.alpha !== goal) fading = true;
      // a hidden item keeps its last place and size while it fades out
      if (level >= 0) { rec.level = level; rec.sx = rec.p.x; rec.sy = rec.p.y + (rec.offs ? rec.offs[level] : 0); rec.el.classList.toggle(small, level >= 1); }
      else if (!rec.p || rec.alpha === 0) rec.level = -1;
      const op = Math.round(rec.alpha * rec.fac * 100) / 100;
      rec.shown = level >= 0;
      if (op <= 0) { place(rec, rec.el, 'none'); return; }
      place(rec, rec.el, '', op, at({ x: rec.sx, y: rec.sy }));
    };
    for (const [id, rec] of markers) apply(`m:${id}`, rec, 'dot');
    for (const [room, rec] of chips) apply(`c:${room}`, rec, 'compact');
    labels.forEach(l => {
      const p = roofOpen < 0.02 || chipOf(l.room) ? null : toScreen(camera, l.pos, width, height, v);
      place(l, l.el, p ? '' : 'none', Math.round(roofOpen * 80) / 100, p ? at(p) : '');
    });
    return fading;
  }

  // the chips' sizes are measured again when the view crosses the narrow breakpoint, where a chip
  // drops its room name
  let narrowWas = false;
  function resized(narrow) {
    if (narrowWas !== narrow) chips.forEach(c => { c.size = null; });
    narrowWas = narrow;
  }

  return {
    setMarkers, setRoomChips, resized,
    rerender: () => markers.forEach(renderMarker),
    at: markerAt,
    hover: setHoverMarker,
    frame: overlayFrame,
    get count() { return markers.size; }
  };
}
