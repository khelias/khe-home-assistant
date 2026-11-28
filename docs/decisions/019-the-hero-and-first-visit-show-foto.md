# ADR-019: The hero and a first visit show Foto

- **Status:** Accepted (2026-11-28)
- **Supersedes:** [ADR-006](006-a3-front-page-live-hero.md) decision 2's style (the real style)
- **Related:** [ADR-009](009-hero-shows-the-surroundings.md), [ADR-001](001-own-3d-engine.md)

## Context

ADR-006 put A3's 3D hero in the real style (Päris) with the live sun,
before the Foto style existed: Päris with a photographed lawn, street and
sky and leaf cards on the trees, with a light tier for weak devices. A
browser that had not picked a style opened the full 3D view in Lihtne, the
neon wireframe. On 2026-11-27 the operator asked for Foto as the default in
Home Assistant. Measured the same day on the laptop (khe-meta
`house3d-foto-perf.md`), Foto's light tier costs about as much per frame as
Päris at phone size and up to about a third more at desktop size; the
Android tablets were not measured.

## Decision

1. **A hero is Foto at its light tier**, whatever the device, with the
   live sun, its own layer switches and no style row (ADR-006, ADR-009).
   The hero is about 300 px high on an always-on dashboard, where the
   light tier's fewer leaf cards do not show; its contact shadows and
   snowfall stay off.
2. **A browser that has picked no style opens the full 3D view in Foto**,
   at the engine's own tier. A style picked in the Kihid sheet is still
   kept per browser and wins.
3. **The demo's scenarios show Foto**, so a scenario shows what a visitor
   gets.

## Alternatives considered

- **Keep Päris in the hero:** cheaper by a little; the operator chose
  Foto's look.
- **Foto at the device's own tier in the hero:** the high tier's detail
  is lost at hero size and costs the most on an always-on screen.
- **Keep Lihtne for a first visit:** the wireframe is the least like the
  house.

## Consequences

- Undo: revert the commit that brought this ADR (card, tests, demo, docs)
  and the README picture's after it, bump the Lovelace resource's `?v=` and run khe-sites' `deploy.yml`.
- The loading picture in Foto waits for its textures and models (the
  engine's `onLook()`), so it shows the look the household chose; on every
  load the first live frame, drawn before they arrive again, is plainer than
  the picture for a moment. The operator chose that over a picture that
  matches the first frame.
- The tablets' frame time is unmeasured; the household's look at one
  decides whether the hero stays.
