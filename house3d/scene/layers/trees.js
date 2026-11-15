// Garden trees: a trunk and a crown sized from the tree's height and crown width.
const TRUNK = { apple: 0.3, birch: 0.4, maple: 0.3 };

export default function build({ THREE, kit, C, model, style }) {
  const trees = (model.site || {}).trees || [];
  if (!trees.length) return null;
  const group = new THREE.Group();
  // for the winter layer: per tree id, its crown's centre [x, y, z] and radii [x, y, z] as built,
  // and attach(), which hangs its snow on the trees so it hides with them
  const api = {
    crowns: () => Object.fromEntries(trees.map(({ id, kind, pos: [x, z], height, crown }) => {
      const top = height * (TRUNK[kind] || 0.3);
      return [id, { centre: [x, (top + height) / 2, z], radii: [crown / 2, (height - top) / 2, crown / 2] }];
    })),
    attach: obj => group.add(obj)
  };
  if (style === 'real') {
    const trunkM = kit.surface('trunk'), crownM = kit.surface('crown'), crownGeo = new THREE.IcosahedronGeometry(1, 1);
    trees.forEach(({ kind, pos: [x, z], height, crown }) => {
      const top = height * (TRUNK[kind] || 0.3), w = Math.min(Math.max(height * 0.025, 0.1), 0.35);
      const trunk = kit.solid(group, trunkM, [x - w / 2, z - w / 2, x + w / 2, z + w / 2], [0, top]);
      const m = new THREE.Mesh(crownGeo, crownM);
      m.position.set(x, (top + height) / 2, z);
      m.scale.set(crown / 2, (height - top) / 2, crown / 2);
      trunk.castShadow = m.castShadow = true;
      group.add(m);
    });
    return { id: 'trees', group, toggle: true, api };
  }
  const hedgeM = kit.basic({ color: C.hedge, opacity: 0.2 });
  const hedgeE = kit.lineMat({ color: C.teal, opacity: 0.28 });
  const trunkE = kit.lineMat({ color: C.lineSoft, opacity: 0.5 });
  // the size goes on scale, the outline comes from the unscaled shape: its 18-22.5 degree edges
  // all clear EdgesGeometry's 15 degree cut, a geometry squashed to a birch's shape loses some
  const crownGeo = new THREE.IcosahedronGeometry(1, 1), crownEdges = new THREE.EdgesGeometry(crownGeo, 15);
  trees.forEach(({ kind, pos: [x, z], height, crown }) => {
    const top = height * (TRUNK[kind] || 0.3), w = Math.min(Math.max(height * 0.025, 0.1), 0.35);
    kit.box(group, hedgeM, trunkE, [x - w / 2, z - w / 2, x + w / 2, z + w / 2], [0, top]);
    const m = new THREE.Mesh(crownGeo, hedgeM);
    m.position.set(x, (top + height) / 2, z);
    m.scale.set(crown / 2, (height - top) / 2, crown / 2);
    m.add(new THREE.LineSegments(crownEdges, hedgeE));
    group.add(m);
  });
  return { id: 'trees', group, toggle: true, api };
}
