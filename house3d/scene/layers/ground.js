// The ground: a soft glow under the lot and the metre grid. The lit styles lay a mottled lawn
// (kit.lawn()) over the lot and a plane round it (the look's 'outside', look.outsideScale times as
// wide, with metre UVs), both taking shadows, and no grid; the plane darkens to OUT_NIGHT of its
// colour with the night, so the lot stays the lit place. api.snow(amount), from the winter layer,
// blends both towards the snow's colour, 0 none to 1 all; the night's darkening works on top of
// it. A look that colours the plane itself, once its textures are in, sets its material's
// userData.look, which the snow and the night then work from. Every surface leaves the pit of the
// storeys below the ground open (ctx.pit), so the basement shows from above.
const OUT_NIGHT = 0.22;
export default function build({ THREE, kit, C, frame, model, look, state, pit = [] }) {
  const { ext, lotCx, lotCz } = frame;
  const group = new THREE.Group();
  // a square of side size round the lot's centre with the pit open, its UVs the shape's own metres
  // or, with unit, 0 to 1 across it
  const square = (size, unit) => {
    const h = size / 2, x0 = lotCx - h, z0 = lotCz - h;
    const geo = kit.flatShape([[x0, z0], [x0 + size, z0], [x0 + size, z0 + size], [x0, z0 + size]], pit);
    if (unit) { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - x0) / size, 1 - (p.getZ(i) - z0) / size); }
    return geo;
  };
  if (look.lit) {
    const lot = (model.site || {}).lot, [x0, z0, x1, z1] = frame.lotBox;
    const lawn = new THREE.Mesh(kit.flatShape(lot && lot.length >= 3 ? lot : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], pit), look.material('lawn'));
    // under the floors and paving by enough not to flicker at a distance
    lawn.position.y = -0.02;
    const size = ext * 8 * (look.outsideScale || 1);
    let out;
    if (pit.length) {
      out = new THREE.Mesh(square(size), look.material('outside'));
      out.position.y = -0.1;
    } else {
      const plane = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), uv = plane.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size, uv.getY(i) * size);
      out = new THREE.Mesh(plane, look.material('outside'));
      out.position.set(lotCx, -0.1, lotCz);
    }
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
  let pl;
  if (pit.length) {
    pl = new THREE.Mesh(square(ext * 2.7, true), kit.basic({ map: tex }));
    pl.position.y = -0.02;
  } else {
    pl = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2.7, ext * 2.7), kit.basic({ map: tex }));
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(lotCx, -0.02, lotCz);
  }
  group.add(pl);
  const n = Math.round(ext * 2);
  const grid = new THREE.GridHelper(n, n, C.gridMajor, C.gridMinor);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  grid.position.set(Math.round(lotCx), -0.01, Math.round(lotCz));
  if (pit.length) openGrid(grid);
  group.add(grid);
  return { id: 'ground', group };

  // the grid's lines, each along x or z, keep only their stretches outside the pit: where a line
  // crosses the pit's edges across it, by parity
  function openGrid(grid) {
    const p = grid.geometry.attributes.position, col = grid.geometry.attributes.color, ox = grid.position.x, oz = grid.position.z;
    const edges = pit.flatMap(loop => loop.map((a, i) => [a, loop[(i + 1) % loop.length]]));
    const pos = [], cols = [];
    for (let i = 0; i < p.count; i += 2) {
      const a = [p.getX(i) + ox, p.getZ(i) + oz], b = [p.getX(i + 1) + ox, p.getZ(i + 1) + oz];
      const ax = a[1] === b[1] ? 0 : 1, c = a[1 - ax], lo = Math.min(a[ax], b[ax]), hi = Math.max(a[ax], b[ax]);
      const cuts = edges.filter(([e, f]) => e[ax] === f[ax] && Math.min(e[1 - ax], f[1 - ax]) <= c && c < Math.max(e[1 - ax], f[1 - ax])).map(([e]) => e[ax]).sort((u, v) => u - v);
      const stops = [lo, ...cuts.map(u => Math.min(hi, Math.max(lo, u))), hi];
      for (let k = 0; k < stops.length - 1; k += 2) {
        if (stops[k + 1] - stops[k] < 1e-6) continue;
        [stops[k], stops[k + 1]].forEach(u => pos.push(ax ? c - ox : u - ox, 0, ax ? u - oz : c - oz));
        cols.push(col.getX(i), col.getY(i), col.getZ(i), col.getX(i), col.getY(i), col.getZ(i));
      }
    }
    grid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    grid.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
}
