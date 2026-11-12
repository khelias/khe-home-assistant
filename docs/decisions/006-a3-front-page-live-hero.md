# ADR-006: A3 is the house's front page, with the 3D hero in the real style and the live sun

- **Status:** Accepted (2026-11-12); decision 1 superseded by [ADR-007](007-a3-in-the-overview.md); decision 2 narrowed by [ADR-009](009-hero-shows-the-surroundings.md): the hero draws the surroundings and their credit
- **Related:** [ADR-001](001-own-3d-engine.md), [ADR-005](005-a3-glass-cards-history-sheet.md)

## Context

ADR-005 built A3 at `kodu-katse` beside Kodu and left making it the front
page for later. On 2026-11-12 the household found A3 good to live with,
but not its hero: in the evening it was the navy blueprint of the 3D
card's simple style, under a credit line for the surroundings layer
("Ümbrus: Maa- ja Ruumiamet, ETAK, ...") that means nothing on a front
page. Shown the real style at night and by day, the household chose the
live sun.

## Decision

1. **A3 is the front page.** HA's system-wide frontend data
   `core.default_panel` is `"kodu-katse"`, and so is the owner's own
   user-level value, which overrides the system one. The dashboard's
   sidebar title is "Kodu"; the Overview keeps "Ülevaade". The URL stays
   `/kodu-katse`, since HA does not rename a dashboard's `url_path`.
2. **A hero is the real style with the live sun, without the
   surroundings.** With `height` set the 3D card mounts the `real` style
   whatever the browser stored, follows the sun as the full 3D view does,
   and never draws the surroundings layer. Its layer switches are its own:
   it neither reads nor writes the `house3d-layers` and `house3d-style`
   keys the full view uses, and its layers sheet has no style row and no
   surroundings switch. With no ETAK data drawn, the ETAK credit is not
   owed, so a hero shows none; the full view keeps it.

## Alternatives considered

- **The simple style in a lighter palette for the hero:** a third look to
  keep apart from the full view's two; the household chose the live sun.
- **Keep the surroundings in the hero:** the neighbours add little at
  300 pixels high, and the credit they owe would stay on the front page.
- **Replace the Overview's config with A3:** Kodu would be lost as the
  fallback, and the public demo builds Kodu.

## Consequences

- Undo: set both `default_panel` values back to `"lovelace"`; the
  procedure is in `docs/operational-notes.md`.
- The HA app can open its own last page, and a family member's own
  profile setting wins over the system default; only the token's user is
  set here.
- The real style's look at night and by day is shared with the full 3D
  view; its lighting and fog get their own design round.
