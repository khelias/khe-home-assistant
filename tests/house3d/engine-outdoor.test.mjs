// Engine tests of the outdoor layers on the synthetic fixture: site, gates, ground and
// surroundings, car, lights, winter and future. The set-up is in engine-harness.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYERS, THREE, createKit, BUILDERS, buildLayer, panelGrid, icicleLeds, spruce, model, options, makeCtx,
  buildAll, hexOf, partsOf, winterOf, futureItem
} from './engine-harness.mjs';

test('real style: the car casts only while fully shown', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const body = byId.car.group.children.find(o => o.isMesh);
  assert.equal(body.castShadow, false);
  byId.car.api.setCar('parked');
  byId.car.update(0.016, 0.5);
  assert.equal(body.castShadow, false, 'half faded in');
  byId.car.update(1, 1);
  assert.equal(body.castShadow, true);
  byId.car.api.setCar('away');
  byId.car.update(0.016, 0.5);
  assert.equal(body.castShadow, false);
});

test('real style: paving and the carport floor carry the stones on world (x, z)', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const paving = byId.site.group.children.filter(o => o.isMesh && o.material.color.getHexString() === hexOf(ctx.kit, 'paving'));
  assert.equal(paving.length, 3, 'the two pavings and the porch');
  paving.forEach(m => {
    assert.equal(m.material.map, ctx.kit.pavers());
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv, nor = m.geometry.attributes.normal;
    const top = Math.max(...Array.from({ length: pos.count }, (_, k) => pos.getY(k)));
    let n = 0;
    // the top face's vertices: at the top, facing up or down (the extrusion's caps), not the sides
    for (let k = 0; k < pos.count; k++) {
      if (Math.abs(pos.getY(k) - top) > 1e-6 || Math.abs(nor.getY(k)) < 0.99) continue;
      n++;
      assert.ok(Math.abs(uv.getX(k) - pos.getX(k)) < 1e-6 && Math.abs(uv.getY(k) - pos.getZ(k)) < 1e-6, 'top-face uv is world (x, z)');
    }
    assert.ok(n >= 4);
  });
  const floor = byId.building.group.children.find(o => o.userData.room === 'carport');
  assert.equal(floor.material.map, ctx.kit.pavers());
  floor.updateMatrixWorld(true);
  const pos = floor.geometry.attributes.position, uv = floor.geometry.attributes.uv, v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).applyMatrix4(floor.matrixWorld);
    // float32 attributes: a few 1e-6 at 37 m
    assert.ok(Math.abs(uv.getX(k) - v.x) < 1e-4 && Math.abs(uv.getY(k) - v.z) < 1e-4, 'carport floor uv is world (x, z)');
  }
});

test('real style: bar fences on the street, mesh fences on the sides, no post at a gate post', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const spans = partsOf(byId.site, 'bars');
  assert.ok(spans.length >= 2);
  let total = 0;
  spans.forEach(g => {
    const im = g.children.find(o => o.isInstancedMesh), len = g.children.find(o => !o.isInstancedMesh).geometry.parameters.width;
    assert.ok(Math.abs(g.position.z + 6) < 1e-9, 'along z -6');
    assert.ok(Math.abs(Math.sin(g.rotation.y)) < 1e-9, 'running along x');
    // n gaps of 0.12 m, n + 1 bars
    assert.ok(Math.abs(im.count - 1 - len / 0.12) <= 1, `${im.count} bars on ${len} m`);
    total += len;
  });
  const want = model.site.bar_fences.reduce((a, [p, q]) => a + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
  assert.ok(Math.abs(total - want) < 1e-6, 'the spans cover the bar fences');
  const gatePosts = model.site.gates.flatMap(g => [g.a, g.b]);
  const posts = partsOf(byId.site, 'post');
  assert.ok(posts.length > 6);
  posts.forEach(p => gatePosts.forEach(([x, z]) => assert.ok(Math.hypot(p.position.x - x, p.position.z - z) >= 0.05, `a post at ${x}, ${z}`)));
  const planes = partsOf(byId.site, 'mesh');
  assert.equal(planes.length, model.site.fences.length);
  planes.forEach(m => {
    assert.equal(m.material.map, ctx.kit.wireMesh());
    assert.ok(model.site.fences.some(([a, b]) => Math.hypot(m.position.x - (a[0] + b[0]) / 2, m.position.z - (a[1] + b[1]) / 2) < 1e-6), 'on a side segment');
  });
});

