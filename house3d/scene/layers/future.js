// The future: things the house does not have yet (model.future, the private layer), drawn in
// place and see-through in one violet tint so none reads as built: rooftop PV, an EV charger, a
// home battery, a greenhouse and a hot tub. The PV panels lie on their roof in the lift, so they
// rise and fade with it; the rest stand on the ground. Nothing here casts a shadow, so the real
// house's light stays as it is. A tap on an item is { feature: id }.
const PANEL = [1.72, 1.13], PANEL_GAP = 0.02; // as scripts/house3d_model.py's PANEL and PANEL_GAP
const PANEL_T = 0.04, PANEL_LIFT = 0.05; // a panel's thickness, its underside this far over the roof
const SIZE = { greenhouse: [3, 4], tub: [2, 2] };
const EAVES = 1.8, RIDGE = 2.4, BAR = 0.05; // the greenhouse
// the hot tub, a wood-fired one: staves widening to the rim, two steel hoops, the water a hand
// under the rim, the stove's chimney at the back and a step at the front
const TUB = { h: 1.05, flare: 0.94, wall: 0.06, floor: 0.12, water: 0.87, hoops: [0.22, 0.85], pipe: 0.06, chimney: 1.0, step: [0.7, 0.42, 0.4] };
const CHARGER = { post: 1.2, w: 0.3, h: 0.45, d: 0.15 };
const BATTERY = [0.6, 1.0, 0.3];
const SIMPLE_FILL = 0.08, SIMPLE_LINE = 0.55, REAL_OPACITY = 0.55, REAL_TINT = 0.45;
const D2R = Math.PI / 180;

/**
 * panelGrid(w, d, panels) -> [{ u, v, long }]: the panels' centres in a w x d rectangle's own
 * frame (u along w, v along d, from its centre), in the orientation that holds more (landscape,
 * the long side along w, on a tie), rows filled from -v and each row centred; long is the size
 * along u.
 */
export function panelGrid(w, d, panels) {
  const n = (size, side) => Math.floor((size + PANEL_GAP) / (side + PANEL_GAP) + 1e-9);
  const land = n(w, PANEL[0]) * n(d, PANEL[1]), port = n(w, PANEL[1]) * n(d, PANEL[0]);
  const [pu, pv] = land >= port ? PANEL : [PANEL[1], PANEL[0]];
  const cols = n(w, pu), rows = Math.min(n(d, pv), Math.ceil(panels / Math.max(1, cols)));
  const out = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, panels - r * cols);
    for (let c = 0; c < inRow; c++) {
      out.push({ u: (c - (inRow - 1) / 2) * (pu + PANEL_GAP), v: (r - (rows - 1) / 2) * (pv + PANEL_GAP), long: pu, short: pv });
    }
  }
  return out;
}

