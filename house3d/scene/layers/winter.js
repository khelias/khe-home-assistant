// Winter, the real style's alone: the Christmas lights (site.festive) and the snow, one switchable
// layer. The card switches it on by the season; the layer itself knows no date and no weather.
//
// The lights are a view effect of the dark, like the outdoor luminaires (lights.js): they follow
// no HA entity and glow as ctx.state.night rises. Icicles hang along each site.festive.icicles
// path: a dark cable along the path, and along every segment that is not near-vertical a strand
// hangs straight down every STRAND_STEP, its length cycling through DROPS of the path's drop, an
// LED every LED_GAP down it, so the strands read as a curtain of light. A near-vertical segment (a
// climb, a post) carries its LEDs along the cable. With planters true a string winds round every
// tall planter plant. Each LED is a small bright point with a soft halo round it, and under a
// roof path a warm wash falls down the wall behind it, where there is one; the real style has no
// bloom, so the halo and the wash are the glow. A path rides the lift, so it rises and fades with
// the roof, unless it is marked ground. kit.applyFade owns the opacity of everything in the lift,
// so the glow is colour and size on additive materials, never opacity.
//
// Each site.festive.christmas_trees item is a dressed tree on the floor (spruce below): a stand,
// stacked cones, baubles, a gold star and an LED string wound up it, drawn with the ground, not
// the lift, since it stands indoors under the cut.
//
// The snow: a slab on every roof and on the garage roof (in the lift), the lawn and the land round
// the lot blended white through the ground layer's api.snow, a light dusting over the paving and
// the decks, a cap on every hedge and tree crown and a white tip on each tall plant, all placed
// from those layers' api. The crowns' caps hang on the trees (trees api.attach), so they hide with
// them. With options.snowfall, and not under reduced motion, flakes fall over the lot while the
// layer is on; the card asks for it in the full view only, since a moving layer keeps the render
// loop running. Nothing here casts a shadow.
const LED = '#ffd59a', CABLE = '#1d1f21', WASH = '#ffb466';
const STRAND_STEP = 0.18, LED_GAP = 0.07, DROP = 0.4, DROPS = [1, 0.55, 0.8, 0.35, 0.65];
const NEAR_VERTICAL = 0.5; // a segment rising more than this share of its length
const WRAP_OUT = 0.03, WRAP_TURNS = 9, WRAP_GAP = 0.06; // the string round a tall plant
// an LED's sprite size in metres and its colour's share, by day and at night; its halo's size at
// night and its share of the LED's colour
const LED_DAY = 0.05, LED_NIGHT = 0.11, LED_DAY_LEVEL = 0.35, HALO = 0.45, HALO_LEVEL = 0.13;
// the wall wash under a roof path
const WASH_LEVEL = 0.16; // its top's share of the LED colour
const WASH_FADE = [[0, 1], [0.2, 0.72], [0.5, 0.42], [0.9, 0.2], [1.4, 0.07], [2, 0]]; // [depth, share] down the wall
const WASH_REACH = 1; // how far behind the cable a wall may stand
const WASH_STEP = 0.25; // the step between the rays that find it
const WASH_PROBE = [0.3, 1]; // the rays' depths below the cable: a wall must stand at both
const WASH_OFF = 0.01; // the wash's gap off the wall
const WASH_EDGE = 0.03; // how far in from a segment's end its first ray goes
const WASH_FLAT = 0.05; // how much the wall's distance may change across one piece
const ROOF_SNOW = 0.08, ROOF_INSET = 0.05, CAP = 0.12, CAP_OUT = 0.04, TIP = 0.8;
const DUST_OPACITY = 0.5, DUST_LIFT = 0.004;
const FLAKES = 1500, FLAKE_MARGIN = 4, FLAKE_TOP = 12, FLAKE_SIZE = 0.14, FLAKE_FALL = [0.5, 1], FLAKE_SWAY = 0.15, FLAKE_NIGHT = 0.45;