test('real style: the step, the planters and their plants', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const steps = byId.site.group.children.filter(o => o.isMesh && o.material.color.getHexString() === hexOf(ctx.kit, 'stone'));
  assert.equal(steps.length, 1);
  assert.ok(Math.abs(steps[0].position.y + steps[0].geometry.parameters.height / 2 - 0.115) < 1e-9);
  const planters = partsOf(byId.site, 'planter');
  assert.equal(planters.length, 3);
  planters.forEach(p => assert.equal(p.castShadow, true));
  assert.deepEqual(planters.map(p => p.material.color.getHexString()), [hexOf(ctx.kit, 'frame'), hexOf(ctx.kit, 'cladding'), hexOf(ctx.kit, 'frame')]);
});

test('real style: the swing, its tower and slide, the sandpit and the trampoline', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const sw = model.site.swing, L = byId.site;
  L.group.updateMatrixWorld(true);
  const legs = partsOf(L, 'leg');
  assert.equal(legs.length, 4 + 4 + 6, 'two A-frames, the tower and the trampoline');
  legs.forEach(l => assert.equal(Math.min(l.userData.ends[0][1], l.userData.ends[1][1]), 0));
  const [beam] = partsOf(L, 'beam');
  assert.ok(Math.abs(new THREE.Box3().setFromObject(beam).max.y - sw.height) < 1e-6, 'the beam top at height');
  const [chute] = partsOf(L, 'chute'), foot = chute.userData.ends[1];
  assert.ok(Math.hypot(foot[0] - sw.slide[0], foot[2] - sw.slide[1]) <= 0.15);
  // the chute lies flat across its slope
  const across = new THREE.Vector3(1, 0, 0).applyQuaternion(chute.quaternion);
  assert.ok(Math.abs(across.y) < 1e-6);
  // the tower is at the beam end nearer to the slide
  const [platform] = partsOf(L, 'platform');
  assert.ok(platform.position.z > sw.rect[3], 'past the end at z1');
  const [sand] = partsOf(L, 'sand'), ledges = partsOf(L, 'ledge');
  const topOf = o => new THREE.Box3().setFromObject(o).max.y;
  assert.ok(topOf(sand) < Math.min(...ledges.map(topOf)) - 0.05);
  const [net] = partsOf(L, 'net');
  assert.ok(net.material.transparent && net.material.opacity < 1 && !net.material.depthWrite);
  const b = new THREE.Box3().setFromObject(net), [x0, z0, x1, z1] = model.site.trampoline.rect;
  assert.ok(b.min.x >= x0 - 1e-6 && b.max.x <= x1 + 1e-6 && b.min.z >= z0 - 1e-6 && b.max.z <= z1 + 1e-6, 'the net inside the rect');
});

test('real style: a swing without slide along x, and a site without the new keys', () => {
  const m = structuredClone(model);
  m.site.swing = { rect: [6, -4, 9, -3.8], height: 2.2 };
  ['bar_fences', 'trampoline', 'planters', 'steps', 'sandpit'].forEach(k => delete m.site[k]);
  const { ctx } = makeCtx({ ...options, style: 'real' }, m);
  const L = buildLayer(BUILDERS[LAYERS.indexOf('site')], 'site', ctx);
  assert.ok(L);
  assert.equal(partsOf(L, 'chute').length, 0);
  assert.equal(partsOf(L, 'leg').length, 4);
  assert.equal(partsOf(L, 'bars').length, 0);
  assert.equal(partsOf(L, 'mesh').length, m.site.fences.length);
  const [beam] = partsOf(L, 'beam');
  assert.ok(Math.abs(beam.userData.ends[0][2] - beam.userData.ends[1][2]) < 1e-9, 'the beam runs along x');
  // with a slide on an x-axis swing, the climbing wall's width lies across the beam
  m.site.swing.slide = [10.5, -3];
  const L2 = buildLayer(BUILDERS[LAYERS.indexOf('site')], 'site', makeCtx({ ...options, style: 'real' }, m).ctx);
  const [wall] = partsOf(L2, 'wall');
  assert.ok(Math.abs(new THREE.Vector3(1, 0, 0).applyQuaternion(wall.quaternion).z) > 0.99);
});

