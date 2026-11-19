// Engine tests of the building layer (walls, openings, corner boards, floors, the lift's fade,
// the night glow, its api) and the interior layer, on the synthetic fixture. The set-up is in
// engine-harness.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYERS, THREE, BUILDERS, modelFrame, buildLayer, cornerBoards, model, INNER, options, makeCtx,
  buildAll, hexOf, partsOf, winterOf
} from './engine-harness.mjs';

// a plan point [x, y, z] in a house room; the carport is outdoors
const inHouseRoom = ([x, , z]) => model.rooms.some(r => r.floor !== 'paving' && r.rects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));

test('real style: an exterior wall is boarded on its outer face only', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const walls = [];
  byId.building.group.traverse(o => { if (o.isMesh && Array.isArray(o.material)) walls.push(o); });
  assert.ok(walls.length >= 6);
  byId.building.group.updateMatrixWorld(true);
  walls.forEach(w => {
    const [back, front, edge] = w.material, t = w.geometry.parameters.options.depth;
    assert.deepEqual(w.geometry.groups.map(g => g.materialIndex), [0, 1, 2]);
    assert.equal(edge.map, null);
    // the face whose material has the boards has no room just beyond it
    [[back, -1], [front, 1]].forEach(([mt, z]) => {
      if (!mt.map) return;
      const L = w.geometry.boundingBox || (w.geometry.computeBoundingBox(), w.geometry.boundingBox);
      const mid = new THREE.Vector3((L.min.x + L.max.x) / 2, 1, z * (t / 2 + 0.3)).applyMatrix4(w.matrixWorld);
      assert.ok(!inHouseRoom(mid.toArray()), 'the boards face out');
    });
    assert.ok(back.map || front.map, 'boarded on one face at least');
    assert.notEqual(back.map, front.map, 'the back face takes the mirrored boards');
  });
});

test('real style: exterior walls get a base strip broken at doors', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const strips = [];
  byId.building.group.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.position.y - 0.06) < 1e-6) strips.push(o); });
  // the fixture's 11 exterior walls one strip each, and one more per opening at the ground (8);
  // the interior walls none
  assert.equal(strips.length, 11 + 8);
  strips.forEach(s => assert.ok(s.geometry.parameters.width > 0.01));
  // on the outer face only: in the plan, just past the strip there is no house room
  byId.building.group.updateMatrixWorld(true);
  strips.forEach(s => {
    assert.ok(Math.abs(s.position.z) > 0.1, 'one face only');
    const out = new THREE.Vector3(0, 0, Math.sign(s.position.z) * 0.3).add(s.position).applyMatrix4(s.parent.matrixWorld);
    assert.ok(!inHouseRoom(out.toArray()), 'the outer face');
  });
});

// the wall group for model wall w: the group at w.a holding the extruded wall
function wallGroup(root, w) {
  return root.children.find(g => g.isGroup && g.position.x === w.a[0] && g.position.z === w.a[1] && g.children.some(o => o.geometry && o.geometry.type === 'ExtrudeGeometry'));
}

test('real style: openings in an exterior wall get trims, reveals and a sill on the outer face', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const root = byId.building.group;
  root.updateMatrixWorld(true);
  const front = model.walls[0], g = wallGroup(root, front);
  const parts = g.children.filter(o => o.userData.part);
  // each opening's pieces, by where they sit along the wall
  const of = o => parts.filter(p => p.position.x > o.c - o.w / 2 - 0.2 && p.position.x < o.c + o.w / 2 + 0.2);
  const count = (list, part) => list.filter(p => p.userData.part === part).length;
  const [win, glassdoor, door] = front.openings;
  const w = of(win);
  assert.deepEqual([count(w, 'trim'), count(w, 'sill'), count(w, 'reveal')], [4, 1, 4], 'window');
  [glassdoor, door].forEach(o => {
    const d = of(o);
    assert.deepEqual([count(d, 'trim'), count(d, 'sill'), count(d, 'reveal')], [3, 0, 3], o.kind);
    const jambs = d.filter(p => p.userData.part === 'trim' && p.geometry.parameters.width < 0.2);
    assert.equal(jambs.length, 2);
    jambs.forEach(j => assert.ok(Math.abs(j.position.y - j.geometry.parameters.height / 2) < 1e-9, `${o.kind}: a jamb reaches the ground`));
  });
  parts.forEach(p => {
    const out = new THREE.Vector3(0, 0, Math.sign(p.position.z) * 0.3).add(p.position).applyMatrix4(g.matrixWorld);
    assert.ok(!inHouseRoom(out.toArray()), `${p.userData.part} on the outer face`);
  });
  assert.equal(parts.length, 10 + 1 + 10);
  const inner = wallGroup(root, model.walls[INNER]);
  assert.ok(inner);
  assert.equal(inner.children.filter(o => o.userData.part).length, 0, 'the interior wall has no trim');
});

test('real style: interior doors and frames white, the clad door\'s leaf cladding, the rest anthracite', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const name = mt => Object.entries(ctx.kit.REAL).find(([, v]) => new THREE.Color(v).getHexString() === mt.color.getHexString())[0];
  const front = wallGroup(byId.building.group, model.walls[0]), inner = wallGroup(byId.building.group, model.walls[INNER]);
  const leaves = g => g.children.filter(o => o.userData.leaf);
  const frames = g => g.children.filter(o => o.isMesh && o.geometry.type === 'BoxGeometry' && !o.userData.leaf && !o.userData.part);
  assert.deepEqual(leaves(inner).map(o => name(o.material)), model.walls[INNER].openings.map(() => 'door'), 'the interior doors\' leaves');
  assert.ok(frames(inner).length >= 3 && frames(inner).every(o => name(o.material) === 'door'), 'and its frame');
  assert.deepEqual(leaves(front).map(o => name(o.material)), ['cladding'], 'the street wall\'s clad door');
  assert.ok(frames(front).every(o => name(o.material) === 'frame'), 'an exterior wall\'s frames stay anthracite');
});

