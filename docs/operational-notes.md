# Operational notes

Per-integration quirks and measured behaviour of this Home Assistant
configuration. The container layer (trusted proxies, NPM, UFW, tunnel,
backup and restore) is in khe-homelab's
[operational notes](https://github.com/khelias/khe-homelab/blob/main/docs/operational-notes.md#home-assistant).

## Reloads, restarts and prices

**Every `template/reload` must be followed at once by
`POST /api/events/khe_price_refresh`.** Trigger-based template sensors do not
re-run on reload, so the whole price stack (`elektri_hinna_prognoos`, `_tase`,
`odavaim_aken_*`, and the Phase 6 shadow sensors in `heating_price.yaml`:
`kutte_soovitatav_nihe`, `kutte_soovitatav_muutus`, `boileri_soovitatav_siht`)
goes blank and the Kodu Elekter card renders `None. None`
until the hourly tick. A restart is safe, the packages have a `start` trigger;
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

**Waste reminder recipients are a registry label, not config.** `waste.yaml`
sends to every `device_tracker` labelled `prugi`, as
`notify.mobile_app_<tracker object id>`. A rebuilt HA needs the label set
again, or the reminder falls back to every phone; a phone re-added to the
companion app gets a new tracker, which needs the label moved to it.

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
afterwards. The fork has no releases, so the Marketplace (HACS until HA
2026.11) sees a new commit only after `marketplace/repository/refresh`
(WebSocket); download the update in the Marketplace after that.

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

## Dashboard cards (`cards`)

The repo's own Lovelace cards live under `cards/` (`cards/khe-cards.js` as the
single HA resource entry point loading zero-import modules under `cards/parts/`
with `?v=${KHE_CARDS_VERSION}` and retry):
`custom:khe-summary-card`, `custom:khe-price-card` and `custom:khe-tile-card`
([ADR-002](decisions/002-own-dashboard-cards.md)), and for A3
`custom:khe-chips-card`, `custom:khe-heading-card` and
`custom:khe-status-card`, with `style: a3` on the first three
([ADR-005](decisions/005-a3-glass-cards-history-sheet.md)), and for Energia
`custom:khe-month-card`, `custom:khe-days-card` and `custom:khe-split-card`
([ADR-008](decisions/008-a3-page-cards-read-statistics.md)), and for
Soojuspump `custom:khe-reading-card`
([ADR-011](decisions/011-a3-hourly-lines-and-a-written-setpoint.md)), which
Ventilatsioon uses too with any unit, a meter and three cells, beside a days
card with an overlay series and a ratio headline; a reading card's big value
opens its history sheet as its cells do, and a days card's headline opens
its series' sheet over 30 days, 90 days and 12 months
([ADR-013](decisions/013-days-cards-open-a-long-range-sheet.md)), and for
Pergola `custom:khe-forecast-card`, the weather entity's hourly forecast
read through `weather.get_forecasts`
([ADR-014](decisions/014-a3-reads-the-weather-forecast-through-get-forecasts.md)),
with the reading card's cells, and for Valve `custom:khe-motion-card`, the
house plan with the trail of the last 15 minutes and each room's hourly
motion, beside the reading card's cells alone (no big value) for the doors
and the panel, both on 24 hours of state history
([ADR-015](decisions/015-a3-page-cards-read-state-history.md)), and for
Kaamerad `custom:khe-cameras-card`, the cameras' stills from `camera_proxy`
([ADR-016](decisions/016-a3-cards-draw-camera-stills-from-camera-proxy.md)),
beside count cells (`n / total` with the missing ones named), and for Teler
`custom:khe-tv-card`, what is on now with the TV's controls, and
`custom:khe-usage-card`, today's watch time by app or today's sessions,
beside a days card whose series stacks the apps
([ADR-017](decisions/017-teler-cards-read-the-session-list-and-a-stacked-days-chart.md)). Kodu was drawn
with them on 2026-10-17 and went back to stock cards the next day; A3
uses them. Deploy replaces `www/khe-cards/` in HA's config volume, so HA
serves them as `/local/khe-cards/`, and a change arrives without a restart.

- **Resource:** `/local/khe-cards/khe-cards.js?v=N`, a module. Created once
  with `scripts/ha-ws.py '{"type": "lovelace/resources/create", "res_type":
  "module", "url": "/local/khe-cards/khe-cards.js?v=1"}'`, then moved with
  `lovelace/resources/update` and its `resource_id` (from
  `lovelace/resources`); the house has had it since 2026-10-17. Without it
  a view on these cards shows HA's "Custom element doesn't exist".
- **Cache:** every change to the module bumps `KHE_CARDS_VERSION` and the same
  `?v=` on the resource, as for the 3D card.
- **Colours** follow `hass.themes.darkMode`, the dark mode of the device or of
  the HA profile; there is no HA theme. A wall tablet gets the night look from
  its OS dark schedule.
- **Actions:** a card fires `hass-action` with the tile's `tap_action` and HA's
  `handleAction` runs it, confirmation dialogs included. A frontend change
  there would leave the tiles dead, so after each HA bump tap an A3 tile,
  a mode button and the light's slider and see HA act.
- **Language:** every card takes `language` in its config, `et` by default;
  the demo's English sets `en`. The words are in the module's two tables,
  never from the HA profile ([ADR-012](decisions/012-the-demo-is-the-houses-overview.md)),
  and the English expects the demo's English sensor words for the price
  level and the tomorrow line (`sensorWords('en')`).
- **Demo:** the demo mounts the same module on its simulated hass and runs
  each `hass-action` through its action runner; `?light` shows the light
  palette. It shows the house's Overview with A3, its recorder answering
  the cards' statistics and history (`demo/recorder.js`, ADR-012).

## A3, the Overview's first view

Since 2026-11-12 the first view of the Overview ("Ülevaade"), at Kodu's old
path `/lovelace/kodu`, generated by `scripts/dashboard/`
([ADR-005](decisions/005-a3-glass-cards-history-sheet.md),
[ADR-006](decisions/006-a3-front-page-live-hero.md),
[ADR-007](decisions/007-a3-in-the-overview.md)): the 3D house as
the hero, then glass cards over a gradient background, and a history sheet
behind every value and device. It replaced the Bubble Card trial of
[ADR-004](decisions/004-bubble-card-trial.md); Bubble Card is uninstalled.

