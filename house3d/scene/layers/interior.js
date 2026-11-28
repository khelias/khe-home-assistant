// A lit style's interior, drawn as an architectural model, every storey's with its storey's
// contents (ctx.bands: the group for the lowest storey, else the lift band under it): a near-black
// section cap on every wall's flat cut top, oak skirting and a soft shade on the floor along every
// wall face that has a house room of its storey in front of it, and the furniture, on the storey
// ctx.storeyOf gives it, its legs down to that floor, shaped by its kind (scripts/house3d_model.py
// FURNITURE_KINDS; an item without one is a warm grey block; a chair's or sofa's back is on the
// edge it names, else the side nearer a wall), its surfaces through the look, so each keeps its
// role (Foto's detail photographs; Foto also puts a model in a plant's place, its instances then
// scaled to nothing). It reads the building layer's
// inRoom and cutOf through its api, so it builds after it, and builds nothing in the
// simple style or without the building. Caps, skirting and shade are one InstancedMesh each, the
// furniture one per material and storey, so the interior costs a handful of draw calls; every mesh carries
// userData.part, the furniture userData.items (the item index of each instance) and the caps
// userData.walls (the wall index of each, or the id of a chimney cut at the ceiling). A run of fitted units draws its fronts in order from
// the low end of its along axis, in the item's finish (the kitchen's blue-grey under a brown worktop
// without one), a stack of drawers about DRAWER_H a drawer. A splashback and a curtain are each
// one mesh of their own, part 'splashback' or 'curtain'. A stair is a closed flight, a white block
// under each oak tread, about STAIR_RISE a step, climbing to its rect's edge up; a landing a white
// block under an oak top. While a storey's band over its cut is fully on, that storey's cut caps
// are hidden: the lifted wall above sits on them.
const CAP_H = 0.01, CAP_LIFT = 0.002, CAP_INSET = 0.005; // inset from each face and a free end
const SKIRT_H = 0.07, SKIRT_D = 0.012, FLOOR_Y = 0.02;
const PROBE = 0.25, PROBE_OUT = 0.3; // how often and how far out a face is probed for a room
const SHADE_W = 0.3, SHADE_Y = 0.024, SHADE_OPACITY = 0.18, SHADE_PX = 32;
const ROOF_ON = 0.99;
const CYLINDER_SEGMENTS = 16;
// each kind's main surface; a circle item is a cylinder in it, except a table
const MAIN = {
  bed: 'oak', headboard: 'fabric', wardrobe: 'cabinet', sofa: 'sofa', table: 'oak', desk: 'oak',
  counter: 'cabinet', cabinet: 'oak', bath: 'sanitary', bench: 'oak', appliance: 'unit', rug: 'rug',
  toilet: 'sanitary', mirror: 'mirror', washer: 'white', bookcase: 'kitchen', chair: 'shell', office_chair: 'sofa',
  plant: 'leaf', picture: 'canvas', stair: 'oak', landing: 'oak'
};
// an item's finish other than the kitchen's: the surfaces its kitchen and kitchenTop parts and
// its handles take, a 'role:surface' keeping the part's role under another surface (a painted
// worktop is still a worktop to Foto); scripts/house3d_model.py FINISHES lists the same names
const FINISHES = {
  anthracite: { kitchen: 'anthracite', kitchenTop: 'kitchenTop:anthracite', handle: 'steel' },
  white: { kitchen: 'white', kitchenTop: 'kitchenTop:white' },
  dark_oak: { oak: 'darkOak', kitchen: 'darkOak', kitchenTop: 'darkOak' },
  medium_oak: { oak: 'mediumOak', kitchen: 'mediumOak', kitchenTop: 'mediumOak' }
};
// the kinds whose rect edge nearest a wall carries their head (the toilet, drawn from the wall
// out) or their back (the washer, its door facing the room)
const WALL_SIDE = { toilet: 'head', washer: 'back' };
const TOP = 0.04, LEG = 0.05, LEG_IN = 0.03, PANEL = 0.03; // tables and desks
const PILLOW_PER = 0.9, PILLOW_L = 0.38, GROOVE = 0.01, DOOR_W = 0.55;
const SLAT = 0.09, SLAT_GAP = 0.02, SLAT_T = 0.03, SUPPORT = 0.05;
// fitted units: the plinth and its setback, the worktop, the fronts' faces and the height where a
// tall unit's fronts divide
const PLINTH = 0.1, PLINTH_BACK = 0.06, WORKTOP = 0.04, OVERHANG = 0.02, FRONT_T = 0.02, RECESS = 0.008, TALL_SPLIT = 0.9;
const FRONT_GAP = 0.003, STILE = 0.06, DRAWER_STILE = 0.04, DRAWERS = 3, DRAWER_H = 0.25, HANDLE_L = 0.14, HANDLE_H = 0.012, HANDLE_T = 0.014;
const FRONT_D = FRONT_T + HANDLE_T; // from the carcass to the outermost face of a front's handle
const OVEN_H = 0.6, OVEN_STRIP = 0.09, HOOD_T = 0.04;
const PLEAT = 0.12, PLEAT_DEPTH = 0.02, PLEAT_SEGMENTS = 8, PLEAT_SHADE = 0.3; // a curtain's folds, and how much of their slope the light sees
const SEAT_W = 0.8, CUSHION_GAP = 0.012; // a sofa's cushions
// a vanity's top and its basins, whose taps reach the item's y1; a toilet's bowl and flush plate
const BASIN_TOP = 0.08, TAP_H = 0.14, TAP = 0.025, SPOUT = 0.1, BASIN_W = 0.42, BASIN_D = 0.3, BASIN_RIM = 0.05;
const BOWL_H = 0.22, SEAT_T = 0.02, FLUSH_W = 0.22, FLUSH_H = 0.15, FLUSH_T = 0.012;
const MIRROR_EDGE = 0.02, BOOK_T = 0.02, BOOK_STEP = 0.35;
// a chair's seat and back, legs and an office chair's arms
const CHAIR_SEAT = 0.46, CHAIR_SEAT_T = 0.04, CHAIR_LEG = 0.035, CHAIR_BACK = 0.03, CHAIR_BRACE = 0.012, CHAIR_BRACE_Y = 0.25;
const OFFICE_SEAT = 0.5, OFFICE_CUSHION = 0.09, OFFICE_BACK = 0.12, OFFICE_INSET = 0.05, OFFICE_ARM = 0.05, OFFICE_BASE = 0.05;
// a plant's pot as a fraction of its height, a vase's taller; a picture's frame
const POT_H = 0.3, VASE_H = 0.5, PICTURE_FRAME = 0.03;
// a picture's three colour fields, by its art (scripts/house3d_model.py PICTURE_ARTS)
const ART = [['artA', 'artB', 'artC'], ['artD', 'artC', 'artA'], ['artB', 'artD', 'bloom']];
// art 3, after the three palettes: grey-blue brush strokes on a pale grey ground, each stroke
// [from, to] across the canvas, [low, high] up it, and its colour, the later ones over the earlier
const BRUSH_ART = ART.length, STROKE_T = 0.006, STROKE_STEP = 0.0007;
const STROKES = [
  [0, 0.72, 0.62, 1, 'brushB'], [0.3, 1, 0.7, 0.9, 'brushA'], [0, 0.55, 0.38, 0.6, 'brushA'],
  [0.4, 1, 0.3, 0.52, 'brushD'], [0.08, 0.86, 0.12, 0.3, 'brushB'], [0.5, 0.95, 0.05, 0.16, 'brushD'],
  [0.15, 0.6, 0.78, 0.86, 'brushC'], [0.62, 0.9, 0.44, 0.48, 'brushC'], [0.05, 0.38, 0.2, 0.24, 'brushC']
];
// a washer's door and control strip; a stove's cage bars, their spacing and the stones' lumps
const DOOR_R = 0.33, STRIP_H = 0.07, BAR_T = 0.012, BAR_STEP = 0.1, LUMPS = 3;
// a stair's rise per step (scripts/house3d_model.py STAIR_RISE) and its treads' and a landing's oak
const STAIR_RISE = 0.18, TREAD = 0.04;

