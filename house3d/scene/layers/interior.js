// The real style's interior, drawn as an architectural model: a near-black section cap on every
// wall's flat cut top, white skirting and a soft shade on the floor along every wall face that
// has a house room in front of it, and the furniture shaped by its kind (scripts/house3d_model.py
// FURNITURE_KINDS; an item without one is a warm grey block). It reads the building layer's
// inRoom and cutOf through its api, so it builds after it, and builds nothing in the
// simple style or without the building. Caps, skirting and shade are one InstancedMesh each, the
// furniture one per material, so the interior costs a handful of draw calls; every mesh carries
// userData.part, the furniture userData.items (the item index of each instance) and the caps
// userData.walls (the wall index of each). With the roof fully on, the cut walls' caps are
// hidden: the lifted wall above sits on them.
const CAP_H = 0.01, CAP_LIFT = 0.002, CAP_INSET = 0.005; // inset from each face and a free end
const SKIRT_H = 0.07, SKIRT_D = 0.012, FLOOR_Y = 0.02;
const PROBE = 0.25, PROBE_OUT = 0.3; // how often and how far out a face is probed for a room
const SHADE_W = 0.3, SHADE_Y = 0.024, SHADE_OPACITY = 0.18, SHADE_PX = 32;
const ROOF_ON = 0.99;
// each kind's main surface; a circle item is a cylinder in it, except a table
const MAIN = {
  bed: 'oak', headboard: 'fabric', wardrobe: 'cabinet', sofa: 'fabric', table: 'oak', desk: 'oak',
  counter: 'cabinet', cabinet: 'oak', bath: 'cabinet', bench: 'oak', appliance: 'unit'
};
const TOP = 0.04, LEG = 0.05, LEG_IN = 0.03, PANEL = 0.03; // tables and desks
const PILLOW_PER = 0.9, PILLOW_L = 0.38, GROOVE = 0.01, DOOR_W = 0.55;
const SLAT = 0.09, SLAT_GAP = 0.02, SLAT_T = 0.03, SUPPORT = 0.05;

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
  // item f's own frame: s along its long side from the head end, d across from the back side;
  // box() turns a part given in it into a world rect
  function frameOf(f) {
    const [x0, z0, x1, z1] = f.rect, alongX = x1 - x0 >= z1 - z0;
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
    return { L: l1 - l0, D: c1 - c0, box };
  }

  const parts = new Map(); // surface name -> [{ i, rect, y }]
  const add = (name, i, rect, y0, y1) => {
    if (rect[2] - rect[0] < 0.005 || rect[3] - rect[1] < 0.005 || y1 - y0 < 0.002) return;
    if (!parts.has(name)) parts.set(name, []);
    parts.get(name).push({ i, rect, y: [y0, y1] });
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
    sofa({ part, L, D, y0, h }) {
      part('fabric', 0, L, 0, D, y0, y0 + 0.55 * h);
      part('fabric', 0, L, 0, Math.min(0.2, D / 2), y0, y0 + h);
      part('fabric', 0, Math.min(0.15, L / 4), 0, D, y0, y0 + 0.75 * h);
      part('fabric', L - Math.min(0.15, L / 4), L, 0, D, y0, y0 + 0.75 * h);
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
    appliance({ part, L, D, y0, y1 }) { part('unit', 0, L, 0, D, y0, y1); }
  };
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
    if (!shape) return add('furniture', i, f.rect, y0, y1);
    const { L, D, box } = frameOf(f);
    shape({ part: (name, s0, s1, d0, d1, a, b) => add(name, i, box(s0, s1, d0, d1), a, b), L, D, y0, y1, h: y1 - y0 });
  });

  const mats = new Map();
  const mat = name => mats.get(name) || mats.set(name, kit.surface(name)).get(name);
  parts.forEach((list, name) => {
    const im = instanced(unitBox, mat(name), list.map(({ rect: [x0, z0, x1, z1], y: [a, b] }) =>
      new THREE.Matrix4().compose(p.set((x0 + x1) / 2, (a + b) / 2, (z0 + z1) / 2), q.identity(), sc.set(x1 - x0, b - a, z1 - z0))), 'furniture');
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