- **Saving:** `ha-dashboard.py` saves `dashboard.overview()`:
  the A3 views (`kodu`, `energia`, `soojuspump`, `ventilatsioon`, `pergola`,
  `valve`, `kaamerad` and `teler`), then Süsteem, the settings and camera
  subviews, and the 3D view (`maja-3d`) last. The retired pre-A3 Kodu stock
  views live in git history; entity ids stay single-sourced in
  `scripts/dashboard/entities.py`, and the demo builds `overview()` too.
- **Undo:** revert the commit and run `ha-dashboard.py` for the Overview
  with Kodu and 3D first. The earlier separate dashboard (ADR-006) also needs
  `ha-dashboard.py --a3` from that reverted code and HA's frontend data
  `core.default_panel` set to `"kodu-katse"`, system-wide
  (`frontend/set_system_data`, admin only) and for the token's own user
  (`frontend/set_user_data`); both writes replace the whole `core` value, so
  read it, change the one field and write it back.
- **Background:** the view's `background` key, one CSS value that mixes
  three tints into `var(--primary-background-color)`, so it follows HA's
  light and dark. `light-dark()` does not: HA leaves `color-scheme` at
  `normal`, so it follows the browser's scheme, not HA's (measured on
  2026-11-12).
- **Layout** ([ADR-010](decisions/010-a3-landscape-hero-beside-the-cards.md)):
  the hero and the title are one section a column wide and two rows high,
  Elekter spans two rows, `max_columns` is 4. From 736 px (HA's screen
  condition) the title row sits over the hero, baseline to baseline with
  the section headings, and the chips under it; below that the whole chips
  card is under the hero. One column (the phone)
  stacks; two put Elekter beside the hero; three, a 1180 px tablet with
  HA's sidebar hidden or collapsed, put Elekter and Juhtimine beside it
  with Kliima under Juhtimine and scroll about 240 px at 820 px high; four,
  content at least 1440 px wide, fit without scrolling. With HA's sidebar
  open the same tablet gets two columns. From 1716 px
  ([ADR-018](decisions/018-a3-hero-covers-the-left-half-on-four-columns.md)),
  four columns with or without the sidebar, the hero covers the left half
  instead: its section two columns wide and three rows high, Elekter and
  Juhtimine beside it, Kliima two columns wide under them. The view holds
  both layouts, every card of each under the screen condition
  (`FOUR`, `BELOW_FOUR` in `scripts/dashboard/primitives.py`); HA drops a hidden card from
  the DOM and a section of hidden cards from the grid, so one canvas runs.
  From 1440 to 1715 px without the sidebar the view keeps ADR-010's four
  columns. From 1364 to 1439 px, three columns with or without the
  sidebar, the hero is two columns wide, Elekter beside it, Kliima two
  columns wide under it and Juhtimine beside Kliima (`THREE`,
  `NOT_THREE`, ADR-018 decision 4); other three-column screens, a 1440 px
  laptop with the sidebar open among them, keep ADR-010's. The demo, which has no sidebar, takes
  that layout from 1076 px and the left half from 1428 px
  (`dashboard_demo.SCREENS`).
- **The hero:** the 3D card's optional `height` (px) sets its height outside
  a panel view and its grid rows; with `stretch` too its grid rows are
  auto and it grows to the tallest section starting on its row, within the
  screen and never under the box its rows gave it (312 px for 300), found
  through HA's `.section` element in the view's `.content`. With
  `stretch: "beside"` (ADR-018) it grows to the lowest section right of it
  that starts at or below its top, so the left half reaches Kliima's
  bottom or the screen's; the height is floored so it cannot creep. With `height`
  a vertical swipe on the house scrolls the page, a horizontal drag turns
  the house and the mouse wheel scrolls instead of zooming. A hero is always Foto at its light tier with the live
  sun (ADR-019); it draws the surroundings with their ETAK credit (ADR-009), its layer
  switches are its own and are not stored, and its sheet has no style row.
  Without `height` the card is as before.
- **The sheet's data:** `recorder/statistics_during_period` for entities with
  long-term statistics (5-minute, hourly and daily means for 24 h, 7 and
  30 days; hourly and daily `change` for the Estfeed counters, which arrive
  with Estfeed's own delay), and `history/history_during_period` with the
  minimal response for the rest, including the heating water's temperature,
  which keeps no statistics. Empty statistics fall back to history. The
  recorder keeps 30 days. The price sheet shows the 48-hour forecast; it is
  not recorded, so it has no ranges.
- **The days sheet** ([ADR-013](decisions/013-days-cards-open-a-long-range-sheet.md)):
  a days card's headline opens the picked series (Energia's kWh or Eurod)
  as daily statistics for 30 and 90 days and `period: "month"` for 12
  months, counted in HA's calendar with today or this month the last slot.
  The last slot, a statistic's first day or month (the sheet reads one slot
  before the window to tell) and Estfeed's
  days past its cutoff are lighter and out of the numbers; the big value is
  the average per counted day or month. The series' `title` names the sheet
  and its `more` is the entity "Rohkem" opens, since an `estfeed:`
  statistic has no state. Long-term statistics are not purged, but they
  start in the summer of 2026 (the price in June, consumption and cost in
  July, the boiler and the recovered heat in August), so 12 months shows 4
  to 6 bars in 2026.
- **Limits:** the pergola roof is a group without position and its state
  is `unknown`, so its tiles show no state, no command shows pressed and a
  tap opens more-info, not a sheet.
  Section headings link into Kodu's views (Energia, Soojuspump, Süsteem),
  and the light's, ventilation's and TV's sheets into Pergola, Ventilatsioon
  and Teler.
