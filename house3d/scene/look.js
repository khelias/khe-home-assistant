// The styles' looks: what a style draws its surfaces, sky and light with. A layer asks ctx.look
// and branches only on look.lit, a lit surface against the simple style's wireframe and edges;
// which lit style it is stays here. createLook() runs once per mount, after createKit().
//
// A look: { id: 'simple' | 'real' | 'photo', lit, and when lit:
//   material(role, o?, surface?)  a new lit material for a surface by its kit name (kit.surface;
//                       surface when it is not the role's own, as the splashback's linen), with the
//                       role's own texture (the lawn's mottle, the road's asphalt, the paving's
//                       stones) unless o gives a map, and the role in its userData.role, which a
//                       band's copy keeps: Foto dresses the house's surfaces by it
//   light(alt)          the light at a sun altitude in degrees (sun.js realLight()'s shape)
//   start({ load, done, scene })?  after the first frame: load(file) -> Promise<texture> from
//                       house3d/assets/, done() once each batch is applied; the promise it
//                       returns settles once all of it is (scene/photo.js)
//   sky({ alt, dir, scene, pmrem })?  per sun change in the garden, after the lights are set;
//                       true when the look drew its own sky, environment and fog; once true,
//                       true for the rest of the mount (the core drops its own environment)
//   crown(tree)?, hedge(hedge)?  dress a crown or a hedge (leaf cards), see scene/photo.js
//   bareCrown(tree)?    draw a tree's branches (in place of the trees layer's struts) and its
//                       twig cards (part 'twigs', shown while bare)
//   outsideScale?       how many times the ground layer's plane the ground past the lot reaches
//                       ('outside' is a material role like the lawn)
//   snow(amount)?       the ground's snow on the lawn, 0 to 1
//   bare?               true when winter strips the deciduous crowns
//   winter(on)?         the winter layer switched, for what else the look changes in winter
//   ao?                 false when the look wants no contact shadows
//   carPaint(o)?        { body, glass }: the car's own materials (the car layer), with o's options
//   dispose()? }
// The studio stage is Päris's in every lit style: mount() asks for 'real' there.
const MAPS = { lawn: 'lawn', road: 'asphalt', paving: 'pavers' };

export function createLook(THREE, kit, id, { light, photo, quality } = {}) {
  if (id !== 'real' && id !== 'photo') return { id: 'simple', lit: false };
  const real = {
    id: 'real', lit: true,
    material: (role, o = {}, surface = role) => {
      const m = kit.surface(surface, MAPS[role] && !('map' in o) ? { map: kit[MAPS[role]](), ...o } : o);
      m.userData.role = role;
      return m;
    },
    light
  };
  return id === 'photo' && photo ? photo(THREE, kit, real, { quality }) : real;
}
