// House 3D view engine: builds the scene from a house3d model (see scripts/house3d_model.py)
// and draws generic markers over it. The HA card and the standalone viewer are thin shells
// around mount(); neither the engine nor this directory carries any house data.
//
// This file is the core: renderer and bloom, a lit style's sun, sky, shadows and contact
// shadows, camera,
// controls and framing, roof mode, taps and hover, the frame loop, resize and dispose, and the
// layer registry. It builds no scene geometry. scene/kit.js makes each mount's colours, materials
// and geometry helpers for its style; scene/sun.js holds the sun's position and direction as pure
// functions; scene/overlay.js is the marker and label overlay (the markers, the room labels and
// chips, their placement, hover and tap rectangles); scene/layers/ holds one module per scene
// layer, listed in LAYERS below in build order. A new scene layer is a module there and its
// line in LAYERS.
//
// Styles: 'simple' (default) is the unlit neon wireframe; 'real' (Päris) and 'photo' (Foto) are
// the lit styles, which draw lit surfaces in the house's look (kit.surface: the model's
// geometry.look over a neutral default) under a sun with shadows, on one of two stages, garden or
// studio, with a house's baked contact shadows in either (mount()'s stage and bake options). What
// a lit style draws its surfaces, sky and light with is its look (scene/look.js, ctx.look); a
// layer branches only on ctx.look.lit and leaves its simple path as it is;
// tests/house3d/simple-snapshot.json pins the simple style's objects and materials. The interior
// layer is a lit style's alone (it builds null in the simple one) and reads the building
// layer's api, so it comes after it.
//
// One layer cannot take the view down: a layer module that fails to load is left out,
// buildLayer() leaves out a layer whose build throws, and guardLayer() switches off for good a
// layer whose update, markers, hit, setOn, listed or api throws. Each logs "house3d: layer <id> failed".
// modelFrame(), buildLayer() and guardLayer() are exported for the tests.
//
// Modules under scene/ load nothing themselves: no import of any kind and no re-export. They get
// THREE, the kit and everything else through ctx, the overlay through createOverlay()'s deps. The
// core loads them with its own URL's query, so house3d.js?v=N loads scene/kit.js?v=N and every
// layer at that version. HA's /local and the phone app cache hard and only the URL the card
// builds carries ?v=, so a module loaded without it could stay stale. Module scope under scene/
// holds constants only: a module runs once per URL, so mutable state there would be shared by a
// remount or a second card.
//
// Layer contract: a layer module's default export is build(ctx), which returns null when the
// model has nothing for it, otherwise:
//   id, group       the layer's name and its objects
//   lift?           a group that rises and fades with the roof mode (the building's upper part):
//                   the top lift band, over the top storey's cut, with the roofs
//   lifts?          every lift band, one per storey, the last being lift (ctx.bands, storeysOf());
//                   band i rises and fades when storey i or a lower one is shown from inside
//   toggle?         true for a switchable layer; listed()? says whether view.layers shows it now
//   update(dt, k)?  per frame, dt in seconds and k the easing step; true while still animating
//   shades?         true when what update() animates casts shadows (a lit style's shadow map
//                   is rendered only on change); a layer that only tints or glows leaves it out
//   markers(list)?  every setMarkers list
//   hit(ray)?       the tap and hover test on the raycaster: null, { car: true }, { room, target }
//                   or { feature: id, target } (a tap goes to options.onFeature). Layers are tried
//                   in reverse build order, so the car wins over the floors, and a layer that is
//                   off is skipped
//   setOn(on)?      its starting state before the first frame, then every switch
//   api?            what the core re-exports (setCar, carState, carScreen) or another layer
//                   calls through ctx.layer(id)
//   dispose()?      frees what the kit's list and the scene traversal do not
// ctx: THREE, kit, C (kit.C), model, options, style (look.id), look (scene/look.js), stage ('garden' | 'studio'),
//   frame { lotBox, wallBox, ext, E, lotCx, lotCz } (modelFrame),
//   roof { fns, flat, under, topFn, gap, top(id), faces(id), planeAt(id, x, z), kinks(id), clip }: fns[id], under(id),
//   topFn(top) and top(id) (the slab's top) are (x, z) -> y for every roof kind (modelFrame()), ceiling, storeys
//   (storeysOf()), levelOf(o) (levelOf()), storeyOf(furniture) (storeyOfItem()), pit (pitOf()), bands(group, lift) (liftBands()), reduceMotion, state (read-only: mode, level (the storey
//   shown from inside, null with the roof on), bandFade(i), roofFade (the top band's),
//   hovered, selection, night: 0 by day to 1 at night, a lit style's only, sun: the
//   sun's { alt, dir, time } in every style, null without a place), layer(id), screen(x, y, z) -> { x, y } | null, invalidate().
//   build() and the first setOn() run before the loop exists: they must not call invalidate()
//   or screen().
// The core puts each layer's group and lift bands under a wrapper group, and switching a layer sets
// only the wrapper's visible. Nothing leaves the scene, so dispose() still reaches every object.
import * as THREE from './vendor/three-0.187.0/build/three.module.js';
import { OrbitControls } from './vendor/three-0.187.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from './vendor/three-0.187.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three-0.187.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three-0.187.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three-0.187.0/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from './vendor/three-0.187.0/examples/jsm/postprocessing/Pass.js';

const LAYERS = ['ground', 'site', 'trees', 'gates', 'surroundings', 'pergola', 'building', 'interior', 'lights', 'winter', 'car', 'future', 'fans'];
const QUERY = new URL(import.meta.url).search;
// a layer module that fails to load drops its layer, not the engine, and the bake module drops
// only the bake; the kit, the sun and the overlay (scene/overlay.js, the markers, labels and
// chips) are required
const [KIT, SUN, OVERLAY, LOOK, PHOTO, BAKED, ...LOADED] = await Promise.allSettled(['kit', 'sun', 'overlay', 'look', 'photo', 'bake', ...LAYERS.map(id => `layers/${id}`)].map(p => import(`./scene/${p}.js${QUERY}`)));
[KIT, SUN, OVERLAY, LOOK].forEach(r => { if (r.status === 'rejected') throw r.reason; });
if (BAKED.status === 'rejected') console.error('house3d: bake failed to load', BAKED.reason);
const BAKE = BAKED.status === 'fulfilled' ? BAKED.value : null;
if (PHOTO.status === 'rejected') console.error('house3d: the Foto style failed to load', PHOTO.reason);
const photoLook = PHOTO.status === 'fulfilled' ? PHOTO.value.photoLook : null;
const { createKit } = KIT.value;
const { createLook } = LOOK.value;
const { sunPosition, gridBearing, sunDirection, sunGlow, realLight, LOW_SUN } = SUN.value;
const { createOverlay, OVERLAY_STYLE } = OVERLAY.value;
const BUILDERS = LOADED.map((r, i) => {
  if (r.status === 'fulfilled') return r.value;
  console.error(`house3d: layer ${LAYERS[i]} failed to load`, r.reason);
  return null;
});