- **HA bump check:** besides the actions above, open a value's sheet and
  switch it to 7 and 30 days, and a days card's headline to 12 months
  (the `month` period): the two WebSocket commands and the
  `background` handling (`hui-view-background.ts`) can change with the
  frontend. Open Energia too: its cards read the same statistics command.
  On Soojuspump tap the shift once up and once back and see the unit take
  each (one `number.set_value` per settled change).
  On a wide screen check that the hero still stretches beside Elekter: it
  reads `hui-sections-view`'s `.section` and `.content` and relies on
  `row_span`. From 1716 px check that it reaches past Elekter to Kliima's
  bottom or the screen's and that the page has one canvas
  (it relies on `hui-card` dropping a hidden card from the DOM and
  `hui-section` hiding a section of hidden cards, ADR-018). On Pergola compare the forecast's hours with a direct
  `weather.get_forecasts` call through `ha-ws.py` (`call_service` with
  `return_response`, ADR-014) and point an hour; a blank chart with the
  cells still drawn means the call or its response changed. On Valve
  compare a room's strip and last time and a door's "avati" with a direct
  `history/history_during_period` read through `ha-ws.py` (ADR-015); blank
  strips with the rooms still named mean its compressed rows changed. Tap a
  mode on Maja and close HA's dialog without a code: the tile hands HA a
  more-info, and HA's keypad is the frontend's. Open Kaamerad and stay past
  a token rotation (about five minutes): the stills refresh without a
  flash, the large one every 10 s in the network panel; blank stills with
  the names drawn mean `entity_picture` or `camera_proxy` changed (ADR-016).
  On Teler compare the now card's app and minutes with `sensor.teleri_app`
  and the last entry of `sensor.teleri_seansid`, today's total with the
  `_tana` counters and the sessions with the attribute; a blank note or
  "Täna pole veel vaadatud." while the TV is on means the package's session
  list or counters changed (ADR-017). Tap Lülita välja and cancel HA's
  confirmation.
- **Energia** ([ADR-008](decisions/008-a3-page-cards-read-statistics.md)):
  the month card reads `maja_sel_kuul`, `maja_eelmine_kuu`, `maja_tana` and
  `maja_eile` with their `kulu` and `hind` attributes; the days cards read
  daily statistics in HA's time zone (Estfeed consumption and cost, 31 days;
  `estfeed:estfeed_price` mean and max, 30 days), loading again each hour.
  Estfeed arrives hours late (about five on 2026-11-12): the end of its last
  hour with data is the cutoff, days past it are lighter and out of the
  numbers, and the month's pace counts to it. The split card's last month is
  the utility meters' `last_period` and the boiler's attribute named by the
  previous month in English (`October`), in January `Last December`
  (Daikin names the previous year's months so; seen on 2026-11-12); on the
  first two days of a month it is left out.
- **Soojuspump** ([ADR-011](decisions/011-a3-hourly-lines-and-a-written-setpoint.md)):
  the chips card's `status` line (ok only while the heating switch is on
  and both Daikin faults read `off`, the faults as chips under it), then two
  reading cards: the utility-room panel's and the boiler water's 48 hourly
  means (the line ends at the live state; the boiler's has the 45° floor),
  the leaving water and the pump's outdoor sensor as cells whose sheets fall
  back to history (neither keeps statistics), and the shift as a stepper that
  writes once its taps settle. Kodu's two boost tiles sit full width under
  Soe vesi. The days card shows `boiler_energy_today`'s daily `change` for
  16 days, today lighter and out of the average, with Täna, Sel kuul (its
  share of `maja_sel_kuul`) and last month as cells. Under Hinnajuhtimine sit
  the shadow heating plan tile (`kutte_soovitatav_nihe` with its `pohjus`
  attribute) and the opt-in DHW price control switch (`boileri_hinnajuhtimine`,
  showing `boileri_soovitatav_siht` and its `reziim`, and opening its hourly
  history). Kodu's 24-month boiler chart is not carried. The settings subview
  is still Kodu's, with the DHW price control and shadow-plan notification
  switches added under Hinnajuhtimine.

**DHW price control (`config/packages/heating_price.yaml`).** Opt-in behind
`input_boolean.boileri_hinnajuhtimine` (starts `off`). While `on`,
`Boiler: hinnajuhtimine` sets the tank target between 45 and 55 °C from
`sensor.boileri_soovitatav_siht` at each hour boundary (`:00`): 55 °C in the
day's cheapest 2 h window and in the cheapest daytime 2 h window (11:00-18:00,
when its mean is at most 3 c/kWh above the day's mean), 52 °C during the
household's draw windows (`pesuaeg`: daily 19:00-22:00 and weekends
08:00-12:00, never reduced to 45 °C), 45 °C on expensive peaks outside those
windows, and 52 °C otherwise (55 °C all day on flat days under 5 c/kWh spread).
It skips when the tank is `off` or in `performance` (Kiirsoojendus) or while
Daikin's weekly 60 °C anti-legionella cycle is active (`temperature >= 60`).
Turning the switch off, or losing `boileri_soovitatav_siht` for 15 minutes
while it is on, runs `Boiler: taasta 55 °C` to restore 55 °C. Space heating
stays shadow-only.
- **Ventilatsioon:** the status line on the unit's power switch, its fault
  and warning as red chips and `status_flow_down` as a neutral chip while on
  (ECO lowers the airflow on an ordinary sauna evening, so it is a state,
  not a fault); Kodu's mode tile with the mode by name and ECO; the room
  air's humidity as 48 hourly means with supply, extract and outdoor as
  cells; the unit's efficiency big with the filter as a meter (no change
  threshold is known, so one neutral colour) and recovery (the W sensor
  shown in kW), power and exchanger as cells. "Kas tasub end ära" draws 16
  days of `total_recovered_energy`'s daily `change` with
  `total_ahu_energy`'s in front, its headline the ratio of their complete-day
  sums (the unit's electricity includes the afterheater, which ECO keeps at
  zero). The schedule is not on the page: it runs only in auto mode, which
  is off; it stays on the settings subview, still Kodu's.
- **Pergola** ([ADR-014](decisions/014-a3-reads-the-weather-forecast-through-get-forecasts.md)):
  the status reads `sademed_praegu` as a number (`status.above`): above 0
  "Sajab" with a blue dot, at 0 "Kuiv". The roof's Ava, Stopp and Sulge are
  mode buttons with their own `tap_action` on the group, never pressed. The
  light's tile is Kodu's (`pergola_light_tile()`) with the Soe/Valge segment
  on `input_select.pergola_valguse_toon` (`modes_entity`) and "kustub 23:00"
  only while it is on and the light rule is on. The forecast card reads
  `weather.forecast_kodu`'s hourly forecast once an hour: 14 hours of
  precipitation bars against 1 mm (more scales them down), the temperature
  line, a mark under each hour whose condition the rain rule also closes the
  roof on, the total and the first dry stretch of two hours or more; its
  cells are the two rain sensors (mm, mean statistics) and the outdoor
  temperature. The two rules are wide tiles with a switch on their
  booleans and their automations' `last_triggered`, which HA sets only once
  the conditions pass, so it is the last close command or the last time the
  light came on; `input_datetime.pergola_vihmateade` is only the last
  notification and is not shown. The settings subview is still Kodu's.
