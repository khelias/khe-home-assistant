# ADR-007: A3 is the Overview's first view, Kodu goes, the 3D view moves last

- **Status:** Accepted (2026-11-12); decision 2's demo half superseded by [ADR-012](012-the-demo-is-the-houses-overview.md): the demo builds `overview()`, A3 first and 3D last
- **Related:** [ADR-002](002-own-dashboard-cards.md), [ADR-005](005-a3-glass-cards-history-sheet.md), [ADR-006](006-a3-front-page-live-hero.md)

## Context

ADR-006 made A3 the front page as a second dashboard, `kodu-katse`, opened
through HA's `default_panel`, with Kodu left in the Overview ("Ülevaade")
and the 3D view still its first tab. The household meant A3 to be the
Overview itself: one dashboard, A3 first, Kodu gone, the 3D view last, and
the other views in A3's look over time.

## Decision

1. **The house saves `dashboard_a3.overview()` to the Overview.** It is
   `dashboard_config.build()`'s views with A3's view in place of Kodu, at
   Kodu's path `kodu`, so every `/lovelace/kodu` link keeps working, and
   the `maja-3d` view moved to the end. The `kodu-katse` dashboard is
   removed and `default_panel` is `"lovelace"` again. This supersedes
   ADR-006 decision 1 and ADR-005 decision 1 (A3 at `kodu-katse`, saved by
   `--a3`, Kodu unchanged), and settles ADR-005's "Making A3 the front page
   is a later decision".
2. **Kodu stays in code.** `dashboard_config.build()` is unchanged: the
   public demo builds it, 3D first, and A3 reads Kodu's first page from
   `dashboard_config.home()` for its entities, actions and confirmations.
   The house and the demo differ in view order and first view until the
   demo moves to A3. ADR-006 rejected replacing the Overview because Kodu
   would be lost as the fallback and the demo builds it; with Kodu kept in
   code, the fallback is a revert.
3. **The other views and the settings subviews will follow A3's look**,
   one view at a time, each with a mockup and its own plan. This widens
   ADR-005's narrowing of ADR-002 from the A3 dashboard to the whole
   Overview and ends "Kodu stays on stock cards". The camera full screens
   stay as they are. The demo's move to A3 is its own later decision and
   will supersede ADR-005 decision 6.

## Alternatives considered

- **Keep A3 as a second dashboard behind `default_panel`** (ADR-006): Kodu
  stays in the Overview as a second first page, and `default_panel` is set
  per user.
- **Replace `dashboard_config.build()`'s Kodu with A3:** the demo would show
  A3 elements it cannot draw without a recorder.

## Consequences

- Undo to the Overview with Kodu and 3D first: revert the commit and run
  `ha-dashboard.py`. To get ADR-006's state back too, run
  `ha-dashboard.py --a3` from the reverted code (it recreates `kodu-katse`)
  and set both `default_panel` values to `"kodu-katse"`.
- One dashboard holds two 3D cards, the hero and the 3D view; a change to
  the 3D card is checked on both.
- Each redesigned view moves the Overview further from the demo until the
  demo step.
