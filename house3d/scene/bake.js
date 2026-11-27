// Contact shadows baked offline in Blender (scripts/house3d-bake.sh, ADR-001 point 7): a house's
// bake.json { format: 1, atlas, meshes: { key: { count, uv } } } and its grey atlas; its input is
// the export's hash (house3d-bake-export.mjs --check), and its size, distance and samples the
// bake's record.
//
// A target is a mesh of the building or pergola layer whose every material is opaque when the
// layer is built (opacity 1, the roof's fading materials included) and takes an aoMap. Its key is
// <layer>:<n>, the n-th target of that layer in group-then-lift-bands order; count is its vertex count
// once non-indexed and uv that many [u, v] pairs as three.js reads them. mount() takes the keys right
// after the build, as the bake's export does in Node over the engine tests' harness, so both find
// the same targets in the same order whatever the roof's fade or the night later do to an opacity.
export const BAKE_LAYERS = ['building', 'pergola'];
export const BAKE_FORMAT = 1;
// three.js darkens only indirect light by an aoMap; this much of the occlusion darkens direct light too
const DIRECT_AO = 0.6;

/** materialsOf(mesh) -> its materials as a list. */
export const materialsOf = o => (Array.isArray(o.material) ? o.material : [o.material]);
/** opaque(material) -> true when it is drawn at full opacity, the fade's starting value if it fades. */
export const opaque = m => !!m && (m.userData.base ?? m.opacity) === 1;
const takesAO = m => opaque(m) && 'aoMap' in m;

/** bakeRoots(layer) -> the layer's group and its lift bands (or its one lift), in key order. */
export const bakeRoots = L => [L.group, ...(Array.isArray(L.lifts) ? L.lifts : [L.lift])].filter(Boolean);

/** bakeCount(geometry) -> the vertex count the bake's uv list runs over: the index's, else the positions'. */
export const bakeCount = g => (g.index ? g.index.count : g.attributes.position.count);

/** bakeTargets(layers) -> [{ key, mesh }] of built layers (each { id, group, lift? }), in key order. */
export function bakeTargets(layers) {
  const out = [];
  BAKE_LAYERS.forEach(id => {
    const L = layers.find(l => l && l.id === id);
    if (!L) return;
    let n = 0;
    bakeRoots(L).forEach(root => root.traverse(o => {
      if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position && materialsOf(o).every(takesAO)) out.push({ key: `${id}:${n++}`, mesh: o });
    }));
  });
  return out;
}

/** bakeKeys(layers) -> the target keys bakeTargets() gives. */
export const bakeKeys = layers => bakeTargets(layers).map(t => t.key);

/**
 * applyBake({ THREE, targets, bake, texture, keep }) -> { applied, reason? }: applies bake to targets
 * (bakeTargets() taken after the build) only when it has exactly their keys, each with its count;
 * otherwise nothing, with the reason. Each target gets a geometry of its own with the uv as uv1 and
 * each source material one clone with the atlas as aoMap; keep receives every new geometry and
 * material and the replaced materials, so a dispose frees them.
 */
export function applyBake({ THREE, targets, bake, texture, keep = x => x }) {
  const meshes = bake && bake.format === BAKE_FORMAT && bake.meshes && typeof bake.meshes === 'object' ? bake.meshes : null;
  if (!meshes) return { applied: 0, reason: `not a format ${BAKE_FORMAT} bake` };
  const baked = Object.keys(meshes).length;
  if (baked !== targets.length) return { applied: 0, reason: `${baked} meshes baked, ${targets.length} here` };
  for (const { key, mesh } of targets) {
    const e = meshes[key], n = bakeCount(mesh.geometry);
    if (!e || e.count !== n || !Array.isArray(e.uv) || e.uv.length !== 2 * n) return { applied: 0, reason: `${key} does not match` };
  }
  texture.channel = 1;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  const clones = new Map();
  const clone = m => {
    if (!clones.has(m)) {
      const c = keep(m.clone());
      c.aoMap = texture;
      c.aoMapIntensity = 1;
      c.onBeforeCompile = s => {
        s.fragmentShader = s.fragmentShader.replace('#include <aomap_fragment>',
          `#include <aomap_fragment>\n\treflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, ${DIRECT_AO.toFixed(2)});`);
      };
      c.customProgramCacheKey = () => 'house3d-bake';
      clones.set(m, c);
      keep(m);
    }
    return clones.get(m);
  };
  for (const { key, mesh } of targets) {
    const old = mesh.geometry, g = keep(old.index ? old.toNonIndexed() : old.clone());
    g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(meshes[key].uv), 2));
    mesh.geometry = g;
    // frees its buffers now; a mesh that still draws it uploads it again
    old.dispose();
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  }
  return { applied: targets.length };
}