test('a glass door narrower than 1.2 m has no centre mullion, in both styles', () => {
  const m = structuredClone(model);
  m.walls[INNER].openings = [{ kind: 'glassdoor', c: 1.6, w: 0.6, h: 2.1 }, { kind: 'glassdoor', c: 4.5, w: 1.4, h: 2.1 }];
  const real = buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', makeCtx({ ...options, style: 'real' }, m).ctx);
  const mull = wallGroup(real.group, m.walls[INNER]).children.filter(o => o.userData.mullion);
  assert.deepEqual(mull.map(o => o.position.x), [4.5], 'the wide one only');
  const simple = buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', makeCtx(options, m).ctx);
  const lines = wallGroup(simple.group, m.walls[INNER]).children.filter(o => o.type === 'LineSegments' && o.geometry.type === 'BufferGeometry');
  assert.equal(lines.length, 1, 'one mullion line, the wide door\'s');
});

test('real style: corner boards at every corner, fillers at the outer ones only, split at the cut', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  // the U's seven outer corners take boards and fillers, its three inner corners boards only
  const corners = [[21.8, 1.8], [31.2, 1.8], [37.2, 3.8], [37.2, 22.2], [23.8, 22.2], [23.8, 15.8], [21.8, 8.2]];
  const inner = [[31.2, 3.8], [30.8, 8.2], [30.8, 15.8]], joins = [[31, 22]], all = [...corners, ...inner];
  const dist = (v, [x, z]) => Math.hypot(v.x - x, v.z - z);
  [byId.building.group, byId.building.lift].forEach((root, j) => {
    root.updateMatrixWorld(true);
    const found = [];
    root.traverse(o => { if (o.userData.part === 'corner') found.push(o); });
    const boards = found.filter(o => o.geometry.type === 'BoxGeometry'), fillers = found.filter(o => o.geometry.type === 'PlaneGeometry');
    const where = j ? 'lift' : 'group';
    assert.equal(boards.length, 2 * (corners.length + inner.length), `${where}: boards`);
    assert.equal(fillers.length, 2 * corners.length, `${where}: fillers`);
    found.forEach(o => {
      const v = o.getWorldPosition(new THREE.Vector3());
      const at = o.geometry.type === 'PlaneGeometry' ? corners : all;
      assert.ok(at.some(c => dist(v, c) < 0.15), `${where}: ${v.x}, ${v.z} at a corner`);
      assert.ok(joins.every(c => dist(v, c) > 1), `${where}: nothing at a collinear join`);
    });
    // cut at the ceiling: below it in group, above it in lift
    boards.forEach(o => {
      const h = o.geometry.parameters.height, y = o.position.y;
      assert.ok(j ? Math.abs(y - h / 2 - model.ceiling) < 1e-9 : Math.abs(y - h / 2) < 1e-9 && Math.abs(h - model.ceiling) < 1e-9);
    });
    fillers.forEach(o => assert.ok(o.material.map, `${where}: a filler carries the boards`));
  });
});

test('real style: a panel wall is anthracite, without a base strip', () => {
  const panelled = structuredClone(model);
  panelled.walls.push({ a: [20, 7.5], b: [20, 9], t: 0.04, top: 2.6, finish: 'panel' });
  const { ctx } = makeCtx({ ...options, style: 'real' }, panelled);
  const L = buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', ctx);
  const frame = new THREE.Color(ctx.kit.REAL.frame).getHexString();
  const panel = L.group.children.find(g => g.isGroup && g.position.x === 20 && g.position.z === 7.5);
  assert.equal(panel.children.length, 1, 'the panel has no strip, frames or glass');
  assert.equal(panel.children[0].material.color.getHexString(), frame);
  assert.deepEqual([panel.children[0].castShadow, panel.children[0].receiveShadow], [true, true]);
});

test('real style: every floor has its own material', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const floors = [];
  byId.building.group.traverse(o => { if (o.isMesh && o.userData.room) floors.push(o.material); });
  assert.ok(floors.length >= 3);
  assert.equal(new Set(floors).size, floors.length);
});

test('real style: every house room floor carries planks or tiles by its floor, on world (x, z)', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const floors = byId.building.group.children.filter(o => o.isMesh && o.userData.room);
  const house = floors.filter(f => model.rooms.find(r => r.id === f.userData.room).floor !== 'paving');
  assert.ok(house.length >= 8);
  const v = new THREE.Vector3();
  house.forEach(f => {
    const floor = model.rooms.find(r => r.id === f.userData.room).floor;
    assert.equal(f.material.map, floor === 'tile' ? ctx.kit.tiles() : ctx.kit.planks(), f.userData.room);
    f.updateMatrixWorld(true);
    const pos = f.geometry.attributes.position, uv = f.geometry.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(f.matrixWorld);
      // float32 attributes: a few 1e-6 at 30 m
      assert.ok(Math.abs(uv.getX(k) - v.x) < 1e-4 && Math.abs(uv.getY(k) - v.z) < 1e-4, `${f.userData.room}: uv is world (x, z)`);
    }
  });
  assert.ok(house.some(f => f.material.map === ctx.kit.tiles()) && house.some(f => f.material.map === ctx.kit.planks()));
});

test('real style: a house room\'s floor meets every wall face it lies along, without a gap', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  const floors = byId.building.group.children.filter(o => o.userData.room && o.userData.room !== 'carport').map(f => {
    const { width: w, height: h } = f.geometry.parameters;
    return [f.position.x - w / 2, f.position.z - h / 2, f.position.x + w / 2, f.position.z + h / 2];
  });
  const onFloor = (x, z) => floors.some(([x0, z0, x1, z1]) => x >= x0 - 1e-4 && x <= x1 + 1e-4 && z >= z0 - 1e-4 && z <= z1 + 1e-4);
  // along each face with a house room 0.3 m in front, the floor reaches to within 1 cm of the face;
  // the test house's study stops 13 cm short of its inner wall
  let probed = 0;
  model.walls.filter(w => w.finish !== 'panel').forEach((w, i) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
    [1, -1].forEach(s => {
      for (let k = 1; k < L * 10; k++) {
        const at = o => [w.a[0] + u[0] * k / 10 - u[1] * s * (w.t / 2 + o), w.a[1] + u[1] * k / 10 + u[0] * s * (w.t / 2 + o)];
        const [px, pz] = at(0.3);
        if (!inHouseRoom([px, 0, pz])) continue;
        probed++;
        assert.ok(onFloor(...at(0.01)), `wall ${i}: floor at the face`);
      }
    });
  });
  assert.ok(probed > 200);
  // and no further: no two floors overlap, under a wall or in a doorway
  floors.forEach((p, i) => floors.slice(i + 1).forEach(q => {
    const w = Math.min(p[2], q[2]) - Math.max(p[0], q[0]), h = Math.min(p[3], q[3]) - Math.max(p[1], q[1]);
    assert.ok(w < 1e-4 || h < 1e-4, `floors [${p}] and [${q}] overlap`);
  }));
  // a short wall 1 cm past the kitchen-living room's inner seam does not pull one rect over the other
  const m = structuredClone(model);
  m.walls.push({ a: [31.085, 16.2], b: [31.085, 17.2], t: 0.15, top: 2.7 });
  const { ctx } = makeCtx({ ...options, style: 'real' }, m);
  const seam = BUILDERS[LAYERS.indexOf('building')].default(ctx).group.children.filter(o => o.userData.room === 'r1');
  assert.ok(Math.abs(Math.min(...seam.map(f => f.position.x + f.geometry.parameters.width / 2)) - 31) < 1e-9);
});

