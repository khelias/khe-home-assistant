// Everyday things in the yard (site.props): a wheelie bin, a mailbox on its post, a garden table
// with two chairs, a flower pot with the low planter's plant and a lamp post, each at [x, z]
// turned by rot degrees. The lit styles draw them as simple shapes, like the furniture inside,
// casting shadows, standing on a deck or paving under them; the simple style draws none. A lamp post's head glows at dusk through the
// lights layer, which asks for the heads through api.lamps().
// the shapes in metres, x across and z along a turn of 0
const BIN = { w: 0.58, d: 0.74, h: 1.0, lid: 0.05, wheel: 0.1 };
const MAILBOX = { post: 0.07, h: 1.05, box: [0.38, 0.3, 0.2] };
const TABLE = { r: 0.45, h: 0.73, top: 0.04, leg: 0.05, chair: [0.44, 0.45, 0.44], back: 0.42, gap: 0.62 };
const POT = { r: 0.24, h: 0.42, plant: 0.32 };
const LAMP_HEAD = 2.15; // the glowing head's underside
const LAMP = { pole: 0.045, head: [0.26, 0.14], cap: 0.03, foot: [0.1, 0.12] };

export default function build({ THREE, kit, model, look, layer }) {
  const props = (model.site || {}).props;
  if (!Array.isArray(props) || !props.length) return null;
  const group = new THREE.Group();
  if (!look.lit) return { id: 'props', group };
  const dark = kit.surface('anthracite'), lid = kit.surface('shell'), post = kit.surface('fence');
  const wood = look.material('timber'), pot = kit.surface('pot'), plant = kit.surface('hedge');
  const unit = () => new THREE.BoxGeometry(1, 1, 1), round = () => new THREE.CylinderGeometry(1, 1, 1, 24);
  const wheel = () => new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2);
  const potGeo = () => new THREE.CylinderGeometry(POT.r, POT.r * 0.78, POT.h, 24);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();

  // a part of an item: a new geo scaled by s and moved to [x, y, z] in the item's frame, kept by
  // material; the item's parts of one material become one mesh (draw), since props never move
  function part(parts, geo, mat, [x, y, z], s = [1, 1, 1]) {
    geo.applyMatrix4(m4.compose(v.set(x, y, z), q, sc.set(...s)));
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(geo);
  }
  const SHAPES = {
    bin(parts) {
      const { w, d, h, lid: t, wheel: r } = BIN;
      part(parts, unit(), dark, [0, r + (h - r - t) / 2, 0], [w, h - r - t, d]);
      part(parts, unit(), lid, [0, h - t / 2, 0.02], [w + 0.04, t, d + 0.06]);
      [-1, 1].forEach(s => part(parts, wheel(), lid, [(s * (w - 0.08)) / 2, r, -d / 2 + r], [0.06, r, r]));
    },
    mailbox(parts) {
      const { post: p, h, box: [bw, bh, bd] } = MAILBOX;
      part(parts, unit(), post, [0, h / 2, 0], [p, h, p]);
      part(parts, unit(), dark, [0, h + bh / 2, 0], [bw, bh, bd]);
    },
    garden_table(parts) {
      const { r, h, top, leg, chair: [cw, ch, cd], back, gap } = TABLE;
      part(parts, round(), wood, [0, h - top / 2, 0], [r, top, r]);
      part(parts, round(), wood, [0, (h - top) / 2, 0], [leg, h - top, leg]);
      [-1, 1].forEach(s => {
        const z = s * gap;
        part(parts, unit(), wood, [0, ch, z], [cw, 0.04, cd]);
        part(parts, unit(), wood, [0, ch + back / 2, z + (s * cd) / 2], [cw, back, 0.04]);
        [-1, 1].forEach(a => [-1, 1].forEach(b => part(parts, unit(), wood, [(a * (cw - leg)) / 2, ch / 2, z + (b * (cd - leg)) / 2], [leg * 0.7, ch, leg * 0.7])));
      });
    },
    pot(parts) {
      part(parts, potGeo(), pot, [0, POT.h / 2, 0]);
      part(parts, round(), plant, [0, POT.h + POT.plant / 2 - 0.04, 0], [POT.r * 0.85, POT.plant, POT.r * 0.85]);
    },
    lamp_post(parts) {
      const { pole, head: [hr, hh], cap, foot: [fr, fh] } = LAMP;
      part(parts, round(), dark, [0, fh / 2, 0], [fr, fh, fr]);
      part(parts, round(), dark, [0, LAMP_HEAD / 2, 0], [pole, LAMP_HEAD, pole]);
      part(parts, round(), dark, [0, LAMP_HEAD + hh + cap / 2, 0], [hr, cap, hr]);
    }
  };

  // what an item stands on: the top of a deck or paving under it (the site layer's slabs), else the ground
  const slabs = (layer('site') && layer('site').api && layer('site').api.slabs()) || [];
  const inside = ([x, z], ring) => {
    let at = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < xi + ((z - zi) * (xj - xi)) / (zj - zi)) at = !at;
    }
    return at;
  };
  const floorAt = at => Math.max(0, ...slabs.filter(s => inside(at, s.outline)).map(s => s.top));

  props.forEach(p => {
    const draw = SHAPES[p.kind];
    if (!draw || !Array.isArray(p.at)) return;
    const item = new THREE.Group(), parts = new Map();
    item.position.set(p.at[0], floorAt(p.at), p.at[1]);
    // turned the way a future item turns (future.js)
    item.rotation.y = (-(p.rot || 0) * Math.PI) / 180;
    item.userData.prop = p.id;
    item.userData.part = p.kind;
    draw(parts);
    parts.forEach((geos, mat) => {
      const m = new THREE.Mesh(kit.merge(geos), mat);
      m.castShadow = m.receiveShadow = true;
      item.add(m);
    });
    group.add(item);
  });
  return {
    id: 'props',
    group,
    // each lamp post's glowing head, for the lights layer: its foot's centre in the world, radius and height
    api: { lamps: () => props.filter(p => p.kind === 'lamp_post' && Array.isArray(p.at)).map(p => ({ kind: 'lamp', pos: [p.at[0], LAMP_HEAD, p.at[1]], r: LAMP.head[0], h: LAMP.head[1] })) }
  };
}