test('real style: the drive gate is bars and slides its width', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const gate = byId.gates.api.driveGate(model.car.path);
  const leaf = gate.leaves[0].pivot.children[0];
  assert.ok(leaf.isGroup && leaf.children.some(o => o.isInstancedMesh));
  byId.gates.group.updateMatrixWorld(true);
  const before = leaf.getWorldPosition(new THREE.Vector3());
  byId.gates.api.setGate(gate, 1);
  byId.gates.group.updateMatrixWorld(true);
  assert.ok(Math.abs(leaf.getWorldPosition(new THREE.Vector3()).distanceTo(before) - gate.w) < 1e-9);
});

test('real style: the land beyond the lot darkens with the night', () => {
  const { ctx } = makeCtx({ ...options, style: 'real' });
  const L = buildLayer(BUILDERS[LAYERS.indexOf('ground')], 'ground', ctx);
  const out = L.group.children[0], day = out.material.color.clone();
  assert.ok(!L.update(0, 1), "the darkening is no animation");
  assert.ok(out.material.color.equals(day));
  ctx.state.night = 1;
  L.update(0, 1);
  assert.ok(Math.abs(out.material.color.r - day.r * 0.22) < 1e-9);
});

test('real style: the neighbours darken with the night, and the simple style has no update', () => {
  const { ctx } = makeCtx({ ...options, style: 'real' });
  const L = buildLayer(BUILDERS[LAYERS.indexOf('surroundings')], 'surroundings', ctx);
  const m = L.group.children[0].material, day = m.color.clone();
  assert.ok(!L.update(0, 1));
  assert.ok(m.color.equals(day));
  ctx.state.night = 1;
  L.update(0, 1);
  assert.ok(Math.abs(m.color.r - day.r * 0.45) < 1e-9);
  const simple = buildLayer(BUILDERS[LAYERS.indexOf('surroundings')], 'surroundings', makeCtx(options).ctx);
  assert.equal(simple.update, undefined);
});

test('lights layer: a fixture, halo and pool per light, lit only at night, casting nothing', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const L = byId.lights, of = part => L.group.children.filter(o => o.userData.part === part);
  const n = model.site.lights.length;
  assert.equal(n, 2);
  assert.deepEqual(['fixture', 'halo', 'pool'].map(p => of(p).length), [n, n, n]);
  L.group.traverse(o => assert.ok(!o.castShadow, 'casts nothing'));
  const wall = of('fixture').find(o => o.geometry.type === 'BoxGeometry'), { pos: [x, , z], face: [fx, fz] } = model.site.lights[1];
  const [dx, dz] = [wall.position.x - x, wall.position.z - z];
  assert.ok(dx * fx + dz * fz > 0 && Math.abs(dx * fz - dz * fx) < 1e-9, 'a wall light sits out from the wall along its face');
  of('pool').forEach(p => assert.ok(Math.abs(p.position.y - 0.14) < 1e-9, 'the pools lie over the decks and the step'));
  const settle = () => { for (let i = 0; i < 60; i++) L.update(0.05, 0.5); };
  settle();
  [...of('halo'), ...of('pool')].forEach(o => assert.equal(o.material.opacity, 0, 'nothing by day'));
  assert.equal(of('fixture')[0].material.emissiveIntensity, 0);
  ctx.state.night = 1;
  settle();
  [...of('halo'), ...of('pool')].forEach(o => assert.ok(o.material.opacity > 0, 'lit at night'));
  assert.ok(of('fixture')[0].material.emissiveIntensity > 1);
  const simple = buildAll().byId.lights;
  assert.equal(simple.group.children.length, 0, 'the simple style has no night');
  assert.equal(BUILDERS[LAYERS.indexOf('lights')].default(makeCtx(options, { ...model, site: { ...model.site, lights: [] } }).ctx), null);
});

