// The Foto style's look (style 'photo', scene/look.js): Päris's surfaces and light, with a
// photographed lawn, meadow, street, paving and sky, the house's cladding, roofs, plinth,
// chimneys, deck and timber and the rooms' oak, fabric, tiles and worktops under a photographed
// grain (DETAILS), a lacquered car (carPaint), leaf cards on the crowns and
// hedges, models in place of the yard things' and plants' shapes (MODELS), and in winter bare
// crowns of branches and twig cards under an overcast sky. Its textures and models are
// house3d/assets/ (CC0, sources.json there), loaded after the first frame through start(), the
// ground, sky and cards first, the house's photographs after them and the models last; until they
// are in, it draws as Päris, the cards hidden, but for the winter: the deciduous crowns go bare
// (bare) from the start, their branches drawn at once.
// The light tier (quality 'low') keeps fewer and larger leaf cards, half the twig cards, one
// level of branches less, and drops the normal maps and the contact shadows (ao false).
//
// The skies are HDR equirectangular panoramas with their sun at sunU across the image (measured
// from the .hdr before encoding), turned so it stands at the model's sun; horizon is the median of
// the band 0 to 3 degrees above their middle row, for the fog. Below duskAlt (WINTER_DUSK in
// winter) the dusk sky takes over, and the sky, the environment and the fog dim with daylight(alt),
// the dusk sky with its square. Below the horizon a "puresky" holds a smeared mirror of itself in
// place of the land, which the fog does not reach: a backdrop shell round the camera covers it
// with a haze, the panorama at clean radians up (read off each sky in the viewer) blurred over
// HAZE_WIDTH radians of azimuth, and the meadow past the lot fogs into the same haze, so the
// ground fades into the sky.
const SKIES = {
  day: { file: 'sky-day.ktx2', sunU: 0.5952, horizon: [0.3301, 0.3496, 0.4277], clean: 0.06 },
  dusk: { file: 'sky-dusk.ktx2', sunU: 0.605, horizon: [0.5938, 0.5664, 0.668], clean: 0.06 },
  winter: { file: 'sky-winter.ktx2', sunU: 0.6206, horizon: [0.5352, 0.5391, 0.5352], clean: 0.06 }
};
const DUSK_ALT = 8, WINTER_DUSK = 0, SKY = 0.75, ENV = 0.45, HEMI = 0.15, HAZE_TAPS = 9, HAZE_WIDTH = 0.5, BACKDROP = 0.9, BACKDROP_TOP = 0.1, MEADOW_FOG = 0.8;
// in winter the overcast sky: a softer sun, more of the sky's light
const WINTER_KEY = 0.55, WINTER_ENV = 0.7, WINTER_HEMI = 0.3;
// the surfaces' photographs, tiled at metres per repeat; mottle is the scale, in repeats, of
// Päris's lawn mottle kept over the lawn's and the meadow's photograph, so the tiling does not
// show; tint the colour over the photograph, mean the photograph's mean linear colour, which the
// shader divides out so the model's own colour stays the average (the paving, AGENTS.md rule 2)
const SURFACES = {
  lawn: { map: 'lawn.ktx2', normal: 'lawn-normal.ktx2', repeat: 0.5, roughness: 1, mottle: 3 },
  outside: { map: 'lawn.ktx2', repeat: 0.125, roughness: 1, mottle: 12, tint: '#c9c29a' },
  road: { map: 'road.ktx2', normal: 'road-normal.ktx2', rough: 'road-rough.ktx2', repeat: 0.33 },
  paving: { map: 'paving.ktx2', normal: 'paving-normal.ktx2', repeat: 0.5, mean: [0.2527, 0.2535, 0.2303] }
};
const NORMAL = 0.6;
// the house's detail photographs, by role (look.material's, kept in material.userData.role) and,
// for the cladding and a roof, its pattern ('plain' for a roof without Päris's map): grain only,
// never boards, seams or joints of their own, multiplied over Päris's surface and its map. size is
// one repeat in metres [along the grain, across], mean the photograph's mean linear colour, which
// the shader divides out so the model's colour stays the average (the paving's rule), strength how
// much of its variation shows (1 all of it), grain the grain's angle in degrees from the face's
// level line ('look' the cladding's boards), normal its normal map, high tier only. Sampled in
// world space on the face's own plane: its level line and the line of steepest rise, so a wall's
// grain follows its boards and a roof's runs down its slope, on any UVs or none.
const WOOD = { map: 'wood.ktx2', size: [0.8, 0.8], mean: [0.202, 0.1273, 0.0769] };
const CONCRETE = { map: 'concrete.ktx2', size: [1.1, 0.55], mean: [0.4818, 0.4818, 0.4818] };
const OAK = { map: 'oak.ktx2', size: [0.8, 0.8], mean: [0.4342, 0.1721, 0.0506], strength: 0.6 };
const STONE = { ...CONCRETE, strength: 0.5 };
const FABRIC = { map: 'fabric.ktx2', size: [0.3, 0.3], mean: [0.0768, 0.0768, 0.0768], strength: 0.5 };
const METAL = { map: 'metal.ktx2', normal: 'metal-normal.ktx2', size: [1, 1], mean: [0.6716, 0.7233, 0.7831], grain: 90, strength: 0.6 };
export const DETAILS = {
  'cladding-boards': { ...WOOD, normal: 'wood-normal.ktx2', strength: 0.5, grain: 'look' },
  'cladding-plain': { ...CONCRETE, strength: 0.35 },
  'roof-seam': METAL,
  'roof-plain': METAL,
  'roof-tile': { map: 'clay.ktx2', normal: 'clay-normal.ktx2', size: [0.2, 0.2], mean: [0.3428, 0.188, 0.1079], strength: 0.7, grain: 90 },
  base: { ...CONCRETE, strength: 0.8 },
  chimney: { ...CONCRETE, strength: 0.8 },
  deck: { ...WOOD, normal: 'wood-normal.ktx2', strength: 0.9 },
  timber: { ...WOOD, strength: 0.9 },
  // inside, no normal maps: oak along the floors' planks (the photograph's grain runs up its v,
  // which a floor's projection lays along z, as Päris's planks run) and the oak furniture, the wet
  // rooms' tile and the kitchen's splashback a faint mottle (a glaze's photograph is all but
  // uniform), the worktops a stone-like one, the sofa, bed and headboard a woven fabric
  floor: OAK, oak: OAK, mediumOak: OAK, darkOak: OAK, skirting: OAK,
  tile: { ...CONCRETE, strength: 0.2 },
  splash: { ...CONCRETE, strength: 0.15 },
  worktop: STONE, kitchenTop: STONE,
  fabric: FABRIC, sofa: FABRIC, linen: { ...FABRIC, strength: 0.3 }
};
const DETAIL_NORMAL = 0.5;
// the models Foto draws in place of a layer's shapes (house3d/assets/*.glb, built by
// scripts/house3d-models.sh): each part (a glTF material) in its own photographed colours, or with
// tint in a surface's colour with its colour map's mean linear colour divided out, as the detail
// photographs do, or plain in a surface's colour; cut parts are leaves and needles cut out by alpha.
// A part's maps are <kind>-<part>.ktx2 and <kind>-<part>-normal.ktx2 beside its model.
const MODELS = {
  bin: { body: { surface: 'anthracite' }, trim: { surface: 'shell' } },
  mailbox: { box: { surface: 'anthracite' }, post: { surface: 'fence' } },
  'lamp-post': { metal: { surface: 'anthracite' } },
  thuja: { core: { surface: 'hedge' }, needles: { map: true, cut: true, tint: 'hedge', mean: [0.0099, 0.0089, 0.0026] } },
  'garden-table': {
    table: { map: true, normal: true, tint: 'timber', mean: [0.2867, 0.1445, 0.0771] },
    chair: { map: true, normal: true, tint: 'timber', mean: [0.2881, 0.1319, 0.0609] }
  },
  pot: { pot: { map: true, normal: true }, leaves: { map: true, normal: true, cut: true } },
  plant: { pot: { map: true, normal: true }, leaves: { map: true, normal: true, cut: true } },
  'plant-bloom': {
    vase: { map: true, normal: true },
    flowers: { map: true, normal: true, cut: true }
  },
  fern: { fronds: { map: true, normal: true, cut: true } }
};
// the car's lacquer and glass (carPaint)
const CAR_PAINT = { roughness: 0.42, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 };
const CAR_GLASS = { roughness: 0.04, metalness: 0.2, opacity: 0.6 }, CAR_GLASS_TINT = 0.35;
// the DETAILS key a material takes, by its role and, for the cladding and a roof, the look's pattern
const detailKey = ({ userData: { role }, map }, look) =>
  role === 'cladding' ? `cladding-${look.cladding.pattern}` : role === 'roof' ? `roof-${map ? look.roof.pattern : 'plain'}` : role;
