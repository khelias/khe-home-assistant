// Engine tests on the synthetic fixture, the core's part: every layer builds, the simple style
// matches tests/house3d/simple-snapshot.json, the scene/ import rule, the layer guards, the
// camera, the season, the sun, the kit and the real style's materials. The set-up is in
// engine-harness.mjs; scripts/house3d-test.sh runs every engine-*.test.mjs.
// UPDATE_SNAPSHOT=1 node --test tests/house3d/engine-core.test.mjs rewrites the snapshot instead
// of comparing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import {
  E, SNAPSHOT, LAYERS, THREE, createKit, BUILDERS, seasonOn, seasonWindow, buildLayer, guardLayer,
  syncCamera, toScreen, releaseVelocity, coast, homeBox, homeDir, homeView, pvNow, roofNormal,
  roofTop, OrbitControls, sunPosition, gridBearing, sunDirection, sunGlow, realLight, model,
  options, makeCtx, buildAll, describeLayer, hexOf, aoWanted
} from './engine-harness.mjs';

test('aoWanted: the real style, not switched off, wide enough and the roof fully off', () => {
  const on = { real: true, ao: undefined, width: 720, roofFade: 0 };
  assert.equal(aoWanted(on), true);
  assert.equal(aoWanted({ ...on, ao: true }), true);
  assert.equal(aoWanted({ ...on, roofFade: 0.01 }), true, 'the fade counts as off from 0.01');
  assert.equal(aoWanted({ ...on, real: false }), false, 'the simple style');
  assert.equal(aoWanted({ ...on, ao: false }), false, 'switched off');
  assert.equal(aoWanted({ ...on, width: 719 }), false, 'too narrow');
  assert.equal(aoWanted({ ...on, roofFade: 0.02 }), false, 'the roof is coming on');
});

test('the vendored contact shadow pass is whole and still has the method the engine wraps', () => {
  const jsm = new URL('vendor/three-0.186.1/examples/jsm/', E);
  ['postprocessing/GTAOPass.js', 'postprocessing/Pass.js', 'shaders/GTAOShader.js', 'shaders/PoissonDenoiseShader.js', 'shaders/CopyShader.js', 'math/SimplexNoise.js']
    .forEach(f => assert.ok(existsSync(new URL(f, jsm)), f));
  const src = readFileSync(new URL('postprocessing/GTAOPass.js', jsm), 'utf-8');
  assert.match(src, /_overrideVisibility\(\) \{/);
  assert.match(src, /_visibilityCache/);
});

test('every layer builds and returns id and group', () => {
  // the interior is the real style's alone
  [[{}, LAYERS.filter(id => id !== 'interior')], [{ style: 'real' }, LAYERS]].forEach(([o, want]) => {
    const { built } = buildAll({ ...options, ...o });
    assert.deepEqual(built.map(b => b.L.id), want, 'the fixture has something for every layer');
    built.forEach(({ want, L }) => {
      assert.equal(L.id, want);
      assert.ok(L.group && L.group.isObject3D, `${want} has a group`);
    });
  });
});

test('car and surroundings build from the options, not the model', () => {
  const { byId } = buildAll();
  assert.ok(byId.car);
  assert.ok(byId.surroundings);
  const bare = buildAll({});
  assert.equal(bare.byId.car, undefined);
  assert.equal(bare.byId.surroundings, undefined);
});

test('the simple style matches the snapshot', () => {
  const { built } = buildAll();
  const snap = Object.fromEntries(built.map(({ L }) => [L.id, describeLayer(L)]));
  if (process.env.UPDATE_SNAPSHOT === '1' || !existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 1) + '\n');
    if (process.env.UPDATE_SNAPSHOT !== '1') assert.fail('no snapshot yet: wrote one, check it in and rerun');
    return;
  }
  const want = JSON.parse(readFileSync(SNAPSHOT, 'utf-8'));
  for (const id of new Set([...Object.keys(want), ...Object.keys(snap)])) assert.deepEqual(snap[id], want[id], `layer ${id}`);
});