- **Valve** ([ADR-015](decisions/015-a3-page-cards-read-state-history.md)):
  the status runs over both partitions (`status.map`): "Häire" or
  "Sisenemise viivitus" red, "Valvesse minek" or "Valves" blue, "Valvest
  maas" green, the smoke and the link as fault chips. Maja and Garaaž are
  wide tiles with Eemal, Kodus, Öö and Maas; any tap opens HA's more-info,
  whose keypad takes the code, which the house asks for arming too
  (`code_arm_required`), so the card never sees one. The doors are a
  cells-only reading card: "kinni" or "lahti", red while open and either
  partition armed, and "avati" from the last off-to-on in the card's own
  history. The motion card reads the nine PIRs' 24 hours: a PIR's
  `last_changed` is reset by every restart, so the last motion is the last
  off-to-on in the history, and several rooms fire in one minute when the
  panel's link returns, so the trail takes each room once by its last
  motion, at most five. It is drawn through the plan slice the generator
  cuts from the model (rooms, walls with their doors, each PIR's room),
  along the doors and the open passages; the garage has no opening and
  stands alone. A row's name is its room's name in the model when no other
  PIR shares the room, else the public name in `scripts/dashboard/entities.py`. Süsteem
  shows the smoke group, the battery with the mains supply, the link,
  tamper and the siren, and which events notify (`paradox.yaml`).
- **Kaamerad** ([ADR-016](decisions/016-a3-cards-draw-camera-stills-from-camera-proxy.md)):
  the status names one fault at a time: the NVR disk not `OK` (unavailable
  too), then the first substream `unavailable`, else "Kõik kaamerad ja NVR
  korras". The cameras card draws the substreams' stills, the house file's
  first camera large; a tap on it opens `kaamera-<slug>`, a thumbnail's
  makes it the large one. Every still is the NVR's 1920x1080 frame, a
  thumbnail's too: `camera_proxy`'s `width` changes nothing for these
  cameras. A camera whose state
  stays `idle` while its still fails shows "korras" in the status and
  "Kaamera ei vasta" on its still: the status reads only states. Salvestised
  opens the NVR app (`nvr_app_url`, absent without it). Süsteem: the NVR
  disk, how many substreams have a state and how many motion switches are
  on. Camera motion is not shown (it fires every half minute); the live
  views and the settings subview are still Kodu's.
- **Teler** ([ADR-017](decisions/017-teler-cards-read-the-session-list-and-a-stacked-days-chart.md)):
  the now card reads `media_player.google_tv_streamer`, `sensor.teleri_app`
  and today's `sensor.teleri_seansid`: on, the app in its `TV_APPS` colour
  with its running session's minutes (none on the home screen, which ends
  a session), Lülita välja, Pult and the profiles with the stock
  confirmations; off, "Teler on väljas" with today's last session and
  Lülita sisse (no confirmation); without a state only Pult. Täna sums the
  `_tana` counters (a counter last updated before midnight counts 0, as it
  resets only after it), lists the apps used 30 s or more, each opening its
  counter's sheet, beside `teler_sees_eile`. Täna ajas lists the sessions of
  a minute or more. Nädal stacks the `_vaadatud` daily change by app over
  seven days, today from the `_tana` counters; the headline is the seven
  days' total and the average of the six ended days. Before 2026-11-11 the
  week is mostly Muu: the household watched Telia TV, outside the five apps.

## The 3D house view (`house3d`)

