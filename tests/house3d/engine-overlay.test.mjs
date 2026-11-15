// Engine tests of the marker overlay's pure helpers (scene/overlay.js: hitRect, collide, inChip)
// and the core's tap rule (tapAction). The set-up is in engine-harness.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapAction, collide, inChip, hitRect } from './engine-harness.mjs';

test('hitRect: the rectangle under the point, the nearest centre of several, pad for touch', () => {
  const rects = [{ id: 'a', x: 100, y: 100, w: 32, h: 32 }, { id: 'b', x: 120, y: 100, w: 32, h: 32 }, { id: 'c', x: 300, y: 300, w: 60, h: 32 }];
  assert.equal(hitRect(rects, 105, 100), 'a');
  assert.equal(hitRect(rects, 115, 100), 'b');
  assert.equal(hitRect(rects, 329, 315), 'c');
  assert.equal(hitRect(rects, 332, 300), null);
  assert.equal(hitRect(rects, 332, 300, 6), 'c');
  assert.equal(hitRect([], 0, 0), null);
});

test('collide: accepted rectangles never overlap, a crowded marker becomes a dot, then hides', () => {
  // a 6 x 6 grid of 32 px markers 30 px apart: too close at full size, room for a dot
  const items = [];
  for (let i = 0; i < 36; i++) items.push({ id: `m${i}`, kind: i % 5 ? 'marker' : 'chip', x: 100 + (i % 6) * 30, y: 100 + Math.floor(i / 6) * 30, dist: 10 + i, was: false, sizes: i % 5 ? [[32, 32], [10, 10]] : [[80, 28], [30, 28]] });
  const levels = collide(items);
  const placed = items.filter(it => levels.get(it.id) >= 0).map(it => { const [w, h] = it.sizes[levels.get(it.id)]; return { x: it.x, y: it.y, w, h }; });
  for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
    const p = placed[a], q = placed[b];
    assert.ok(Math.abs(p.x - q.x) * 2 >= p.w + q.w + 8 || Math.abs(p.y - q.y) * 2 >= p.h + q.h + 8, `${a} and ${b} overlap`);
  }
  assert.ok([...levels.values()].includes(1), 'some drop to their small size');
  assert.ok([...levels.values()].includes(-1), 'some hide');
  assert.ok(levels.get('m0') >= 0, 'the nearest chip keeps at least its compact form');
});

test('collide: an alert never hides, a chip keeps at least its compact form', () => {
  const at = (id, kind, dist) => ({ id, kind, x: 50, y: 50, dist, was: false, sizes: [[32, 32], [10, 10]] });
  const levels = collide([at('chip', 'chip', 1), at('m', 'marker', 5), at('a1', 'alert', 9), at('a2', 'alert', 8)]);
  assert.equal(levels.get('a1'), 0);
  assert.equal(levels.get('a2'), 0, 'two alerts on one spot both show');
  assert.equal(levels.get('m'), -1);
  assert.equal(levels.get('chip'), -1, 'nothing has room under two alerts');
  // without the alerts the chip shows, though farther, and the marker on its spot hides
  const two = collide([at('chip', 'chip', 9), at('m', 'marker', 1)]);
  assert.ok(two.get('chip') >= 0);
  assert.equal(two.get('m'), -1);
  // with room, a chip grows back to its full form after the markers are placed
  const room = collide([{ id: 'c', kind: 'chip', x: 50, y: 50, dist: 9, was: false, sizes: [[80, 28], [30, 28]] }, { id: 'm', kind: 'marker', x: 200, y: 50, dist: 1, was: false, sizes: [[32, 32], [10, 10]] }]);
  assert.deepEqual([room.get('c'), room.get('m')], [0, 0]);
});

test('collide: a chip beats a crowded marker\'s dot', () => {
  // b does not fit at full size under a; its dot and the chip want the same spot
  const levels = collide([
    { id: 'a', kind: 'marker', x: 50, y: 20, dist: 5, was: false, sizes: [[32, 32], [10, 10]] },
    { id: 'b', kind: 'marker', x: 50, y: 50, dist: 6, was: true, sizes: [[32, 32], [10, 10]] },
    { id: 'c', kind: 'chip', x: 50, y: 55, dist: 9, was: false, sizes: [[60, 20], [24, 20]] }
  ]);
  assert.equal(levels.get('a'), 0);
  assert.equal(levels.get('c'), 0, 'the chip is shown');
  assert.equal(levels.get('b'), -1, 'the marker hides rather than take the chip\'s place as a dot');
  // with no chip in the way the crowded marker still drops to a dot
  const alone = collide([
    { id: 'a', kind: 'marker', x: 50, y: 20, dist: 5, was: false, sizes: [[32, 32], [10, 10]] },
    { id: 'b', kind: 'marker', x: 50, y: 50, dist: 6, was: false, sizes: [[32, 32], [10, 10]] }
  ]);
  assert.equal(alone.get('b'), 1);
});