test('modules under scene/ import nothing', () => {
  const rx = /\bimport\s*[('"]|\bfrom\s*['"]/;
  const dir = new URL('scene/', E);
  const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 5);
  files.forEach(f => assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf-8'), rx, `scene/${f}`));
});

// console.error calls during fn, with the console kept quiet
function errorsOf(fn) {
  const seen = [], orig = console.error;
  console.error = (...args) => seen.push(args.map(String).join(' '));
  try { return { result: fn(), seen }; } finally { console.error = orig; }
}

test('buildLayer: a layer that throws builds as null and logs', () => {
  const broken = structuredClone(model);
  broken.site.garage_roof = {};
  const { ctx } = makeCtx(options, broken);
  const { result, seen } = errorsOf(() => buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', ctx));
  assert.equal(result, null);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^house3d: layer building failed/);
  // the rest still builds from the same ctx
  assert.ok(buildLayer(BUILDERS[LAYERS.indexOf('site')], 'site', ctx));
});

test('guardLayer: a throwing update switches the layer off once', () => {
  let calls = 0, offs = 0;
  const L = guardLayer({
    id: 'bad',
    update() { calls++; throw new Error('boom'); },
    hit() { throw new Error('boom'); },
    api: { poke() { throw new Error('boom'); }, get state() { return 'x'; } }
  }, () => offs++);
  const { result, seen } = errorsOf(() => [L.update(0.016, 0.1), L.update(0.016, 0.1), L.hit({}), L.api.poke()]);
  assert.deepEqual(result, [false, false, null, undefined]);
  assert.equal(calls, 1, 'not called again after the throw');
  assert.equal(offs, 1);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^house3d: layer bad failed/);
  assert.equal(L.api.state, 'x', 'getters are left alone');
});

test('guardLayer: a working layer passes through', () => {
  let offs = 0;
  const L = guardLayer({ id: 'ok', update: (dt, k) => dt + k, hit: r => r }, () => offs++);
  assert.equal(L.update(1, 2), 3);
  assert.equal(L.hit('ray'), 'ray');
  assert.equal(offs, 0);
});

// coordinates as two-decimal positional arguments: the commit gate's ee-gps rules catch more
test('sunPosition: NOAA values for a midsummer and a midwinter noon', () => {
  const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v} is not ${want} +- ${tol}`);
  const june = sunPosition(new Date('2026-06-21T10:00Z'), 59.44, 24.75);
  near(june.altitude, 53.8, 0.3, 'June altitude');
  near(june.azimuth, 171.1, 0.3, 'June azimuth');
  near(sunPosition(new Date('2026-12-21T10:00Z'), 59.44, 24.75).altitude, 7.0, 0.3, 'December altitude');
  assert.ok(sunPosition(new Date('2026-06-21T22:00Z'), 59.44, 24.75).altitude < 0, 'below the horizon at midnight');
});

test('sunDirection and gridBearing', () => {
  const close = (v, want) => v.forEach((x, i) => assert.ok(Math.abs(x - want[i]) < 0.01, `${v} is not ${want}`));
  close(sunDirection(0, 0, 0), [1, 0, 0]);
  close(sunDirection(0, 90, 0), [0, 0, 1]);
  close(sunDirection(0, 90, 100.38), [0.98, 0, -0.18]);
  close(sunDirection(90, 0, 0), [0, 1, 0]);
  assert.equal(gridBearing(90, 24), 90);
  assert.ok(Math.abs(gridBearing(90, 26.5) - 87.87) < 0.01);
});

// the real style: each surface colour has one shadow role per layer, [castShadow, receiveShadow]
const REAL_FLAGS = {
  building: { cladding: [true, true], interior: [true, true], frame: [true, true], door: [true, true], glass: [false, false], floor: [false, true], tile: [false, true], roof: [true, true], paving: [false, true] },
  site: {
    deck: [false, true], paving: [false, true], hedge: [true, false], unit: [true, false], fence: [true, false],
    stone: [false, true], frame: [true, false], cladding: [true, false], mesh: [false, false],
    timber: [true, false], sand: [false, true], slide: [true, false], nest: [true, false], pad: [true, false], mat: [true, false], net: [false, false]
  },
  gates: { fence: [true, false] },
  // the winter layer's caps on the crowns hang in the trees' group
  trees: { trunk: [true, false], crown: [true, false], snow: [false, true] },
  pergola: { frame: [true, false] },
  car: { car: [true, false], glass: [false, false] }
};

test('real style: lit materials and shadow flags', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const names = new Map(Object.entries(ctx.kit.REAL).map(([k, v]) => [new THREE.Color(v).getHexString(), k]));
  // the car casts only once fully shown
  byId.car.api.setCar('parked');
  byId.car.update(1, 1);
  const seen = {}, lifted = new Set();
  for (const [id, want] of Object.entries(REAL_FLAGS)) {
    const L = byId[id];
    seen[id] = new Set();
    [L.group, L.lift].filter(Boolean).forEach(root => root.traverse(o => {
      if (!o.isMesh) return;
      [o.material].flat().forEach(mt => {
        assert.equal(mt.type, 'MeshStandardMaterial', `${id}: a ${o.geometry.type}`);
        const name = names.get(mt.color.getHexString());
        assert.ok(name in want, `${id}: unexpected surface ${name}`);
        seen[id].add(name);
        if (root === L.lift) lifted.add(`${id} ${name}`);
        assert.deepEqual([o.castShadow, o.receiveShadow], want[name], `${id}: ${name} shadow flags`);
      });
    }));
  }
  assert.ok(seen.building.has('frame'));
  assert.ok(lifted.has('building frame'), 'the roof edges and the upper corner boards');
  // the roofs' edge band and the carport roof's fascia: frame round a roof grey face
  const hex = n => new THREE.Color(ctx.kit.REAL[n]).getHexString();
  const edged = byId.building.lift.children.filter(o => o.isMesh && Array.isArray(o.material) && o.material.some(m => m.color.getHexString() === hex('roof')));
  assert.equal(edged.filter(o => o.geometry.type === 'ExtrudeGeometry').length, Object.keys(model.roofs).length);
  assert.equal(edged.filter(o => o.geometry.type === 'BoxGeometry').length, model.site.garage_roof.rects.length);
  edged.forEach(o => assert.ok(o.material.some(m => m.color.getHexString() === hex('frame')), o.geometry.type));
  assert.ok(seen.building.has('tile'), 'a room with floor tile');
});

test('kit: every real-style colour is distinct', () => {
  const { REAL } = createKit(THREE, 'real');
  const hexes = Object.values(REAL).map(v => new THREE.Color(v).getHexString());
  assert.equal(new Set(hexes).size, hexes.length);
});

test('kit: pavers() is one texture per mount on a metre tile', () => {
  const kit = createKit(THREE, 'real'), t = kit.pavers();
  assert.equal(kit.pavers(), t);
  assert.notEqual(createKit(THREE, 'real').pavers(), t, 'a mount of its own');
  assert.equal(t.wrapS, THREE.RepeatWrapping);
  assert.equal(t.wrapT, THREE.RepeatWrapping);
  assert.ok(Math.abs(t.repeat.x - 1 / 0.9) < 1e-9 && Math.abs(t.repeat.y - 1 / 0.9) < 1e-9);
  // joints at 1, stones darker, shades vary
  const vals = new Set();
  for (let i = 0; i < t.image.data.length; i += 4) vals.add(t.image.data[i]);
  assert.ok(vals.has(255) && Math.min(...vals) >= Math.round(0.88 * 0.96 * 255) - 1 && vals.size > 3);
});

test('kit: planks() and tiles() are one texture per mount on a 2.4 m tile, near white', () => {
  ['planks', 'tiles'].forEach(name => {
    const kit = createKit(THREE, 'real'), t = kit[name]();
    assert.equal(kit[name](), t, name);
    assert.notEqual(createKit(THREE, 'real')[name](), t, `${name}: a mount of its own`);
    assert.equal(t.wrapS, THREE.RepeatWrapping);
    assert.ok(Math.abs(t.repeat.x - 1 / 2.4) < 1e-9 && Math.abs(t.repeat.y - 1 / 2.4) < 1e-9);
    // the material's colour sets the tone: pieces near white, shades varying, a joint apart
    const vals = new Set();
    for (let i = 0; i < t.image.data.length; i += 4) vals.add(t.image.data[i]);
    assert.ok(vals.size > 4 && Math.min(...vals) >= 150, name);
  });
  const kit = createKit(THREE, 'real');
  assert.notEqual(kit.planks(), kit.tiles());
});

test('kit: the section cap is not the frame, the plain furniture not the walls', () => {
  const kit = createKit(THREE, 'real');
  assert.notEqual(hexOf(kit, 'cut'), hexOf(kit, 'frame'));
  assert.notEqual(hexOf(kit, 'furniture'), hexOf(kit, 'interior'));
});

test('kit: bars() has two rails and a bar every 0.12 m, ends included, casting only', () => {
  const kit = createKit(THREE, 'real'), m = kit.surface('fence'), g = kit.bars(1.2, 1.2, m);
  const rails = g.children.filter(o => !o.isInstancedMesh), im = g.children.find(o => o.isInstancedMesh);
  assert.equal(rails.length, 2);
  assert.deepEqual(rails.map(r => r.position.y), [0.05, 1.2]);
  assert.equal(im.count, 11);
  const at = new THREE.Matrix4(), p = new THREE.Vector3(), xs = [];
  for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, at); xs.push(p.setFromMatrixPosition(at).x); }
  xs.forEach((x, i) => assert.ok(Math.abs(x - i * 0.12) < 1e-6 && x >= -1e-6 && x <= 1.2 + 1e-6));
  g.children.forEach(o => assert.deepEqual([o.castShadow, o.receiveShadow], [true, false]));
});

test('kit: wireMesh() alpha is a wire or the veil, nothing between', () => {
  const t = createKit(THREE, 'real').wireMesh(), alphas = new Set();
  for (let i = 3; i < t.image.data.length; i += 4) alphas.add(t.image.data[i]);
  assert.deepEqual([...alphas].sort((a, b) => a - b), [26, 255]);
  assert.ok(Math.abs(t.repeat.x - 5) < 1e-9);
});

test('sunGlow: hidden below the horizon, fading in, warm when low', () => {
  assert.equal(sunGlow(-5).visible, false);
  const low = sunGlow(1);
  assert.ok(low.visible && low.opacity > 0 && low.opacity < 1);
  assert.equal(low.warm, 1);
  assert.deepEqual(sunGlow(30), { visible: true, opacity: 1, warm: 0 });
});

test('realLight: the sun by day, the moon at night, dark at the horizon where they swap', () => {
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const day = realLight(30), low = realLight(10), dusk = realLight(2), noon = realLight(0), night = realLight(-20);
  assert.equal(day.key.dir, null);
  assert.equal(low.key.intensity, day.key.intensity, 'a low winter sun is not dimmed twice');
  assert.equal(realLight(3).key.intensity, day.key.intensity, 'full from 3 degrees');
  assert.equal(realLight(-6).key.intensity, night.key.intensity, 'the moon full from 6 degrees under');
  assert.ok(lum(low.key.color) < lum(day.key.color), 'a low sun is warm');
  assert.ok(dusk.key.intensity > 0 && dusk.key.intensity < day.key.intensity);
  assert.equal(noon.key.intensity, 0);
  assert.ok(Array.isArray(night.key.dir) && night.key.dir[0] < 0 && night.key.dir[2] < 0, 'the moon shines from the home view\'s side');
  assert.ok(night.key.intensity > 0 && realLight(-3).key.intensity < night.key.intensity);
  assert.ok(lum(night.zenith) < lum(night.horizon) && lum(night.horizon) < lum(day.horizon));
  assert.deepEqual([day.night, noon.night, night.night], [0, 1, 1]);
  assert.ok(night.env.intensity <= day.env.intensity);
  assert.equal(night.fill.intensity, 0);
  assert.equal(noon.fill.intensity, 0);
  assert.equal(realLight(3).fill.intensity, day.fill.intensity);
  assert.ok(day.fill.intensity > 0 && day.fill.dir[0] < 0 && day.fill.dir[2] < 0, 'the fill comes from the home view\'s side');
});

// OrbitControls on a stub canvas: listeners and a style are all it touches outside a gesture
function orbit(aspect = 1.5) {
  const on = { addEventListener() {}, removeEventListener() {} };
  const dom = { ...on, style: {}, getRootNode: () => on, ownerDocument: on };
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 500);
  camera.position.set(-10, 12, -30);
  const controls = new OrbitControls(camera, dom);
  controls.target.set(7, 0.3, 6);
  syncCamera(controls, camera);
  return { camera, controls };
}

test('syncCamera: markers project through this frame\'s camera, not the last one', () => {
  const { camera, controls } = orbit();
  const pts = [[8.3, 1.1, 2.3], [16.9, 2.3, 6.9], [4.5, 2.5, 11.8]];
  // an orbit step: the camera moves round the target, update() turns it to look at the target
  camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
  controls.update();
  // the old order projected here, before the world matrix had the new rotation
  const before = pts.map(p => toScreen(camera, p, 800, 600));
  syncCamera(controls, camera);
  const after = pts.map(p => toScreen(camera, p, 800, 600));
  // the reference: a fresh camera at the same pose, its matrices built from scratch
  const ref = new THREE.PerspectiveCamera(38, 1.5, 0.1, 500);
  ref.position.copy(camera.position);
  ref.quaternion.copy(camera.quaternion);
  ref.updateMatrixWorld();
  pts.forEach((p, i) => {
    const want = toScreen(ref, p, 800, 600);
    assert.ok(Math.hypot(after[i].x - want.x, after[i].y - want.y) < 1e-6, 'synced');
    assert.ok(Math.hypot(before[i].x - want.x, before[i].y - want.y) > 5, 'the old order lags');
  });
  assert.equal(toScreen(camera, camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), -5), 800, 600), null, 'behind the camera');
});

test('releaseVelocity: the rate over the last 80 ms, zero after a hold', () => {
  const s = [0, 20, 40, 60, 80, 100].map(t => ({ t, az: t * 0.002, polar: 1 - t * 0.001 }));
  const v = releaseVelocity(s, 100);
  assert.ok(Math.abs(v.az - 2) < 1e-9 && Math.abs(v.polar + 1) < 1e-9);
  // held still for 120 ms before the release: the window holds the release sample alone
  assert.deepEqual(releaseVelocity([...s, { t: 220, az: 0.2, polar: 0.9 }], 220), { az: 0, polar: 0 });
  // across the +-pi seam the short way round
  const w = releaseVelocity([{ t: 0, az: Math.PI - 0.05, polar: 1 }, { t: 50, az: -Math.PI + 0.05, polar: 1 }], 50);
  assert.ok(Math.abs(w.az - 2) < 1e-9);
  // a jump within a frame or two is no flick, and a fast flick is capped
  assert.deepEqual(releaseVelocity([{ t: 0, az: 0, polar: 1 }, { t: 16, az: 1.9, polar: 1 }], 16), { az: 0, polar: 0 });
  const fast = releaseVelocity([{ t: 0, az: 0, polar: 1 }, { t: 40, az: 1.2, polar: 1 }], 40);
  assert.ok(Math.abs(fast.az - 4) < 1e-9 && fast.polar === 0);
});

test('coast: decays with a 0.35 s time constant, independent of the frame rate', () => {
  const v = { az: 3, polar: -1 };
  const one = coast(v, 0.35);
  assert.ok(Math.abs(one.v.az - 3 / Math.E) < 1e-9 && Math.abs(one.v.polar + 1 / Math.E) < 1e-9);
  // two half steps travel as far as one whole one
  const a = coast(v, 0.1), b = coast(a.v, 0.1), whole = coast(v, 0.2);
  assert.ok(Math.abs(a.d.az + b.d.az - whole.d.az) < 1e-12);
  // the whole coast travels v * tau
  let cur = v, total = 0;
  for (let i = 0; i < 600; i++) { const c = coast(cur, 1 / 60); total += c.d.az; cur = c.v; }
  assert.ok(Math.abs(total - 3 * 0.35) < 1e-6);
});

test('homeView: the house rooms fit with a margin at every aspect, the carport left out', () => {
  const box = homeBox(model);
  const house = model.rooms.filter(r => r.floor !== 'paving');
  assert.deepEqual(box.slice(0, 4), [21.7, 1.7, 37.3, 22.3], 'the rooms and the roofs\' overhang, not the carport');
  assert.ok(box[4] >= 4.6, 'up to the highest roof');
  [0.46, 0.75, 1.33, 2.0].forEach(aspect => {
    const dir = homeDir(aspect), { target, distance } = homeView(box, dir, aspect, 38);
    const cam = new THREE.PerspectiveCamera(38, aspect, 0.1, 500);
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    const W = 1000 * aspect, H = 1000;
    let minX = Infinity, maxX = -Infinity;
    house.forEach(r => r.rects.forEach(([x0, z0, x1, z1]) => [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z]) => [0, box[4]].forEach(y => {
      const p = toScreen(cam, [x, y, z], W, H);
      assert.ok(p, `aspect ${aspect}: in front`);
      assert.ok(p.x >= 0.04 * W && p.x <= 0.96 * W && p.y >= 0.04 * H && p.y <= 0.96 * H, `aspect ${aspect}: ${x}, ${y}, ${z} at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    }))));
    // centred across, and not lost in the middle of the screen
    assert.ok(Math.abs((minX + maxX) / 2 - W / 2) < 0.05 * W, `aspect ${aspect}: centred`);
    assert.ok(maxX - minX > 0.4 * W || aspect >= 1.9, `aspect ${aspect}: fills the view`);
  });
});

