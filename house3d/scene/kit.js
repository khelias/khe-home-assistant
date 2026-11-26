// The drawing kit of one mount: colours, materials, geometry helpers and the list of what
// dispose() frees. createKit() runs once per mount, so two mounts never share a material or a
// texture, and disposing one never frees the other's.
const COLORS = {
  bg: '#060c1b', line: '#6fe3ff', lineSoft: '#5d86d8', roof: '#9aa6ff', roofFill: '#252f6e', wall: '#1b2c5e',
  glass: '#5fd8ff', floor: '#0e1a3c', warm: '#6b4a1c', hover: '#24407f', sel: '#2b5aa0', amber: '#ffc56e',
  teal: '#47d9c4', hedge: '#123b45', furniture: '#7f9bff', gridMajor: '#2a4685', gridMinor: '#172a55',
  ink: '#e4ecff', alert: '#ff8b7b',
  // the future layer's tint in both styles: a clear violet, apart from every other colour here
  future: '#b37bff'
};

// A lit style's default surfaces, which a model's look (geometry.look) overrides by name: a
// light, matt architectural model. The walls are a plain light grey without trims, the roofs a
// matt mid grey, and every frame, roof edge, the carport's panels and the pergola an off-white
// (frame); the wall's base strip is in the frame's colour too unless the look names base, the
// casings (opening trims, corner boards, fascias, posts) unless it names trim, and a
// chimney (geometry.chimneys) a plain mid grey. Inside, the walls are light grey, the doors and
// their frames white, the living floors light wood planks (planks()) and the wet rooms a grey tile
// (tiles()). The interior is drawn as an
// architectural model: the walls' cut tops near black (cut), oak skirting, and the furniture in
// white linen, a blue-grey fabric, light oak, a dark worktop and white-grey cabinets; an item of no
// known kind is a warm grey block (furniture), apart from the walls. Fitted kitchens are light
// fronts (kitchen) under a dark worktop (kitchenTop) with dark handles, steel and black glass, the
// wall behind them light tiles (splashTiles()); a TV's screen, a rug and sheer curtains have their
// own surfaces, a sofa a dark charcoal velvet. Fitted units, a vanity and a bookcase may instead be
// anthracite or a painted white, carcass, fronts and top alike; toilets, basins and the bath are
// glazed porcelain (sanitary), a mirror a light polished slab, a sauna stove's stones dark grey.
// The deck is a grey-brown composite, the paving light grey concrete pavers with sandy joints
// (their stones come from pavers()), the entrance step dark grey, the outdoor units white.
// The bar fence and the gates are dark bars (bars()), the other fences a dark wire mesh
// (wireMesh()). The play area is stained timber with a sand box, a mint slide and a dark nest
// seat; the trampoline a green edge pad on a black mat with a black net.
// The garden is a muted green family: a mottled lawn (lawn()), a darker clipped hedge, crowns in
// between on brown trunks, a birch's on white bark. The car and surroundings are plain stand-ins,
// the neighbours light with a dark roof on the gabled ones, the street asphalt (asphalt());
// outside the lot is a light base, like an architectural model's. Snow (the winter layer) is a
// cool white.
const REAL = {
  cladding: '#e6e4df', roof: '#6e7377', frame: '#f0f0ed', base: '#8e8c87', trim: '#ebebe7', chimney: '#a9a7a1', unit: '#e4e4e0',
  glass: '#9fb8c4', interior: '#e4e3df', door: '#f2f1ed', floor: '#cdbfa8', tile: '#9a9690', deck: '#8a8178', paving: '#c4c0b8',
  lawn: '#7b9860', outside: '#d8d6cc', hedge: '#44633d', crown: '#5d7c4b', trunk: '#5b4636', bark: '#e3ddd2',
  fence: '#5a5d60', car: '#2f3336', neighbour: '#cfcac0', neighbourRoof: '#6f6b66', road: '#6b6b68',
  timber: '#8a6a4c', sand: '#d6c6a0', slide: '#9ed8c2', nest: '#3d4a5c', pad: '#3f8a4b', mat: '#202325',
  net: '#151719', mesh: '#2c2f31', stone: '#56595b',
  cut: '#2a2d30', skirting: '#c9a67c', linen: '#ecebe6', fabric: '#7d8792', oak: '#d6c2a2', worktop: '#3b3b3b',
  cabinet: '#e6e5e0', furniture: '#a59f95',
  kitchen: '#dcdad5', kitchenTop: '#575553', handle: '#2b2c2e', steel: '#a4a7aa', blackGlass: '#0e0f11', screen: '#07080a',
  rug: '#b9b1a3', sheer: '#f4f2ec', sofa: '#4a4c51',
  anthracite: '#3b3d40', white: '#eeeeeb', sanitary: '#f7f7f4', mirror: '#d3dade', stones: '#46484a', darkOak: '#7f6145', mediumOak: '#b08a62', shell: '#1c1d1f',
  pot: '#d4cec4', leaf: '#4b7343', bloom: '#d98aa0', canvas: '#efe9de', artA: '#c4744e', artB: '#8da488', artC: '#d8b05c', artD: '#3e5a6f',
  brushGround: '#c9ced3', brushA: '#5d7086', brushB: '#8e9caa', brushC: '#e2e5e8', brushD: '#3d4b5b',
  snow: '#f1f4f7', spruce: '#2b4a2f', baubleRed: '#a8232c', baubleGold: '#d0a038', baubleSilver: '#c4c8cd'
};
// the cladding's boards (a look's cladding pattern 'boards'): about 12 cm wide, at 45 degrees
// rising to the right, 0 horizontal or 90 upright, only their grooves drawn, on a 2 m tile of the
// walls' metre UVs; BOARDS is the boards across the tile at 45, BOARDS_SQUARE at 0 and 90 unless
// the look's cladding gives a board width (BOARD_RANGE m), GROOVE the groove's share of a board
// unless it gives one (GROOVE_RANGE)
const BOARD_TILE = 2, BOARDS = 12, BOARDS_SQUARE = 17, BOARD_PX = 512, GROOVE = 0.045;
const BOARD_RANGE = [0.08, 0.4], GROOVE_RANGE = [0.02, 0.25];
// pitched roof profiles (a look's roof pattern 'seam' or 'tile') on slope-aligned metre UVs:
// u runs along the eave, v runs uphill along the slope surface. 'seam' draws 4 standing-seam
// sheets per 2 m tile (0.5 m pitch); 'tile' draws 6 staggered courses of 6 fluted tiles (0.30 m
// each on a 1.8 m tile, even course count so half-pitch stagger wraps cleanly)
const ROOF_PX = 512, ROOF_SEAM_TILE = 2, ROOF_SEAM_PITCH = 0.5, ROOF_SEAM_SHADOW = 0.015, ROOF_SEAM_HI = 0.03;
const ROOF_TILE_SIZE = 1.8, ROOF_TILE_W = 0.3, ROOF_TILE_H = 0.3, ROOF_TILE_LIP = 0.1, ROOF_TILE_SIDE = 0.06;
// what a look leaves out: plain cladding and roof, no trims
const LOOK = { cladding: { pattern: 'plain' }, roof: { pattern: 'plain' }, trims: { openings: false, corners: false, base: false, fascia: false } };
// the base strip's height when trims.base is true, and the range a look's {height} may take
const BASE_H = 0.12, BASE_RANGE = [0.05, 1];
const GLASS_OPACITY = 0.35, SHEER_OPACITY = 0.55;
// the paving's stones: running-bond rows ROW deep of stones STONE long, the long joints waving
// WAVE either way, on a PAVER_TILE m tile that holds whole rows and stones
const PAVER_TILE = 0.9, STONE = 0.225, ROW = 0.1125, WAVE = 0.012, JOINT = 0.005, PAVER_PX = 512;
// the mesh fence: vertical wires every 5 cm, horizontal ones every 20 cm, 4 mm thick, on a 0.2 m
// tile; a faint veil between them so the mipmapped fence still reads from far off
const MESH_TILE = 0.2, MESH_X = 0.05, WIRE = 0.004, MESH_PX = 256, MESH_VEIL = 26;
const BAR_STEP = 0.12, BAR = 0.02, RAIL = 0.04;
// the lawn's mottle and the road's asphalt: smooth value noise on a NOISE_TILE m tile, a share
// of [cells across the tile, weight] per octave, shading the surface's colour from 1 down by its
// DEPTH; grey shades only, so the snow's white lerp still whitens a snowed lawn
const NOISE_TILE = 6, NOISE_PX = 256;
const LAWN_OCTAVES = [[3, 0.55], [12, 0.3], [48, 0.15]], LAWN_DEPTH = 0.16;
const ASPHALT_OCTAVES = [[4, 0.4], [96, 0.6]], ASPHALT_DEPTH = 0.12;
// the oak floor: rows of planks about PLANK wide along world z, each row of planks one of
// PLANK_LENS long from a staggered start, all dividing the FLOOR_TILE m tile; a plank's shade
// varies PLANK_VAR either way, the joint between them darker
const FLOOR_TILE = 2.4, PLANK = 0.18, PLANK_LENS = [0.8, 1.2, 2.4], PLANK_VAR = 0.06, PLANK_PX = 1024, PLANK_JOINT = 0.003;
// the wet rooms' wood-look tile: TILE_W by TILE_L, half-bond, a lighter grout joint
const TILE_W = 0.2, TILE_L = 1.2, GROUT = 0.004, TILE_PX = 512;
// the kitchen wall's tiles: SPLASH_W wide and SPLASH_H high in a straight stack, a soft grey joint
const SPLASH_TILE = 1.2, SPLASH_W = 0.6, SPLASH_H = 0.3, SPLASH_JOINT = 0.003, SPLASH_PX = 512;

