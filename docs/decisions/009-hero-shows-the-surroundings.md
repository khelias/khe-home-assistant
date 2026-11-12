# ADR-009: The hero shows the surroundings and their credit

- **Status:** Accepted (2026-11-12)
- **Related:** [ADR-006](006-a3-front-page-live-hero.md), [ADR-001](001-own-3d-engine.md)

## Context

ADR-006 decision 2 left the surroundings layer (the neighbours' buildings
and the street, from Maa- ja Ruumiamet's ETAK) out of A3's 3D hero: at 300
pixels high the neighbours added little, and the credit line the licence
asks for would sit on the front page. Later the same day the real style's
day look was redone: a light base round the lot, a bluer sky and a soft fill
from the camera's side. On renders of the hero with and without the
surroundings under that light, the household chose to see the neighbours:
they place the house in its street, and the credit line is the price the
licence sets for that.

## Decision

1. **A hero draws the surroundings** like the full 3D view, with their
   switch in its Vaade sheet. Its layer switches stay its own and are not
   stored (ADR-006 decision 2 otherwise holds: the real style with the live
   sun, no style row).
2. **A hero shows the ETAK credit** top left, as the full view does, kept
   clear of its corner button.
3. **At night the real style dims the surroundings**, so moonlit neighbours
   do not outshine the house.

## Alternatives considered

- **Keep ADR-006's hero without them:** the household chose the
  surroundings on the renders.
- **Draw them without the credit:** the licence asks for the licensor, the
  dataset and its date wherever the data is shown.

## Consequences

- Undo: restore the hero's forced-off surroundings layer and the credit's
  hero exception in `house3d/house3d-card.js` (the commit that brought this
  ADR).
- The front page carries one line of small text over the house.