test('collide: a size can sit off the centre, and is tested where it sits', () => {
  const block = { id: 'm', kind: 'alert', x: 50, y: 50, dist: 1, was: false, sizes: [[40, 32]] };
  const chip = { id: 'c', kind: 'chip', x: 50, y: 50, dist: 2, was: false, sizes: [[80, 28], [30, 28], [30, 28, 0, -34], [30, 28, 0, 34]] };
  assert.equal(collide([block, chip]).get('c'), 2, 'the compact chip just above the alert');
  const above = { id: 'a', kind: 'alert', x: 50, y: 10, dist: 1, was: false, sizes: [[40, 32]] };
  assert.equal(collide([block, above, chip]).get('c'), 3, 'then just below');
});

test('collide: on a tie the one shown last frame keeps its place', () => {
  const pair = (wasA, wasB) => collide([
    { id: 'a', kind: 'marker', x: 50, y: 50, dist: 10, was: wasA, sizes: [[32, 32]] },
    { id: 'b', kind: 'marker', x: 60, y: 50, dist: 10, was: wasB, sizes: [[32, 32]] }
  ]);
  assert.deepEqual([pair(false, true).get('a'), pair(false, true).get('b')], [-1, 0]);
  assert.deepEqual([pair(true, false).get('a'), pair(true, false).get('b')], [0, -1]);
  // a clearly nearer newcomer still wins
  const near = collide([{ id: 'a', kind: 'marker', x: 50, y: 50, dist: 5, was: false, sizes: [[32, 32]] }, { id: 'b', kind: 'marker', x: 60, y: 50, dist: 10, was: true, sizes: [[32, 32]] }]);
  assert.equal(near.get('a'), 0);
});

test('inChip: quiet markers and the ones the chip counts are in it, the rest show alone', () => {
  const chip = { room: 'r1', ids: ['binary_sensor.motion', 'binary_sensor.door'] };
  assert.equal(inChip({ room: 'r1', state: 'idle' }, chip, null), true);
  assert.equal(inChip({ room: 'r1', state: 'off' }, chip, null), true);
  assert.equal(inChip({ id: 'binary_sensor.motion', room: 'r1', state: 'on' }, chip, null), true, 'an on motion the chip counts');
  assert.equal(inChip({ id: 'binary_sensor.door', room: 'r1', state: 'alert' }, chip, null), true, 'an alert door the chip counts');
  assert.equal(inChip({ id: 'climate.floor', room: 'r1', state: 'on' }, chip, null), false, 'an on climate unit it does not count shows alone');
  assert.equal(inChip({ id: 'binary_sensor.door', room: 'r1', state: 'alert' }, chip, 'r1'), false, 'the focused room shows all');
  assert.equal(inChip({ room: 'carport', state: 'idle' }, chip, null), false, 'another room\'s chip');
  assert.equal(inChip({ state: 'idle' }, chip, null), false, 'outdoors');
  assert.equal(inChip({ id: 'binary_sensor.door', room: 'r1', state: 'alert' }, null, null), false, 'no chip (the roof on)');
});

test('collide: a chip in alert never hides, sits compact over a crowd, grows where there is room', () => {
  const chip = { id: 'c', kind: 'alert', chip: true, x: 50, y: 50, dist: 9, was: false, sizes: [[80, 28], [30, 28], [30, 28, 0, -34], [30, 28, 0, 34]] };
  const crowd = [0, -34, 34].map((dy, i) => ({ id: `a${i}`, kind: 'alert', x: 50, y: 50 + dy, dist: 1, was: false, sizes: [[40, 32]] }));
  const levels = collide([...crowd, chip]);
  assert.equal(levels.get('c'), 1, 'compact, in its place, though nothing fits');
  crowd.forEach(a => assert.equal(levels.get(a.id), 0));
  const m = { id: 'm', kind: 'marker', x: 50, y: 50, dist: 1, was: false, sizes: [[32, 32], [10, 10]] };
  const over = collide([m, chip]);
  assert.equal(over.get('c'), 0, 'placed before a nearer marker, which then has no room');
  assert.equal(over.get('m'), -1);
  assert.equal(collide([chip]).get('c'), 0, 'alone it grows to full');
});

test('tapAction: an overlay hit first, then car, feature, room, empty space', () => {
  assert.deepEqual(tapAction('m:light.x', { feature: 'pv' }), { marker: 'light.x' });
  assert.deepEqual(tapAction('c:r1', { car: true }), { room: 'r1' });
  assert.deepEqual(tapAction(null, { car: true }), { car: true });
  assert.deepEqual(tapAction(null, { feature: 'pv', target: {} }), { feature: 'pv' });
  assert.deepEqual(tapAction(null, { room: 'r2', target: {} }), { room: 'r2' });
  assert.deepEqual(tapAction(null, null), { none: true });
});