test('site, trees and ground api: the hedges, tall plants and crowns as built, the ground\'s snow', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const hedges = byId.site.api.hedges();
  assert.equal(hedges.length, model.site.hedges.length);
  const hedge = byId.site.group.children.find(o => o.geometry && o.geometry.type === 'BoxGeometry' && o.material.color.getHexString() === new THREE.Color(createKit(THREE, 'real').REAL.hedge).getHexString());
  assert.ok(Math.abs(hedge.geometry.parameters.height - hedges[0].height) < 1e-9 && Math.abs(hedge.geometry.parameters.depth - hedges[0].width) < 1e-9);
  assert.deepEqual(hedges[0].a, model.site.hedges[0][0]);
  const plants = byId.site.api.planters(), thujas = model.site.planters.filter(p => p.plant === 'thuja');
  assert.equal(plants.length, thujas.length);
  const column = byId.site.group.children.find(o => o.geometry && o.geometry.type === 'LatheGeometry');
  assert.deepEqual(column.geometry.parameters.points.map(v => [v.x, v.y]), plants[0].profile, 'the thuja is turned from its outline');
  assert.deepEqual(column.position.toArray(), plants[0].pos);
  const slabs = byId.site.api.slabs();
  assert.equal(slabs.length, model.site.paving.length + model.site.decks.length);
  assert.deepEqual(slabs.map(q => q.top), [...model.site.paving.map(() => 0.02), ...model.site.decks.map(() => 0.12)]);
  assert.deepEqual(buildAll().byId.site.api.planters(), [], 'the simple style has no plants');
  const crowns = byId.trees.api.crowns();
  assert.deepEqual(Object.keys(crowns).sort(), model.site.trees.map(t => t.id).sort());
  const t4 = model.site.trees.find(t => t.id === 't4'), crown = byId.trees.group.children.find(o => o.geometry && o.geometry.type === 'IcosahedronGeometry' && o.position.x === t4.pos[0] && o.position.z === t4.pos[1]);
  assert.deepEqual(crowns.t4.centre, crown.position.toArray());
  assert.deepEqual(crowns.t4.radii, crown.scale.toArray());
  // the ground alone, so no winter layer has snowed on it
  const { ctx } = makeCtx({ ...options, style: 'real' });
  const G = buildLayer(BUILDERS[LAYERS.indexOf('ground')], 'ground', ctx), lawn = G.group.children[1].material, day = lawn.color.clone();
  G.api.snow(1);
  assert.ok(!lawn.color.equals(day) && lawn.color.r > day.r, 'the lawn whitens');
  ctx.state.night = 1;
  G.update(0, 1);
  const out = G.group.children[0].material;
  assert.ok(out.color.r < new THREE.Color(ctx.kit.REAL.snow).r * 0.3, 'the night darkens the snowed land beyond the lot');
  G.api.snow(0);
  assert.ok(lawn.color.equals(day), 'snow(0) restores the lawn');
});

const partsUnder = (root, part) => { const out = []; root.traverse(o => { if (o.userData.part === part) out.push(o); }); return out; };

