# ADR-011: A3 page lines read hourly statistics, and a page card writes a setpoint

- **Status:** Accepted (2026-11-12)
- **Related:** [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-007](007-a3-in-the-overview.md), [ADR-008](008-a3-page-cards-read-statistics.md)

## Context

Soojuspump in A3's look (ADR-007 decision 3) shows two 48-hour lines on the
page: the indoor temperature and the boiler water. ADR-008 decision 1 let
page cards read the recorder by the day only. The view also keeps the one
heating knob the unit exposes, the weather curve's shift
(`number.space_heating_temperature_control`, -10 to 10 in steps of 1), on
the page; Kodu showed it as a value and changed it on the settings subview
with HA's numeric-input feature. The Daikin integration is local, but a
write per tap is still a burst of writes to the unit.

## Decision

1. **A page line reads hourly `mean` statistics** (`period: "hour"`) for the
   last whole hours, 48 on Soojuspump, with ADR-008's shared request cache
   and hour key: the window starts at a whole hour, so cards asking the same
   in one hour share one request, and the line loads again when the hour in
   HA's zone changes. The line ends at the entity's live state, so its last
   point agrees with the big number while the hour's statistics are not
   compiled yet.
2. **The shift is a stepper on the page that writes the setpoint itself.**
   A tap moves the shown value at once, within the entity's `min`, `max` and
   `step`; the card calls `hass.callService('number', 'set_value')` once
   1.5 s pass without a tap, not through a `hass-action` event, which is lost
   when the card has left the page. A pending write is flushed in
   `disconnectedCallback`; taps that net to the current value send nothing.
   The pending value outlives redraws and is dropped on an error (with the
   line "Ei õnnestunud") or after 60 s without the entity reporting it.

## Alternatives considered

- **HA's numeric-input feature on a stock tile:** not A3's look (ADR-005).
- **A write per tap:** five taps would be five writes to the unit and five
  round trips that can arrive out of order.

## Consequences

- The stepper writes without HA's confirmation dialog: a shift is small and
  undone by the opposite tap, as Kodu's numeric input was.
- A frontend change to `callService` or to `statistics_during_period` can
  break the stepper or blank the lines; the HA bump check in
  `docs/operational-notes.md` covers both.
