# ADR-013: A days card opens a long-range sheet: 30 days, 90 days, 12 months

- **Status:** Accepted (2026-11-13)
- **Related:** extends [ADR-005](005-a3-glass-cards-history-sheet.md) decision 5, [ADR-008](008-a3-page-cards-read-statistics.md) decision 1 and [ADR-012](012-the-demo-is-the-houses-overview.md) decision 3

## Context

The A3 page cards that draw days (Energia's "Päevad" and "Hind 30 päeva",
Soojuspump's "Boileri elekter", Ventilatsioon's "Kas tasub end ära") show
16 to 31 days. The operator, looking at them on the phone (2026-11-13),
asked to see a longer period. A reading card's value and its cells open
the history sheet; a days card opened nothing.

The sheet's ranges are fixed at 24 hours, 7 and 30 days (ADR-005 decision
5), justified by the recorder keeping 30 days. Long-term statistics are
never purged, so a statistic that the days cards read holds every day and
month since it began. In the house that is the summer of 2026: the price
from June, consumption and cost from July, the boiler and the recovered
heat from August, each with a partial first month.

## Decision

1. **A tap on a days card's headline opens a sheet for the series shown**
   (Energia's kWh or Eurod, whichever is picked), with the ranges 30 days,
   90 days and 12 months, opening on 30 days. The card itself stays as it
   is. The overlay and the ratio of Ventilatsioon's card, and the price's
   dearest hour, stay on the card; the sheet shows the one series.
2. **The window is counted in HA's calendar, by slots.** 30 and 90 days
   read `period: "day"` from midnight in HA's zone 29 and 89 days back;
   12 months reads `period: "month"` from the 1st 11 months back. Today or
   this month is the last slot. Bars and points sit in equal index slots of
   the dense list of days or months, not by time, and a slot without data
   stays empty. Axis and pointer labels are formatted in HA's zone. This
   extends ADR-008 decision 1 with the month period.
3. **Only finished, whole slots count.** The last slot, the first day or
   month with data inside the window (a statistic may begin mid-period),
   and for a delayed counter
   the slots past ADR-008 decision 2's cutoff are drawn lighter and kept
   out of the numbers. The big value is the average per counted day or
   month, worked out from the sheet's data, not a state; a days sheet never
   falls back to history.
4. **Each days series names its sheet's `title` and a real entity for
   "Rohkem"** in the generator, since an external statistic
   (`estfeed:...`) has no state and no more-info.
5. **The demo's recorder answers `period: "month"`**, each month the sum or
   the mean of its hours, so the demo's sheets fill (extends ADR-012
   decision 3).

Tile and reading sheets keep 24 hours, 7 and 30 days (ADR-005 decision 5).

## Alternatives considered

- **A period switch on the card itself.** The card's place on the page is
  for the recent days; a second control there competes with Energia's unit
  switch.
- **Longer ranges for every sheet.** A measurement's 5-minute and hourly
  statistics are purged with the recorder; only the daily and monthly ones
  last, and the tiles' own question is what happened lately.

## Consequences

- 12 months shows 4 to 6 bars in 2026 and fills up as the statistics age.
- A frontend or recorder change to the `month` period blanks only the
  sheet's 12 months; the HA bump check in `docs/operational-notes.md`
  covers it with the other statistics reads.
