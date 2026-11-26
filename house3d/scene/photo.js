// The Foto style's look (style 'photo', scene/look.js): Päris's surfaces and light, with a
// photographed lawn, street and sky, and leaf cards on the crowns and hedges. Its textures are
// house3d/assets/ (CC0, sources.json there), loaded after the first frame through start(); until
// they are in, it draws as Päris, the cards hidden, but for the winter: the deciduous crowns go
// bare (bare) from the start.
// The light tier (quality 'low') halves the cards and drops the normal maps and the contact
// shadows (ao false).
//
// The skies are HDR equirectangular panoramas with their sun at sunU across the image (measured
// from the .hdr before encoding), turned so it stands at the model's sun; horizon is the band
// just above their middle row, for the fog. Below duskAlt the dusk sky takes over, and the sky,
// the environment and the fog dim with daylight(alt), the dusk sky with its square.
const SKIES = {
  day: { file: 'sky-day.ktx2', sunU: 0.5952, horizon: [0.4401, 0.4915, 0.6286] },
  dusk: { file: 'sky-dusk.ktx2', sunU: 0.605, horizon: [3.2402, 2.3875, 1.9252] }
};
const DUSK_ALT = 8, SKY = 0.75, ENV = 0.45, HEMI = 0.15;
// the surfaces' photographs, tiled at metres per repeat; the lawn keeps Päris's mottle over its
// photograph at a third of the scale, so the tiling does not show
const SURFACES = {
  lawn: { map: 'lawn.ktx2', normal: 'lawn-normal.ktx2', repeat: 0.5, roughness: 1 },
  road: { map: 'road.ktx2', normal: 'road-normal.ktx2', rough: 'road-rough.ktx2', repeat: 0.33 }
};
const NORMAL = 0.6, MOTTLE = 3;
// above this much snow the lawn drops its photograph and shows the snow's colour alone
const SNOW_BARE = 0.4;
// leaf cards: per m² of a crown's ellipsoid or a hedge's sides and top, their size in metres, the
// leaves' tint and what the body under the cards darkens to (and a crown's shrink, so the cards
// stand proud of it)
const CARDS = 22, CARD = 1.0, HEDGE_CARDS = 28, HEDGE_CARD = 0.55;
const CARD_TEX = { twig: 'twig.ktx2', hedge: 'hedge-twig.ktx2' };
const LEAF = '#738e5c', CROWN_UNDER = '#2f3d26', HEDGE_UNDER = '#26331f', CROWN_SHRINK = 0.9;
const TILT = 1.2, PLACE = [0.75, 1.05], GROW = [0.75, 1.25], TINT = [0.85, 1.05];
const CROWN_SHADE = [0.55, 1], HEDGE_SHADE = [0.5, 1];

export const daylight = alt => Math.min(1, Math.max(0.06, (alt + 6) / 14));

// cardCount(perM2, area, low) -> how many leaf cards an area in m² gets, half in the light tier
export const cardCount = (perM2, area, low) => Math.round(perM2 * area * (low ? 0.5 : 1));