test('winter layer: icicle strands in the lift with their halo and wall wash, the post on the ground', () => {
  const { byId } = winterOf(), L = byId.winter, info = L.group.userData.winter;
  const paths = model.site.festive.icicles;
  assert.equal(info.icicles.length, paths.length);
  info.icicles.forEach((ic, i) => {
    assert.deepEqual([ic.leds, ic.length], [icicleLeds(paths[i].path, paths[i].drop).leds.length, icicleLeds(paths[i].path).length]);
    assert.ok(ic.leds > ic.length * 12, `path ${i}: a curtain, ${ic.leds} LEDs on ${ic.length.toFixed(2)} m`);
    assert.equal(ic.lift, !paths[i].ground);
  });
  const roofLeds = partsUnder(L.lift, 'icicles'), groundLeds = partsUnder(L.group, 'leds');
  assert.equal(roofLeds.length, 1);
  assert.equal(partsUnder(L.lift, 'icicles-halo')[0].geometry, roofLeds[0].geometry, 'the halo shares the LEDs\' points');
  assert.equal(partsUnder(L.lift, 'wash').length, 1);
  assert.equal(partsUnder(L.group, 'wash').length, 0, 'no wash for the post');
  // the wash lies on the wall behind the eave, and the open carport front gets none
  const wash = partsUnder(L.lift, 'wash')[0].geometry.attributes.position, [carport, eave] = paths;
  let onEave = 0;
  for (let i = 0; i < wash.count; i++) {
    const [x, z] = [wash.getX(i), wash.getZ(i)];
    assert.ok(!(x > carport.path[0][0] - 0.1 && x < carport.path[1][0] + 0.1 && z < carport.path[0][2] + 1), `wash at the carport front, ${x}, ${z}`);
    if (Math.abs(z - eave.path[0][2]) < 0.5) { onEave++; assert.ok(z > eave.path[0][2] + 0.05, `the eave wash is on the wall behind the cable, not at it (${z})`); }
  }
  assert.ok(onEave > 0, 'the eave has a wash');
  const roofCount = info.icicles.filter(ic => ic.lift).reduce((n, ic) => n + ic.leds, 0), postCount = info.icicles.filter(ic => !ic.lift).reduce((n, ic) => n + ic.leds, 0);
  assert.equal(roofLeds[0].geometry.attributes.position.count, roofCount);
  assert.equal(groundLeds[0].geometry.attributes.position.count, postCount + info.plants);
  // the post's LEDs stand on its line, the roof's hang under their path
  const post = paths.find(p => p.ground), pos = groundLeds[0].geometry.attributes.position;
  for (let i = 0; i < postCount; i++) assert.ok(Math.abs(pos.getX(i) - post.path[0][0]) < 1e-6 && Math.abs(pos.getZ(i) - post.path[0][2]) < 1e-6);
  const rp = roofLeds[0].geometry.attributes.position, top = Math.max(...paths.filter(p => !p.ground).flatMap(p => p.path.map(q => q[1])));
  for (let i = 0; i < rp.count; i++) assert.ok(rp.getY(i) <= top + 1e-6);
  assert.equal(partsUnder(L.lift, 'cable').length, 1);
  assert.equal(partsUnder(L.group, 'cable').length, 1);
});

test('icicleLeds: a strand every 0.18 m with an LED every 7 cm, the drop cycling, LEDs along a climb', () => {
  const level = icicleLeds([[0, 3, 0], [3, 3, 0]], 0.4);
  assert.equal(level.wires.length, 2 + 17 * 2, 'the cable and 17 strands');
  assert.equal(level.length, 3);
  assert.deepEqual(level.runs, [[[0, 3, 0], [3, 3, 0]]]);
  const drops = [];
  for (let i = 3; i < level.wires.length; i += 2) drops.push(Number((level.wires[i - 1][1] - level.wires[i][1]).toFixed(4)));
  assert.deepEqual(drops.slice(0, 6), [0.4, 0.22, 0.32, 0.14, 0.26, 0.4]);
  assert.equal(level.leds.length, drops.reduce((n, s) => n + Math.round(s / 0.07), 0));
  level.leds.forEach(([, y]) => assert.ok(y < 3 && y >= 3 - 0.4 - 1e-9));
  const climb = icicleLeds([[0, 1, 0], [0, 4, 0]]);
  assert.equal(climb.leds.length, 43);
  assert.equal(climb.wires.length, 2, 'no strands on a climb');
  assert.deepEqual(climb.runs, []);
  climb.leds.forEach(([x, , z]) => assert.ok(x === 0 && z === 0));
});

