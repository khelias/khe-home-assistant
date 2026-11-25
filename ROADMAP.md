# Roadmap

Direction and priorities for the house automation, beyond current state.

## Near-term (next few sessions)

- **House automation** — the active work since 2026-09-08 and the only area
  with its own plan: phases, dashboard and the energy work are in the private
  `khe-meta` repo under `house/`. Space heating and ventilation are
  read-only today; the pergola package acts (rain closes the roof,
  evening light), and Phase 6 runs shadow-mode heating recommendations with
  opt-in DHW price control behind a toggle (`heating_price.yaml`, 45-55 °C,
  documented in khe-homelab's `SECURITY.md`). The next step that changes
  space heating is moving the heating-curve offset from shadow mode to writes.

## Ambitions

Directions that take several seasons, not sessions. None is committed; each
has a first step that is worth doing on its own and says what it waits for.
The section above comes first.

- **A house that runs itself.** A thermal model of the house fitted to the
  measurements Home Assistant already records, and predictive control that
  schedules the heat pump and ventilation against the weather forecast and
  the next day's electricity price, with a saving that can be stated per
  heating season. It is the long form of phase 6 above.
  - *Why here:* the inputs are already in the stack: a weather forecast
    entity, the day-ahead price sensors in `energy_price.yaml` and the house
    energy readings. Devices, measurements and the model's inputs are
    documented in the private house documentation in `khe-meta`, not here.
  - *First step:* check that every series the model needs survives long
    enough. The recorder keeps raw history for 30 days, so anything older
    exists only as HA long-term statistics, and only for entities that
    carry a `state_class`. Then fit a simple model offline and compare its
    prediction with a week it has not seen.
  - *Waits for:* phase 6 working in its rule-based form, and one full
    heating season under the current schedule as the baseline. Without a
    weather-normalised baseline there is no saving to claim.
  - *Risk and cost:* the first write access the homelab host gets to
    heating. Control has to fail back to the devices' own schedules when HA
    or the VM is down, a manual override has to win over the optimiser, and
    the security model in khe-homelab's `SECURITY.md` and README changes in
    the same commit. Comfort and compressor cycling are real costs; the
    saving is unverified until the baseline exists, and may not repay the
    weekends.
