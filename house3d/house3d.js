// House 3D view engine: builds the scene from a house3d model (see scripts/house3d_model.py)
// and draws generic markers over it. The HA card and the standalone viewer are thin shells
// around mount(); neither the engine nor this directory carries any house data.
//
// This file is the core: renderer and bloom, the real style's sun, sky and shadows, camera,
// controls and framing, the marker and label overlay, roof mode, taps and hover, the frame loop,
// resize and dispose, and the layer registry. It builds no scene geometry. scene/kit.js makes
// each mount's colours, materials and geometry helpers for its style; scene/sun.js holds the
// sun's position and direction as pure functions; scene/layers/ holds one module per scene
// layer, listed in LAYERS below in build order. A new scene layer is a module there and its
// line in LAYERS.
//
// Styles: 'simple' (default) is the unlit neon wireframe; 'real' draws lit surfaces in the
// house's own colours (kit.surface, from photos) under a sun with shadows. A layer branches on
// ctx.style === 'real' and leaves its simple path as it is; tests/house3d/simple-snapshot.json
// pins the simple style's objects and materials.
//
// One layer cannot take the view down: a layer module that fails to load is left out,
// buildLayer() leaves out a layer whose build throws, and guardLayer() switches off for good a
// layer whose update, markers, hit, setOn, listed or api throws. Each logs "house3d: layer <id> failed".
// modelFrame(), buildLayer() and guardLayer() are exported for the tests.
//
// Modules under scene/ load nothing themselves: no import of any kind and no re-export. They get
// THREE, the kit and everything else through ctx. The core loads them with its own URL's query,
// so house3d.js?v=N loads scene/kit.js?v=N and every layer at that version. HA's /local and the
// phone app cache hard and only the URL the card builds carries ?v=, so a module loaded without
// it could stay stale. Module scope under scene/ holds constants only: a module runs once per
// URL, so mutable state there would be shared by a remount or a second card.
//
// Layer contract: a layer module's default export is build(ctx), which returns null when the
// model has nothing for it, otherwise:
//   id, group       the layer's name and its objects
//   lift?           a group that rises and fades with the roof mode (the building's upper part)
//   toggle?         true for a switchable layer; listed()? says whether view.layers shows it now
//   update(dt, k)?  per frame, dt in seconds and k the easing step; true while still animating
//   shades?         true when what update() animates casts shadows (the real style's shadow map
//                   is rendered only on change); a layer that only tints or glows leaves it out
//   markers(list)?  every setMarkers list
//   hit(ray)?       the tap and hover test on the raycaster: null, { car: true } or
//                   { room, target }. Layers are tried in reverse build order, so the car wins
//                   over the floors, and a layer that is off is skipped
//   setOn(on)?      the layer was switched, also before the first frame
//   api?            what the core re-exports (setCar, carState, carScreen) or another layer
//                   calls through ctx.layer(id)
//   dispose()?      frees what the kit's list and the scene traversal do not
// ctx: THREE, kit, C (kit.C), model, options, style ('simple' | 'real'),
//   frame { lotBox, wallBox, ext, E, lotCx, lotCz } (modelFrame),
//   roof { fns, flat, under, topFn, gap }, ceiling, reduceMotion, state (read-only: mode,
//   roofFade, hovered, selection), layer(id), screen(x, y, z) -> { x, y } | null, invalidate().
//   build() and the first setOn() run before the loop exists: they must not call invalidate()
//   or screen().
// The core puts each layer's group and lift under a wrapper group, and switching a layer sets
// only the wrapper's visible. Nothing leaves the scene, so dispose() still reaches every object.
import * as THREE from './vendor/three-0.186.1/build/three.module.js';
import { OrbitControls } from './vendor/three-0.186.1/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from './vendor/three-0.186.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three-0.186.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three-0.186.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three-0.186.1/examples/jsm/postprocessing/OutputPass.js';

const LAYERS = ['ground', 'site', 'trees', 'gates', 'surroundings', 'pergola', 'building', 'car', 'fans'];
const QUERY = new URL(import.meta.url).search;
// a layer module that fails to load drops its layer, not the engine; the kit and the sun are required
const [KIT, SUN, ...LOADED] = await Promise.allSettled(['kit', 'sun', ...LAYERS.map(id => `layers/${id}`)].map(p => import(`./scene/${p}.js${QUERY}`)));
[KIT, SUN].forEach(r => { if (r.status === 'rejected') throw r.reason; });
const { createKit } = KIT.value;
const { sunPosition, gridBearing, sunDirection, sunGlow } = SUN.value;
const BUILDERS = LOADED.map((r, i) => {
  if (r.status === 'fulfilled') return r.value;
  console.error(`house3d: layer ${LAYERS[i]} failed to load`, r.reason);
  return null;
});

const D2R = Math.PI / 180;
const ROOF_GAP = 0.06; // walls stop just under the roof so the two outlines do not z-fight
const BLOOM_MIN_WIDTH = 720;
// the real style's sky: day, blended to dusk below DUSK_ALT degrees of sun, night below 0
const SKY = { day: '#a9c4dc', dusk: '#e8b98a', night: '#0b1430' };
const DUSK_ALT = 8;
const LOW_SUN = '#ffcf9e';
// without a place the real style lights the street side from the left, like an afternoon sun
const FIXED_SUN = [-0.62, 0.62, -0.48];

