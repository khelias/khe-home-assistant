// The real style's interior, drawn as an architectural model: a near-black section cap on every
// wall's flat cut top, oak skirting and a soft shade on the floor along every wall face that
// has a house room in front of it, and the furniture shaped by its kind (scripts/house3d_model.py
// FURNITURE_KINDS; an item without one is a warm grey block). It reads the building layer's
// inRoom and cutOf through its api, so it builds after it, and builds nothing in the
// simple style or without the building. Caps, skirting and shade are one InstancedMesh each, the
// furniture one per material, so the interior costs a handful of draw calls; every mesh carries
// userData.part, the furniture userData.items (the item index of each instance) and the caps
// userData.walls (the wall index of each). A run of fitted units draws its fronts in order from
// the low end of its along axis. A splashback and a curtain are each one mesh of their own, part
// 'splashback' or 'curtain'. With the roof fully on, the cut walls' caps are
// hidden: the lifted wall above sits on them.
const CAP_H = 0.01, CAP_LIFT = 0.002, CAP_INSET = 0.005; // inset from each face and a free end
const SKIRT_H = 0.07, SKIRT_D = 0.012, FLOOR_Y = 0.02;
const PROBE = 0.25, PROBE_OUT = 0.3; // how often and how far out a face is probed for a room
const SHADE_W = 0.3, SHADE_Y = 0.024, SHADE_OPACITY = 0.18, SHADE_PX = 32;
const ROOF_ON = 0.99;
// each kind's main surface; a circle item is a cylinder in it, except a table
const MAIN = {
  bed: 'oak', headboard: 'fabric', wardrobe: 'cabinet', sofa: 'sofa', table: 'oak', desk: 'oak',
  counter: 'cabinet', cabinet: 'oak', bath: 'cabinet', bench: 'oak', appliance: 'unit', rug: 'rug'
};
const TOP = 0.04, LEG = 0.05, LEG_IN = 0.03, PANEL = 0.03; // tables and desks
const PILLOW_PER = 0.9, PILLOW_L = 0.38, GROOVE = 0.01, DOOR_W = 0.55;
const SLAT = 0.09, SLAT_GAP = 0.02, SLAT_T = 0.03, SUPPORT = 0.05;
// fitted units: the plinth and its setback, the worktop, the fronts' faces and the height where a
// tall unit's fronts divide
const PLINTH = 0.1, PLINTH_BACK = 0.06, WORKTOP = 0.04, OVERHANG = 0.02, FRONT_T = 0.02, RECESS = 0.008, TALL_SPLIT = 0.9;
const FRONT_GAP = 0.003, STILE = 0.06, DRAWER_STILE = 0.04, DRAWERS = 3, HANDLE_L = 0.14, HANDLE_H = 0.012, HANDLE_T = 0.014;
const FRONT_D = FRONT_T + HANDLE_T; // from the carcass to the outermost face of a front's handle
const OVEN_H = 0.6, OVEN_STRIP = 0.09, HOOD_T = 0.04;
const PLEAT = 0.12, PLEAT_DEPTH = 0.02, PLEAT_SEGMENTS = 8, PLEAT_SHADE = 0.3; // a curtain's folds, and how much of their slope the light sees
const SEAT_W = 0.8, CUSHION_GAP = 0.012; // a sofa's cushions