export default function build({ THREE, kit, model, roof, state, look, layer, storeys: st, bands, levelOf, storeyOf }) {
  if (!look.lit) return null;
  const building = layer('building');
  if (!building || !building.api) return null;
  const { inRoom, cutOf } = building.api;
  const floorOf = s => (st.list[s] ? st.list[s].floor : 0);
  const walls = model.walls || [];
  const group = new THREE.Group(), lift = new THREE.Group();
  const B = bands(group, lift);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // a wall's frame: its group transform in building.js (local +x along the wall, +z is plan (-uz, ux))
  const frames = walls.map(w => {
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(w.a[0], 0, w.a[1]), new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(-uz, ux)), ONE);
    return { w, L, ux, uz, m };
  });
  // a box in wall frame f, centre (x, y, z) and size (sx, sy, sz), turned turn radians about y
  const inWall = (f, x, y, z, sx, sy, sz, turn = 0) => f.m.clone().multiply(new THREE.Matrix4().compose(p.set(x, y, z), q.setFromAxisAngle(Y, turn), sc.set(sx, sy, sz)));

  function instanced(geo, mat, list, part, parent = group) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.part = part;
    parent.add(im);
    return im;
  }
  // a list per storey, in storey order
  const perStorey = () => st.list.map(() => []);

  /* ---------- section caps ---------- */
  // how far a cap runs on past end P of wall f (dir d points away from the wall) over the wall it
  // meets: to that wall's far face, short of it by the inset; 0 where the wall already reaches
  // the far face (an outer corner) or runs on in a straight line, minus the inset at a free end
  function endReach(f, P, d) {
    let reach = -1;
    frames.forEach(g => {
      if (g === f || g.w.finish === 'panel' || levelOf(g.w) !== levelOf(f.w)) return;
      if (Math.abs(f.ux * g.ux + f.uz * g.uz) > 0.9) {
        if ([g.w.a, g.w.b].some(Q => Math.hypot(Q[0] - P[0], Q[1] - P[1]) < 0.01)) reach = Math.max(reach, 0);
        return;
      }
      const n = [-g.uz, g.ux], nd = n[0] * d[0] + n[1] * d[1];
      const off = n[0] * (P[0] - g.w.a[0]) + n[1] * (P[1] - g.w.a[1]);
      if (Math.abs(off) > (g.w.t + f.w.t) / 2 + 0.02) return;
      const along = g.ux * (P[0] - g.w.a[0]) + g.uz * (P[1] - g.w.a[1]);
      if (along < -f.w.t || along > g.L + f.w.t) return;
      // from P along d to g's centreline, then on to its far face
      reach = Math.max(reach, -off / nd + g.w.t / 2 / Math.abs(nd) - CAP_INSET);
    });
    return reach < 0 ? -CAP_INSET : Math.min(reach, 1);
  }
  const capUncut = perStorey(), capCut = perStorey();
  frames.forEach((f, i) => {
    const { w, L, ux, uz } = f;
    if (w.finish === 'panel') return;
    // a wall stands up to the lower of its top and its cut (building.js)
    const cut = cutOf(w), wallTop = roof.topFn(w.top);
    const top = u => (cut ? Math.min(cut, wallTop(w.a[0] + ux * u, w.a[1] + uz * u)) : wallTop(w.a[0] + ux * u, w.a[1] + uz * u));
    if (Math.abs(top(0) - top(L)) >= 0.005) return;
    const y = top(0), lo = -endReach(f, w.a, [-ux, -uz]), hi = L + endReach(f, w.b, [ux, uz]);
    const gaps = (w.openings || []).filter(o => (o.sill || 0) + o.h > y - 0.01).map(o => [o.c - o.w / 2, o.c + o.w / 2]).sort((a, b) => a[0] - b[0]);
    kit.spans(lo, hi, gaps, 0.01).forEach(([a, b]) => (cut ? capCut : capUncut)[levelOf(w)].push([i, inWall(f, (a + b) / 2, y + CAP_LIFT + CAP_H / 2, 0, b - a, CAP_H, w.t - 2 * CAP_INSET)]));
  });
  // a chimney cut at its storey's cut is capped like a cut wall
  (roof.chimneys || []).forEach(c => {
    if (!c.cut) return;
    const [x0, z0, x1, z1] = c.rect;
    capCut[c.level].push([c.id, new THREE.Matrix4().compose(p.set((x0 + x1) / 2, c.cut + CAP_LIFT + CAP_H / 2, (z0 + z1) / 2), q.identity(), sc.set(x1 - x0 - 2 * CAP_INSET, CAP_H, z1 - z0 - 2 * CAP_INSET))]);
  });
  // each storey's caps, the cut walls' last, so hiding them is a shorter count
  const capMat = kit.surface('cut');
  const caps = st.list.map((_, s) => {
    const capList = [...capUncut[s], ...capCut[s]];
    if (!capList.length) return null;
    const im = instanced(unitBox, capMat, capList.map(c => c[1]), 'cap', B.of(s));
    im.userData.walls = capList.map(c => c[0]);
    im.userData.storey = s;
    im.receiveShadow = true;
    return { im, uncut: capUncut[s].length, all: capList.length };
  });

  /* ---------- skirting and floor shade ---------- */
  const skirts = perStorey(), shades = perStorey();
  frames.forEach(f => {
    const { w, L, ux, uz } = f;
    if (w.finish === 'panel') return;
    const s0 = levelOf(w), fy = floorOf(s0);
    const gaps = (w.openings || []).filter(o => o.kind !== 'window' || o.sill < SKIRT_H).map(o => [o.c - o.w / 2, o.c + o.w / 2]).sort((a, b) => a[0] - b[0]);
    const n = Math.max(1, Math.ceil(L / PROBE)), k = w.t / 2 + PROBE_OUT;
    [1, -1].forEach(s => {
      // the face's runs with a house room in front, each probe standing for its stretch
      const runs = [];
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * L) / n, x = w.a[0] + ux * u - uz * k * s, z = w.a[1] + uz * u + ux * k * s;
        if (!inRoom(x, z, s0)) continue;
        const last = runs[runs.length - 1], a = (j * L) / n, b = ((j + 1) * L) / n;
        if (last && Math.abs(last[1] - a) < 1e-9) last[1] = b;
        else runs.push([a, b]);
      }
      runs.flatMap(([lo, hi]) => kit.spans(lo, hi, gaps, 0.02)).forEach(([a, b]) => {
        const c = (a + b) / 2, len = b - a;
        skirts[s0].push(inWall(f, c, fy + FLOOR_Y + SKIRT_H / 2, s * (w.t / 2 + SKIRT_D / 2), len, SKIRT_H, SKIRT_D));
        shades[s0].push(inWall(f, c, fy + SHADE_Y, s * (w.t / 2 + SHADE_W / 2), len, 1, SHADE_W, s > 0 ? 0 : Math.PI));
      });
    });
  });
  const skirtMat = skirts.some(l => l.length) ? look.material('skirting') : null;
  skirts.forEach((list, s) => { if (list.length) instanced(unitBox, skirtMat, list, 'skirting', B.of(s)).receiveShadow = true; });
  if (shades.some(l => l.length)) {
    // dark at the wall (v 1, the plane's local -z, which faces the wall) fading to nothing
    const data = new Uint8Array(SHADE_PX * 4);
    for (let j = 0; j < SHADE_PX; j++) data[j * 4 + 3] = Math.round(255 * ((j + 0.5) / SHADE_PX) ** 2);
    const tex = kit.keep(new THREE.DataTexture(data, 1, SHADE_PX));
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    // the floor is 4 mm below, and zoomed out the depth buffer resolves about a centimetre
    const mat = kit.keep(new THREE.MeshBasicMaterial({
      color: 0x000000, map: tex, transparent: true, opacity: SHADE_OPACITY, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
    }));
    shades.forEach((list, s) => { if (list.length) instanced(plane, mat, list, 'shade', B.of(s)); });
  }

  /* ---------- furniture ---------- */
  // every non-panel wall's two face segments, for which way an item faces
  const faces = frames.filter(f => f.w.finish !== 'panel').flatMap(({ w, ux, uz }) => [1, -1].map(s => {
    const ox = -uz * s * (w.t / 2), oz = ux * s * (w.t / 2);
    return [[w.a[0] + ox, w.a[1] + oz], [w.b[0] + ox, w.b[1] + oz]];
  }));
  const faceDist = ([x, z]) => Math.min(...faces.map(([a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
  }));
  const items = model.furniture || [];
  const mats = new Map();
  const byName = name => {
    const [role, surface = role] = name.split(':');
    return look.material(role, {}, surface);
  };
  const mat = (name, make = () => byName(name)) => mats.get(name) || mats.set(name, make()).get(name);
  // a splashback: a thin slab on its rect, its UVs in metres along the wall and up it
  function splashback(f, i) {
    const [x0, z0, x1, z1] = f.rect, alongX = x1 - x0 >= z1 - z0;
    const m = kit.solid(B.of(storeyOf(f)), mat('splash', () => look.material('splash', { map: kit.splashTiles(), roughness: 0.42 }, 'linen')), f.rect, f.y);
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, alongX ? pos.getX(k) + m.position.x : pos.getZ(k) + m.position.z, pos.getY(k) + m.position.y);
    m.userData = { part: 'splashback', items: [i] };
    m.receiveShadow = true;
  }
  // a curtain: one sheet waved in pleats across the rect's short side, hung along its long side
  function curtain(f, i) {
    const [x0, z0, x1, z1] = f.rect, [y0, y1] = f.y, alongX = x1 - x0 >= z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0, deep = alongX ? z1 - z0 : x1 - x0, amp = Math.min(PLEAT_DEPTH, Math.max(0, deep / 2 - 0.002));
    const pleats = Math.max(1, Math.round(len / PLEAT)), segs = pleats * PLEAT_SEGMENTS;
    const geo = new THREE.PlaneGeometry(len, y1 - y0, segs, 1), pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setZ(k, amp * Math.sin(((pos.getX(k) / len + 0.5) * pleats * 2 * Math.PI)));
    geo.computeVertexNormals();
    // a sheer scatters the light, so its folds shade softly
    const nor = geo.attributes.normal;
    for (let k = 0; k < nor.count; k++) nor.setXYZ(k, nor.getX(k) * PLEAT_SHADE, nor.getY(k) * PLEAT_SHADE, nor.getZ(k));
    geo.normalizeNormals();
    if (!alongX) geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat('sheer'));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.userData = { part: 'curtain', items: [i] };
    B.of(storeyOf(f)).add(m);
  }
  // item f's own frame: s along its long side from the head end, d across from the back side;
  // box() turns a part given in it into a world rect
  function frameOf(f) {
    const [x0, z0, x1, z1] = f.rect;
    let alongX = f.along ? f.along === 'x' : x1 - x0 >= z1 - z0, wallLo = true;
    const side = WALL_SIDE[f.kind];
    if (side) {
      // the edge nearest a wall: x0, x1, z0 or z1; a head on an x edge runs the item along x,
      // a back on one runs it along z
      const mids = [[x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2], [(x0 + x1) / 2, z0], [(x0 + x1) / 2, z1]].map(faceDist);
      const edge = mids.indexOf(Math.min(...mids));
      alongX = (edge < 2) === (side === 'head');
      wallLo = edge % 2 === 0;
    }
    const [l0, l1, c0, c1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    const pt = (l, c) => (alongX ? [l, c] : [c, l]);
    const backLo = faceDist(pt((l0 + l1) / 2, c0)) <= faceDist(pt((l0 + l1) / 2, c1));
    let headLo = true;
    if (side === 'head') headLo = wallLo;
    else if (f.kind === 'bed') {
      // a headboard touching a short end, else the end nearer a wall face, the lower on a tie
      const touches = l => items.some(h => h.kind === 'headboard' && h.rect && (() => {
        const [hl0, hl1, hc0, hc1] = alongX ? [h.rect[0], h.rect[2], h.rect[1], h.rect[3]] : [h.rect[1], h.rect[3], h.rect[0], h.rect[2]];
        return hc0 < c1 && hc1 > c0 && Math.min(Math.abs(hl0 - l), Math.abs(hl1 - l)) < 0.05;
      })());
      const lo = touches(l0), hi = touches(l1);
      headLo = lo !== hi ? lo : faceDist(pt(l0, (c0 + c1) / 2)) <= faceDist(pt(l1, (c0 + c1) / 2)) + 1e-9;
    }
    const box = (s0, s1, d0, d1) => {
      const [la, lb] = headLo ? [l0 + s0, l0 + s1] : [l1 - s1, l1 - s0];
      const [ca, cb] = backLo ? [c0 + d0, c0 + d1] : [c1 - d1, c1 - d0];
      return alongX ? [la, ca, lb, cb] : [ca, la, cb, lb];
    };
    return { L: l1 - l0, D: c1 - c0, box, alongX, frontSign: backLo ? 1 : -1 };
  }

  // the storey of the item being drawn: its parts go with that storey's contents
  let storey = 0;
  const parts = new Map(); // storey and surface name -> [{ i, matrix }]
  const push = (name, i, matrix) => {
    const key = `${storey} ${name}`;
    if (!parts.has(key)) parts.set(key, { storey, name, list: [] });
    parts.get(key).list.push({ i, matrix });
  };
  const add = (name, i, rect, y0, y1) => {
    if (rect[2] - rect[0] < 0.005 || rect[3] - rect[1] < 0.005 || y1 - y0 < 0.002) return;
    push(name, i, new THREE.Matrix4().compose(p.set((rect[0] + rect[2]) / 2, (y0 + y1) / 2, (rect[1] + rect[3]) / 2), q.identity(), sc.set(rect[2] - rect[0], y1 - y0, rect[3] - rect[1])));
  };
  // a slab t thick across the item, its high edge at depth d0 and height y1, its low edge at depth
  // d1 and height y0, kept inside that box
  const leaning = (name, i, { box, alongX, frontSign }, s0, s1, d0, d1, y0, y1, t) => {
    const [x0, z0, x1, z1] = box(s0, s1, d0, d1), run = d1 - d0, rise = y1 - y0, angle = Math.atan2(rise, run);
    // too shallow or too low to lean inside its box: an upright slab
    if (run <= t || rise <= t) return add(name, i, [x0, z0, x1, z1], y0, y1);
    const len = Math.min((run - t * Math.sin(angle)) / Math.cos(angle), (rise - t * Math.cos(angle)) / Math.sin(angle));
    const axis = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), turn = (alongX ? frontSign : -frontSign) * angle;
    push(name, i, new THREE.Matrix4().compose(p.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q.setFromAxisAngle(axis, turn),
      alongX ? sc.set(x1 - x0, t, len) : sc.set(len, t, z1 - z0)));
  };
  const cylinders = new Map(); // storey and surface name -> [{ i, matrix }], on one unit cylinder
  const cylinder = (name, i, x, z, r, y0, y1) => {
    const key = `${storey} ${name}`;
    if (!cylinders.has(key)) cylinders.set(key, { storey, name, list: [] });
    cylinders.get(key).list.push({ i, matrix: new THREE.Matrix4().compose(p.set(x, (y0 + y1) / 2, z), q.identity(), sc.set(r, y1 - y0, r)) });
  };

  // the strip w wide along a rect's edge x0, x1, z0 or z1
  const band = (r, edge, w) => ({ x0: [r[0], r[1], r[0] + w, r[3]], x1: [r[2] - w, r[1], r[2], r[3]], z0: [r[0], r[1], r[2], r[1] + w], z1: [r[0], r[3] - w, r[2], r[3]] }[edge]);
  // a sofa's or chair's back edge without one named: the side nearer a wall
  const backOf = (item, { alongX, frontSign }) => (item.back || [alongX ? (frontSign > 0 ? 'z0' : 'z1') : (frontSign > 0 ? 'x0' : 'x1')]);
  // a rect pulled in by w on each of its named edges
  const shrink = (r, edges, w) => [r[0] + (edges.includes('x0') ? w : 0), r[1] + (edges.includes('z0') ? w : 0), r[2] - (edges.includes('x1') ? w : 0), r[3] - (edges.includes('z1') ? w : 0)];
  const ALL_EDGES = ['x0', 'x1', 'z0', 'z1'];
  // two bars t thick crossing at a rect's centre, end inset in from its edges, centred on height y
  const cross = (world, name, r, end, t, y) => {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    world(name, [r[0] + end, cz - t / 2, r[2] - end, cz + t / 2], y - t / 2, y + t / 2);
    world(name, [cx - t / 2, r[1] + end, cx + t / 2, r[3] - end], y - t / 2, y + t / 2);
  };

  // the shapes, each from its frame: part(name, s0, s1, d0, d1, y0, y1), with L the length, D the
  // depth, y0 and y1 the item's own heights
  const SHAPES = {
    bed({ part, L, D, y0, h }) {
      // a light grey sheet, white pillows at the head, the cover over the rest
      const base = y0 + 0.45 * h, top = y0 + 0.8 * h, m = 0.03;
      part('oak', 0, L, 0, D, y0, base);
      part('interior', m, L - m, m, D - m, base, top);
      part('fabric', 0.42 * L, L - 0.02, 0.02, D - 0.02, base + 0.02, top + 0.01);
      const n = Math.max(1, Math.round(D / PILLOW_PER)), gap = 0.05, w = (D - 2 * m - (n + 1) * gap) / n;
      for (let k = 0; k < n; k++) part('linen', m + 0.04, m + 0.04 + PILLOW_L, m + gap + k * (w + gap), m + gap + k * (w + gap) + w, top, y0 + h);
    },
    headboard({ part, L, D, y0, h }) { part('fabric', 0, L, 0, D, y0, y0 + h); },
    wardrobe({ part, L, D, y0, y1 }) {
      const plinth = 0.08;
      part('worktop', 0, L, 0, D - 0.05, y0, y0 + plinth);
      part('cabinet', 0, L, 0, D - 0.003, y0 + plinth, y1);
      const n = Math.max(1, Math.round(L / DOOR_W));
      for (let k = 1; k < n; k++) part('worktop', (k * L) / n - GROOVE / 2, (k * L) / n + GROOVE / 2, D - 0.006, D, y0 + plinth + 0.02, y1 - 0.02);
    },
    sofa({ world, item, frame, y0, h }) {
      // back and arm name the rect's edges that carry one, so two items can join into a corner
      // sofa; without them the back is on the side nearer a wall and an arm on each end
      const rect = item.rect, short = Math.min(rect[2] - rect[0], rect[3] - rect[1]);
      const backs = backOf(item, frame);
      const arms = item.arm || (frame.alongX ? ['x0', 'x1'] : ['z0', 'z1']);
      const armW = Math.min(0.22, short / 4), backW = Math.min(0.14, short / 3), cushion = Math.min(0.14, short / 4), foot = 0.04, inset = 0.03;
      const under = y0 + 0.12 * h, base = y0 + 0.34 * h, seat = y0 + 0.55 * h, armTop = y0 + 0.72 * h, top = y0 + h;
      // cushions side by side along the rect's longer side, a small gap between them
      const cushions = (r, a, b) => {
        const onX = r[2] - r[0] >= r[3] - r[1], lo = onX ? r[0] : r[1], len = (onX ? r[2] : r[3]) - lo, n = Math.max(1, Math.round(len / SEAT_W));
        for (let k = 0; k < n; k++) {
          const c0 = lo + (k * len) / n + CUSHION_GAP / 2, c1 = lo + ((k + 1) * len) / n - CUSHION_GAP / 2;
          world('sofa', onX ? [c0, r[1], c1, r[3]] : [r[0], c0, r[2], c1], a, b);
        }
      };
      [[rect[0] + inset, rect[1] + inset], [rect[2] - inset - foot, rect[1] + inset], [rect[0] + inset, rect[3] - inset - foot], [rect[2] - inset - foot, rect[3] - inset - foot]]
        .forEach(([x, z]) => world('handle', [x, z, x + foot, z + foot], y0, under));
      world('sofa', rect, under, base);
      backs.forEach(e => world('sofa', band(rect, e, backW), base, y0 + 0.86 * h));
      arms.forEach(e => world('sofa', band(rect, e, armW), base, armTop));
      const inner = shrink(shrink(rect, arms, armW), backs, backW), seats = shrink(inner, backs, cushion);
      cushions(seats, base, seat);
      // the back cushions along z take the corner, those along x stop at them
      backs.forEach(e => cushions(band(e[0] === 'z' ? inner : [inner[0], seats[1], inner[2], seats[3]], e, cushion), base, top));
    },
    chair({ world, item, frame, y0, y1 }) {
      // a moulded plastic shell, its seat and a back along the back edge up to y1, on four wooden
      // legs braced by a steel cross
      const r = item.rect, back = backOf(item, frame)[0], seat = y0 + CHAIR_SEAT, l = CHAIR_LEG;
      [[r[0], r[1]], [r[2] - l, r[1]], [r[0], r[3] - l], [r[2] - l, r[3] - l]].forEach(([x, z]) => world('oak', [x, z, x + l, z + l], y0, seat - CHAIR_SEAT_T));
      cross(world, 'steel', r, l, CHAIR_BRACE, y0 + CHAIR_BRACE_Y);
      world('shell', r, seat - CHAIR_SEAT_T, seat);
      world('shell', band(r, back, CHAIR_BACK), seat, y1);
    },
    office_chair({ world, item, frame, y0, y1 }) {
      // a cross of a base, a steel column, a cushion, a tall back and two arms
      const r = item.rect, back = backOf(item, frame)[0], seat = y0 + OFFICE_SEAT;
      const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, b = OFFICE_BASE / 4;
      cross(world, 'handle', r, 0, OFFICE_BASE, y0 + OFFICE_BASE / 2);
      world('steel', [cx - b, cz - b, cx + b, cz + b], y0 + OFFICE_BASE, seat - OFFICE_CUSHION);
      const top = shrink(r, ALL_EDGES, OFFICE_INSET);
      world('sofa', top, seat - OFFICE_CUSHION, seat);
      world('sofa', band(top, back, OFFICE_BACK), seat, y1);
      const sides = back[0] === 'z' ? ['x0', 'x1'] : ['z0', 'z1'];
      sides.forEach(e => world('handle', band(top, e, OFFICE_ARM), seat + 0.18, seat + 0.22));
    },
    plant({ cyl, item, y0, y1 }) {
      // a pot, a short stem and a rounded crown of three offset cylinders; with bloom a taller
      // vase, a smaller crown and flower heads above it
      const [x0, z0, x1, z1] = item.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.min(x1 - x0, z1 - z0) / 2, h = y1 - y0;
      const at = f => y0 + f * h, pot = at(item.bloom ? VASE_H : POT_H);
      cyl('pot', cx, cz, (item.bloom ? 0.4 : 0.62) * R, y0, pot);
      if (item.bloom) {
        cyl('leaf', cx, cz, 0.6 * R, pot, at(0.78));
        [[0.3, 0], [-0.2, 0.25], [-0.15, -0.3]].forEach(([dx, dz]) => cyl('bloom', cx + dx * R, cz + dz * R, 0.3 * R, at(0.72), y1));
        return;
      }
      cyl('trunk', cx, cz, Math.min(0.02, 0.08 * R), pot, at(0.5));
      cyl('leaf', cx, cz, 0.85 * R, at(0.42), at(0.74));
      cyl('leaf', cx + 0.15 * R, cz - 0.1 * R, 0.7 * R, at(0.62), at(0.9));
      cyl('leaf', cx - 0.15 * R, cz + 0.12 * R, 0.55 * R, at(0.82), y1);
    },
    picture({ part, item, L, D, y0, y1 }) {
      // a black frame round a canvas with three colour fields, a ground, a sky and a sun, each in
      // a layer of its own a little prouder than the last, so none fight for the same plane
      const h = y1 - y0, f = Math.min(PICTURE_FRAME, L / 6, h / 6);
      const inner = h - 2 * f, s = Math.min(L, h) * 0.18, d = k => D * (0.4 + 0.2 * k);
      part('handle', 0, L, 0, d(0), y0, y1);
      if (item.art === BRUSH_ART) {
        // each stroke a slab off the ground, the later ones a hair prouder, so no two faces share a plane
        const w = L - 2 * f, front = k => Math.min(D, d(1) + STROKE_T + STROKE_STEP * k);
        part('brushGround', f, L - f, d(0), d(1), y0 + f, y1 - f);
        STROKES.forEach(([s0, s1, lo, hi, colour], k) => part(colour, f + s0 * w, f + s1 * w, d(1), front(k), y0 + f + lo * inner, y0 + f + hi * inner));
        return;
      }
      const [a, b, c] = ART[item.art || 0];
      part('canvas', f, L - f, d(0), d(1), y0 + f, y1 - f);
      part(a, f, L - f, d(1), d(2), y0 + f, y0 + f + 0.4 * inner);
      part(b, f, L - f, d(1), d(2), y0 + f + 0.55 * inner, y1 - f);
      part(c, 0.62 * L, 0.62 * L + s, d(2), D, y1 - f - 0.12 * h - s, y1 - f - 0.12 * h);
    },
    table(o) { legs(o, false); },
    desk(o) { legs(o, true); },
    counter({ part, L, D, y0, y1 }) {
      const kick = 0.1;
      part('worktop', 0, L, 0, D - 0.07, y0, y0 + kick);
      part('cabinet', 0, L, 0, D - 0.02, y0 + kick, y1 - TOP);
      part('worktop', 0, L, 0, D, y1 - TOP, y1);
    },
    cabinet({ part, L, D, y0, y1 }) {
      const plinth = 0.05;
      part('worktop', 0, L, 0, D - 0.04, y0, y0 + plinth);
      part('oak', 0, L, 0, D, y0 + plinth, y1);
    },
    bath({ part, L, D, y0, y1 }) {
      const rim = 0.08, low = 0.04;
      part('sanitary', 0, L, 0, D, y0, y1 - low);
      ring(part, 'sanitary', 0, L, 0, D, rim, y1 - low, y1);
      part('interior', rim, L - rim, rim, D - rim, y1 - low, y1 - low + 0.005);
    },
    bench({ part, L, D, y0, y1 }) {
      const n = Math.max(1, Math.floor((D + SLAT_GAP) / (SLAT + SLAT_GAP))), off = (D - (n * SLAT + (n - 1) * SLAT_GAP)) / 2;
      for (let k = 0; k < n; k++) part('oak', 0, L, off + k * (SLAT + SLAT_GAP), off + k * (SLAT + SLAT_GAP) + SLAT, y1 - SLAT_T, y1);
      part('oak', 0, SUPPORT, 0, D, y0, y1 - SLAT_T);
      part('oak', L - SUPPORT, L, 0, D, y0, y1 - SLAT_T);
    },
    appliance({ part, L, D, y0, y1 }) { part('unit', 0, L, 0, D, y0, y1); },
    base_units(o) {
      const { part, L, D, y0, y1 } = o, top = y1 - WORKTOP, face = D - OVERHANG;
      part('kitchen', 0, L, 0, face - PLINTH_BACK, y0, y0 + PLINTH);
      part('kitchen', 0, L, 0, face - FRONT_D, y0 + PLINTH, top);
      part('kitchenTop', 0, L, 0, D, top, y1);
      frontsOf(o, (type, a, b) => front(part, type, a, b, face, y0 + PLINTH, top, 'top'));
    },
    wall_units(o) {
      const { part, L, D, y0, y1 } = o;
      part('kitchen', 0, L, 0, D - FRONT_D, y0, y1);
      frontsOf(o, (type, a, b) => front(part, type, a, b, D, y0, y1, 'bottom'));
    },
    tall_units(o) {
      const { part, L, D, y0, y1 } = o, split = Math.min(y1, y0 + TALL_SPLIT);
      part('kitchen', 0, L, 0, D - PLINTH_BACK, y0, y0 + PLINTH);
      part('kitchen', 0, L, 0, D - FRONT_D, y0 + PLINTH, y1);
      frontsOf(o, (type, a, b) => {
        // doors divide at the split; an oven or a stack of drawers is one front
        if (type !== 'door' && type !== 'glass') return front(part, type, a, b, D, y0 + PLINTH, y1, 'top');
        front(part, type, a, b, D, y0 + PLINTH, split, 'top');
        if (y1 > split) front(part, type, a, b, D, split, y1, 'bottom');
      });
    },
    vanity(o) {
      // hung on the wall: the carcass and fronts with no plinth, a porcelain top with its basins
      // sunk in it, evenly along, and a tap behind each
      const { part, item, L, D, y0, y1 } = o, face = D - OVERHANG, n = item.basins;
      const sink = y1 - Math.min(TAP_H, (y1 - y0) / 3), top = sink - Math.min(BASIN_TOP, (sink - y0) / 3);
      part('kitchen', 0, L, 0, face - FRONT_D, y0, top);
      frontsOf(o, (type, a, b) => front(part, type, a, b, face, y0, top, 'top'));
      // a basin keeps a rim round it, however small the vanity, and stays over the carcass
      const bw = Math.min(BASIN_W, Math.max(L / n - 2 * BASIN_RIM, 0.6 * L / n));
      const bd = Math.min(BASIN_D, Math.max(D - 3 * BASIN_RIM, 0.5 * D));
      const d0 = Math.min(Math.max(2 * BASIN_RIM, (D - bd) / 2 + BASIN_RIM / 2), D / 4), d1 = Math.min(d0 + bd, face - FRONT_D);
      // the top around the basins: strips behind and in front of them, and the rims between
      part('sanitary', 0, L, 0, d0, top, sink);
      part('sanitary', 0, L, d1, D, top, sink);
      let at = 0;
      for (let k = 0; k < n; k++) {
        const c = ((k + 0.5) * L) / n, s0 = c - bw / 2, s1 = c + bw / 2;
        part('sanitary', at, s0, d0, d1, top, sink);
        at = s1;
        // the bowl's floor on the carcass top, and its drain
        part('sanitary', s0, s1, d0, d1, top, top + 0.004);
        part('steel', c - 0.02, c + 0.02, (d0 + d1) / 2 - 0.02, (d0 + d1) / 2 + 0.02, top + 0.004, top + 0.007);
        // the tap: a post on the top behind the basin and a spout reaching over it
        const tb = Math.max(0, d0 - BASIN_RIM - TAP / 2);
        part('steel', c - TAP / 2, c + TAP / 2, tb, tb + TAP, sink, y1);
        part('steel', c - TAP / 2, c + TAP / 2, tb + TAP, Math.min(d1, tb + TAP + SPOUT), y1 - TAP, y1);
      }
      part('sanitary', at, L, d0, d1, top, sink);
    },
    toilet({ part, L, D, y0, y1 }) {
      // hung on the wall: a bowl tapering from the wall to its front, a seat ring and, higher up
      // the wall, the flush plate; s runs from the wall
      const bowl = Math.min(y1, y0 + BOWL_H), seat = bowl - SEAT_T, back = Math.min(0.16, L / 3);
      part('sanitary', 0, back, 0, D, y0, seat);
      part('sanitary', back, L - 0.06, 0.05 * D, 0.95 * D, y0 + 0.04, seat);
      part('sanitary', L - 0.06, L - 0.01, 0.2 * D, 0.8 * D, y0 + 0.08, seat);
      // the seat: a ring round the opening, the bowl's inside a little below it
      const r = Math.min(0.06, D / 5), s0 = Math.max(0, back - 0.04), s1 = L;
      ring(part, 'sanitary', s0, s1, 0, D, r, seat, bowl);
      part('interior', s0 + r, s1 - r, r, D - r, seat - 0.03, seat - 0.026);
      if (y1 - bowl > FLUSH_H + 0.1) {
        const w = Math.min(FLUSH_W, D * 0.8);
        part('sanitary', 0, FLUSH_T, (D - w) / 2, (D + w) / 2, y1 - FLUSH_H, y1);
        part('steel', FLUSH_T, FLUSH_T + 0.004, D / 2 - w / 4, D / 2 + w / 4, y1 - FLUSH_H * 0.7, y1 - FLUSH_H * 0.3);
      }
    },
    mirror({ part, L, D, y0, y1 }) {
      // the glass in a lit edge, flush with it
      const e = Math.min(MIRROR_EDGE, L / 4, (y1 - y0) / 4);
      part('mirror', e, L - e, 0, D, y0 + e, y1 - e);
      part('sanitary', 0, L, 0, D, y0, y0 + e);
      part('sanitary', 0, L, 0, D, y1 - e, y1);
      part('sanitary', 0, e, 0, D, y0 + e, y1 - e);
      part('sanitary', L - e, L, 0, D, y0 + e, y1 - e);
    },
    washer({ part, L, D, y0, y1 }) {
      // a white box, the control strip along its top front and a dark round door below it, the
      // door's round drawn as two crossed slabs inside a steel ring
      const h = y1 - y0, face = D - 0.01, r = DOOR_R * Math.min(L, h), cy = y0 + 0.45 * h, c = L / 2;
      part('white', 0, L, 0, face, y0, y1);
      part('handle', 0.04, L - 0.04, face, D, y1 - STRIP_H - 0.02, y1 - 0.02);
      part('steel', c - r, c + r, face, D - 0.004, cy - 0.7 * r, cy + 0.7 * r);
      part('steel', c - 0.7 * r, c + 0.7 * r, face, D - 0.004, cy - r, cy + r);
      part('blackGlass', c - 0.85 * r, c + 0.85 * r, face, D, cy - 0.55 * r, cy + 0.55 * r);
      part('blackGlass', c - 0.55 * r, c + 0.55 * r, face, D, cy - 0.85 * r, cy + 0.85 * r);
    },
    stove({ part, L, D, y0, y1 }) {
      // a dark steel cage on a base, filled with stones heaped a little at the top
      const base = y0 + Math.min(0.12, (y1 - y0) / 5), heap = Math.max(base, y1 - 0.06), t = BAR_T;
      part('handle', 0, L, 0, D, y0, base);
      part('stones', t, L - t, t, D - t, base, heap);
      for (let a = 0; a < LUMPS; a++) for (let b = 0; b < LUMPS; b++) {
        const s0 = t + (a * (L - 2 * t)) / LUMPS, d0 = t + (b * (D - 2 * t)) / LUMPS;
        const rise = 0.02 + 0.04 * (((a * 7 + b * 3) % 5) / 4);
        part('stones', s0 + 0.01, s0 + (L - 2 * t) / LUMPS - 0.01, d0 + 0.01, d0 + (D - 2 * t) / LUMPS - 0.01, heap, Math.min(y1, heap + rise));
      }
      // upright bars round all four sides, about BAR_STEP apart, the corners' bars on the s sides
      const bars = len => {
        const n = Math.max(1, Math.round((len - t) / BAR_STEP));
        return Array.from({ length: n + 1 }, (_, k) => (k * (len - t)) / n);
      };
      bars(L).forEach(s => {
        part('handle', s, s + t, 0, t, base, y1);
        part('handle', s, s + t, D - t, D, base, y1);
      });
      bars(D).slice(1, -1).forEach(d => {
        part('handle', 0, t, d, d + t, base, y1);
        part('handle', L - t, L, d, d + t, base, y1);
      });
    },
    bookcase({ part, L, D, y0, y1 }) {
      // open shelves: a back, two sides and a shelf every BOOK_STEP from the bottom board to the top
      const t = Math.min(BOOK_T, L / 6);
      part('kitchen', 0, L, 0, t, y0, y1);
      part('kitchen', 0, t, t, D, y0, y1);
      part('kitchen', L - t, L, t, D, y0, y1);
      const n = Math.max(1, Math.round((y1 - y0 - t) / BOOK_STEP));
      for (let k = 0; k <= n; k++) {
        const y = y0 + (k * (y1 - y0 - t)) / n;
        part('kitchen', t, L - t, t, D, y, y + t);
      }
    },
    hood({ part, lean, L, D, y0, y1 }) {
      // the glass leans out from the wall as it falls, its low edge at the front
      const slab = y0 + Math.min(0.42, 0.5 * (y1 - y0)), chimney = Math.min(0.28, L / 2), deep = Math.min(0.26, D);
      lean('blackGlass', 0, L, deep, D, y0, slab, HOOD_T);
      part('steel', (L - chimney) / 2, (L + chimney) / 2, 0, deep, y0 + 0.5 * (slab - y0), y1);
    },
    shelf({ part, L, D, y0, y1 }) {
      const board = Math.min(0.04, y1 - y0), bracket = 0.02, inset = Math.min(0.12, L / 5);
      part('oak', 0, L, 0, D, y1 - board, y1);
      [inset, L - inset - bracket].forEach(s => part('handle', s, s + bracket, 0, D * 0.75, y0, y1 - board));
    },
    tv({ part, L, D, y0, y1 }) {
      const foot = Math.min(0.05, (y1 - y0) / 6), panel = Math.min(0.05, D / 2), at = (D - panel) / 2;
      part('handle', L * 0.3, L * 0.7, 0, D, y0, y0 + 0.012);
      part('handle', L * 0.46, L * 0.54, at, at + panel, y0 + 0.012, y0 + foot);
      part('blackGlass', 0, L, at, at + panel * 0.7, y0 + foot, y1);
      part('screen', 0.008, L - 0.008, at + panel * 0.7, at + panel, y0 + foot + 0.008, y1 - 0.008);
    },
    rug({ part, L, D, y0, y1 }) {
      const edge = Math.min(0.03, Math.min(L, D) / 4);
      part('rug', 0, L, 0, D, y0, y0 + 0.6 * (y1 - y0));
      part('rug', edge, L - edge, edge, D - edge, y0, y1);
    },
    stair({ world, item, y0, y1, floor }) {
      // n steps from y0 to y1 along the rect towards its edge up, each a white block from the
      // floor under an oak tread
      const [x0, z0, x1, z1] = item.rect, alongX = item.up[0] === 'x', rising = item.up[1] === '1';
      const lo = alongX ? x0 : z0, hi = alongX ? x1 : z1, n = Math.max(1, Math.round((y1 - y0) / STAIR_RISE));
      const run = (hi - lo) / n, rise = (y1 - y0) / n;
      for (let k = 0; k < n; k++) {
        const a = rising ? lo + k * run : hi - (k + 1) * run, top = y0 + (k + 1) * rise;
        const r = alongX ? [a, z0, a + run, z1] : [x0, a, x1, a + run];
        world('white', r, floor, top - TREAD);
        world('oak', r, top - TREAD, top);
      }
    },
    landing({ world, item, y1, floor }) {
      world('white', item.rect, floor, y1 - TREAD);
      world('oak', item.rect, y1 - TREAD, y1);
    }
  };
  // calls draw(type, s0, s1) for each front, from the run's low end, scaled to fill its length
  function frontsOf({ item, L }, draw) {
    const total = item.fronts.reduce((a, [, w]) => a + w, 0);
    let at = 0;
    item.fronts.forEach(([type, w]) => {
      const len = (w * L) / total;
      draw(type, at + FRONT_GAP / 2, at + len - FRONT_GAP / 2);
      at += len;
    });
  }
  // a framed leaf between s0 and s1, y0 and y1, its face at depth d: a raised frame round a
  // recessed panel, the panel given by inner(s0, s1, y0, y1) or a plain recess
  function leaf(part, s0, s1, y0, y1, d, stile, inner) {
    const st = Math.min(stile, (s1 - s0) / 3, (y1 - y0) / 3);
    part('kitchen', s0, s0 + st, d - FRONT_T, d, y0, y1);
    part('kitchen', s1 - st, s1, d - FRONT_T, d, y0, y1);
    part('kitchen', s0 + st, s1 - st, d - FRONT_T, d, y0, y0 + st);
    part('kitchen', s0 + st, s1 - st, d - FRONT_T, d, y1 - st, y1);
    if (inner) inner(s0 + st, s1 - st, y0 + st, y1 - st);
    else part('kitchen', s0 + st, s1 - st, d - FRONT_T, d - RECESS, y0 + st, y1 - st);
  }
  // a flat frame w wide round the opening inside s0..s1, d0..d1, from y0 to y1
  function ring(part, name, s0, s1, d0, d1, w, y0, y1) {
    part(name, s0, s1, d0, d0 + w, y0, y1);
    part(name, s0, s1, d1 - w, d1, y0, y1);
    part(name, s0, s0 + w, d0 + w, d1 - w, y0, y1);
    part(name, s1 - w, s1, d0 + w, d1 - w, y0, y1);
  }
  // a handle across the leaf's middle, level with y, standing proud of face d
  const handleAt = (part, s0, s1, y, d, name = 'handle', len = HANDLE_L) => {
    const l = Math.min(len, (s1 - s0) * 0.8), c = (s0 + s1) / 2;
    part(name, c - l / 2, c + l / 2, d, d + HANDLE_T, y - HANDLE_H / 2, y + HANDLE_H / 2);
  };
  // one front of a run, its handles reaching depth d: where says on which edge of a door the
  // handle sits
  function front(part, type, s0, s1, d, y0, y1, where) {
    const h = y1 - y0, a = y0 + FRONT_GAP / 2, b = y1 - FRONT_GAP / 2, proud = d - HANDLE_T;
    if (type === 'blank') return part('kitchen', s0, s1, proud - FRONT_T, proud, a, b);
    if (type === 'drawers') {
      // a stack of up to DRAWERS, each about DRAWER_H high
      const n = Math.max(1, Math.min(DRAWERS, Math.round(h / DRAWER_H)));
      for (let k = 0; k < n; k++) {
        const lo = a + (k * (b - a)) / n + FRONT_GAP / 2, hi = a + ((k + 1) * (b - a)) / n - FRONT_GAP / 2;
        leaf(part, s0, s1, lo, hi, proud, DRAWER_STILE);
        handleAt(part, s0, s1, hi - Math.min(0.05, (hi - lo) / 3), proud);
      }
      return;
    }
    if (type === 'oven') {
      const top = Math.max(a, b - Math.min(OVEN_H, h)), strip = Math.min(OVEN_STRIP, (b - top) / 4);
      if (top - a > 0.04) {
        leaf(part, s0, s1, a, top - FRONT_GAP, proud, DRAWER_STILE);
        handleAt(part, s0, s1, top - FRONT_GAP - 0.04, proud);
      }
      part('blackGlass', s0, s1, proud - FRONT_T, proud, top, b - strip);
      part('steel', s0, s1, proud - FRONT_T, proud, b - strip, b);
      handleAt(part, s0, s1, b - strip - 0.05, proud, 'steel', s1 - s0);
      return;
    }
    const y = where === 'top' ? b - 0.06 : a + 0.06;
    if (type === 'glass') {
      leaf(part, s0, s1, a, b, proud, STILE, (p0, p1, q0, q1) => {
        part('linen', p0, p1, proud - FRONT_T, proud - FRONT_T + 0.004, q0, q1);
        part('glass', p0, p1, proud - 0.012, proud - 0.006, q0, q1);
      });
    } else leaf(part, s0, s1, a, b, proud, STILE);
    handleAt(part, s0, s1, y, proud);
  }
  // a table's or desk's top: the item's own slab when it floats over its floor, else TOP at y1
  const underTop = (y0, y1, floor) => (y0 > floor ? y0 : y1 - TOP);
  // a table's or desk's top on four legs or, for a desk, two side panels down to its floor
  function legs({ part, L, D, y0, y1, floor }, panels) {
    const under = underTop(y0, y1, floor);
    part('oak', 0, L, 0, D, under, y1);
    if (panels) {
      part('oak', LEG_IN, LEG_IN + PANEL, LEG_IN, D - LEG_IN, floor, under);
      part('oak', L - LEG_IN - PANEL, L - LEG_IN, LEG_IN, D - LEG_IN, floor, under);
      return;
    }
    [[LEG_IN, LEG_IN + LEG], [L - LEG_IN - LEG, L - LEG_IN]].forEach(([s0, s1]) =>
      [[LEG_IN, LEG_IN + LEG], [D - LEG_IN - LEG, D - LEG_IN]].forEach(([d0, d1]) => part('oak', s0, s1, d0, d1, floor, under)));
  }

  items.forEach((f, i) => {
    const [y0, y1] = f.y, shape = f.kind && SHAPES[f.kind];
    storey = storeyOf(f);
    const floor = floorOf(storey);
    // a finish recolours the kitchen's surfaces the shapes draw in
    const surf = name => (FINISHES[f.finish] || {})[name] || name;
    if (f.circle) {
      const [x, z, r] = f.circle;
      if (f.kind !== 'table') return cylinder(surf(MAIN[f.kind] || 'furniture'), i, x, z, r, y0, y1);
      const under = underTop(y0, y1, floor);
      cylinder(surf('oak'), i, x, z, r, under, y1);
      cylinder(surf('oak'), i, x, z, Math.min(0.06, r / 3), floor, under);
      return;
    }
    if (f.kind === 'splashback') return splashback(f, i);
    if (f.kind === 'curtain') return curtain(f, i);
    if (!shape) return add('furniture', i, f.rect, y0, y1);
    const fr = frameOf(f), { L, D, box } = fr;
    shape({
      part: (name, s0, s1, d0, d1, a, b) => add(surf(name), i, box(s0, s1, d0, d1), a, b),
      world: (name, rect, a, b) => add(surf(name), i, rect, a, b),
      cyl: (name, x, z, r, a, b) => cylinder(surf(name), i, x, z, r, a, b),
      lean: (name, s0, s1, d0, d1, a, b, t) => leaning(surf(name), i, fr, s0, s1, d0, d1, a, b, t),
      L, D, y0, y1, h: y1 - y0, floor, item: f, frame: fr
    });
  });

  parts.forEach(({ storey: s, name, list }) => {
    const im = instanced(unitBox, mat(name), list.map(x => x.matrix), 'furniture', B.of(s));
    im.userData.items = list.map(x => x.i);
    im.castShadow = im.receiveShadow = true;
  });
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS);
  cylinders.forEach(({ storey: s, name, list }) => {
    const im = instanced(unitCylinder, mat(name), list.map(x => x.matrix), 'furniture', B.of(s));
    im.userData.items = list.map(x => x.i);
    im.castShadow = im.receiveShadow = true;
  });

  // Foto puts a model in a plant's place, fitted to its box, and hides the plant's instances
  // once it has one (look.model)
  if (look.model) items.forEach((f, i) => {
    if (f.kind !== 'plant') return;
    const [cx, cz, r] = f.circle || [], [x0, z0, x1, z1] = f.circle ? [cx - r, cz - r, cx + r, cz + r] : f.rect;
    const band = B.of(storeyOf(f)), [y0, y1] = f.y;
    look.model(f.bloom ? 'plant-bloom' : 'plant', {
      group: band, at: [(x0 + x1) / 2, y0, (z0 + z1) / 2], fit: [x1 - x0, y1 - y0, z1 - z0],
      hide: () => band.children.forEach(im => {
        if (!im.isInstancedMesh || !im.userData.items || !im.userData.items.includes(i)) return;
        im.userData.items.forEach((k, n) => { if (k === i) im.setMatrixAt(n, ZERO); });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
      })
    });
  });

  // a storey's cut walls' caps hide under its lifted walls while the band over its cut is fully on;
  // they cast no shadow, so this layer has no shades
  function update() {
    caps.forEach((c, s) => { if (c) c.im.count = state.bandFade(s) > ROOF_ON ? c.uncut : c.all; });
    return false;
  }
  update();
  B.separate();
  return st.list.length > 1 ? { id: 'interior', group, lifts: B.lifts.map((l, i) => (i < B.lifts.length - 1 ? l : null)), update } : { id: 'interior', group, update };
}