The engine, its model format, validator and viewer build, the placement
page, the surroundings writer, the test houses and the demo house live in
[khe-house3d](https://github.com/khelias/khe-house3d), with its ADR-001 (why
it is its own engine, a house's look as model data) and its own tests; the
notes below on the engine describe it as this card runs it. Here are the card
`house3d/house3d-card.js` and a pinned copy of the engine at the same paths
(what `include` in `house3d-engine.json` lists), written by
`scripts/house3d-copy.sh <commit>` and listed there with their hashes; `check.sh`
fails when the copy differs, so it is never edited here ([estate
ADR-052](https://github.com/khelias/khe-architecture/blob/main/decisions/052-the-3d-house-engine-has-a-repo-of-its-own.md)).
A bump of the copy bumps `HOUSE3D_VERSION` and the resource's `?v=` with it. Deploy
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
  roof mode, taps, the frame loop, the layer registry) and builds no
  geometry. `scene/kit.js` makes each mount's colours, materials and
  geometry helpers, and `scene/layers/` holds one module per scene layer
  (ground, site, trees, gates, surroundings, pergola, building, interior,
  outdoor lights, car, future, camera view fans); `scene/sun.js` holds the
  sun's position and direction, pure functions loaded like the kit;
  `scene/overlay.js` is the marker and label overlay (markers, room labels
  and chips, their CSS, the collision pass and the hover and tap
  rectangles), loaded with the kit and the sun and built by the core with
  what it reads passed in (`createOverlay(deps)`). The
  interior layer is the lit styles' only and reads the building layer's
  room probe and wall cut (`inRoom`, `cutOf`) through its `api`
  (`ctx.layer('building')`), so it comes after
  it in `LAYERS` and builds nothing without it. A new scene layer is a module there plus its
  line in the engine's `LAYERS` list; the contract (`build(ctx)` and its
  hooks) is in the engine's header. Modules under `scene/` load nothing
  themselves, no `import` of any kind and no `export ... from`: they get
  three.js and the rest through `ctx`, because a module loaded by a static
  import would come without `?v=` and could stay stale in the cache. Their
  module scope holds constants only, since a module runs once per URL and a
  second card or a remount would share its state. The engine tests check the
  import rule, so `scripts/check.sh` enforces it (below).
- **Roofs and storeys:** a roof is a shed (an outline falling east or west
  along x, the house's own) or a hip, gable or flat roof made of wings,
  plan rects with one eave height and pitch whose surface is the highest
  wing (`scripts/house3d_model.py`'s docstring has the fields). The engine's
  roof heights are `(x, z) -> y` for every kind; `roofFaces()` clips each
  wing's faces to where it is highest, which the building layer draws as a
  slab and the winter layer snows on, and wall tops are sampled where they
  cross a ridge, hip or valley, so a gable end reaches its peak. A model may
  list `levels` (floor heights) with walls and rooms on a `level`: an upper
  storey's walls stand in the lift on their level, on a glass of their own,
  so they rise and fade with the roof while the ground floor's glass stays,
  and a ground-floor wall taller than the ceiling is cut at it. Upper rooms
  get no floor, label or chip and the interior layer leaves their walls out;
  PV lies on a shed roof or one face of a hip or gable roof, never on a flat
  one. khe-house3d's `fixture-twostorey.md` is the
  made-up house that exercises all of it, and its geometry baseline pins
  where the roof-reading layers stand on the main fixture.
- **A house's look:** the lit styles' finishes are the model's
  `geometry.look` ([khe-house3d ADR-001](https://github.com/khelias/khe-house3d/blob/main/docs/decisions/001-own-3d-engine.md) point 6, the
  fields in `scripts/house3d_model.py`'s docstring): surface colours and
  finishes by the kit's names, plain cladding or boards at 0, 45 or 90
  degrees, and the opening trims, corner boards and base strip each on or
  off. `createKit(THREE, style, look)` resolves it over a neutral default
  (light matt walls, no trims) and exposes `kit.REAL` and `kit.look`. Our
  house and the test house carry today's look in their own models;
  khe-house3d's look baseline pins every material of the test house in the
  real style, as its geometry baseline pins where things stand.
- **One broken layer does not blank the view.** A layer module that fails to
  load, or whose build throws (say a model shape the deployed engine does not
  know yet), is left out and logged as `house3d: layer <id> failed`; the rest
  draws. A layer whose per-frame update, marker hook, tap test or API throws
  is logged once and switched off for good, so the frame loop keeps running.
  The kit, `sun.js` and `overlay.js` are required: if any of them fails to
  load, the card shows its load error.
- **Styles:** "Lihtne" (the neon wireframe) and "Päris" (lit
  surfaces in the house's colours and diagonal boarding with anthracite
  trims and corners from photos, paving stones, the play area, bar and mesh
  fences, the sun in the sky, the real sun and shadows; interior walls'
  doors and frames white, exterior ones anthracite, a door with
  `"finish": "cladding"` on its opening in the walls' colour, a door with
  `glass` (a width, at `glass_c` along the wall, else its middle) a
  vertical glass strip down its leaf, a door with `hinge` (`a` or `b`, the
  wall end it hangs from) and `swing` (`[dx, dz]`, square to the wall)
  standing open by `open` degrees, flat against the wall by default, and a
  glass door under 1.2 m wide in one leaf, without the centre mullion; inside,
  an architectural model: oak planks along the plan's z and the wet rooms'
  wood-look tile on the floors, near-black section caps on the walls' cut
  tops, oak skirting and a soft shade on the floor along the walls, and the furniture shaped by
  its `kind`), and "Foto" (Päris with a photographed lawn, street and sky and
  leaf cards on the crowns and hedges, the deciduous crowns bare in winter, a
  light tier on a device with few cores or little memory; its textures are
  the engine's `house3d/assets/`, loaded after the first frame, so khe.ee/ha
  allows a `blob:` worker, WebAssembly and eval for their decoder), chosen per
  browser in the Kihid sheet and kept in `localStorage` under
  `house3d-style`; a browser with none gets Foto (ADR-019). Switching remounts the engine with the roof mode, camera
  and fog kept. The lit styles have no bloom; their shadow map is 2048 px, 1024
  below 720 px width, and the roof and the car cast only while fully shown,
  since the shadow pass ignores opacity. The shadow camera is fixed to the
  lot, so the map is rendered only when the sun moves, the roof fades, a
  layer that casts animates (the car and the gate; a layer says so with
  `shades`) or is switched, the style mounts or a resize replaces the map,
  never for a camera move.
- **Contact shadows** darken what stands close together in the lit styles
  (Foto's light tier excepted), from 720 px width with the roof fully off. They stay off in the hero
  (`heroMount` passes `ao: false`) and in the simple style. three's `GTAOPass`,
  vendored with its shaders, loads by dynamic `import()` the first time they
  are wanted; a failed load logs once and the plain draw goes on. The scene
  still draws straight to the canvas and the pass's result multiplies over it,
  because a composer's `OutputPass` would tone-map the sky and the sun's glow.
  Sprites and transparent objects stay out of the pass's normals, so glass and
  sheers leave no halo. The shadows fade over 0.3 s as the roof opens and
  closes, and the render loop runs only during that fade.
- **The sun** in the lit styles comes from HA's own location
  (`hass.config.latitude`/`longitude`, read at runtime, never stored in the
  card config) and the model's `georef.x_axis_bearing_deg`, the plan's
  L-EST97 grid bearing. Sun azimuths are from true north; `sun.js` turns them
  to grid azimuths with the projection's convergence, 0.854 x (lon - 24)
  degrees. Without a location the lit styles use a fixed afternoon sun. Its
  whole look per altitude is `realLight()` in `sun.js`, tuned by eye on
  renders of the real house on 12 November and 21 June (the round
  ADR-006 left open): a sky gradient from horizon to zenith, day above 8
  degrees, dusk to the horizon and night from 6 degrees under it; the same
  sky, half desaturated, as the environment the surfaces reflect (rebuilt
  only when its colours change); the sun at full strength from 3 degrees
  up and warm below about 22, since the beam's own angle already dims a low
  sun. By day a shadowless warm fill from the home view's side lifts the
  front, which the winter sun lights from behind, and the lot sits on a
  light base like an architectural model's. Below the horizon the same
  shadow-casting light is the moon, which
  is invented: it shines from the home view's side so the walls the camera
  sees read at night. The fog starts at the lot's farthest corner, so the
  lot is always clear, and the land beyond and the neighbours darken at
  night. A room glows while a
  light there is on or its motion sensor is on or went off less than 15
  minutes ago: its floor and its windows take a warm emissive scaled by the
  light's level, or 0.8 for motion. The card owns the 15 minutes (it sets
  `glow` on the motion marker, from the wall clock, never the time slider,
  and pushes the markers again once a minute while any glows); the engine
  lights a room from any marker's `glow`. After an HA restart every motion
  sensor's `last_changed` is the restart, so at night the whole house glows
  for up to 15 minutes; that is accepted. Each pane is tagged at build
  with the room it looks into, and each room has its own glass; there are
  no real-time lights, and by day nothing changes. The standalone viewer
  gets the bearing in whole degrees only (`orientation` in `model.json`) and
  puts the sun over the middle of Estonia, never over the house.
- **Outdoor lights:** `site.lights` in the geometry layer lists the
  luminaires on the building's lighting plan, `{ "pos": [x, y, z], "kind":
  "ceiling" | "wall", "face"?: [dx, dz] }`, `face` the outward direction a
  wall light needs. A luminaire is a fixed part of the building like a
  window, so it is shareable geometry (ADR-001's split) and reaches the
  standalone viewer. The `lights` layer draws each in the lit styles as a
  small anthracite fixture that glows warm whenever it is dark, with a halo
  and a pool of light on the ground (at 0.14 m, over the decks and the
  step), all scaled by the night; no real-time light, no shadow. It is a view
  effect of the dark, not the motion sensors: it follows no HA entity.
- **Winter:** the `winter` layer (Kihid: Talv), the lit styles' alone (the
  simple style has no night, so there it is not listed), holds the Christmas
  lights and the snow. The lights are `site.festive` in the geometry layer,
  shareable decoration like `site.lights`, every key optional: `icicles`
  `[{ "path": [[x, y, z], ...], "drop"?: 0.4, "ground"?: false }]` (a dark
  cable along the path with a strand every 0.18 m, the strands' lengths
  cycling through shares of `drop`, an LED every 7 cm down each, and the
  LEDs along the cable on a near-vertical segment) and `planters: true` (a
  string winding round every tall planter plant). `christmas_trees`
  `[{ "pos": [x, z], "height": 2, "base": 1.3 }]` are trees dressed indoors:
  a stand, six stacked cones, baubles, a gold star and an LED string wound up
  the outline, drawn with the ground, not the lift, each piece instanced
  across the trees. The garden's trees carry no lights.
  They glow whenever it is dark: each LED a bright point with a soft halo,
  and a warm wash fading down the wall behind a roof path, since the real
  style has no bloom. The building api finds that wall (`wallBehind`), and
  where none stands within a metre (an open porch or carport front) the
  wash is left out, as light in the air reads as a curtain. The glow is colour and size on additive materials,
  never opacity, since the roof mode fades the lift's opacity: a path rides
  the lift with the roof unless `ground` is true. The snow lies on every roof
  and the garage roof (in the lift), on the lawn and the land
  round the lot (blended in through the ground layer's `api.snow`), as a
  light dusting on the paving and decks, as a cap on the hedges and tree
  crowns and a white tip on the thujas. It is placed from the other layers'
  `api` (`site`: `hedges()`, `planters()`, `slabs()`; `trees`: `crowns()`,
  `attach()`) rather than copied constants, and the crowns' caps hang on the
  trees, so they hide with them. The season is a view default, not data:
  `seasonOn(date)` in `house3d.js` is true from 1 November to 31 March, and
  the card and the viewer show the layer on then and off outside it, by the
  day the time sliders show (today while live), so a July slider has no
  snow; the card re-checks once a minute so a wall tablet changes over on
  1 November. A switch the user flips is stored as `{ on, window }`
  (`seasonWindow(date)`, `2026-11` or `gap-2027`) and holds, whatever the
  sliders show, only for today's season window or gap, so the next season
  starts from its default. Falling
  snow (`options.snowfall`) animates in the full view and the viewer only,
  never in the hero or under reduced motion, since a moving layer keeps the
  render loop running.
- **Room chips:** with the roof off each house room (every room but the
  carport) shows one chip at its label: icons for open doors, smoke alarms
  going off and the alarm, motion now and lights on, with a count past one,
  then the room's temperature (a sensor's, else a climate unit's). Alerts
  come first, then what is on, so the compact chip shows the most urgent
  part. A quiet room shows its name alone, and below 720 px the name is
  dropped (the parts stay) and a quiet room shows nothing. Its devices that
  are neither on nor in alert, and the active ones its parts count (the
  chip's `ids`), are in the chip and not drawn beside it, so one sensor is
  one icon; an active device the chip does not count (a heating climate
  unit, a switch) and everything outdoors or in the carport show as markers.
  A collision pass every frame keeps them apart, nearest first in each round:
  alerts (never hidden; a chip in alert compact, grown later where there is
  room); then every chip as its first part alone, at its
  place or just above or below it, so a room's summary survives a crowd;
  then markers at full size; then each chip grown to full where there is
  room; then the markers that did not fit as 12 px dots, which still take a
  tap as a 40 px marker. Whatever still does not fit hides. Markers are 40 px
  translucent discs (a camera's a white rounded square) and chips 32 px, so
  a crowd folds into dots sooner than the 32 px markers did; they carry no
  backdrop blur, since they move every frame.
  With the roof on, indoor markers hide unless in alert and there are no
  chips, as before.
- **Focus:** a tap on a chip or a room floor opens the room's sheet and moves
  the camera in on the room (at least 7 m across, from 50 degrees up), where
  all its devices show; closing the sheet, Escape or a tap on empty ground
  returns to the overview with the camera left where it is (Lähtesta vaade
  frames home). The standalone viewer keeps the plain selection
  (`setSelection`) for its rooms and feature markers; the card uses it to
  ring an open camera's marker, and a room's focus replaces it.
- **Camera taps:** a camera's marker or sheet row opens the camera panel over
  the view, not more-info and not a page: its still (the substream the card
  config's `stills` names, ADR-016) fetched at once and every 10 s while the
  tab shows, with the time it loaded in HA's zone, and previous, next, full
  screen and close. The arrows walk the cameras round the house as seen from
  above: the next is the one to the right of a viewer looking out through
  the camera (clockwise), the previous the one to the left. An outdoor
  camera's marker is drawn 3 m ahead along its look, on its view fan (the marker's
  `at`; the fan stays at the camera's `pos`), so two cameras on one corner
  looking apart are two markers, and the collision pass never hides a
  camera: crowded, it stays a dot. Full screen opens the camera's own view
  (`kaamera-<slug>`, the config's `views`). One sheet or panel is open at a
  time; the roof switch leaves the panel open, a room or Kihid closes it, and
  a demo scene's remount reopens it. The demo has no stills, so it shows
  "Pilti pole".
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
- **Kihid:** the card's buttons sit in one frosted capsule (the roof switch,
  Lähtesta vaade and Kihid, 44 px each), and the sheets and the camera panel
  are frosted the same way; under reduced transparency they are opaque. The
  layers button opens a sheet. Its first row, Stiil,
  picks the style; in the lit styles the Kellaaeg (quarter hours) and
  Kuupäev (days of this year) sliders scrub the sun, and Praegu returns to
  live, which moves on once a minute; the time is not stored. Below them the
  switches for the devices' markers and room chips (an alert always shows),
  the camera view fans, the trees, the car (off, an arrival parks it and the
  gate stays shut), the neighbours and street, Tulevik (below, off until
  switched on) and Talv (on in its season, above); that choice is kept per browser in
  `localStorage` under `house3d-layers`, Talv's for its season window only. In the simple style a slider time
  kept from a lit style shows a Praegu button there too. Escape closes any sheet, and so
  does a tap on empty canvas. Below 600 px of the card's own width (not the
  screen's) the bar moves to the bottom and a sheet opens just above it, so
  the bar's buttons stay in reach. A hero keeps its buttons in its top right
  corner at every width: its sheet, Vaade, holds the roof switch and Lähtesta vaade
  above the time and the layers, and with `full_view` (a path; A3 gives the 3D
  view's) an expand button beside it, Ava 3D-vaade, navigates there. Not the
  browser's fullscreen: an iPhone grants that to a video only.
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
- **While it loads** the card shows a picture of the view, kept in
  `localStorage` per hero or full view and style (`house3d-poster:*`, a JPEG
  of the scene without the markers, from the engine's `snapshot()`), and
  fades it out at the first live frame; a first visit shows a slow wave.
  The picture is taken once per page load, when a fresh mount (home view,
  live time, no demo scene) first settles, in Foto after the engine's
  `onLook()` says its textures are in (ADR-019), since the next load starts from
  that view; a remount swaps the canvas in place without it. The engine and three.js take a few seconds
  over a phone connection on a first visit or after a version bump.
- **three.js updates** are manual, Renovate does not see the vendored copy:
  in khe-house3d, `scripts/house3d-vendor.sh <version>`, point the engine's
  imports at the new directory, remove the old one; then bump the copy here.
- **The model** (walls, rooms, trees, devices) is not in this repo. It is the
  `house3d:*` blocks of khe-meta's `house/house-model.md`;
  `scripts/ha-dashboard.py` reads it (`HOUSE3D_MODEL`, else the sibling
  khe-meta checkout) and writes everything but the showcase layer into the
  card config, which lives only in HA's `.storage`.
- **Furniture** is `furniture` in the geometry layer: each item a `rect`
  `[x0, z0, x1, z1]` or a `circle` `[x, z, r]`, its `y` `[y0, y1]` and an
  optional `kind`, one of `FURNITURE_KINDS` in `scripts/house3d_model.py`
  (bed, headboard, wardrobe, sofa, table, desk, counter, cabinet, bath,
  bench, appliance, base_units, wall_units, tall_units, hood, shelf,
  splashback, tv, rug, curtain, toilet, vanity, mirror, washer, stove,
  bookcase, chair, office_chair, plant, picture). `base_units`, `wall_units`, `tall_units` and `vanity` also need
  `along`, `"x"` or `"z"`, and `fronts`, a list of `[type, width]` from that
  axis's low end (types `door`, `drawers`, `oven`, `glass`, `blank`) whose
  widths sum to the item's size on `along` within 1 cm; no other kind takes
  either field. A `vanity` also needs `basins`, 1 or 2, evenly along its
  porcelain top; a basin with no cabinet is a vanity with one `blank` front.
  Those four kinds, `bookcase`, `table`, `desk` and `chair` may take a
  `finish`: `kitchen` (the default: blue-grey fronts under a brown worktop),
  `anthracite` (with steel handles), `white`, `dark_oak` or `medium_oak`,
  which colours the carcass, the fronts, a worktop and the oak alike (a
  table, desk or chair takes only the two oaks); no
  other kind takes `basins` or `finish`. A `stove` (a sauna heater), a
  `plant` and a `picture` need a rect, and a `mirror` and a `picture` a `y0`
  above 0. A `sofa` may name the rect's edges that carry a `back` and an
  `arm` (`x0`, `x1`, `z0`, `z1`), so two items join into a corner sofa, and a
  `chair` (a black shell on wooden legs with a steel cross) or an
  `office_chair` its one `back` edge. A `plant` is a pot and a rounded crown,
  with `bloom: true` a vase of flowers; a `picture` is a framed canvas in
  one of three palettes, its `art` 0 (the default) to 2. The lit styles draw an item by its kind inside its footprint
  and heights (a table's or desk's legs alone reach down to the floor),
  turning it to the nearest wall face and a bed's head to its headboard; a
  toilet's head and a washer's back go on whichever edge of the rect is
  nearest a wall, a vanity's taps reach its `y1`, and a stack of drawers has
  one drawer per about 25 cm, three at most. An item without a kind is a
  plain warm grey block. The simple style draws every item as its outlined
  see-through box, kind or not. The validator rejects any other kind.
- **The future (Tulevik):** the optional `future` block of the private layer
  holds things the house does not have yet: rooftop PV, an EV charger, a home
  battery, a greenhouse and a hot tub (`kind`), each with a centre `pos`, a
  quarter-turn `rot`, a `size` where the kind has one and up to six `facts`
  lines written by hand from khe-meta's PV assessment, dated by `as_of`. The
  `future` layer draws them see-through in one violet tint, casting no
  shadow: the PV panels (1.72 x 1.13 m, the orientation that fits more) on
  their roof's slab 5 cm up, in the lift, so they rise and fade with the
  roof; the rest on the ground. A tap on one opens its sheet ("Plaan ·
  hinnang <date>", the facts or "Numbreid pole veel lisatud."); the raised
  panels take no tap, and an item standing in a house room takes one with
  the roof off only, as the floors do. For PV the sheet adds a clear-sky
  estimate at the sun's time (`pvNow()`: Meinel's beam irradiance, a tenth
  more diffuse, 0.86 of it per kWp on the panel's tilt, never over 0.8 kW per
  kWp as the assessment found at this slope), following the minute tick and
  the sliders, and left out without a location. It is a ceiling, not a
  forecast: no clouds, no shading. The sun is computed in every style for
  it (`onSun`, the view's `sun`). The standalone viewer never gets the
  layer; the scan covers the items' positions.
- **Placing devices, trees and future items:** khe-house3d's `scripts/house3d-place.py serve <model>`
  serves `place.html` on 127.0.0.1 with the private layer from memory. Pick a
  device, a tree or a future item, click or drag it into place on the plan, turn a camera
  with the Suund slider, size a tree with the Kõrgus and Võra sliders, turn a
  future item with the Pööre buttons (its size and numbers stay hand edits), then
  copy the changes, `{"devices": {...}, "trees": {...}, "future": {...}}` with only the groups
  that changed; `pbpaste | scripts/house3d-place.py apply <model> -` (there too) rewrites
  those device lines in the private block (heights stay by type), those
  tree lines in the geometry block's `site.trees` and those item lines in
  the private block's future `items`, refusing a pv item moved off its roof. Trees are geometry, so they
  show in the standalone viewer too and the privacy scan does not cover them.
  Commit the model in khe-meta and rerun `ha-dashboard.py`. HA serves
  `place.html` too, but without a model it shows nothing.
- **Privacy scan:** `scripts/house3d-build.py --scan <model> house3d/` with
  the real model before every commit that touches the directory, and before
  publishing anything built from the model. It fails on any device name, entity id,
  family room name or device coordinate, on the car's name, entity, path and
  outline points, on the surroundings' building and road vertices, on the
  future items' positions (pairs with a decimal) and on the georeference's
  origin. `tests/house3d/fixture-model.md`, `tests/house3d/fixture-demo.md` and the demo's
  `model.json` have a `devices` key by design, so scanning them takes
  `--allow-devices-key FILE` for each; `--allow-device-name ENTITY FILE`
  lets a test house device name that matches a real one, judged generic,
  stay in that file. The same script builds the standalone viewer from the shareable
  layers only, and with `--demo` the public demo on the demo house
  (khe.ee/ha/, published by khe-sites), which reads no model: the house's
  Overview from `dashboard.overview()`, rewritten by
  `scripts/dashboard_demo.py` (every entity id to a demo or fixture entity,
  templated cards to sample text, charts to made-up series), drawn by
  `demo/cards.js` on a simulated hass, A3 first and 3D last as in the house
  ([ADR-012](decisions/012-the-demo-is-the-houses-overview.md)). The A3 cards
  read a simulated recorder: `recorder.json` holds a profile per statistic
  and `demo/recorder.js` answers statistics and history from it relative to
  the moment asked, in Europe/Tallinn, and computes at load the states that
  follow the date (today's and the month's use and cost, last month, the
  prices and the level), so a month total equals its days. The renderer
  imitates what A3 uses of HA's sections view: `row_span`, the `screen`
  condition, a hidden card leaving the DOM and a section of hidden cards
  leaving the grid (ADR-018), the view background, `.content`/`.section` and window
  scrolling for the hero's stretch; a link to a page the demo lacks
  (`/energy`) shows a note. With `?lang=en` it is in
  English ([ADR-003](decisions/003-demo-in-english.md)): `demo.js` loads the
  `*.en.json` files, which `dashboard_demo.demo_config_en` and its siblings
  make from the Estonian ones through `scripts/dashboard_demo_en.py`,
  `demo/strings.js` holds the page's own strings in both languages, and the
  3D card and the house's own cards turn English with `language: en` in their
  config (only the demo sets it). khe.ee's header keeps `?lang` current and
  reloads the page on a switch.
  Its bars and views start below `--host-h`, 0 here, where khe-sites puts the
  khe.ee site header. Every `demo/` file and the
  generated JSON are versioned by one hash (`__DEMO_VERSION__`), the card and
  engine by `HOUSE3D_VERSION`. The toolbar's scenarios (`scenarios.json` from
  `scripts/dashboard_scenarios.py`, played by `demo/scenario.js`) reset the
  simulated hass to their start and apply their steps on time; one told in
  the 3D house plays on A3, whose hero shows Foto at a
  fixed November instant through the card's
  `setScene()`, which stores nothing, and `clearScene()` returns to the
  visitor's own style and live time. The generator names the real house's devices,
  so `check.sh` scans the whole demo build, the demo house and the test house with the real
  model when it is at hand.
- **Tests:** the engine's own (model, build, placement, every layer, the
  simple snapshot, the geometry and look baselines) are khe-house3d's.
  Here `scripts/house3d-test.sh` runs the demo build's tests
  (`tests/house3d/test_house3d_demo.py`), the card's
  (`tests/house3d/engine-card.test.mjs`, over the copy's
  `engine-harness.mjs`), the demo
  dashboard's tests (`tests/house3d/demo.test.mjs`: every card type, feature
  and icon drawn, every perform-action through the simulation, visibility
  conditions, no fixture name in `demo/`), the demo recorder's tests
  (`tests/house3d/recorder.test.mjs`: the house's response shapes, counters
  equal to their days, the zone's days, the prices), the scenario player's tests
  (`tests/house3d/scenario.test.mjs`: every built scenario plays to its end in
  both languages, the scene times' sun) and a syntax
  check of every card, demo and test module, on made-up houses: the demo's
  on `tests/house3d/fixture-demo.md`, the card's on `tests/house3d/fixture-model.md`. `scripts/check.sh` runs it and
  `house3d-copy.sh --check`, so CI and the workspace commit gate do too.
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
  covers it. khe-house3d's `scripts/house3d-surroundings.py <model> <ETAK_EESTI_GPKG.gpkg>`
  writes it (`--write`; a dry run prints the checks) from the whole-Estonia
  GeoPackage, read offline so the service never learns the area. It stops
  unless ETAK's house footprint matches the model's walls within 1 m and a
  street runs along the lot's front. The licence (Maa- ja Ruumiamet open
  data, 01.01.2025) asks for the licensor, the dataset and its date, which
  the card shows from an info button top left, only for a layer whose source
  starts with `ETAK,` (the test fixture's made-up layer gets no credit
  line), a hero included.

## HVAC integrations

The Komfovent and Daikin integration quirks (Modbus client rules, register
gotchas, the broken space-heating energy channel) name the units and their LAN
addresses, so they live in the private `khe-meta` repo under
`house/house-hvac.md`.