export function photoLook(THREE, kit, real, { quality } = {}) {
  const low = quality === 'low';
  const surfaces = [], dressings = [], hedges = [], cardMats = {}, sky = { tex: {}, targets: {}, at: null };
  let winter = false;
  let loaded = false, snow = 0, plane = null;
  const white = new THREE.Color('#ffffff');

  // three's shadow pass gives an alpha-to-coverage material a depth material with its map and
  // an alphaTest of 0.5, so the cards' shadows are leaf-shaped without one of their own
  const cardMaterial = name => (cardMats[name] ||= kit.keep(new THREE.MeshStandardMaterial({ alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: LEAF, roughness: 0.85 })));
  // k drawn from weights w (their sum total) by rand
  const pick = (w, total, rand) => {
    let t = rand() * total, k = 0;
    while (k < w.length - 1 && (t -= w[k]) > 0) k++;
    return k;
  };
  // n cards of size s in group, at(p, nrm) setting each one's position and outward normal, shaded
  // by shade(p)
  function leafCards(group, name, n, s, at, shade, rand) {
    plane ||= kit.keep(new THREE.PlaneGeometry(1, 1));
    const mesh = new THREE.InstancedMesh(plane, cardMaterial(name), Math.max(n, 1));
    mesh.count = n;
    const q = new THREE.Quaternion(), roll = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3();
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      at(p, nrm);
      d.set(nrm.x + (rand() - 0.5) * TILT, nrm.y + (rand() - 0.5) * TILT, nrm.z + (rand() - 0.5) * TILT).normalize();
      q.setFromUnitVectors(z, d);
      q.premultiply(roll.setFromAxisAngle(d, rand() * 2 * Math.PI));
      const k = s * (GROW[0] + (GROW[1] - GROW[0]) * rand());
      mesh.setMatrixAt(i, m4.compose(p, q, sc.set(k, k, k)));
      mesh.setColorAt(i, col.setScalar(shade(p) * (TINT[0] + (TINT[1] - TINT[0]) * rand())));
    }
    mesh.castShadow = true;
    mesh.userData.part = 'cards';
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }
  const lerp = ([a, b], t) => a + (b - a) * t;
  const up = (y, y0, h, range) => lerp(range, Math.min(1, Math.max(0, (y - y0) / h)));

  function dressHedge({ material, cards, own }) {
    const shown = !!cards.userData.ready && !winter;
    cards.visible = shown;
    material.color.copy(shown ? new THREE.Color(HEDGE_UNDER) : own);
  }
  const look = {
    ...real,
    id: 'photo',
    ao: low ? false : undefined,
    bare: true,
    // winter, from the winter layer: a hedge sheds its cards and takes its own colour back, so
    // the snow's cap shows on it
    winter(on) {
      winter = on;
      hedges.forEach(dressHedge);
    },
    material(role, o) {
      const m = real.material(role, o);
      if (SURFACES[role]) surfaces.push([role, m]);
      return m;
    },
    // the hemisphere's share of the sky light: the photographed sky lights the surfaces through
    // the environment instead
    light(alt) {
      const L = real.light(alt);
      return loaded ? { ...L, hemi: { ...L.hemi, intensity: L.hemi.intensity * HEMI } } : L;
    },
    // a tree's crown { group, mesh, material, lobes: [[centre, r]], rand, centre, radii: [a, b], crown }
    crown({ group, mesh, material, lobes, rand, centre: [x, cy, z], radii: [a, b], crown }) {
      const area = 4 * Math.PI * ((a * a + 2 * a * b) / 3), w = lobes.map(([, r]) => r * r), total = w.reduce((s, v) => s + v, 0);
      const u = new THREE.Vector3();
      const cards = leafCards(group, 'twig', cardCount(CARDS, area, low), CARD * Math.min(1, crown / 4), (p, nrm) => {
        const [c, r] = lobes[pick(w, total, rand)];
        u.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        nrm.copy(c).addScaledVector(u, r * lerp(PLACE, rand()));
        p.set(x + nrm.x * a, cy + nrm.y * b, z + nrm.z * a);
        nrm.normalize();
      }, p => up(p.y, cy - b, 2 * b, CROWN_SHADE), rand);
      dressings.push(() => {
        material.color.set(CROWN_UNDER);
        mesh.scale.multiplyScalar(CROWN_SHRINK);
        cards.userData.ready = true;
        // a crown already bare (winter) keeps its cards hidden
        cards.visible = mesh.visible;
      });
      return cards;
    },
    // a hedge { group, mesh, material, length, height, width, rand }, the mesh placed
    hedge({ group, mesh, material, length: L, height: H, width: W, rand }) {
      mesh.updateMatrix();
      const faces = [L * H, L * H, L * W], total = faces.reduce((s, f) => s + f, 0);
      const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
      const cards = leafCards(group, 'hedge', cardCount(HEDGE_CARDS, total, low), HEDGE_CARD, (p, nrm) => {
        const k = pick(faces, total, rand), along = (rand() - 0.5) * L;
        if (k < 2) {
          const s = k ? 1 : -1;
          p.set(along, (rand() - 0.5) * H, s * (W / 2 - 0.02));
          nrm.set(0, 0, s);
        } else {
          p.set(along, H / 2 - 0.05, (rand() - 0.5) * W * 0.9);
          nrm.set(0, 1, 0);
        }
        p.applyMatrix4(mesh.matrix);
        nrm.applyMatrix3(nm).normalize();
      }, p => up(p.y, 0, H, HEDGE_SHADE), rand);
      const own = material.color.clone(), hedge = { material, cards, own };
      hedges.push(hedge);
      dressings.push(() => { cards.userData.ready = true; dressHedge(hedge); });
      return cards;
    },
    // the ground's snow over the lawn, 0 to 1
    snow(amount) {
      snow = amount;
      surfaces.forEach(([role, m]) => {
        const tex = m.userData.photo;
        if (role !== 'lawn' || !tex) return;
        const want = amount > SNOW_BARE ? null : tex.map;
        if (m.map === want) return;
        m.map = want;
        m.normalMap = want && tex.normal;
        m.roughness = want ? SURFACES.lawn.roughness : tex.roughness;
        m.needsUpdate = true;
      });
    },
    // the photographed sky at the sun's altitude and direction; false until it is loaded
    sky({ alt, dir, scene, pmrem }) {
      if (!loaded) return false;
      const s = alt < DUSK_ALT ? SKIES.dusk : SKIES.day, tex = sky.tex[s.file];
      if (sky.at !== s) {
        // each sky's environment is made once, so the hour slider can cross the dusk freely
        sky.at = s;
        scene.background = tex;
        scene.environment = (sky.targets[s.file] ||= pmrem.fromEquirectangular(tex)).texture;
      }
      // three samples the panorama at transpose(R_y(th)) * direction, an azimuth atan2(z, x) + th,
      // and equirectUv() puts azimuth (u - 0.5) * 2 pi at u: so the panorama's sun stands at ours
      const th = (s.sunU - 0.5) * 2 * Math.PI - Math.atan2(dir[2], dir[0]);
      scene.backgroundRotation.set(0, th, 0);
      scene.environmentRotation.set(0, th, 0);
      const day = daylight(alt), dim = s === SKIES.dusk ? day * day : day;
      scene.backgroundIntensity = SKY * dim;
      scene.environmentIntensity = ENV * dim;
      scene.fog.color.setRGB(...s.horizon).multiplyScalar(SKY * dim);
      return true;
    },
    // after the first frame: load(file) -> Promise<texture>; done() once applied
    start({ load, done }) {
      const files = [...new Set([
        ...Object.values(SKIES).map(s => s.file),
        ...Object.values(SURFACES).flatMap(s => [s.map, s.rough, !low && s.normal]).filter(Boolean),
        ...Object.values(CARD_TEX)
      ])];
      return Promise.all(files.map(f => load(f).then(t => [f, kit.keep(t)]))).then(list => {
        const tex = (sky.tex = Object.fromEntries(list));
        Object.values(SKIES).forEach(s => { tex[s.file].mapping = THREE.EquirectangularReflectionMapping; });
        Object.values(SURFACES).forEach(s => [s.map, s.normal, s.rough].filter(f => tex[f]).forEach(f => {
          tex[f].wrapS = tex[f].wrapT = THREE.RepeatWrapping;
          tex[f].repeat.set(s.repeat, s.repeat);
          tex[f].anisotropy = 8;
        }));
        surfaces.forEach(([role, m]) => {
          const s = SURFACES[role], mottle = m.map;
          m.userData.photo = { map: tex[s.map], normal: tex[s.normal] || null, roughness: m.roughness };
          m.map = tex[s.map];
          m.normalMap = tex[s.normal] || null;
          m.normalScale.set(NORMAL, NORMAL);
          if (s.rough) m.roughnessMap = tex[s.rough];
          if (s.roughness) m.roughness = s.roughness;
          // a snowed lawn keeps the snow's colour; ground's snow() takes the new day colour from userData
          if (role !== 'lawn' || !snow) m.color.copy(white);
          m.userData.day = white.clone();
          if (role === 'lawn' && mottle) {
            m.onBeforeCompile = sh => {
              sh.uniforms.uMottle = { value: mottle };
              sh.fragmentShader = 'uniform sampler2D uMottle;\n' + sh.fragmentShader.replace('#include <map_fragment>',
                `#include <map_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb *= texture2D(uMottle, vMapUv / ${MOTTLE.toFixed(1)}).rgb;\n#endif`);
            };
            m.customProgramCacheKey = () => 'photo-lawn';
          }
          m.needsUpdate = true;
        });
        look.snow(snow);
        Object.entries(CARD_TEX).forEach(([name, f]) => {
          if (!cardMats[name]) return;
          cardMats[name].map = tex[f];
          cardMats[name].needsUpdate = true;
        });
        loaded = true;
        dressings.forEach(f => f());
        done();
      });
    },
    dispose() { Object.values(sky.targets).forEach(t => t.dispose()); }
  };
  return look;
}
