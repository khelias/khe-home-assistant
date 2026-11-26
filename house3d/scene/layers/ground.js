// The ground: a soft glow under the lot and the metre grid. The lit styles lay a mottled lawn
// (kit.lawn()) over the lot and a plane round it (the look's 'outside', look.outsideScale times as
// wide, with metre UVs), both taking shadows, and no grid; the plane darkens to OUT_NIGHT of its
// colour with the night, so the lot stays the lit place. api.snow(amount), from the winter layer,
// blends both towards the snow's colour, 0 none to 1 all; the night's darkening works on top of
// it. A look that colours the plane itself, once its textures are in, sets its material's
// userData.look, which the snow and the night then work from.
const OUT_NIGHT = 0.22;
export default function build({ THREE, kit, C, frame, model, look, state }) {
  const { ext, lotCx, lotCz } = frame;
  const group = new THREE.Group();
  if (look.lit) {
    const lot = (model.site || {}).lot, [x0, z0, x1, z1] = frame.lotBox;
    const lawn = new THREE.Mesh(kit.flatShape(lot && lot.length >= 3 ? lot : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]), look.material('lawn'));
    // under the floors and paving by enough not to flicker at a distance
    lawn.position.y = -0.02;
    const size = ext * 8 * (look.outsideScale || 1), plane = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), uv = plane.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size, uv.getY(i) * size);
    const out = new THREE.Mesh(plane, look.material('outside'));
    out.position.set(lotCx, -0.1, lotCz);
    lawn.receiveShadow = out.receiveShadow = true;
    group.add(out, lawn);
    const tint = kit.nightTint([out.material], OUT_NIGHT), white = new THREE.Color(kit.REAL.snow);
    // the lawn's daytime colour lives on its material: a look may change it once its photograph is in
    lawn.material.userData.day = lawn.material.color.clone();
    const day = out.material.color.clone();
    let night = 0, snowed = 0, own;
    const paint = () => { tint.day[0].copy(own || day).lerp(white, snowed); tint(night); };
    return {
      id: 'ground', group,
      // a look's colour arriving with its textures repaints as a change of night would
      update() {
        if (night === state.night && own === out.material.userData.look) return;
        night = state.night;
        own = out.material.userData.look;
        paint();
      },
      api: {
        snow(amount) {
          const a = Math.min(1, Math.max(0, amount));
          lawn.material.color.copy(lawn.material.userData.day).lerp(white, a);
          if (look.snow) look.snow(a);
          snowed = a;
          paint();
        }
      }
    };
  }
  const tex = kit.canvasTexture(256, [[0, 'rgba(32,58,120,0.6)'], [0.45, 'rgba(16,30,68,0.4)'], [1, 'rgba(6,12,27,0)']]);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2.7, ext * 2.7), kit.basic({ map: tex }));
  pl.rotation.x = -Math.PI / 2;
  pl.position.set(lotCx, -0.02, lotCz);
  group.add(pl);
  const n = Math.round(ext * 2);
  const grid = new THREE.GridHelper(n, n, C.gridMajor, C.gridMinor);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  grid.position.set(Math.round(lotCx), -0.01, Math.round(lotCz));
  group.add(grid);
  return { id: 'ground', group };
}