export default function build({ THREE, kit, C, model, style, state, roof }) {
  const items = ((model.future || {}).items || []).filter(it => it && Array.isArray(it.pos));
  if (!items.length) return null;
  const real = style === 'real';
  const group = new THREE.Group(), lift = new THREE.Group();

  // the real style's one material per surface; the simple style's one fill and its line
  const mats = {};
  const fill = real ? null : kit.basic({ color: C.future, opacity: SIMPLE_FILL, side: THREE.DoubleSide });
  function mat(name) {
    if (fill) return fill;
    if (mats[name]) return mats[name];
    const m = kit.surface(name, { transparent: true, opacity: name === 'glass' ? REAL_OPACITY * 0.6 : REAL_OPACITY, depthWrite: false, side: THREE.DoubleSide });
    m.color.lerp(C.future, REAL_TINT);
    return (mats[name] = m);
  }
  const line = real ? null : kit.lineMat({ color: C.future, opacity: SIMPLE_LINE });
  // a mesh of the item, tagged for taps; the simple style outlines it
  const targets = [];
  function add(parent, geo, name, id, inLift) {
    const m = new THREE.Mesh(geo, mat(name));
    m.renderOrder = 5;
    m.userData = { feature: id, lifted: !!inLift };
    if (line) m.add(kit.edges(geo, line, 20));
    parent.add(m);
    targets.push(m);
    return m;
  }
  const box = (w, h, d) => kit.keep(new THREE.BoxGeometry(w, h, d));

  // a house room's floor covers what stands in it: such an item takes taps with the roof off only
  const indoor = new Set();
  const inHouse = ([x, z]) => (model.rooms || []).some(r => r.floor !== 'paving' && r.rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));

  function pv(it) {
    const top = roof.top(it.roof);
    // the roof's rise per metre of x, and the tilt that lays a panel on it
    const rise = top(1) - top(0), tilt = Math.atan(rise);
    const [w, d] = it.size, turned = it.rot === 90 || it.rot === 270;
    const geoL = box(PANEL[0], PANEL_T, PANEL[1]), geoP = box(PANEL[1], PANEL_T, PANEL[0]);
    panelGrid(w, d, it.panels).forEach(p => {
      // the grid's frame turned by rot onto the plan, the long side along u
      const a = -(it.rot || 0) * D2R, ca = Math.cos(a), sa = Math.sin(a);
      const x = it.pos[0] + p.u * ca + p.v * sa, z = it.pos[1] - p.u * sa + p.v * ca;
      const alongX = (p.long === PANEL[0]) !== turned;
      const m = add(lift, alongX ? geoL : geoP, 'frame', it.id, true);
      m.userData.panel = true;
      // the underside's centre PANEL_LIFT over the roof, the panel turned to the roof's slope
      const n = [-Math.sin(tilt), Math.cos(tilt)];
      m.position.set(x + n[0] * (PANEL_T / 2), top(x) + PANEL_LIFT + n[1] * (PANEL_T / 2), z);
      m.rotation.z = tilt;
    });
  }

  function charger(g, it) {
    add(g, box(0.08, CHARGER.post, 0.08), 'frame', it.id).position.set(0, CHARGER.post / 2, 0);
    const unit = add(g, box(CHARGER.w, CHARGER.h, CHARGER.d), 'unit', it.id);
    unit.position.set(0, CHARGER.post - CHARGER.h / 2 + 0.1, -(0.04 + CHARGER.d / 2));
    // the cable coiled on the front
    const coil = add(g, kit.keep(new THREE.TorusGeometry(0.11, 0.015, 6, 20)), 'frame', it.id);
    coil.position.set(0, CHARGER.post - CHARGER.h + 0.05, -(0.04 + CHARGER.d + 0.02));
  }

  function battery(g, it) {
    const [w, h, d] = BATTERY;
    add(g, box(w, h, d), 'unit', it.id).position.set(0, h / 2, 0);
  }

  // a gable profile across x, extruded along z: the glass hull; the frame posts, eaves, ridge and rafters
  function greenhouse(g, it) {
    const [w, d] = it.size || SIZE.greenhouse;
    const prof = [[-w / 2, 0], [w / 2, 0], [w / 2, EAVES], [0, RIDGE], [-w / 2, EAVES]];
    const hull = kit.keep(new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y))), { depth: d, bevelEnabled: false }));
    hull.translate(0, 0, -d / 2);
    add(g, hull, 'glass', it.id);
    if (!real) return;
    for (const z of [-d / 2, 0, d / 2]) for (const x of [-w / 2, w / 2]) add(g, box(BAR, EAVES, BAR), 'frame', it.id).position.set(x, EAVES / 2, z);
    for (const x of [-w / 2, w / 2]) add(g, box(BAR, BAR, d), 'frame', it.id).position.set(x, EAVES, 0);
    add(g, box(BAR, BAR, d), 'frame', it.id).position.set(0, RIDGE, 0);
    const len = Math.hypot(w / 2, RIDGE - EAVES), slope = Math.atan2(RIDGE - EAVES, w / 2);
    for (const z of [-d / 2, d / 2]) for (const s of [-1, 1]) {
      const r = add(g, box(len, BAR, BAR), 'frame', it.id);
      r.position.set((s * w) / 4, (EAVES + RIDGE) / 2, z);
      r.rotation.z = -s * slope;
    }
  }

  function tub(g, it) {
    const r = (it.size || SIZE.tub)[0] / 2, foot = r * TUB.flare, at = y => foot + ((r - foot) * y) / TUB.h;
    // the staves as one turned wall with a rim; 16 sides, so the simple style's outline draws them
    const wall = [[foot, 0], [r, TUB.h], [r - TUB.wall, TUB.h], [foot - TUB.wall, TUB.floor]].map(([x, y]) => new THREE.Vector2(x, y));
    add(g, kit.keep(new THREE.LatheGeometry(wall, 16)), 'timber', it.id);
    TUB.hoops.forEach(y => {
      const hoop = add(g, kit.keep(new THREE.TorusGeometry(at(y) + 0.01, 0.014, 4, 32)), 'frame', it.id);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
    });
    const water = add(g, kit.keep(new THREE.CircleGeometry(at(TUB.water) - TUB.wall, 32)), 'glass', it.id);
    water.rotation.x = -Math.PI / 2;
    water.position.y = TUB.water;
    // the stove sits inside at the back, its pipe standing above the rim
    const back = r - TUB.wall - TUB.pipe - 0.12;
    add(g, kit.keep(new THREE.CylinderGeometry(TUB.pipe, TUB.pipe, TUB.chimney + TUB.h - TUB.water, 12)), 'frame', it.id)
      .position.set(0, (TUB.water + TUB.h + TUB.chimney) / 2, back);
    const [sw, sh, sd] = TUB.step;
    add(g, box(sw, sh, sd), 'timber', it.id).position.set(0, sh / 2, -(foot + sd / 2 + 0.03));
  }

  const KINDS = { charger, battery, greenhouse, tub };
  items.forEach(it => {
    if (it.kind === 'pv') return pv(it);
    if (!KINDS[it.kind]) return;
    const g = new THREE.Group();
    g.position.set(it.pos[0], 0, it.pos[1]);
    // rot turns the item's front from the street side (-z) towards +x
    g.rotation.y = -(it.rot || 0) * D2R;
    KINDS[it.kind](g, it);
    if (inHouse(it.pos)) indoor.add(it.id);
    group.add(g);
  });

  return {
    id: 'future',
    group,
    lift,
    toggle: true,
    // the raycaster ignores visibility: the panels take no tap while the roof is raised and
    // hidden, an item in a house room none while the roof is on
    hit(ray) {
      const open = state.mode === 'open';
      const live = targets.filter(m => (m.userData.lifted ? state.roofFade >= 0.5 : open || !indoor.has(m.userData.feature)));
      const hits = ray.intersectObjects(live, false);
      return hits.length ? { feature: hits[0].object.userData.feature, target: hits[0].object } : null;
    }
  };
}