export const ICONS = {
  light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  climate: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 10v7"/>',
  sensor: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M18 5h2M18 9h2"/>',
  camera: '<path d="M3 7.5h11.5v9H3z"/><path d="M14.5 10.5 21 7v10l-6.5-3.5"/>',
  motion: '<circle cx="13.5" cy="4.5" r="1.7"/><path d="m9 21 2.5-6 2.5 2.5V21M7 12.5l3-3.5 3.5.8 2.5 3.2M11.5 15l1.5-5.2"/>',
  smoke: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v2M12 18.5v2"/>',
  plug: '<path d="M9 2.5v4.5M15 2.5v4.5M6 7h12v3.5a6 6 0 0 1-12 0zM12 16.5v5"/>',
  door: '<path d="M6 21V3h12v18M3 21h18"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>',
  cover: '<path d="M3 21V9.5L12 4l9 5.5V21"/><path d="M7 21v-8h10v8M7 15.5h10M7 18h10"/>',
  vent: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 13 3 15.8 3c3 0 3 4.2-2.4 7.6M13.6 12c4.4 0 7.4 1 7.4 3.8 0 3-4.2 3-7.6-2.4M12 13.6c0 4.4-1 7.4-3.8 7.4-3 0-3-4.2 2.4-7.6M10.4 12C6 12 3 11 3 8.2c0-3 4.2-3 7.6 2.4"/>',
  heatpump: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="9" cy="12" r="3.6"/><path d="M15.5 9h2.5M15.5 12h2.5M15.5 15h2.5"/>',
  alarm: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  room: '<path d="M4 4h16v16H4zM4 12h7v8M15 4v6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  tree: '<path d="M12 2.5a5 5 0 0 0-4.8 6.4A4.3 4.3 0 0 0 8.5 17.5h7a4.3 4.3 0 0 0 1.3-8.6A5 5 0 0 0 12 2.5z"/><path d="M12 21.5v-8M12 15.5l-2.5-2M12 14l2.2-1.8"/>',
  layers: '<path d="M12 3.5 3 8l9 4.5L21 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>'
};
export const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.info}</svg>`;
export const roomArea = room => room.rects.reduce((a, q) => a + (q[2] - q[0]) * (q[3] - q[1]), 0);

const STYLE = `
.h3d { position: relative; width: 100%; height: 100%; overflow: hidden;
  --h3d-line: #6fe3ff; --h3d-ink: #e4ecff; --h3d-muted: #8a9bc2; --h3d-amber: #ffc56e; --h3d-alert: #ff8b7b;
  --h3d-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  background: radial-gradient(ellipse at 50% 55%, #0c1631 0%, #060c1b 70%) #060c1b; }
.h3d-stage { position: absolute; inset: 0; }
.h3d-stage canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.h3d-overlay { position: absolute; inset: 0; pointer-events: none; overflow: hidden; touch-action: none; }
.h3d-marker { position: absolute; left: 0; top: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  height: 32px; min-width: 32px; padding: 0 7px; box-sizing: border-box; border-radius: 16px;
  border: 1px solid rgba(111, 227, 255, 0.35); background: rgba(8, 16, 36, 0.88); color: var(--h3d-line);
  font: 500 12px/1 var(--h3d-mono); font-variant-numeric: tabular-nums; cursor: pointer;
  box-shadow: 0 0 14px rgba(111, 227, 255, 0.18);
  transition: background-color .2s, color .2s, box-shadow .2s, border-color .2s; will-change: transform; }
.h3d-marker svg { width: 16px; height: 16px; flex: none; }
.h3d-marker.round { width: 32px; padding: 0; }
.h3d-marker.on { color: #1c1406; background: var(--h3d-amber); border-color: var(--h3d-amber); box-shadow: 0 0 22px rgba(255, 197, 110, 0.55); }
.h3d-marker.alert { color: #200806; background: var(--h3d-alert); border-color: var(--h3d-alert); box-shadow: 0 0 22px rgba(255, 139, 123, 0.6); }
.h3d-marker.off { filter: grayscale(1); border-style: dashed; box-shadow: none; }
.h3d-marker.sel { outline: 2px solid var(--h3d-ink); outline-offset: 2px; }
.h3d-marker.pulse::after { content: ""; position: absolute; inset: -6px; border-radius: 22px;
  border: 1px solid var(--h3d-amber); animation: h3d-ring 1.2s ease-out infinite; }
.h3d-marker.alert.pulse::after { border-color: var(--h3d-alert); }
.h3d-marker:focus-visible { outline: 2px solid var(--h3d-amber); outline-offset: 2px; }
@keyframes h3d-ring { from { opacity: .9; transform: scale(.85); } to { opacity: 0; transform: scale(1.35); } }
.h3d-marker.hover { border-color: var(--h3d-ink); }
@media (prefers-reduced-motion: reduce) { .h3d-marker.pulse::after { animation: none; opacity: .6; } }
.h3d-label { position: absolute; left: 0; top: 0; font: 500 10px/1 var(--h3d-mono); letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--h3d-muted); white-space: nowrap; pointer-events: none; will-change: transform; }
.h3d.h3d-narrow .h3d-label { display: none !important; }
.h3d.h3d-real .h3d-label { color: #1d2636; }
.h3d-fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
  color: var(--h3d-muted); text-align: center; font: 14px/1.45 system-ui, sans-serif; }
`;

/**
 * modelFrame(model) -> { roof: { fns, flat, under, topFn, gap }, frame: { lotBox, wallBox, ext, E, lotCx, lotCz } }
 * The model's roof height functions and its framing boxes, as ctx carries them.
 */
export function modelFrame(model) {
  const site = model.site || {};
  const fns = {};
  for (const [id, r] of Object.entries(model.roofs || {})) {
    const slope = r.slope ?? Math.tan(r.pitch_deg * D2R);
    const sign = r.falls === 'west' ? -1 : 1;
    fns[id] = x => r.high_y - sign * (x - r.high_x) * slope;
  }
  const flat = h => () => h;
  const under = id => x => fns[id](x) - ROOF_GAP;
  const topFn = top => (typeof top === 'string' ? under(top) : flat(top));

  // the lot sets the scale, the fog and the shadow box; homeBox() frames the home view
  const bbox = pts => pts.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  const lotBox = bbox(site.lot && site.lot.length ? site.lot : (model.walls || []).flatMap(w => [w.a, w.b]));
  const wallBox = bbox((model.walls || []).flatMap(w => [w.a, w.b]));
  const lotCx = (lotBox[0] + lotBox[2]) / 2, lotCz = (lotBox[1] + lotBox[3]) / 2;
  const ext = Math.max(lotBox[2] - lotBox[0], lotBox[3] - lotBox[1]);
  const E = ext / 41; // the prototype's framing was tuned on a 41 m lot
  return { roof: { fns, flat, under, topFn, gap: ROOF_GAP }, frame: { lotBox, wallBox, ext, E, lotCx, lotCz } };
}

/**
 * buildLayer(mod, id, ctx) -> the layer, or null when the model has nothing for it or its
 * build threw (logged as "house3d: layer <id> failed"); the other layers still build.
 */
export function buildLayer(mod, id, ctx) {
  try {
    return mod.default(ctx);
  } catch (e) {
    console.error(`house3d: layer ${id} failed`, e);
    return null;
  }
}

/**
 * guardLayer(L, off) -> L, with update, markers, hit, setOn, listed and the api's functions wrapped:
 * the first throw is logged, off() is called, and from then on none of them runs again
 * (update and listed answer false, hit null). A layer that throws in the frame loop would otherwise
 * stop the loop with raf still set, and nothing would draw again.
 */
export function guardLayer(L, off) {
  let failed = false;
  const wrap = (obj, name, fallback) => {
    const fn = obj[name];
    obj[name] = (...args) => {
      if (failed) return fallback;
      try {
        return fn.apply(obj, args);
      } catch (e) {
        failed = true;
        console.error(`house3d: layer ${L.id} failed`, e);
        off();
        return fallback;
      }
    };
  };
  [['update', false], ['markers', undefined], ['hit', null], ['setOn', undefined], ['listed', false]].forEach(([k, fb]) => { if (typeof L[k] === 'function') wrap(L, k, fb); });
  if (L.api) {
    for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(L.api))) if (typeof d.value === 'function') wrap(L.api, k, undefined);
  }
  return L;
}

/**
 * homeBox(model) -> [x0, z0, x1, z1, top]: the plan box of the house rooms (every room but a
 * paved one, the carport, as the building layer's inRoom() decides; the walls' box without
 * rooms) with the roofs' overhang, and the height of the highest roof or the ceiling.
 */
export function homeBox(model) {
  const rects = (model.rooms || []).filter(r => r.floor !== 'paving').flatMap(r => r.rects);
  const pts = (rects.length ? rects.flatMap(([x0, z0, x1, z1]) => [[x0, z0], [x1, z1]]) : (model.walls || []).flatMap(w => [w.a, w.b]))
    .concat(Object.values(model.roofs || {}).flatMap(r => r.outline || []));
  const b = pts.reduce((a, [x, z]) => [Math.min(a[0], x), Math.min(a[1], z), Math.max(a[2], x), Math.max(a[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  const top = Math.max(model.ceiling || 0, ...Object.values(model.roofs || {}).map(r => r.high_y + (r.thick || 0)));
  return [...b, top || 3];
}

/**
 * homeDir(aspect) -> the unit vector from the orbit target to the home view's camera. The model's
 * z runs away from the street, so the home view looks in from -z, the street side, 25 degrees
 * round to the west, low like a passer-by; 40 degrees up on a portrait screen, where a lower view
 * crops the house's sides.
 */
export function homeDir(aspect) {
  const az = 25 * D2R, el = (aspect < 1 ? 40 : 27) * D2R;
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * homeView(box, dir, aspect, fov, margin = 0.12) -> { target, distance }: the orbit target and the
 * distance along dir (unit, target to camera) at which every corner of box (homeBox's, from the
 * ground to its top) projects inside the viewport, margin of its width and height clear of each
 * edge. The projected box is centred, and the target slid along the view line to 0.3 of the top.
 */
export function homeView(box, dir, aspect, fov, margin = 0.12) {
  const [x0, z0, x1, z1, top] = box;
  const corners = [];
  for (const x of [x0, x1]) for (const y of [0, top]) for (const z of [z0, z1]) corners.push(new THREE.Vector3(x, y, z));
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1e5), v = new THREE.Vector3();
  const lift = top * 0.3, target = new THREE.Vector3((x0 + x1) / 2, lift, (z0 + z1) / 2);
  const extent = d => {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of corners) {
      v.copy(c).project(cam);
      if (v.z >= 1 || v.z <= -1) return null;
      b[0] = Math.min(b[0], v.x); b[1] = Math.min(b[1], v.y); b[2] = Math.max(b[2], v.x); b[3] = Math.max(b[3], v.y);
    }
    return b;
  };
  const lim = 1 - 2 * margin, fits = b => b && b[0] >= -lim && b[2] <= lim && b[1] >= -lim && b[3] <= lim;
  const size = Math.hypot(x1 - x0, z1 - z0, top);
  let d = size;
  for (let pass = 0; pass < 4; pass++) {
    let lo = size * 0.05, hi = size * 50;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(extent(mid))) hi = mid; else lo = mid; }
    d = hi;
    const b = extent(d), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    if (Math.abs(cx) < 1e-3 && Math.abs(cy) < 1e-3) break;
    // move the target by the projected box's offset in the camera's plane, then back along the
    // view line (which changes nothing on screen) to the lift height
    const halfH = d * Math.tan((fov * D2R) / 2), halfW = halfH * aspect;
    target.addScaledVector(v.setFromMatrixColumn(cam.matrixWorld, 0), cx * halfW);
    target.addScaledVector(v.setFromMatrixColumn(cam.matrixWorld, 1), cy * halfH);
    target.addScaledVector(dir, (lift - target.y) / dir.y);
  }
  return { target, distance: d };
}

/**
 * syncCamera(controls, camera) -> what controls.update() returned, with the camera's world
 * matrices refreshed. update() ends in lookAt, which refreshes the world matrix before it sets
 * the new rotation, so a projection straight after it used the previous frame's rotation and the
 * markers trailed the view by a frame.
 */
export function syncCamera(controls, camera) {
  const moved = controls.update();
  camera.updateMatrixWorld();
  return moved;
}

/**
 * toScreen(camera, p, width, height, v?) -> { x, y } in CSS pixels from the top left, or null
 * behind the camera; p is [x, y, z] or a Vector3, v a scratch vector.
 */
export function toScreen(camera, p, width, height, v = new THREE.Vector3()) {
  if (Array.isArray(p)) v.set(p[0], p[1], p[2]);
  else v.copy(p);
  v.project(camera);
  if (v.z >= 1) return null;
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}

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
 * releaseVelocity(samples, now, win = 80) -> { az, polar } in radians per second: the camera's
 * azimuth and polar rate over the last win ms of samples [{ t, az, polar }] (t in ms, oldest
 * first, the release itself the last), at most max. Fewer than two samples in the window, or
 * samples spanning under 30 ms (a jump, not a flick), give zero.
 */
export function releaseVelocity(samples, now, win = 80, max = 4) {
  const recent = samples.filter(s => now - s.t <= win);
  if (recent.length < 2) return { az: 0, polar: 0 };
  const a = recent[0], b = recent[recent.length - 1], dt = (b.t - a.t) / 1000;
  if (dt < 0.03) return { az: 0, polar: 0 };
  // the azimuth wraps at +-pi
  let daz = b.az - a.az;
  if (daz > Math.PI) daz -= 2 * Math.PI;
  else if (daz < -Math.PI) daz += 2 * Math.PI;
  const v = { az: daz / dt, polar: (b.polar - a.polar) / dt }, f = Math.min(1, max / (Math.hypot(v.az, v.polar) || 1));
  return { az: v.az * f, polar: v.polar * f };
}

/**
 * coast(v, dt, tau = 0.35) -> { d, v }: the turn d { az, polar } in radians over the next dt
 * seconds of a coast at velocity v { az, polar } that decays exponentially with time constant
 * tau, and the velocity after it. The turn is the decay's integral, so it does not depend on
 * the frame rate.
 */
export function coast(v, dt, tau = 0.35) {
  const f = Math.exp(-dt / tau), s = tau * (1 - f);
  return { d: { az: v.az * s, polar: v.polar * s }, v: { az: v.az * f, polar: v.polar * f } };
}

/**
 * mount(element, model, options) -> { setMarkers, setMode, setSelection, setCar, setLayer, setSun, setTime,
 *                                     reset, resize, dispose, mode, carState, carScreen, layers, time, view }
 *
 * model: geometry + rooms layers (private and showcase are ignored). A wall with finish 'panel' is
 *   drawn in the real style as anthracite panel (the carport's walls and posts); a room's floor
 *   ('tile' or 'paving', else oak) is its floor finish there. site.decks and site.paving:
 *   items that are rects [x0, z0, x1, z1] or outlines [[x, z], ...]. site.gates: [{ a, b, kind,
 *   height, opens?, slide?, name? }], drawn closed in the fence line; kind 'sliding' (one leaf, set
 *   to the lot side, sliding past the end named by slide, 'a' or 'b'), 'swing1' (one leaf hinged
 *   at a) or 'swing2' (two leaves hinged at a and b), a swing gate opening 'in' (to the lot) or
 *   'out'. With a car, the gate its path crosses is the drive gate, and only it moves.
 *   site.fences are the mesh fence and site.bar_fences the bar fence, [[x, z], [x, z]] segments.
 *   site.sandpit { rect, height }; site.swing { rect, height, slide? }, the beam along the rect's
 *   long axis, slide the chute's foot [x, z] with the tower at the beam end nearer to it;
 *   site.trampoline { rect, height } (the mat's); site.planters [{ rect, y, plant?, finish? }],
 *   plant 'thuja' or 'low', finish 'frame' (default) or 'cladding'; site.steps [{ rect, height }].
 *   The simple style draws the trampoline, planters and steps as plain boxes.
 * options:
 *   onMarker(id)     a marker was tapped
 *   onRoom(id|null)  a room floor was tapped with the roof off; null for empty space
 *   onMode(mode)     the mode changed ('roof' | 'open')
 *   onCar()          the car's body was tapped (either mode, while it shows); no room tap follows
 *   bloom            default true; always off below 720 px width and in the real style
 *   mode             the starting mode, 'roof' (default) or 'open'
 *   style            'simple' (default) or 'real'; another style is another mount
 *   view             { position, target } as the view getter gives it: the first framing puts
 *                    the camera there instead of the home view, so a remount keeps the user's orbit
 *   labels(roomId)   room label text; the room's own name when it returns nothing
 *   layers           { id: bool }: the starting state of the switchable layers, default on
 *   car              { profile, path }: a vehicle drawn from profile, built hidden. profile is in
 *                    metres in the car's frame (origin on the ground at its centre, +x forward,
 *                    y up): length, width, height, side and glass outlines [[x, y], ...],
 *                    wheels { r, x: [rear, front], track }, lights { front, rear } as lists of
 *                    [[x, y, z], [x, y, z]] segments. path is [[x, z], ...]; the car drives a
 *                    smooth curve through it and parks at the last point, facing along the last leg.
 *   surroundings     { buildings: [{ outline: [[x, z], ...], height }], roads: [{ outline, holes? }] }:
 *                    the neighbouring buildings as flat-topped boxes and the street as a flat
 *                    surface, faint, never tapped
 * setCar('away' | 'parked' | 'arrive'): 'arrive' drives the whole path (3-6 s, restarts if it is
 *   already driving; 'parked' under reduced motion), after the drive gate, if any, has opened
 *   (1.2 s); the gate closes once the car is through. 'parked' stands it at the path's end, 'away'
 *   fades it out; both close the gate at once. carState is 'away' | 'driving' | 'parked'; carScreen
 *   is the car's projected centre { x, y } in CSS pixels relative to the element, or null when it
 *   is away, switched off or behind. Without a car, setCar does nothing, carState is 'away', carScreen null.
 * setSun({ lat, lon, bearing } | null): the place for the real style's sun, in degrees, bearing
 *   the L-EST97 grid azimuth of the model's +x axis (georef.x_axis_bearing_deg); null or any
 *   missing value gives a fixed afternoon sun. setTime(date | null): the sun's time, null for
 *   live (recomputed once a minute). time is the time in use. Both do nothing visible in the
 *   simple style. view is { position, target } for options.view; the fog follows the camera.
 * layers: [{ id, on }] for the switchable layers present and listed now; setLayer(id, on) switches
 *   one and ignores an unknown id. Switchable: 'markers' (the overlay; off hides every marker but
 *   an alert), 'fans' (listed while a marker has a look), 'trees', 'surroundings' and 'car' (off
 *   parks a running drive and closes the gate at once, and 'arrive' then parks). A layer that is
 *   off takes no taps.
 * markers: { id, pos: [x, y, z], icon, state: 'idle'|'on'|'alert'|'off', value?, label?,
 *            stateText?, room?, look?: [dx, dz], role?, level?: 0..1, pulse?, warm? }
 *   label and stateText make the marker's accessible name. Markers take no pointer, so a drag
 *   that starts on one orbits; a tap on the canvas tests the shown markers' rectangles first.
 *   A marker whose room is a house room shows only with the roof off, unless its state is
 *   'alert'; state 'on' warms that room's floor unless warm is false. role 'pergola-light' drives the pergola's LED glow.
 */
export function mount(element, model, options = {}) {
  const root = document.createElement('div');
  root.className = 'h3d';
  const css = document.createElement('style');
  css.textContent = STYLE;
  const stage = document.createElement('div');
  stage.className = 'h3d-stage';
  const overlay = document.createElement('div');
  overlay.className = 'h3d-overlay';
  root.append(css, stage, overlay);
  element.appendChild(root);

  const mq = q => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    const msg = document.createElement('div');
    msg.className = 'h3d-fallback';
    msg.textContent = 'See seade ei toeta WebGL-i, mistõttu 3D-vaadet ei saa näidata.';
    stage.appendChild(msg);
    const noop = () => {};
    return { failed: true, setMarkers: noop, setMode: noop, setSelection: noop, setCar: noop, setLayer: noop, reset: noop, resize: noop,
      setSun: noop, setTime: noop, dispose: () => root.remove(), mode: 'roof', carState: 'away', carScreen: null, layers: [], time: null, view: null };
  }
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const style = options.style === 'real' ? 'real' : 'simple', real = style === 'real';
  const kit = createKit(THREE, style), C = kit.C;
  root.classList.toggle('h3d-real', real);
  const scene = new THREE.Scene();
  scene.background = C.bg;
  scene.fog = new THREE.Fog(C.bg, 34, 78);

  /* ---------- model ---------- */
  const rooms = model.rooms || [];
  const roomById = Object.fromEntries(rooms.map(r => [r.id, r]));
  const { roof, frame: modelBox } = modelFrame(model);
  const { ext, E } = modelBox;
  // the home view frames the house rooms, not the lot or the carport
  const HOUSE_BOX = homeBox(model);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300 * E);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8 * E;
  controls.maxDistance = 130 * E;
  controls.maxPolarAngle = 1.38;
  controls.screenSpacePanning = false;

  /* ---------- layers ---------- */
  let mode = 'roof', sel = null, hovered = null;
  const fade = { cur: 1, to: 1 };
  const state = {
    get mode() { return mode; },
    get roofFade() { return fade.cur; },
    get hovered() { return hovered; },
    get selection() { return sel; }
  };
  const screenV = new THREE.Vector3();
  const screen = (x, y, z) => toScreen(camera, [x, y, z], width, height, screenV);
  const byId = {};
  const ctx = {
    THREE, kit, C, model, options, style, reduceMotion, state, screen,
    frame: modelBox,
    roof,
    ceiling: model.ceiling,
    layer: id => byId[id] || null,
    invalidate: () => invalidate()
  };
  // the marker overlay is the core's own, switched like a layer; it has no group
  const markerLayer = { L: { id: 'markers', toggle: true, listed: () => markers.size > 0 }, wrap: null, on: true };
  const layers = [markerLayer];
  BUILDERS.forEach((mod, i) => {
    const L = mod && buildLayer(mod, LAYERS[i], ctx);
    if (!L) return;
    const wrap = new THREE.Group();
    wrap.add(L.group);
    if (L.lift) wrap.add(L.lift);
    scene.add(wrap);
    byId[L.id] = L;
    const e = { L, wrap, on: true, failed: false };
    // a failed layer stays hidden, leaves the Kihid list and takes no more taps
    guardLayer(L, () => { e.failed = true; e.on = false; wrap.visible = false; });
    layers.push(e);
  });
  function switchLayer(e, on) {
    e.on = on;
    if (e.wrap) e.wrap.visible = on;
    if (e.L.setOn) e.L.setOn(on);
  }
  const shadowsDirty = () => { if (real) renderer.shadowMap.needsUpdate = true; };
  function setLayer(id, on) {
    const e = layers.find(x => x.L.toggle && x.L.id === id && !x.failed);
    if (!e || e.on === !!on) return;
    switchLayer(e, !!on);
    // a layer switched off under the mouse no longer takes the hover
    if (!e.on) { hovered = null; renderer.domElement.style.cursor = ''; }
    shadowsDirty();
    invalidate();
  }
  // a stored choice applies before the first frame, also to a layer not listed yet
  const start = options.layers || {};
  layers.forEach(e => { if (e.L.toggle && start[e.L.id] === false) switchLayer(e, false); });

  /* ---------- post-processing, created on first use ---------- */
  let composer = null;
  function getComposer() {
    if (composer) return composer;
    const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(PR);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(2, 2), 0.45, 0.4, 0.4));
    composer.addPass(new OutputPass());
    composer.setSize(width, height);
    return composer;
  }
  const bloomOn = () => !real && options.bloom !== false && width >= BLOOM_MIN_WIDTH;

  /* ---------- the real style's sun, sky and shadows ---------- */
  let sun = null, hemi = null, glow = null, sunPlace = null, sunTime = null, sunTimer = 0, liftCasts = true;
  // towards the sun, unit length, at every altitude (sunV is set only while it is up)
  const sunDir = new THREE.Vector3();
  const sky = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, new THREE.Color(v)]));
  const lowSun = new THREE.Color(LOW_SUN);
  if (real) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // the shadow camera is fixed to the lot box, so a camera move needs no shadow pass: the map
    // renders only when the sun, the roof, a layer or the map itself changes (shadowsDirty)
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    // neutral keeps the specification's colours closest
    renderer.toneMapping = THREE.NeutralToneMapping;
    scene.background = sky.day.clone();
    scene.fog.color.copy(sky.day);
    // the ground bounces light onto the walls: a shaded wall in the photos is a little darker than
    // a sunlit one, not near black
    hemi = new THREE.HemisphereLight('#dfe8f0', '#9a9c8c', 1);
    sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.castShadow = true;
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02; // the walls are DoubleSide, both faces go into the map
    scene.add(hemi, sun, sun.target);
    // the sun's disc and glow, far out along its direction; buildings and trees hide it through
    // the depth test
    glow = new THREE.Sprite(kit.keep(new THREE.SpriteMaterial({
      map: kit.canvasTexture(128, [[0, 'rgba(255,255,255,1)'], [0.05, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,236,210,0.6)'], [1, 'rgba(255,222,180,0)']]),
      fog: false, depthWrite: false, toneMapped: false, transparent: true
    })));
    scene.add(glow);
  }
  // the shadow camera holds the lot from the ground to the highest roof or tree
  const msite = model.site || {};
  const shadowTop = 0.5 + Math.max(model.ceiling || 0, ...Object.values(model.roofs || {}).map(r => r.high_y + (r.thick || 0)),
    ...(msite.trees || []).map(t => t.height), msite.garage_roof && msite.garage_roof.y ? msite.garage_roof.y[1] : 0,
    msite.pergola ? msite.pergola.height : 0);
  const sunV = new THREE.Vector3(), corner = new THREE.Vector3(), shadowCentre = new THREE.Vector3();
  function placeSun(dir) {
    const [x0, z0, x1, z1] = modelBox.lotBox;
    shadowCentre.set((x0 + x1) / 2, shadowTop / 2, (z0 + z1) / 2);
    sunV.set(dir[0], dir[1], dir[2]).normalize();
    sun.position.copy(shadowCentre).addScaledVector(sunV, ext * 2);
    sun.target.position.copy(shadowCentre);
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    // the box's corners in the shadow camera's frame, which looks from the sun at the centre
    const cam = sun.shadow.camera;
    cam.position.copy(sun.position);
    cam.lookAt(shadowCentre);
    cam.updateMatrixWorld();
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const x of [x0, x1]) for (const y of [0, shadowTop]) for (const z of [z0, z1]) {
      corner.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      ['x', 'y', 'z'].forEach((k, i) => { b[i] = Math.min(b[i], corner[k]); b[i + 3] = Math.max(b[i + 3], corner[k]); });
    }
    cam.left = b[0] - 0.5;
    cam.right = b[3] + 0.5;
    cam.bottom = b[1] - 0.5;
    cam.top = b[4] + 0.5;
    // the far plane runs on past the box: a low sun's shadow lands on ground deeper than the lot
    cam.near = Math.max(0.1, -b[5] - 1);
    cam.far = -b[2] + 4 * ext;
    cam.updateProjectionMatrix();
  }
  function updateSun() {
    if (!real) return;
    let alt, dir;
    if (sunPlace) {
      const p = sunPosition(sunTime || new Date(), sunPlace.lat, sunPlace.lon);
      alt = p.altitude;
      dir = sunDirection(alt, gridBearing(p.azimuth, sunPlace.lon), sunPlace.bearing);
    } else {
      dir = FIXED_SUN;
      alt = Math.asin(dir[1] / Math.hypot(...dir)) / D2R;
    }
    if (alt >= DUSK_ALT) scene.background.copy(sky.day);
    else if (alt >= 0) scene.background.copy(sky.dusk).lerp(sky.day, alt / DUSK_ALT);
    else scene.background.copy(sky.night);
    scene.fog.color.copy(scene.background);
    const high = Math.min(1, Math.max(0, alt / 25));
    sun.visible = alt > 0;
    sun.intensity = 1 + 2 * high;
    sun.color.set('#ffffff').lerp(lowSun, Math.max(0, 1 - alt / DUSK_ALT));
    hemi.intensity = alt < 0 ? 0.15 : 0.5 + 1.9 * high;
    sunDir.set(dir[0], dir[1], dir[2]).normalize();
    const g = sunGlow(alt);
    glow.visible = g.visible;
    glow.material.opacity = g.opacity;
    glow.material.color.set('#ffffff').lerp(lowSun, g.warm);
    if (alt > 0) placeSun(dir);
    shadowsDirty();
    invalidate();
  }
  // place: { lat, lon, bearing } in degrees, bearing the grid azimuth of the model's +x; null
  // for the fixed sun
  function setSun(place) {
    sunPlace = place && [place.lat, place.lon, place.bearing].every(Number.isFinite) ? { lat: place.lat, lon: place.lon, bearing: place.bearing } : null;
    updateSun();
  }
  function setTime(at) {
    sunTime = at ? new Date(at) : null;
    updateSun();
  }

  /* ---------- labels and markers ---------- */
  const labels = rooms.map(r => {
    const el = document.createElement('div');
    el.className = 'h3d-label';
    el.textContent = (options.labels && options.labels(r.id)) || r.name;
    overlay.appendChild(el);
    const [x0, z0, x1, z1] = r.rects[0];
    const [lx, lz] = r.label || [(x0 + x1) / 2, (z0 + z1) / 2];
    return { el, pos: new THREE.Vector3(lx, 0.05, lz), disp: '', op: -1, tf: '' };
  });

  const markers = new Map(); // id -> { data, el }
  const isIndoor = m => !!(m.room && roomById[m.room]);

  function markerClass(m) {
    const c = ['h3d-marker'];
    if (m.value === undefined || m.value === null || m.value === '') c.push('round');
    if (m.state === 'on' || m.state === 'alert' || m.state === 'off') c.push(m.state);
    if (m.pulse) c.push('pulse');
    if (sel === m.id) c.push('sel');
    return c.join(' ');
  }
  // a change of class or content can change the size, which is measured again on the next frame
  // that shows the marker (a hidden one measures 0)
  function renderMarker(rec) {
    const m = rec.data;
    const cls = markerClass(m);
    if (rec.cls !== cls) { rec.el.className = cls + (rec.hover ? ' hover' : ''); rec.cls = cls; rec.size = null; }
    const html = icon(m.icon) + (m.value !== undefined && m.value !== null && m.value !== '' ? `<span>${String(m.value).replace(/[&<>"]/g, ch => `&#${ch.charCodeAt(0)};`)}</span>` : '');
    if (rec.html !== html) { rec.el.innerHTML = html; rec.html = html; rec.size = null; }
    const label = m.label || m.id, aria = m.stateText ? `${label}, ${m.stateText}` : label;
    if (rec.aria !== aria) { rec.el.setAttribute('aria-label', aria); rec.el.title = aria; rec.aria = aria; }
  }
  // the markers on screen now, as hitRect() takes them; a marker fading in or out under the roof
  // takes taps only once it is mostly there
  const shownRects = () => {
    const out = [];
    for (const [id, rec] of markers) if (rec.shown && rec.size && rec.op >= 0.5) out.push({ id, x: rec.sx, y: rec.sy, w: rec.size[0], h: rec.size[1] });
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
        rec = { el, html: '', cls: '', aria: '', size: null, shown: false, disp: '', op: -1, tf: '', sx: 0, sy: 0, hover: false };
        markers.set(m.id, rec);
      }
      rec.data = m;
      renderMarker(rec);
    });
    for (const [id, rec] of markers) if (!seen.has(id)) { rec.el.remove(); markers.delete(id); }
    layers.forEach(({ L }) => { if (L.markers) L.markers(list); });
    invalidate();
  }

  /* ---------- modes and selection ---------- */
  function setMode(m, instant) {
    mode = m === 'open' ? 'open' : 'roof';
    fade.to = mode === 'roof' ? 1 : 0;
    if (instant || reduceMotion) fade.cur = fade.to;
    invalidate();
    if (options.onMode) options.onMode(mode);
  }
  function setSelection(id) {
    sel = id || null;
    markers.forEach(renderMarker);
    invalidate();
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  function aim(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  // reads the ray that aim() set; later layers lie on top, so they are tried first
  function hitTest() {
    for (let i = layers.length - 1; i >= 0; i--) {
      const { L, on } = layers[i];
      const h = on && L.hit ? L.hit(ray) : null;
      if (h) return h;
    }
    return null;
  }
  // the marker under a pointer, in the overlay's CSS pixels; a touch gets a little slack
  function markerAt(ev) {
    const rect = root.getBoundingClientRect();
    return hitRect(shownRects(), ev.clientX - rect.left, ev.clientY - rect.top, ev.pointerType === 'mouse' ? 0 : 6);
  }
  let hoverMarker = null;
  function setHoverMarker(id) {
    if (id === hoverMarker) return;
    // the hover border keeps the size, so the marker stays measured and tappable
    [hoverMarker, id].forEach(k => { const rec = k && markers.get(k); if (rec) { rec.hover = k === id; rec.el.classList.toggle('hover', rec.hover); } });
    hoverMarker = id;
  }
  const onMove = ev => {
    if (ev.pointerType !== 'mouse') return;
    const mk = pointers.size ? null : markerAt(ev);
    setHoverMarker(mk);
    aim(ev);
    const h = mk ? null : hitTest();
    const over = h && h.target ? h.target : null;
    if (over !== hovered) { hovered = over; invalidate(); }
    renderer.domElement.style.cursor = mk || h ? 'pointer' : '';
  };
  // While a pointer is down the camera follows it 1:1, without OrbitControls' damping (turning it
  // off mid-gesture drops nothing: update() then applies the whole delta at once). On release the
  // view coasts on from the last 80 ms of camera samples; zoom keeps OrbitControls' own damping.
  const pointers = new Set();
  let samples = [], spin = null, multi = false;
  const sampleNow = t => ({ t, az: controls.getAzimuthalAngle(), polar: controls.getPolarAngle() });
  const onDown = ev => {
    downAt = pointers.size ? null : [ev.clientX, ev.clientY];
    pointers.add(ev.pointerId);
    if (pointers.size > 1) multi = true;
    spin = null;
    samples = [sampleNow(performance.now())];
    controls.enableDamping = false;
  };
  const onRelease = ev => {
    if (!pointers.delete(ev.pointerId) || pointers.size) return;
    controls.enableDamping = true;
    if (!multi && !reduceMotion && ev.type === 'pointerup') {
      const now = performance.now();
      samples.push(sampleNow(now));
      const vel = releaseVelocity(samples, now);
      if (Math.hypot(vel.az, vel.polar) > 0.3) spin = vel;
    }
    samples = [];
    multi = false;
    invalidate();
  };
  const onUp = ev => {
    const tap = downAt && pointers.size === 1 && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) <= 6;
    onRelease(ev);
    if (!tap) return;
    downAt = null;
    const mk = markerAt(ev);
    if (mk) { if (options.onMarker) options.onMarker(mk); return; }
    aim(ev);
    const h = hitTest();
    if (h && h.car) { if (options.onCar) options.onCar(); return; }
    if (options.onRoom) options.onRoom(h && h.room ? h.room : null);
  };
  const onLeave = () => setHoverMarker(null);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onRelease);
  // a camera change under a finger or a wheel zoom is the user's own view: from then on a resize
  // keeps it; 'start' alone fires on every tap and wheel event, so it does not count
  let userMoved = false;
  const onWheel = () => { userMoved = true; spin = null; };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
  controls.addEventListener('change', () => { if (pointers.size) userMoved = true; fitFog(); invalidate(); });
  controls.addEventListener('start', () => invalidate());

  /* ---------- framing and size ---------- */
  let width = 1, height = 1, framed = false;
  // the home view for the current aspect, computed once per aspect
  let home = null;
  function homeFor() {
    if (!home || home.aspect !== camera.aspect) {
      const dir = homeDir(camera.aspect), h = homeView(HOUSE_BOX, dir, camera.aspect, camera.fov);
      home = { aspect: camera.aspect, dir, target: h.target, distance: Math.min(controls.maxDistance, Math.max(controls.minDistance, h.distance)) };
    }
    return home;
  }
  const homeDistance = () => homeFor().distance;
  // the fog starts just past the orbit target, never nearer than from the home view: fixed to the
  // home distance, a zoom-out sank the house itself into it
  function fitFog() {
    const d = Math.max(homeDistance(), camera.position.distanceTo(controls.target));
    scene.fog.near = d * 0.95;
    scene.fog.far = d * 2.2;
  }
  // the home view anew for the current size; resizes reframe again until the user moves the camera
  function reset() {
    const h = homeFor();
    spin = null;
    userMoved = false;
    controls.target.copy(h.target);
    camera.position.copy(h.target).addScaledVector(h.dir, h.distance);
    controls.update();
    fitFog();
    invalidate();
  }
  // a remount's first framing: the camera where the last mount left it
  const isVec = (p, n) => Array.isArray(p) && p.length === n && p.every(Number.isFinite);
  const startView = options.view && isVec(options.view.position, 3) && isVec(options.view.target, 3) ? options.view : null;
  function frameFirst() {
    if (!startView) return reset();
    userMoved = true;
    controls.target.fromArray(startView.target);
    camera.position.fromArray(startView.position);
    controls.update();
    fitFog();
    invalidate();
  }
  function resize() {
    // a hidden card measures 0 or 1: keep the last real size
    const w = root.clientWidth, h = root.clientHeight;
    if (w <= 1 || h <= 1 || (w === width && h === height)) return;
    width = w; height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    root.classList.toggle('h3d-narrow', w < BLOOM_MIN_WIDTH);
    if (sun) {
      const size = w < BLOOM_MIN_WIDTH ? 1024 : 2048;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        shadowsDirty();
      }
    }
    if (!framed) { framed = true; frameFirst(); } else if (!userMoved) reset(); else fitFog();
    invalidate();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(root);
  let visible = true;
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; invalidate(); }) : null;
  if (io) io.observe(root);

  /* ---------- loop: runs only while something moves, a change restarts it ---------- */
  let dirty = true, raf = 0, last = 0, disposed = false;
  const v = new THREE.Vector3(), orbitV = new THREE.Vector3(), orbitS = new THREE.Spherical();
  // the overlay writes a style only when its value changed
  function place(rec, el, disp, op, tf) {
    if (rec.disp !== disp) { el.style.display = disp; rec.disp = disp; }
    if (disp === 'none') return;
    if (rec.op !== op) { el.style.opacity = op.toFixed(2); rec.op = op; }
    if (rec.tf !== tf) { el.style.transform = tf; rec.tf = tf; }
  }
  const at = p => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
  function invalidate() {
    dirty = true;
    if (!raf && !disposed && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  // raf keeps this callback's id while it runs, so an invalidate() from inside it (controls.update
  // fires 'change') cannot schedule a second chain; it is cleared only where the loop stops
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) { raf = 0; return; }
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.2);
    let moving = false;
    if (spin) {
      const c = coast(spin, dt);
      spin = Math.hypot(c.v.az, c.v.polar) > 0.02 ? c.v : null;
      orbitV.copy(camera.position).sub(controls.target);
      orbitS.setFromVector3(orbitV);
      orbitS.theta += c.d.az;
      orbitS.phi += c.d.polar;
      orbitS.makeSafe();
      camera.position.copy(controls.target).add(orbitV.setFromSpherical(orbitS));
      moving = true;
    }
    if (syncCamera(controls, camera)) moving = true;
    // a coast into the polar limit stops turning that way
    if (spin && Math.abs(controls.getPolarAngle() - orbitS.phi) > 1e-6) spin = { az: spin.az, polar: 0 };
    if (pointers.size) {
      samples.push(sampleNow(now));
      while (samples.length > 2 && now - samples[0].t > 200) samples.shift();
    }
    if (!kit.near(fade.cur, fade.to)) { fade.cur += (fade.to - fade.cur) * k; moving = true; shadowsDirty(); } else if (fade.cur !== fade.to) { fade.cur = fade.to; shadowsDirty(); }
    layers.forEach(({ L }) => {
      if (!L.lift) return;
      L.lift.position.y = (1 - fade.cur) * 4.5;
      kit.applyFade(L.lift, Math.max(0, fade.cur * 1.25 - 0.25));
    });
    // the shadow pass ignores opacity, so the lift casts only while the roof is fully on
    if (real && liftCasts !== fade.cur > 0.99) {
      liftCasts = fade.cur > 0.99;
      layers.forEach(({ L }) => {
        if (L.lift) L.lift.traverse(o => {
          if (!o.isMesh) return;
          if (o.userData.cast === undefined) o.userData.cast = o.castShadow;
          o.castShadow = liftCasts && o.userData.cast;
        });
      });
    }
    layers.forEach(({ L }) => { if (L.update && L.update(dt, k)) { moving = true; if (L.shades) shadowsDirty(); } });
    if (!moving && !dirty) { raf = 0; return; }
    dirty = false;
    raf = requestAnimationFrame(frame);
    // past the farthest neighbour at full zoom-out, about 12 degrees across
    if (glow && glow.visible) {
      glow.position.copy(camera.position).addScaledVector(sunDir, camera.far * 0.9);
      glow.scale.setScalar(0.2 * camera.far * 0.9);
    }

    const roofOpen = Math.max(0, 1 - fade.cur * 1.6);
    for (const rec of markers.values()) {
      // an alert indoors shows through the roof, so a closed view never hides it
      const m = rec.data, el = rec.el, covered = isIndoor(m) && m.state !== 'alert';
      const p = (markerLayer.on || m.state === 'alert') && !(covered && roofOpen <= 0.02) ? toScreen(camera, m.pos, width, height, v) : null;
      rec.shown = !!p;
      if (!p) { place(rec, el, 'none'); continue; }
      place(rec, el, '', Math.round((covered ? roofOpen : 1) * 100) / 100, at(p));
      rec.sx = p.x;
      rec.sy = p.y;
      if (!rec.size) rec.size = [el.offsetWidth, el.offsetHeight];
    }
    labels.forEach(l => {
      const p = roofOpen < 0.02 ? null : toScreen(camera, l.pos, width, height, v);
      place(l, l.el, p ? '' : 'none', Math.round(roofOpen * 80) / 100, p ? at(p) : '');
    });
    if (bloomOn()) getComposer().render();
    else renderer.render(scene, camera);
  }

  resize();
  setMode(options.mode === 'open' ? 'open' : 'roof', true);
  updateSun();
  // live: the sun moves on once a minute
  if (real) sunTimer = setInterval(() => { if (!sunTime && sunPlace) updateSun(); }, 60000);
  invalidate();

  function dispose() {
    disposed = true;
    clearInterval(sunTimer);
    if (sun) sun.dispose();
    cancelAnimationFrame(raf);
    raf = 0;
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerleave', onLeave);
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.removeEventListener('pointerup', onUp);
    renderer.domElement.removeEventListener('pointercancel', onRelease);
    renderer.domElement.removeEventListener('wheel', onWheel);
    controls.dispose();
    layers.forEach(({ L }) => { if (L.dispose) L.dispose(); });
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !Array.isArray(o.material)) o.material.dispose(); });
    kit.disposables.forEach(d => d.dispose());
    if (composer) composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  }

  // carState and carScreen stay getters, so a copy of this object would freeze them
  return {
    setMarkers, setMode, setSelection, setLayer, reset, resize, dispose, setSun, setTime,
    setCar: s => { if (byId.car) byId.car.api.setCar(s); },
    get mode() { return mode; },
    get time() { return sunTime ? new Date(sunTime) : new Date(); },
    get view() { return { position: camera.position.toArray(), target: controls.target.toArray() }; },
    get carState() { return byId.car ? byId.car.api.carState : 'away'; },
    get carScreen() { return byId.car ? byId.car.api.carScreen : null; },
    get layers() { return layers.filter(e => e.L.toggle && !e.failed && (!e.L.listed || e.L.listed())).map(e => ({ id: e.L.id, on: e.on })); }
  };
}