test('winter layer: a string round each thuja, no lights on the trees, glowing only at night', () => {
  const { ctx, byId } = winterOf(), L = byId.winter, info = L.group.userData.winter;
  const thujas = byId.site.api.planters();
  assert.ok(info.plants > 50 * thujas.length);
  // the string sits just outside the plant's outline, up to its top
  const pos = partsUnder(L.group, 'leds')[0].geometry.attributes.position, postCount = info.icicles.filter(ic => !ic.lift).reduce((n, ic) => n + ic.leds, 0);
  const [{ pos: [px, py, pz], profile }] = thujas, H = profile.at(-1)[1];
  for (let i = postCount; i < postCount + info.plants / thujas.length; i++) {
    const h = pos.getY(i) - py, r = Math.hypot(pos.getX(i) - px, pos.getZ(i) - pz);
    assert.ok(h >= 0 && h <= H && r > 0.02 && r < 0.4, `LED ${i} at ${h.toFixed(2)} m, ${r.toFixed(2)} m out`);
  }
  let treeLights = 0;
  byId.trees.group.traverse(o => { if (o.isPoints) treeLights++; });
  assert.equal(treeLights, 0);
  const all = part => [...partsUnder(L.group, part), ...partsUnder(L.lift, part === 'leds' ? 'icicles' : `icicles-${part.split('-')[1]}`)];
  const leds = all('leds').map(p => p.material), halos = all('leds-halo').map(p => p.material), wash = partsUnder(L.lift, 'wash')[0].material;
  const settle = () => { for (let i = 0; i < 80; i++) L.update(0.05, 0.5); };
  settle();
  const day = leds.map(m => [m.size, m.color.r]);
  halos.forEach(m => assert.equal(m.color.r, 0, 'no halo by day'));
  assert.equal(wash.color.r, 0, 'no wash by day');
  ctx.state.night = 1;
  settle();
  leds.forEach((m, i) => assert.ok(m.size > day[i][0] * 2 && m.color.r > day[i][1], 'glows at night'));
  halos.forEach(m => assert.ok(m.color.r > 0));
  assert.ok(wash.color.r > 0);
  [...leds, ...halos, wash].forEach(m => assert.equal(m.opacity, 1, 'the glow is never opacity'));
  assert.equal(L.update(0.05, 0.5), false, 'nothing moves once settled');
  ctx.state.night = 0;
  settle();
  leds.forEach((m, i) => assert.ok(Math.abs(m.size - day[i][0]) < 1e-3, 'back by day'));
  L.group.traverse(o => assert.ok(!o.castShadow, 'casts nothing'));
  L.lift.traverse(o => assert.ok(!o.castShadow, 'casts nothing'));
  assert.ok(!L.shades);
});

test('winter layer: a dressed Christmas tree on the floor, its string, baubles and star glowing at night', () => {
  const { ctx, byId } = winterOf(), L = byId.winter, [t] = model.site.festive.christmas_trees, [info] = L.group.userData.winter.trees;
  const s = spruce(t);
  assert.deepEqual(info, { leds: s.leds.length, baubles: s.baubles.length });
  assert.equal(s.tiers.length, 6);
  assert.ok(info.leds > 80 && info.baubles > 15, `${info.leds} LEDs, ${info.baubles} baubles`);
  // the rims narrow to the tip, which is the tree's height, inside its base
  s.tiers.forEach((tier, i) => i && assert.ok(tier.r < s.tiers[i - 1].r && tier.y > s.tiers[i - 1].y));
  assert.ok(Math.abs(s.tiers.at(-1).y + s.tiers.at(-1).h - t.height) < 1e-9);
  assert.equal(s.tiers[0].r, t.base / 2);
  [...s.leds, ...s.baubles.map(b => b.at)].forEach(([x, y, z]) => {
    assert.ok(Math.hypot(x - t.pos[0], z - t.pos[1]) <= t.base / 2 + 0.02 && y > 0 && y < t.height, `${x}, ${y}, ${z}`);
  });
  s.leds.forEach(([x, y, z]) => assert.ok(Math.abs(Math.hypot(x - t.pos[0], z - t.pos[1]) - s.radius(y) - 0.01) < 1e-9, 'the string lies on the outline'));
  assert.ok(s.star[1] > t.height);
  const tree = partsUnder(L.group, 'christmas-tree');
  assert.equal(tree.length, 1);
  assert.equal(partsUnder(L.lift, 'christmas-tree').length, 0, 'indoors, not in the lift');
  const leds = partsUnder(L.group, 'tree-leds')[0];
  assert.equal(leds.geometry.attributes.position.count, info.leds + 1, 'the string and the star');
  for (let i = 0; i < 80; i++) L.update(0.05, 0.5);
  const day = leds.material.size;
  ctx.state.night = 1;
  for (let i = 0; i < 80; i++) L.update(0.05, 0.5);
  assert.ok(leds.material.size > day * 2, 'the string glows at night');
  assert.deepEqual(spruce(t).leds, s.leds, 'seeded');
});

