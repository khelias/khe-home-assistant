# ADR-005: Kodu A3 is drawn by our own glass cards, with a view background and a history sheet

- **Status:** Accepted (2026-11-12); front page: [ADR-006](006-a3-front-page-live-hero.md). Narrows [ADR-002](002-own-dashboard-cards.md) for the A3 dashboard; replaces the trial of [ADR-004](004-bubble-card-trial.md).
- **Related:** [ADR-001](001-own-3d-engine.md), [ADR-002](002-own-dashboard-cards.md), [ADR-004](004-bubble-card-trial.md), [estate ADR-025](https://github.com/khelias/khe-architecture/blob/main/decisions/025-the-house-dashboard-keeps-its-own-look.md)

## Context

The Bubble Card trial (ADR-004) kept every action of Kodu's first page but
was judged no prettier than Kodu: without blur, translucency or a
background it looked like the stock dashboard with rounder buttons. On
2026-11-12 the household chose beauty first for the house dashboard and
approved the A3 design, in Apple Home's manner:

- the live 3D house as the hero at the top, people and alarms as chips
  under it;
- glass cards over a soft background, light and dark;
- Elekter with the price now as a big number, today's and tomorrow's hourly
  bars, the wash, sauna and tomorrow lines and the use today, yesterday and
  this month; Juhtimine with the pergola roof's Ava and Sulge, the pergola
  light with a brightness bar, the ventilation mode as a segmented control,
  the boiler boost and the TV; Kliima with four readings; Süsteem as small
  dots;
- a tap on a value or a device opens a sheet with its history.

Estate ADR-025 lets the house dashboard use glass, blur and gradients.
Bubble Card cannot draw the hero, the bars or the sheet, and the cards of
ADR-002 already draw most of the rest.

## Decision

1. **A3 replaces the trial at `kodu-katse`, titled "Kodu A3", drawn by
   `cards/khe-cards.js` and the 3D card; Bubble Card is removed.** The
   generator is `scripts/dashboard_a3.py`, saved by
   `ha-dashboard.py --a3`. Kodu itself is unchanged. Every entity, action
   and confirmation of Kodu's first page stays on A3's first page.
2. **For A3 the cards are glass boxes, not ink between rules.** With
   `style: a3` a card draws a translucent fill with `backdrop-filter`, a
   hairline edge and a soft shadow, in light and dark from
   `hass.themes.darkMode` (ADR-002 point 2), and honours reduced
   transparency and reduced motion. ADR-002's other points stand.
3. **The background is one CSS value in the view's `background` key**: no
   photo (it would be house data in a public repo), no theme file and no
   restart. The frontend applies a string as the view's
   `--view-background` as it is
   (`src/panels/lovelace/views/hui-view-background.ts`, frontend of HA
   2026.11). The value mixes HA's own theme background variable, so it
   follows light and dark without `light-dark()`.
4. **The 3D card is the hero.** It takes an optional `height` in pixels,
   spans the view's width, and with `height` set a vertical swipe scrolls
   the page while a horizontal drag turns the house.
5. **History comes from the recorder over the frontend's WebSocket.** The
   generator names each tile's source: `recorder/statistics_during_period`
   (periods `5minute`, `hour` and `day` for 24 hours, 7 and 30 days; types
   `mean`, `min`, `max`, or `change` for energy counters) for entities with
   long-term statistics, `history/history_during_period` with the minimal
   response for on/off, mode and other entities, and a fallback to history
   when statistics come back empty. The recorder keeps 30 days, so the
   longest range is complete. The price sheet has no ranges: the forecast
   holds 48 hours and is not recorded. The sheet is a `<dialog>` opened
   with `showModal()`, in the top layer, so no ancestor transform or
   filter clips it.
6. **The A3 elements are not mounted in the public demo.** The demo builds
   only `dashboard_config.build()` and its simulated hass has no recorder,
   which ADR-002's Consequences assumed for every element. The cards' pure
   helpers are tested in `tests/cards/` against recorder responses captured
   from the house, values only.

## Alternatives considered

- **Keep Bubble Card and add card-mod for glass:** CSS on another card's
  shadow DOM, which breaks with its releases and HA's, and still no hero,
  bars or history sheet.
- **HA's own more-info dialog as the history view:** it exists and stays
  one tap further ("Rohkem" in the sheet), but its chart and ranges are
  HA's look and need two taps to change the range.
- **A theme file for the background:** a restart, `frontend:` YAML and a
  theme to pick on each device, for what one view key carries.

## Consequences

- An HA frontend bump can change the `background` handling, the
  `hass-action` handling or the two WebSocket commands; the bump check in
  `docs/operational-notes.md` covers A3.
- A card that breaks on A3 is not caught by the demo; the card tests and a
  look at A3 after each card change are the check.
- Kodu stays on stock cards. Making A3 the front page is a later decision.
