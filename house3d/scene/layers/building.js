// The buildings: walls, room floors, the simple style's furniture, roofs and roof steps, and the
// garage roof. A lit style's furniture, skirting and the walls' cut tops are the interior
// layer's, which reads inRoom and cutOf through this layer's api; the winter layer finds the
// walls behind its lights through wallBehind.
// Every storey (ctx.storeys) is drawn: its walls, floors and, in the simple style, furniture go
// where its contents go (the group for the lowest storey, else the lift band under it), and a wall
// that runs up to a roof or above its storey's cut is cut there, standing up to the lower of the
// roof and the cut, its part above, where the roof is higher, in the band over that storey with
// the roofs in the top band, which rise and fade with the roof mode and the storey shown. The
// floors are the room tap targets, the shown storey's alone, and warm
// with a room's markers in state 'on'. The lit styles draw them as lit surfaces: exterior walls
// clad outside (boards when the look's cladding asks) and plain inside, interior walls plain with white doors and frames, framed
// openings (a door with finish 'cladding' gets a leaf of plain cladding, one with glass a
// vertical glass strip, one with a hinge stands open), floors in the room's
// finish (oak planks, the wet rooms' tiles, the carport's paving stones, all on world (x, z)) that
// tint from their own colour, a house room's floor reaching the faces of the walls it runs along,
// and the lift on materials of its own, so its fade never reaches the lower walls. With the look's
// trims (kit.look.trims), its exterior walls also carry opening trims with lined reveals and sill
// flashings, corner boards on every outer and inner corner and a base strip (the plinth, as high
// as kit.base has it), in the casings' surface (kit.trim: trim when the look names it, else the
// frame's), the strip in the base surface when the look names it; the roofs have an edge band in
// the frame's colour, or with the look's trims.fascia a fascia in the casings' surface under a lip
// of roof, and the carport roof a fascia and soffit in the casings' surface. At night (ctx.state.night) a room with a light on, or with a marker
// carrying glow (recent motion), glows: its floor and its windows, each pane tagged with its room
// at build, take a warm emissive scaled by the light's level or the glow; there are no real-time
// lights. The chimneys (roof.chimneys) are upright blocks after the walls, cut at their storey's
// cut like a wall up to a roof, the part above in the band over it on a material of its own.
const FRAME = 0.06, FRAME_D = 0.1; // lit styles: an opening's frame width and depth
// lit styles: an opening's trim and a corner board, both standing PROUD off the face, and a
// sill's metal flashing; common cladding-trim sizes
const TRIM = 0.1, CORNER = 0.12, PROUD = 0.025, REVEAL = 0.015;
const FLASH_T = 0.03, FLASH_OUT = 0.06, FLASH_PAST = 0.03;
// lit styles with the look's trims.fascia: the roof's own lip over the fascia
const FASCIA_LIP = 0.05;
// site.posts: a post's default size, and its knee braces' drop and reach from the top, their
// section a share of the post's
const POST = 0.15, BRACE = 0.6, BRACE_T = 0.6;
// the carport roof's rim and fascia bands: their thickness proud of the roof's core, and the
// shadow gap between two bands
const BAND_T = 0.03, BAND_GAP = 0.01;
// a glass door narrower than this is one leaf, without the centre mullion
const MULLION_MIN = 1.2;
// a door with glass: how far its glass strip stops short of the leaf's foot and top
const DOOR_STRIP_END = 0.25;
const LEAF_T = 0.05;
// lit styles: the farthest a house room's floor edge moves out to meet the wall face it runs along
const SNAP = 0.2;
// lit styles at night: the warm glow of a lit room's floor and windows, and how opaque a lit pane gets
const GLOW = '#ffb45a', FLOOR_GLOW = 0.55, GLASS_GLOW = 1.4, LIT_GLASS = 0.8;

/**
 * cornerBoards(faces, W, D) -> [{ wall, p, dir, from, to, filler? }]
 * A lit style's corner boards on an outline of boarded walls. faces holds one entry per
 * wall, { i, a: [x, z], u: [ux, uz], n: [nx, nz], L, t }, n the plan outward normal; the outer
 * face is the centreline moved by n * t / 2. Each board lies on the outer face of wall `wall`,
 * from the outer faces' crossing p along the plan direction dir, between from and to. A convex
 * corner gives each wall a board that runs D past p, over the other's board edge; a concave one
 * a board on each wall from p. A convex corner needs p at an end of the other wall: where that
 * wall runs on past p, the first one only butts into it. A filler covers what is open between a wall's own face and a
 * convex p: the other wall's end cap, or a notch where both stop at the centreline crossing.
 */
export function cornerBoards(faces, W, D) {
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const outer = f => [f.a[0] + (f.n[0] * f.t) / 2, f.a[1] + (f.n[1] * f.t) / 2];
  const out = [], seen = new Set();
  const add = c => {
    const key = [c.wall, ...c.p, ...c.dir].map(v => Math.round(v * 1000)).join(' ') + (c.filler ? ' f' : '');
    if (!seen.has(key)) seen.add(key), out.push(c);
  };
  faces.forEach(A => {
    const oA = outer(A);
    [[0, A.u], [A.L, [-A.u[0], -A.u[1]]]].forEach(([s, d]) => {
      const e = [oA[0] + A.u[0] * s, oA[1] + A.u[1] * s];
      faces.forEach(B => {
        if (B === A || Math.abs(dot(A.u, B.u)) >= 0.1) return;
        const oB = outer(B);
        // a wall that stops at the other's inner face ends up to tB short of the crossing
        const k = dot([oB[0] - e[0], oB[1] - e[1]], B.n) / dot(A.u, B.n);
        if (Math.abs(k) > Math.max(A.t, B.t) + 0.05) return;
        const p = [e[0] + A.u[0] * k, e[1] + A.u[1] * k];
        const q = dot([p[0] - oB[0], p[1] - oB[1]], B.u);
        if (q < -A.t - 0.05 || q > B.L + A.t + 0.05) return;
        if (dot(d, B.n) < 0) {
          if (q > A.t + 0.05 && q < B.L - A.t - 0.05) return;
          add({ wall: A.i, p, dir: d, from: -D, to: W });
          const g = dot([e[0] - p[0], e[1] - p[1]], d);
          if (g > 0.005) add({ wall: A.i, p, dir: d, from: 0, to: g, filler: true });
        } else {
          add({ wall: A.i, p, dir: d, from: 0, to: W });
          add({ wall: B.i, p, dir: A.n, from: 0, to: W });
        }
      });
    });
  });
  return out;
}

