// Engine tests on the synthetic fixture: the geometry baseline. The simple snapshot records which
// objects there are, not where they stand, so this pins the vertex positions of the layers that
// read the roofs (the building's walls, roofs and corner boards, the interior's caps, the winter's
// roof snow, the future's PV), in both styles, as a hash per mesh in traversal order.
// UPDATE_BASELINE=1 node --test tests/house3d/engine-geometry.test.mjs rewrites it instead of
// comparing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { THREE, buildAll, options } from './engine-harness.mjs';

const BASELINE = new URL('./geometry-baseline.json', import.meta.url);
const LAYERS = ['building', 'interior', 'winter', 'future'];

// each mesh as "type part hash", the hash over its world vertex positions rounded to the mm
function geometryOf(L) {
  const out = [], v = new THREE.Vector3();
  const mm = x => { const r = Math.round(x * 1000); return r === 0 ? 0 : r; };
  [L.group, L.lift].filter(Boolean).forEach(root => {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (!pos) return;
      const h = createHash('sha1');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        h.update(`${mm(v.x)},${mm(v.y)},${mm(v.z)};`);
      }
      out.push(`${o.type} ${o.userData.part || ''} ${h.digest('hex').slice(0, 16)}`);
    });
  });
  return out;
}

function geometry() {
  const snap = {};
  for (const style of ['simple', 'real']) {
    const { built } = buildAll({ ...options, style, layers: { winter: true } });
    for (const { L } of built) if (LAYERS.includes(L.id)) snap[`${style} ${L.id}`] = geometryOf(L);
  }
  return snap;
}

test('the roof-reading layers stand where the baseline has them, in both styles', () => {
  const snap = geometry();
  if (process.env.UPDATE_BASELINE === '1' || !existsSync(BASELINE)) {
    writeFileSync(BASELINE, JSON.stringify(snap, null, 1) + '\n');
    if (process.env.UPDATE_BASELINE !== '1') assert.fail('no baseline yet: wrote one, check it in and rerun');
    return;
  }
  const want = JSON.parse(readFileSync(BASELINE, 'utf-8'));
  assert.deepEqual(Object.keys(snap).sort(), Object.keys(want).sort());
  for (const k of Object.keys(want)) assert.deepEqual(snap[k], want[k], k);
});
