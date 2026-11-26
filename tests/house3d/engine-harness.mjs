// The engine tests' shared harness on the synthetic fixture, imported by tests/house3d/engine-*.test.mjs
// (node --test picks up only *.test.mjs, so this is no test file): the engine's modules loaded
// in Node with the vendored three.js, the fixture model, the ctx mount() builds without a
// renderer, camera or loop, and every helper more than one of the test files uses.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const E = new URL('../../house3d/', import.meta.url);
export const SNAPSHOT = new URL('./simple-snapshot.json', import.meta.url);
export const LAYERS = ['ground', 'site', 'trees', 'gates', 'surroundings', 'pergola', 'building', 'interior', 'lights', 'winter', 'car', 'future', 'fans'];

// of what the tests run under scene/, only kit.canvasTexture touches the DOM (the overlay's
// createOverlay() builds DOM too, but no test mounts the view)
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '' })
  })
};

export const THREE = await import(new URL('vendor/three-0.187.0/build/three.module.js', E));
export const { createKit } = await import(new URL('scene/kit.js', E));
export const { createLook } = await import(new URL('scene/look.js', E));
export const { photoLook } = await import(new URL('scene/photo.js', E));
export const BUILDERS = await Promise.all(LAYERS.map(id => import(new URL(`scene/layers/${id}.js`, E))));
export const { modelFrame, seasonOn, seasonWindow, buildLayer, guardLayer, syncCamera, toScreen, releaseVelocity, coast, homeBox, homeDir, homeView, pvNow, roofNormal, roofTop, tapAction, aoWanted, resolveStyle, autoQuality } = await import(new URL('house3d.js', E));
export const { collide, inChip, hitRect } = await import(new URL('scene/overlay.js', E));
export const { OrbitControls } = await import(new URL('vendor/three-0.187.0/examples/jsm/controls/OrbitControls.js', E));
export const { sunPosition, gridBearing, sunDirection, sunGlow, realLight } = await import(new URL('scene/sun.js', E));
export const { cornerBoards } = await import(new URL('scene/layers/building.js', E));
export const { panelGrid } = await import(new URL('scene/layers/future.js', E));
export const { icicleLeds, spruce } = await import(new URL('scene/layers/winter.js', E));

// a fixture under tests/house3d/, every layer merged as house3d_model.py gives it
export const loadModel = name => JSON.parse(execFileSync('python3', ['-I', fileURLToPath(new URL('../../scripts/house3d_model.py', import.meta.url)), '--layers', 'all',
  fileURLToPath(new URL(`./${name}`, import.meta.url))], { encoding: 'utf-8' }));
export const model = loadModel('fixture-model.md');

// the fixture's first interior wall with doors
export const INNER = model.walls.findIndex(w => typeof w.top === 'number' && !w.finish && (w.openings || []).length);
assert.ok(INNER >= 0, 'the fixture has an interior wall with doors');

// what the card passes besides the model
export const options = {
  car: model.car && model.car.profile && model.car.path ? { profile: model.car.profile, path: model.car.path } : undefined,
  surroundings: model.surroundings
};

// the ctx mount() builds, without a renderer, camera or loop
export function makeCtx(opts = options, m = model) {
  const { style, stage } = resolveStyle(opts);
  const kit = createKit(THREE, style, m.look);
  const look = createLook(THREE, kit, style, { light: realLight, photo: photoLook, quality: opts.quality });
  const { roof, frame } = modelFrame(m);
  const byId = {};
  const ctx = {
    THREE, kit, C: kit.C, model: m, options: opts, style: look.id, look, stage, reduceMotion: false,
    state: { mode: 'roof', roofFade: 1, hovered: null, selection: null, night: 0 },
    screen: () => null,
    frame, roof,
    ceiling: m.ceiling,
    layer: id => byId[id] || null,
    invalidate: () => {}
  };
  return { ctx, byId };
}

export function buildAll(opts, m = model) {
  const { ctx, byId } = makeCtx(opts, m);
  const built = [];
  BUILDERS.forEach((mod, i) => {
    const L = mod.default(ctx);
    if (!L) return;
    byId[L.id] = L;
    built.push({ want: LAYERS[i], L });
  });
  return { ctx, built, byId };
}

// one layer's objects in traversal order (group, then lift), each with its material's id; the
// ids give which objects share a material instance
export function describeLayer(L) {
  const ids = new Map(), materials = {}, objects = [];
  const r = v => Number(v.toFixed(4));
  [L.group, L.lift].filter(Boolean).forEach(root => root.traverse(o => {
    let line = `${o.type} ${o.renderOrder}`;
    if (o.material) {
      const mt = o.material;
      if (!ids.has(mt)) {
        const id = `m${ids.size}`;
        ids.set(mt, id);
        materials[id] = `${mt.type} #${mt.color ? mt.color.getHexString() : '-'} ${r(mt.opacity)} transparent=${mt.transparent} depthWrite=${mt.depthWrite} side=${mt.side}`;
      }
      line += ` ${ids.get(mt)}`;
    }
    objects.push(line);
  }));
  return { materials, objects };
}

export const hexOf = (kit, n) => new THREE.Color(kit.REAL[n]).getHexString();

// a layer's meshes tagged userData.part, in traversal order
export const partsOf = (L, part) => { const out = []; L.group.traverse(o => { if (o.userData.part === part) out.push(o); }); return out; };

export const winterOf = (o = {}) => buildAll({ ...options, style: 'real', ...o });

export const futureItem = id => model.future.items.find(it => it.id === id);

// a baseline test's check: snap against the committed JSON at url, key by key; with
// UPDATE_BASELINE=1, or with none committed yet, writes snap there instead
export function checkBaseline(url, snap) {
  if (process.env.UPDATE_BASELINE === '1' || !existsSync(url)) {
    writeFileSync(url, JSON.stringify(snap, null, 1) + '\n');
    if (process.env.UPDATE_BASELINE !== '1') assert.fail('no baseline yet: wrote one, check it in and rerun');
    return;
  }
  const want = JSON.parse(readFileSync(url, 'utf-8'));
  assert.deepEqual(Object.keys(snap).sort(), Object.keys(want).sort());
  for (const k of Object.keys(want)) assert.deepEqual(snap[k], want[k], k);
}
