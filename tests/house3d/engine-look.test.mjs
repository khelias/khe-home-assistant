// Engine tests on the synthetic fixture: a model's look (geometry.look) and the neutral default
// without one, and the look baseline. The geometry baseline pins where the meshes stand; the look
// baseline pins what they are drawn in, in the real style with every layer on: per mesh in
// traversal order, each material's colour, emissive, roughness, metalness, opacity, transparency,
// side and a hash of every texture it carries.
// UPDATE_BASELINE=1 node --test tests/house3d/engine-look.test.mjs rewrites it instead of
// comparing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { THREE, createKit, buildAll, options, model, hexOf, partsOf, checkBaseline } from './engine-harness.mjs';

const BASELINE = new URL('./look-baseline.json', import.meta.url);

// a texture as its kind, repeat, offset and a hash of its pixels (a canvas has none in Node)
function textureOf(t) {
  const data = t.image && t.image.data;
  const h = data ? createHash('sha1').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex').slice(0, 16) : '-';
  return `${t.type} ${t.repeat.x},${t.repeat.y} ${t.offset.x},${t.offset.y} ${h}`;
}

// one material as a line: what it is drawn in, and its textures by slot
function materialOf(mt) {
  const r = v => (typeof v === 'number' ? Number(v.toFixed(4)) : '-');
  const hex = c => (c ? `#${c.getHexString()}` : '-');
  const maps = Object.entries(mt).filter(([, v]) => v && v.isTexture).map(([k, v]) => `${k}=${textureOf(v)}`).sort();
  return [mt.type, hex(mt.color), hex(mt.emissive), r(mt.roughness), r(mt.metalness), r(mt.opacity), `transparent=${mt.transparent}`, `side=${mt.side}`, ...maps].join(' ');
}

// each mesh of a layer, in traversal order (group, then lift), as "type part: material | ..."
function looksOf(L) {
  const out = [];
  [L.group, L.lift].filter(Boolean).forEach(root => root.traverse(o => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    out.push(`${o.type} ${o.userData.part || ''}: ${ms.map(materialOf).join(' | ')}`);
  }));
  return out;
}

function looks() {
  const { built } = buildAll({ ...options, style: 'real', layers: { winter: true } });
  return Object.fromEntries(built.map(({ L }) => [L.id, looksOf(L)]));
}

test('every layer is drawn in the materials the baseline has, in the real style', () => {
  checkBaseline(BASELINE, looks());
});

// the fixture without its look: the neutral default
const bare = (() => { const m = { ...model }; delete m.look; return m; })();
const real = (m, look) => buildAll({ ...options, style: 'real' }, look === undefined ? m : { ...m, look });

test('look: the surface names are the validator\'s SURFACES', () => {
  const py = fileURLToPath(new URL('../../scripts/house3d_model.py', import.meta.url));
  const names = JSON.parse(execFileSync('python3', ['-I', '-c',
    'import importlib.util, json, sys; s = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); print(json.dumps(m.SURFACES))', py], { encoding: 'utf-8' }));
  assert.deepEqual(names, Object.keys(createKit(THREE, 'real').REAL));
});

test('look: without one, no trims, corner boards or base strip, and plain cladding', () => {
  const { byId } = real(bare);
  for (const part of ['trim', 'reveal', 'sill']) assert.equal(partsOf(byId.building, part).length, 0, part);
  const boards = [];
  [byId.building.group, byId.building.lift].forEach(r => r.traverse(o => { if (o.userData.part === 'corner' && o.geometry.type === 'BoxGeometry') boards.push(o); }));
  assert.equal(boards.length, 0, 'corner boards');
  const strips = [];
  byId.building.group.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.position.y - 0.06) < 1e-6 && Math.abs(o.geometry.parameters.height - 0.12) < 1e-6) strips.push(o); });
  assert.equal(strips.length, 0, 'base strips');
  // the walls' corners are still closed
  assert.ok(partsOf(byId.building, 'corner').length > 0, 'fillers');
  const walls = [];
  byId.building.group.traverse(o => { if (o.isMesh && Array.isArray(o.material)) walls.push(o); });
  assert.ok(walls.length >= 6);
  walls.forEach(w => w.material.forEach(mt => assert.equal(mt.map, null)));
});

