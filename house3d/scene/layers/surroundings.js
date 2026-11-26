// The surroundings (private, HA only): the neighbours' buildings and the street, fainter than
// the lot and outside every tap test. In the lit styles they darken to SUR_NIGHT of their colour
// at night, so moonlit neighbours do not outshine the house.
//
// A lit style's neighbours are stand-ins, since the data has no roofs: a house-sized one
// (ROOF_MAX_H high at most, its smallest enclosing rectangle between ROOF_AREA m2) whose footprint
// fills ROOF_FILL of that rectangle
// gets a gable along that rectangle's long side, its ridge at the building's height, a rise of
// ROOF_PITCH capped at ROOF_RISE of the height and an overhang of EAVE; any other stays a block
// in the walls' colour, so the large ones do not outweigh the lot. Each building's walls and roof
// are a seeded shade darker by up to SHADE_SPREAD; the street is asphalt (kit.asphalt()).
const SUR_NIGHT = 0.45;
const ROOF_MAX_H = 9, ROOF_AREA = [4, 300], ROOF_FILL = 0.95, ROOF_PITCH = Math.tan(Math.PI / 6), ROOF_RISE = 0.4, EAVE = 0.3, SHADE_SPREAD = 0.1;
export default function build({ THREE, kit, C, options, look, state }) {
  const sur = options.surroundings;
  if (!sur) return null;
  const group = new THREE.Group();
  // the lit styles: plain lit surfaces that take the lot's shadows and cast none
  if (look.lit) {
    const bldM = kit.surface('neighbour', { vertexColors: true }), roofM = kit.surface('neighbourRoof', { vertexColors: true, side: THREE.DoubleSide });
    const roadM = look.material('road');
    const add = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    (sur.buildings || []).forEach((b, i) => {
      const rand = kit.seeded(`neighbour ${i}`), tone = 1 - SHADE_SPREAD * rand(), roofTone = 1 - SHADE_SPREAD * rand();
      const rect = b.height <= ROOF_MAX_H && boundingRect(b.outline);
      const gable = rect && rect.area >= ROOF_AREA[0] && rect.area <= ROOF_AREA[1] && area(b.outline) >= ROOF_FILL * rect.area ? rect : null;
      const rise = gable ? Math.min(gable.half[1] * ROOF_PITCH, b.height * ROOF_RISE) : 0;
      add(kit.shade(kit.prism(b.outline, 0, b.height - rise), () => tone), bldM);
      if (gable) {
        const { ends, roof } = gableRoof(gable, b.height - rise, b.height);
        add(kit.shade(ends, () => tone), bldM);
        add(kit.shade(roof, () => roofTone), roofM);
      }
    });
    (sur.roads || []).forEach(r => add(kit.flatShape(r.outline, r.holes || []), roadM).position.y = -0.01);
    const tint = kit.nightTint([bldM, roofM, roadM], SUR_NIGHT);
    return { id: 'surroundings', group, toggle: true, update() { tint(state.night); } };
  }
  const bldM = kit.basic({ color: C.wall, opacity: 0.05, side: THREE.DoubleSide });
  const bldE = kit.lineMat({ color: C.lineSoft, opacity: 0.3 });
  (sur.buildings || []).forEach(b => {
    const geo = kit.prism(b.outline, 0, b.height);
    const m = new THREE.Mesh(geo, bldM);
    m.add(kit.edges(geo, bldE));
    group.add(m);
  });
  const roadM = kit.basic({ color: C.gridMajor, opacity: 0.25, side: THREE.DoubleSide });
  const roadE = kit.lineMat({ color: C.lineSoft, opacity: 0.3 });
  (sur.roads || []).forEach(r => {
    const shape = new THREE.Shape(r.outline.map(([x, z]) => new THREE.Vector2(x, z)));
    (r.holes || []).forEach(h => shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z)))));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, roadM);
    m.position.y = 0.005;
    group.add(m);
    [r.outline, ...(r.holes || [])].forEach(ring => {
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring.map(([x, z]) => new THREE.Vector3(x, 0.005, z))), roadE));
    });
  });
  return { id: 'surroundings', group, toggle: true };

  // a ring's area, either winding
  function area(ring) {
    return Math.abs(THREE.ShapeUtils.area(ring.map(([x, z]) => new THREE.Vector2(x, z))));
  }

  // the smallest rectangle round a ring among those along one of its edges (the smallest
  // enclosing one for a convex ring): its centre, unit axis along its longer side, half sizes
  // [along, across] and area
  function boundingRect(ring) {
    let best = null;
    ring.forEach(([xa, za], k) => {
      const [xb, zb] = ring[(k + 1) % ring.length], len = Math.hypot(xb - xa, zb - za);
      if (len < 1e-6) return;
      const u = [(xb - xa) / len, (zb - za) / len], v = [-u[1], u[0]];
      const su = ring.map(([x, z]) => x * u[0] + z * u[1]), sv = ring.map(([x, z]) => x * v[0] + z * v[1]);
      const [u0, u1, v0, v1] = [Math.min(...su), Math.max(...su), Math.min(...sv), Math.max(...sv)], a = (u1 - u0) * (v1 - v0);
      if (best && best.area <= a) return;
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, long = u1 - u0 >= v1 - v0;
      best = {
        area: a,
        centre: [cu * u[0] + cv * v[0], cu * u[1] + cv * v[1]],
        axis: long ? u : v,
        half: long ? [(u1 - u0) / 2, (v1 - v0) / 2] : [(v1 - v0) / 2, (u1 - u0) / 2]
      };
    });
    return best;
  }

  // a gable over rect from the eaves at y0 to the ridge at y1: the two triangular end walls and
  // the two roof faces, which run EAVE past the walls on every side
  function gableRoof({ centre: [cx, cz], axis: [ux, uz], half: [a, b] }, y0, y1) {
    const at = (s, t, y) => [cx + s * ux - t * uz, y, cz + s * uz + t * ux];
    const drop = (EAVE * (y1 - y0)) / b;
    const tri = pts => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    // each end wall wound to face out along the axis: (-b, b, top) faces -axis
    const ends = tri([-1, 1].flatMap(e => (e < 0 ? [at(-a, -b, y0), at(-a, b, y0), at(-a, 0, y1)] : [at(a, b, y0), at(a, -b, y0), at(a, 0, y1)])));
    const roof = tri([-1, 1].flatMap(k => {
      const lo0 = at(-a - EAVE, k * (b + EAVE), y0 - drop), lo1 = at(a + EAVE, k * (b + EAVE), y0 - drop);
      const hi0 = at(-a - EAVE, 0, y1), hi1 = at(a + EAVE, 0, y1);
      // each face wound to face up and out: the k = -1 side runs the other way round
      return k > 0 ? [lo0, lo1, hi1, lo0, hi1, hi0] : [lo0, hi1, lo1, lo0, hi0, hi1];
    }));
    [ends, roof].forEach(g => g.computeVertexNormals());
    return { ends, roof };
  }
}