test('real style: the building draws no furniture, the interior layer does', () => {
  const { byId } = buildAll({ ...options, style: 'real' });
  // its own meshes are the floors; walls, frames and corners sit in wall groups
  byId.building.group.children.filter(o => o.isMesh).forEach(o => assert.ok(o.userData.room, 'only floors'));
  byId.building.group.traverse(o => assert.notEqual(o.geometry && o.geometry.type, 'CylinderGeometry'));
  // the simple style still draws every item itself
  const simple = buildAll().byId.building;
  const boxes = simple.group.children.filter(o => o.isMesh && !o.userData.room);
  assert.equal(boxes.length, model.furniture.length);
});

// the building and interior layers of a real-style build of model m
function interiorOf(m = model) {
  const { ctx, byId } = makeCtx({ ...options, style: 'real' }, m);
  ['building', 'interior'].forEach(id => { byId[id] = BUILDERS[LAYERS.indexOf(id)].default(ctx); });
  return { ctx, L: byId.interior };
}

// the world box of every instance of an InstancedMesh, hidden ones too, or of a plain mesh
function boxesOf(o) {
  o.geometry.computeBoundingBox();
  const b = o.geometry.boundingBox, at = new THREE.Matrix4();
  if (!o.isInstancedMesh) return [b.clone().applyMatrix4((o.updateMatrix(), o.matrix))];
  return Array.from({ length: o.instanceMatrix.count }, (_, i) => (o.getMatrixAt(i, at), b.clone().applyMatrix4(at)));
}

const centre = b => b.getCenter(new THREE.Vector3());

const size = b => b.getSize(new THREE.Vector3());

// the wall a skirting box lies along and the side of it: its centre is on that wall's face
function faceOf(b) {
  const c = centre(b);
  for (const [i, w] of model.walls.entries()) {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
    const along = (c.x - w.a[0]) * u[0] + (c.z - w.a[1]) * u[1], off = -(c.x - w.a[0]) * u[1] + (c.z - w.a[1]) * u[0];
    if (along > -0.01 && along < L + 0.01 && Math.abs(Math.abs(off) - (w.t / 2 + 0.006)) < 1e-3) return { i, w, u, along, side: Math.sign(off) };
  }
  return null;
}

test('interior: nothing in the simple style or without the building', () => {
  const { ctx } = makeCtx(options);
  assert.equal(BUILDERS[LAYERS.indexOf('interior')].default(ctx), null);
  const real = makeCtx({ ...options, style: 'real' });
  assert.equal(BUILDERS[LAYERS.indexOf('interior')].default(real.ctx), null, 'no building layer');
});

test('interior: a cap on every non-panel wall\'s flat top, narrower than the wall, split at an opening up to the top', () => {
  const { ctx, L } = interiorOf();
  const [caps] = partsOf(L, 'cap'), boxes = boxesOf(caps), walls = caps.userData.walls;
  model.walls.forEach((w, i) => {
    const mine = boxes.filter((_, k) => walls[k] === i);
    if (w.finish === 'panel') return assert.equal(mine.length, 0, `wall ${i} is a panel`);
    const top = w.cut ?? (typeof w.top === 'string' ? model.ceiling : w.top);
    assert.ok(mine.length >= 1, `wall ${i} has a cap`);
    const across = Math.abs(w.b[0] - w.a[0]) > Math.abs(w.b[1] - w.a[1]) ? 'z' : 'x';
    mine.forEach(b => {
      assert.ok(Math.abs(b.min.y - top - 0.002) < 1e-6 && Math.abs(size(b).y - 0.01) < 1e-6, `wall ${i}: at its top`);
      assert.ok(size(b)[across] < w.t - 0.005, `wall ${i}: narrower than the wall`);
    });
  });
  // two walls in a straight line meet with no gap between their caps
  const run = [2, 3].map(i => boxesOf(caps).filter((_, k) => walls[k] === i));
  assert.ok(run[0].some(b => Math.abs(b.min.x - 31) < 1e-6) && run[1].some(b => Math.abs(b.max.x - 31) < 1e-6), 'caps meet at x 31');
  assert.equal(caps.material.color.getHexString(), hexOf(ctx.kit, 'cut'));
  assert.deepEqual([caps.castShadow, caps.receiveShadow], [false, true]);
  // an interior door up to the wall's top splits that wall's cap round it
  const m = structuredClone(model), w = m.walls[INNER], door = w.openings[0];
  door.h = w.top - 0.005;
  const split = partsOf(interiorOf(m).L, 'cap')[0], sb = boxesOf(split).filter((_, k) => split.userData.walls[k] === INNER);
  assert.equal(sb.length, boxesOf(caps).filter((_, k) => walls[k] === INNER).length + 1);
  const u = [(w.b[0] - w.a[0]) / 4, (w.b[1] - w.a[1]) / 4].map(v => Math.sign(v));
  const axis = u[0] ? 'x' : 'z', a = axis === 'x' ? w.a[0] : w.a[1], s = u[0] || u[1];
  const [d0, d1] = [a + s * (door.c - door.w / 2), a + s * (door.c + door.w / 2)].sort((p, q) => p - q);
  sb.forEach(b => assert.ok(b.max[axis] <= d0 + 1e-6 || b.min[axis] >= d1 - 1e-6, 'no cap over the door'));
  // a roof-topped wall left uncut slopes with its roof: no cap
  const sloped = structuredClone(model);
  sloped.walls.forEach(x => { if (typeof x.top === 'string') x.cut = 0; });
  const { roof } = modelFrame(sloped), sc = partsOf(interiorOf(sloped).L, 'cap')[0].userData.walls;
  const slopes = sloped.walls.map((x, i) => [x, i]).filter(([x]) => typeof x.top === 'string' && Math.abs(roof.topFn(x.top)(...x.a) - roof.topFn(x.top)(...x.b)) >= 0.005);
  assert.ok(slopes.length > 0, 'the test house has a sloped wall');
  slopes.forEach(([, i]) => assert.ok(!sc.includes(i), `sloped wall ${i}`));
});

