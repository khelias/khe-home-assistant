// The surroundings (private, HA only): the neighbours' buildings and the street, fainter than
// the lot and outside every tap test. In the real style they darken to SUR_NIGHT of their colour
// at night, so moonlit neighbours do not outshine the house.
const SUR_NIGHT = 0.45;
export default function build({ THREE, kit, C, options, style, state }) {
  const sur = options.surroundings;
  if (!sur) return null;
  const group = new THREE.Group();
  // the real style: plain lit surfaces that take the lot's shadows and cast none
  if (style === 'real') {
    const bldM = kit.surface('neighbour'), roadM = kit.surface('road');
    (sur.buildings || []).forEach(b => {
      const m = new THREE.Mesh(kit.prism(b.outline, 0, b.height), bldM);
      m.receiveShadow = true;
      group.add(m);
    });
    (sur.roads || []).forEach(r => {
      const m = new THREE.Mesh(kit.flatShape(r.outline, r.holes || []), roadM);
      m.position.y = -0.01;
      m.receiveShadow = true;
      group.add(m);
    });
    const tint = kit.nightTint([bldM, roadM], SUR_NIGHT);
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
}