// a sun at alt degrees in the model's plane, from the horizontal direction [hx, hz]
const sunAt = (alt, [hx, hz]) => {
  const h = Math.cos(alt * Math.PI / 180), n = Math.hypot(hx, hz);
  return { alt, dir: [(hx / n) * h, Math.sin(alt * Math.PI / 180), (hz / n) * h] };
};

// an 8-degree roof falling to +x; the south is -z here
const EIGHT = [Math.sin(8 * Math.PI / 180), Math.cos(8 * Math.PI / 180), 0];

test('pvNow: nothing at night, 0.6-0.8 of kWp at a high southern sun, less low in the west, never past 0.8', () => {
  assert.equal(pvNow(10, EIGHT, null), 0);
  assert.equal(pvNow(10, EIGHT, sunAt(-5, [0, -1])), 0);
  assert.equal(pvNow(10, EIGHT, sunAt(0, [0, -1])), 0);
  const noon = pvNow(10, EIGHT, sunAt(54, [0, -1]));
  assert.ok(noon > 6 && noon < 8, `noon ${noon}`);
  const evening = pvNow(10, EIGHT, sunAt(10, [-1, 0]));
  assert.ok(evening > 0 && evening < noon / 2, `evening ${evening}`);
  for (let alt = 1; alt <= 90; alt += 1) for (const d of [[0, -1], [1, 0], [-1, 0], [1, -1]]) assert.ok(pvNow(10, EIGHT, sunAt(alt, d)) <= 8 + 1e-9);
  assert.equal(pvNow(10, EIGHT, sunAt(90, [0, -1])), 8, 'capped at 0.8 of kWp');
});