test('interior: the cut walls\' caps hide with the roof fully on', () => {
  const { ctx, L } = interiorOf();
  const [caps] = partsOf(L, 'cap'), all = caps.instanceMatrix.count, walls = caps.userData.walls;
  const cut = i => { const w = model.walls[i]; return !!(w.cut ?? (typeof w.top === 'string' ? model.ceiling : 0)); };
  ctx.state.roofFade = 1;
  assert.equal(L.update(0.016, 0.5), false);
  assert.ok(caps.count < all);
  walls.forEach((i, k) => assert.equal(k < caps.count, !cut(i), `cap ${k} of wall ${i}`));
  ctx.state.roofFade = 0;
  L.update(0.016, 0.5);
  assert.equal(caps.count, all);
});

test('interior: skirting along the room side of every face, broken at doors, and a floor shade along it', () => {
  const { ctx, L } = interiorOf();
  const [skirt] = partsOf(L, 'skirting'), [shade] = partsOf(L, 'shade');
  const sk = boxesOf(skirt), sh = boxesOf(shade);
  assert.ok(sk.length > 20);
  sk.forEach(b => {
    const f = faceOf(b);
    assert.ok(f, 'on a wall face');
    const n = [-f.u[1] * f.side, f.u[0] * f.side], at = [f.w.a[0] + f.u[0] * f.along, f.w.a[1] + f.u[1] * f.along];
    assert.ok(inHouseRoom([at[0] + n[0] * (f.w.t / 2 + 0.3), 0, at[1] + n[1] * (f.w.t / 2 + 0.3)]), `wall ${f.i}: a house room in front`);
    assert.ok(Math.abs(b.min.y - 0.02) < 1e-6 && Math.abs(size(b).y - 0.07) < 1e-6);
  });
  // both faces of an interior wall, the inner face only of an exterior one
  const sides = i => new Set(sk.map(faceOf).filter(f => f.i === i).map(f => f.side));
  assert.equal(sides(INNER).size, 2);
  assert.equal(sides(1).size, 1);
  // none across a door, a glass door or a window down to the floor, on any wall
  sk.forEach(b => {
    const { w } = faceOf(b), axis = Math.abs(w.b[0] - w.a[0]) > 1e-9 ? 'x' : 'z';
    const a = axis === 'x' ? w.a[0] : w.a[1], s = Math.sign((axis === 'x' ? w.b[0] : w.b[1]) - a);
    (w.openings || []).filter(o => o.kind !== 'window' || o.sill < 0.07).forEach(o => {
      const [d0, d1] = [a + s * (o.c - o.w / 2), a + s * (o.c + o.w / 2)].sort((p, q) => p - q);
      // float32 instance matrices: a few 1e-6 at 35 m
      assert.ok(b.max[axis] <= d0 + 1e-4 || b.min[axis] >= d1 - 1e-4, `no skirting across wall ${model.walls.indexOf(w)}'s ${o.kind} at ${o.c}`);
    });
  });
  assert.ok(model.walls.filter(w => typeof w.top === 'number' && (w.openings || []).some(o => o.kind === 'door')).length >= 4, 'the test house has interior doors on several walls');
  // the shade runs with the skirting, a strip on the floor
  assert.equal(sh.length, sk.length);
  sk.forEach((b, k) => {
    const axis = size(b).x > size(b).z ? 'x' : 'z';
    assert.ok(Math.abs(sh[k].min[axis] - b.min[axis]) < 1e-6 && Math.abs(sh[k].max[axis] - b.max[axis]) < 1e-6, 'same run');
    assert.ok(Math.abs(size(sh[k])[axis === 'x' ? 'z' : 'x'] - 0.3) < 1e-6 && Math.abs(centre(sh[k]).y - 0.024) < 1e-6);
  });
  assert.equal(skirt.material.color.getHexString(), hexOf(ctx.kit, 'skirting'));
  assert.deepEqual([skirt.castShadow, skirt.receiveShadow], [false, true]);
  const sm = shade.material;
  assert.ok(sm.isMeshBasicMaterial && sm.transparent && !sm.depthWrite && sm.polygonOffset && sm.polygonOffsetFactor < 0 && sm.polygonOffsetUnits < 0);
  assert.deepEqual([shade.castShadow, shade.receiveShadow], [false, false]);
});

