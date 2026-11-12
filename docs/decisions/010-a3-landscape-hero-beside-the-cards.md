# ADR-010: On wide screens A3's hero sits on the left, beside the cards

- **Status:** Accepted (2026-11-12)
- **Related:** [ADR-005](005-a3-glass-cards-history-sheet.md) (supersedes its decision 4 in part), [ADR-006](006-a3-front-page-live-hero.md), [ADR-007](007-a3-in-the-overview.md)

## Context

A3 stacked the 3D hero, 300 px high and as wide as the view, over the Kodu
title with its chips and three sections, Elekter, Juhtimine and Kliima.
On a landscape tablet or a desktop the hero then filled a wide, low strip
and the cards went below the fold. The household wanted the house on the
left and the rest on the right; the phone in portrait was right as it was.

HA's sections view (frontend 20261028.5, HA 2026.11) limits the layout. A
column is 320 to 500 px wide with a 32 px gap, so the column count is
`floor((width - 64 + 32) / 352)` clamped to `max_columns`, and all columns
share one row grid whose rows are as tall as their tallest section. A
section sits beside several others only by spanning rows (`row_span`); there
is no masonry. Measured on the house: the Kodu title and chips 101 px,
Elekter 606, Juhtimine 519, Kliima 413.

## Decision

1. **The hero and the title are one section, one column wide and two rows
   high; Elekter spans two rows too; the view allows four columns.** The
   section order is unchanged, so one column (the phone) stacks exactly as
   before. Two columns: Elekter beside the hero, Juhtimine and Kliima under
   them. Three (a 1180 px tablet with HA's sidebar hidden or collapsed):
   Elekter and Juhtimine beside it, Kliima under Juhtimine, about 240 px of
   scrolling at 820 px high. Four (content at least 1440 px wide): all
   three beside it, no scrolling. This supersedes ADR-005 decision 4's
   "spans the view's width" from two columns up; the rest of decision 4
   stands.
2. **From two columns the title sits over the hero and the chips under
   it.** The title row ("Kodu" and the outdoor temperature) then lines up
   with the Elekter and Juhtimine headings, baseline to baseline, and the
   hero's top with their cards. The chips card draws either part
   (`part`), and HA's screen condition shows the wide pair from 736 px,
   where a second column starts without HA's sidebar, and the whole card
   under the hero below it, so the phone keeps its order.
3. **The hero follows its row.** With `stretch` the 3D card grows until its
   section ends where the tallest section starting on its row ends, never
   past the screen and never under the box its `height` gave it. It finds
   that row by walking up to HA's `.section` element in the view's
   `.content`; when HA's markup changes and none is found, it keeps its
   `height`.

## Alternatives considered

- **A layout card of our own in `cards/khe-cards.js`** that pins the hero
  while the right side scrolls: more code, no HA editor for the view, and
  the phone would go through the same card. The household chose a little
  scrolling on the tablet instead.
- **The Kodu title on the right above the cards:** it would need its own
  section, which widens the gap under the hero on the phone from 8 to 24 px
  and leaves an empty column beside the hero at two columns.
- **Title and chips both over the hero:** the hero would start about 40 px
  below the cards beside it.
- **The title under the hero, as on the phone:** the first tried; the
  household found the headings line up better with it on top.
- **Narrower columns through a theme variable** for four columns on the
  tablet: the variable is global to every sections view, and Elekter at
  250 px grows taller, so the page still would not fit.

## Consequences

- On the phone the hero's canvas is 312 px instead of 300: with its grid
  rows at auto it fills the box its rows used to give it, so the sections
  below stay where they were.
- With HA's sidebar open, between 870 and 990 px the screen condition
  shows the wide order in one column: title, hero, chips.
- The card reads HA's view markup; an HA bump checks that the hero still
  stretches beside Elekter.
- Undo: revert the commit and run `ha-dashboard.py`; the resource's `?v=`
  goes back with the card.
