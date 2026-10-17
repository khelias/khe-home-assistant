// The outdoor luminaires (site.lights), a view effect of the dark: in the real style each is a
// small anthracite fixture, a flat disc under a ceiling or a box on a wall set out along its
// face, that glows warm with a halo sprite and an additive pool of light on the ground, all
// scaled by ctx.state.night and eased like a room's glow. They follow no HA entity. There are no
// real-time lights. The simple style has no night, so there the layer is an empty group.
const DISC_R = 0.12, DISC_H = 0.03; // a ceiling light
const BOX = [0.12, 0.18, 0.1]; // a wall light: width, height, depth out from the wall
const HALO = 0.9; // the halo sprite's size in metres
const POOL_Y = 0.14; // over the decks (0.12) and the step (0.115), so it shows on them
// a pool's diameter: a ceiling light's is centred under it, so it stays small, since a porch soffit
// hangs close to the house and a larger pool would show on the floors inside with the roof off
const POOL = 3;
const WARM = '#ffcf8a', FIXTURE_GLOW = 2.2, HALO_OPACITY = 0.75, POOL_OPACITY = 0.85;

export default function build({ THREE, kit, model, state, style }) {
  const lights = (model.site || {}).lights;
  if (!Array.isArray(lights) || !lights.length) return null;
  const group = new THREE.Group();
  if (style !== 'real') return { id: 'lights', group };

  const fixture = kit.surface('frame', { emissive: new THREE.Color(WARM), emissiveIntensity: 0 });
  const halo = kit.keep(new THREE.SpriteMaterial({
    map: kit.canvasTexture(64, [[0, 'rgba(255,226,170,1)'], [0.3, 'rgba(255,205,130,0.45)'], [1, 'rgba(255,185,95,0)']]),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  const pool = kit.basic({
    map: kit.canvasTexture(128, [[0, 'rgba(255,205,135,1)'], [0.45, 'rgba(255,190,110,0.4)'], [1, 'rgba(255,180,90,0)']]),
    opacity: 0, blending: THREE.AdditiveBlending
  });
  // one geometry per shape, shared by every light
  const boxGeo = new THREE.BoxGeometry(...BOX), discGeo = new THREE.CylinderGeometry(DISC_R, DISC_R, DISC_H, 20), poolGeo = new THREE.PlaneGeometry(POOL, POOL);
  const glows = [];
  const tag = (o, part) => { o.userData.part = part; o.castShadow = o.receiveShadow = false; group.add(o); return o; };

  lights.forEach(l => {
    const [x, y, z] = l.pos;
    let at, ground;
    if (l.kind === 'wall') {
      const n = Math.hypot(l.face[0], l.face[1]), dx = l.face[0] / n, dz = l.face[1] / n;
      const box = tag(new THREE.Mesh(boxGeo, fixture), 'fixture');
      box.position.set(x + (dx * BOX[2]) / 2, y, z + (dz * BOX[2]) / 2);
      box.rotation.y = Math.atan2(dx, dz);
      at = [x + dx * BOX[2] * 1.5, y, z + dz * BOX[2] * 1.5];
      // the pool's edge reaches back to the wall, so none of it lies indoors
      ground = [x + (dx * POOL) / 2, z + (dz * POOL) / 2];
    } else {
      const disc = tag(new THREE.Mesh(discGeo, fixture), 'fixture');
      disc.position.set(x, y - DISC_H / 2, z);
      at = [x, y - DISC_H - 0.05, z];
      ground = [x, z];
    }
    const sp = tag(new THREE.Sprite(halo), 'halo');
    sp.position.set(...at);
    sp.scale.set(HALO, HALO, 1);
    const p = tag(new THREE.Mesh(poolGeo, pool), 'pool');
    p.rotation.x = -Math.PI / 2;
    p.position.set(ground[0], POOL_Y, ground[1]);
    p.renderOrder = 2;
    glows.push(sp, p);
  });

  let glow = 0;
  return {
    id: 'lights',
    group,
    update(dt, k) {
      const goal = state.night || 0;
      let moving = false;
      if (kit.near(glow, goal)) glow = goal;
      else { glow += (goal - glow) * k; moving = true; }
      fixture.emissiveIntensity = glow * FIXTURE_GLOW;
      halo.opacity = glow * HALO_OPACITY;
      pool.opacity = glow * POOL_OPACITY;
      // by day the halos and pools are not drawn at all
      glows.forEach(o => { o.visible = glow > 0; });
      return moving;
    }
  };
}