/**
 * crossings(a, b, segs) -> the distances along the plan segment a -> b, strictly inside it,
 * where it crosses one of segs [[p, q], ...]: a wall's top is sampled there too, so it follows a
 * wing roof's ridge, hips and valleys.
 */
export function crossings(a, b, segs) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), out = [];
  segs.forEach(([p, q]) => {
    const ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) return;
    const t = ((p[0] - a[0]) * ez - (p[1] - a[1]) * ex) / den, s = ((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && s >= -1e-9 && s <= 1 + 1e-9) out.push(t * L);
  });
  return out;
}

export default function build({ THREE, kit, C, model, roof, ceiling, state, look, storeys: st, bands, levelOf, storeyOf }) {
  const { basic, mats, edges, box, near } = kit;
  const lit = look.lit;
  const site = model.site || {};
  const levels = st.list.map(s => s.floor);
  const rooms = model.rooms || [];
  const roomIds = new Set(rooms.map(r => r.id));
  const group = new THREE.Group(), lift = new THREE.Group();
  const B = bands(group, lift);
  let mH, mR, wallMats, cladLeaf, postMat, glassFor = () => null;
  const roomGlass = new Map();
  if (lit) {
    // walls and roofs are DoubleSide: a roof's remapped extrusion faces inwards
    const two = { side: THREE.DoubleSide }, fades = { ...two, transparent: true };
    const [front, back] = kit.look.cladding.pattern === 'boards' ? kit.boards() : [];
    const mapped = (o, map) => (map ? { ...o, map } : o);
    const clad = o => ({ front: look.material('cladding', mapped(o, front)), back: look.material('cladding', mapped(o, back)), edge: look.material('cladding', o) });
    const inner = kit.surface('interior', two), glass = kit.surface('glass');
    // one glass per room, so a lit room's windows glow alone, every storey's; panes in no room
    // share the first (a band's own copy, B.separate())
    glassFor = room => {
      if (!room) return glass;
      if (!roomGlass.has(room)) roomGlass.set(room, kit.surface('glass'));
      return roomGlass.get(room);
    };
    const frame = kit.surface('frame'), panel = kit.surface('frame', two), door = kit.surface('door');
    // the casings share the frame's material unless the look names trim, so a model without it
    // draws as before
    const trimOf = o => (kit.trim.surface === 'frame' ? null : kit.surface('trim', o));
    const trim = trimOf() || frame;
    postMat = trim;
    const plinth = look.material(kit.base.surface);
    cladLeaf = look.material('cladding');
    const boarded = { ...clad(two), inner };
    // the lift's inner faces are never seen, so they keep the cladding's colour without boards
    const lifted = clad(fades);
    const rMap = kit.roofMap(), roofMat = look.material('roof', fades);
    const roofPitched = rMap ? look.material('roof', { ...fades, map: rMap }) : roofMat;
    const frameLift = kit.surface('frame', fades);
    mR = { boarded: { ...lifted, inner: lifted.edge }, roof: roofMat, roofPitched, panel: kit.surface('frame', fades), frame: frameLift, trim: trimOf(fades) || frameLift, inner: kit.surface('interior', fades), door: kit.surface('door', fades) };
    // a panel (the carport's walls and posts) is in the frame's colour; else exterior is thick or
    // running up to a roof, and only it gets the cladding, the trims and the base strip
    wallMats = w => {
      if (w.finish === 'panel') return { wall: panel, glass, frame, trim, base: null };
      const outside = w.t >= 0.3 || typeof w.top === 'string';
      // an interior wall's frames and door leaves are in the door's colour
      return outside ? { boarded, glass, frame, trim, base: plinth } : { wall: inner, glass, frame: door, trim: door, base: null };
    };
  } else {
    mH = mats();
    mR = mats(C.roof);
    mR.wall.opacity = 0.28;
    mR.wall.color = C.roofFill;
    wallMats = () => mH;
  }

  // lit styles: the wall solid, glass in windows and glass doors, a leaf in doors, and a frame
  // round each opening; with the look's opening trims, a clad wall's openings also get a trim on
  // the outer face, a lined reveal and, under a window with a sill, a flashing
  function dressWall(g, geo, ops, m, w, L, top) {
    const side = outerSide(w, L);
    const mesh = new THREE.Mesh(geo, m.boarded ? faces(geo, m.boarded, side) : m.wall);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    const bar = (x0, x1, y0, y1, d = FRAME_D, mat = m.frame) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, d), mat);
      b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      return b;
    };
    // a box between local z0 and z1, tagged for the tests
    const piece = (part, x0, x1, y0, y1, z0, z1) => {
      if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
      const b = bar(x0, x1, y0, y1, Math.abs(z1 - z0), m.trim || m.frame);
      b.position.z = (z0 + z1) / 2;
      b.userData.part = part;
    };
    const trims = !!(m.boarded && side && kit.look.trims.openings);
    const face = side * (w.t / 2), proud = side * (w.t / 2 + PROUD);
    // a pane of glass w wide centred at c, tagged with the room it looks into
    const pane = (c, pw, y0, ph) => {
      const room = paneRoom(w, L, c, side), p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), glassFor(room));
      p.position.set(c, y0 + ph / 2, 0);
      p.userData.pane = room;
      g.add(p);
      return p;
    };
    ops.forEach(o => {
      const x0 = o.c - o.w / 2, x1 = o.c + o.w / 2, y0 = o.sill || 0, y1 = y0 + o.h;
      if (o.kind === 'door') {
        const leafMat = o.finish === 'cladding' ? cladLeaf : m.frame, top = y1 - FRAME;
        const leaf = (a, b, lo, hi) => { bar(a, b, lo, hi, LEAF_T, leafMat).userData.leaf = true; };
        if (o.hinge) {
          // turned open by o.open degrees (flat against the wall by default) about the hinge
          // jamb's face on the swing's side; local +z is (-uz, ux) on the plan
          const ux = (w.b[0] - w.a[0]) / L, uz = (w.b[1] - w.a[1]) / L;
          const s = Math.sign(o.swing[0] * -uz + o.swing[1] * ux), lw = o.w - 2 * FRAME;
          const e = o.hinge === 'a' ? 1 : -1, hx = o.c - e * (o.w / 2 - FRAME);
          const t = ((o.open ?? 180) * Math.PI) / 180, dx = e * Math.cos(t), dz = s * Math.sin(t);
          const b = bar(0, lw, 0, top, LEAF_T, leafMat);
          b.position.set(hx + (dx * lw) / 2, top / 2, s * (w.t / 2 + LEAF_T / 2) + (dz * lw) / 2);
          b.rotation.y = Math.atan2(-dz, dx);
          b.userData.leaf = true;
        } else if (!o.glass) leaf(x0 + FRAME, x1 - FRAME, 0, top);
        else {
          // a vertical glass strip down the leaf at glass_c (its middle by default), with leaf
          // above and below it
          const gc = o.glass_c ?? o.c;
          const g0 = gc - o.glass / 2, g1 = gc + o.glass / 2, s0 = DOOR_STRIP_END, s1 = top - DOOR_STRIP_END;
          leaf(x0 + FRAME, g0, 0, top);
          leaf(g1, x1 - FRAME, 0, top);
          leaf(g0, g1, 0, s0);
          leaf(g0, g1, s1, top);
          pane(gc, o.glass, s0, s1 - s0).userData.strip = true;
        }
      } else {
        pane(o.c, o.w, y0, o.h);
        bar(x0 + FRAME, x1 - FRAME, y0, y0 + FRAME);
      }
      bar(x0, x0 + FRAME, y0, y1);
      bar(x1 - FRAME, x1, y0, y1);
      bar(x0 + FRAME, x1 - FRAME, y1 - FRAME, y1);
      if (o.kind === 'glassdoor' && o.w >= MULLION_MIN) bar(o.c - FRAME / 2, o.c + FRAME / 2, y0 + FRAME, y1 - FRAME).userData.mullion = true;
      if (!trims) return;
      const sill = o.kind === 'window' && o.sill > 0;
      // never through a cut or a roof
      const yt = Math.min(y1 + TRIM, top(x0 - TRIM), top(x1 + TRIM)), yb = sill ? Math.max(0, y0 - TRIM) : 0;
      piece('trim', x0 - TRIM, x0, yb, yt, face, proud);
      piece('trim', x1, x1 + TRIM, yb, yt, face, proud);
      piece('trim', x0 - TRIM, x1 + TRIM, y1, yt, face, proud);
      piece('reveal', x0, x0 + REVEAL, y0, y1, 0, face);
      piece('reveal', x1 - REVEAL, x1, y0, y1, 0, face);
      piece('reveal', x0, x1, y1 - REVEAL, y1, 0, face);
      if (!sill) return;
      piece('trim', x0 - TRIM, x1 + TRIM, y0 - TRIM, y0, face, proud);
      piece('sill', x0 - TRIM - FLASH_PAST, x1 + TRIM + FLASH_PAST, y0 - FLASH_T, y0, face, side * (w.t / 2 + FLASH_OUT + PROUD));
      piece('reveal', x0, x1, y0, y0 + REVEAL, 0, face);
    });
    if (!m.base || !kit.look.trims.base || w.bot) return;
    // the base strip sits on the outer face, the side with no room just beyond it; when that
    // cannot be told, on both
    const d = side ? 0.02 : w.t + 0.02, zc = side * (w.t / 2 + 0.01);
    // it runs the wall's length and over its corner fillers, broken by every opening that
    // reaches the ground, and meets the opening's trims
    const pad = trims ? TRIM : 0, [lo, hi] = w.strip || [0, L], h = kit.base.height;
    const gaps = ops.filter(o => (o.sill || 0) < h).map(o => [o.c - o.w / 2 - pad, o.c + o.w / 2 + pad]).sort((p, q) => p[0] - q[0]);
    kit.spans(lo, hi, gaps, 0.01).forEach(([a, b]) => { bar(a, b, 0, h, d, m.base).position.z = zc; });
  }

  // the room a pane at c along wall w looks into: a point just inside the wall from the pane's
  // centre, on the side away from the outer face (either side for a wall with rooms on both)
  function paneRoom(w, L, c, side) {
    const ux = (w.b[0] - w.a[0]) / L, uz = (w.b[1] - w.a[1]) / L, k = w.t / 2 + 0.3;
    const mx = w.a[0] + ux * c, mz = w.a[1] + uz * c;
    // local +z is (-uz, ux) on the plan
    for (const s of side ? [-side] : [1, -1]) {
      const x = mx - uz * k * s, z = mz + ux * k * s;
      const r = rooms.find(q => levelOf(q) === levelOf(w) && q.rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));
      if (r) return r.id;
    }
    return null;
  }

  // an extruded wall's first group holds both faces, the -z one first, then the +z one; split it
  // so the outer face is boarded and the inner one plain (both boarded when side is 0)
  function faces(geo, b, side) {
    const [lids, sides] = geo.groups, half = lids.count / 2;
    geo.clearGroups();
    geo.addGroup(lids.start, half, 0);
    geo.addGroup(lids.start + half, half, 1);
    geo.addGroup(sides.start, sides.count, 2);
    return [side === 1 ? b.inner : b.back, side === -1 ? b.inner : b.front, b.edge];
  }

  // +1 or -1 for the wall group's local z that faces out, 0 when both or neither side has a room;
  // a paved room (the carport) is outdoors under a roof
  // a wall up to a roof or above its storey's cut is cut there
  const cutOf = w => {
    const cut = st.list[levelOf(w)] ? st.list[levelOf(w)].cut : ceiling;
    return w.cut ?? (typeof w.top === 'string' || w.top > cut ? cut : 0);
  };
  const inRoom = (x, z, level = st.ground) => rooms.some(r => levelOf(r) === level && r.floor !== 'paving' && r.rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));
  // probed at the midpoint first, then at a quarter and three quarters, for a wall that is
  // exterior over part of its length only
  function outerSide(w, L) {
    const ux = (w.b[0] - w.a[0]) / L, uz = (w.b[1] - w.a[1]) / L, k = w.t / 2 + 0.3;
    for (const f of [0.5, 0.25, 0.75]) {
      const mx = w.a[0] + ux * L * f, mz = w.a[1] + uz * L * f;
      // the group's rotation turns local +z to (-uz, ux) on the plan
      const plus = inRoom(mx - uz * k, mz + ux * k, levelOf(w)), minus = inRoom(mx + uz * k, mz - ux * k, levelOf(w));
      if (plus !== minus) return plus ? -1 : 1;
    }
    return 0;
  }

  // w.top and w.bot are (x, z) -> y; an upper storey's wall stands on y0, its openings measured
  // from there, and its top is sampled where kinks (plan segments) cross it as well
  function buildWall(parent, w, m) {
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1];
    const L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, y0 = w.y0 || 0;
    const top = u => w.top(w.a[0] + ux * u, w.a[1] + uz * u) - y0;
    const bot = u => (w.bot ? w.bot(w.a[0] + ux * u, w.a[1] + uz * u) - y0 : 0);
    const shape = new THREE.Shape();
    const ops = w.openings || [];
    const doors = ops.filter(o => o.kind !== 'window').sort((p, q) => p.c - q.c);
    const steps = Math.max(1, Math.ceil(L / 0.25));
    shape.moveTo(0, bot(0));
    if (w.bot) for (let i = 1; i < steps; i++) shape.lineTo((L * i) / steps, bot((L * i) / steps));
    doors.forEach(d => {
      shape.lineTo(d.c - d.w / 2, 0);
      shape.lineTo(d.c - d.w / 2, d.h);
      shape.lineTo(d.c + d.w / 2, d.h);
      shape.lineTo(d.c + d.w / 2, 0);
    });
    shape.lineTo(L, bot(L));
    const us = [];
    for (let i = steps; i >= 0; i--) us.push((L * i) / steps);
    const extra = [];
    if (w.kinks) crossings(w.a, w.b, w.kinks).forEach(u => { if ([...us, ...extra].every(v => Math.abs(v - u) > 1e-4)) extra.push(u); });
    // where the roof crosses the cut, so a wall cut under a pitched roof meets it there
    if (w.cross) {
      const f = u => w.cross.raw(w.a[0] + ux * u, w.a[1] + uz * u) - w.cross.at;
      for (let i = 0; i < us.length - 1; i++) {
        const p = us[i], q = us[i + 1], fp = f(p), fq = f(q);
        if (fp * fq >= 0) continue;
        const u = p + ((q - p) * fp) / (fp - fq);
        if ([...us, ...extra].every(v => Math.abs(v - u) > 1e-4)) extra.push(u);
      }
    }
    (extra.length ? [...us, ...extra].sort((p, q) => q - p) : us).forEach(u => shape.lineTo(u, top(u)));
    ops.filter(o => o.kind === 'window').forEach(o => {
      const h = new THREE.Path();
      h.moveTo(o.c - o.w / 2, o.sill);
      h.lineTo(o.c + o.w / 2, o.sill);
      h.lineTo(o.c + o.w / 2, o.sill + o.h);
      h.lineTo(o.c - o.w / 2, o.sill + o.h);
      h.lineTo(o.c - o.w / 2, o.sill);
      shape.holes.push(h);
    });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w.t, bevelEnabled: false });
    geo.translate(0, 0, -w.t / 2);
    const g = new THREE.Group();
    g.position.set(w.a[0], y0, w.a[1]);
    g.rotation.y = Math.atan2(-uz, ux);
    if (lit) {
      dressWall(g, geo, ops, m, w, L, top);
      parent.add(g);
      return;
    }
    const mesh = new THREE.Mesh(geo, m.wall);
    mesh.renderOrder = 2;
    g.add(mesh, edges(geo, m.edge, 20));
    ops.filter(o => o.kind !== 'door').forEach(o => {
      const sill = o.sill || 0;
      const pg = new THREE.PlaneGeometry(o.w, o.h);
      const p = new THREE.Mesh(pg, m.glass);
      p.position.set(o.c, sill + o.h / 2, 0);
      p.renderOrder = 3;
      const pe = edges(pg, m.glassEdge);
      pe.position.copy(p.position);
      g.add(p, pe);
      if (o.kind === 'glassdoor' && o.w >= MULLION_MIN) {
        const mull = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(o.c, 0, 0), new THREE.Vector3(o.c, o.h, 0)]);
        g.add(new THREE.LineSegments(mull, m.glassEdge));
      }
    });
    parent.add(g);
  }

  const shade = o => {
    if (lit) o.castShadow = o.receiveShadow = true;
    return o;
  };
  if (site.garage_roof) {
    const { y, rim = 0, bands = 1 } = site.garage_roof, [y0, y1] = y;
    (site.garage_roof.rects || [site.garage_roof.rect]).forEach(r => {
      if (!lit) return box(lift, mR.wall, mR.edge, r, y);
      const [x0, z0, x1, z1] = r, f = mR.trim, t = BAND_T;
      // the four boards t thick round the rect's edge, from a to b
      const ring = (a, b, part) => [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]
        .forEach(q => { shade(kit.solid(lift, f, q, [a, b])).userData.part = part; });
      if (bands < 2) {
        // a fascia and soffit in the casings' surface, the roof's on top only (BoxGeometry's +y face is third)
        shade(kit.solid(lift, [f, f, mR.roof, f, f, f], r, y));
      } else {
        // a core set back behind the bands, roof-dark so the gaps between them read, its soffit light
        const k = mR.roof, h = (y1 - y0 - (bands - 1) * BAND_GAP) / bands;
        shade(kit.solid(lift, [k, k, k, f, k, k], [x0 + t, z0 + t, x1 - t, z1 - t], y));
        for (let i = 0; i < bands; i++) {
          const lo = y0 + i * (h + BAND_GAP);
          ring(lo, lo + h, 'band');
        }
      }
      if (rim > 0) ring(y1, y1 + rim, 'rim');
    });
  }

  // site.posts: a square post from the ground to its top, each knee brace a 45 degree strut from
  // BRACE below the top out BRACE along its direction, up to the top
  (site.posts || []).forEach(p => {
    const [x, z] = p.at, a = p.size || POST, t = a * BRACE_T, rect = [x - a / 2, z - a / 2, x + a / 2, z + a / 2];
    shade(lit ? kit.solid(group, postMat, rect, [0, p.top]) : box(group, mH.wall, mH.edge, rect, [0, p.top])).userData.part = 'post';
    (p.braces || []).forEach(([dx, dz]) => {
      const n = Math.hypot(dx, dz), b = shade(kit.strut(group, [x, p.top - BRACE, z], [x + (dx / n) * BRACE, p.top, z + (dz / n) * BRACE], t, t, lit ? postMat : mH.wall, 'brace'));
      if (!lit) b.add(edges(b.geometry, mH.edge));
    });
  });

  // lit styles: the clad walls' corner boards (with the look's corner trims), each as a span
  // [lo, hi] along its wall, and how far the fillers take each wall's base strip; the fillers
  // close the walls' corners with or without the boards
  const corners = [], strips = new Map();
  if (lit) levels.forEach((_, level) => {
    const list = [];
    (model.walls || []).forEach((w, i) => {
      if (levelOf(w) !== level || !wallMats(w).boarded) return;
      const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
      const side = outerSide(w, L);
      if (side) list.push({ i, a: w.a, u, n: [-u[1] * side, u[0] * side], L, t: w.t, side });
    });
    const byWall = new Map(list.map(f => [f.i, f]));
    cornerBoards(list, CORNER, PROUD).forEach(c => {
      const f = byWall.get(c.wall), s = c.dir[0] * f.u[0] + c.dir[1] * f.u[1] > 0 ? 1 : -1;
      const xp = (c.p[0] - f.a[0]) * f.u[0] + (c.p[1] - f.a[1]) * f.u[1];
      let [lo, hi] = s > 0 ? [xp + c.from, xp + c.to] : [xp - c.to, xp - c.from];
      if (c.filler) {
        const [a, b] = strips.get(c.wall) || [0, f.L];
        strips.set(c.wall, [Math.min(a, lo), Math.max(b, hi)]);
      } else {
        if (!kit.look.trims.corners) return;
        // a board runs from the corner up to the first opening in its way
        (model.walls[c.wall].openings || []).forEach(o => {
          const x0 = o.c - o.w / 2, x1 = o.c + o.w / 2;
          if (x0 >= hi || x1 <= lo) return;
          if (s > 0) hi = Math.min(hi, x0);
          else lo = Math.max(lo, x1);
        });
        if (hi - lo < 0.01) return;
      }
      corners.push({ ...c, f, lo, hi });
    });
  });

  // the band's materials for a wall's part above its cut: an upper storey's interior wall plain with
  // white frames
  const lifted = w => (w.finish === 'panel' && mR.panel ? { wall: mR.panel } : mR.inner && levelOf(w) !== st.ground && !wallMats(w).boarded ? { wall: mR.inner, frame: mR.door } : mR);
  // the stretches [u0, u1] along a wall where its top stands above y, ends where it crosses y found
  // between samples (a knee wall under the roof has none, a gable wall the middle)
  const risesOver = (w, top, y) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), n = Math.max(1, Math.ceil(L / 0.25));
    const f = u => top(w.a[0] + ((w.b[0] - w.a[0]) * u) / L, w.a[1] + ((w.b[1] - w.a[1]) * u) / L) - y;
    const out = [];
    let from = f(0) > 0.005 ? 0 : null;
    for (let i = 1; i <= n; i++) {
      const p = (L * (i - 1)) / n, q = (L * i) / n, fp = f(p), fq = f(q);
      const at = fp !== fq ? p + ((q - p) * fp) / (fp - fq) : q;
      if (from === null && fq > 0.005) from = fp > 0 ? p : at;
      else if (from !== null && fq <= 0.005) { out.push([from, fq < 0 ? at : q]); from = null; }
    }
    if (from !== null) out.push([from, L]);
    return out.filter(([u0, u1]) => u1 - u0 > 0.01);
  };
  // the part of wall w from u0 to u1 along it, its own ends exactly where they fall on w's
  const partOf = (w, u0, u1) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), at = u => [w.a[0] + ((w.b[0] - w.a[0]) * u) / L, w.a[1] + ((w.b[1] - w.a[1]) * u) / L];
    return { a: u0 === 0 ? w.a : at(u0), b: u1 === L ? w.b : at(u1) };
  };
  (model.walls || []).forEach((w, i) => {
    const s = levelOf(w), base = { ...w, top: roof.topFn(w.top), strip: strips.get(i), kinks: typeof w.top === 'string' ? roof.kinks(w.top) : null, y0: levels[s] || 0 };
    // a storey over the ground's lifts with the roofs, on their fading materials
    const cut = cutOf(w), mW = s > st.ground ? lifted(w) : wallMats(w), here = B.of(s), raw = base.top;
    if (!cut) return buildWall(here, base, mW);
    // below the cut up to the lower of the roof and the cut, above it only where the roof is higher
    buildWall(here, { ...base, top: (x, z) => Math.min(raw(x, z), cut), cross: { at: cut, raw } }, mW);
    risesOver(w, raw, cut).forEach(([u0, u1]) => buildWall(B.above(s), { ...base, ...partOf(w, u0, u1), openings: [], bot: roof.flat(cut) }, lifted(w)));
  });

  // a chimney from its level's floor to its top, with its storey's contents up to its cut and a
  // piece in each band over it; a lit style's upper pieces on a material of their own, so their
  // fade stays off the lower part
  const chimneys = roof.chimneys || [], chimneyMeshes = [];
  const mC = !chimneys.length ? null : lit ? { group: look.material('chimney'), lift: look.material('chimney', { transparent: true }) } : { group: mH, lift: mR };
  chimneys.forEach(c => {
    // up to its storey's cut with that storey, then a piece in each band it rises through
    const parts = [[B.of(c.level), levels[c.level] || 0, c.cut || c.top, c.level > st.ground]];
    if (c.cut) for (let k = c.level; k < st.list.length && st.list[k].cut < c.top; k++) {
      const next = st.list[k + 1];
      parts.push([B.above(k), st.list[k].cut, next && next.cut < c.top ? next.cut : c.top, true]);
    }
    parts.forEach(([parent, a, b, up]) => {
      const m = up ? mC.lift : mC.group;
      const mesh = lit ? kit.solid(parent, m, c.rect, [a, b]) : box(parent, m.wall, m.edge, c.rect, [a, b]);
      if (lit) mesh.castShadow = mesh.receiveShadow = true;
      else mesh.renderOrder = 2;
      mesh.userData.part = 'chimney';
      mesh.userData.chimney = c.id;
      chimneyMeshes.push(mesh);
    });
  });

  // a board or filler is split at the wall's cut like the wall, the upper part in the band over it; a filler
  // is cladding with the wall face's metre UVs, so the boards run on from the face
  const cornerGroups = new Map();
  corners.forEach(c => {
    const w = model.walls[c.wall], { u, side, t } = c.f;
    const top = roof.topFn(w.top)(c.p[0], c.p[1]);
    const s = levelOf(w), cut = cutOf(w), y0 = levels[s] || 0, here = B.of(s);
    const mW = s > st.ground ? mR : wallMats(w);
    const spans = cut ? [[here, y0, Math.min(top, cut), mW.trim, mW.boarded], [B.above(s), cut, top, mR.trim, mR.boarded]] : [[here, y0, top, mW.trim, mW.boarded]];
    spans.forEach(([parent, y0, y1, frame, boarded]) => {
      if (y1 - y0 < 0.01) return;
      const key = `${parent.uuid} ${c.wall}`;
      let g = cornerGroups.get(key);
      if (!g) {
        g = new THREE.Group();
        g.position.set(w.a[0], 0, w.a[1]);
        g.rotation.y = Math.atan2(-u[1], u[0]);
        parent.add(g);
        cornerGroups.set(key, g);
      }
      const cx = (c.lo + c.hi) / 2, cy = (y0 + y1) / 2;
      let mesh;
      if (c.filler) {
        const geo = new THREE.PlaneGeometry(c.hi - c.lo, y1 - y0);
        if (side < 0) geo.rotateY(Math.PI);
        const pos = geo.attributes.position, uv = geo.attributes.uv;
        for (let k = 0; k < pos.count; k++) uv.setXY(k, cx + pos.getX(k), cy + pos.getY(k));
        mesh = new THREE.Mesh(geo, side > 0 ? boarded.front : boarded.back);
        mesh.position.set(cx, cy, side * (t / 2 + 0.001));
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(c.hi - c.lo, y1 - y0, PROUD), frame);
        mesh.position.set(cx, cy, side * (t / 2 + PROUD / 2));
      }
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.part = 'corner';
      g.add(mesh);
    });
  });

  // lit styles: the axis-aligned walls as [axis, centre, half thickness, lo, hi], for a wall along
  // x = centre (axis 0) or z = centre (axis 1) spanning lo..hi on the other axis. A house room's
  // rect edge in front of one it runs along, up to SNAP short of its near face, moves out to that
  // face, since rooms are drawn to centrelines and drawings round, and the ground would show
  // between the floor and the wall; an edge already under a wall stays, and so does one whose
  // strip would cover another room's rect (an open plan beside a short wall)
  // (each storey's own walls and rooms)
  const floorMeshes = [], floorsOf = st.list.map(() => []);
  st.list.forEach((_, level) => {
  const wallLines = (model.walls || []).filter(w => w.finish !== 'panel' && levelOf(w) === level).flatMap(w => {
    const axis = Math.abs(w.a[0] - w.b[0]) < 1e-6 ? 0 : Math.abs(w.a[1] - w.b[1]) < 1e-6 ? 1 : -1, o = 1 - axis;
    return axis < 0 ? [] : [[axis, w.a[axis], w.t / 2, Math.min(w.a[o], w.b[o]), Math.max(w.a[o], w.b[o])]];
  });
  const storeyRooms = rooms.filter(r => levelOf(r) === level);
  const houseRects = storeyRooms.filter(r => r.floor !== 'paving').flatMap(r => r.rects);
  const overlaps = ([a0, b0, a1, b1]) => houseRects.some(([x0, z0, x1, z1]) => Math.min(a1, x1) - Math.max(a0, x0) > 1e-6 && Math.min(b1, z1) - Math.max(b0, z0) > 1e-6);
  function snapRect(rect) {
    // each edge: its axis, its index in the rect and which way is out
    return [[0, 0, -1], [1, 1, -1], [0, 2, 1], [1, 3, 1]].reduce((out, [axis, k, dir]) => {
      const [lo, hi] = axis === 0 ? [rect[1], rect[3]] : [rect[0], rect[2]];
      let gap = Infinity;
      wallLines.forEach(([wa, c, h, wlo, whi]) => {
        const d = (c - rect[k]) * dir - h;
        if (wa === axis && d > 0.001 && d <= SNAP && d < gap && Math.min(hi, whi) - Math.max(lo, wlo) > 0.01) gap = d;
      });
      if (gap === Infinity) return out;
      const to = rect[k] + dir * gap, strip = [...rect];
      strip[k] = to;
      strip[k ^ 2] = rect[k];
      if (!overlaps(strip)) out[k] = to;
      return out;
    }, [...rect]);
  }

  // a room can be several rectangles
  storeyRooms.forEach(r => {
    r.rects.map(rc => (lit && r.floor !== 'paving' ? snapRect(rc) : rc)).forEach(([x0, z0, x1, z1]) => {
      const stones = lit && r.floor === 'paving';
      const map = !lit ? null : stones ? kit.pavers() : r.floor === 'tile' ? kit.tiles() : kit.planks();
      // the night glow lights the planks, tiles or stones, not a flat sheet over them
      const mat = !lit ? basic({ color: C.floor.clone(), opacity: 0.85, side: THREE.DoubleSide })
        : look.material(stones ? 'paving' : r.floor || 'floor', { map, emissiveMap: map });
      // a lit style's floors run to the rect's edge, so a room in several rects is one floor
      const inset = lit ? 0 : 0.05, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const geo = new THREE.PlaneGeometry(x1 - x0 - inset * 2, z1 - z0 - inset * 2);
      // stones, planks and tiles on world (x, z), so they run on across rooms and from the paving
      // round the carport; the plane's y turns to -z
      if (lit) {
        const pos = geo.attributes.position, uv = geo.attributes.uv;
        for (let k = 0; k < pos.count; k++) uv.setXY(k, cx + pos.getX(k), cz - pos.getY(k));
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      // a paved floor lies 5 mm over the paving under it, so a tint never z-fights with it
      mesh.position.set(cx, (levels[level] || 0) + (stones ? 0.025 : 0.02), cz);
      mesh.renderOrder = 1;
      mesh.userData = { room: r.id, storey: level, warm: 0, hover: 0, sel: 0, base: lit ? mat.color.clone() : C.floor };
      mesh.receiveShadow = lit;
      B.of(level).add(mesh);
      floorMeshes.push(mesh);
      floorsOf[level].push(mesh);
    });
  });
  });

  // the simple style's furniture; a lit style's is the interior layer's
  if (!lit) {
    (model.furniture || []).forEach(f => {
      const here = B.of(storeyOf(f));
      if (f.rect) return box(here, mH.furn, mH.furnEdge, f.rect, f.y);
      const [x, z, r] = f.circle;
      const cg = new THREE.CylinderGeometry(r, r, f.y[1] - f.y[0], 18);
      const c = new THREE.Mesh(cg, mH.furn);
      c.position.set(x, (f.y[0] + f.y[1]) / 2, z);
      c.add(edges(cg, mH.furnEdge, 30));
      here.add(c);
    });
  }

  const roofMeshes = [];
  // lit styles with the look's trims.fascia: the edge band is a fascia under a lip of roof
  const fascia = lit && kit.look.trims.fascia;
  const lipOf = thick => (fascia ? Math.min(FASCIA_LIP, thick / 2) : 0);
  function shedRoof(id, points, h, thick) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
    const a = h(1, 0) - h(0, 0), s = a >= 0 ? 1 : -1, scale = Math.hypot(1, Math.abs(a));
    // with a fascia, two slabs: the fascia's below and the lip's on top, the lip all roof; the
    // caps where they meet are left out, so the fading roof shows no plane inside it
    const lip = lipOf(thick);
    [[0, thick - lip, false], ...(lip ? [[thick - lip, lip, true]] : [])].forEach(([d0, depth, top]) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      if (lip) {
        // the first group holds the bottom cap, then the top one
        const [caps, sides] = geo.groups, half = caps.count / 2;
        geo.clearGroups();
        geo.addGroup(top ? caps.start + half : caps.start, half, 0);
        geo.addGroup(sides.start, sides.count, 1);
      }
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getY(i), d = p.getZ(i);
        p.setXYZ(i, x, h(x, z) - roof.gap + d0 + d, z);
        uv.setXY(i, s * z, s * x * scale);
      }
      uv.needsUpdate = true;
      geo.computeVertexNormals();
      addRoof(geo, id, true, top);
    });
  }
  // lip: the band is roof as well (a shed roof's lip slab); a geometry's third group, a wing roof's
  // lip, is roof too
  function addRoof(geo, id, pitched, lip = false) {
    if (lit) {
      // the extrusion's first group is the top and underside, the second the edge band
      const top = pitched ? mR.roofPitched : mR.roof, band = lip ? mR.roof : fascia ? mR.trim : mR.frame;
      const mesh = new THREE.Mesh(geo, fascia ? [top, band, mR.roof] : [top, band]);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.roof = id;
      roofMeshes.push(mesh);
      return lift.add(mesh);
    }
    const mesh = new THREE.Mesh(geo, mR.wall);
    mesh.userData.roof = id;
    roofMeshes.push(mesh);
    mesh.renderOrder = 4;
    lift.add(mesh, edges(geo, mR.edge, 20));
  }
  // a wing roof (hip, gable, flat): its faces as a slab, the top and underside in the first group
  // and the band along the outer outline in the second, as a shed roof's extrusion has them
  function wingRoof(id, { faces, edges: outer }, thick, pitched) {
    const caps = [], capUv = [], band = [], lipBand = [];
    const cut = thick - lipOf(thick);
    const at = ([a, b, c], [x, z], d) => [x, a * x + b * z + c - roof.gap + d, z];
    const uvAt = ([a, b], [x, z]) => {
      const g = Math.hypot(a, b);
      if (g <= 1e-6) return [x, z];
      const gx = a / g, gz = b / g;
      return [x * -gz + z * gx, (x * gx + z * gz) * Math.hypot(1, g)];
    };
    // a triangle wound so its normal points up (up true) or down
    const tri = (p, q, r, upP, upQ, upR, up) => {
      const ny = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
      if (ny > 0 === up) {
        caps.push(...p, ...q, ...r);
        capUv.push(...upP, ...upQ, ...upR);
      } else {
        caps.push(...p, ...r, ...q);
        capUv.push(...upP, ...upR, ...upQ);
      }
    };
    faces.forEach(({ poly, plane }) => {
      const uv0 = uvAt(plane, poly[0]);
      for (let i = 1; i + 1 < poly.length; i++) {
        const uvi = uvAt(plane, poly[i]), uvj = uvAt(plane, poly[i + 1]);
        tri(at(plane, poly[0], thick), at(plane, poly[i], thick), at(plane, poly[i + 1], thick), uv0, uvi, uvj, true);
        tri(at(plane, poly[0], 0), at(plane, poly[i], 0), at(plane, poly[i + 1], 0), uv0, uvi, uvj, false);
      }
    });
    const quad = (out, p, q, plane, d0, d1) => {
      const a = at(plane, p, d0), b = at(plane, q, d0), c = at(plane, q, d1), d = at(plane, p, d1);
      out.push(...a, ...b, ...c, ...a, ...c, ...d);
    };
    outer.forEach(([p, q, plane]) => {
      quad(band, p, q, plane, 0, cut);
      if (cut < thick) quad(lipBand, p, q, plane, cut, thick);
    });
    const bandCount = (band.length + lipBand.length) / 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(caps.concat(band, lipBand), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(capUv.concat(new Array(bandCount * 2).fill(0)), 2));
    geo.addGroup(0, caps.length / 3, 0);
    geo.addGroup(caps.length / 3, band.length / 3, 1);
    if (lipBand.length) geo.addGroup((caps.length + band.length) / 3, lipBand.length / 3, 2);
    geo.computeVertexNormals();
    addRoof(geo, id, pitched);
  }
  for (const [id, r] of Object.entries(model.roofs || {})) {
    const faces = roof.faces(id);
    if (faces) wingRoof(id, faces, r.thick, r.kind !== 'flat');
    else shedRoof(id, r.outline, roof.fns[id], r.thick);
  }
  (model.roof_steps || []).forEach(s => {
    const low = model.roofs[s.bot];
    buildWall(lift, { a: s.a, b: s.b, t: 0.2, top: roof.under(s.top), bot: (x, z) => roof.fns[s.bot](x, z) - roof.gap + low.thick }, mR);
  });

  // a lit style's light floors tint lighter, towards amber
  const TINT = lit ? [[C.amber, 0.5], [C.line, 0.3], [C.sel, 0.25]] : [[C.warm, 0.85], [C.hover, 0.6], [C.sel, 0.7]];
  let warm = new Set(), glowing = new Map();
  const glowColor = new THREE.Color(GLOW);
  if (lit) {
    floorMeshes.forEach(m => { m.material.emissive.copy(glowColor); m.material.emissiveIntensity = 0; m.userData.glow = 0; });
    roomGlass.forEach(mt => { mt.emissive.copy(glowColor); mt.emissiveIntensity = 0; mt.userData.glow = 0; mt.userData.day = mt.opacity; });
  }
  // the nearest wall face from (x, y, z) within reach along the horizontal normal (nx, nz), looked
  // for both ways: { d, s }, its distance and side (1 along the normal, -1 against), or null. A
  // wall is any of this layer's meshes but the floors, the roofs and the chimneys, the list made on
  // first use.
  // It reads the walls where they stand, so it answers for the rest pose only: call it at build
  let walls = null;
  const probe = new THREE.Raycaster(), from = new THREE.Vector3(), dir = new THREE.Vector3();
  function wallBehind(x, y, z, nx, nz, reach) {
    if (!walls) {
      const skip = new Set([...floorMeshes, ...roofMeshes, ...chimneyMeshes]);
      walls = [];
      [group, ...B.lifts].forEach(g => { g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh && !skip.has(o)) walls.push(o); }); });
    }
    let best = null;
    probe.far = reach;
    [1, -1].forEach(s => {
      probe.set(from.set(x, y, z), dir.set(nx * s, 0, nz * s));
      const hit = probe.intersectObjects(walls, false)[0];
      if (hit) { best = { d: hit.distance, s }; probe.far = hit.distance; }
    });
    return best;
  }

  B.separate();
  return {
    id: 'building',
    group,
    lift,
    lifts: B.lifts,
    // for the interior layer, which dresses a lit style's walls, and the winter layer's wash
    api: { inRoom, cutOf, wallBehind },
    markers(list) {
      const on = list.filter(m => m.state === 'on' && m.warm !== false && roomIds.has(m.room));
      warm = new Set(on.map(m => m.room));
      // a room's brightest light or marker glow sets its glow; a marker's glow counts in any state,
      // since a motion sensor off a few minutes ago is idle
      glowing = new Map();
      const up = (room, g) => glowing.set(room, Math.max(glowing.get(room) || 0, g));
      on.filter(m => m.icon === 'light').forEach(m => up(m.room, m.level ?? 1));
      list.forEach(m => { if (m.glow > 0 && roomIds.has(m.room)) up(m.room, m.glow); });
    },
    // the floors take taps only with the roof off, the shown storey's alone
    hit(ray) {
      if (state.mode !== 'open') return null;
      const hits = ray.intersectObjects(floorsOf[state.level ?? st.list.length - 1] || [], false);
      return hits.length ? { room: hits[0].object.userData.room, target: hits[0].object } : null;
    },
    update(dt, k) {
      let moving = false;
      floorMeshes.forEach(m => {
        const u = m.userData;
        const goals = [warm.has(u.room) ? 0.75 : 0, state.hovered === m ? 1 : 0, state.selection === u.room ? 1 : 0];
        ['warm', 'hover', 'sel'].forEach((key, i) => {
          if (near(u[key], goals[i])) u[key] = goals[i];
          else { u[key] += (goals[i] - u[key]) * k; moving = true; }
        });
        m.material.color.copy(u.base).lerp(TINT[0][0], u.warm * TINT[0][1]).lerp(TINT[1][0], u.hover * TINT[1][1]).lerp(TINT[2][0], u.sel * TINT[2][1]);
      });
      if (!lit) return moving;
      const night = state.night || 0;
      const ease = (u, goal, apply) => {
        if (near(u.glow, goal)) u.glow = goal;
        else { u.glow += (goal - u.glow) * k; moving = true; }
        apply(u.glow);
      };
      floorMeshes.forEach(m => ease(m.userData, (glowing.get(m.userData.room) || 0) * night, g => { m.material.emissiveIntensity = g * FLOOR_GLOW; }));
      roomGlass.forEach((mt, room) => ease(mt.userData, (glowing.get(room) || 0) * night, g => {
        mt.emissiveIntensity = g * GLASS_GLOW;
        mt.opacity = mt.userData.day + (LIT_GLASS - mt.userData.day) * Math.min(1, g);
      }));
      return moving;
    }
  };
}