// one item of each fitted kind, in the galerii, past what the test above places
const FITTED = [
  { what: 'base units', kind: 'base_units', rect: [31.3, 14.4, 33.1, 15.0], y: [0, 0.9], along: 'x', fronts: [['drawers', 0.6], ['oven', 0.6], ['door', 0.6]] },
  { what: 'wall units', kind: 'wall_units', rect: [31.3, 15.2, 32.5, 15.55], y: [1.45, 2.2], along: 'x', fronts: [['glass', 0.6], ['blank', 0.6]] },
  { what: 'tall units', kind: 'tall_units', rect: [33.2, 14.4, 33.8, 15.0], y: [0, 2.2], along: 'z', fronts: [['door', 0.6]] },
  { what: 'hood', kind: 'hood', rect: [31.3, 15.7, 31.9, 16.2], y: [1.4, 2.5] },
  { what: 'shelf', kind: 'shelf', rect: [32.1, 15.7, 32.9, 15.95], y: [1.5, 1.62] },
  { what: 'splashback', kind: 'splashback', rect: [31.3, 16.3, 33.1, 16.315], y: [0.9, 1.45] },
  { what: 'tv', kind: 'tv', rect: [31.3, 16.5, 32.4, 16.68], y: [0.5, 1.2] },
  { what: 'rug', kind: 'rug', rect: [32.5, 16.5, 34, 17.5], y: [0.02, 0.04] },
  { what: 'curtain', kind: 'curtain', rect: [31.3, 17.6, 33.1, 17.7], y: [0.02, 2.4] }
];
const OWN_MESH = ['splashback', 'curtain'];
// one item of each wet-room and utility kind, further along the galerii
const WET = [
  { what: 'toilet', kind: 'toilet', rect: [31.3, 17.9, 31.84, 18.26], y: [0.2, 1.15] },
  { what: 'vanity', kind: 'vanity', rect: [32.0, 17.9, 33.2, 18.36], y: [0.45, 1.0], along: 'x', fronts: [['drawers', 0.6], ['drawers', 0.6]], basins: 2, finish: 'anthracite' },
  { what: 'mirror', kind: 'mirror', rect: [32.0, 18.4, 33.2, 18.43], y: [1.1, 1.9] },
  { what: 'washer', kind: 'washer', rect: [33.3, 17.9, 33.9, 18.5], y: [0, 0.85] },
  { what: 'stove', kind: 'stove', rect: [31.3, 18.6, 31.75, 19.05], y: [0, 0.8] },
  { what: 'bookcase', kind: 'bookcase', rect: [32.0, 18.6, 32.8, 18.95], y: [0, 1.9], finish: 'white' }
];

// every furniture part: [item index, world box, surface name]
function furnitureOf(L, kit) {
  const names = new Map(Object.keys(kit.REAL).map(n => [hexOf(kit, n), n]));
  return partsOf(L, 'furniture').flatMap(o => boxesOf(o).map((b, k) => [o.userData.items[k], b, names.get(o.material.color.getHexString())]));
}

test('interior: furniture by kind, every part inside its item, fewer meshes than parts', () => {
  // the test house, and the kinds it lacks on a copy of it, in the galerii
  const extra = structuredClone(model);
  extra.furniture.push(
    { what: 'cabinet', kind: 'cabinet', rect: [31.3, 8.2, 31.8, 9.6], y: [0, 0.6] },
    { what: 'bath', kind: 'bath', rect: [32.3, 8.2, 33.0, 9.9], y: [0, 0.55] },
    { what: 'bench', kind: 'bench', rect: [31.3, 10.2, 32.4, 11.0], y: [0, 0.9] },
    { what: 'upper bench', kind: 'bench', rect: [31.3, 10.6, 32.4, 11.0], y: [0.9, 1.3] },
    { what: 'appliance', kind: 'appliance', rect: [32.5, 10.2, 33.0, 10.8], y: [0, 1.7] },
    { what: 'tank', kind: 'appliance', circle: [32.7, 11.4, 0.3], y: [0, 1.8] },
    { what: 'headboard', kind: 'headboard', rect: [31.3, 12.0, 31.4, 13.0], y: [0, 1] },
    { what: 'floating table', kind: 'table', rect: [31.4, 13.2, 32.4, 14.2], y: [0.72, 0.78] },
    ...FITTED,
    ...WET
  );
  [model, extra].forEach(m => {
    const { ctx, L } = interiorOf(m);
    const parts = furnitureOf(L, ctx.kit);
    m.furniture.forEach((f, i) => {
      const mine = parts.filter(p => p[0] === i);
      const [x0, z0, x1, z1] = f.rect || [f.circle[0] - f.circle[2], f.circle[1] - f.circle[2], f.circle[0] + f.circle[2], f.circle[1] + f.circle[2]];
      // a table's or desk's legs may reach the floor
      const floor = ['table', 'desk'].includes(f.kind) ? 0 : f.y[0];
      mine.forEach(([, b]) => {
        assert.ok(b.min.x >= x0 - 0.005 && b.max.x <= x1 + 0.005 && b.min.z >= z0 - 0.005 && b.max.z <= z1 + 0.005, `${f.what}: inside its footprint`);
        assert.ok(b.min.y >= floor - 0.005 && b.max.y <= f.y[1] + 0.005, `${f.what}: inside its height`);
      });
      if (!f.kind) assert.deepEqual(mine.map(p => p[2]), ['furniture'], `${f.what}: one plain block`);
      // a splashback and a curtain are meshes of their own, tested below
      else if (!OWN_MESH.includes(f.kind)) assert.ok(mine.length >= (['headboard', 'appliance'].includes(f.kind) ? 1 : 2), `${f.what}: shaped`);
    });
    const meshes = partsOf(L, 'furniture');
    assert.ok(meshes.length < parts.length);
    meshes.forEach(o => assert.deepEqual([o.castShadow, o.receiveShadow], [true, true]));
  });
  const kinds = new Set(extra.furniture.map(f => f.kind).filter(Boolean));
  assert.equal(kinds.size, 26, 'every kind drawn');
});

test('interior: a finish draws a run of units and a bookcase in that surface, the kitchen\'s without one', () => {
  const run = { what: 'run', kind: 'base_units', y: [0, 0.9], along: 'x', fronts: [['door', 0.6], ['drawers', 0.6]] };
  const shelves = { what: 'shelves', kind: 'bookcase', y: [0, 1.9] };
  const m = structuredClone(model), first = m.furniture.length;
  m.furniture.push(
    { ...run, rect: [31.3, 8.2, 32.5, 8.8] },
    { ...run, rect: [31.3, 9.0, 32.5, 9.6], finish: 'anthracite' },
    { ...shelves, rect: [31.3, 9.8, 32.1, 10.15] },
    { ...shelves, rect: [31.3, 10.4, 32.1, 10.75], finish: 'white' }
  );
  const { ctx, L } = interiorOf(m), parts = furnitureOf(L, ctx.kit);
  const real = Object.keys(ctx.kit.REAL).map(n => hexOf(ctx.kit, n));
  assert.equal(new Set(real).size, real.length, 'every real surface its own colour');
  const own = ['handle', 'steel', 'blackGlass', 'glass', 'linen'];
  const surfaces = k => [...new Set(parts.filter(p => p[0] === first + k && !own.includes(p[2])).map(p => p[2]))].sort();
  assert.deepEqual(surfaces(0), ['kitchen', 'kitchenTop']);
  assert.deepEqual(surfaces(1), ['anthracite'], 'carcass, fronts and top');
  assert.deepEqual(surfaces(2), ['kitchen']);
  assert.deepEqual(surfaces(3), ['white']);
});