// a Christmas tree: the stand's foot cross and post, the height its lowest branches start at, its
// tiers, how far up the outline the last tier's rim stands and how far a tier reaches above its
// rim, in rim spacings; the LED string's turns and spacing, the baubles' spacing on a rim, their
// radii and colours, and the star's points over the tip
const STAND = [0.5, 0.03, 0.1], POST_R = 0.035, SKIRT = 0.22, TIERS = 6, LAST_RIM = 0.8, REACH = 2.2;
const SPRUCE_TURNS = 7, SPRUCE_GAP = 0.09, BAUBLE_STEP = 0.26, BAUBLE_R = [0.032, 0.045];
const BAUBLES = ['baubleRed', 'baubleGold', 'baubleSilver'], STAR = [0.1, 0.045, 0.02];

const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

// a seeded 0..1 sequence (mulberry32), so two builds place every flake alike
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * icicleLeds(path, drop) -> { leds: [[x, y, z], ...], wires: [[x, y, z], ...], runs: [[a, b], ...],
 * length }: one icicle path's LEDs, its cable and strand wires as segment pairs, its segments that
 * carry strands, and its length, as described above.
 */
export function icicleLeds(path, drop = DROP) {
  const leds = [], wires = [], runs = [];
  let strand = 0, length = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = b.map((v, k) => v - a[k]), len = Math.hypot(...d);
    if (!len) continue;
    length += len;
    wires.push(a, b);
    const at = t => lerp(a, b, t);
    if (Math.abs(d[1]) >= NEAR_VERTICAL * len) {
      const m = Math.max(1, Math.round(len / LED_GAP));
      for (let j = 0; j < m; j++) leds.push(at((j + 0.5) / m));
      continue;
    }
    runs.push([a, b]);
    const k = Math.max(1, Math.round(len / STRAND_STEP));
    for (let j = 0; j < k; j++) {
      const [x, y, z] = at((j + 0.5) / k), s = drop * DROPS[strand++ % DROPS.length], m = Math.max(1, Math.round(s / LED_GAP));
      wires.push([x, y, z], [x, y - s, z]);
      for (let q = 0; q < m; q++) leds.push([x, y - (s * (q + 1)) / m, z]);
    }
  }
  return { leds, wires, runs, length };
}

