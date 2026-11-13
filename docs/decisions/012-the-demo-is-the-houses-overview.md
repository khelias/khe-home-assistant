# ADR-012: The demo is the house's Overview, and the cards carry their own English

- **Status:** Accepted (2026-11-12); decision 3 extended to the month period by [ADR-013](013-days-cards-open-a-long-range-sheet.md)
- **Related:** [ADR-002](002-own-dashboard-cards.md), [ADR-003](003-demo-in-english.md), [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-007](007-a3-in-the-overview.md), [ADR-008](008-a3-page-cards-read-statistics.md)

## Context

Since ADR-007 the house's Overview opens on A3 (the front page, Energia and
Soojuspump in A3's glass look, 3D last), while the public demo at
`khe.ee/ha/` still built `dashboard_config.build()`: Kodu on stock cards,
3D first. ADR-005 decision 6 kept the A3 cards out of the demo because its
simulated hass had no recorder, and ADR-007 decision 2 left the demo on
Kodu "until the demo moves to A3". After the 2026-11-12 redeploy the
operator noticed that the demo's cards were not the house's.

ADR-003 made the demo bilingual by translating the generator's Estonian
output, with the 3D card taking `language: en` from its config. The A3
cards (`cards/khe-cards.js`) draw most of their words themselves: units,
weekday and month names, the sheet's labels, the `et-EE` number format, and
they key the price level's tone and the tomorrow line on Estonian sensor
words. A translation of the config cannot reach those.

## Decision

1. **The demo is the house's Overview on made-up data.**
   `dashboard_demo.demo_config()` walks
   `dashboard_a3.overview(DEMO_HOUSE, DEMO_PEOPLE, model)`, so the demo
   opens on A3 and shows 3D last in the house's order, and every later A3
   view reaches the demo by itself. This supersedes ADR-005 decision 6 and
   ADR-007 decision 2's demo half. Kodu stays in code as the house's
   fallback (ADR-007 decision 2) but is no longer published.
2. **The cards carry both languages and take theirs from config.** Every
   khe card takes `language` (`et` by default, any other value reads
   Estonian); `hass.language` is not read, so a household member with an
   English profile still sees Estonian (ADR-003 decision 3's reason). One
   table per language holds the UI words, units, weekday and month names
   in the forms used, and the number and date locale; a second maps the
   words the house's sensors write (the price levels, the tomorrow line's
   lead word) to tone and splitting, per language. A test fails on a key
   one language lacks or on an Estonian letter outside the Estonian tables.
   This narrows ADR-003 decision 1: config strings and state words are
   still translated by the generator, and `?lang=en` still picks the
   `.en.json` files at load, but the cards' own words ship in both
   languages inside the `khe-cards.js` HA also loads. `_walk_en` sets
   `language: en` on khe cards as on the 3D card.
3. **The demo has a recorder, and the states that follow the date come
   from it.** The generator writes per-statistic profiles to
   `recorder.json` (a measurement's wave around a level, a counter's daily
   shape, the price's day, an on/off entity's hours); `demo/recorder.js`
   answers `recorder/statistics_during_period` (5-minute, hour and day;
   mean, min, max, change) and `history/history_during_period` in the
   house's response shapes, relative to the moment asked, in the zone the
   demo sets (`config.time_zone`, Europe/Tallinn). At load it computes from
   the same profiles the states that depend on the date: today's and this
   month's counters with their cost and average price, last month's values
   (`last_period`, Daikin's month names), today's and tomorrow's prices,
   the level and its sentence now, a measurement's state as its last
   reading. A month total therefore equals its days on any day of any
   month.

## Alternatives considered

- **Keep the demo on Kodu and add an A3 page beside it.** Two demos to
  keep, and the published one still not the house's.
- **Translate the cards' words in the demo only** (a wrapper that rewrites
  their output). Breaks silently whenever a card changes; the cards own
  their words as the generator owns its strings (ADR-003).
- **Fixed recorder data captured at build time.** Ages with every day the
  build is not rerun: today's bars and the month's total stop agreeing
  with the calendar the visitor sees.

## Consequences

- A change to an A3 card's words needs its English in the same change; the
  key-parity and letter tests in `tests/cards/` catch the missing half.
- A new entity on the Overview needs a demo catalogue entry, a statistic
  it reads needs a recorder profile, and a sentence the house's templates
  write (`tekst`, `hinnang`) needs its English in `dashboard_demo_en.ATTRS`.
- The demo's renderer imitates more of HA's sections view (row spans,
  screen conditions, view backgrounds, window scrolling, a service call as
  a Promise), so the hero's stretch and A3's two layouts are exercised in
  the demo as in HA.
- `khe-cards.js` grows by the English table; HA loads it whatever the
  language.