test('interior: a toilet\'s flush plate is on the wall it hangs on, a washer\'s door faces away from its wall', () => {
  // the galerii's west wall face is x 31.2, its east wall face x 33.125; the washer is longer on x,
  // so only its wall turns it
  const m = structuredClone(model), first = m.furniture.length;
  m.furniture.push(
    { what: 'toilet', kind: 'toilet', rect: [31.2, 9.0, 31.74, 9.36], y: [0.2, 1.15] },
    { what: 'washer', kind: 'washer', rect: [32.5, 10.0, 33.125, 10.6], y: [0, 0.85] }
  );
  const { ctx, L } = interiorOf(m), parts = furnitureOf(L, ctx.kit);
  const plate = parts.filter(p => p[0] === first && p[1].max.y > 1.14);
  assert.ok(plate.length >= 1);
  plate.forEach(([, b]) => assert.ok(b.max.x < 31.23, 'the flush plate against the west wall'));
  const door = parts.filter(p => p[0] === first + 1 && p[2] === 'blackGlass');
  assert.ok(door.length >= 1);
  door.forEach(([, b]) => assert.ok(b.max.x < 32.52, 'the door on the side away from the east wall'));
});

test('interior: a splashback and a curtain are one mesh each inside their footprint, the curtain casting no shadow', () => {
  const m = structuredClone(model);
  m.furniture.push(...FITTED);
  const { L } = interiorOf(m);
  OWN_MESH.forEach(kind => {
    const i = m.furniture.findIndex(f => f.kind === kind), [x0, z0, x1, z1] = m.furniture[i].rect, [y0, y1] = m.furniture[i].y;
    const meshes = partsOf(L, kind);
    assert.equal(meshes.length, 1, `${kind}: one mesh`);
    assert.deepEqual(meshes[0].userData.items, [i]);
    const [b] = boxesOf(meshes[0]);
    assert.ok(b.min.x >= x0 - 0.005 && b.max.x <= x1 + 0.005 && b.min.z >= z0 - 0.005 && b.max.z <= z1 + 0.005, `${kind}: inside its footprint`);
    assert.ok(b.min.y >= y0 - 0.005 && b.max.y <= y1 + 0.005, `${kind}: inside its height`);
  });
  assert.equal(partsOf(L, 'curtain')[0].castShadow, false);
});

test('interior: a run of units draws its fronts in order from the low end of along', () => {
  const fronts = [['door', 0.5], ['oven', 0.6], ['drawers', 0.7]];
  [['x', [31.2, 8.2, 33.0, 8.8]], ['z', [31.2, 8.2, 31.8, 10.0]]].forEach(([along, rect]) => {
    const m = structuredClone(model), i = m.furniture.push({ what: 'run', kind: 'base_units', rect, y: [0, 0.9], along, fronts }) - 1;
    const { ctx, L } = interiorOf(m), mine = furnitureOf(L, ctx.kit).filter(p => p[0] === i);
    const low = along === 'x' ? rect[0] : rect[1], at = b => centre(b)[along] - low;
    const inSpan = (name, a, b) => mine.filter(p => p[2] === name).map(p => at(p[1])).filter(v => v > a && v < b).length;
    assert.equal(inSpan('handle', 0, 0.5), 1, 'a door first, its one handle');
    assert.ok(inSpan('blackGlass', 0.5, 1.1) >= 1, 'the oven second');
    assert.equal(inSpan('blackGlass', 0, 0.5) + inSpan('blackGlass', 1.1, 1.8), 0, 'black glass only on the oven');
    assert.equal(inSpan('handle', 1.1, 1.8), 3, 'three drawers last');
  });
});

test('interior: along turns a square unit\'s fronts, whichever side is longer', () => {
  ['x', 'z'].forEach(along => {
    const m = structuredClone(model), rect = [31.2, 8.2, 31.8, 8.8];
    const i = m.furniture.push({ what: 'tall', kind: 'tall_units', rect, y: [0, 2.2], along, fronts: [['door', 0.3], ['door', 0.3]] }) - 1;
    const { ctx, L } = interiorOf(m), handles = furnitureOf(L, ctx.kit).filter(p => p[0] === i && p[2] === 'handle');
    assert.equal(handles.length, 4, 'two doors, each split in two');
    handles.forEach(([, b]) => assert.ok(size(b)[along] > 0.1, `the handle runs along ${along}`));
  });
});

test('interior: a hood too shallow to lean stays inside its footprint', () => {
  const rect = [31.3, 8.2, 31.9, 8.4], m = structuredClone(model), i = m.furniture.push({ what: 'hood', kind: 'hood', rect, y: [1.4, 2.5] }) - 1;
  const { ctx, L } = interiorOf(m);
  furnitureOf(L, ctx.kit).filter(p => p[0] === i).forEach(([, b]) => assert.ok(b.min.z >= 8.195 && b.max.z <= 8.405 && b.min.y >= 1.395 && b.max.y <= 2.505));
});

test('interior: a tall unit divides its doors but draws one oven', () => {
  const m = structuredClone(model), i = m.furniture.push({ what: 'tall', kind: 'tall_units', rect: [31.2, 8.2, 31.8, 8.8], y: [0, 2.2], along: 'x', fronts: [['oven', 0.6]] }) - 1;
  const { ctx, L } = interiorOf(m), glass = furnitureOf(L, ctx.kit).filter(p => p[0] === i && p[2] === 'blackGlass');
  assert.equal(glass.length, 1);
});