export default function build({ THREE, kit, model, roof, state, style, layer }) {
  if (style !== 'real') return null;
  const building = layer('building');
  if (!building || !building.api) return null;
  const { inRoom, cutOf } = building.api;
  const walls = model.walls || [];
  const group = new THREE.Group();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();

  // a wall's frame: its group transform in building.js (local +x along the wall, +z is plan (-uz, ux))
  const frames = walls.map(w => {
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(w.a[0], 0, w.a[1]), new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(-uz, ux)), ONE);
    return { w, L, ux, uz, m };
  });
  // a box in wall frame f, centre (x, y, z) and size (sx, sy, sz), turned turn radians about y
  const inWall = (f, x, y, z, sx, sy, sz, turn = 0) => f.m.clone().multiply(new THREE.Matrix4().compose(p.set(x, y, z), q.setFromAxisAngle(Y, turn), sc.set(sx, sy, sz)));

  function instanced(geo, mat, list, part) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.part = part;
    group.add(im);
    return im;
  }

  /* ---------- section caps ---------- */
  // how far a cap runs on past end P of wall f (dir d points away from the wall) over the wall it
  // meets: to that wall's far face, short of it by the inset; 0 where the wall already reaches
  // the far face (an outer corner) or runs on in a straight line, minus the inset at a free end
  function endReach(f, P, d) {
    let reach = -1;
    frames.forEach(g => {
      if (g === f || g.w.finish === 'panel') return;
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
  const capUncut = [], capCut = [];
  frames.forEach((f, i) => {
    const { w, L, ux, uz } = f;
    if (w.finish === 'panel') return;
    const cut = cutOf(w), wallTop = roof.topFn(w.top);
    const top = u => (cut ? cut : wallTop(w.a[0] + ux * u, w.a[1] + uz * u));
    if (Math.abs(top(0) - top(L)) >= 0.005) return;
    const y = top(0), lo = -endReach(f, w.a, [-ux, -uz]), hi = L + endReach(f, w.b, [ux, uz]);
    const gaps = (w.openings || []).filter(o => (o.sill || 0) + o.h > y - 0.01).map(o => [o.c - o.w / 2, o.c + o.w / 2]).sort((a, b) => a[0] - b[0]);
    kit.spans(lo, hi, gaps, 0.01).forEach(([a, b]) => (cut ? capCut : capUncut).push([i, inWall(f, (a + b) / 2, y + CAP_LIFT + CAP_H / 2, 0, b - a, CAP_H, w.t - 2 * CAP_INSET)]));
  });
  // the cut walls' caps last, so hiding them is a shorter count
  const capList = [...capUncut, ...capCut];
  const caps = capList.length ? instanced(unitBox, kit.surface('cut'), capList.map(c => c[1]), 'cap') : null;
  if (caps) {
    caps.userData.walls = capList.map(c => c[0]);
    caps.receiveShadow = true;
  }

  /* ---------- skirting and floor shade ---------- */
  const skirts = [], shades = [];
  frames.forEach(f => {
    const { w, L, ux, uz } = f;
    if (w.finish === 'panel') return;
    const gaps = (w.openings || []).filter(o => o.kind !== 'window' || o.sill < SKIRT_H).map(o => [o.c - o.w / 2, o.c + o.w / 2]).sort((a, b) => a[0] - b[0]);
    const n = Math.max(1, Math.ceil(L / PROBE)), k = w.t / 2 + PROBE_OUT;
    [1, -1].forEach(s => {
      // the face's runs with a house room in front, each probe standing for its stretch
      const runs = [];
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * L) / n, x = w.a[0] + ux * u - uz * k * s, z = w.a[1] + uz * u + ux * k * s;
        if (!inRoom(x, z)) continue;
        const last = runs[runs.length - 1], a = (j * L) / n, b = ((j + 1) * L) / n;
        if (last && Math.abs(last[1] - a) < 1e-9) last[1] = b;
        else runs.push([a, b]);
      }
      runs.flatMap(([lo, hi]) => kit.spans(lo, hi, gaps, 0.02)).forEach(([a, b]) => {
        const c = (a + b) / 2, len = b - a;
        skirts.push(inWall(f, c, FLOOR_Y + SKIRT_H / 2, s * (w.t / 2 + SKIRT_D / 2), len, SKIRT_H, SKIRT_D));
        shades.push(inWall(f, c, SHADE_Y, s * (w.t / 2 + SHADE_W / 2), len, 1, SHADE_W, s > 0 ? 0 : Math.PI));
      });
    });
  });
  if (skirts.length) instanced(unitBox, kit.surface('skirting'), skirts, 'skirting').receiveShadow = true;
  if (shades.length) {
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
    instanced(plane, mat, shades, 'shade');
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
  const mat = (name, make = () => kit.surface(name)) => mats.get(name) || mats.set(name, make()).get(name);
  // a splashback: a thin slab on its rect, its UVs in metres along the wall and up it
  function splashback(f, i) {
    const [x0, z0, x1, z1] = f.rect, alongX = x1 - x0 >= z1 - z0;
    const m = kit.solid(group, mat('splash', () => kit.surface('linen', { map: kit.splashTiles(), roughness: 0.42 })), f.rect, f.y);
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
    group.add(m);
  }
  // item f's own frame: s along its long side from the head end, d across from the back side;
  // box() turns a part given in it into a world rect
  function frameOf(f) {
    const [x0, z0, x1, z1] = f.rect, alongX = f.along ? f.along === 'x' : x1 - x0 >= z1 - z0;
    const [l0, l1, c0, c1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    const pt = (l, c) => (alongX ? [l, c] : [c, l]);
    const backLo = faceDist(pt((l0 + l1) / 2, c0)) <= faceDist(pt((l0 + l1) / 2, c1));
    let headLo = true;
    if (f.kind === 'bed') {
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

  const parts = new Map(); // surface name -> [{ i, matrix }]
  const push = (name, i, matrix) => {
    if (!parts.has(name)) parts.set(name, []);
    parts.get(name).push({ i, matrix });
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
  const cylinders = [];
  const cylinder = (name, i, x, z, r, y0, y1) => cylinders.push({ name, i, x, z, r, y: [y0, y1] });

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
    sofa({ world, item, frame: { alongX, frontSign }, y0, h }) {
      // back and arm name the rect's edges that carry one, so two items can join into a corner
      // sofa; without them the back is on the side nearer a wall and an arm on each end
      const rect = item.rect, short = Math.min(rect[2] - rect[0], rect[3] - rect[1]);
      const backs = item.back || [alongX ? (frontSign > 0 ? 'z0' : 'z1') : (frontSign > 0 ? 'x0' : 'x1')];
      const arms = item.arm || (alongX ? ['x0', 'x1'] : ['z0', 'z1']);
      const armW = Math.min(0.22, short / 4), backW = Math.min(0.14, short / 3), cushion = Math.min(0.14, short / 4), foot = 0.04, inset = 0.03;
      const under = y0 + 0.12 * h, base = y0 + 0.34 * h, seat = y0 + 0.55 * h, armTop = y0 + 0.72 * h, top = y0 + h;
      const shrink = (r, edges, w) => [r[0] + (edges.includes('x0') ? w : 0), r[1] + (edges.includes('z0') ? w : 0), r[2] - (edges.includes('x1') ? w : 0), r[3] - (edges.includes('z1') ? w : 0)];
      const band = (r, edge, w) => ({ x0: [r[0], r[1], r[0] + w, r[3]], x1: [r[2] - w, r[1], r[2], r[3]], z0: [r[0], r[1], r[2], r[1] + w], z1: [r[0], r[3] - w, r[2], r[3]] }[edge]);
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
      part('cabinet', 0, L, 0, D, y0, y1 - low);
      part('cabinet', 0, L, 0, rim, y1 - low, y1);
      part('cabinet', 0, L, D - rim, D, y1 - low, y1);
      part('cabinet', 0, rim, rim, D - rim, y1 - low, y1);
      part('cabinet', L - rim, L, rim, D - rim, y1 - low, y1);
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
      for (let k = 0; k < DRAWERS; k++) {
        const lo = a + (k * (b - a)) / DRAWERS + FRONT_GAP / 2, hi = a + ((k + 1) * (b - a)) / DRAWERS - FRONT_GAP / 2;
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
  // a table's or desk's top: the item's own slab when it floats (y0 > 0), else TOP at y1
  const underTop = (y0, y1) => (y0 > 0 ? y0 : y1 - TOP);
  // a table's or desk's top on four legs or, for a desk, two side panels down to the floor
  function legs({ part, L, D, y0, y1 }, panels) {
    const under = underTop(y0, y1);
    part('oak', 0, L, 0, D, under, y1);
    if (panels) {
      part('oak', LEG_IN, LEG_IN + PANEL, LEG_IN, D - LEG_IN, 0, under);
      part('oak', L - LEG_IN - PANEL, L - LEG_IN, LEG_IN, D - LEG_IN, 0, under);
      return;
    }
    [[LEG_IN, LEG_IN + LEG], [L - LEG_IN - LEG, L - LEG_IN]].forEach(([s0, s1]) =>
      [[LEG_IN, LEG_IN + LEG], [D - LEG_IN - LEG, D - LEG_IN]].forEach(([d0, d1]) => part('oak', s0, s1, d0, d1, 0, under)));
  }

  items.forEach((f, i) => {
    const [y0, y1] = f.y, shape = f.kind && SHAPES[f.kind];
    if (f.circle) {
      const [x, z, r] = f.circle;
      if (f.kind !== 'table') return cylinder(MAIN[f.kind] || 'furniture', i, x, z, r, y0, y1);
      const under = underTop(y0, y1);
      cylinder('oak', i, x, z, r, under, y1);
      cylinder('oak', i, x, z, Math.min(0.06, r / 3), 0, under);
      return;
    }
    if (f.kind === 'splashback') return splashback(f, i);
    if (f.kind === 'curtain') return curtain(f, i);
    if (!shape) return add('furniture', i, f.rect, y0, y1);
    const fr = frameOf(f), { L, D, box } = fr;
    shape({
      part: (name, s0, s1, d0, d1, a, b) => add(name, i, box(s0, s1, d0, d1), a, b),
      world: (name, rect, a, b) => add(name, i, rect, a, b),
      lean: (name, s0, s1, d0, d1, a, b, t) => leaning(name, i, fr, s0, s1, d0, d1, a, b, t),
      L, D, y0, y1, h: y1 - y0, item: f, frame: fr
    });
  });

  parts.forEach((list, name) => {
    const im = instanced(unitBox, mat(name), list.map(x => x.matrix), 'furniture');
    im.userData.items = list.map(x => x.i);
    im.castShadow = im.receiveShadow = true;
  });
  cylinders.forEach(({ name, i, x, z, r, y: [a, b] }) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, b - a, 24), mat(name));
    c.position.set(x, (a + b) / 2, z);
    c.userData = { part: 'furniture', items: [i] };
    c.castShadow = c.receiveShadow = true;
    group.add(c);
  });

  // the cut walls' caps hide under the lifted walls while the roof is fully on; they cast no
  // shadow, so this layer has no shades
  function update() {
    if (caps) caps.count = state.roofFade > ROOF_ON ? capUncut.length : capList.length;
    return false;
  }
  update();
  return { id: 'interior', group, update };
}