test('roofNormal: unit length, up, leaning to the side the roof falls to', () => {
  const n = roofNormal(model, 'wingN');
  assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-12);
  assert.ok(n[1] > 0.99 && n[0] < 0 && n[2] === 0, 'wingN falls west, to -x');
  const east = roofNormal({ roofs: { r: { slope: 0.1, falls: 'east' } } }, 'r');
  assert.ok(east[0] > 0);
  assert.ok(Math.abs(east[0] / east[1] - 0.1) < 1e-12);
});

test('roofTop: the building layer\'s roof slab top on the test house', () => {
  const { ctx } = makeCtx();
  const L = buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', ctx);
  for (const id of Object.keys(model.roofs)) {
    const top = roofTop(ctx.roof, model, id), thick = model.roofs[id].thick;
    const [x0, z0, x1, z1] = model.roofs[id].outline.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
    // the slab is the lift's extrusion whose footprint is this roof's outline
    const slab = L.lift.children.find(o => o.isMesh && o.geometry.type === 'ExtrudeGeometry' && (() => {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      return Math.abs(b.min.x - x0) < 1e-6 && Math.abs(b.max.x - x1) < 1e-6 && Math.abs(b.min.z - z0) < 1e-6 && Math.abs(b.max.z - z1) < 1e-6;
    })());
    assert.ok(slab, `${id} slab`);
    const pa = slab.geometry.attributes.position;
    let tops = 0;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), t = top(x);
      assert.ok(y <= t + 1e-6 && y >= t - thick - 1e-6, `${id} vertex ${i} at ${y} against top ${t}`);
      if (Math.abs(y - t) < 1e-6) tops++;
    }
    assert.ok(tops >= 4, `${id} has its top face on roofTop`);
  }
});

test('seasonOn and seasonWindow: 1 November to 31 March, the window across a new year', () => {
  const d = (y, m, day) => new Date(y, m - 1, day, 12);
  assert.equal(seasonOn(d(2026, 10, 31)), false);
  assert.equal(seasonOn(new Date(2026, 10, 1, 0, 0)), true);
  assert.equal(seasonOn(new Date(2027, 2, 31, 23, 59)), true);
  assert.equal(seasonOn(d(2027, 4, 1)), false);
  assert.equal(seasonWindow(d(2026, 11, 5)), '2026-11');
  assert.equal(seasonWindow(d(2026, 12, 31)), '2026-11');
  assert.equal(seasonWindow(d(2027, 1, 1)), '2026-11');
  assert.equal(seasonWindow(d(2027, 3, 31)), '2026-11');
  assert.equal(seasonWindow(d(2027, 4, 1)), 'gap-2027');
  assert.equal(seasonWindow(d(2026, 10, 31)), 'gap-2026');
});
