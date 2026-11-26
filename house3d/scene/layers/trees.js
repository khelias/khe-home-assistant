// Garden trees: a trunk and a crown sized from the tree's height and crown width. The lit styles
// draw the crown as a clump of soft lobes in one mesh, centred and scaled like the crowns() api's
// ellipsoid: every lobe inside its unit sphere and together filling its upper third, so the winter
// layer's cap rests on them. A kind gives the clump its habit (KINDS), the tree's id varies it the
// same way on every mount, and vertex shades darken the underside and the inner lobes. The trunk
// tapers into the crown, a birch's in white bark, and an apple's or maple's forks into its kind's
// branches.
const TRUNK = { apple: 0.3, birch: 0.4, maple: 0.3 };
// per kind: the lobes' rings as [count, height in the unit sphere, distance out, radius], from the
// top down; jitter, the share each lobe's place and size may vary
const KINDS = {
  maple: { rings: [[1, 0.4, 0, 0.6], [5, 0.15, 0.42, 0.52], [4, -0.3, 0.35, 0.54]], jitter: 0.08, branches: 3 },
  apple: { rings: [[1, 0.36, 0, 0.62], [6, 0.1, 0.46, 0.5], [3, -0.38, 0.3, 0.5]], jitter: 0.1, branches: 3 },
  birch: { rings: [[1, 0.55, 0, 0.44], [4, 0.3, 0.5, 0.4], [4, -0.12, 0.52, 0.42], [3, -0.55, 0.38, 0.38]], jitter: 0.16, branches: 0 }
};
const LOBE_DETAIL = 2, SHADE_LOW = 0.72, SHADE_INNER = 0.9, TRUNK_SIDES = 8, BODY_LIGHT = 0.6;

export default function build({ THREE, kit, C, model, look }) {
  const trees = (model.site || {}).trees || [];
  if (!trees.length) return null;
  const group = new THREE.Group();
  // for the winter layer: per tree id, its crown's centre [x, y, z] and radii [x, y, z] as built,
  // in the lit styles its lobes as [x, y, z, r] in the crown's unit sphere, and attach(), which
  // hangs its snow on the trees so it hides with them
  // lit styles: per tree its seeded sequence and lobes, drawn once for the crown and the api
  const lobed = look.lit ? Object.fromEntries(trees.map(({ id, kind }) => {
    const rand = kit.seeded(id);
    return [id, { rand, lobes: lobesOf(KINDS[kind] || KINDS.maple, rand) }];
  })) : {};
  const api = {
    crowns: () => Object.fromEntries(trees.map(({ id, kind, pos: [x, z], height, crown }) => {
      const top = height * (TRUNK[kind] || 0.3), at = { centre: [x, (top + height) / 2, z], radii: [crown / 2, (height - top) / 2, crown / 2] };
      if (lobed[id]) at.lobes = lobed[id].lobes.map(([c, r]) => [c.x, c.y, c.z, r]);
      return [id, at];
    })),
    attach: obj => group.add(obj),
    // winter in a look that strips them: the crowns and their dress hidden, trunks and branches kept
    bare(on) {
      group.traverse(o => {
        if (o.userData.part === 'crown') o.visible = !on;
        if (o.userData.part === 'cards') o.visible = !on && !!o.userData.ready;
      });
    }
  };
  if (look.lit) {
    const trunkM = kit.surface('trunk'), barkM = kit.surface('bark'), crownM = kit.surface('crown', { vertexColors: true });
    trees.forEach(({ id, kind, pos: [x, z], height, crown }) => {
      const top = height * (TRUNK[kind] || 0.3), w = Math.min(Math.max(height * 0.025, 0.1), 0.35);
      const habit = KINDS[kind] || KINDS.maple, { rand, lobes } = lobed[id], centreY = (top + height) / 2, ry = (height - top) / 2;
      const m = new THREE.Mesh(clump(lobes, rand), crownM);
      m.position.set(x, centreY, z);
      m.scale.set(crown / 2, ry, crown / 2);
      m.castShadow = true;
      m.userData.part = 'crown';
      group.add(m);
      if (look.crown) look.crown({ group, mesh: m, material: crownM, lobes, rand: kit.seeded(`cards ${id}`), centre: [x, centreY, z], radii: [crown / 2, ry], crown });
      // the trunk runs a third of the way up into the crown, a birch's to its middle
      const birch = kind === 'birch', end = birch ? centreY : top + ry / 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.55, end, TRUNK_SIDES), birch ? barkM : trunkM);
      trunk.position.set(x, end / 2, z);
      trunk.castShadow = true;
      trunk.userData.part = 'trunk';
      group.add(trunk);
      const turn = rand() * 2 * Math.PI;
      for (let i = 0; i < habit.branches; i++) {
        const a = turn + (i * 2 * Math.PI) / habit.branches, r = (crown / 2) * 0.45;
        const limb = kit.strut(group, [x, top, z], [x + r * Math.cos(a), top + ry * 0.75, z + r * Math.sin(a)], w * 0.35, w * 0.35, trunkM, 'branch');
        limb.castShadow = true;
      }
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
  // lit styles: a kind's lobes in the crown's unit sphere, [centre, radius] each, drawn from rand
  // (a tree's seeded sequence, which clump() and the branches then go on drawing from)
  function lobesOf({ rings, jitter }, rand) {
    const turn = rand() * 2 * Math.PI, lobes = [], v = () => 1 + jitter * (2 * rand() - 1);
    rings.forEach(([n, y, d, r], k) => {
      for (let i = 0; i < n; i++) {
        const a = turn + k + (i * 2 * Math.PI) / n + jitter * (rand() - 0.5);
        const c = new THREE.Vector3(d * v() * Math.cos(a), y + jitter * (rand() - 0.5) * 0.5, d * v() * Math.sin(a));
        // shrunk where it would reach past the unit sphere
        lobes.push([c, Math.min(r * v(), 1 - c.length())]);
      }
    });
    return lobes;
  }

  // lit styles: the lobes as one geometry, the shades in a colour attribute
  function clump(lobes, rand) {
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    return kit.merge(lobes.map(([c, r]) => {
      const g = new THREE.IcosahedronGeometry(r, LOBE_DETAIL), p = g.attributes.position, nrm = g.attributes.normal;
      const tint = 0.94 + 0.06 * rand();
      g.translate(c.x, c.y, c.z);
      // the light falls on the crown as one body: each normal leans from its lobe's towards the
      // clump's, so the lobes show in the outline more than in the shading
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        n.copy(v).sub(c).divideScalar(r).multiplyScalar(1 - BODY_LIGHT).addScaledVector(v.normalize(), BODY_LIGHT).normalize();
        nrm.setXYZ(k, n.x, n.y, n.z);
      }
      g.deleteAttribute('uv');
      // darker underneath, and darker where a vertex lies deep inside the clump
      return kit.shade(g, (px, py, pz) => {
        const under = SHADE_LOW + (1 - SHADE_LOW) * Math.min(1, Math.max(0, (py + 1) / 1.6));
        const inner = SHADE_INNER + (1 - SHADE_INNER) * Math.min(1, Math.hypot(px, py, pz) / 0.9);
        return tint * under * inner;
      });
    }));
  }
}
