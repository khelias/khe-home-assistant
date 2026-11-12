# ADR-008: A3 page cards read the recorder's daily statistics themselves

- **Status:** Accepted (2026-11-12); decision 1 extended to hourly lines by [ADR-011](011-a3-hourly-lines-and-a-written-setpoint.md)
- **Related:** [ADR-002](002-own-dashboard-cards.md), [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-007](007-a3-in-the-overview.md)

## Context

ADR-005 decision 5 let only the history sheet read the recorder: opened by
a tap, over fixed 24 h, 7 and 30 day ranges. Energia in A3's look
(ADR-007 decision 3) shows daily bars on the page itself: 31 days of the
house's consumption and cost and 30 days of the price, with the day's
dearest hour. Kodu drew these with HA's statistics graph and an apexcharts
card, which do not take A3's look.

## Decision

1. **A3 page cards read `recorder/statistics_during_period` with
   `period: "day"` themselves.** The window starts at midnight in HA's time
   zone (`hass.config.time_zone`), counted in calendar days, not
   milliseconds, so a range across a clock change and a phone in another
   zone see HA's own days. A card loads when it first draws and again when
   the hour in HA's zone changes; cards asking the same thing in the same
   hour share one request. The generator names each statistic.
2. **A delayed counter has a cutoff.** Estfeed delivers hours late, so the
   cards read the counter by the hour for the last two days and treat the
   end of its last hour with data as the cutoff: days past it are drawn
   lighter and kept out of the averages and extremes, and the month's pace
   is measured to it.
3. **Last month per sub-meter comes from each sensor's own attribute**: the
   utility meters' `last_period`, and on Daikin's monthly boiler energy the
   attribute named by the previous month in English. On the first two days
   of a month last month's numbers are left out, since a sensor may still
   hold the month before.

## Alternatives considered

- **HA's statistics graph and apexcharts in glass:** card-mod on another
  card's shadow DOM, and still not A3's bars, colours or numbers (ADR-005).
- **Recorder reads only in the sheet:** Energia's page would show numbers
  without their days, and every look at a month would cost a tap.

## Consequences

- A frontend or recorder change to `statistics_during_period` can blank the
  Energia cards as well as the sheet; the HA bump check in
  `docs/operational-notes.md` covers both.
- A sub-meter that changes its attributes (a Daikin integration update)
  loses its last-month number, not its row.