test('winter layer: two builds place every LED alike; the simple style has no toggle', () => {
  const a = winterOf().byId.winter, b = winterOf().byId.winter;
  const arr = L => [...partsUnder(L.group, 'leds'), ...partsUnder(L.lift, 'icicles')].map(p => Array.from(p.geometry.attributes.position.array));
  assert.deepEqual(arr(a), arr(b));
  const simple = buildAll().byId.winter;
  assert.equal(simple.toggle, undefined);
  assert.equal(simple.group.children.length, 0);
  const none = buildLayer(BUILDERS[LAYERS.indexOf('winter')], 'winter', makeCtx({ ...options, style: 'real' }, { ...model, site: { ...model.site, festive: undefined } }).ctx);
  assert.ok(none && none.toggle, 'the snow builds without festive');
  assert.equal(none.group.userData.winter.icicles.length, 0);
});

test('winter layer: snow on every roof and garage rect in the lift, caps, dust, and the ground\'s snow switched', () => {
  const { ctx, byId } = winterOf(), L = byId.winter;
  const roofSnow = partsUnder(L.lift, 'roof-snow'), garage = partsUnder(L.lift, 'garage-snow');
  assert.deepEqual(roofSnow.map(m => m.userData.roof).sort(), Object.keys(model.roofs).sort());
  assert.equal(garage.length, model.site.garage_roof.rects.length);
  [...roofSnow, ...garage].forEach(m => assert.ok(m.material.transparent, 'fades with the roof'));
  ['roof-snow', 'garage-snow', 'cap', 'dust'].flatMap(part => [...partsUnder(L.group, part), ...partsUnder(L.lift, part)])
    .forEach(m => assert.ok(m.receiveShadow && !m.castShadow, `${m.userData.part} takes shadows and casts none`));
  // a roof's snow lies on its slab's top
  const id = roofSnow[0].userData.roof, top = ctx.roof.top(id), p = roofSnow[0].geometry.attributes.position;
  for (let i = 0; i < p.count; i++) assert.ok(p.getY(i) >= top(p.getX(i)) - 1e-6 && p.getY(i) <= top(p.getX(i)) + 0.1);
  // the face turned up is the snow's top, not its bottom
  const n = roofSnow[0].geometry.attributes.normal;
  let up = 0;
  for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.9) { up++; assert.ok(p.getY(i) > top(p.getX(i)) + 0.07, `vertex ${i} faces up at ${(p.getY(i) - top(p.getX(i))).toFixed(3)} over the slab`); }
  assert.ok(up >= 3);
  const caps = partsUnder(L.group, 'cap'), crownCaps = partsUnder(byId.trees.group, 'cap');
  assert.equal(caps.length, model.site.hedges.length + model.site.planters.filter(q => q.plant === 'thuja').length);
  assert.equal(crownCaps.length, model.site.trees.length);
  assert.equal(partsUnder(L.group, 'dust').length, model.site.paving.length + model.site.decks.length);
  const lawn = byId.ground.group.children[1].material, snowHex = new THREE.Color(ctx.kit.REAL.snow).getHexString();
  // mount() tells every switchable layer its starting state
  L.setOn(true);
  assert.equal(lawn.color.getHexString(), snowHex, 'the lawn is snowed while the layer is on');
  L.setOn(false);
  assert.notEqual(lawn.color.getHexString(), snowHex);
  assert.equal(partsUnder(byId.trees.group, 'winter')[0].visible, false, 'the crowns\' snow hides');
  L.setOn(true);
  assert.equal(lawn.color.getHexString(), snowHex);
});

test('winter layer: snow falls only with snowfall, never under reduced motion, and stops when off', () => {
  const still = winterOf().byId.winter;
  assert.equal(partsUnder(still.group, 'flakes').length, 0);
  for (let i = 0; i < 80; i++) still.update(0.05, 0.5);
  assert.equal(still.update(0.05, 0.5), false, 'nothing moves without snowfall');
  const { ctx } = makeCtx({ ...options, style: 'real', snowfall: true });
  ctx.reduceMotion = true;
  ['ground', 'site', 'trees'].forEach(id => BUILDERS[LAYERS.indexOf(id)].default(ctx));
  assert.equal(partsUnder(BUILDERS[LAYERS.indexOf('winter')].default(ctx).group, 'flakes').length, 0, 'none under reduced motion');
  const L = winterOf({ snowfall: true }).byId.winter, flakes = partsUnder(L.group, 'flakes')[0];
  assert.ok(flakes);
  const y0 = flakes.geometry.attributes.position.getY(0);
  assert.equal(L.update(0.05, 0.5), true);
  const y1 = flakes.geometry.attributes.position.getY(0);
  assert.ok(y1 < y0 || y1 > y0 + 5, 'the flake fell or wrapped to the top');
  for (let i = 0; i < 80; i++) L.update(0.05, 0.5);
  L.setOn(false);
  assert.equal(L.update(0.05, 0.5), false, 'an off layer keeps no frame loop going');
});