// the outline [[x, z], ...] moved d inwards along every edge
function insetOutline(pts, d) {
  const n = pts.length;
  let area = 0;
  pts.forEach(([x, z], i) => { const [x2, z2] = pts[(i + 1) % n]; area += x * z2 - x2 * z; });
  const s = area > 0 ? 1 : -1;
  const inward = ([xa, za], [xb, zb]) => { const l = Math.hypot(xb - xa, zb - za) || 1; return [(-(zb - za) / l) * s, ((xb - xa) / l) * s]; };
  return pts.map((p, i) => {
    // a corner near 180 degrees would throw the point far out: past 4 d it is cut back
    const n1 = inward(pts[(i - 1 + n) % n], p), n2 = inward(p, pts[(i + 1) % n]), k = d / Math.max(0.25, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}

/**
 * spruce({ pos: [x, z], height, base }) -> { pos, tiers: [{ y, r, h }], radius(y), leds: [[x, y, z]],
 * baubles: [{ at: [x, y, z], r, colour }], star: [x, y, z] }: a Christmas tree on the floor at pos,
 * its tip at height and its lowest rim base wide. Each tier is a cone whose rim stands at y with
 * radius r and whose tip is h above it; the rims narrow in a straight line to the tip, a little
 * uneven, so the tree reads as a natural one. radius(y) is the outline at y, the widest tier there;
 * the LED string winds up it, the baubles hang on the rims and the star stands over the tip.
 * Seeded by pos, so two builds dress it alike.
 */
export function spruce({ pos: [x, z], height: H, base }) {
  const rand = seeded(Math.round(x * 1000) * 7919 + Math.round(z * 1000)), R = base / 2, span = H - SKIRT;
  const step = (LAST_RIM * span) / (TIERS - 1);
  const tiers = Array.from({ length: TIERS }, (_, i) => {
    const y = SKIRT + i * step;
    return { y, r: R * (1 - (y - SKIRT) / span) * (i ? 0.94 + 0.08 * rand() : 1), h: i === TIERS - 1 ? H - y : Math.min(H - y, REACH * step) };
  });
  const radius = y => tiers.reduce((m, t) => (y >= t.y && y <= t.y + t.h ? Math.max(m, t.r * (1 - (y - t.y) / t.h)) : m), 0);
  const leds = [], low = SKIRT + 0.04, high = H - 0.12, pitch = (high - low) / SPRUCE_TURNS;
  let a = 0, y = low;
  while (y < high) {
    const r = radius(y) + 0.01;
    leds.push([x + r * Math.cos(a), y, z + r * Math.sin(a)]);
    // one SPRUCE_GAP along the string: round the outline and up by the turns' pitch
    const da = SPRUCE_GAP / Math.hypot(Math.max(r, 0.05), pitch / (2 * Math.PI));
    a += da;
    y += (da / (2 * Math.PI)) * pitch;
  }
  const baubles = [];
  tiers.forEach(t => {
    const n = Math.max(3, Math.round((2 * Math.PI * t.r) / BAUBLE_STEP)), off = rand() * 2 * Math.PI;
    for (let k = 0; k < n; k++) {
      const ang = off + (k * 2 * Math.PI) / n, br = BAUBLE_R[0] + rand() * (BAUBLE_R[1] - BAUBLE_R[0]), r = t.r * 0.9;
      baubles.push({ at: [x + r * Math.cos(ang), t.y - br * 0.6, z + r * Math.sin(ang)], r: br, colour: BAUBLES[Math.floor(rand() * BAUBLES.length)] });
    }
  });
  return { pos: [x, z], tiers, radius, leds, baubles, star: [x, H + STAR[0] * 0.8, z] };
}

// a plant's radius at height h on its outline [[radius, height], ...] from the foot up
function radiusAt(profile, h) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, h0] = profile[i - 1], [r1, h1] = profile[i];
    if (h <= h1 && h1 > h0) return r0 + ((r1 - r0) * (Math.max(h, h0) - h0)) / (h1 - h0);
  }
  return 0;
}

