# ADR-004: A two-week trial dashboard may use Bubble Card

- **Status:** Deprecated (2026-11-12). The trial was dropped for A3, [ADR-005](005-a3-glass-cards-history-sheet.md); Bubble Card is removed.
- **Related:** [ADR-002](002-own-dashboard-cards.md), [estate ADR-007](https://github.com/khelias/khe-architecture/blob/main/decisions/007-automated-writers.md), [estate ADR-021](https://github.com/khelias/khe-architecture/blob/main/decisions/021-family-shell-and-design-check.md)

## Context

Kodu went back to stock cards on 2026-10-18 after the A2 design round, and
the operator still finds it plain and awkward next to the dashboards the
community builds. The open question was whether a community frontend card
is acceptable at all; on 2026-11-12 the operator said yes for a trial.
Bubble Card is the most used of them: buttons with a slider, cover and
state built in, and pop-ups that open over the page from a URL hash, so a
system's detail can sit one tap away without a view of its own.

ADR-002 rejected Bubble Card for Kodu (a dependency to keep current, and it
could not draw A2). The rules in `AGENTS.md` built on it say a redesigned
view uses the repo's own cards and keeps the house idiom of tile rows and
Seaded subviews. A trial beside Kodu needs room to break both, and the
A2 round showed that a redesign shipped onto Kodu itself is costly to
take back.

## Decision

1. **A second dashboard, "Kodu katse" (`kodu-katse`), may use Bubble Card;
   Kodu keeps stock cards.** It is generated from git by
   `scripts/dashboard_trial.py` and saved by `ha-dashboard.py --trial`.
   Every entity Kodu's first page shows or acts on stays on the trial's
   first page, with the same confirmations; the detail of each system goes
   into a Bubble Card pop-up. The trial lasts two weeks from its first
   save. Adopting Bubble Card for Kodu needs an ADR that supersedes
   ADR-002; dropping it means removing the dashboard and the card.
2. **The trial does not meet estate ADR-021 point 1, and says so under its
   point 5.** Bubble Card's round buttons, sliders and pop-up shadow are not
   the family's controls and radii. The repo's `AGENTS.md` names the
   exception. The trial still keeps no blur and no translucency: every
   pop-up sets `bg_opacity: "100"` and `bg_blur: "0"`, the first also
   `hide_backdrop: true`. Conformance is decided when, or if, Kodu adopts
   it.
3. **Bubble Card comes from HA's Marketplace (HACS until HA 2026.11),
   pinned to v3.4.3** (2026-10-31, the latest stable release on
   2026-11-12 and the one made for HA 2026.11), like apexcharts-card.
   Marketplace updates stay manual, so there is no new automated writer
   (estate ADR-007).

## Alternatives considered

- **Restyle Kodu in place with Bubble Card.** One dashboard to keep, but a
  rejected direction would again mean rolling Kodu back, and there would be
  nothing to compare it with.
- **Mushroom cards for the trial.** Close to stock tiles; it would not test
  the pop-up idea, which is what moves detail off the first page.
- **Another round of the repo's own cards (ADR-002).** Possible, but every
  element is ours to write; the trial asks first whether the community's
  look and pop-ups are what the household wants.

## Consequences

- Kodu and the public demo are unchanged; the demo has no Bubble Card and
  its tests build only `dashboard_config.build()`.
- The Seaded subviews and the camera panels cannot sit in a pop-up, so the
  trial links into Kodu for them.
- A Bubble Card release can break with an HA frontend bump, as 2026.11 did
  to v3.4.2's pop-ups; the version stays pinned and is updated by hand.
- Removing the trial is in `docs/operational-notes.md`, "Bubble Card trial".
