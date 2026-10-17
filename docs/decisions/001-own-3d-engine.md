# ADR-001: The 3D view is our own three.js engine over the measured house model

- **Status:** Accepted (2026-10-11)
- **Related:** [estate ADR-001](https://github.com/khelias/khe-architecture/blob/main/decisions/001-repo-per-product.md), [estate ADR-012](https://github.com/khelias/khe-architecture/blob/main/decisions/012-estate-architecture-is-public.md)

## Context

A model of the house, the outbuilding and the lot existed before any 3D view:
walls, openings, roofs, furniture and site read off the measured drawings,
georeferenced, kept as parametric JSON in the private house documentation
(estate ADR-012). A browser prototype drew it with three.js and the HA devices
as markers.

Two uses were wanted from it:

1. **In Home Assistant:** the house with live device states, a tap opening
   HA's own more-info dialog.
2. **Without Home Assistant:** the house and lot with no devices at all, for
   example to present the house when it is sold.

The device layer is the sensitive part: cameras with their view directions,
motion sensors, door contacts and alarm panels form a map of what is watched
and what is not. Whatever reaches a public repo or a public page must carry
none of it.

No ready-made card was weighed when this was decided. floor3d-card, the HACS
card that does 3D in HA, was compared on 2026-10-17, after the engine was
built; its assessment below is written afterwards and was not tried in
practice.

## Decision

We render the house with our own engine on three.js, built from the model's
JSON:

1. **One engine, two shells.** The engine builds the scene from model JSON
   and draws generic markers. The HA card feeds it live states and opens
   more-info; the standalone viewer feeds it nothing from HA.
2. **The model is split into layers:** geometry and rooms (shareable),
   private (family room names and every device, HA only) and showcase
   (standalone only). A build reads only the layers its shell may carry and
   fails on any private string in its output.
3. **three.js is vendored**, versioned by directory, with no CDN (the view
   must work with the internet down) and no bundler (the code is served as
   static ES modules from HA's `/local`).

## Alternatives considered

- **floor3d-card** (`adizanni/floor3d-card`, MIT, three.js). The house is
  drawn in Sweet Home 3D and exported as OBJ or GLB; entities bind to model
  objects by `object_id` (light, hide, colour, text, door, rotate), a tap can
  open more-info, and an optional sky places the sun from `sun.sun`. Not
  chosen, judged afterwards:
  - The house would be drawn a second time in another tool, a second source
    of geometry that drifts from the measured model.
  - Removing objects and re-exporting reassigns object ids, so the bindings
    have to be redone after a model edit (its README). Our devices carry
    their own positions.
  - An exported mesh carries whatever was drawn into it; the layer split
    and the build's privacy check need the model as data.
  - It is a Lovelace card only, so use 2 would be separate work.
  - Its last release was v.1.5.3 on 2023-04-10 and its last push on
    2024-04-06, as checked on 2026-10-17.

  What it has that we lack: a graphical modelling tool, so a house without
  measured drawings can still get a model.
- **A static render or a floor-plan image card:** no live states in place,
  and no way to lift the roofs off.

## Consequences

- We maintain a few thousand lines of engine and card, and every three.js or
  HA frontend change that breaks them is ours to fix.
- The view exists only where a parametric model exists. Offering it to other
  houses, for example as a HACS card, first needs a way to author that model
  without measured drawings, translations and the Estonia-specific parts
  made optional. Moving the engine to a repo of its own would be an estate
  decision (estate ADR-001) for the day a second consumer exists.
- The public demo can be built from a made-up house in the same model
  format, so the engine is shown without any of the real house.