// a model's look (geometry.look) resolved over the defaults: the surfaces' colours and finishes by
// name, the cladding's pattern (boards at 45 degrees unless the look gives an angle) and the trims,
// each on or off, with the base strip's height and surface apart (trims.base {height} is on);
// the card's model comes from HA's stored config, not only through the validator, so what is not a
// known surface, finish or trim is left out rather than drawn
const within = (v, [lo, hi]) => typeof v === 'number' && v >= lo && v <= hi;
function resolveLook(look) {
  const given = Object.entries((look && look.surfaces) || {}).filter(([k]) => Object.hasOwn(REAL, k))
    .map(([k, v]) => [k, typeof v === 'string' ? { color: v } : v]).filter(([, v]) => v && typeof v.color === 'string');
  const colors = { ...REAL, ...Object.fromEntries(given.map(([k, v]) => [k, v.color])) };
  const finish = Object.fromEntries(given.map(([k, v]) => [k, Object.fromEntries(['roughness', 'metalness'].filter(f => f in v).map(f => [f, v[f]]))]));
  const c = (look && look.cladding && typeof look.cladding === 'object') ? look.cladding : LOOK.cladding;
  const cladding = c.pattern === 'boards' ? {
    pattern: 'boards', angle_deg: [0, 45, 90].includes(c.angle_deg) ? c.angle_deg : 45,
    ...(within(c.board, BOARD_RANGE) && { board: c.board }), ...(within(c.groove, GROOVE_RANGE) && { groove: c.groove })
  } : LOOK.cladding;
  const r = (look && look.roof && typeof look.roof === 'object') ? look.roof : LOOK.roof;
  const roof = r.pattern === 'seam' || r.pattern === 'tile' ? { pattern: r.pattern } : LOOK.roof;
  const t = (look && look.trims) || {};
  const h = t.base && typeof t.base === 'object' ? t.base.height : undefined;
  const high = within(h, BASE_RANGE);
  const trims = { ...LOOK.trims, ...Object.fromEntries(Object.entries(t).filter(([k]) => Object.hasOwn(LOOK.trims, k)).map(([k, v]) => [k, v === true || (k === 'base' && high)])) };
  const named = k => given.some(([n]) => n === k);
  const base = { height: high ? h : BASE_H, surface: named('base') ? 'base' : 'frame' };
  return { colors, finish, look: { cladding, roof, trims }, base, trim: { surface: named('trim') ? 'trim' : 'frame' } };
}

