# ADR-003: The demo's English is a demo-only translation

- **Status:** Accepted (2026-10-20)
- **Related:** [ADR-001](001-own-3d-engine.md), [estate ADR-015](https://github.com/khelias/khe-architecture/blob/main/decisions/015-family-design-layer.md)

## Context

The public demo at `khe.ee/ha/` is the real dashboard's generator run on the
made-up test house (`scripts/dashboard_demo.py`), drawn by `demo/` and the
3D card. Every visible string was Estonian: about 220 in
`dashboard_config.py`, the demo catalogue's names and state words, the test
house's room, device and future-item names, some 140 in `demo/` and some 45
in `house3d/house3d-card.js`, with every number and date formatted for
`et-EE`. khe-sites wraps the demo with the khe.ee site header, whose et/en
switcher defaults to English, so most visitors saw an English header over an
Estonian dashboard.

`dashboard_config.py` is also the real house's dashboard, and
`house3d-card.js` and the engine are deployed to the real HA, where the
household reads Estonian.

## Decision

1. **English is a translation of the demo's Estonian output, in the demo
   generator.** `scripts/dashboard_demo_en.py` holds `EN` (visible text:
   titles, headings, names, labels, confirmations, markdown, friendly names,
   the test house's names and facts), `WORDS` (state values, select options
   and the label sensors' mirrored words, kept apart because "Sees" and
   "Väljas" read "Indoor" and "Outdoor" as names but "On" and "Off" as
   states), `SAME` (product names and units that read the same in both) and
   `TEXTS_EN` (the sample markdowns, keyed by the Estonian sample text).
   `dashboard_demo.demo_config_en`, `demo_states_en`, `demo_series_en` and
   `demo_model_en` walk the Estonian output; a visible string or a non-raw
   state word the maps lack fails the build with a `KeyError` naming it, as
   an uncatalogued entity id already does. `house3d-build.py --demo` writes
   `dashboard.en.json`, `states.en.json`, `series.en.json` and
   `model.en.json` next to the Estonian files. `dashboard_config.build()`
   takes no language and the real dashboard stays byte-identical.
2. **The demo picks its language from `?lang=en` at load, else Estonian.**
   `demo/strings.js` reads it once and holds every UI string of `demo/` in
   both languages with the `Intl` locale (`en-GB`, `et-EE`); `demo.js`
   loads the `.en.json` files in English. The host keeps `?lang` current
   and reloads the page when its switcher changes the language: on khe.ee
   the site header's locale controller writes `?lang` before `demo.js`
   runs. A URL parameter like `?light`, decided by the repo that reads it.
3. **The 3D card takes its language from its config, `language: en`**, not
   from `hass.locale`. Only the demo sets it, so the real house's card stays
   Estonian whatever a household member's HA profile language is. The
   engine takes its one string, the WebGL fallback, as a mount option from
   the card.

## Alternatives considered

- **`dashboard_config.build(lang)`.** Puts a second language into the real
  dashboard's generator: every inline string becomes a lookup, and the
  house's own dashboard becomes harder to read and to change for a reader
  it never has.
- **Translating in khe-sites.** khe-sites publishes the demo; it does not
  know the dashboard's strings, and a translation there breaks silently
  when the generator changes. The repo that makes the strings owns their
  English.
- **`hass.locale` in the 3D card.** Right for a card shared between
  households, wrong here: a household member with an English HA profile
  would get an English card in an Estonian dashboard.

## Consequences

- A new or changed Estonian string in `dashboard_config.py`,
  `dashboard_demo.py` or the test house needs its English line in
  `dashboard_demo_en.py` before `scripts/check.sh` passes; the `KeyError`
  names the string.
- A new UI string in `demo/` goes into both tables of `demo/strings.js`,
  and one in `house3d-card.js` into both of its tables; the tests compare
  the key sets.
- Switching language on khe.ee reloads the demo: the open view stays (the
  hash), the simulated states start over, as the drawer says they do on
  any reload.
- Wording is not a decision: English follows Home Assistant's own English
  for state words and `en-GB` for numbers and dates, and changes by editing
  the maps.