test('interior: a sofa carries its back and arms on the edges it names, none on the others', () => {
  const rect = [31.2, 8.2, 33.2, 9.2], y = [0, 0.8];
  const m = structuredClone(model), i = m.furniture.push({ what: 'sofa', kind: 'sofa', rect, y, back: ['z1'], arm: ['x1'] }) - 1;
  const { ctx, L } = interiorOf(m), tall = furnitureOf(L, ctx.kit).filter(p => p[0] === i && p[2] === 'sofa' && p[1].max.y > 0.5);
  assert.ok(tall.some(([, b]) => b.max.z > 9.19 && size(b).x > 1.9), 'the back runs along the z1 edge');
  assert.ok(tall.some(([, b]) => b.max.x > 33.19 && size(b).z > 0.9), 'an arm on the x1 edge');
  tall.forEach(([, b]) => {
    if (b.max.x < 33.0) assert.ok(b.min.z > 8.2 + 0.1, 'only the arm reaches the open z0 edge');
    if (b.min.x < 31.3) assert.ok(b.min.z >= 8.9, 'on the open x0 edge only the back reaches the end');
  });
});

// a bed's pillows: its linen parts shorter than half a metre along the bed
const pillowsOf = (parts, i, axis) => parts.filter(p => p[0] === i && p[2] === 'linen' && size(p[1])[axis] < 0.5).map(p => p[1]);

test('interior: a bed\'s pillows lie across its head, at a headboard or the short end nearer a wall', () => {
  const { ctx, L } = interiorOf();
  const parts = furnitureOf(L, ctx.kit), idx = what => model.furniture.findIndex(f => f.what === what);
  // the bed runs along z; both short ends are 1 m from the outer wall, so the lower z end wins
  const bed = pillowsOf(parts, idx('bed'), 'z');
  assert.equal(bed.length, 2, 'one pillow per 0.9 m of width');
  bed.forEach(b => assert.ok(b.min.z < 12.5, 'at z 12'));
  assert.ok(Math.abs(centre(bed[0]).x - centre(bed[1]).x) > 0.5, 'side by side across the bed');
  // the child's bed runs along x, its x 22.4 end 0.2 m from the outer wall
  pillowsOf(parts, idx("child's bed"), 'x').forEach(b => assert.ok(b.min.x < 22.9));
  // a headboard at the far end turns it round
  const m = structuredClone(model);
  m.furniture.push({ what: 'headboard', kind: 'headboard', rect: [34.9, 14, 36.7, 14.08], y: [0, 1] });
  const turned = interiorOf(m), tb = pillowsOf(furnitureOf(turned.L, turned.ctx.kit), idx('bed'), 'z');
  assert.equal(tb.length, 2);
  tb.forEach(b => assert.ok(b.max.z > 13.5, 'at the headboard'));
});

test('interior: the wardrobe\'s door grooves face away from the wall', () => {
  const { ctx, L } = interiorOf();
  const i = model.furniture.findIndex(f => f.kind === 'wardrobe'), [x0, , x1] = model.furniture[i].rect;
  // its back is at x 31.25, against the wall at x 31
  const grooves = furnitureOf(L, ctx.kit).filter(p => p[0] === i && p[2] === 'worktop' && size(p[1]).z < 0.02).map(p => p[1]);
  assert.equal(grooves.length, 2, 'three doors');
  grooves.forEach(b => assert.ok(b.min.x > (x0 + x1) / 2, 'on the front'));
});

test('real style: the lift fades out and back on its own materials', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const lift = byId.building.lift, mats = new Set();
  lift.traverse(o => { if (o.isMesh) [o.material].flat().forEach(m => mats.add(m)); });
  const below = new Set();
  byId.building.group.traverse(o => { if (o.isMesh) [o.material].flat().forEach(m => below.add(m)); });
  mats.forEach(m => assert.ok(!below.has(m), 'a lift material is used below the lift'));
  ctx.kit.applyFade(lift, 0);
  assert.equal(lift.visible, false);
  mats.forEach(m => assert.equal(m.opacity, 0));
  ctx.kit.applyFade(lift, 1);
  assert.equal(lift.visible, true);
  mats.forEach(m => assert.equal(m.opacity, 1));
  below.forEach(m => assert.ok(m.opacity > 0));
});

// an L outline's walls, t thick, each on its edge of the outer outline O with outward normal n;
// shift 0 runs centreline crossing to crossing (the fixture), shift t/2 moves every wall back
// along itself, so it runs to the outer corner at its start and stops at the next wall's inner
// face (the real model)
function lWalls(t, shift) {
  const O = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  const N = [[0, -1], [1, 0], [0, 1], [1, 0], [0, 1], [-1, 0]];
  const C = O.map((_, i) => {
    const [n0, n1] = [N[(i + 5) % 6], N[i]];
    // the centreline crossing at vertex i: t/2 in from both edges' outer faces
    return [O[i][0] - ((n0[0] + n1[0]) * t) / 2, O[i][1] - ((n0[1] + n1[1]) * t) / 2];
  });
  return C.map((c, i) => {
    const d = C[(i + 1) % 6], L = Math.hypot(d[0] - c[0], d[1] - c[1]), u = [(d[0] - c[0]) / L, (d[1] - c[1]) / L];
    return { i, a: [c[0] - u[0] * shift, c[1] - u[1] * shift], u, n: N[i], L, t };
  });
}

const cornerKey = p => p.map(v => v.toFixed(3)).join(',');

test('cornerBoards: an L outline has five convex corners and one concave', () => {
  const W = 0.12, D = 0.025, outer = ['0.000,0.000', '10.000,0.000', '10.000,4.000', '4.000,10.000', '0.000,10.000'];
  [0, 0.2].forEach(shift => {
    const res = cornerBoards(lWalls(0.4, shift), W, D);
    const boards = res.filter(c => !c.filler), at = {};
    boards.forEach(c => (at[cornerKey(c.p)] ||= []).push(c));
    assert.deepEqual(Object.keys(at).sort(), [...outer, '4.000,4.000'].sort(), `shift ${shift}`);
    outer.forEach(k => {
      assert.equal(at[k].length, 2, `convex ${k}`);
      assert.notEqual(at[k][0].wall, at[k][1].wall);
      at[k].forEach(c => assert.deepEqual([c.from, c.to], [-D, W]));
    });
    // found from both walls' ends, kept once
    assert.equal(at['4.000,4.000'].length, 2, 'concave');
    assert.deepEqual(at['4.000,4.000'].map(c => c.wall).sort(), [2, 3]);
    at['4.000,4.000'].forEach(c => assert.deepEqual([c.from, c.to], [0, W]));
    res.filter(c => c.filler).forEach(c => assert.ok(outer.includes(cornerKey(c.p)), 'fillers only at convex corners'));
  });
  // crossing to crossing, every convex corner has a notch on both walls
  assert.equal(cornerBoards(lWalls(0.4, 0), W, D).filter(c => c.filler).length, 10);
});