export function createKit(THREE, style = 'simple', look) {
  const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, new THREE.Color(v)]));
  const { colors, finish, look: resolved, base, trim } = resolveLook(look);
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  // lit styles only: a new lit material on every call, so a floor tints alone and a fade on
  // one group never reaches another's surfaces; o overrides, e.g. { transparent: true } for
  // what fades (the lift, the car)
  // what differs from a matt surface: whatever is polished takes the sky's sheen, the sofa's
  // fabric none, and the sheer lets the window through; a look's own roughness and metalness win
  const FINISH = {
    glass: { transparent: true, opacity: GLASS_OPACITY, roughness: 0.15, side: THREE.DoubleSide },
    kitchenTop: { roughness: 0.32 },
    sofa: { roughness: 1 },
    blackGlass: { roughness: 0.12 },
    screen: { roughness: 0.12 },
    steel: { roughness: 0.38, metalness: 0.65 },
    sanitary: { roughness: 0.18 },
    mirror: { roughness: 0.08, metalness: 0.2 },
    baubleRed: { roughness: 0.25, metalness: 0.35 },
    baubleGold: { roughness: 0.25, metalness: 0.6 },
    baubleSilver: { roughness: 0.2, metalness: 0.7 },
    sheer: { transparent: true, opacity: SHEER_OPACITY, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }
  };
  const surface = style !== 'simple'
    ? (name, o = {}) => keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[name]), roughness: 0.85, metalness: 0, ...FINISH[name], ...finish[name], ...o }))
    : undefined;
  const basic = o => keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o }));
  const lineMat = o => keep(new THREE.LineBasicMaterial({ transparent: true, ...o }));
  function mats(tint) {
    return {
      wall: basic({ color: C.wall, opacity: 0.13, side: THREE.DoubleSide }),
      edge: lineMat({ color: tint || C.line, opacity: 0.75 }),
      glass: basic({ color: C.glass, opacity: 0.06, side: THREE.DoubleSide }),
      glassEdge: lineMat({ color: C.glass, opacity: 0.6 }),
      furn: basic({ color: C.wall, opacity: 0.2 }),
      furnEdge: lineMat({ color: C.furniture, opacity: 0.45 })
    };
  }
  const edges = (geo, mat, thresh) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, thresh || 15), mat);

  function box(group, mat, emat, [x0, z0, x1, z1], [y0, y1]) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.add(edges(geo, emat));
    group.add(mesh);
    return mesh;
  }

  // an upright prism on an outline [[x, z], ...], from y0 to y1
  function prism(pts, y0, y1) {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: y1 - y0, bevelEnabled: false });
    // shape y becomes world z, the extrusion runs down from y1
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y1, 0);
    return geo;
  }

  function canvasTexture(size, stops) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([at, c]) => gr.addColorStop(at, c));
    x.fillStyle = gr;
    x.fillRect(0, 0, size, size);
    const tex = keep(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // lit styles: [front, back], the board texture at the look's angle as seen on a wall's local +z
  // face and its mirror for the -z face, so diagonal boards rise to the right on both; one pair per
  // mount. A DataTexture, not a canvas: the engine tests run without a DOM
  let boardPair;
  function boards() {
    if (boardPair) return boardPair;
    const { angle_deg: angle, board, groove = GROOVE } = resolved.cladding;
    const S = BOARD_PX, square = board ? Math.round(BOARD_TILE / board) : BOARDS_SQUARE;
    // across counts across the boards and wraps with the tile (i - j at 45, j rows at 0, i
    // columns at 90); one shade, a thin groove between
    const across = angle === 45 ? (i, j) => ((i - j + S) * BOARDS) / S : (i, j) => ((angle === 0 ? j : i) * square) / S;
    const front = tileTexture(S, BOARD_TILE, (i, j) => {
      const t = across(i, j), v = (t - Math.floor(t) < groove ? 0.72 : 1) * 255;
      return [v, v, v, 255];
    });
    const back = keep(front.clone());
    back.repeat.x = -1 / BOARD_TILE;
    back.needsUpdate = true;
    return (boardPair = [front, back]);
  }

  // lit styles: the pitched roof's profile texture ('seam' or 'tile'), or null for 'plain'; one
  // per mount, on slope-aligned metre UVs (u along eave, v uphill)
  let roofTex;
  function roofMap() {
    const pat = resolved.roof.pattern;
    if (pat === 'plain') return null;
    if (roofTex) return roofTex;
    const S = ROOF_PX;
    if (pat === 'seam') {
      const m = ROOF_SEAM_TILE / S;
      roofTex = tileTexture(S, ROOF_SEAM_TILE, i => {
        const u = (i + 0.5) * m, sheet = Math.floor(u / ROOF_SEAM_PITCH);
        const lu = u - sheet * ROOF_SEAM_PITCH;
        let shade = 0.9 * (1 + 0.05 * (hash(sheet, 19) - 0.5));
        if (lu < ROOF_SEAM_SHADOW) shade = 0.48;
        else if (lu < ROOF_SEAM_HI) shade = 1;
        const g = Math.round(Math.min(1, Math.max(0, shade)) * 255);
        return [g, g, g, 255];
      });
      return roofTex;
    }
    const m = ROOF_TILE_SIZE / S, cols = Math.round(ROOF_TILE_SIZE / ROOF_TILE_W);
    roofTex = tileTexture(S, ROOF_TILE_SIZE, (i, j) => {
      const u = (i + 0.5) * m, v = (j + 0.5) * m;
      const row = Math.floor(v / ROOF_TILE_H), lv = (v - row * ROOF_TILE_H) / ROOF_TILE_H;
      const ou = (u + (row % 2) * (ROOF_TILE_W / 2)) % ROOF_TILE_SIZE;
      const col = Math.floor(ou / ROOF_TILE_W) % cols, lu = (ou - col * ROOF_TILE_W) / ROOF_TILE_W;
      let shade = 0.88 * (1 + 0.08 * (hash(row, col + 23) - 0.5)) * (1 + 0.08 * Math.sin(2 * Math.PI * lu));
      if (lu < ROOF_TILE_SIDE) shade *= 0.72;
      if (lv < ROOF_TILE_LIP) shade *= 0.5 + 0.5 * (lv / ROOF_TILE_LIP);
      const g = Math.round(Math.min(1, Math.max(0, shade)) * 255);
      return [g, g, g, 255];
    });
    return roofTex;
  }

  // a repeating DataTexture of S x S pixels filled by px(i, j) -> [r, g, b, a], on a tile metres
  // wide of metre UVs
  function tileTexture(S, tile, px) {
    const data = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) data.set(px(i, j), (j * S + i) * 4);
    const tex = keep(new THREE.DataTexture(data, S, S));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.repeat.set(1 / tile, 1 / tile);
    tex.needsUpdate = true;
    return tex;
  }

  // a stable pseudo-random 0..1 from two whole numbers, the same on every tile
  const hash = (a, b) => {
    const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  // a stable pseudo-random sequence 0..1 (mulberry32, as winter.js has for its flakes) from a
  // string key, for what varies tree by tree or building by building yet draws the same on every
  // mount
  function seeded(key) {
    let a = 2166136261;
    for (const ch of key) a = Math.imul(a ^ ch.codePointAt(0), 16777619);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // smooth value noise over the tile, octave by octave on n x n cells that wrap so the tile's
  // edges meet, as grey shades from 1 down by depth
  function noiseTexture(octaves, depth) {
    const S = NOISE_PX, sum = new Float32Array(S * S);
    octaves.forEach(([n, w], k) => {
      const lattice = Float32Array.from({ length: n * n }, (_, c) => hash((c % n) + (k + 1) * 131, Math.floor(c / n) + (k + 1) * 71));
      const at = (a, b) => lattice[(b % n) * n + (a % n)], ease = f => f * f * (3 - 2 * f);
      for (let j = 0; j < S; j++) {
        const y = (j / S) * n, b = Math.floor(y), sy = ease(y - b);
        for (let i = 0; i < S; i++) {
          const x = (i / S) * n, a = Math.floor(x), sx = ease(x - a);
          const top = at(a, b) + (at(a + 1, b) - at(a, b)) * sx, bot = at(a, b + 1) + (at(a + 1, b + 1) - at(a, b + 1)) * sx;
          sum[j * S + i] += w * (top + (bot - top) * sy);
        }
      }
    });
    return tileTexture(S, NOISE_TILE, (i, j) => {
      const g = Math.round((1 - depth * sum[j * S + i]) * 255);
      return [g, g, g, 255];
    });
  }
  // lit styles: the lawn's mottle and the road's asphalt, one texture each per mount
  let lawnTex, asphaltTex;
  const lawn = () => (lawnTex ||= noiseTexture(LAWN_OCTAVES, LAWN_DEPTH));
  const asphalt = () => (asphaltTex ||= noiseTexture(ASPHALT_OCTAVES, ASPHALT_DEPTH));

  // geometries as one, unindexed, with the attributes they all have, for a shape drawn in one
  // mesh; the inputs are disposed
  function merge(geos) {
    if (!geos.length) return new THREE.BufferGeometry();
    const flat = geos.map(g => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
    Object.keys(flat[0].attributes).filter(name => flat.every(g => g.attributes[name])).forEach(name => {
      const arr = new Float32Array(flat.reduce((n, g) => n + g.attributes[name].array.length, 0));
      let at = 0;
      for (const g of flat) { arr.set(g.attributes[name].array, at); at += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, flat[0].attributes[name].itemSize));
    });
    new Set([...geos, ...flat]).forEach(g => g.dispose());
    return out;
  }
  // a colour attribute of grey shades from f(x, y, z, i) per vertex, so a lit surface keeps its
  // own colour and only darkens where f is under 1 (the material needs vertexColors)
  function shade(geo, f) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) c.fill(f(p.getX(i), p.getY(i), p.getZ(i), i), i * 3, i * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }

  const inJoint = (t, step, joint) => Math.min(t % step, step - (t % step)) < joint / 2;

  // lit styles: the paving's stones, one texture per mount
  let paverTex;
  function pavers() {
    if (paverTex) return paverTex;
    const S = PAVER_PX, m = PAVER_TILE / S, rows = Math.round(PAVER_TILE / ROW), cols = Math.round(PAVER_TILE / STONE);
    paverTex = tileTexture(S, PAVER_TILE, (i, j) => {
      const u = i * m, v = j * m;
      // the wave runs ROW long along u, so the tile's edges meet
      const rv = (v + WAVE * Math.sin((2 * Math.PI * u) / ROW) + PAVER_TILE) % PAVER_TILE, r = Math.floor(rv / ROW);
      const ou = (u + (r % 2) * (STONE / 2)) % PAVER_TILE, c = Math.floor(ou / STONE) % cols;
      if (inJoint(rv, ROW, JOINT) || inJoint(ou, STONE, JOINT)) return [255, 255, 255, 255];
      // a stone's shade from its row and column, the same on every tile
      const g = Math.round(0.88 * (1 + 0.08 * (hash(r % rows, c) - 0.5)) * 255);
      return [g, g, g, 255];
    });
    return paverTex;
  }

  // lit styles: the oak floor's planks, one texture per mount
  let plankTex;
  function planks() {
    if (plankTex) return plankTex;
    const S = PLANK_PX, m = FLOOR_TILE / S, rows = Math.round(FLOOR_TILE / PLANK), w = FLOOR_TILE / rows;
    // each row's plank length and where its planks start, once per row, not per pixel
    const lens = Array.from({ length: rows }, (_, r) => PLANK_LENS[Math.floor(hash(r, 1) * PLANK_LENS.length)]);
    const starts = lens.map((len, r) => hash(r, 2) * len);
    plankTex = tileTexture(S, FLOOR_TILE, (i, j) => {
      // u runs along the planks: the texture's v, which the floors lay on world z
      const u = (j + 0.5) * m, v = (i + 0.5) * m, r = Math.floor(v / w), len = lens[r];
      const ou = (u + starts[r]) % FLOOR_TILE, c = Math.floor(ou / len);
      if (inJoint(v, w, PLANK_JOINT) || inJoint(ou, len, PLANK_JOINT)) return [178, 178, 178, 255];
      const g = Math.round(0.93 * (1 + 2 * PLANK_VAR * (hash(r, c + 3) - 0.5)) * 255);
      return [g, g, g, 255];
    });
    return plankTex;
  }

  // lit styles: the wet rooms' tiles, one texture per mount
  let wetTex;
  function tiles() {
    if (wetTex) return wetTex;
    const S = TILE_PX, m = FLOOR_TILE / S;
    wetTex = tileTexture(S, FLOOR_TILE, (i, j) => {
      const u = (i + 0.5) * m, v = (j + 0.5) * m, r = Math.floor(v / TILE_W);
      const ou = (u + (r % 2) * (TILE_L / 2)) % FLOOR_TILE, c = Math.floor(ou / TILE_L);
      if (inJoint(v, TILE_W, GROUT) || inJoint(ou, TILE_L, GROUT)) return [255, 255, 255, 255];
      const g = Math.round(0.86 * (1 + 0.08 * (hash(r, c + 7) - 0.5)) * 255);
      return [g, g, g, 255];
    });
    return wetTex;
  }

  // lit styles: the kitchen wall's tiles, one texture per mount, to multiply a light surface
  let splashTex;
  function splashTiles() {
    if (splashTex) return splashTex;
    const S = SPLASH_PX, m = SPLASH_TILE / S;
    splashTex = tileTexture(S, SPLASH_TILE, (i, j) => {
      const u = (i + 0.5) * m, v = (j + 0.5) * m;
      if (inJoint(u, SPLASH_W, SPLASH_JOINT) || inJoint(v, SPLASH_H, SPLASH_JOINT)) return [196, 195, 191, 255];
      const g = Math.round(0.97 * (1 + 0.025 * (hash(Math.floor(v / SPLASH_H), Math.floor(u / SPLASH_W) + 11) - 0.5)) * 255);
      return [g, g, g, 255];
    });
    return splashTex;
  }

  // lit styles: the mesh fence's wires, white where a wire is, alpha MESH_VEIL between
  let meshTex;
  function wireMesh() {
    if (meshTex) return meshTex;
    const S = MESH_PX, m = MESH_TILE / S;
    const on = (t, step) => Math.min(t % step, step - (t % step)) < WIRE / 2;
    meshTex = tileTexture(S, MESH_TILE, (i, j) => [255, 255, 255, on((i + 0.5) * m, MESH_X) || on((j + 0.5) * m, MESH_TILE) ? 255 : MESH_VEIL]);
    return meshTex;
  }

  // lit styles: a bar fence span or gate leaf len long and h high along local +x, from the
  // ground up: two rails and a bar every BAR_STEP, ends included; casts, takes no shadow
  function bars(len, h, mat) {
    const g = new THREE.Group();
    [0.05, h].forEach(y => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, RAIL, RAIL), mat);
      r.position.set(len / 2, y, 0);
      g.add(r);
    });
    const n = Math.max(1, Math.round(len / BAR_STEP)), im = new THREE.InstancedMesh(new THREE.BoxGeometry(BAR, h - 0.05, BAR), mat, n + 1);
    const at = new THREE.Matrix4();
    for (let i = 0; i <= n; i++) im.setMatrixAt(i, at.makeTranslation((len * i) / n, (0.05 + h) / 2, 0));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    g.add(im);
    g.children.forEach(o => { o.castShadow = true; o.receiveShadow = false; });
    return g;
  }

  // a box from point p to point q ([x, y, z]) in group, w wide along across (any direction round
  // the axis when not given) and d deep, its ends kept for the tests
  const up = new THREE.Vector3(0, 1, 0);
  function strut(group, p, q, w, d, mat, part, across) {
    const a = new THREE.Vector3(...p), b = new THREE.Vector3(...q), dir = b.clone().sub(a), len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    dir.normalize();
    if (across) {
      const x = new THREE.Vector3(...across).addScaledVector(dir, -new THREE.Vector3(...across).dot(dir)).normalize();
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, x.clone().cross(dir)));
    } else m.quaternion.setFromUnitVectors(up, dir);
    m.userData = { part, ends: [p, q] };
    group.add(m);
    return m;
  }

  // lit styles: box() without the outline
  function solid(group, mat, [x0, z0, x1, z1], [y0, y1]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    group.add(mesh);
    return mesh;
  }

  // lit styles: a level outline [[x, z], ...] with holes at height 0, facing up (shape y is -z,
  // so the turn onto the ground keeps the face up)
  function flatShape(pts, holes = []) {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    holes.forEach(h => shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  // lit styles: (night) -> sets each material's colour from its colour now towards low of it at
  // night 1, for the land and neighbours beyond the lot; the function's day holds those colours,
  // for a caller that changes one by day (the ground's snow)
  function nightTint(materials, low) {
    const day = materials.map(m => m.color.clone());
    // a material's userData.day, when a look sets one after its textures are in, wins over the colour at build
    const tint = night => materials.forEach((m, i) => m.color.copy(m.userData.day || day[i]).multiplyScalar(1 - (1 - low) * night));
    tint.day = day;
    return tint;
  }

  // scales every material's opacity under group from its first-seen value; sprites are left out
  function applyFade(group, f) {
    group.traverse(o => {
      if (!o.material || o.isSprite) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => {
        if (mt.userData.base === undefined) mt.userData.base = mt.opacity;
        mt.opacity = mt.userData.base * f;
      });
    });
    group.visible = f > 0.01;
  }

  const near = (a, b) => Math.abs(a - b) < 0.002;

  // the stretches of [lo, hi] longer than min that no gap [a, b] covers; gaps sorted by a
  function spans(lo, hi, gaps, min) {
    const out = [];
    let from = lo;
    [...gaps, [hi, hi]].forEach(([a, b]) => {
      a = Math.min(a, hi);
      if (a - from > min) out.push([from, a]);
      from = Math.max(from, b);
    });
    return out;
  }

  return { C, style, REAL: colors, look: resolved, base, trim, disposables, keep, basic, lineMat, mats, edges, box, prism, canvasTexture, applyFade, nightTint, near, spans, surface, solid, strut, flatShape, boards, roofMap, pavers, planks, tiles, splashTiles, wireMesh, bars, lawn, asphalt, seeded, merge, shade };
}