test('look: without one, no building material in the fixture\'s cladding, frame or roof colour', () => {
  const ours = ['cladding', 'frame', 'roof'].map(n => new THREE.Color(model.look.surfaces[n].color || model.look.surfaces[n]).getHexString());
  const { byId } = real(bare);
  [byId.building.group, byId.building.lift].forEach(r => r.traverse(o => {
    if (!o.material) return;
    [o.material].flat().forEach(mt => assert.ok(!mt.color || !ours.includes(mt.color.getHexString()), `${o.type} ${o.userData.part || ''} #${mt.color && mt.color.getHexString()}`));
  }));
});

test('look: the fixture\'s look draws its own colours, trims and boards', () => {
  const { ctx, byId } = real(model);
  assert.equal(hexOf(ctx.kit, 'cladding'), 'bebeb8');
  assert.deepEqual(ctx.kit.look, { cladding: { pattern: 'boards', angle_deg: 45 }, trims: { openings: true, corners: true, base: true } });
  assert.ok(partsOf(byId.building, 'trim').length > 0);
});

test('look: a surface takes its own roughness and metalness, the rest keep theirs', () => {
  const kit = createKit(THREE, 'real', { surfaces: { deck: { color: '#123456', roughness: 0.3, metalness: 0.2 }, roof: '#654321' } });
  const deck = kit.surface('deck'), roof = kit.surface('roof'), glass = kit.surface('glass');
  assert.deepEqual([deck.color.getHexString(), deck.roughness, deck.metalness], ['123456', 0.3, 0.2]);
  assert.deepEqual([roof.color.getHexString(), roof.roughness, roof.metalness], ['654321', 0.85, 0]);
  assert.equal(glass.roughness, 0.15);
  // a caller's own options still win
  assert.equal(kit.surface('deck', { roughness: 0.5 }).roughness, 0.5);
});

test('look: an unknown or malformed surface, angle or trim in the look is ignored, not drawn', () => {
  const kit = createKit(THREE, 'real', { surfaces: { brick: '#aa0000', constructor: '#aa0000', roof: null, deck: { roughness: 0.3 } }, cladding: { pattern: 'boards', angle_deg: 30 }, trims: { gutters: true, base: 'yes' } });
  assert.ok(!Object.hasOwn(kit.REAL, 'brick') && !Object.hasOwn(kit.REAL, 'constructor'));
  assert.deepEqual([kit.REAL.roof, kit.REAL.deck], [createKit(THREE, 'real').REAL.roof, createKit(THREE, 'real').REAL.deck]);
  assert.equal(kit.look.cladding.angle_deg, 45);
  assert.deepEqual(kit.look.trims, { openings: false, corners: false, base: false });
});

test('look: boards at 45 are the default angle, at 0 and 90 grooves along rows or columns that tile', () => {
  const data = look => createKit(THREE, 'real', { cladding: look }).boards()[0].image.data;
  assert.deepEqual(data({ pattern: 'boards' }), data({ pattern: 'boards', angle_deg: 45 }));
  const S = 512, px = (d, i, j) => d[(j * S + i) * 4];
  for (const [angle, line] of [[0, (d, k) => [px(d, 0, k), px(d, S - 1, k)]], [90, (d, k) => [px(d, k, 0), px(d, k, S - 1)]]]) {
    const d = data({ pattern: 'boards', angle_deg: angle });
    // each row (0) or column (90) is one shade along its length
    for (let k = 0; k < S; k++) { const [a, b] = line(d, k); assert.equal(a, b, `${angle}: ${k}`); }
    // the grooves across: as many as boards, the first at the tile's edge, so the tile's edges meet
    const across = Array.from({ length: S }, (_, k) => (angle === 0 ? px(d, 0, k) : px(d, k, 0)));
    const starts = across.filter((v, k) => v < 255 && across[(k + S - 1) % S] === 255).length;
    assert.equal(starts, 17, `${angle}: boards across the tile`);
    assert.ok(across[0] < 255, `${angle}: a groove at the edge`);
    assert.equal(across[S - 1], 255, `${angle}: a board up to the other edge`);
  }
});
