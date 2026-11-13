# ADR-017: Teler's cards read the session list, and a days card can stack

- **Status:** Accepted (2026-11-13)
- **Related:** extends [ADR-008](008-a3-page-cards-read-statistics.md) decision 2 and [ADR-012](012-the-demo-is-the-houses-overview.md) decision 3; an exception to [ADR-013](013-days-cards-open-a-long-range-sheet.md) decisions 3 and 4 for stacks; [ADR-002](002-own-dashboard-cards.md), [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-007](007-a3-in-the-overview.md)

## Context

Teler is the seventh view to move into A3's look (ADR-007 decision 3). The
approved mockup puts what is on now at the top, with the TV's controls,
then today's watch time by app, today's sessions with their times, and the
week as columns stacked by app. The stock view drew the three as markdown
templates and HA's `statistics-graph` bar-stack.

The data is the Google TV package's (`config/packages/google_tv.yaml`):
`sensor.teleri_seansid`, whose state is today's date and whose `seansid`
attribute lists today's sessions as `{app, start, end}` in epoch seconds
(`end` null while running), changing only when the app changes; the
per-app `sensor.<app>_tana` hours, which reset only after midnight; and
their `total_increasing` copies `sensor.<app>_vaadatud` with daily `change`
statistics. No single statistic carries the week's total.

## Decision

1. **The TV view's cards read the session list and the counters as
   states.** The now card and the sessions card read `sensor.teleri_seansid`
   only while its state is today's date in HA's zone; today's watch time
   is the sum of the `_tana` counters, a counter last updated before today's
   start counting 0 (it still holds yesterday's). A change to the package
   checks both: the HA bump check in `docs/operational-notes.md` names it.
2. **A days card's series may be a stack** of parts with no single
   statistic: each part's daily `change`, today's column from each part's
   live counter in full colour, counted in the headline's total but not in
   the average of the ended days. A stack has no headline sheet and no
   cells: the parts' rows in Täna open their own sheets. It extends ADR-008
   decision 2 (today from the live state rather than lighter and out of the
   numbers) and makes an exception to ADR-013 decisions 3 and 4 (a series'
   sheet, its `title` and `more`) for stacks.
3. **The demo recorder gains a `watch` kind** (extends ADR-012 decision 3):
   from the TV's duty hours it picks one app per hour the TV is on, draws
   the `_vaadatud` daily statistics from it, and at load computes the TV's
   state and app, the `_tana` values, `teler_sees_eile` and
   `teleri_seansid` for the demo's today, so the cards agree with the week.

## Alternatives considered

- **Keep HA's bar-stack chart** under A3's cards: the stock look in the
  middle of the glass page, and no today column until the hourly compile.
- **A new total counter in the package**: one statistic and a sheet for the
  week, but a package change and a recorder entity for a number the parts
  already add up to.
- **Keep the markdown cards**: templates rendered by HA, no A3 look, and no
  sheet per app.

## Consequences

- A package change to the session list's shape, its date state or the
  counters' reset blanks Teler's now note, sessions or totals; the cards
  fall back to "Täna pole veel vaadatud." rather than wrong numbers.
- The week's apps are the package's five and Muu; a sixth app (Telia TV
  sits in Muu) needs the package, `TV_APPS` and a demo weight.
- Turning the TV on is on the page while it is off, with no confirmation:
  the stock view had no way to turn it on (its badges hide while it is
  off), and turning on interrupts nothing. Turning it off and switching a
  profile keep the stock confirmations.