const D2R = Math.PI / 180;
const ROOF_GAP = 0.06; // walls stop just under the roof so the two outlines do not z-fight
const BLOOM_MIN_WIDTH = 720;
// autoQuality(): at or below these the Foto style takes the light tier
const LOW_CORES = 4, LOW_MEMORY = 4;
// the contact shadows: how far a surface darkens what is near it, in metres, the fade in and out in
// seconds, and the roof's fade below which it counts as off
const AO_RADIUS = 0.45, AO_SCALE = 1.15, AO_SAMPLES = 12, AO_RAMP = 0.3, AO_ROOF_OFF = 0.01;
const FOCUS_SPAN = 7; // metres: the least a focused room's framing spans
// a lit style's sky texture, SKY_PX rows from the horizon, below SKY_HORIZON of the view's
// height, to the zenith at its top
const SKY_PX = 128, SKY_HORIZON = 0.25;
const LOT_FOG = 1.5; // fitFog()
// without a place the lit styles light the street side from the left, like an afternoon sun
const FIXED_SUN = [-0.62, 0.62, -0.48];
// pvNow(): clear-sky beam by Meinel's formula, the diffuse share of it, the system's losses and
// the peak kW per kWp at the roofs' low slope (khe-meta house/house-hvac.md's PV assessment)
const SOLAR_CONSTANT = 1353, DIFFUSE = 0.1, PV_LOSSES = 0.86, PV_PEAK = 0.8;
// the studio stage's colours (the engine's, not a house's), its base round the house in metres,
// and its light: the exposure, the soft boxes' environment, hemisphere, key and fill, towards
// the key (front left in the home view) and the fill as unit-free directions, the key's shadow
// penumbra in shadow-map texels and the floor's shadow. Calibrated on the test house: the lit
// front wall and the roof within 8 L* of their look's colours, the base within 4 L* of its own;
// AgX could not hold the white base and the grey roof both and the neutral tone mapping can
const STUDIO_LAYERS = ['pergola', 'building', 'interior'];
const STUDIO = {
  backdrop: '#e7e3db', base: '#f4f3ef', light: '#fffaf4', baseDepth: 0.35, margin: 1.2,
  exposure: 1.1, env: 0.75, hemi: 0.35, key: 2.2, fill: 0.3, keyDir: [0.5, 0.6, -0.6], fillDir: [-0.7, 0.45, -0.4], penumbra: 10, floorShadow: 0.25
};
// the soft boxes round the studio: [x, y, z, size] in the environment's own unit sphere
const SOFT_BOXES = [[-6, 7, -5, 6], [7, 5, -3, 4], [0, 9, 4, 7]];

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
  expand: '<path d="M14.5 3.5h6v6M9.5 20.5h-6v-6M20.5 3.5 14 10M3.5 20.5 10 14"/>',
  tree: '<path d="M12 2.5a5 5 0 0 0-4.8 6.4A4.3 4.3 0 0 0 8.5 17.5h7a4.3 4.3 0 0 0 1.3-8.6A5 5 0 0 0 12 2.5z"/><path d="M12 21.5v-8M12 15.5l-2.5-2M12 14l2.2-1.8"/>',
  layers: '<path d="M12 3.5 3 8l9 4.5L21 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>'
};
export const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.info}</svg>`;
export const roomArea = room => room.rects.reduce((a, q) => a + (q[2] - q[0]) * (q[3] - q[1]), 0);

const STYLE = `
.h3d { position: relative; width: 100%; height: 100%; overflow: hidden;
  --h3d-line: #6fe3ff; --h3d-ink: #fff; --h3d-muted: #8a9bc2; --h3d-amber: #ffd682; --h3d-alert: #ff5a4c;
  --h3d-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --h3d-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; --h3d-fill: rgba(22, 26, 38, 0.78);
  background: radial-gradient(ellipse at 50% 55%, #0c1631 0%, #060c1b 70%) #060c1b; }
.h3d-stage { position: absolute; inset: 0; }
.h3d-stage canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.h3d-fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
  color: var(--h3d-muted); text-align: center; font: 14px/1.45 var(--h3d-ui); }
@media (prefers-reduced-transparency: reduce) { .h3d { --h3d-fill: rgba(22, 26, 38, 0.95); } }
` + OVERLAY_STYLE;

/**
 * modelFrame(model) -> { roof: { fns, flat, under, topFn, gap, top, faces, planeAt, kinks, chimneys }, frame: { lotBox, wallBox, ext, E, lotCx, lotCz } }
 * The model's roof height functions (x, z) -> y and its framing boxes, as ctx carries them;
 * roof.top(id) is roofTop() for that roof, roof.faces(id) roofFaces() of it (null for a shed
 * roof), roof.planeAt(id, x, z) faceAt() of those faces (null for a shed roof), roof.kinks(id) the plan segments where its faces meet or end, for the wall tops, and
 * roof.clip(poly, [a, b, c]) a convex plan polygon cut to where a x + b z + c <= 0, and
 * roof.chimneys chimneysOf() the model, which rise with the roofs.
 */
export function modelFrame(model) {
  const site = model.site || {};
  const fns = {}, faceCache = {};
  for (const [id, r] of Object.entries(model.roofs || {})) fns[id] = roofHeight(r);
  const flat = h => () => h;
  const under = id => (x, z) => fns[id](x, z) - ROOF_GAP;
  const topFn = top => (typeof top === 'string' ? under(top) : flat(top));
  const faces = id => {
    const r = (model.roofs || {})[id];
    if (!r || roofKind(r) === 'shed') return null;
    return (faceCache[id] ||= roofFaces(r));
  };
  // every face edge once: a ridge, hip or valley is two faces' edge
  const kinkCache = {};
  const kinks = id => (kinkCache[id] ||= (() => {
    const seen = new Map();
    (faces(id)?.faces || []).forEach(({ poly }) => poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length], key = [p, q].map(v => v.map(c => c.toFixed(4)).join()).sort().join(' ');
      if (!seen.has(key)) seen.set(key, [p, q]);
    }));
    return [...seen.values()];
  })());
  const planeAt = (id, x, z) => { const f = faces(id); return f ? faceAt(f, [x, z]) : null; };
  const roof = { fns, flat, under, topFn, gap: ROOF_GAP, faces, planeAt, kinks, clip: clipHalf, chimneys: chimneysOf(model) };
  roof.top = id => roofTop(roof, model, id);

  // the lot sets the scale, the fog and the shadow box; homeBox() frames the home view
  const bbox = pts => pts.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  const lotBox = bbox(site.lot && site.lot.length ? site.lot : (model.walls || []).flatMap(w => [w.a, w.b]));
  const wallBox = bbox((model.walls || []).flatMap(w => [w.a, w.b]));
  const lotCx = (lotBox[0] + lotBox[2]) / 2, lotCz = (lotBox[1] + lotBox[3]) / 2;
  const ext = Math.max(lotBox[2] - lotBox[0], lotBox[3] - lotBox[1]);
  const E = ext / 41; // the prototype's framing was tuned on a 41 m lot
  return { roof, frame: { lotBox, wallBox, ext, E, lotCx, lotCz } };
}

const roofKind = r => r.kind || 'shed';
const roofSlope = r => r.slope ?? Math.tan(r.pitch_deg * D2R);

// a wing roof's faces on one wing q = [x0, z0, x1, z1]: each its plane [a, b, c] (y = a x + b z
// + c) and the half-planes [a, b, c] (a x + b z + c <= 0) of where it is the wing's surface,
// nearer its own edge than the others'; flat is one face
function wingFaces(r, q) {
  const [x0, z0, x1, z1] = q, inside = [[-1, 0, x0], [1, 0, -x1], [0, -1, z0], [0, 1, -z1]];
  if (roofKind(r) === 'flat') return [{ plane: [0, 0, r.y], halves: inside }];
  const s = roofSlope(r), e = r.eave_y;
  // the distance to each edge, d = a x + b z + c
  const ds = [[1, 0, -x0], [-1, 0, x1], [0, 1, -z0], [0, -1, z1]];
  const across = roofKind(r) === 'gable' ? (r.ridge === 'x' ? ds.slice(2) : ds.slice(0, 2)) : ds;
  return across.map((d, k) => ({
    plane: [s * d[0], s * d[1], e + s * d[2]],
    halves: [...inside, ...across.filter((_, j) => j !== k).map(o => [d[0] - o[0], d[1] - o[1], d[2] - o[2]])]
  }));
}
const atPlane = ([a, b, c], x, z) => a * x + b * z + c;

/**
 * roofHeight(r) -> (x, z) -> y: the roof line of roof r for every kind, as
 * scripts/house3d_model.py's roof_height(): a shed roof's plane along x; a wing roof's highest
 * wing at (x, z), a wing's height the lowest of its faces' planes, or outside every wing the
 * nearest wing at the nearest point.
 */
export function roofHeight(r) {
  if (roofKind(r) === 'shed') {
    const slope = roofSlope(r), sign = r.falls === 'west' ? -1 : 1;
    return x => r.high_y - sign * (x - r.high_x) * slope;
  }
  const wings = r.rects.map(q => ({ q, planes: wingFaces(r, q).map(f => f.plane) }));
  const wing = (w, x, z) => Math.min(...w.planes.map(p => atPlane(p, x, z)));
  return (x, z) => {
    let best = -Infinity, near = null, nearD = Infinity;
    for (const w of wings) {
      const [x0, z0, x1, z1] = w.q;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) best = Math.max(best, wing(w, x, z));
      else if (best === -Infinity) {
        const cx = Math.min(Math.max(x, x0), x1), cz = Math.min(Math.max(z, z0), z1), d = Math.hypot(x - cx, z - cz);
        if (d < nearD) { nearD = d; near = [w, cx, cz]; }
      }
    }
    return best > -Infinity ? best : wing(...near);
  };
}

// a convex plan polygon [[x, z], ...] cut to where a x + b z + c <= 0
function clipHalf(poly, [a, b, c]) {
  const f = ([x, z]) => a * x + b * z + c, out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}
const polyArea = poly => Math.abs(poly.reduce((a, [x, z], i) => { const [u, v] = poly[(i + 1) % poly.length]; return a + x * v - u * z; }, 0)) / 2;
const AREA_EPS = 1e-6, HEIGHT_EPS = 1e-6;
const kept = p => p.length >= 3 && polyArea(p) > AREA_EPS;

// convex polygon poly less the convex region where every half-plane of halves holds: the
// pieces outside each half-plane in turn, all convex
function subtract(poly, halves) {
  const out = [];
  let rest = poly;
  for (const h of halves) {
    // a half-plane with no direction is the whole plane or nothing
    if (Math.abs(h[0]) < 1e-12 && Math.abs(h[1]) < 1e-12) {
      if (h[2] > 0) return [...out, rest];
      continue;
    }
    const outside = clipHalf(rest, [-h[0], -h[1], -h[2]]);
    if (kept(outside)) out.push(outside);
    rest = clipHalf(rest, h);
    if (!kept(rest)) return out;
  }
  return out;
}

const inRects = (rects, [x, z], strict) => rects.some(q => (strict ? x > q[0] && x < q[2] && z > q[1] && z < q[3] : x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3]));

/**
 * roofFaces(r) -> { faces: [{ poly, plane, wing }], edges: [[p, q, plane]] } for a wing roof:
 * each wing's faces clipped to where that wing is the roof's surface, as convex plan polygons
 * [[x, z], ...] with their plane [a, b, c] (y = a x + b z + c), and the faces' polygon edges that
 * lie on the roof's outer outline, each with its face's plane. Where two wings stand equally
 * high, the first in rects keeps the face, so every point of the wings lies in one face.
 */
export function roofFaces(r) {
  const rects = r.rects, wings = rects.map(q => wingFaces(r, q));
  const faces = [];
  wings.forEach((list, wi) => list.forEach(f => {
    const [x0, z0, x1, z1] = rects[wi];
    let pieces = [f.halves.reduce((p, h) => (p.length >= 3 ? clipHalf(p, h) : p), [[x0, z0], [x1, z0], [x1, z1], [x0, z1]])].filter(kept);
    // take away where a face of another wing stands higher, or as high on an earlier wing
    wings.forEach((other, wj) => {
      if (wj === wi) return;
      const eps = wj < wi ? -HEIGHT_EPS : HEIGHT_EPS;
      // g over f: f - g + eps <= 0
      other.forEach(g => { pieces = pieces.flatMap(p => subtract(p, [...g.halves, [f.plane[0] - g.plane[0], f.plane[1] - g.plane[1], f.plane[2] - g.plane[2] + eps]])); });
    });
    pieces.forEach(poly => faces.push({ poly, plane: f.plane, wing: wi }));
  }));
  const edges = [];
  faces.forEach(({ poly, plane }) => poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-6) return;
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L], k = 1e-4;
    const a = [m[0] + n[0] * k, m[1] + n[1] * k], b = [m[0] - n[0] * k, m[1] - n[1] * k];
    if (inRects(rects, a) !== inRects(rects, b) && !inRects(rects, m, true)) edges.push([p, q, plane]);
  }));
  return { faces, edges };
}

/**
 * faceAt(roofFaces(r), [x, z]) -> the plane [a, b, c] (y = a x + b z + c) of the face plan point
 * [x, z] lies in, the first on a shared edge; null off the roof.
 */
export function faceAt({ faces }, [x, z]) {
  const eps = 1e-9;
  const hit = faces.find(({ poly }) => {
    const sides = poly.map((p, i) => { const q = poly[(i + 1) % poly.length]; return (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]); });
    return sides.every(c => c >= -eps) || sides.every(c => c <= eps);
  });
  return hit ? hit.plane : null;
}

/**
 * storeysOf(model) -> { ground, list: [{ index, floor, cut }] }: the ground storey's index (the
 * level at 0) and each storey's floor and cut, absolute: the ground storey's cut is ceiling, any
 * other's its floor plus its ceilings entry, else plus ceiling (scripts/house3d_model.py storeys()).
 * A house of n storeys has n lift bands: band i holds what stands above storey i's cut, up to and
 * with storey i + 1's contents, and the last one the top storey's upper part and the roofs; the
 * lowest storey's contents are a layer's group. Showing storey k lifts bands k and up.
 */
export function storeysOf(model) {
  const levels = Array.isArray(model.levels) && model.levels.length ? model.levels : [0];
  const ground = Math.max(0, levels.indexOf(0)), ceiling = model.ceiling || 0;
  const cs = Array.isArray(model.ceilings) ? model.ceilings : [];
  return { ground, list: levels.map((floor, index) => ({ index, floor, cut: index === ground ? ceiling : floor + (Number.isFinite(cs[index]) ? cs[index] : ceiling) })) };
}

/**
 * pitOf(model, storeys = storeysOf(model)) -> the outer outlines [[[x, z], ...], ...] of the storeys
 * below the ground: the union of their rooms' and stairs' rects grown by half their thickest wall, so it reaches
 * the walls' outer face; [] for a house with none. The ground surfaces leave it open.
 */
export function pitOf(model, storeys = storeysOf(model)) {
  const below = i => Number.isInteger(i) && i < storeys.ground;
  const g = Math.max(0, ...(model.walls || []).filter(w => below(w.level)).map(w => (w.t || 0) / 2));
  // a stair down is often in no room of its own
  const flights = (model.furniture || []).filter(f => (f.kind === 'stair' || f.kind === 'landing') && below(storeyOfItem(model, storeys, f))).map(f => f.rect);
  const rects = (model.rooms || []).filter(r => below(r.level)).flatMap(r => r.rects).concat(flights).map(([x0, z0, x1, z1]) => [x0 - g, z0 - g, x1 + g, z1 + g]);
  if (!rects.length) return [];
  const xs = [...new Set(rects.flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap(r => [r[1], r[3]]))].sort((a, b) => a - b);
  const cells = xs.slice(1).map((x, i) => zs.slice(1).map((z, j) => inRects(rects, [(xs[i] + x) / 2, (zs[j] + z) / 2], true)));
  const on = (i, j) => !!(cells[i] && cells[i][j]);
  // the boundary's edges between grid corners, each with the covered cell on its one side
  const next = new Map(), key = (i, j) => `${i},${j}`;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    if (!on(i, j)) continue;
    if (!on(i, j - 1)) next.set(key(i, j), [i + 1, j]);
    if (!on(i + 1, j)) next.set(key(i + 1, j), [i + 1, j + 1]);
    if (!on(i, j + 1)) next.set(key(i + 1, j + 1), [i, j + 1]);
    if (!on(i - 1, j)) next.set(key(i, j + 1), [i, j]);
  }
  const loops = [];
  while (next.size) {
    const [start] = next.keys(), loop = [];
    for (let k = start; next.has(k);) {
      const [i, j] = k.split(',').map(Number), to = next.get(k);
      next.delete(k);
      const prev = loop[loop.length - 2], last = loop[loop.length - 1], p = [xs[i], zs[j]];
      // corners only: a point in line with the two before it is dropped
      if (prev && (prev[0] === last[0] && last[0] === p[0] || prev[1] === last[1] && last[1] === p[1])) loop.pop();
      loop.push(p);
      k = key(...to);
    }
    // walked with the covered side on the right in x-z, so an outer outline turns one way and a
    // courtyard inside the pit the other; only outer outlines are kept, so a courtyard opens with it
    const area = loop.reduce((s, [x, z], n) => { const [x2, z2] = loop[(n + 1) % loop.length]; return s + x * z2 - x2 * z; }, 0);
    if (area > 0) loops.push(loop);
  }
  return loops;
}

/**
 * liftBands(THREE, storeys, group, lift) -> { lifts, of(s), above(s) }: a layer's lift bands, one
 * per storey, lift the last (a house of one storey has lift alone); of(s) is
 * where storey s's contents go (the group for the lowest), above(s) the band over its cut.
 */
export function liftBands(THREE, storeys, group, lift) {
  const n = storeys.list.length;
  const lifts = storeys.list.map((_, i) => (i === n - 1 ? lift : new THREE.Group()));
  const matsOf = o => (Array.isArray(o.material) ? o.material : [o.material]);
  return {
    lifts,
    of: s => (s <= 0 ? group : lifts[Math.min(s, n) - 1]),
    above: s => lifts[Math.max(0, Math.min(s, n - 1))],
    // each band fades on its own, so a material it shares with the group or another band becomes
    // its own copy; call it once everything is built. A house of one storey keeps its materials.
    separate() {
      if (n < 2) return;
      const roots = [group, ...lifts], users = new Map();
      roots.forEach((r, i) => r.traverse(o => { if (o.material) matsOf(o).forEach(m => { if (!users.has(m)) users.set(m, new Set()); users.get(m).add(i); }); }));
      lifts.forEach(r => {
        const mine = new Map();
        const own = m => (users.get(m).size < 2 ? m : mine.get(m) || mine.set(m, m.clone()).get(m));
        r.traverse(o => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); });
      });
    }
  };
}

/** bandTargets(level, n) -> each of n bands' fade target: 0 (lifted) from storey level up, else 1; level null is the roof on. */
export const bandTargets = (level, n) => Array.from({ length: n }, (_, i) => (level === null || i < level ? 1 : 0));

/** liftsOf(L, n) -> a built layer's n lift bands: its lifts, else its one lift as the last band. */
export function liftsOf(L, n = 1) {
  if (Array.isArray(L.lifts)) return L.lifts;
  return L.lift ? [...Array(Math.max(0, n - 1)).fill(null), L.lift] : [];
}

/** levelOf(item, storeys) -> a wall's, room's or chimney's storey: its level, else the ground's. */
export const levelOf = (o, storeys) => (Number.isInteger(o.level) ? o.level : storeys.ground);

/**
 * storeyOfItem(model, storeys, f) -> a piece of furniture's storey: its level, else the room under
 * its centre whose floor is at or below its foot, the highest such, else the highest storey whose
 * floor is (scripts/house3d_model.py item_level).
 */
export function storeyOfItem(model, storeys, f) {
  if (Number.isInteger(f.level)) return f.level;
  const levels = storeys.list.map(s => s.floor), rooms = model.rooms || [];
  const y0 = (f.y || [0])[0], [x, z] = f.rect ? [(f.rect[0] + f.rect[2]) / 2, (f.rect[1] + f.rect[3]) / 2] : f.circle || [0, 0];
  const under = rooms.map(r => levelOf(r, storeys)).filter((lv, i) => levels[lv] !== undefined && levels[lv] <= y0 + 0.01 && inRects(rooms[i].rects, [x, z]));
  const pick = list => list.reduce((a, b) => (a === null || levels[b] > levels[a] ? b : a), null);
  return pick(under) ?? pick(levels.map((_, i) => i).filter(i => levels[i] <= y0 + 0.01)) ?? 0;
}

/**
 * storeyName(storeys, index, names) -> the picker's name for a storey: names[index] (the model's
 * showcase.level_names), else "N. korrus" counted from the ground as 1, below it "Kelder".
 */
export function storeyName({ ground }, index, names = {}) {
  if (names[index]) return names[index];
  return index < ground ? 'Kelder' : `${index - ground + 1}. korrus`;
}

/**
 * chimneysOf(model) -> [{ id, rect, top, level, cut }]: geometry.chimneys with the ground's level
 * filled in and cut, its storey's cut where the chimney runs above it, else 0; the card's model is
 * not validated, so an entry without a name, or not a rect on a level of the model with its top
 * above that floor, is left out rather than drawn.
 */
export function chimneysOf(model) {
  const st = storeysOf(model), levels = st.list.map(s => s.floor);
  return (Array.isArray(model.chimneys) ? model.chimneys : []).filter(Boolean)
    .map(c => ({ id: c.id, rect: c.rect, top: c.top, level: c.level ?? st.ground }))
    .filter(({ id, rect: r, top, level }) => typeof id === 'string' && id && Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[0] < r[2] && r[1] < r[3]
      && Number.isInteger(level) && level >= 0 && level < levels.length && Number.isFinite(top) && top > levels[level])
    .map(c => ({ ...c, cut: c.top > st.list[c.level].cut ? st.list[c.level].cut : 0 }));
}

/**
 * houseTop(model) -> the highest of the ceiling, the roofs with their thickness and the
 * chimneys' tops (0 without any).
 */
export function houseTop(model) {
  return Math.max(model.ceiling || 0, ...Object.values(model.roofs || {}).map(r => roofPeak(r) + (r.thick || 0)), ...chimneysOf(model).map(c => c.top));
}

/**
 * roofPeak(r) -> the highest point of roof r's line: a shed roof's high_y, a flat roof's y, a
 * hip or gable roof's highest wing ridge (the eave plus the slope over half the wing's span
 * across it).
 */
export function roofPeak(r) {
  if (roofKind(r) === 'shed') return r.high_y;
  if (roofKind(r) === 'flat') return r.y;
  const s = roofSlope(r), gableX = roofKind(r) === 'gable' && r.ridge === 'x', gableZ = roofKind(r) === 'gable' && r.ridge === 'z';
  return Math.max(...r.rects.map(([x0, z0, x1, z1]) => r.eave_y + (s * (gableX ? z1 - z0 : gableZ ? x1 - x0 : Math.min(x1 - x0, z1 - z0))) / 2));
}

/**
 * seasonOn(date) -> true from 1 November to 31 March inclusive, by the local calendar date: the
 * winter layer's default, shared by the card and the viewer.
 */
export function seasonOn(date) {
  const m = date.getMonth();
  return m >= 10 || m <= 2;
}

/**
 * seasonWindow(date) -> the season window or the gap between two the date is in: 'YYYY-11' for
 * the winter that starts in November of YYYY, 'gap-YYYY' for April to October of YYYY. A switch
 * the user flips holds for that window only.
 */
export function seasonWindow(date) {
  const y = date.getFullYear(), m = date.getMonth();
  if (!seasonOn(date)) return `gap-${y}`;
  return `${m >= 10 ? y : y - 1}-11`;
}

// the card asks for a PV item's normal on every sun tick; a roof's faces are built once
const NORMAL_FACES = new WeakMap();

/**
 * roofNormal(model, roofId, at) -> [x, y, z]: the unit normal of a roof's top, leaning towards
 * the side it falls to: a shed roof's plane, a hip or gable roof's face at plan point at [x, z],
 * which a caller on such a roof passes (straight up off the roof or without at, and on a flat
 * roof).
 */
export function roofNormal(model, roofId, at) {
  const r = model.roofs[roofId];
  if (roofKind(r) !== 'shed') {
    if (!NORMAL_FACES.has(r)) NORMAL_FACES.set(r, roofFaces(r));
    const p = at ? faceAt(NORMAL_FACES.get(r), at) : null;
    if (!p) return [0, 1, 0];
    const n = Math.hypot(p[0], 1, p[1]);
    return [-p[0] / n, 1 / n, -p[1] / n];
  }
  const slope = r.slope ?? Math.tan(r.pitch_deg * D2R), sign = r.falls === 'west' ? -1 : 1;
  const n = Math.hypot(slope, 1);
  return [(sign * slope) / n, 1 / n, 0];
}

/**
 * roofTop(roof, model, roofId) -> (x, z) -> the height of the roof slab's top surface (roof is
 * modelFrame()'s): the slab runs up from under the roof line by its thickness.
 */
export function roofTop(roof, model, roofId) {
  const fn = roof.fns[roofId], thick = model.roofs[roofId].thick;
  return (x, z) => fn(x, z) - roof.gap + thick;
}

/**
 * pvNow(kwp, normal, sun) -> kW from kwp of panels facing normal (unit [x, y, z]) under a clear
 * sky, for sun { alt, dir } (degrees, unit vector towards the sun); 0 without a sun or below the
 * horizon. Beam normal irradiance 1353 * 0.7^(AM^0.678) W/m2 with AM = 1 / sin(alt), diffuse a
 * tenth of it, 0.86 of the irradiance on the panel per kWp, never above 0.8 kW per kWp.
 */
export function pvNow(kwp, normal, sun) {
  if (!sun || !(sun.alt > 0)) return 0;
  const beam = SOLAR_CONSTANT * Math.pow(0.7, Math.pow(1 / Math.sin(sun.alt * D2R), 0.678));
  const [nx, ny, nz] = normal, [sx, sy, sz] = sun.dir;
  const cos = (nx * sx + ny * sy + nz * sz) / (Math.hypot(nx, ny, nz) * Math.hypot(sx, sy, sz));
  const onPanel = beam * Math.max(0, cos) + DIFFUSE * beam;
  return Math.min(PV_PEAK * kwp, (kwp * PV_LOSSES * onPanel) / 1000);
}

/**
 * tapAction(markerHit, layerHit) -> what a tap does: { marker: id } or { room: id } for a marker
 * or chip under it ('m:<id>' or 'c:<room>' from the overlay, which wins), else from the scene hit
 * { car: true }, { feature: id }, { room: id } or, for empty space, { none: true }.
 */
export function tapAction(markerHit, layerHit) {
  if (markerHit) return markerHit[0] === 'm' ? { marker: markerHit.slice(2) } : { room: markerHit.slice(2) };
  if (layerHit && layerHit.car) return { car: true };
  if (layerHit && layerHit.feature) return { feature: layerHit.feature };
  if (layerHit && layerHit.room) return { room: layerHit.room };
  return { none: true };
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
 * rooms) with the roofs' overhang and the chimneys, and houseTop().
 */
export function homeBox(model) {
  const rects = (model.rooms || []).filter(r => r.floor !== 'paving').flatMap(r => r.rects);
  const pts = (rects.length ? rects.flatMap(([x0, z0, x1, z1]) => [[x0, z0], [x1, z1]]) : (model.walls || []).flatMap(w => [w.a, w.b]))
    .concat(Object.values(model.roofs || {}).flatMap(r => (roofKind(r) === 'shed' ? r.outline || [] : r.rects.flatMap(([x0, z0, x1, z1]) => [[x0, z0], [x1, z1]]))))
    .concat(chimneysOf(model).flatMap(({ rect: [x0, z0, x1, z1] }) => [[x0, z0], [x1, z1]]));
  const b = pts.reduce((a, [x, z]) => [Math.min(a[0], x), Math.min(a[1], z), Math.max(a[2], x), Math.max(a[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  return [...b, houseTop(model) || 3];
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
 * edge. The projected box is centred, and the target slid along the view line to 0.3 of the way
 * from the box's bottom (box[5], default the ground) to its top.
 */
export function homeView(box, dir, aspect, fov, margin = 0.12) {
  const [x0, z0, x1, z1, top, bottom = 0] = box;
  const corners = [];
  for (const x of [x0, x1]) for (const y of [bottom, top]) for (const z of [z0, z1]) corners.push(new THREE.Vector3(x, y, z));
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1e5), v = new THREE.Vector3();
  const lift = bottom + (top - bottom) * 0.3, target = new THREE.Vector3((x0 + x1) / 2, lift, (z0 + z1) / 2);
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

// the light tier unless options.quality says otherwise: a device that reports few cores or little
// memory (a tablet), where Foto's cards and normal maps cost the most
export function autoQuality(nav = typeof navigator === 'undefined' ? {} : navigator) {
  return (nav.hardwareConcurrency || 8) <= LOW_CORES || (nav.deviceMemory || 8) <= LOW_MEMORY ? 'low' : 'high';
}

/**
 * aoWanted({ lit, ao, width, roofFade }) -> true when the contact shadows should show: a lit
 * style, not switched off by options.ao, at least BLOOM_MIN_WIDTH wide and the roof fully off.
 */
export function aoWanted({ lit, ao, width, roofFade }) {
  return !!lit && ao !== false && width >= BLOOM_MIN_WIDTH && roofFade <= AO_ROOF_OFF;
}

/**
 * resolveStyle({ style, stage }) -> { lit, style, stage }: mount()'s style and stage from its
 * options, 'simple' and 'garden' for anything unknown; the stage is a lit style's, and the studio
 * is Päris's in every lit style, so a lit style there is 'real'.
 */
export function resolveStyle({ style, stage }) {
  const lit = style === 'real' || style === 'photo';
  const studio = lit && stage === 'studio';
  return { lit, style: !lit ? 'simple' : studio ? 'real' : style, stage: studio ? 'studio' : 'garden' };
}

/**
 * stageLayers(style, stage) -> the layer ids mount() builds: the studio stage of the lit styles
 * builds only the house (pergola, building, interior), every other style and stage all of LAYERS.
 */
export function stageLayers(style, stage) {
  return style !== 'simple' && stage === 'studio' ? LAYERS.filter(id => STUDIO_LAYERS.includes(id)) : LAYERS.slice();
}

/**
 * mount(element, model, options) -> { setMarkers, setRoomChips, focusRoom, setMode, setLevel, setSelection, setCar,
 *                                     setLayer, setSun, setTime, reset, resize, dispose, mode, level, storeys,
 *                                     carState, carScreen, layers, time, view, sun }
 *
 * model: geometry + rooms layers (private is ignored, showcase gives only level_names). A wall with finish 'panel' is
 *   drawn in the lit styles as a panel in the frame's colour (the carport's walls and posts); a room's floor
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
 *   onMode(mode, level) the mode changed ('roof' | 'open'), level the storey shown from inside or null
 *   onCar()          the car's body was tapped (either mode, while it shows); no room tap follows
 *   onFeature(id)    a layer's feature (a future item) was tapped; no room tap follows
 *   onSun(sun)       the sun changed: setSun, setTime and the minute tick while live, in both
 *                    styles; sun as the sun getter gives it
 *   onFirstFrame()   the first frame is on the canvas
 *   onIdle()         the frame loop has stopped: nothing moves until the next change
 *   bloom            default true; always off below 720 px width and in the lit styles
 *   ao               default true; false keeps a lit style's contact shadows off, which are
 *                    otherwise on from 720 px width with the roof fully off
 *   mode             the starting mode, 'roof' (default) or 'open' (the top storey from inside)
 *   level            the starting storey shown from inside, an index into model.levels; over mode
 *   style            'simple' (default), 'real' (Päris) or 'photo' (Foto, scene/photo.js: Päris until its
 *                    textures, house3d/assets/, are in after the first frame); another style is another mount
 *   quality          Foto's tier: 'high', or 'low' (fewer leaf cards, half the twig cards, no normal maps, no contact
 *                    shadows); autoQuality() picks it when left out
 *   stage            a lit style's stage: 'garden' (default), the lot under the sun's clock, or
 *                    'studio', the house alone on a white base in soft studio light, where setSun
 *                    and setTime change nothing drawn; another stage is another mount
 *   bake             the URL of a house's bake.json (scripts/house3d-bake.sh): its contact shadows,
 *                    fetched after the first frame and applied in the lit styles when every baked
 *                    mesh matches, else none with one console warning
 *   view             { position, target } as the view getter gives it: the first framing puts
 *                    the camera there instead of the home view, so a remount keeps the user's orbit
 *   labels(roomId)   room label text; the room's own name when it returns nothing
 *   noWebGL          the text shown where WebGL is missing; default Estonian (the card passes
 *                    its language's)
 *   layers           { id: bool }: the starting state of the switchable layers, default on
 *   snowfall         true lets the winter layer's snow fall while it is on (never under reduced
 *                    motion); the card asks for it in the full view, not in the hero
 *   car              { profile, path }: a vehicle drawn from profile, built hidden. profile is in
 *                    metres in the car's frame (origin on the ground at its centre, +x forward,
 *                    y up): length, width, height, side and glass outlines [[x, y], ...],
 *                    wheels { r, x: [rear, front], track }, lights { front, rear } as lists of
 *                    [[x, y, z], [x, y, z]] segments. path is [[x, z], ...]; the car drives a
 *                    smooth curve through it and parks at the last point, facing along the last leg.
 *   surroundings     { buildings: [{ outline: [[x, z], ...], height }], roads: [{ outline, holes? }] }:
 *                    the neighbouring buildings and the street as a flat surface, faint, never
 *                    tapped; the simple style draws a building as a box, the lit styles give a
 *                    house-sized rectangular one a gable (surroundings.js)
 * setLevel(k | null): storey k from inside, everything over its cut lifted away; null puts the roof
 *   on. setMode('open') is setLevel of the top storey, setMode('roof') setLevel(null); mode reads
 *   'open' while any storey is shown. level is the storey shown or null; storeys is
 *   [{ index, name }] in levels' order, each name the picker's (storeyName()). Room labels, chips
 *   and an indoor marker show for the shown storey's rooms alone.
 * snapshot(maxWidth): the scene as it stands, without the markers, as a JPEG data URL at most
 *   maxWidth pixels wide, or null (not framed yet, the WebGL context lost, no WebGL); the card
 *   keeps one as the next load's first picture.
 * setCar('away' | 'parked' | 'arrive'): 'arrive' drives the whole path (3-6 s, restarts if it is
 *   already driving; 'parked' under reduced motion), after the drive gate, if any, has opened
 *   (1.2 s); the gate closes once the car is through. 'parked' stands it at the path's end, 'away'
 *   fades it out; both close the gate at once. carState is 'away' | 'driving' | 'parked'; carScreen
 *   is the car's projected centre { x, y } in CSS pixels relative to the element, or null when it
 *   is away, switched off or behind. Without a car, setCar does nothing, carState is 'away', carScreen null.
 * setSun({ lat, lon, bearing } | null): the place for the sun, in degrees, bearing the L-EST97
 *   grid azimuth of the model's +x axis (georef.x_axis_bearing_deg); null or any missing value
 *   gives the lit styles a fixed afternoon sun. setTime(date | null): the sun's time, null for
 *   live (recomputed once a minute while there is a place). time is the time in use. sun is
 *   { alt, dir: [x, y, z], time } (degrees, the unit vector towards the sun in model axes, the
 *   Date it was computed for), or null without a place, in every style; only the lit styles
 *   draw it. view is { position, target } for options.view; the fog follows the camera.
 * layers: [{ id, on }] for the switchable layers present and listed now; setLayer(id, on) switches
 *   one and ignores an unknown id. Switchable: 'markers' (the overlay; off hides every marker but
 *   an alert), 'fans' (listed while a marker has a look), 'trees', 'surroundings', 'winter' (the
 *   lit styles' lights and snow) and 'car' (off parks a running drive and closes the gate at
 *   once, and 'arrive' then parks). A layer that is off takes no taps.
 * markers: { id, pos: [x, y, z], at?: [x, y, z], icon, state: 'idle'|'on'|'alert'|'off', value?,
 *            label?, stateText?, room?, look?: [dx, dz], role?, level?: 0..1, glow?: 0..1, pulse?, warm? }
 *   pos is the device, where its view fan starts; at, when given, is where its marker is drawn,
 *   so two devices side by side can be drawn apart. label and stateText make the marker's
 *   accessible name. Markers take no pointer, so a drag
 *   that starts on one orbits; a tap on the canvas tests the shown markers' and chips' rectangles
 *   first. Every frame a collision pass (scene/overlay.js's collide(), which gives the order)
 *   places the markers and chips, shrinks the crowded ones and hides what is left; an alert never
 *   hides, and the pass never hides a camera, which keeps at least its dot. Showing and hiding fade over 0.2 s.
 * setRoomChips([{ room, parts: [{ icon, text?, label?, state? }], state: 'idle'|'on'|'alert', ids?: [id] }]):
 *   one chip per house room (not a paved one), at the room's label in place of it, with the roof
 *   off only. A chipped room's markers that are neither 'on' nor 'alert', and those in its ids,
 *   are counted in the chip instead of drawn (scene/overlay.js's inChip()). Below 720 px a chip
 *   keeps its parts and drops the room name, and one without parts hides. A tap on a chip calls onRoom(room).
 * focusRoom(id | null): frames that room (0.6 s; at once under reduced motion), shows all its
 *   markers and selects its floor, showing its storey when another one is shown from inside; null returns to the overview and leaves the camera. The card
 *   uses this; setSelection(id) marks a room's floor or a marker by id: the viewer's selection,
 *   and the card's open camera. The two share one selection, so focusRoom() replaces it.
 *   A marker whose room is a house room shows only with the roof off, unless its state is
 *   'alert'; state 'on' warms that room's floor unless warm is false. In the lit styles at night a
 *   room glows from its brightest 'on' light's level or any of its markers' glow, whatever its
 *   state. role 'pergola-light' drives the pergola's LED glow.
 */
export function mount(element, model, options = {}) {
  const root = document.createElement('div');
  root.className = 'h3d';
  const css = document.createElement('style');
  css.textContent = STYLE;
  const stage = document.createElement('div');
  stage.className = 'h3d-stage';
  const overlayEl = document.createElement('div');
  overlayEl.className = 'h3d-overlay';
  root.append(css, stage, overlayEl);
  element.appendChild(root);

  const mq = q => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    const msg = document.createElement('div');
    msg.className = 'h3d-fallback';
    msg.textContent = options.noWebGL || 'See seade ei toeta WebGL-i, mistõttu 3D-vaadet ei saa näidata.';
    stage.appendChild(msg);
    const noop = () => {};
    return { failed: true, setMarkers: noop, setRoomChips: noop, focusRoom: noop, setMode: noop, setLevel: noop, setSelection: noop, setCar: noop, setLayer: noop, reset: noop, resize: noop,
      setSun: noop, setTime: noop, snapshot: () => null, dispose: () => root.remove(), mode: 'roof', level: null, storeys: [], carState: 'away', carScreen: null, layers: [], time: null, view: null, sun: null };
  }
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const { lit, style, stage: scenery } = resolveStyle(options), studio = scenery === 'studio';
  const kit = createKit(THREE, style, model.look), C = kit.C;
  const look = createLook(THREE, kit, style, { light: realLight, photo: photoLook, quality: options.quality || autoQuality() });
  root.classList.toggle('h3d-real', lit);
  const scene = new THREE.Scene();
  scene.background = C.bg;
  scene.fog = new THREE.Fog(C.bg, 34, 78);

  /* ---------- model ---------- */
  // every storey's rooms; the overlay shows the shown storey's labels and chips
  const storeys = storeysOf(model), topStorey = storeys.list.length - 1, pit = pitOf(model, storeys);
  const levelNames = (model.showcase && model.showcase.level_names) || {};
  const storeyList = storeys.list.map(s => ({ index: s.index, name: storeyName(storeys, s.index, levelNames) }));
  const storeyOfRoom = r => storeys.list[Math.min(topStorey, Math.max(0, levelOf(r, storeys)))];
  const rooms = model.rooms || [];
  const roomById = Object.fromEntries(rooms.map(r => [r.id, r]));
  const { roof, frame: modelBox } = modelFrame(model);
  const { ext, E } = modelBox;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300 * E);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8 * E;
  controls.maxDistance = 130 * E;
  controls.maxPolarAngle = 1.38;
  controls.screenSpacePanning = false;

  /* ---------- layers ---------- */
  // level: the storey shown from inside, null with the roof on; a fade per lift band, the last the roofs'
  let mode = 'roof', level = null, sel = null, hovered = null, night = 0, sunNow = null;
  const fades = storeys.list.map(() => ({ cur: 1, to: 1 })), fade = fades[topStorey];
  const state = {
    get mode() { return mode; },
    get level() { return level; },
    bandFade: i => (fades[i] ? fades[i].cur : 1),
    get roofFade() { return fade.cur; },
    get hovered() { return hovered; },
    get selection() { return sel; },
    get night() { return night; },
    get sun() { return sunNow; }
  };
  const screenV = new THREE.Vector3();
  const screen = (x, y, z) => toScreen(camera, [x, y, z], width, height, screenV);
  const byId = {};
  const ctx = {
    THREE, kit, C, model, options, style: look.id, look, stage: scenery, reduceMotion, state, screen,
    frame: modelBox,
    roof,
    ceiling: model.ceiling,
    storeys,
    levelOf: o => levelOf(o, storeys),
    storeyOf: f => storeyOfItem(model, storeys, f),
    pit,
    bands: (group, lift) => liftBands(THREE, storeys, group, lift),
    layer: id => byId[id] || null,
    invalidate: () => invalidate()
  };
  // the marker overlay (scene/overlay.js) is switched like a layer; it has no group
  const markerLayer = { L: { id: 'markers', toggle: true, listed: () => overlay.count > 0 }, wrap: null, on: true };
  const layers = [markerLayer];
  const built = new Set(stageLayers(style, scenery));
  BUILDERS.forEach((mod, i) => {
    const L = mod && built.has(LAYERS[i]) && buildLayer(mod, LAYERS[i], ctx);
    if (!L) return;
    const wrap = new THREE.Group(), bands = liftsOf(L, fades.length);
    wrap.add(L.group);
    bands.forEach(g => { if (g) wrap.add(g); });
    scene.add(wrap);
    byId[L.id] = L;
    const e = { L, wrap, bands, on: true, failed: false };
    // a failed layer stays hidden, leaves the Kihid list and takes no more taps, and is told it is
    // off (once, unguarded), so what it changed in another layer (the winter's snow on the
    // ground) goes too
    const setOn = L.setOn;
    guardLayer(L, () => {
      e.failed = true; e.on = false; wrap.visible = false;
      try { if (setOn) setOn.call(L, false); } catch (err) { /* already logged as failed */ }
    });
    layers.push(e);
  });
  function switchLayer(e, on) {
    e.on = on;
    if (e.wrap) e.wrap.visible = on;
    if (e.L.setOn) e.L.setOn(on);
  }
  const shadowsDirty = () => { if (lit) renderer.shadowMap.needsUpdate = true; };
  function setLayer(id, on) {
    const e = layers.find(x => x.L.toggle && x.L.id === id && !x.failed);
    if (!e || e.on === !!on) return;
    switchLayer(e, !!on);
    // a look may light the winter its own way (Foto's overcast)
    if (id === 'winter' && look.winter) updateSun();
    // a layer switched off under the mouse no longer takes the hover
    if (!e.on) { hovered = null; renderer.domElement.style.cursor = ''; }
    shadowsDirty();
    invalidate();
  }
  // a stored choice applies before the first frame, also to a layer not listed yet; every
  // switchable layer hears its starting state, on or off
  const start = options.layers || {};
  layers.forEach(e => { if (e.L.toggle) switchLayer(e, start[e.L.id] !== false); });
  // what a bake would darken, taken before the roof's fade changes an opacity (scene/bake.js)
  let bakeList = null;
  if (lit && options.bake && BAKE) {
    try { bakeList = BAKE.bakeTargets(layers.map(e => e.L)); } catch (e) { console.error('house3d: bake failed', e); }
  }

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
  const bloomOn = () => !lit && options.bloom !== false && width >= BLOOM_MIN_WIDTH;

  /* ---------- a lit style's contact shadows, loaded on first use ---------- */
  // Not a composer pass: OutputPass would tone-map the sky and the sun's glow, which the plain draw
  // leaves untouched. The scene draws to the canvas as ever and the shadows multiply over it.
  let ao = null, aoLoading = false, aoLevel = 0;
  function loadAO() {
    aoLoading = true;
    import('./vendor/three-0.187.0/examples/jsm/postprocessing/GTAOPass.js').then(({ GTAOPass }) => {
      if (disposed) return;
      const pass = new GTAOPass(scene, camera, width, height);
      pass.output = GTAOPass.OUTPUT.Denoise;
      pass.updateGtaoMaterial({ radius: AO_RADIUS, scale: AO_SCALE, samples: AO_SAMPLES });
      // glass, sheers, the floor shade, the sun's glow and Foto's leaf cards have no surface to
      // shade: drawn into the normals they would leave a dark halo round what is behind them
      const clear = x => x.transparent || x.alphaTest > 0;
      const seeThrough = m => (Array.isArray(m) ? m.some(clear) : !!m && clear(m));
      pass._overrideVisibility = () => scene.traverseVisible(o => {
        if (!(o.isPoints || o.isLine || o.isLine2 || o.isSprite || seeThrough(o.material))) return;
        o.visible = false;
        pass._visibilityCache.push(o);
      });
      const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
      const quad = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { tAO: { value: target.texture }, level: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D tAO; uniform float level; varying vec2 vUv;'
          + ' void main() { gl_FragColor = vec4(mix(vec3(1.0), texture2D(tAO, vUv).rgb, level), 1.0); }',
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
        blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
        depthTest: false, depthWrite: false
      }));
      ao = { pass, target, quad };
      invalidate();
    }).catch(e => console.error('house3d: contact shadows failed to load', e));
  }
  // one step of the fade towards what is wanted now; true while it still moves
  function stepAO(dt) {
    const wanted = aoWanted({ lit, ao: look.ao ?? options.ao, width, roofFade: fade.cur });
    if (wanted && !aoLoading) loadAO();
    const to = wanted && ao ? 1 : 0;
    if (aoLevel === to) return false;
    const step = reduceMotion ? 1 : dt / AO_RAMP;
    aoLevel = to > aoLevel ? Math.min(to, aoLevel + step) : Math.max(to, aoLevel - step);
    return true;
  }
  function drawAO() {
    ao.pass.render(renderer, ao.target, null);
    renderer.setRenderTarget(null);
    const clears = renderer.autoClear;
    renderer.autoClear = false;
    ao.quad.material.uniforms.level.value = aoLevel;
    ao.quad.render(renderer);
    renderer.autoClear = clears;
  }

  /* ---------- a lit style's sun, sky and shadows ---------- */
  // sun is the one shadow-casting light: the sun while it is up, the moon below the horizon
  let sun = null, fill = null, hemi = null, glow = null, sunPlace = null, sunTime = null, sunTimer = 0;
  const liftCasts = fades.map(() => true), liftAt = fades.map(() => null);
  // the sky behind the scene, and the same sky as the environment the surfaces reflect, both
  // redrawn only when their colours move by a 40th (skyKey), not on every minute or slider step
  let skyTex = null, pmrem = null, envScene = null, envMat = null, envTarget = null, skyKey = '';
  // towards the sun, unit length, at every altitude (sunV is set only while it is up)
  const sunDir = new THREE.Vector3();
  const lowSun = new THREE.Color(LOW_SUN), horizon = new THREE.Color(), zenith = new THREE.Color(), px = new THREE.Color();
  if (lit) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // the shadow camera is fixed to the lot box, so a camera move needs no shadow pass: the map
    // renders only when the sun, the roof, a layer or the map itself changes (shadowsDirty)
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    // the ground bounces light onto the walls: a shaded wall is a little darker than
    // a sunlit one, not near black
    hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1);
    sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.castShadow = true;
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02; // the walls are DoubleSide, both faces go into the map
    fill = new THREE.DirectionalLight('#ffffff', 0);
    scene.add(hemi, sun, sun.target, fill);
    pmrem = new THREE.PMREMGenerator(renderer);
  }
  if (lit && !studio) {
    // neutral keeps the specification's colours closest
    renderer.toneMapping = THREE.NeutralToneMapping;
    skyTex = kit.keep(new THREE.DataTexture(new Uint8Array(SKY_PX * 4), 1, SKY_PX));
    skyTex.colorSpace = THREE.SRGBColorSpace;
    skyTex.magFilter = THREE.LinearFilter;
    scene.background = skyTex;
    envMat = kit.keep(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; varying vec3 vP;'
        + ' void main() { float y = normalize(vP).y; gl_FragColor = vec4(y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon, ground, min(1.0, -y * 4.0)), 1.0); }'
    }));
    envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(kit.keep(new THREE.SphereGeometry(1, 32, 16)), envMat));
    // the sun's disc and glow, far out along its direction; buildings and trees hide it through
    // the depth test
    glow = new THREE.Sprite(kit.keep(new THREE.SpriteMaterial({
      map: kit.canvasTexture(128, [[0, 'rgba(255,255,255,1)'], [0.05, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,236,210,0.6)'], [1, 'rgba(255,222,180,0)']]),
      fog: false, depthWrite: false, toneMapped: false, transparent: true
    })));
    scene.add(glow);
  }
  // the shadow camera holds the lot from the ground to the highest roof, chimney or tree
  const msite = model.site || {};
  const shadowTop = 0.5 + Math.max(houseTop(model),
    ...(msite.trees || []).map(t => t.height), msite.garage_roof && msite.garage_roof.y ? msite.garage_roof.y[1] : 0,
    msite.pergola ? msite.pergola.height : 0);
  // the sky texture: the horizon colour up to SKY_HORIZON of the view, blending to the zenith's at
  // its top (row 0 is the bottom)
  function paintSky() {
    const d = skyTex.image.data;
    for (let j = 0; j < SKY_PX; j++) {
      const t = Math.min(1, Math.max(0, (j / (SKY_PX - 1) - SKY_HORIZON) / (1 - SKY_HORIZON)));
      px.copy(horizon).lerp(zenith, Math.pow(t, 0.8)).convertLinearToSRGB();
      d.set([px.r * 255, px.g * 255, px.b * 255, 255], j * 4);
    }
    skyTex.needsUpdate = true;
  }
  const sunV = new THREE.Vector3(), corner = new THREE.Vector3(), shadowCentre = new THREE.Vector3();
  // the key light towards dir, its shadow camera holding the plan box [x0, z0, x1, z1] from y0 to y1
  function placeSun(dir, [x0, z0, x1, z1] = modelBox.lotBox, y0 = Math.min(0, storeys.list[0].floor), y1 = shadowTop) {
    shadowCentre.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
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
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
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
  // the studio: the house on a base before a floor and backdrop of one colour, lit by soft boxes,
  // a key with a wide penumbra and a fill; the sun's clock never moves it. Returns what the home
  // view frames: the whole base, a carport on it included
  function studioStage() {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = STUDIO.exposure;
    const backdrop = new THREE.Color(STUDIO.backdrop);
    scene.background = backdrop;
    scene.fog.color.copy(backdrop);
    // the base holds all the studio built, the roof on: the house, a carport, the pergola
    const bounds = new THREE.Box3();
    layers.forEach(e => { if (e.wrap) bounds.expandByObject(e.wrap); });
    const { x: x0, z: z0 } = bounds.min, { x: x1, y: top, z: z1 } = bounds.max, m = STUDIO.margin, d = STUDIO.baseDepth;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // the base's top sits just under the floor, so nothing at the house's floor fights with it
    const baseMat = kit.keep(new THREE.MeshStandardMaterial({ color: STUDIO.base, roughness: 0.85, metalness: 0 }));
    let base;
    if (pit.length) {
      // a basement opens its pit through the base and the floor; the shape's y is -z, so the turn
      // onto the ground extrudes it upwards
      const shape = new THREE.Shape([[x0 - m, z0 - m], [x1 + m, z0 - m], [x1 + m, z1 + m], [x0 - m, z1 + m]].map(([x, z]) => new THREE.Vector2(x, -z)));
      pit.forEach(l => shape.holes.push(new THREE.Path(l.map(([x, z]) => new THREE.Vector2(x, -z)))));
      base = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).rotateX(-Math.PI / 2), baseMat);
      base.position.y = -d - 0.003;
      scene.add(base);
    } else base = kit.solid(scene, baseMat, [x0 - m, z0 - m, x1 + m, z1 + m], [-d - 0.003, -0.003]);
    kit.keep(base.geometry);
    base.castShadow = base.receiveShadow = true;
    // the floor is the backdrop's colour unlit, so it meets the background with no horizon, and a
    // shadow catcher over it takes the key's shadow past the base
    const h = 300 * E;
    const plane = kit.keep(pit.length ? kit.flatShape([[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]], pit) : new THREE.PlaneGeometry(600 * E, 600 * E));
    const floor = new THREE.Mesh(plane, kit.keep(new THREE.MeshBasicMaterial({ color: backdrop, toneMapped: false })));
    const catcher = new THREE.Mesh(plane, kit.keep(new THREE.ShadowMaterial({ opacity: STUDIO.floorShadow })));
    [floor, catcher].forEach((o, i) => {
      if (pit.length) o.position.y = -d - 0.003 + i * 0.002;
      else {
        o.rotation.x = -Math.PI / 2;
        o.position.set(cx, -d - 0.003 + i * 0.002, cz);
      }
    });
    catcher.receiveShadow = true;
    scene.add(floor, catcher);
    hemi.intensity = STUDIO.hemi;
    hemi.groundColor.copy(backdrop);
    sun.intensity = STUDIO.key;
    sun.color.set(STUDIO.light);
    sun.shadow.radius = STUDIO.penumbra;
    fill.intensity = STUDIO.fill;
    fill.color.set(STUDIO.light);
    fill.position.set(...STUDIO.fillDir);
    const env = new THREE.Scene(), bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), side: THREE.DoubleSide });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: '#cfccc6', side: THREE.BackSide })));
    SOFT_BOXES.forEach(([x, y, z, size]) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bright);
      p.position.set(x, y, z);
      p.lookAt(0, 0, 0);
      env.add(p);
    });
    envTarget = pmrem.fromScene(env, 0.03);
    env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    scene.environment = envTarget.texture;
    scene.environmentIntensity = STUDIO.env;
    // the shadow camera holds the base and where the house's shadow falls past it on the floor
    const k = STUDIO.keyDir, run = (top + d) / k[1], sx = -k[0] * run, sz = -k[2] * run;
    placeSun(k, [Math.min(x0, x0 + sx) - m, Math.min(z0, z0 + sz) - m, Math.max(x1, x1 + sx) + m, Math.max(z1, z1 + sz) + m], -d, top + 0.5);
    return [x0 - m, z0 - m, x1 + m, z1 + m, top];
  }
  // the home view frames the house rooms, not the lot or the carport, and in the studio its base
  const homeFrame = studio ? studioStage() : homeBox(model);
  function updateSun() {
    if (sunPlace) {
      const time = sunTime ? new Date(sunTime) : new Date(), p = sunPosition(time, sunPlace.lat, sunPlace.lon);
      sunNow = { alt: p.altitude, dir: sunDirection(p.altitude, gridBearing(p.azimuth, sunPlace.lon), sunPlace.bearing), time };
    } else sunNow = null;
    if (options.onSun) options.onSun(sunNow);
    if (!lit || studio) return;
    let alt, dir;
    if (sunNow) {
      alt = sunNow.alt;
      dir = sunNow.dir;
    } else {
      dir = FIXED_SUN;
      alt = Math.asin(dir[1] / Math.hypot(...dir)) / D2R;
    }
    const L = look.light(alt);
    night = L.night;
    horizon.setRGB(...L.horizon);
    zenith.setRGB(...L.zenith);
    scene.fog.color.copy(horizon);
    sun.visible = L.key.intensity > 0;
    sun.intensity = L.key.intensity;
    sun.color.setRGB(...L.key.color);
    fill.visible = L.fill.intensity > 0;
    fill.intensity = L.fill.intensity;
    fill.color.setRGB(...L.fill.color);
    fill.position.set(...L.fill.dir);
    hemi.intensity = L.hemi.intensity;
    hemi.color.setRGB(...L.hemi.sky);
    hemi.groundColor.setRGB(...L.hemi.ground);
    // a look with its own sky (Foto's photographs) draws it, its environment and the fog
    const ownSky = !!look.sky && look.sky({ alt, dir, scene, pmrem });
    if (ownSky && envTarget) { envTarget.dispose(); envTarget = null; }
    const key = [...L.zenith, ...L.horizon, ...L.env.ground].map(v => Math.round(v * 40)).join();
    if (!ownSky && key !== skyKey) {
      skyKey = key;
      paintSky();
      envMat.uniforms.zenith.value.setRGB(...L.env.zenith);
      envMat.uniforms.horizon.value.setRGB(...L.env.horizon);
      envMat.uniforms.ground.value.setRGB(...L.env.ground);
      if (envTarget) envTarget.dispose();
      envTarget = pmrem.fromScene(envScene, 0, 0.1, 10);
      scene.environment = envTarget.texture;
    }
    if (!ownSky) scene.environmentIntensity = L.env.intensity;
    sunDir.set(dir[0], dir[1], dir[2]).normalize();
    const g = sunGlow(alt);
    glow.visible = g.visible && !ownSky;
    glow.material.opacity = g.opacity;
    glow.material.color.set('#ffffff').lerp(lowSun, g.warm);
    if (sun.visible) placeSun(L.key.dir || dir);
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

  /* ---------- markers, room labels and chips: scene/overlay.js ---------- */
  const overlay = createOverlay({
    THREE, root, el: overlayEl, camera, rooms, roomById, options, reduceMotion, toScreen, icon,
    width: () => width, height: () => height,
    roofFade: () => fade.cur, mode: () => mode, selection: () => sel, focus: () => focus, markersOn: () => markerLayer.on,
    shown: () => (level === null ? storeys.ground : level), storeyOf: r => storeyOfRoom(r).index, floorOf: r => storeyOfRoom(r).floor,
    invalidate, narrowBelow: BLOOM_MIN_WIDTH
  });
  function setMarkers(list) {
    overlay.setMarkers(list);
    layers.forEach(({ L }) => { if (L.markers) L.markers(list); });
  }

  /* ---------- modes and selection ---------- */
  // setLevel(k): storey k from inside, every band from k up lifted; null puts the roof on
  function setLevel(k, instant) {
    level = Number.isInteger(k) && k >= 0 && k <= topStorey ? k : null;
    mode = level === null ? 'roof' : 'open';
    const to = bandTargets(level, fades.length);
    fades.forEach((f, i) => { f.to = to[i]; });
    // an instant switch skips the frames that ease the fade, which would mark the shadows stale
    if (instant || reduceMotion) { fades.forEach(f => { f.cur = f.to; }); shadowsDirty(); }
    invalidate();
    if (options.onMode) options.onMode(mode, level);
  }
  // 'open' is the top storey from inside
  const setMode = (m, instant) => setLevel(m === 'open' ? topStorey : null, instant);
  function setSelection(id) {
    sel = id || null;
    overlay.rerender();
    invalidate();
  }
  // focusRoom(id): the camera moves in on the room (0.6 s, at once under reduced motion), its
  // markers all show and its floor is selected; null returns to the overview with the camera kept
  let focus = null, tween = null;
  function focusRoom(id) {
    const r = id && roomById[id];
    focus = r ? id : null;
    sel = focus;
    overlay.rerender();
    if (r) {
      // a small room is framed with what is round it, at least FOCUS_SPAN across, looked into from
      // at least 50 degrees up, from the side the camera is on now
      const b = r.rects.reduce((a, [x0, z0, x1, z1]) => [Math.min(a[0], x0), Math.min(a[1], z0), Math.max(a[2], x1), Math.max(a[3], z1)], [Infinity, Infinity, -Infinity, -Infinity]);
      [0, 1].forEach(i => { const c = (b[i] + b[i + 2]) / 2, half = Math.max(FOCUS_SPAN, b[i + 2] - b[i]) / 2; b[i] = c - half; b[i + 2] = c + half; });
      orbitV.copy(camera.position).sub(controls.target);
      const flat = Math.hypot(orbitV.x, orbitV.z) || 1, el = Math.max(50 * D2R, Math.atan2(orbitV.y, flat));
      const dir = new THREE.Vector3((orbitV.x / flat) * Math.cos(el), Math.sin(el), (orbitV.z / flat) * Math.cos(el));
      const st = storeyOfRoom(r);
      // a room on another storey than the one shown from inside is framed with its storey shown
      if (level !== null && st.index !== level) setLevel(st.index);
      const h = homeView([...b, st.cut, st.floor], dir, camera.aspect, camera.fov, 0.15);
      const to = { target: h.target, dist: Math.min(controls.maxDistance, Math.max(controls.minDistance, h.distance)) };
      tween = { t: reduceMotion ? 1 : 0, dir, from: { target: controls.target.clone(), dist: camera.position.distanceTo(controls.target) }, to };
      spin = null;
      userMoved = true;
    }
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
  const onMove = ev => {
    if (ev.pointerType !== 'mouse') return;
    const mk = pointers.size ? null : overlay.at(ev);
    overlay.hover(mk);
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
    tween = null;
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
    const mk = overlay.at(ev);
    const a = tapAction(mk, mk ? null : (aim(ev), hitTest()));
    if (a.marker) { if (options.onMarker) options.onMarker(a.marker); }
    else if (a.car) { if (options.onCar) options.onCar(); }
    else if (a.feature) { if (options.onFeature) options.onFeature(a.feature); }
    else if (options.onRoom) options.onRoom(a.room || null);
  };
  const onLeave = () => overlay.hover(null);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onRelease);
  // a camera change under a finger or a wheel zoom is the user's own view: from then on a resize
  // keeps it; 'start' alone fires on every tap and wheel event, so it does not count
  let userMoved = false;
  const onWheel = () => { userMoved = true; spin = null; tween = null; };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
  controls.addEventListener('change', () => { if (pointers.size) userMoved = true; fitFog(); invalidate(); });
  controls.addEventListener('start', () => invalidate());

  /* ---------- framing and size ---------- */
  let width = 1, height = 1, framed = false;
  // the home view for the current aspect, computed once per aspect
  let home = null;
  function homeFor() {
    if (!home || home.aspect !== camera.aspect) {
      const dir = homeDir(camera.aspect), h = homeView(homeFrame, dir, camera.aspect, camera.fov);
      home = { aspect: camera.aspect, dir, target: h.target, distance: Math.min(controls.maxDistance, Math.max(controls.minDistance, h.distance)) };
    }
    return home;
  }
  const homeDistance = () => homeFor().distance;
  // the simple style's fog starts just past the orbit target, never nearer than from the home
  // view: fixed to the home distance, a zoom-out sank the house itself into it. A lit style's
  // starts at the lot's farthest corner from the camera, so the lot stays clear and only the land
  // beyond fades, out by LOT_FOG times that distance
  const fogCorner = new THREE.Vector3();
  function fitFog() {
    if (lit) {
      const [x0, z0, x1, z1] = modelBox.lotBox;
      let far = 0;
      for (const x of [x0, x1]) for (const z of [z0, z1]) far = Math.max(far, camera.position.distanceTo(fogCorner.set(x, 0, z)));
      scene.fog.near = far;
      scene.fog.far = far * LOT_FOG;
      return;
    }
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
    if (ao) { ao.pass.setSize(w, h); ao.target.setSize(w, h); }
    overlay.resized(w < BLOOM_MIN_WIDTH);
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
  const orbitV = new THREE.Vector3(), orbitS = new THREE.Spherical();
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
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.6);
      const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
      controls.target.lerpVectors(tween.from.target, tween.to.target, e);
      camera.position.copy(controls.target).addScaledVector(tween.dir, tween.from.dist + (tween.to.dist - tween.from.dist) * e);
      if (tween.t >= 1) tween = null;
      moving = true;
    }
    if (syncCamera(controls, camera)) moving = true;
    // a coast into the polar limit stops turning that way
    if (spin && Math.abs(controls.getPolarAngle() - orbitS.phi) > 1e-6) spin = { az: spin.az, polar: 0 };
    if (pointers.size) {
      samples.push(sampleNow(now));
      while (samples.length > 2 && now - samples[0].t > 200) samples.shift();
    }
    fades.forEach((f, i) => {
      if (!kit.near(f.cur, f.to)) { f.cur += (f.to - f.cur) * k; moving = true; shadowsDirty(); } else if (f.cur !== f.to) { f.cur = f.to; shadowsDirty(); }
      // a band moves only with its fade; a layer that keeps animating (falling snow) leaves it be
      if (liftAt[i] !== f.cur) {
        liftAt[i] = f.cur;
        layers.forEach(({ bands }) => {
          const g = bands && bands[i];
          if (!g) return;
          g.position.y = (1 - f.cur) * 4.5;
          kit.applyFade(g, Math.max(0, f.cur * 1.25 - 0.25));
        });
      }
      // the shadow pass ignores opacity, so a band casts only while it is fully on
      if (lit && liftCasts[i] !== f.cur > 0.99) {
        liftCasts[i] = f.cur > 0.99;
        shadowsDirty();
        layers.forEach(({ bands }) => {
          const g = bands && bands[i];
          if (g) g.traverse(o => {
            if (!o.isMesh) return;
            if (o.userData.cast === undefined) o.userData.cast = o.castShadow;
            o.castShadow = liftCasts[i] && o.userData.cast;
          });
        });
      }
    });
    layers.forEach(({ L }) => { if (L.update && L.update(dt, k)) { moving = true; if (L.shades) shadowsDirty(); } });
    if (stepAO(dt)) moving = true;
    if (!moving && !dirty) { raf = 0; if (options.onIdle) options.onIdle(); return; }
    dirty = false;
    raf = requestAnimationFrame(frame);
    // past the farthest neighbour at full zoom-out, about 12 degrees across
    if (glow && glow.visible) {
      glow.position.copy(camera.position).addScaledVector(sunDir, camera.far * 0.9);
      glow.scale.setScalar(0.2 * camera.far * 0.9);
    }

    if (overlay.frame(dt)) dirty = true;
    draw();
    if (!drawn) {
      drawn = true;
      if (options.onFirstFrame) options.onFirstFrame();
      if (bakeList) loadBake();
      if (look.start && !studio) loadLook();
    }
  }
  let drawn = false;
  // what the look loads (Foto's textures, house3d/assets/ at this file's ?v=), after the first frame
  // like the bake; a texture that fails leaves the look as Päris draws it
  function loadLook() {
    const vendor = './vendor/three-0.187.0/examples/jsm/';
    import(`${vendor}loaders/KTX2Loader.js`).then(({ KTX2Loader }) => {
      if (disposed) return;
      const loader = new KTX2Loader().setTranscoderPath(new URL(`${vendor}libs/basis/`, import.meta.url).href).detectSupport(renderer);
      return look.start({
        load: f => loader.loadAsync(new URL(`./assets/${f}${QUERY}`, import.meta.url).href),
        done: () => { if (!disposed) { updateSun(); shadowsDirty(); invalidate(); } }
      }).finally(() => loader.dispose());
    }).catch(e => console.warn('house3d: the Foto style stays as Päris draws it', e));
  }
  // the bake and its atlas beside it, after the first frame so they never hold it up
  function loadBake() {
    let url;
    Promise.resolve()
      .then(() => { url = new URL(options.bake, document.baseURI); return fetch(url); })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(bake => new THREE.TextureLoader().loadAsync(new URL(String(bake.atlas), url).href).then(texture => ({ bake, texture })))
      .then(({ bake, texture }) => {
        kit.keep(texture);
        if (disposed) return texture.dispose();
        const r = BAKE.applyBake({ THREE, targets: bakeList, bake, texture, keep: kit.keep });
        if (!r.applied) console.warn(`house3d: bake not applied, ${r.reason}`);
        invalidate();
      })
      .catch(e => console.warn('house3d: bake not applied', e));
  }
  function draw() {
    if (bloomOn()) return getComposer().render();
    renderer.render(scene, camera);
    if (ao && aoLevel > 0 && !renderer.getContext().isContextLost()) drawAO();
  }
  // draws a frame first, since the canvas keeps no drawing buffer between frames
  function snapshot(maxWidth) {
    if (!framed || renderer.getContext().isContextLost()) return null;
    draw();
    const src = renderer.domElement, k = Math.min(1, maxWidth / src.width);
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * k);
    out.height = Math.round(src.height * k);
    const g = out.getContext('2d');
    if (!g) return null;
    try {
      g.drawImage(src, 0, 0, out.width, out.height);
      return out.toDataURL('image/jpeg', 0.8);
    } catch (e) { return null; }
  }

  resize();
  if (Number.isInteger(options.level)) setLevel(options.level, true);
  else setMode(options.mode === 'open' ? 'open' : 'roof', true);
  updateSun();
  // live: the sun moves on once a minute, in every style while there is a place (onSun, ctx.state.sun)
  sunTimer = setInterval(() => { if (!sunTime && sunPlace) updateSun(); }, 60000);
  invalidate();

  function dispose() {
    disposed = true;
    clearInterval(sunTimer);
    if (sun) sun.dispose();
    if (envTarget) envTarget.dispose();
    if (look.dispose) look.dispose();
    if (pmrem) pmrem.dispose();
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
    if (ao) {
      ao.pass.dispose();
      ao.pass.gtaoMaterial.dispose();
      ao.pass.blendMaterial.dispose();
      ao.target.dispose();
      ao.quad.material.dispose();
      ao.quad.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  }

  // carState and carScreen stay getters, so a copy of this object would freeze them
  return {
    setMarkers, setRoomChips: overlay.setRoomChips, focusRoom, setMode, setLevel, setSelection, setLayer, reset, resize, dispose, setSun, setTime, snapshot,
    setCar: s => { if (byId.car) byId.car.api.setCar(s); },
    get mode() { return mode; },
    get level() { return level; },
    get storeys() { return storeyList; },
    get time() { return sunTime ? new Date(sunTime) : new Date(); },
    get sun() { return sunNow; },
    get view() { return { position: camera.position.toArray(), target: controls.target.toArray() }; },
    get carState() { return byId.car ? byId.car.api.carState : 'away'; },
    get carScreen() { return byId.car ? byId.car.api.carScreen : null; },
    get layers() { return layers.filter(e => e.L.toggle && !e.failed && (!e.L.listed || e.L.listed())).map(e => ({ id: e.L.id, on: e.on })); }
  };
}
