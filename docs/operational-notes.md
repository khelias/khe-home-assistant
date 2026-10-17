# Operational notes

Per-integration quirks and measured behaviour of this Home Assistant
configuration. The container layer (trusted proxies, NPM, UFW, tunnel,
backup and restore) is in khe-homelab's
[operational notes](https://github.com/khelias/khe-homelab/blob/main/docs/operational-notes.md#home-assistant).

## Reloads, restarts and prices

**Every `template/reload` must be followed at once by
`POST /api/events/khe_price_refresh`.** Trigger-based template sensors do not
re-run on reload, so the whole price stack (`elektri_hinna_prognoos`, `_tase`,
`odavaim_aken_*`) goes blank and the Kodu Elekter card renders `None. None`
until the hourly tick. A restart is safe, the package has a `start` trigger;
only reload breaks it. An `event_template_reloaded` trigger does not fix it,
the reload races the entities listening for it (core issues #65832, #101835).

**A Nord Pool delivery date is a CET day**, 01:00-01:00 Estonian time, so
`nordpool.get_prices_for_date` for today starts at 01:00. The forecast sensor
also fetches yesterday and keeps slots from local midnight; without that the
00:00 hour is missing and the price level goes blank every night until 01:04.
The integration's own "tomorrow available" flag flips on the same CET clock.

**Config changes need a restart or a reload.** Deploy copies the YAML into
the config volume only after `check_config` passed on it in a throwaway
container of the running image, and the running HA does not notice the new
files. Reload what reloads (automations, templates, then
`khe_price_refresh`, above) or restart through the API,
`POST /api/services/homeassistant/restart`.

## Integrations and the dashboard

**Grid consumption from Estfeed (since 2026-09-13).** HACS custom repository
`khelias/ha-estfeed` (fork of `tehisain/ha-estfeed` with the day/night grid
tariff, cost sensors, the resume-point fix and the hourly price statistic
`estfeed:estfeed_price`; a permanent fork that merges upstream in). The API key is entered in the integration's UI
flow and lives in `.storage`, nowhere else. Tariff options are on the config
entry (Settings -> Devices -> Estfeed -> Configure); the values and the
reasoning are in
khe-meta's `house/home-assistant-plan.md`, section "House meter without
hardware".
If the cost history looks like spot-only after an options change, or the
cumulative sums jump (check monthly totals against the self-service), run
the `estfeed.backfill_history` service (months: 2): it rewrites both series
from zero over the window. The integration's default
entity ids embed the metering point EIC; they were renamed in the entity
registry to `sensor.maja_*`, `binary_sensor.maja_andmed_varsked` and
`button.maja_*` so the dashboard generator can reference them in this public
repo. A fresh install of the integration would recreate the EIC-based ids.
Options can also be set over REST through
`/api/config/config_entries/options/flow`, but a change made while the
initial backfill is still running gets overwritten; run `backfill_history`
afterwards. The fork has no releases, so HACS sees a new commit only after
`hacs/repository/refresh` (WebSocket); download the update in the HACS UI
after that.

**UniFi Network (since 2026-10-13).** The core integration talks to the
Cloud Gateway Ultra at the gateway address, port 443, with a local UniFi
user made for HA, and SSL verification off (the gateway's certificate is
self-signed). Options: track clients and UniFi devices on, wired clients
off, "ignore private MAC" off. Client trackers arrive disabled by the
integration and the config entry's "Enable newly added entities" is off, so
guests and new IoT clients add nothing; enable only household phones, which
need "Private Wi-Fi Address: Fixed" (not "Rotating") for this network or
their tracker changes identity. Used for network health (gateway and AP
state, firmware update entities) and phone presence beside the Companion
app. The integration has no plain WAN up/down entity, so the dashboard shows
the gateway's Cloudflare latency probe, and Kodu turns red when it goes
unavailable. The WLAN's own entities embed the SSID, so the generator here
uses the AP's client count instead. Both `sensor.unifi_gateway_cloudflare_wan_latentsus`
and `sensor.u6_lr_kliendid` are disabled by default and were enabled by hand
in the entity registry; re-adding the integration needs that again, or the
"Võrk" tiles show "Entity not found".

**Pergola via Tuya Local (since 2026-09-20).** The two motorised pergolas are
Tuya WiFi devices (protocol 3.5). Tuya's cloud only declares three datapoints
for them, so the built-in Tuya integration can offer nothing but a door
binary sensor: the roof control and both LED circuits are custom datapoints
that are reachable over the LAN only. They run on HACS custom repository
`make-all/tuya-local`, which is a *custom* repository, not in the HACS default
store.

That integration ships its device definitions inside its own folder and has no
user config directory (the PR that would have added one,
make-all/tuya-local#5141, was rejected), **and a tuya-local update deletes
anything extra in there.** The folder is also owned by root, because the
container runs as root, so the deploy runner cannot write into it and a
tracked file at that path breaks `git pull --ff-only` with "Permission
denied" (hit on 2026-09-20).

So the device definition is tracked at
`config/tuya_local_devices/nordin_eco_pergola.yaml` and copied into place from
inside the container by `shell_command.sync_tuya_local_devices`
(`config/packages/pergola.yaml`), which an automation runs on every Home
Assistant start. The copy lands too late for the config entries of that boot,
and a reload does not rescue them: 2026.9.2 bumped the entry version, the
migration failed on the missing file and left both entries in
`migration_error`, which only a restart clears (2026-09-25). So the automation
restarts HA once whenever the copy changed a file; the second boot finds the
file identical and does not restart again. Updating tuya-local therefore costs
one restart more than the one HACS asks for, and it happens by itself.

Device ids, local keys and LAN addresses are not in this repo; the local keys
live in `.storage` and the addresses in khe-meta's
`house/home-assistant-plan.md`.

**These units report no roof position, and that is settled.** Measured three
ways on 2026-09-20:

- Over the LAN, dp1 does not exist. A tinytuya `updatedps([1,14,24,101,102,110])`
  returns nothing and the following `status()` is unchanged, so tuya-local's
  `force` flag has nobody to ask.
- dp2 holds the last command only until the motor stops, then the device
  resets it to `stop` by itself, seen passively with no movement at all.
- In the cloud dp1 exists but is frozen at its pairing value. Driving the roof
  fully open and fully closed while polling the built-in Tuya integration's
  diagnostics showed `control` tracking live (stop -> open -> close, within
  15 s) while `status` never moved off `opened` - with the louvres physically
  shut the whole time. The cloud link is alive; the datapoint is not.

So the cover entities are command-only and sit at `unknown`, which is honest
rather than broken, and the built-in Tuya integration adds nothing that
tuya-local does not already have locally. Any state shown in Home Assistant
would have to be remembered on the HA side, and would be wrong whenever the
RF remote is used. If the manufacturer's rain sensor is ever fitted, re-check
dp24 (`switch_sensor`): it reads false and never moves today.

**Helpers start at their minimum, not at a sensible value.** An `input_number`
or `input_datetime` created in a package comes up at the bottom of its range
(the pergola evening brightness landed at 5 %, the off time at 00:00). `initial:`
is not the fix, because it overwrites whatever the household chose on every
restart. Set the value once through the API after first deploy instead.

**Editing a tuya-local device config renames its entities.** The unique id is
derived from the entity's type plus its name or class, so dropping
`class: awning` from the cover made tuya-local register brand new entities
(`cover.aed_pergola_parem`, area-prefixed because the old id was taken) and
left the originals behind as unavailable orphans, which also broke the group
that referenced them. After such an edit, delete the orphans from the entity
registry and rename the new entities back, or the dashboard quietly points at
nothing.

**The roof rain rule runs on Open-Meteo, not on met.no.** met.no reported
`partlycloudy` and 0.0 mm for six hours while it was raining on the terrace
(2026-09-20), because it is a grid forecast and a local shower fits between
the grid points. `config/packages/pergola.yaml` has a `rest:` sensor pair
(`sensor.sademed_praegu`, `sensor.sademed_kahe_tunniga`) reading Open-Meteo's
15 minute nowcast; the URL is a `resource_template` so the house coordinates
come from `zone.home` and stay out of this repo. Whether the nowcast catches
a shower this one missed is not proven yet.

**New devices drift the generated dashboard.** Home Assistant adds a section
for a newly discovered device to the stored Overview config by itself, so
`scripts/ha-dashboard.py` and the live dashboard diverge after every new
integration. That is what the generator is for; diff before assuming the
drift is someone's deliberate edit.

**A tile's colour is not a state indicator by itself.** A tile paints its
icon whenever the entity counts as active, and a select, a sensor or a water
heater in its normal mode (`on`) always does. So a coloured tile on such an
entity is coloured all day. Where colour has to mean "this is running",
the generator shows two tiles picked by a visibility condition, coloured and
`disabled` (`by_state`, `heater_month`). Red is kept for faults and for
things that should be zero and are not.

**Integrations without translations show raw option keys** (`working_week`,
`heating`, `twice`). The Estonian labels are template sensors in the device's
package, and the dashboard tile shows the label with a `more-info` tap action
on the select (`"entity": <select>`), so the picker is one tap away as before.

## The 3D house view (`house3d`)

The code lives in `house3d/` (engine `house3d.js` and its `scene/` modules,
card `house3d-card.js`, standalone `viewer.html`, vendored three.js). Deploy
replaces `www/house3d/` in HA's config volume with it, so HA serves it as
`/local/house3d/`, and a change arrives without a restart.

- **Cache:** `/local` and the phone app keep old files. Every change to the
  card or the engine bumps `HOUSE3D_VERSION` in `house3d-card.js` and the same
  `?v=` on the Lovelace resource (`scripts/ha-ws.py` with
  `lovelace/resources/update`). The engine loads its `scene/` modules with
  its own URL's query, so the card's `?v=` covers them too. The vendor
  directory is versioned (`vendor/three-<version>/`), so its URLs change with
  it.
- **Engine layout:** `house3d.js` is the core (renderer, camera and framing,
  the marker overlay, roof mode, taps, the frame loop, the layer registry) and
  builds no geometry. `scene/kit.js` makes each mount's colours, materials and
  geometry helpers, and `scene/layers/` holds one module per scene layer
  (ground, site, trees, gates, surroundings, pergola, building, car, camera
  view fans); `scene/sun.js` holds the sun's position and direction, pure
  functions loaded like the kit. A new scene layer is a module there plus its
  line in the engine's `LAYERS` list; the contract (`build(ctx)` and its
  hooks) is in the engine's header. Modules under `scene/` load nothing
  themselves, no `import` of any kind and no `export ... from`: they get
  three.js and the rest through `ctx`, because a module loaded by a static
  import would come without `?v=` and could stay stale in the cache. Their
  module scope holds constants only, since a module runs once per URL and a
  second card or a remount would share its state. The engine tests check the
  import rule, so `scripts/check.sh` enforces it (below).
- **One broken layer does not blank the view.** A layer module that fails to
  load, or whose build throws (say a model shape the deployed engine does not
  know yet), is left out and logged as `house3d: layer <id> failed`; the rest
  draws. A layer whose per-frame update, marker hook, tap test or API throws
  is logged once and switched off for good, so the frame loop keeps running.
  The kit and `sun.js` are required: if either fails to load, the card shows
  its load error.
- **Styles:** "Lihtne" (the neon wireframe, the default) and "Päris" (lit
  surfaces in the house's colours and diagonal boarding with anthracite
  trims and corners from photos, paving stones, the play area, bar and mesh
  fences, the sun in the sky, the real sun and shadows),
  chosen per browser in the Kihid sheet and kept in `localStorage` under
  `house3d-style`. Switching remounts the engine with the roof mode, camera
  and fog kept. The real style has no bloom; its shadow map is 2048 px, 1024
  below 720 px width, and the roof and the car cast only while fully shown,
  since the shadow pass ignores opacity. The shadow camera is fixed to the
  lot, so the map is rendered only when the sun moves, the roof fades, a
  layer that casts animates (the car and the gate; a layer says so with
  `shades`) or is switched, the style mounts or a resize replaces the map,
  never for a camera move.
- **The sun** in the real style comes from HA's own location
  (`hass.config.latitude`/`longitude`, read at runtime, never stored in the
  card config) and the model's `georef.x_axis_bearing_deg`, the plan's
  L-EST97 grid bearing. Sun azimuths are from true north; `sun.js` turns them
  to grid azimuths with the projection's convergence, 0.854 x (lon - 24)
  degrees. Without a location the real style uses a fixed afternoon sun. The
  sky follows the sun's altitude: day, dusk below 8 degrees, night below 0
  with the sun off. Through dusk a cool moon and sky light come up, so the
  walls, roofs and fences still read at night, and a room with a light on
  (any marker that warms its floor) glows: its floor and its windows take a
  warm emissive scaled by the light's level. Each pane is tagged at build
  with the room it looks into, and each room has its own glass; there are
  no real-time lights, and by day nothing changes. The standalone viewer
  gets the bearing in whole degrees only (`orientation` in `model.json`) and
  puts the sun over the middle of Estonia, never over the house.
- **Room chips:** with the roof off each house room (every room but the
  carport) shows one chip at its label: the room's temperature (a sensor's,
  else a climate unit's), then icons for motion now, lights on, open doors
  and the alarm, with a count past one; a quiet room shows its name alone,
  and below 720 px the name is dropped and a quiet room shows nothing. Its
  devices that are neither on nor in alert are counted in the chip; the
  others (and everything outdoors or in the carport) show as markers. A
  collision pass every frame keeps them apart, nearest first in each round:
  alerts (never hidden); then every chip as its first part alone, at its
  place or just above or below it, so a room's summary survives a crowd;
  then markers at full size; then each chip grown to full where there is
  room; then the markers that did not fit as 10 px dots. Whatever still
  does not fit hides.
  With the roof on, indoor markers hide unless in alert and there are no
  chips, as before.
- **Focus:** a tap on a chip or a room floor opens the room's sheet and moves
  the camera in on the room (at least 7 m across, from 50 degrees up), where
  all its devices show; closing the sheet, Escape or a tap on empty ground
  returns to the overview with the camera left where it is (Lähtesta vaade
  frames home). The standalone viewer keeps the plain selection
  (`setSelection`) for its rooms and feature markers.
- **Markers and taps:** markers are drawn over the canvas but take no
  pointer, so a drag that starts on one orbits and never scrolls the page; a
  tap (no drag past 6 px) tests the shown markers' and chips' rectangles
  first, nearest centre wins, then the rooms and the car. Markers and chips
  stay buttons, so Tab and Enter reach them, and a marker's accessible name
  carries its state. The overlay
  is projected after the camera's matrices are refreshed each frame, so it
  does not trail the view. While a finger is down the view follows it 1:1;
  on release it coasts from the last 80 ms of movement (capped at 4 rad/s,
  0.35 s decay, none under reduced motion); zoom keeps OrbitControls' own
  damping.
- **Framing:** the home view fits the house rooms (every room but a paved
  one, so not the carport) with the roofs' overhang, ground to roof top,
  with 12% of the view clear on each side at the card's aspect, from the
  street side, higher on a portrait screen. A resize (the HA card's own fit,
  a phone turned) frames it again until the user has moved the camera: a
  drag or pinch that changed it, or a wheel zoom, not a mere tap. A remount
  with a kept view counts as moved; Lähtesta vaade frames anew.
- **Kihid:** the card's layers button opens a sheet. Its first row, Stiil,
  picks the style; in the real style the Kellaaeg (quarter hours) and
  Kuupäev (days of this year) sliders scrub the sun, and Praegu returns to
  live, which moves on once a minute; the time is not stored. Below them the
  switches for the devices' markers and room chips (an alert always shows),
  the camera view fans, the trees, the car (off, an arrival parks it and the
  gate stays shut) and the neighbours and street; that choice is kept per browser in
  `localStorage` under `house3d-layers`. Escape closes any sheet, and so
  does a tap on empty canvas. Below 600 px of the card's own width (not the
  screen's) the bar moves to the bottom and a sheet opens just above it, so
  the bar's buttons stay in reach.
- **Leaving and coming back:** HA disconnects the card when the view is
  left; the card keeps its camera and roof mode on the element and the next
  mount starts from them. A new model starts from the home view.
- **Load failure:** the card imports the engine when it first renders and,
  if that fails, once more after 2 s; then it shows "Proovi uuesti". Each
  try adds `&r=<n>` to the engine's URL, which its `scene/` modules take
  too, since a failed module URL stays failed in the browser until a
  reload. Each failure is logged as `house3d: loading <engine URL> failed:`
  with the browser's own message, which often names only the engine; the
  file that actually failed shows in the network panel. The vendored
  three.js URLs carry no query, so when that file is a vendor one, a retry
  may meet the same failure and only a reload helps.
- **three.js updates** are manual, Renovate does not see the vendored copy:
  `scripts/house3d-vendor.sh <version>`, point the engine's imports at the new
  directory, bump the version, remove the old directory.
- **The model** (walls, rooms, trees, devices) is not in this repo. It is the
  `house3d:*` blocks of khe-meta's `house/house-model.md`;
  `scripts/ha-dashboard.py` reads it (`HOUSE3D_MODEL`, else the sibling
  khe-meta checkout) and writes everything but the showcase layer into the
  card config, which lives only in HA's `.storage`.
- **Placing devices and trees:** `scripts/house3d-place.py serve <model>`
  serves `place.html` on 127.0.0.1 with the private layer from memory. Pick a
  device or a tree, click or drag it into place on the plan, turn a camera
  with the Suund slider, size a tree with the Kõrgus and Võra sliders, then
  copy the changes, `{"devices": {...}, "trees": {...}}` with only the groups
  that changed; `pbpaste | scripts/house3d-place.py apply <model> -` rewrites
  those device lines in the private block (heights stay by type) and those
  tree lines in the geometry block's `site.trees`. Trees are geometry, so they
  show in the standalone viewer too and the privacy scan does not cover them.
  Commit the model in khe-meta and rerun `ha-dashboard.py`. HA serves
  `place.html` too, but without a model it shows nothing.
- **Privacy scan:** `scripts/house3d-build.py --scan <model> house3d/` with
  the real model before every commit that touches the directory, and before
  publishing anything built from the model. It fails on any device name, entity id,
  family room name or device coordinate, on the car's name, entity, path and
  outline points, on the surroundings' building and road vertices and on the
  georeference's origin. `tests/house3d/fixture-model.md` and the demo's
  `model.json` have a `devices` key by design, so scanning them takes
  `--allow-devices-key FILE` for each; `--allow-device-name ENTITY FILE`
  lets a test house device name that matches a real one, judged generic,
  stay in that file. The same script builds the standalone viewer from the shareable
  layers only, and with `--demo` the public demo on the test fixture
  (khe.ee/house3d/, published by khe-sites), which reads no model: the real
  dashboard from `dashboard_config.build()`, rewritten by
  `scripts/dashboard_demo.py` (every entity id to a demo or fixture entity,
  templated cards to sample text, charts to made-up series), drawn by
  `demo/cards.js` on a simulated hass, 3D first. Its bars and views start
  below `--host-h`, 0 here, where khe-sites puts the khe.ee site header. Every `demo/` file and the
  generated JSON are versioned by one hash (`__DEMO_VERSION__`), the card and
  engine by `HOUSE3D_VERSION`. The generator names the real house's devices,
  so `check.sh` scans the whole demo build and the test house with the real
  model when it is at hand.
- **Tests:** `scripts/house3d-test.sh` runs the model and build tests
  (`tests/house3d/test_house3d_model.py`), the engine tests in Node
  (`tests/house3d/engine.test.mjs`: every layer builds, the simple style
  matches `simple-snapshot.json`, failure isolation, the sun, the real
  style's materials and shadow flags, the scene import rule), the demo
  dashboard's tests (`tests/house3d/demo.test.mjs`: every card type, feature
  and icon drawn, every perform-action through the simulation, visibility
  conditions, no fixture name in `demo/`) and a syntax
  check of every engine module, all on a made-up house,
  `tests/house3d/fixture-model.md`. `scripts/check.sh` runs it, so CI and
  the workspace commit gate do too. A deliberate change to the simple
  style rewrites the snapshot with `UPDATE_SNAPSHOT=1 node --test
  tests/house3d/engine.test.mjs`.
- **The car** stands in the carport when it is home and drives in from the
  street the first time the view opens after it arrived; a tap on it replays
  the drive. The engine only draws a generic vehicle from data: the car's
  outline, lights and drive-in path are the optional `car` object of the
  model's private layer, so neither this repo nor the standalone viewer
  carries the car. Its `entity` is home when the state is `home` or `on`;
  `unavailable` and `unknown` keep the last known value, a missing entity is
  away, and only a change of home/away acts, so location updates do nothing.
  The drive plays once per arrival per browser: the arrival key (the entity's
  `arrived_at` attribute, else `last_changed`) is kept in `localStorage`
  under `house3d-car-seen:<entity>`. The entity is an arrival helper, a
  trigger-based template binary sensor fed by the Volvo integration's
  `device_tracker`, not the tracker itself: the tracker's `last_changed` also
  moves on every cloud outage and HA restart, which would replay the drive,
  while the helper restores its state and sets `arrived_at` only on a real
  arrival. Without an entity the car stays hidden; `ha-dashboard.py` fills a
  missing one from the house file's `car_entity`.
- **Gates** are `site.gates` in the geometry layer, drawn closed in the fence
  line; `kind` (`sliding`, `swing1`, `swing2`) is data. The gate the car's
  path crosses is the drive gate: on an arrival it opens first (1.2 s, the car
  waiting at the start), the car drives, and the gate closes once the car's
  tail is past its leaves' sweep. No motor and no HA entity, a view effect
  only; `parked`, `away` and reduced motion leave it closed. The validator
  makes the path start far enough out for the whole car to clear the closed
  gate.
- **Neighbours and the street** are the optional `house3d:surroundings` layer:
  the buildings around the lot as flat-topped boxes and the street's road
  area, from Maa- ja Ruumiamet's ETAK. Together they fix the house's
  location, so the layer is private like the devices: `ha-dashboard.py` puts
  it into the card config, the standalone viewer never gets it, and the scan
  covers it. `scripts/house3d-surroundings.py <model> <ETAK_EESTI_GPKG.gpkg>`
  writes it (`--write`; a dry run prints the checks) from the whole-Estonia
  GeoPackage, read offline so the service never learns the area. It stops
  unless ETAK's house footprint matches the model's walls within 1 m and a
  street runs along the lot's front. The licence (Maa- ja Ruumiamet open
  data, 01.01.2025) asks for the licensor, the dataset and its date, which
  the card shows top left, only for a layer whose source starts with `ETAK,`
  (the test fixture's made-up layer gets no credit line).

## HVAC integrations

The Komfovent and Daikin integration quirks (Modbus client rules, register
gotchas, the broken space-heating energy channel) name the units and their LAN
addresses, so they live in the private `khe-meta` repo under
`house/house-hvac.md`.
