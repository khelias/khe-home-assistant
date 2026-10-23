# khe-home-assistant

The Home Assistant configuration of one house, public as a reference: the
YAML packages, the dashboard generator, the CLI tools around HA's API and the
3D house view. The container, its image pin, the Renovate hold on HA bumps
and the backup stay in [khe-homelab](https://github.com/khelias/khe-homelab).
This file holds rules and pointers; the reference lives in:

- [README.md](README.md) - what the repo is, for people
- [docs/operational-notes.md](docs/operational-notes.md) - per-integration
  quirks, measured behaviour and the 3D view
- [docs/decisions/](docs/decisions/) - this repo's decisions, estate-style
  ADRs (the estate's own are in khe-architecture): the 3D engine (ADR-001),
  the dashboard's own cards ([ADR-002](docs/decisions/002-own-dashboard-cards.md))
  and the demo's English ([ADR-003](docs/decisions/003-demo-in-english.md))
- [ROADMAP.md](ROADMAP.md) - house automation, near-term and the long form

House documentation (HA rollout, dashboard layout, HVAC protocols, energy)
is in the private `khe-meta` repo under `house/`: it names devices, LAN
addresses and metering data. Read `house/home-assistant-plan.md` before
analysing house data: its method rules are not loaded into context on their
own.

## Layout

```
cards/             the dashboard's own Lovelace cards (khe-cards.js, ADR-002):
                   summary, price and tile, no view on them yet; deploy
                   copies them to www/khe-cards/
config/            what deploy copies into HA's /config
  configuration.yaml
  packages/        one package per device or concern
  tuya_local_devices/  device definitions copied into tuya-local at HA start
demo/              the public demo: the real dashboard's views on made-up
                   data, 3D first, on a simulated hass (sim.js); the sections
                   view and its cards in cards.js, charts.js, icons.js, the
                   page in demo.js and index.html, its UI strings in both
                   languages in strings.js, its scenarios' player in
                   scenario.js; not deployed to HA
docs/              operational notes and the README screenshot
  decisions/       ADRs: NNN-slug.md, numbered from 001
house3d/           3D house view: engine (core house3d.js, scene/ layer
                   modules, kit and sun), HA card, standalone viewer,
                   placement page, vendored three.js
scripts/           dashboard_config.py (the HA Overview as data, no I/O),
                   ha-dashboard.py (reads the private inputs, saves it),
                   dashboard_demo.py (the demo's made-up entities, texts and
                   series for the same config), dashboard_demo_en.py (its
                   English, ADR-003), dashboard_scenarios.py (the demo's
                   scenarios),
                   ha-ws.py (HA WebSocket commands from the CLI),
                   house3d-* and house3d_model.py (3D view build, vendoring,
                   device and tree placement, ETAK surroundings, model),
                   house3d-test.sh (the 3D view's and the cards' tests),
                   pv-sim.py (rooftop PV, battery and EV simulation against
                   the Estfeed hourly load), check.sh, install-hooks.sh
tests/house3d/     3D view tests on a made-up fixture house: model and build
                   (Python unittest), engine, simple-style snapshot, demo
                   dashboard and scenario player (node:test)
tests/dashboard/   dashboard config, demo catalogue and scenario tests
                   (Python unittest)
tests/cards/       the dashboard cards' pure helpers (node:test)
```

## Commands

- Setup once after cloning: `python3 -m venv .venv && .venv/bin/pip install
  ruff==0.17.0` (the version `ci.yml` pins), then
  `bash scripts/install-hooks.sh` for the gitleaks pre-commit hook.
- `bash scripts/check.sh` is the whole check: `bash -n` on every
  `scripts/*.sh`, `scripts/house3d-test.sh` (needs `node` and `python3`), the
  dashboard tests, the privacy scan of the demo when the real model is at
  hand (skipped in CI) and ruff lint and format over `scripts/`. It runs
  everything and exits 1 if anything failed. CI runs it with `RUFF=ruff`, the
  workspace commit gate before each commit.
- `ruff check --fix scripts && ruff format scripts` before committing Python.
- `python3 -I scripts/house3d-build.py --demo OUTDIR` builds the demo from the
  made-up test house only (`tests/house3d/fixture-model.md`): the card, the
  engine, the dashboard cards, `demo/` and the generated dashboard, states
  and series, in Estonian and as `*.en.json` in English, which the demo
  shows with `?lang=en` ([ADR-003](docs/decisions/003-demo-in-english.md)). khe-sites
  runs it and publishes the result at <https://khe.ee/ha/> on its next
  deploy: a push to khe-sites, its weekly schedule, or
  `gh workflow run deploy.yml -R khelias/khe-sites`.
- `ha-ws.py` and `ha-dashboard.py` import `websockets`, and `pv-sim.py`
  needs numpy and scipy (plus websockets for its `fetch`). The `.venv` above
  carries only ruff; run those scripts from a venv that has them.

## Rules

1. **Public repo: nothing secret or identifying.** No tokens, device ids,
   local keys, LAN addresses of house devices, coordinates, family names or
   room names. Those live in khe-meta `house/` and in the untracked
   `~/.config/khe/*.json` files; the header comment of
   `scripts/ha-dashboard.py` says which file carries what, and every
   consumer degrades to leaving the card out when a file is missing. The
   gitleaks hook covers secrets; personal-data patterns are caught by the
   khe-workspace commit gate; names and street addresses by nobody.
2. **The 3D view and the demo carry no house data.** The model is khe-meta's
   `house/house-model.md`. Run `scripts/house3d-build.py --scan <model>
   house3d/` with the real model before every commit that touches
   `house3d/`, and before publishing anything built from the model.
   `check.sh` scans `house3d/`, `cards/`, `demo/`, `scripts/dashboard_demo.py`,
   its English and `scripts/dashboard_scenarios.py`, the
   test house and the whole fresh demo build with `--count` whenever the
   model is at hand (the main checkout's khe-meta or `HOUSE3D_MODEL`), so the
   commit gate covers the demo; CI has no model. What the test house may
   carry anyway (its `devices` key) is allowed
   per file in `check.sh`, with the reason, not by loosening a pattern. The ids and labels the scan flags are spelled once,
   in `dashboard_config.py`, and the demo takes them from there.
3. **Modules under `house3d/scene/` import nothing**
   ([notes](docs/operational-notes.md#the-3d-house-view-house3d)); the engine
   tests enforce it.
4. **Fork PRs can reach the homelab runner.** Fork PR approval stays at
   `all_external_contributors`, and a fork run is approved only after
   reading its `.github/workflows/` diff ([estate
   ADR-020](https://github.com/khelias/khe-architecture/blob/main/decisions/020-agent-work-through-pull-requests.md)).

## Deploy

A push to `main` that touches `config/`, `house3d/` or `cards/` runs `deploy.yml` on
the homelab runner. A throwaway container of the running HA image (no
network, entrypoint `sh`, so no second HA starts) checks that the volume
holds `.storage`, runs `check_config` on a copy of `config/`, then replaces
`configuration.yaml`, `packages/`, `tuya_local_devices/`, `www/house3d/` and
`www/khe-cards/` in HA's config volume `homeassistant_ha_config`. **Deploy never restarts
HA**: that stays the API step below. If the volume does not exist, deploy
fails instead of creating an empty one.

What stays in khe-homelab: the compose file and the volume definition, the
image pin and the Renovate hold on HA bumps, `backup.sh` (which covers
`.storage`, `custom_components/` and the recorder) and the host's security
model in its `SECURITY.md`.

Automated writers
([estate ADR-007](https://github.com/khelias/khe-architecture/blob/main/decisions/007-automated-writers.md)): Renovate
automerges GitHub Actions minor and patch updates, digests and pins
(`renovate.json`), and every merge to `main` that touches `config/`,
`house3d/` or `cards/` deploys the config. The way back is to revert the commit on
`main` and push: the revert is a new config deploy, and HA keeps running
what it loaded last until a restart or reload, so restart or reload it
after the revert lands. A new automated writer joins the estate's writer
register in khe-meta in the same change.

## Working on Home Assistant

HA is operated through its API: not the UI, not SSH. Reads the agent makes
directly. Writes (service calls, restarts and reloads, helper values,
registry and dashboard changes) change the running house, so the agent asks
the operator first; an approval covers that task only.

- **Token:** a long-lived token in `~/.config/khe/ha-token` on the operator's
  machine, mode 600. Read it inside scripts; never print or commit it.
- **REST** for states, service calls, `POST /api/template`, diagnostics and
  `POST /api/services/homeassistant/restart` (back in ~10 s; wait another
  ~40 s before trusting a state read). **WebSocket** (`/api/websocket`) for
  the entity and device registries, config entries, dashboards and HACS,
  sent with `scripts/ha-ws.py '{"type": "..."}'`, which handles auth and ids.
  Host and port are in `scripts/ha-dashboard.py` and `scripts/ha-ws.py`.
- **Config lives in git, not on the VM.** Edit `config/packages/*.yaml`,
  commit, the operator pushes, deploy copies it into the volume, then
  restart or reload HA through the API. Deploy replaces
  `configuration.yaml`, `packages/`, `tuya_local_devices/`, `www/house3d/`
  and `www/khe-cards/` in the volume, so a hand edit there is lost at the
  next deploy.
- **YAML platforms need a restart, not a reload:** `input_*`, `rest:`,
  `shell_command:` and the group `cover:`/`light:` platforms. Automations and
  templates reload, but a template reload blanks the trigger-based price
  sensors until the hourly tick: follow every `template/reload` at once with
  `POST /api/events/khe_price_refresh`
  ([notes](docs/operational-notes.md#reloads-restarts-and-prices)).
- **Helpers come up at their minimum.** Set the first value through the API;
  `initial:` would overwrite the household's choice on every restart.
- **The dashboard is generated**: `dashboard_config.build()` makes it and
  `scripts/ha-dashboard.py` saves it, and HA adds sections to the stored
  config by itself when a new device appears. Before rerunning, diff the
  generator's output against the live config: load `ha-dashboard.py` with
  `importlib` (it needs no `websockets` until it saves), dump
  `local_config()`, compare with a WebSocket `lovelace/config` read. The
  public demo is the same `build()` on made-up inputs, so a new entity id
  needs an entry in `dashboard_demo.CATALOGUE` (the dashboard tests name it)
  and a new templated card a sample text in `TEXTS`. The demo is English
  too, so a new visible string needs its English line in
  `scripts/dashboard_demo_en.py` (`EN`, a state word in `WORDS`, a sample
  text in `TEXTS_EN`); the demo build's `KeyError` names it.
- **A demo scenario labels a step as an automation only for what a real
  automation does.** `scripts/dashboard_scenarios.py` may tell any story with
  the demo's devices, but a step that carries an alias touches only entities
  that automation's `actions:` in `config/packages/` name, and a step with no
  action follows one that set its trigger; `tests/dashboard/test_dashboard_scenarios.py`
  enforces it, so a renamed alias or changed actions fail it too. A new
  caption needs its English in `dashboard_demo_en.EN`.
- **A redesigned view uses the repo's own cards**
  ([ADR-002](docs/decisions/002-own-dashboard-cards.md)), `cards/khe-cards.js`;
  no view does today, Kodu went back to stock cards on 2026-10-18. A change
  to the cards bumps `KHE_CARDS_VERSION` and the resource's `?v=`
  ([notes](docs/operational-notes.md#dashboard-cards-cards)).
- **The house is the House room of the KHE family**
  ([estate ADR-021](https://github.com/khelias/khe-architecture/blob/main/decisions/021-family-shell-and-design-check.md)):
  its accent (`house`) and its ground (`house-ground`) are in khe-sites'
  `DESIGN.md`. The house drawing keeps its own look; the dashboard and the
  3D view's controls around it follow ADR-021 point 1 (the family's ground,
  type, controls and lists, no gradients, blur or glow) by review, since
  this repo has no npm project and is outside the family's design check
  (`khe-design-lint`). On `/ha/` the header takes the dark family values
  until the 3D view has a light theme.
- **Keep the house idiom in a new view**, and read two existing views first.
  A row is a `horizontal-stack` of 2-4 vertical tiles or `third()`, never a
  lone full-width tile; full width is for charts, forecast cards and alerts.
  Each number appears once (turn off a forecast card's `show_current` when a
  tile already carries the value). Badge labels are short and still say what
  they control. The front page holds what is done daily; per-side controls,
  rare settings and diagnostics go on a `subview` behind a "Seaded" badge. A
  `note()` truncates to one line, so longer text needs a markdown card.
- Read the integration's section in `docs/operational-notes.md` before
  touching it.

All content in English, except user-facing Estonian strings in the
dashboard, packages and the 3D view.