test('cornerBoards: a collinear join gives nothing', () => {
  const f = (i, x) => ({ i, a: [x, 0.2], u: [1, 0], n: [0, -1], L: 5, t: 0.4 });
  assert.deepEqual(cornerBoards([f(0, 0), f(1, 5)], 0.12, 0.025), []);
});

test('cornerBoards: a wall that stops at the other one\'s inner face gets a filler', () => {
  // B (0.5 thick) runs to the outer corner (0, 0); A (0.2 thick) stops at B's inner face
  const B = { i: 0, a: [0, 0.25], u: [1, 0], n: [0, -1], L: 5, t: 0.5 };
  const A = { i: 1, a: [0.1, 0.5], u: [0, 1], n: [-1, 0], L: 4.5, t: 0.2 };
  const res = cornerBoards([B, A], 0.12, 0.025);
  const boards = res.filter(c => !c.filler), fillers = res.filter(c => c.filler);
  assert.equal(boards.length, 2);
  boards.forEach(c => assert.equal(cornerKey(c.p), '0.000,0.000'));
  assert.equal(fillers.length, 1);
  assert.equal(fillers[0].wall, 1);
  assert.deepEqual(fillers[0].dir, [0, 1]);
  assert.ok(Math.abs(fillers[0].to - 0.5) < 1e-9 && fillers[0].from === 0);
});

test('cornerBoards: a wall butting into another one mid-length is no convex corner', () => {
  // B's outer face at z 0 runs on both sides of A, which ends at B's inner face
  const B = { i: 0, a: [0, 0.1], u: [1, 0], n: [0, -1], L: 10, t: 0.2 };
  const A = { i: 1, a: [5, 0.2], u: [0, 1], n: [-1, 0], L: 3, t: 0.2 };
  assert.deepEqual(cornerBoards([B, A], 0.12, 0.025), []);
});

test('real style: a corner board stops at an opening next to the corner', () => {
  // the street wall's door moved to end 0.05 m short of the north corner's face line
  const near = structuredClone(model);
  near.walls[0].openings[2] = { kind: 'door', c: 5.65, w: 1, h: 2.1 };
  const { ctx } = makeCtx({ ...options, style: 'real' }, near);
  const L = buildLayer(BUILDERS[LAYERS.indexOf('building')], 'building', ctx);
  L.group.updateMatrixWorld(true);
  const boards = [];
  L.group.traverse(o => {
    if (o.userData.part !== 'corner' || o.geometry.type !== 'BoxGeometry') return;
    const v = o.getWorldPosition(new THREE.Vector3());
    if (Math.hypot(v.x - 37.2, v.z - 3.8) < 0.15 && Math.abs(v.z - 3.8) < 0.02) boards.push(o);
  });
  assert.equal(boards.length, 1, 'the street wall\'s board at the north corner');
  const b = boards[0], w = b.geometry.parameters.width;
  // the door ends at local x 6.15, the corner's face line is at 6.2
  assert.ok(Math.abs(b.position.x - w / 2 - 6.15) < 1e-9, 'starts at the door');
  assert.ok(w < 0.12);
});

test('real style at night: a lit room\'s floor and windows glow, nothing by day', () => {
  const { ctx, byId } = buildAll({ ...options, style: 'real' });
  const L = byId.building;
  const panes = [], floors = [];
  L.group.traverse(o => {
    if (o.isMesh && 'pane' in o.userData) panes.push(o);
    if (o.isMesh && o.userData.room && o.userData.base) floors.push(o);
  });
  const of = room => panes.filter(p => p.userData.pane === room);
  assert.ok(of('r1').length >= 3 && of('r2').length >= 1, 'panes tagged with the room they look into');
  assert.notEqual(of('r1')[0].material, of('r2')[0].material, 'a glass per room');
  const light = { id: 'light.x', pos: [4, 2, 6], icon: 'light', room: 'r1', state: 'on', level: 0.8 };
  const motion = { id: 'binary_sensor.y', pos: [12, 2, 4], icon: 'motion', room: 'r2', state: 'on' };
  const recent = { id: 'binary_sensor.z', pos: [9, 2, 8], icon: 'motion', room: 'r3', state: 'idle', glow: 0.8 };
  L.markers([light, motion, recent]);
  const settle = () => { for (let i = 0; i < 40; i++) L.update(0.05, 0.5); };
  ctx.state.night = 1;
  settle();
  assert.ok(of('r1')[0].material.emissiveIntensity > 0.5, 'the lit room\'s windows glow');
  assert.equal(of('r2')[0].material.emissiveIntensity, 0, 'motion without glow does not light a room');
  assert.ok(floors.find(f => f.userData.room === 'r3').material.emissiveIntensity > 0, 'a marker with glow does, even idle');
  assert.ok(floors.find(f => f.userData.room === 'r1').material.emissiveIntensity > 0, 'and its floor');
  assert.equal(floors.find(f => f.userData.room === 'r2').material.emissiveIntensity, 0);
  ctx.state.night = 0;
  settle();
  panes.forEach(p => assert.equal(p.material.emissiveIntensity, 0, 'by day nothing glows'));
  floors.forEach(f => assert.equal(f.material.emissiveIntensity, 0));
  assert.ok(Math.abs(of('r1')[0].material.opacity - 0.35) < 1e-9, 'the day glass as it was');
});

test('building api.wallBehind: the nearest wall face either way along a normal, within reach', () => {
  const { wallBehind } = winterOf().byId.building.api;
  // under the street wing's eave, the wall stands a little way in from the eave's path
  const hit = wallBehind(28, 2.5, 1.68, 0, -1, 1);
  assert.equal(hit.s, -1, 'the wall is against the normal');
  assert.ok(hit.d > 0.05 && hit.d < 0.5, `the wall is just behind the eave (${hit.d})`);
  assert.deepEqual(wallBehind(28, 2.5, 1.68, 0, 1, 1), { d: hit.d, s: 1 }, 'the same wall with the normal flipped, on the other side');
  assert.equal(wallBehind(28, 2.5, 1.68, 0, -1, hit.d / 2), null, 'nothing within a shorter reach');
});
