# ADR-015: A3 page cards read state history for many entities, and the house plan

- **Status:** Accepted (2026-11-13)
- **Related:** extends [ADR-008](008-a3-page-cards-read-statistics.md) (page cards load their data once an hour) and [ADR-012](012-the-demo-is-the-houses-overview.md) decision 3 (the demo's recorder answers what the cards ask); [ADR-001](001-own-3d-engine.md) owns the house model the plan is cut from

## Context

Valve is the fifth view to move into A3's look (ADR-007 decision 3). The
operator opens it to arm or disarm, to see that the doors are shut, to see
where there was motion last and when something is wrong. The approved
mockup draws the house's nine PIRs as a trail through the floor plan over
the last 15 minutes, with each room's 24 hourly motion counts as a strip and
its last time, and each door with the time it was last opened.

None of that is in a statistic: binary sensors keep no long-term
statistics, and a PIR's `last_changed` is reset by every HA restart (all
nine read 14:11 after the restart of 2026-11-13). The only source is the
recorder's state history. The page cards so far read statistics (ADR-008)
or a service response (ADR-014), once an HA-zone hour; a motion strip that
waits an hour for its last event, or a "last motion 4 min ago" that is
an hour old, is wrong.

The trail needs the house's floor plan. The 3D card already gets the whole
merged model in its config; a card that only draws the plan needs much
less of it.

## Decision

1. **A card reads the state history of all its entities in one message**:
   `history/history_during_period` over the last 24 hours with
   `minimal_response` and `no_attributes` (about 150 to 200 KB for the
   house's nine PIRs and three doors), not shared between cards. It
   counts off-to-on changes only: the first row of each entity is its state
   at the start, not an event.
2. **Its cadence**: it loads when HA's hour changes, and when it is
   connected again with data older than five minutes (after the operator
   was on another view). Between loads it merges the live off-to-on changes
   it sees in `hass`, deduplicated by second against the history, and it
   redraws on a minute key of its own, separate from the load's hour key,
   so "4 min ago" moves without a load.
3. **khe-cards becomes a second reader of the house model, through a plan
   slice**: the generator passes the motion card the room ids, rects and
   labels, the wall segments with their door openings, and `{pir, room}`
   for the PIRs on the card; never the private layer's devices or the full
   model. The card builds the route graph from the slice: room rects,
   door openings and open passages (two rooms' rects sharing an edge with
   no wall on it). Without a model the card leaves the plan out and keeps
   the rows.
4. **The demo's recorder answers the history message for motion** with a
   `pulses` profile: short on-events with a daily rhythm per room,
   deterministic, ending at the catalogue's state and its age, quiet in the
   30 minutes the 3D scenarios start from (extends ADR-012 decision 3).

## Alternatives considered

- **Statistics.** Binary sensors have none.
- **One request per entity.** Twelve round trips on every load, for the
  same rows.
- **The 3D hero's own room glow.** It shows motion now, not a trail, and no
  strips or times; Valve has no hero.
- **The full model in the card's config.** A third ~21 KB copy of the model,
  devices included, for a card that draws rooms and walls.

## Consequences

- A frontend change to `history/history_during_period`'s compressed rows
  (`s`, `lu`) blanks the strips and the trail and leaves the rows' names;
  the HA bump check in `docs/operational-notes.md` compares Valve's strips
  and door times with a direct history read.
- Each Valve open reads up to 200 KB of history, at most once in five
  minutes; the house's recorder answers it in well under a second.
- A change to the model's rooms or walls reaches the card with the next
  `ha-dashboard.py` save, as the 3D card's does.