// a ray straight down onto [x, z]
const downAt = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));

test('panelGrid: the orientation that holds more, rows centred, never more than asked', () => {
  const g = panelGrid(7.2, 3.6, 12);
  assert.equal(g.length, 12);
  assert.ok(g.every(p => p.long === 1.72), 'landscape on a tie');
  assert.equal(panelGrid(7.2, 3.6, 5).length, 5);
  assert.equal(panelGrid(3.5, 1.8, 3).filter(p => p.long === 1.13).length, 3, 'portrait holds three, landscape two');
  const u = g.map(p => p.u);
  assert.ok(Math.abs(Math.min(...u) + Math.max(...u)) < 1e-9, 'centred');
});

for (const style of ['simple', 'real']) {
  test(`future layer (${style}): the panels lie on the roof inside their rectangle, every item see-through and casting nothing`, () => {
    const { byId, ctx } = buildAll({ ...options, style });
    const L = byId.future;
    assert.ok(L && L.toggle);
    const pv = futureItem('pv'), top = ctx.roof.top(pv.roof);
    const [hw, hd] = [pv.size[0] / 2, pv.size[1] / 2];
    const panels = L.lift.children.filter(o => o.userData.panel);
    assert.equal(panels.length, pv.panels);
    const v = new THREE.Vector3();
    L.lift.updateMatrixWorld(true);
    panels.forEach(m => {
      const pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i);
        const under = v.y < 0;
        v.applyMatrix4(m.matrixWorld);
        assert.ok(Math.abs(v.x - pv.pos[0]) <= hw + 1e-6 && Math.abs(v.z - pv.pos[1]) <= hd + 1e-6, `inside the rectangle: ${v.x}, ${v.z}`);
        if (under) assert.ok(Math.abs(v.y - (top(v.x) + 0.05)) <= 0.01, `on the roof: ${v.y} against ${top(v.x)}`);
      }
    });
    let meshes = 0;
    [L.group, L.lift].forEach(root => root.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      assert.ok(o.material.transparent && o.material.opacity < 1, `${o.geometry.type} see-through`);
      assert.equal(o.castShadow, false, `${o.geometry.type} casts nothing`);
    }));
    assert.ok(meshes > pv.panels + 4, 'every kind drew something');
  });
}

test('future layer: a tap gives the item, the raised panels take none, an indoor item only with the roof off', () => {
  const { byId, ctx } = buildAll();
  const L = byId.future;
  L.group.updateMatrixWorld(true);
  L.lift.updateMatrixWorld(true);
  // the panels off their centre: an even count of columns and of rows leaves a gap there
  const off = id => (id === 'pv' ? 0.4 : 0), at = id => downAt(futureItem(id).pos[0] + off(id), futureItem(id).pos[1] + off(id));
  assert.equal(L.hit(at('pv')).feature, 'pv');
  assert.equal(L.hit(at('tub')).feature, 'tub');
  assert.equal(L.hit(at('greenhouse')).feature, 'greenhouse');
  assert.ok(L.hit(at('pv')).target.isMesh);
  ctx.state.roofFade = 0;
  assert.equal(L.hit(at('pv')), null, 'no PV tap under a raised, hidden roof');
  // the battery stands in a house room
  ctx.state.roofFade = 1;
  assert.equal(L.hit(at('battery')), null);
  ctx.state.mode = 'open';
  assert.equal(L.hit(at('battery')).feature, 'battery');
  assert.equal(L.hit(downAt(1, -5)), null);
});

test('future layer: a model without future builds nothing', () => {
  const m = { ...model };
  delete m.future;
  const { ctx } = makeCtx(options, m);
  assert.equal(BUILDERS[LAYERS.indexOf('future')].default(ctx), null);
  assert.equal(BUILDERS[LAYERS.indexOf('future')].default(makeCtx(options, { ...model, future: { items: [] } }).ctx), null);
});