// what multiplies a photograph back to the model's colour: one over its mean
const gainOf = mean => mean.map(v => 1 / v);
// the meadow past the lot reaches this many times the core's plane, past where the fog closes
const OUTSIDE_SCALE = 4;
// above this much snow the lawn and the meadow drop their photograph and show the snow's colour
const SNOW_BARE = 0.4;
// leaf cards: per m² of a crown's ellipsoid or a hedge's sides and top, their size in metres (a
// birch's BIRCH_CARD of it), per tier, the leaves' tint and what the body under the cards darkens
// to (and a crown's shrink, so the cards stand proud of it)
const CARDS = { high: 50, low: 11 }, CARD = { high: 0.55, low: 1.0 }, BIRCH_CARD = 0.75, HEDGE_CARDS = 28, HEDGE_CARD = 0.55;
const LEAF = '#738e5c', HEDGE_WINTER = '#56644a', CROWN_UNDER = '#1f2a19', HEDGE_UNDER = '#26331f', CROWN_SHRINK = 0.8;
const TILT = 1.2, PLACE = [0.85, 1.12], GROW = [0.75, 1.25], TINT = [0.85, 1.05];
const CROWN_SHADE = [0.55, 1], HEDGE_SHADE = [0.5, 1];
// a bare crown: per kind its limbs (count, from where up the trunk to the crown's centre, their
// lean from upright in radians, length as a share of the crown's half height), each forking into
// FORKS children LEVELS times (one less in the light tier), each child SHORTEN as long and THIN as
// thick, turned SPREAD off its parent and lifted by rise (a birch's last ones droop); all of it
// kept inside REACH of the crown's ellipsoid. Twig cards on the lobes like the leaf cards, TWIGS
// per m², TWIG metres, in the bark's tint per kind (CARD_KINDS).
const BARE = {
  maple: { limbs: 5, from: [0, 0.15], lean: [0.4, 0.7], length: 0.7, rise: 0.25 },
  apple: { limbs: 5, from: [0, 0.1], lean: [0.75, 1.05], length: 0.65, rise: 0.08 },
  birch: { limbs: 9, from: [0.1, 1.7], lean: [0.55, 0.9], length: 0.5, rise: 0.3, droop: -0.6 }
};
const LEVELS = { high: 4, low: 3 }, FORKS = [2, 3], SHORTEN = 0.62, THIN = 0.6, SPREAD = [0.35, 0.75], REACH = 0.8, BRANCH_SIDES = 5;
const TWIGS = 2, TWIG = 1.6, TWIG_PLACE = [0.7, 1.0];
// the card kinds: their texture, tint and alpha cut; the twig cards cut lower, so their thin twigs
// hold together further into the mipmaps
const CARD_KINDS = {
  twig: { file: 'twig.ktx2', tint: LEAF, cut: 0.5 },
  hedge: { file: 'hedge-twig.ktx2', tint: LEAF, cut: 0.5 },
  bare: { file: 'bare-twig.ktx2', tint: '#8a7f76', cut: 0.3 },
  bareBirch: { file: 'bare-twig.ktx2', tint: '#7a6566', cut: 0.3 }
};