export default function build({ THREE, kit, model, options, style, state, roof, frame, reduceMotion, layer }) {
  const group = new THREE.Group();
  if (style !== 'real') return { id: 'winter', group };
  const lift = new THREE.Group(), site = model.site || {}, festive = site.festive || {};
  const api = id => { const L = layer(id); return (L && L.api) || {}; };
  const siteApi = api('site'), treesApi = api('trees'), ground = api('ground');
  const plants = siteApi.planters ? siteApi.planters() : [];

  /* ---------- the lights ---------- */
  const ledColor = new THREE.Color(LED), washColor = new THREE.Color(WASH);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const ledSprite = kit.canvasTexture(64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,245,225,0.9)'], [1, 'rgba(255,225,180,0)']]);
  const haloSprite = kit.canvasTexture(64, [[0, 'rgba(255,220,170,0.9)'], [0.3, 'rgba(255,200,140,0.35)'], [1, 'rgba(255,180,110,0)']]);
  const ledMats = [], haloMats = [], washMats = [];
  // one geometry for an LED's point and its halo
  const points = (pts, parent, part) => {
    if (!pts.length) return;
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const led = kit.keep(new THREE.PointsMaterial({ color: 0, size: LED_DAY, map: ledSprite, ...additive }));
    const halo = kit.keep(new THREE.PointsMaterial({ color: 0, size: HALO, map: haloSprite, ...additive }));
    ledMats.push(led);
    haloMats.push(halo);
    [[halo, `${part}-halo`, 5], [led, part, 6]].forEach(([m, name, order]) => {
      const p = new THREE.Points(geo, m);
      p.userData.part = name;
      p.renderOrder = order;
      parent.add(p);
    });
  };
  // a warm wash on the wall behind each strand-carrying segment, where the building has one within
  // WASH_REACH: found every WASH_STEP (building api.wallBehind), drawn on the wall itself,
  // brightest under the cable and fading down WASH_FADE, and tapered where the wall behind it
  // starts or ends; an open front (a porch, a carport) or a lintel over one gets none, since light
  // hanging in the air reads as a curtain. Runs that meet end to end are one wall for the taper
  const wallBehind = api('building').wallBehind;
  const wash = (runs, parent) => {
    const pos = [], col = [];
    const quad = (p, q, fp, fq) => {
      for (let i = 1; i < WASH_FADE.length; i++) {
        const [h0, v0] = WASH_FADE[i - 1], [h1, v1] = WASH_FADE[i];
        const p0 = [p.x, p.y - h0, p.z, v0 * fp], q0 = [q.x, q.y - h0, q.z, v0 * fq];
        const q1 = [q.x, q.y - h1, q.z, v1 * fq], p1 = [p.x, p.y - h1, p.z, v1 * fp];
        [p0, q0, q1, p0, q1, p1].forEach(([x, y, z, c]) => { pos.push(x, y, z); col.push(c, c, c); });
      }
    };
    const pieces = [];
    let last = null;
    if (wallBehind) runs.forEach(([a, b]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz), joined = !!last && a.every((v, k) => v === last[k]);
      last = b;
      if (len < WASH_STEP / 2) return;
      const n = Math.round(len / WASH_STEP), nx = -dz / len, nz = dx / len, e = WASH_EDGE / len;
      const edges = Array.from({ length: n + 1 }, (_, i) => {
        const [x, y, z] = lerp(a, b, Math.min(Math.max(i / n, e), 1 - e));
        const [h, low] = WASH_PROBE.map(depth => wallBehind(x, y - depth, z, nx, nz, WASH_REACH));
        if (!h || !low || low.s !== h.s || Math.abs(low.d - h.d) > WASH_FLAT) return null;
        const d = (h.d - WASH_OFF) * h.s;
        return { x: x + nx * d, y, z: z + nz * d, s: h.s, d: h.d };
      });
      // a piece needs the same wall at both its ends, so the end face of a thin wall takes none
      for (let i = 0; i < n; i++) {
        const p = edges[i], q = edges[i + 1];
        pieces.push({ p, q, ok: !!(p && q && p.s === q.s && Math.abs(p.d - q.d) < WASH_FLAT), joined: i > 0 || joined });
      }
    });
    pieces.forEach((pc, i) => {
      const next = pieces[i + 1], fp = pc.joined && pieces[i - 1].ok ? 1 : 0, fq = next && next.joined && next.ok ? 1 : 0;
      if (pc.ok && (fp || fq)) quad(pc.p, pc.q, fp, fq);
    });
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = kit.keep(new THREE.MeshBasicMaterial({ color: 0, vertexColors: true, side: THREE.DoubleSide, ...additive }));
    washMats.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.userData.part = 'wash';
    mesh.renderOrder = 4;
    parent.add(mesh);
  };
  const cableM = kit.lineMat({ color: CABLE, opacity: 0.9 });
  const onRoof = { leds: [], wires: [], runs: [] }, onGround = { leds: [], wires: [], runs: [] }, icicles = [];
  (Array.isArray(festive.icicles) ? festive.icicles : []).forEach(ic => {
    const one = icicleLeds(ic.path, ic.drop ?? DROP), to = ic.ground ? onGround : onRoof;
    ['leds', 'wires', 'runs'].forEach(k => to[k].push(...one[k]));
    icicles.push({ leds: one.leds.length, length: one.length, lift: !ic.ground });
  });
  [[onRoof, lift], [onGround, group]].forEach(([w, parent]) => {
    if (!w.wires.length) return;
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(w.wires.map(p => new THREE.Vector3(...p))), cableM);
    line.userData.part = 'cable';
    parent.add(line);
  });
  points(onRoof.leds, lift, 'icicles');
  wash(onRoof.runs, lift);
  const plantLeds = [];
  if (festive.planters) plants.forEach(({ pos: [x, y, z], profile }) => {
    const height = profile[profile.length - 1][1] * 0.95, n = Math.round((WRAP_TURNS * 2 * Math.PI * profile[1][0]) / WRAP_GAP);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, h = t * height, a = t * WRAP_TURNS * 2 * Math.PI, r = radiusAt(profile, h) + WRAP_OUT;
      plantLeds.push([x + r * Math.cos(a), y + h, z + r * Math.sin(a)]);
    }
  });
  points([...onGround.leds, ...plantLeds], group, 'leds');
  const spruces = (Array.isArray(festive.christmas_trees) ? festive.christmas_trees : []).map(spruce);
  if (spruces.length) {
    const tree = new THREE.Group();
    tree.userData.part = 'christmas-tree';
    // every piece of every tree is one instance of its kind, so the trees cost a draw call a kind
    const cone = new THREE.ConeGeometry(1, 1, 11), post = new THREE.CylinderGeometry(POST_R, POST_R, 1, 8), foot = new THREE.BoxGeometry(...STAND);
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const ang = Math.PI / 2 + (k * Math.PI) / 5, r = STAR[k % 2];
      star[k ? 'lineTo' : 'moveTo'](r * Math.cos(ang), r * Math.sin(ang));
    }
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: STAR[2], bevelEnabled: false }).translate(0, 0, -STAR[2] / 2);
    const ball = new THREE.SphereGeometry(1, 12, 8);
    const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), cross = [0, Math.PI / 2];
    const at = (p, turn = 0, scale = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(...p), q.setFromAxisAngle(Y, turn), new THREE.Vector3(...scale));
    const kinds = [
      [foot, 'anthracite', spruces.flatMap(({ pos: [x, z] }) => cross.map(t => at([x, STAND[2] / 2, z], t)))],
      [post, 'trunk', spruces.map(({ pos: [x, z], tiers: [t] }) => at([x, t.y / 2, z], 0, [1, t.y, 1]))],
      // each tier turned against the last, so the cones' facets do not line up
      [cone, 'spruce', spruces.flatMap(({ pos: [x, z], tiers }) => tiers.map((t, k) => at([x, t.y + t.h / 2, z], k * 0.9, [t.r, t.h, t.r])))],
      [starGeo, 'baubleGold', spruces.flatMap(s => cross.map(t => at(s.star, t)))],
      ...BAUBLES.map(colour => [ball, colour, spruces.flatMap(s => s.baubles.filter(b => b.colour === colour).map(b => at(b.at, 0, [b.r, b.r, b.r])))])
    ];
    kinds.forEach(([geo, name, list]) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, kit.surface(name), list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.receiveShadow = true;
      tree.add(im);
    });
    group.add(tree);
    points([...spruces.flatMap(s => s.leds), ...spruces.map(s => s.star)], group, 'tree-leds');
  }
  group.userData.winter = { icicles, plants: plantLeds.length, trees: spruces.map(s => ({ leds: s.leds.length, baubles: s.baubles.length })) };

  /* ---------- the snow ---------- */
  const snowM = kit.surface('snow'), roofSnowM = kit.surface('snow', { transparent: true });
  const snowy = (m, part) => { m.castShadow = false; m.receiveShadow = true; m.userData.part = part; return m; };
  // a slab over each plan polygon of rings at top (x, z) -> y, one mesh for the roof
  const slab = (rings, top, id) => {
    const parts = rings.map(pts => {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: ROOF_SNOW, bevelEnabled: false });
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i), d = p.getZ(i); p.setXYZ(i, x, top(x, z) + DUST_LIFT + d, z); }
      // swapping y and z mirrors the shape, so each triangle turns its back: turn it round again,
      // or the face seen from above is the bottom one, 4 mm over the slab
      const a = p.array;
      for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) [a[i + 3 + k], a[i + 6 + k]] = [a[i + 6 + k], a[i + 3 + k]];
      return geo;
    });
    let geo = parts[0];
    if (parts.length > 1) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(parts.flatMap(g => Array.from(g.attributes.position.array)), 3));
      parts.forEach(g => g.dispose());
    }
    geo.computeVertexNormals();
    const m = snowy(new THREE.Mesh(geo, roofSnowM), 'roof-snow');
    m.userData.roof = id;
    lift.add(m);
  };
  for (const [id, r] of Object.entries(model.roofs || {})) {
    const wings = roof.faces(id);
    if (wings) {
      // a wing roof: its faces, each inside its wing's edges, under the slab's top over it
      const rings = wings.faces.map(({ poly, wing }) => {
        const [x0, z0, x1, z1] = r.rects[wing], d = ROOF_INSET;
        return [[-1, 0, x0 + d], [1, 0, -(x1 - d)], [0, -1, z0 + d], [0, 1, -(z1 - d)]].reduce((q, h) => (q.length >= 3 ? roof.clip(q, h) : q), poly);
      }).filter(q => q.length >= 3);
      if (rings.length) slab(rings, roof.top(id), id);
      continue;
    }
    if (!Array.isArray(r.outline) || r.outline.length < 3) continue;
    slab([insetOutline(r.outline, ROOF_INSET)], roof.top(id), id);
  }

  // on the garage roof, inside its fascia: an edge shared with another of its rects stays, so the
  // snow runs on across the joint
  const gr = site.garage_roof;
  const grRects = gr ? gr.rects || [gr.rect] : [];
  grRects.forEach((r, i) => {
    // side k of r (0: x0, 1: z0, 2: x1, 3: z1) lies on a side of another rect that overlaps it along
    const shared = k => grRects.some((o, j) => {
      if (j === i) return false;
      const along = k % 2 ? [0, 2] : [1, 3];
      return (o[k % 2] === r[k] || o[(k % 2) + 2] === r[k]) && Math.min(r[along[1]], o[along[1]]) > Math.max(r[along[0]], o[along[0]]);
    });
    const rect = r.map((v, k) => (shared(k) ? v : v + (k < 2 ? ROOF_INSET : -ROOF_INSET)));
    const y = gr.y[1] + DUST_LIFT;
    snowy(kit.solid(lift, roofSnowM, rect, [y, y + ROOF_SNOW]), 'garage-snow');
  });
  const dustM = kit.surface('snow', { transparent: true, opacity: DUST_OPACITY, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  (siteApi.slabs ? siteApi.slabs() : []).forEach(({ outline, top }) => {
    const m = snowy(new THREE.Mesh(kit.flatShape(outline), dustM), 'dust');
    m.position.y = top + DUST_LIFT;
    m.renderOrder = 1;
    group.add(m);
  });
  (siteApi.hedges ? siteApi.hedges() : []).forEach(({ a: [xa, za], b: [xb, zb], height, width }) => {
    const m = snowy(new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(xb - xa, zb - za) + CAP_OUT, CAP, width + CAP_OUT), snowM), 'cap');
    m.position.set((xa + xb) / 2, height + CAP / 2 - 0.02, (za + zb) / 2);
    m.rotation.y = -Math.atan2(zb - za, xb - xa);
    group.add(m);
  });
  plants.forEach(({ pos, profile }) => {
    const from = profile[profile.length - 1][1] * TIP;
    const tip = [[radiusAt(profile, from), from], ...profile.filter(([, h]) => h > from)].map(([r, h]) => new THREE.Vector2(r && r + CAP_OUT / 2, h + 0.01));
    const m = snowy(new THREE.Mesh(new THREE.LatheGeometry(tip, 14), snowM), 'cap');
    m.position.set(...pos);
    group.add(m);
  });
  // the crown's upper third: a sphere cap down to a third of its height above the centre
  const dress = new THREE.Group();
  dress.userData.part = 'winter';
  const capGeo = new THREE.SphereGeometry(1, 18, 8, 0, 2 * Math.PI, 0, Math.acos(1 / 3));
  Object.values(treesApi.crowns ? treesApi.crowns() : {}).forEach(({ centre, radii }) => {
    const m = snowy(new THREE.Mesh(capGeo, snowM), 'cap');
    m.position.set(...centre);
    m.scale.set(...radii.map(v => v + CAP_OUT));
    dress.add(m);
  });
  if (treesApi.attach) treesApi.attach(dress);

  /* ---------- falling snow ---------- */
  let flakes = null, flakeM = null, fall = null, phase = null, t = 0;
  if (options.snowfall && !reduceMotion) {
    const rand = seeded(20261115), [x0, z0, x1, z1] = frame.lotBox;
    const box = [x0 - FLAKE_MARGIN, z0 - FLAKE_MARGIN, x1 + FLAKE_MARGIN, z1 + FLAKE_MARGIN];
    const pos = new Float32Array(FLAKES * 3);
    fall = new Float32Array(FLAKES);
    phase = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      pos.set([box[0] + rand() * (box[2] - box[0]), rand() * FLAKE_TOP, box[1] + rand() * (box[3] - box[1])], i * 3);
      fall[i] = FLAKE_FALL[0] + rand() * (FLAKE_FALL[1] - FLAKE_FALL[0]);
      phase[i] = rand() * 2 * Math.PI;
    }
    flakeM = kit.keep(new THREE.PointsMaterial({ color: 0xffffff, size: FLAKE_SIZE, map: ledSprite, transparent: true, opacity: 0.9, depthWrite: false }));
    flakes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), flakeM);
    flakes.userData.part = 'flakes';
    flakes.frustumCulled = false;
    group.add(flakes);
  }

  let on = true, glow = 0, shown = -1;
  // the lights as they are at glow g: by day small dim points, no halo and no wash
  const light = g => {
    const level = LED_DAY_LEVEL + (1 - LED_DAY_LEVEL) * g;
    ledMats.forEach(m => { m.size = LED_DAY + (LED_NIGHT - LED_DAY) * g; m.color.copy(ledColor).multiplyScalar(level); });
    haloMats.forEach(m => m.color.copy(ledColor).multiplyScalar(HALO_LEVEL * g));
    washMats.forEach(m => m.color.copy(washColor).multiplyScalar(WASH_LEVEL * g));
    if (flakeM) flakeM.color.setScalar(1 - (1 - FLAKE_NIGHT) * g);
  };
  light(0);
  return {
    id: 'winter',
    group,
    lift,
    toggle: true,
    // mount() calls it with the starting state before the first frame
    setOn(v) {
      on = !!v;
      dress.visible = on;
      if (ground.snow) ground.snow(on ? 1 : 0);
    },
    update(dt, k) {
      let moving = false;
      const goal = state.night || 0;
      if (kit.near(glow, goal)) glow = goal;
      else { glow += (goal - glow) * k; moving = true; }
      if (glow !== shown) { shown = glow; light(glow); }
      if (on && flakes) {
        t += dt;
        const p = flakes.geometry.attributes.position, a = p.array;
        for (let i = 0; i < FLAKES; i++) {
          let y = a[i * 3 + 1] - fall[i] * dt;
          if (y < 0) y += FLAKE_TOP;
          a[i * 3 + 1] = y;
          a[i * 3] += Math.sin(t * 0.8 + phase[i]) * FLAKE_SWAY * dt;
        }
        p.needsUpdate = true;
        moving = true;
      }
      return moving;
    }
  };
}
