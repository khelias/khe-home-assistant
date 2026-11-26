# ADR-018: On four-column screens A3's hero covers the left half

- **Status:** Accepted (2026-11-17); amended (2026-11-26): the demo takes B from its own four-column width
- **Related:** supersedes [ADR-010](010-a3-landscape-hero-beside-the-cards.md) decision 1 from 1716 px and extends its decision 3; [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-012](012-the-demo-is-the-houses-overview.md)

## Context

With ADR-010's layout a 1720 px screen gives the hero one column of four,
about 400 x 390 px, the same weight as Elekter, with the chips wrapping
under it. A prototype in the demo tried three forms: the chips over the
canvas (the house did not grow and the chips covered its front), the hero
two columns wide with Kliima under it (A), and the hero two columns wide
and three rows high, with Elekter and Juhtimine beside it and Kliima two
columns wide under them (B). The household chose B: at 1720 x 900 the
house is about 821 x 594 px, twice the size, the chips fit on one line,
and about 130 px scrolls at 813 px high.

B works only at four columns. HA clamps `column_span` to the column count,
so at two columns the hero would become the full-width strip ADR-010
removed, and at three the grid leaves a hole under it. HA has no span per
width.

Read from HA frontend 20261028.5 (HA 2026.11):

- `hui-card` removes a hidden card's element from the DOM
  (`_setElementVisibility`, unless the card sets `connectedWhileHidden`), so
  a hidden 3D card disconnects and unmounts its WebGL view.
- `hui-section` hides itself when all its cards are conditionally hidden,
  and `.section:has(hui-section[hidden])` is `display: none`, so such a
  section takes no grid cell. A section's own `visibility` keeps its cards
  connected.
- The view's grid flows by row unless `dense_section_placement` is set (it
  is not), so with B's spans Kliima lands in row 3, columns 3 and 4.
- The column count is `floor((content - 64 + 32) / 352)` clamped to
  `max_columns`. Four columns need 1440 px of content; HA's open sidebar is
  256 px, and HA measures the content without the scrollbar while a media
  query measures the viewport with it.

## Decision

1. **B from 1716 px, ADR-010's layout below.** 1440 px of content plus the
   256 px sidebar plus up to 20 px of scrollbar: from 1716 px the view has
   four columns whatever the sidebar does. Below, the phone included,
   nothing changes.
2. **Both layouts are in the view, every card of each under HA's screen
   condition** (`(min-width: 1716px)` and its complement), keeping any
   visibility a card already had. The first section, ADR-010's, and its
   counterpart, two columns wide and three rows high, come first; Kliima is
   there twice, one column and two columns wide, after Juhtimine. A hidden
   card leaves the DOM, so one 3D view runs at a time, and a section of
   hidden cards takes no cell, so each layout's grid is as if the other
   were not there.
3. **The hero's stretch gets a second rule, `stretch: "beside"`.** The 3D
   card grows until its section ends where the lowest section right of it
   ends, counting those that start at or below its top (Elekter,
   Juhtimine and Kliima), never past the screen and never under its
   `height` box. A section measures to its content, not to the rows it
   spans, so Kliima in the hero's third row starts below the hero's section
   until the hero has grown, and a bound at the section's bottom would
   leave Kliima out. `stretch: true` keeps ADR-010's same-row rule. The
   height is floored, so a section a fraction of a pixel taller than the
   rows it spans cannot grow them, and the sections beside it, step by
   step.

## Alternatives considered

- **A, the hero two columns wide with Kliima under it:** the house grows
  less, and Kliima's tiles sit under the house instead of with the other
  cards.
- **The chips over the canvas:** the house did not grow and the chips
  covered its front.
- **B at every width from two columns:** HA's clamp turns it into a
  full-width strip at two columns and a hole at three.
- **Section `visibility` for the two layouts:** it keeps the cards
  connected, so two WebGL views would run.
- **`dense_section_placement` to fill B's hole at three columns:** it
  fills a hole by moving a later section up, out of the reading order, and
  it is a view setting, so it acts at every width.
- **One stretch rule reading the grid's rows:** the sections whose rows
  overlap the hero's, from the section's `grid-row-end` span and the
  view's resolved `grid-template-rows`. It would serve both layouts without
  a mode, but it reads more of HA's grid internals than the sections'
  rects, and those change with the frontend.
- **A card of our own reading HA's column count:** it could pick the
  layout exactly, but it would replace HA's sections and their editor with
  our own layout code, the trade ADR-010 already turned down.

## Consequences

- From 1440 to 1715 px without the sidebar the view has four columns but
  keeps ADR-010's layout: a screen condition cannot see the sidebar.
- Crossing 1716 px swaps one hero for the other, so the layer switches and
  camera a visitor set on the hero start over; they are not stored anyway
  (ADR-009).
- The stored dashboard carries two hero configs and Kliima twice. HA's edit
  mode shows both layouts at once, with two WebGL views.
- The demo's numbers (the hero 828 x 681 px at 1720 x 900, ending 24 px
  above the screen's bottom) come from the demo, which has no sidebar; with
  HA's sidebar open the hero is about 680 px wide.
- The demo has no sidebar, so its view has four columns from 1408 px.
  `dashboard_demo` rewrites the two screen conditions to 1428 px (1408 plus
  the scrollbar), so a screen of 1428 to 1715 px gets B there
  while the house's own dashboard keeps ADR-010's layout.
- A section added later right of the hero, under Kliima, would pull the
  hero down to the screen's bottom too.
- An HA bump checks, on a screen of at least 1716 px, that the hero still
  reaches past Elekter to Kliima's bottom and that the page has one canvas.
- Undo: revert the commit, bump the resource's `?v=` and run
  `ha-dashboard.py`.