export const daylight = alt => Math.min(1, Math.max(0.06, (alt + 6) / 14));

// cardCount(perM2, area, low) -> how many leaf cards an area in m² gets, half in the light tier
export const cardCount = (perM2, area, low) => Math.round(perM2 * area * (low ? 0.5 : 1));

export function photoLook(THREE, kit, real, { quality } = {}) {
  const low = quality === 'low', tier = low ? 'low' : 'high';
  const surfaces = [], dressings = [], hedges = [], cardMats = {}, sky = { tex: {}, targets: {}, at: null, backdrop: null };
  const models = [];
  let winter = false;
  let loaded = false, snow = 0, plane = null, disposed = false;
  const white = new THREE.Color('#ffffff'), turn = new THREE.Matrix4();

  // three's shadow pass gives an alpha-to-coverage material a depth material with its map and
  // an alphaTest of 0.5, so the cards' shadows are leaf-shaped without one of their own
  const cardMaterial = name => (cardMats[name] ||= kit.keep(new THREE.MeshStandardMaterial({
    alphaTest: CARD_KINDS[name].cut, alphaToCoverage: true, side: THREE.DoubleSide, color: CARD_KINDS[name].tint, roughness: 0.85
  })));
  // k drawn from weights w (their sum total) by rand
  const pick = (w, total, rand) => {
    let t = rand() * total, k = 0;
    while (k < w.length - 1 && (t -= w[k]) > 0) k++;
    return k;
  };
  // n cards of size s in group, at(p, nrm) setting each one's position and outward normal, shaded
  // by shade(p), as part ('cards' unless given)
  function leafCards(group, name, n, s, at, shade, rand, part = 'cards') {
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
    mesh.userData.part = part;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }
  const lerp = ([a, b], t) => a + (b - a) * t;
  const up = (y, y0, h, range) => lerp(range, Math.min(1, Math.max(0, (y - y0) / h)));
  // a point on a crown: one of its lobes (by their size), out from its centre by place
  function onLobes({ lobes, centre: [x, cy, z], radii: [a, b] }, place, rand) {
    const w = lobes.map(([, r]) => r * r), total = w.reduce((s, v) => s + v, 0), u = new THREE.Vector3();
    return (p, nrm) => {
      const [c, r] = lobes[pick(w, total, rand)];
      u.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      nrm.copy(c).addScaledVector(u, r * lerp(place, rand()));
      p.set(x + nrm.x * a, cy + nrm.y * b, z + nrm.z * a);
      nrm.normalize();
    };
  }
  const crownArea = ([a, b]) => 4 * Math.PI * ((a * a + 2 * a * b) / 3);

  function dressHedge({ material, sides, top }) {
    const ready = !!sides.userData.ready;
    sides.visible = ready;
    top.visible = ready && !winter;
    material.color.set(ready ? HEDGE_UNDER : material.userData.own);
  }
  function dressCards() {
    if (cardMats.hedge) cardMats.hedge.color.set(winter ? HEDGE_WINTER : LEAF);
  }

  // the haze at a direction's azimuth: the panorama just above its clean edge (uClean, the
  // elevation in radians where a "puresky"'s smeared fill ends and its own clouds begin), averaged
  // over HAZE_WIDTH radians of azimuth, in the sky's light: the meadow's fog and the backdrop share it
  const horizon = { uSky: { value: null }, uTurn: { value: new THREE.Matrix3() }, uIntensity: { value: 1 }, uClean: { value: 0 }, uFar: { value: 1 } };
  const HORIZON_GLSL = `uniform sampler2D uSky;
uniform mat3 uTurn;
uniform float uIntensity;
uniform float uClean;
uniform float uFar;
vec3 horizonAt(vec3 dir) {
  vec3 d = uTurn * dir;
  float az = atan(d.z, d.x) * RECIPROCAL_PI2 + 0.5, v = uClean * RECIPROCAL_PI + 0.5;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${HAZE_TAPS}; i++) {
    sum += texture2D(uSky, vec2(az + (float(i) / ${(HAZE_TAPS - 1).toFixed(1)} - 0.5) * ${HAZE_WIDTH.toFixed(3)} * RECIPROCAL_PI2, v)).rgb;
  }
  return sum / ${HAZE_TAPS.toFixed(1)} * uIntensity;
}
`;
  // the backdrop: a shell at the camera, BACKDROP of its far plane out, in the haze's colour,
  // opaque below the horizon and fading out up to the clean edge, so the smear never shows; only
  // the band below BACKDROP_TOP radians up is drawn. The core disposes it with the scene.
  function backdrop(scene) {
    if (sky.backdrop) return sky.backdrop;
    const material = new THREE.ShaderMaterial({
      uniforms: horizon,
      vertexShader: 'varying vec3 vDir;\nvoid main() {\n  vDir = position;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
      fragmentShader: `#include <common>
${HORIZON_GLSL}varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  gl_FragColor = vec4(horizonAt(dir), 1.0 - smoothstep(0.0, uClean, asin(clamp(dir.y, -1.0, 1.0))));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      side: THREE.BackSide, depthWrite: false, transparent: true, fog: false
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 12, 0, 2 * Math.PI, Math.PI / 2 - BACKDROP_TOP, Math.PI / 2 + BACKDROP_TOP), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    mesh.userData.part = 'backdrop';
    mesh.onBeforeRender = (renderer, s, camera) => {
      mesh.position.copy(camera.position);
      mesh.scale.setScalar(camera.far * BACKDROP);
      mesh.updateMatrixWorld();
      mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    };
    scene.add(mesh);
    return (sky.backdrop = mesh);
  }
  // the meadow fogs into the haze behind it rather than one fog colour, and from the core's fog
  // start out to MEADOW_FOG of the way to the backdrop rather than over the lot's short fog, so it
  // reaches the horizon and meets the backdrop without a seam; three applies fog after tone
  // mapping, so the haze is mapped here as the backdrop's is
  const meadowFog = sh => {
    Object.assign(sh.uniforms, horizon);
    sh.vertexShader = 'varying vec3 vHorizonWorld;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${HORIZON_GLSL}varying vec3 vHorizonWorld;`).replace('#include <fog_fragment>', `#ifdef USE_FOG
  float hzFog = smoothstep(fogNear, max(uFar, fogFar), vFogDepth);
  if (hzFog > 0.0) {
    vec3 hz = horizonAt(normalize(vHorizonWorld - cameraPosition));
    #ifdef TONE_MAPPING
    hz = toneMapping(hz);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(hz, 1.0)).rgb, hzFog);
  }
#endif`);
  };

  // a house surface's detail photograph (DETAILS) patched into its shader, over whatever it had
  // (a bake's contact shadows) and Päris's own map; once per material, a band's copy included. The
  // face's level line and line of steepest rise come from its normal per vertex (the faces are
  // flat), the fragment only turning them to the grain and flipping the level line on a back face;
  // what differs by role is in uniforms, so every dressed surface shares one program per variant
  // the world normal from three's view-space one, which is right under any scale and instancing
  const DETAIL_VERTEX = `vec4 dPos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  dPos = instanceMatrix * dPos;
#endif
  dPos = modelMatrix * dPos;
  vec3 dNrm = inverseTransformDirection(transformedNormal, viewMatrix);
  vec3 dUp = abs(dNrm.y) > 0.999 ? vec3(0.0, 0.0, -1.0) : normalize(vec3(0.0, 1.0, 0.0) - dNrm * dNrm.y);
  vec3 dLevel = normalize(cross(dUp, dNrm));
  vDetail = vec2(dot(dPos.xyz, dLevel), dot(dPos.xyz, dUp));
#ifdef DETAIL_NORMAL
  vDetailLevel = mat3(viewMatrix) * dLevel;
  vDetailUp = mat3(viewMatrix) * dUp;
#endif`;
  const DETAIL_VARYINGS = 'varying vec2 vDetail;\n#ifdef DETAIL_NORMAL\nvarying vec3 vDetailLevel;\nvarying vec3 vDetailUp;\n#endif\n';
  function dressDetail(m, tex) {
    const key = m.userData.role && detailKey(m, kit.look), d = DETAILS[key];
    if (!d || m.userData.detail || !tex[d.map]) return;
    const normal = !low && d.normal && tex[d.normal];
    const angle = ((d.grain === 'look' ? kit.look.cladding.angle_deg || 0 : d.grain || 0) * Math.PI) / 180;
    m.userData.detail = { key, normal: !!normal };
    const uniforms = {
      uDetail: { value: tex[d.map] },
      uDetailAxis: { value: new THREE.Vector2(Math.cos(angle), Math.sin(angle)) },
      uDetailSize: { value: new THREE.Vector2(...d.size) },
      uDetailGain: { value: new THREE.Vector3(...gainOf(d.mean)) },
      uDetailStrength: { value: d.strength },
      ...(normal && { uDetailNormal: { value: normal } })
    };
    const before = m.onBeforeCompile, cacheKey = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      before.call(m, sh, r);
      Object.assign(sh.uniforms, uniforms);
      const head = (normal ? '#define DETAIL_NORMAL\n' : '') + DETAIL_VARYINGS;
      sh.vertexShader = head + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n  ${DETAIL_VERTEX}`);
      sh.fragmentShader = `${head}uniform sampler2D uDetail;\nuniform vec2 uDetailAxis;\nuniform vec2 uDetailSize;\nuniform vec3 uDetailGain;\nuniform float uDetailStrength;\n#ifdef DETAIL_NORMAL\nuniform sampler2D uDetailNormal;\n#endif\n` + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  float dSide = gl_FrontFacing ? 1.0 : -1.0;
  vec2 dAt = vec2(vDetail.x * dSide, vDetail.y);
  vec2 dUv = vec2(dot(dAt, uDetailAxis), dAt.y * uDetailAxis.x - dAt.x * uDetailAxis.y) / uDetailSize;
  diffuseColor.rgb *= mix(vec3(1.0), texture2D(uDetail, dUv).rgb * uDetailGain, uDetailStrength);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef DETAIL_NORMAL
  vec3 dMap = texture2D(uDetailNormal, dUv).xyz * 2.0 - 1.0;
  dMap.xy *= ${DETAIL_NORMAL.toFixed(2)};
  vec3 dL = normalize(vDetailLevel) * dSide, dU = normalize(vDetailUp);
  normal = normalize(mat3(uDetailAxis.x * dL + uDetailAxis.y * dU, uDetailAxis.x * dU - uDetailAxis.y * dL, normal) * dMap);
#endif`);
    };
    m.customProgramCacheKey = () => `${cacheKey.call(m)}|detail${normal ? '-n' : ''}`;
    m.needsUpdate = true;
  }
  // every material under scene, once each
  const sceneMaterials = scene => {
    const out = new Set();
    if (scene) scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => out.add(m)); });
    return [...out];
  };
  // the photographs these materials' roles take, and nothing for a role they do not have
  const detailFiles = materials => [...new Set(materials.flatMap(m => {
    const d = m.userData.role && DETAILS[detailKey(m, kit.look)];
    return d ? [d.map, !low && d.normal] : [];
  }).filter(Boolean))];

  // a model's material for one part, one per part and group (a lift band fades and casts on its own)
  const modelMats = new Map();
  const mapFile = (kind, name, suffix = '') => `${kind}-${name}${suffix}.ktx2`;
  function modelMaterial(kind, name, scope, tex) {
    const key = `${kind}|${name}|${scope.uuid}`;
    if (modelMats.has(key)) return modelMats.get(key);
    const p = MODELS[kind][name] || {}, base = p.surface || p.tint;
    const m = base ? kit.surface(base) : kit.keep(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }));
    const map = p.map && tex[mapFile(kind, name)];
    if (map) {
      m.map = map;
      if (p.tint) m.color.multiply(new THREE.Color(...gainOf(p.mean)));
      else m.color.set('#ffffff');
      const normal = !low && p.normal && tex[mapFile(kind, name, '-normal')];
      if (normal) m.normalMap = normal;
      if (p.cut) Object.assign(m, { alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
    }
    modelMats.set(key, m);
    return m;
  }
  // puts a loaded model where a layer asked: scaled to fit its box, the shape hidden
  function placeModel({ kind, group, scope, at, turn, fit, hide }, gltf, tex) {
    const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
    const scale = fit ? Math.min(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z) : 1;
    const m = gltf.scene.clone(true);
    // a band casts only while it is fully on (house3d.js): the model takes the state of a
    // neighbour that casts when the band is on
    let casts = true;
    group.traverse(o => { if (o.isMesh && o.userData.cast) casts = o.castShadow; });
    m.traverse(o => {
      if (!o.isMesh) return;
      o.material = modelMaterial(kind, o.material.name, scope, tex);
      o.castShadow = casts;
      o.receiveShadow = true;
      o.userData.cast = true;
    });
    m.position.set(...at);
    m.rotation.y = turn;
    m.scale.setScalar(scale);
    m.userData.part = 'model';
    m.userData.model = kind;
    group.add(m);
    if (hide) hide();
  }
  // the models the scene asked for and their maps; a model that fails, or whose colour map does,
  // leaves its shapes
  function loadModels(load, model) {
    const kinds = [...new Set(models.map(m => m.kind))];
    if (!kinds.length) return Promise.resolve();
    const maps = kinds.flatMap(k => Object.entries(MODELS[k]).flatMap(([name, p]) => [p.map && mapFile(k, name), !low && p.normal && mapFile(k, name, '-normal')])).filter(Boolean);
    return Promise.all([
      Promise.all(kinds.map(k => model(`${k}.glb`).then(g => [k, g], () => null))),
      Promise.all(maps.map(f => load(f).then(t => [f, kit.keep(t)], () => null)))
    ]).then(([gs, ts]) => {
      if (disposed) return;
      const gltfs = Object.fromEntries(gs.filter(Boolean)), tex = Object.fromEntries(ts.filter(Boolean));
      const whole = k => gltfs[k] && Object.entries(MODELS[k]).every(([name, p]) => !p.map || tex[mapFile(k, name)]);
      models.forEach(m => { if (whole(m.kind)) placeModel(m, gltfs[m.kind], tex); });
      // the loader's own materials, each placed copy having its own
      Object.values(gltfs).forEach(g => g.scene.traverse(o => { if (o.material) o.material.dispose(); }));
    });
  }

  const look = {
    ...real,
    id: 'photo',
    ao: low ? false : undefined,
    bare: true,
    outsideScale: OUTSIDE_SCALE,
    // winter, from the winter layer: a hedge keeps its sides in a frosted green and sheds its top,
    // so the snow's cap sits on it; the core then asks for the light and the sky again (overcast)
    winter(on) {
      winter = on;
      hedges.forEach(dressHedge);
      dressCards();
    },
    material(role, o, surface) {
      const m = real.material(role, o, surface);
      if (SURFACES[role]) surfaces.push([role, m]);
      return m;
    },
    // the car's body in a clearcoated lacquer and its glass a dark reflective tint, both taking the
    // sky's environment, faded like Päris's (kit.applyFade) through o
    carPaint(o) {
      const body = kit.keep(new THREE.MeshPhysicalMaterial({ color: kit.REAL.car, ...CAR_PAINT, ...o }));
      const glass = kit.keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.REAL.glass).multiplyScalar(CAR_GLASS_TINT), side: THREE.DoubleSide, ...CAR_GLASS, ...o }));
      return { body, glass };
    },
    // the hemisphere's share of the sky light: the photographed sky lights the surfaces through
    // the environment instead; in winter a softer sun under the overcast
    light(alt) {
      const L = real.light(alt);
      if (!loaded) return L;
      const w = winter && alt > WINTER_DUSK;
      return {
        ...L,
        key: w ? { ...L.key, intensity: L.key.intensity * WINTER_KEY } : L.key,
        hemi: { ...L.hemi, intensity: L.hemi.intensity * (w ? WINTER_HEMI : HEMI) }
      };
    },
    // a tree's crown { group, mesh, material, lobes: [[centre, r]], rand, centre, radii: [a, b], crown, kind }
    crown(tree) {
      const { group, mesh, material, rand, centre: [, cy], radii: [, b], crown, kind } = tree;
      const size = CARD[tier] * Math.min(1, crown / 4) * (kind === 'birch' ? BIRCH_CARD : 1);
      const cards = leafCards(group, 'twig', Math.round(CARDS[tier] * crownArea(tree.radii)), size, onLobes(tree, PLACE, rand),
        p => up(p.y, cy - b, 2 * b, CROWN_SHADE), rand);
      dressings.push(() => {
        material.color.set(CROWN_UNDER);
        mesh.scale.multiplyScalar(CROWN_SHRINK);
        cards.userData.ready = true;
        // a crown already bare (winter) keeps its cards hidden
        cards.visible = mesh.visible;
      });
    },
    // a bare crown { group, kind, top, end, width, material, stem (the trunk's), lobes, rand, centre, radii, crown }:
    // the branches (part 'branch', every season, inside the crown) and the twig cards (part
    // 'twigs', shown by the trees layer while bare)
    bareCrown(tree) {
      const { group, kind, top, end, width, material, stem, rand, centre: [x, cy, z], radii: [a, b] } = tree;
      const habit = BARE[kind] || BARE.maple, geos = [], levels = LEVELS[tier];
      const yUp = new THREE.Vector3(0, 1, 0), q = new THREE.Vector3(), axis = new THREE.Vector3();
      // the point p pulled inside REACH of the crown's ellipsoid
      const inside = p => {
        q.set((p.x - x) / a, (p.y - cy) / b, (p.z - z) / a);
        const r = q.length();
        if (r > REACH) p.set(x + (q.x * REACH) / r * a, cy + (q.y * REACH) / r * b, z + (q.z * REACH) / r * a);
        return p;
      };
      const segment = (p, e, w0, w1) => {
        const len = p.distanceTo(e);
        if (len < 0.02) return null;
        const g = new THREE.CylinderGeometry(w1, w0, len, BRANCH_SIDES, 1, true);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(yUp, e.clone().sub(p).normalize()));
        g.translate((p.x + e.x) / 2, (p.y + e.y) / 2, (p.z + e.z) / 2);
        g.deleteAttribute('uv');
        geos.push(g);
        return g;
      };
      const grow = (p, dir, len, w, level) => {
        const e = inside(p.clone().addScaledVector(dir, len));
        segment(p, e, w, w * THIN);
        if (level >= levels) return;
        const n = FORKS[0] + Math.floor(rand() * (FORKS[1] - FORKS[0] + 1)), last = level + 1 === levels;
        for (let i = 0; i < n; i++) {
          axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(dir).normalize();
          const d = dir.clone().applyAxisAngle(axis, lerp(SPREAD, rand()));
          d.y += last && habit.droop ? habit.droop : habit.rise;
          grow(e, d.normalize(), len * SHORTEN, w * THIN, level + 1);
        }
      };
      const h = b * habit.length, turn = rand() * 2 * Math.PI;
      for (let i = 0; i < habit.limbs; i++) {
        const at = (i + rand() * 0.6) / habit.limbs, from = top + (end - top) * lerp(habit.from, at);
        const az = turn + (i * 2 * Math.PI * 0.618) + (rand() - 0.5) * 0.5, lean = lerp(habit.lean, rand());
        const dir = new THREE.Vector3(Math.sin(lean) * Math.cos(az), Math.cos(lean), Math.sin(lean) * Math.sin(az));
        grow(new THREE.Vector3(x, from, z), dir, h * (1 - 0.3 * at), width * 0.45 * (1 - 0.4 * at), 1);
      }
      const branches = new THREE.Mesh(kit.merge(geos), material);
      branches.castShadow = true;
      branches.userData.part = 'branch';
      group.add(branches);
      // a birch's leader on up from its trunk, in its bark
      const lead = kind === 'birch' && segment(new THREE.Vector3(x, end, z), inside(new THREE.Vector3(x, cy + b, z)), width * 0.3, width * 0.08);
      if (lead) {
        const leader = new THREE.Mesh(lead, stem);
        leader.castShadow = true;
        leader.userData.part = 'branch';
        group.add(leader);
      }
      const name = kind === 'birch' ? 'bareBirch' : 'bare';
      const twigs = leafCards(group, name, cardCount(TWIGS, crownArea(tree.radii), low), TWIG, onLobes(tree, TWIG_PLACE, rand),
        p => up(p.y, cy - b, 2 * b, CROWN_SHADE), rand, 'twigs');
      dressings.push(() => {
        twigs.userData.ready = true;
        twigs.visible = winter;
      });
    },
    // a hedge { group, mesh, material, length, height, width, rand }, the mesh placed: cards on
    // its sides, kept below its top at their largest, and on its top
    hedge({ group, mesh, material, length: L, height: H, width: W, rand }) {
      mesh.updateMatrix();
      const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
      const place = side => (p, nrm) => {
        const along = (rand() - 0.5) * L;
        if (side) {
          const s = rand() < 0.5 ? -1 : 1;
          p.set(along, -H / 2 + rand() * Math.max(0, H - (HEDGE_CARD * GROW[1]) / 2), s * (W / 2 - 0.02));
          nrm.set(0, 0, s);
        } else {
          p.set(along, H / 2 - 0.05, (rand() - 0.5) * W * 0.9);
          nrm.set(0, 1, 0);
        }
        p.applyMatrix4(mesh.matrix);
        nrm.applyMatrix3(nm).normalize();
      };
      const shade = p => up(p.y, 0, H, HEDGE_SHADE);
      const sides = leafCards(group, 'hedge', cardCount(HEDGE_CARDS, 2 * L * H, low), HEDGE_CARD, place(true), shade, rand);
      const top = leafCards(group, 'hedge', cardCount(HEDGE_CARDS, L * W, low), HEDGE_CARD, place(false), shade, rand);
      material.userData.own = material.color.clone();
      const hedge = { material, sides, top };
      hedges.push(hedge);
      dressings.push(() => { sides.userData.ready = top.userData.ready = true; dressHedge(hedge); });
    },
    // a model in place of a layer's shapes, once start() has it: kind a MODELS key, group where it
    // goes, at its foot there, turn about y, fit [w, h, d] the box it is scaled into (uniformly,
    // never stretched) or none for its own size, hide() hides the shapes it replaces
    model(kind, { group, scope = group, at, turn = 0, fit = null, hide = null }) {
      if (MODELS[kind]) models.push({ kind, group, scope, at, turn, fit, hide });
    },
    // the ground's snow over the lawn and the meadow, 0 to 1
    snow(amount) {
      snow = amount;
      surfaces.forEach(([role, m]) => {
        const tex = m.userData.photo;
        if ((role !== 'lawn' && role !== 'outside') || !tex) return;
        const want = amount > SNOW_BARE ? null : tex.map;
        if (m.map === want) return;
        m.map = want;
        m.normalMap = want && tex.normal;
        m.roughness = want ? SURFACES[role].roughness : tex.roughness;
        m.needsUpdate = true;
      });
    },
    // the photographed sky at the sun's altitude and direction; false until it is loaded
    sky({ alt, dir, scene, pmrem }) {
      if (!loaded) return false;
      const s = alt < (winter ? WINTER_DUSK : DUSK_ALT) ? SKIES.dusk : winter ? SKIES.winter : SKIES.day, tex = sky.tex[s.file];
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
      scene.environmentIntensity = (s === SKIES.winter ? WINTER_ENV : ENV) * dim;
      scene.fog.color.setRGB(...s.horizon).multiplyScalar(SKY * dim);
      backdrop(scene);
      horizon.uSky.value = tex;
      horizon.uTurn.value.setFromMatrix4(turn.makeRotationY(-th));
      horizon.uIntensity.value = SKY * dim;
      horizon.uClean.value = s.clean;
      return true;
    },
    // after the first frame: load(file) -> Promise<texture>, model(file) -> Promise<glTF>; done()
    // once the ground, the sky and the cards are applied, again once the house's detail photographs
    // are, on every material with a role under scene, and again once the models are in place
    start({ load, model, done, scene }) {
      const files = [...new Set([
        ...Object.values(SKIES).map(s => s.file),
        ...Object.values(SURFACES).flatMap(s => [s.map, s.rough, !low && s.normal]).filter(Boolean),
        ...Object.values(CARD_KINDS).map(k => k.file)
      ])];
      return Promise.all(files.map(f => load(f).then(t => [f, kit.keep(t)]))).then(list => {
        const tex = (sky.tex = Object.fromEntries(list));
        Object.values(SKIES).forEach(s => { tex[s.file].mapping = THREE.EquirectangularReflectionMapping; });
        // each role its own copy of a photograph (one image), tiled at its own repeat
        const tiled = (f, s) => {
          if (!tex[f]) return null;
          const t = kit.keep(tex[f].clone());
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(s.repeat, s.repeat);
          t.anisotropy = 8;
          return t;
        };
        surfaces.forEach(([role, m]) => {
          // the meadow has no map in Päris: it takes the lawn's mottle
          const s = SURFACES[role], mottle = m.map || (role === 'outside' ? kit.lawn() : null);
          const map = tiled(s.map, s), normal = tiled(s.normal, s);
          m.userData.photo = { map, normal, roughness: m.roughness };
          // the photograph's colour: the model's own (the shader divides out the photograph's mean), a tint, or white
          const colour = s.mean ? m.color.clone() : s.tint ? new THREE.Color(s.tint) : white.clone();
          m.map = map;
          m.normalMap = normal;
          m.normalScale.set(NORMAL, NORMAL);
          if (s.rough) m.roughnessMap = tiled(s.rough, s);
          if (s.roughness) m.roughness = s.roughness;
          const meadow = role === 'outside', mottled = s.mottle && mottle, gain = s.mean && gainOf(s.mean).map(v => v.toFixed(4)).join(', ');
          if (meadow) {
            // the ground layer snows and night-tints it from userData.look
            m.userData.look = colour;
            // its fog reaches as far as the camera sees, which the look learns only as it draws;
            // set before it draws, as a frame may be drawn once, on demand
            m.onBeforeRender = (renderer, sc, camera) => { horizon.uFar.value = camera.far * BACKDROP * MEADOW_FOG; };
          } else {
            // a snowed lawn keeps the snow's colour; ground's snow() takes the new day colour from userData
            if (role !== 'lawn' || !snow) m.color.copy(colour);
            m.userData.day = colour;
          }
          if (meadow || mottled || gain) {
            m.onBeforeCompile = sh => {
              if (meadow) meadowFog(sh);
              if (gain) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb *= vec3(${gain});\n#endif`);
              if (!mottled) return;
              sh.uniforms.uMottle = { value: mottle };
              sh.fragmentShader = 'uniform sampler2D uMottle;\n' + sh.fragmentShader.replace('#include <map_fragment>',
                `#include <map_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb *= texture2D(uMottle, vMapUv / ${s.mottle.toFixed(1)}).rgb;\n#endif`);
            };
            m.customProgramCacheKey = () => `photo-${role}`;
          }
          m.needsUpdate = true;
        });
        look.snow(snow);
        Object.entries(cardMats).forEach(([name, m]) => {
          m.map = tex[CARD_KINDS[name].file];
          m.needsUpdate = true;
        });
        dressCards();
        loaded = true;
        dressings.forEach(f => f());
        done();
        // a photograph that fails leaves its surfaces as Päris draws them
        return Promise.all(detailFiles(sceneMaterials(scene)).map(f => load(f).then(t => [f, kit.keep(t)], () => null))).then(list => {
          if (disposed) return;
          const details = Object.fromEntries(list.filter(Boolean));
          Object.values(details).forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 4 : 8; });
          sceneMaterials(scene).forEach(m => dressDetail(m, details));
          done();
          if (!model) return;
          return loadModels(load, model).then(() => { if (!disposed) done(); });
        });
      });
    },
    dispose() {
      disposed = true;
      Object.values(sky.targets).forEach(t => t.dispose());
    }
  };
  return look;
}
