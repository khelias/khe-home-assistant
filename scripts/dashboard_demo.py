"""The public demo's dashboard: the house's own Overview on made-up data (ADR-012).

demo_config(model) runs dashboard_a3.overview() with made-up inputs, so the demo opens on A3 and
shows 3D last as the house does, and rewrites the copy it gets back: every entity id to a demo id
(CATALOGUE), every statistic id to a demo one, the labels that name the house's own devices
(LABELS), every templated markdown card to sample text (TEXTS), and every apexcharts
data_generator away; the charts take series() instead. An id the catalogue does not know fails
the build, so a new entity in the generator needs an entry here. house3d-build.py --demo writes
the result, demo_states(), demo_series() and demo_recorder(), the profiles the demo's recorder
answers history from, next to the demo. demo_config_en() and its siblings are the same demo in
English (ADR-003, ADR-012): they walk the Estonian output and look every visible string and state
word up in dashboard_demo_en, and one it lacks fails the build as an uncatalogued id does; the
house's own cards get `language: en` and draw their own words.

Stdlib only and no I/O: khe-sites runs the demo build in CI without a venv or khe-meta. The real
ids that name the house's own devices are spelled once, in dashboard_config, and taken from
there, so the privacy scan (check.sh) passes over this file.
"""

import copy
import math
import re

import dashboard_a3 as a3
import dashboard_config as dc
import dashboard_demo_en as en

ID = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
STAT = re.compile(r"^[a-z_]+:[a-z0-9_]+$")
OUTDOOR_ROOM = "oues"

# generator label -> demo label, replaced inside every string of the demo config
LABELS = {
    dc.DOORS[0][1]: "Välisuks",
    dc.DOORS[1][1]: "Terrassi uks",
    dc.DOORS[2][1]: "Tagauks",
    dc.NET[0][1]: "Lüüs",
    dc.SMOKE_GROUP: "Suitsuandur",
    dict(dc.BASE_UPDATES)["update.komfovent_update"]: "Ventilatsiooniseade",
    dc.ROOF_NAME: "Terrassi katus",
    # the motion rows the test house has no room for keep the demo's own names
    dc.MOTION_ROOMS[dc.PRIVATE[1]]: "Tuba 1",
    dc.MOTION_ROOMS[dc.PRIVATE[2]]: "Tuba 2",
    dc.MOTION_ROOMS[dc.PRIVATE[3]]: "Töötuba",
}


# the inputs build() gets: the fixture's two cameras, a made-up family, no NVR app
DEMO_HOUSE = {
    "cams": [["test_drive", "Väravakaamera"], ["test_garden", "Aiakaamera"]],
    "phone": "sensor.demo_telefon",
    "tv_profiles": [[1, "Põhiprofiil"], [2, "Lapsed"]],
}
DEMO_PEOPLE = [["person.demo_mari", "Mari on"], ["person.demo_jaan", "Jaan on"]]

TEMP = {"unit_of_measurement": "°C", "device_class": "temperature"}
KWH = {"unit_of_measurement": "kWh", "device_class": "energy"}
PCT = {"unit_of_measurement": "%"}
PRICE = {"unit_of_measurement": "€/kWh", "device_class": "monetary"}
HOURS = {"unit_of_measurement": "h", "device_class": "duration", "state_class": "total_increasing"}
VENT_MODES = [
    "normal",
    "kitchen",
    "boost",
    "away",
    "fireplace",
    "intensive",
    "override",
    "holidays",
]
# the house's two tones (dashboard_a3.TONES), which the demo's light selects offer too
TONES = a3.TONES

CATALOGUE = {}


def entry(real, demo, state, name, **attrs):
    CATALOGUE[real] = {"id": demo, "state": state, "attributes": {"friendly_name": name, **attrs}}


def binary(real, demo, state, name, device_class):
    entry(real, demo, state, name, device_class=device_class)


# the alarm, its doors and motion: the first partition, two doors and two PIRs are the fixture's
entry(dc.ALARMS[0][0], "alarm_control_panel.test_alarm", "disarmed", "Valvesüsteem")
entry(dc.ALARMS[1][0], "alarm_control_panel.demo_garage", "armed_away", "Garaaž")
binary(dc.DOORS[0][0], "binary_sensor.test_front_door", "off", "Välisuks", "door")
binary(dc.DOORS[1][0], "binary_sensor.test_terrace_door", "off", "Terrassi uks", "door")
binary(dc.DOORS[2][0], "binary_sensor.demo_back_door", "off", "Tagauks", "door")
# minutes since each door last closed; the back door has not opened in a day
for (real, _), ago in zip(dc.DOORS, [47, 190, 1600], strict=True):
    CATALOGUE[real]["ago"] = ago
# five of them are the test house's own, so the 3D view and the motion list agree; two are on,
# so the 3D view shows motion now
MOTION = [
    ("binary_sensor.test_kitchen_motion", "Köök", 25, "off"),
    ("binary_sensor.test_living_motion", "Elutuba", 1, "on"),
    ("binary_sensor.test_hall_motion", "Eeskoda", 0, "on"),
    ("binary_sensor.test_carport_motion", "Varjualune", 95, "off"),
    ("binary_sensor.test_bath_motion", "Vannituba", 300, "off"),
    ("binary_sensor.test_bedroom_motion", "Magamistuba", 540, "off"),
    ("binary_sensor.demo_room_a_motion", "Tuba 1", 180, "off"),
    ("binary_sensor.demo_room_b_motion", "Tuba 2", 230, "off"),
    ("binary_sensor.demo_office_motion", "Töötuba", 60, "off"),
]
assert len(MOTION) == len(dc.SHARED + dc.PRIVATE)
for real, (demo, name, ago, state) in zip(dc.SHARED + dc.PRIVATE, MOTION, strict=True):
    entry(real, demo, state, name, device_class="motion")
    CATALOGUE[real]["ago"] = ago
binary(dc.SMOKE, "binary_sensor.demo_smoke_group", "off", "Suitsuandur", "smoke")
binary(dc.SIREN, "binary_sensor.demo_siren", "off", "Sireen", "sound")
binary(dc.TAMPER, "binary_sensor.demo_tamper", "off", "Rikkumine", "tamper")
binary(dc.VALVE_LINK, "binary_sensor.demo_alarm_link", "on", "Ühendus", "connectivity")
entry(
    dc.VALVE_BATTERY,
    "sensor.demo_alarm_battery",
    "13.6",
    "Aku",
    unit_of_measurement="V",
    device_class="voltage",
)
entry(
    dc.VALVE_SUPPLY,
    "sensor.demo_alarm_supply",
    "13.1",
    "Toide",
    unit_of_measurement="V",
    device_class="voltage",
)
entry(dc.VALVE_LINK_RAW, "sensor.demo_alarm_link_state", "online", "Ühendus")

# faults and data flags
binary(
    "binary_sensor.hot_water_tank_state",
    "binary_sensor.demo_boiler_fault",
    "off",
    "Boileri viga",
    "problem",
)
binary(
    "binary_sensor.space_heating_unit_state",
    "binary_sensor.demo_heat_pump_fault",
    "off",
    "Soojuspumba viga",
    "problem",
)
binary(
    "binary_sensor.komfovent_status_alarm_fault",
    "binary_sensor.demo_vent_fault",
    "off",
    "Ventilatsiooni viga",
    "problem",
)
binary(
    "binary_sensor.komfovent_status_alarm_warning",
    "binary_sensor.demo_vent_warning",
    "off",
    "Ventilatsiooni hoiatus",
    "problem",
)
binary(
    "binary_sensor.komfovent_status_flow_down",
    "binary_sensor.demo_vent_flow_down",
    "off",
    "Õhuvool alandatud",
    "problem",
)
binary(
    "binary_sensor.maja_andmed_varsked",
    "binary_sensor.demo_meter_fresh",
    "on",
    "Arvesti andmed värsked",
    "connectivity",
)
entry(
    "binary_sensor.nord_pool_ee_homne_hind_on_saadaval",
    "binary_sensor.demo_tomorrow_price",
    "on",
    "Homne hind olemas",
)

# cameras: the grid's substream is the same camera in the demo
for slug, name in DEMO_HOUSE["cams"]:
    word = slug.removeprefix("test_")
    entry(f"camera.{slug}", f"camera.{slug}", "idle", name)
    entry(f"camera.{slug}_alamvoog", f"camera.{slug}", "idle", name)
    binary(
        f"binary_sensor.{slug}_liikumine",
        f"binary_sensor.demo_{word}_motion",
        "off",
        f"{name} liikumine",
        "motion",
    )
    entry(
        f"switch.{slug}_liikumistuvastus",
        f"switch.demo_{word}_detect",
        "on",
        f"{name} liikumistuvastus",
    )

# pergola: the roof group and its light are the fixture's
entry(dc.ROOF, "cover.test_pergola", "closed", "Lamellkatus", device_class="awning")
entry(
    "cover.pergola_parem", "cover.demo_roof_right", "closed", "Katus parem", device_class="awning"
)
entry("cover.pergola_vasak", "cover.demo_roof_left", "closed", "Katus vasak", device_class="awning")
entry(dc.PERGOLA_LIGHT, "light.test_pergola", "off", "Pergola valgus")
entry("light.pergola_parem_valgustus", "light.demo_light_right", "off", "Valgus parem")
entry("light.pergola_vasak_valgustus", "light.demo_light_left", "off", "Valgus vasak")
entry(
    dc.TONE,
    "input_select.demo_light_tone",
    TONES[0],
    "Toon",
    options=TONES,
)
entry(
    "input_select.pergola_ohtune_toon",
    "input_select.demo_evening_tone",
    TONES[0],
    "Õhtune toon",
    options=TONES,
)
entry(
    "select.pergola_parem_valguse_toon",
    "select.demo_tone_right",
    TONES[0],
    "Toon parem",
    options=TONES,
)
entry(
    "select.pergola_vasak_valguse_toon",
    "select.demo_tone_left",
    TONES[0],
    "Toon vasak",
    options=TONES,
)
entry(
    dc.ROOF_AUTO,
    "input_boolean.demo_roof_auto",
    "on",
    "Katuse automaatika",
)
entry(
    dc.LIGHT_AUTO,
    "input_boolean.demo_light_auto",
    "on",
    "Valguse automaatika",
)
entry(
    "input_boolean.pergola_vihma_teavitus", "input_boolean.demo_rain_notify", "on", "Vihmateavitus"
)
entry(
    "input_boolean.pergola_valgus_ainult_kodus",
    "input_boolean.demo_light_home_only",
    "off",
    "Ainult kui kodus",
)
entry(
    "input_number.pergola_teavituse_vaikus",
    "input_number.demo_notify_quiet",
    "60",
    "Vaikus",
    min=0,
    max=240,
    step=15,
    unit_of_measurement="min",
)
entry(
    "input_number.pergola_valgus_nihe",
    "input_number.demo_light_offset",
    "30",
    "Enne loojangut",
    min=-60,
    max=120,
    step=10,
    unit_of_measurement="min",
)
entry(
    "input_number.pergola_valguse_heledus",
    "input_number.demo_light_level",
    "70",
    "Heledus",
    min=10,
    max=100,
    step=10,
    unit_of_measurement="%",
)
entry(
    dc.LIGHT_OFF,
    "input_datetime.demo_light_off",
    "23:00:00",
    "Kustub",
    has_date=False,
    has_time=True,
)
entry(
    "input_datetime.pergola_vihmateade",
    "input_datetime.demo_rain_notice",
    "2026-10-14 16:20:00",
    "Viimane teade",
    has_date=True,
    has_time=True,
)
# the rain sensors as the house has them, mm with mean statistics; their states, the forecast's
# and the rules' last runs follow the recorder's profiles (demo_recorder())
entry(
    dc.RAIN_NOW,
    "sensor.demo_rain_now",
    "0.0",
    "Sajab",
    unit_of_measurement="mm",
    device_class="precipitation",
    state_class="measurement",
)
entry(
    dc.RAIN_2H,
    "sensor.demo_rain_2h",
    "0.0",
    "Sademed kahe tunniga",
    unit_of_measurement="mm",
    device_class="precipitation",
    state_class="measurement",
)
entry(
    dc.WEATHER,
    "weather.demo_forecast",
    "cloudy",
    "Ilm",
    temperature=7,
    temperature_unit="°C",
)
# the two rules, named by their aliases: the scenario player finds a step's rule by it
entry(dc.RAIN_RULE, "automation.demo_rain_closes_roof", "on", "Pergola: vihm sulgeb katuse")
entry(dc.SUNSET_RULE, "automation.demo_lights_at_sunset", "on", "Pergola: valgustus loojangul")

# heat pump and hot water: the boiler is the fixture's
entry(
    dc.DHW,
    "water_heater.test_boiler",
    "on",
    "Boiler",
    current_temperature=51,
    temperature=55,
    min_temp=40,
    max_temp=65,
    target_temp_step=1,
    operation_list=["off", "on", "performance"],
)
entry("switch.space_heating_climate_control", "switch.demo_heating", "on", "Küte")
entry(
    "sensor.space_heating_leaving_water_temperature",
    "sensor.demo_flow_temp",
    "32.5",
    "Küttevesi",
    **TEMP,
)
entry("sensor.space_heating_outdoor_temperature", "sensor.demo_hp_outdoor", "7.1", "Väljas", **TEMP)
entry(
    "number.space_heating_temperature_control",
    "number.demo_curve_offset",
    "0",
    "Kõvera nihe",
    min=-5,
    max=5,
    step=1,
    unit_of_measurement="°C",
)
entry(
    "select.space_heating_operation_mode",
    "select.demo_heating_mode",
    "heating",
    "Kütte režiim",
    options=["heating", "cooling", "auto"],
)
entry("sensor.kutte_reziim", "sensor.demo_heating_mode_label", "Küte", "Kütte režiim")
entry("sensor.boileri_vee_temperatuur", "sensor.demo_boiler_water", "51.0", "Boileri vesi", **TEMP)
entry("sensor.boiler_energy_today", "sensor.demo_boiler_today", "2", "Boiler täna", **KWH)
entry("sensor.boiler_energy_month", "sensor.demo_boiler_month", "46", "Boiler sel kuul", **KWH)

# ventilation: the unit's power switch is the fixture's fan
entry(dc.MODE, "select.demo_vent_mode", "normal", "Ventilatsiooni režiim", options=VENT_MODES)
entry(dc.MODE_LABEL, "sensor.demo_vent_mode_label", "Tavaline", "Režiim")
entry(
    "select.komfovent_scheduler_mode",
    "select.demo_vent_schedule",
    "working_week",
    "Ajakava",
    options=["stay_at_home", "working_week", "office", "custom"],
)
entry("sensor.ventilatsiooni_ajakava", "sensor.demo_vent_schedule_label", "Tööpäevad", "Ajakava")
entry("switch.komfovent_power", "fan.test_ventilation", "on", "Ventilatsioon", percentage=50)
entry("switch.komfovent_auto_mode", "switch.demo_vent_auto", "off", "Automaatrežiim")
entry("switch.komfovent_eco_mode", "switch.demo_eco", "on", "ECO")
entry("switch.komfovent_eco_heater_blocking", "switch.demo_heater_block", "on", "Kütteblokeering")
entry(
    "switch.komfovent_eco_free_heating_cooling", "switch.demo_free_cooling", "off", "Vaba jahutus"
)
entry(
    "select.komfovent_eco_heat_recovery",
    "select.demo_eco_recovery",
    "auto",
    "Soojustagastus",
    options=["auto", "on", "off"],
)
entry(
    "number.komfovent_eco_min_supply_temperature",
    "number.demo_eco_min_supply",
    "15",
    "Min sissepuhe",
    min=5,
    max=25,
    step=1,
    unit_of_measurement="°C",
)
entry(
    "number.komfovent_eco_max_supply_temperature",
    "number.demo_eco_max_supply",
    "30",
    "Max sissepuhe",
    min=15,
    max=40,
    step=1,
    unit_of_measurement="°C",
)
entry(dc.OUTDOOR, "sensor.test_outdoor_temp", "7.5", "Välisõhk", **TEMP)
entry("sensor.komfovent_supply_temperature", "sensor.demo_supply_temp", "19.6", "Sissepuhe", **TEMP)
entry(
    "sensor.komfovent_extract_temperature", "sensor.demo_extract_temp", "21.4", "Väljatõmme", **TEMP
)
entry("sensor.komfovent_panel_1_temperature", "sensor.test_living_temp", "21.2", "Sees", **TEMP)
entry(
    "sensor.komfovent_panel_1_humidity",
    "sensor.demo_humidity",
    "41",
    "Niiskus",
    unit_of_measurement="%",
    device_class="humidity",
)
entry("sensor.komfovent_heat_exchanger", "sensor.demo_exchanger", "100", "Vaheti", **PCT)
entry(
    "sensor.komfovent_heat_exchanger_efficiency", "sensor.demo_efficiency", "82", "Kasutegur", **PCT
)
entry(
    "sensor.komfovent_heat_recovery",
    "sensor.demo_recovery",
    "1450",
    "Tagastus",
    unit_of_measurement="W",
    device_class="power",
)
entry(
    "sensor.komfovent_power_consumption",
    "sensor.demo_vent_power",
    "38",
    "Võimsus",
    unit_of_measurement="W",
    device_class="power",
)
entry("sensor.komfovent_filter_clogging", "sensor.demo_filter", "34", "Filter", **PCT)
entry("sensor.komfovent_active_alarms", "sensor.demo_vent_alarms", "", "Aktiivsed alarmid")
entry(
    "sensor.komfovent_total_recovered_energy",
    "sensor.demo_recovered",
    "8420",
    "Tagastatud",
    state_class="total_increasing",
    **KWH,
)
entry(
    "sensor.komfovent_total_ahu_energy",
    "sensor.demo_vent_energy",
    "2310",
    "Seade",
    state_class="total_increasing",
    **KWH,
)
entry(
    "sensor.ventilatsioon_sel_kuul", "sensor.demo_vent_month", "27", "Ventilatsioon sel kuul", **KWH
)
entry("sensor.jarelkute_sel_kuul", "sensor.demo_afterheat_month", "0", "Järelküte sel kuul", **KWH)
entry(
    "select.komfovent_holidays_micro_ventilation",
    "select.demo_holiday_micro",
    "off",
    "Mikroventilatsioon",
    options=["off", "on"],
)
entry(
    "sensor.puhkuse_mikroventilatsioon",
    "sensor.demo_holiday_micro_label",
    "Väljas",
    "Mikroventilatsioon",
)
entry(
    "number.komfovent_holidays_temperature",
    "number.demo_puhkus_temp",
    "18",
    "Sihttemp",
    min=15,
    max=30,
    step=0.5,
    unit_of_measurement="°C",
)
entry("switch.komfovent_holidays_electric_heater", "switch.demo_puhkus_heater", "off", "Järelküte")
entry(
    "number.komfovent_override_delay_start",
    "number.demo_erand_delay_start",
    "0",
    "Viide start",
    min=0,
    max=60,
    step=1,
    unit_of_measurement="min",
)
entry(
    "number.komfovent_override_delay_stop",
    "number.demo_erand_delay_stop",
    "5",
    "Viide stopp",
    min=0,
    max=60,
    step=1,
    unit_of_measurement="min",
)
# one row of settings per mode: (word, supply %, extract %, timer min or None)
MODE_ROWS = {
    "normal": ("tavaline", 50, 50, None),
    "kitchen": ("kook", 80, 20, 30),
    "boost": ("turbo", 100, 100, None),
    "fireplace": ("kamin", 40, 60, 45),
    "away": ("eemal", 30, 30, None),
    "intensive": ("intensiivne", 80, 80, None),
    "override": ("erand", 60, 60, 60),
}
for key, (word, sup, ext, timer) in MODE_ROWS.items():
    pct = {"min": 20, "max": 100, "step": 1, "unit_of_measurement": "%"}
    entry(
        f"number.komfovent_{key}_supply_flow",
        f"number.demo_{word}_supply",
        str(sup),
        "Sisse",
        **pct,
    )
    entry(
        f"number.komfovent_{key}_extract_flow",
        f"number.demo_{word}_extract",
        str(ext),
        "Välja",
        **pct,
    )
    entry(
        f"number.komfovent_{key}_temperature",
        f"number.demo_{word}_temp",
        "21",
        "Sihttemp",
        min=15,
        max=30,
        step=0.5,
        unit_of_measurement="°C",
    )
    entry(
        f"switch.komfovent_{key}_electric_heater", f"switch.demo_{word}_heater", "off", "Järelküte"
    )
    if timer:
        entry(
            f"number.komfovent_{key}_timer",
            f"number.demo_{word}_timer",
            str(timer),
            "Kestus",
            min=0,
            max=300,
            step=5,
            unit_of_measurement="min",
        )
entry(
    "button.komfovent_clean_filters_calibration",
    "button.demo_filter_calibration",
    "unknown",
    "Filtrite kalibreerimine",
)
entry(
    "button.komfovent_clear_active_alarms", "button.demo_clear_alarms", "unknown", "Kustuta alarmid"
)
entry("button.komfovent_set_system_time", "button.demo_set_clock", "unknown", "Sea kell")

# electricity: what the house used and what it cost, the price now and the forecast
entry("sensor.maja_tana", "sensor.demo_house_today", "9.2", "Täna", kulu="1,18 €", **KWH)
entry("sensor.maja_eile", "sensor.demo_house_yesterday", "18.4", "Eile", kulu="2,61 €", **KWH)
entry(
    "sensor.maja_sel_kuul",
    "sensor.demo_house_month",
    "286",
    "Sel kuul",
    kulu="41,30 €",
    hind="14,4 c/kWh",
    **KWH,
)
entry(
    "sensor.maja_eelmine_kuu",
    "sensor.demo_house_last_month",
    "612",
    "Eelmine kuu",
    kulu="84,12 €",
    hind="13,7 c/kWh",
    **KWH,
)
entry(dc.FORECAST, "sensor.demo_price_forecast", "36", "Prognoos katab", unit_of_measurement="h")
entry("sensor.elektri_hind_see_tund", "sensor.demo_price_hour", "0.139", "Hind see tund", **PRICE)
entry("sensor.elektri_hind_kokku", "sensor.demo_price_total", "0.143", "Kokku, 15 min", **PRICE)
entry("sensor.nord_pool_ee_praegune_hind", "sensor.demo_spot_now", "0.088", "Börs praegu", **PRICE)
entry(
    "sensor.nord_pool_ee_jargmine_hind", "sensor.demo_spot_next", "0.091", "Börs järgmine", **PRICE
)
entry(
    "sensor.nord_pool_ee_madalaim_hind", "sensor.demo_spot_low", "0.032", "Täna madalaim", **PRICE
)
entry("sensor.nord_pool_ee_korgeim_hind", "sensor.demo_spot_high", "0.214", "Täna kõrgeim", **PRICE)
# the price level's state, arvel and senti follow the forecast's hour at load (demo/recorder.js)
entry(
    dc.PRICE_LEVEL,
    "sensor.demo_price_level",
    "odav",
    "Elektri hinna tase",
    arvel=13.9,
    senti=8.8,
    hinnang="Praegu alla päeva keskmise",
)
entry(
    dc.WASH,
    "sensor.demo_window_wash",
    "22:00",
    "Odavaim aken pesu",
    tekst="Täna 22:00–02:00, 11,2 s/kWh, 38% odavam kui päeva kalleim algus.",
)
entry(
    dc.SAUNA,
    "sensor.demo_window_sauna",
    "20:00",
    "Odavaim aken saun",
    tekst="Täna 20:00–22:00, 12,4 s/kWh, 31% odavam kui päeva kalleim algus.",
)
entry(
    dc.TOMORROW,
    "sensor.demo_tomorrow_price",
    "12.8",
    "Homne elekter",
    tekst="Homme keskmiselt 12,8 senti, 9% odavam kui täna, parim 4 h aken 03:00–07:00, "
    "8,1 s/kWh; kalleim tund 18:00, 21,5 s/kWh.",
)
# the level sensor's words by the price with all fees, €/kWh, as the house's template bands them
LEVELS = [
    [0.08, "väga odav"],
    [0.15, "odav"],
    [0.2, "tavaline"],
    [0.25, "kõrgevõitu"],
    [0.32, "kallis"],
    [None, "väga kallis"],
]
# the level sensor's hinnang by the price now against the day's average (below, near, above)
HINNANG = {
    "below": "Praegu alla päeva keskmise",
    "near": "Praegu päeva keskmise lähedal",
    "above": "Praegu üle päeva keskmise",
}

# the TV and its watch time
entry(dc.TV, "media_player.demo_tv", "playing", "Teler", app_name="YouTube", device_class="tv")
entry("sensor.teleri_app", "sensor.demo_tv_app", "YouTube", "Teler")
# the week chart's statistics, as the generator names them
TV_WEEK = [x["entity"] for x in dc.tv_week["entities"]]
for (app, *_), real, word in zip(
    dc.TV_APPS, TV_WEEK, ["youtube", "elisa", "jupiter", "go3", "stremio", "other"], strict=True
):
    entry(real, f"sensor.demo_tv_{word}", "0.9", app, **HOURS)

# the system: updates, the network, the NVR, the phone and the people
UPDATE_WORDS = [
    "hacs",
    "vent_fw",
    "heat_pump_fw",
    "meter_fw",
    "charts",
    "camera_card",
    "gateway_fw",
    "ap_fw",
]
for (real, name), word in zip(dc.BASE_UPDATES, UPDATE_WORDS, strict=True):
    on = word == "charts"
    entry(
        real,
        f"update.demo_{word}",
        "on" if on else "off",
        LABELS.get(name, name),
        installed_version="2.4.0",
        latest_version="2.5.0" if on else "2.4.0",
    )
entry(dc.NET[0][0], "sensor.demo_gateway_state", "connected", "Lüüs")
entry(dc.NET[1][0], "sensor.demo_ap_state", "connected", "Pääsupunkt")
entry(
    dc.WAN,
    "sensor.demo_wan_latency",
    "12",
    "Internet",
    unit_of_measurement="ms",
    device_class="duration",
)
entry("sensor.u6_lr_kliendid", "sensor.demo_wifi_clients", "14", "WiFi kliendid")
entry("sensor.nvr_ketas", "sensor.demo_nvr_disk", "OK", "NVR ketas")
entry(
    "sensor.demo_telefon_battery_level",
    "sensor.demo_telefon_battery_level",
    "78",
    "Telefoni aku",
    unit_of_measurement="%",
    device_class="battery",
)
entry(
    "sensor.demo_telefon_connection_type", "sensor.demo_telefon_connection_type", "Wi-Fi", "Ühendus"
)
for (real, label), state in zip(DEMO_PEOPLE, ["home", "not_home"], strict=True):
    entry(real, real, state, label.removesuffix(" on"))

STATISTICS = {
    "estfeed:estfeed_consumption_642b": "demo:consumption",
    "estfeed:estfeed_cost_642b": "demo:cost",
    dc.PRICE_STAT: "demo:price",
}

# a select shown through an Estonian label sensor follows its select, as the real template does
MIRRORS = {
    "sensor.demo_vent_mode_label": {
        "from": "select.demo_vent_mode",
        "map": dict(
            zip(
                VENT_MODES,
                [
                    "Tavaline",
                    "Köök",
                    "Boost",
                    "Eemal",
                    "Kamin",
                    "Intensiivne",
                    "Override",
                    "Puhkus",
                ],
                strict=True,
            )
        ),
    },
    "sensor.demo_vent_schedule_label": {
        "from": "select.demo_vent_schedule",
        "map": {
            "stay_at_home": "Kodus",
            "working_week": "Tööpäevad",
            "office": "Töökoht",
            "custom": "Oma",
        },
    },
    "sensor.demo_heating_mode_label": {
        "from": "select.demo_heating_mode",
        "map": {"heating": "Küte", "cooling": "Jahutus", "auto": "Automaatne"},
    },
    "sensor.demo_holiday_micro_label": {
        "from": "select.demo_holiday_micro",
        "map": {"off": "Väljas", "on": "Sees"},
    },
    "sensor.demo_tv_app": {
        "from": "media_player.demo_tv",
        "map": {"off": "Väljas", "playing": "YouTube"},
    },
}

# sample text for each templated markdown card, in the subset demo/cards.js renders
TEXTS = {
    dc.tv_today["content"]: (
        "# 1 t 25 min\n\n"
        '<ha-icon icon="mdi:youtube"></ha-icon> **YouTube** 52 min\n\n'
        '<ha-icon icon="mdi:television-play"></ha-icon> **Jupiter** 33 min\n\n'
    ),
    dc.tv_sessions["content"]: (
        "| Aeg | Äpp | Kestus |\n|:--|:--|--:|\n"
        "| 19:40–praegu | YouTube | 22 min |\n"
        "| 18:05–18:38 | Jupiter | 33 min |\n"
        "| 16:10–16:40 | YouTube | 30 min |"
    ),
}


def _walk(o, key=None):
    if isinstance(o, dict):
        if o.get("type") == "markdown" and ("{{" in o["content"] or "{%" in o["content"]):
            if o["content"] not in TEXTS:
                raise ValueError(
                    f"a templated markdown card without sample text: {o['content'][:60]!r}"
                )
            o = {**o, "content": TEXTS[o["content"]]}
        if o.get("type") == "custom:house3d-card":
            o = {k: v for k, v in o.items() if k != "model"}
        o = {k: v for k, v in o.items() if k != "data_generator"}
        return {k: (v if k == "perform_action" else _walk(v, k)) for k, v in o.items()}
    if isinstance(o, list):
        return [_walk(v, key) for v in o]
    if isinstance(o, str):
        if ID.match(o):
            if o not in CATALOGUE:
                raise KeyError(f"no demo entity for {o} (add it to dashboard_demo.CATALOGUE)")
            return CATALOGUE[o]["id"]
        if STAT.match(o) and not o.startswith("mdi:"):
            if o not in STATISTICS:
                raise KeyError(f"no demo statistic for {o} (add it to dashboard_demo.STATISTICS)")
            return STATISTICS[o]
        for k, v in LABELS.items():
            o = o.replace(k, v)
    return o


def _real_ids(model):
    """The test house with its devices under the house's own ids where the catalogue maps one to
    them, so the generator places the PIRs in its rooms (the plan slice) by the ids it knows; the
    walk maps them back."""
    if not model:
        return model
    real = {e["id"]: r for r, e in CATALOGUE.items() if r in dc.SHARED + dc.PRIVATE}
    out = dict(model)
    out["devices"] = [
        {**d, "entity": real.get(d["entity"], d["entity"])} for d in out.get("devices", [])
    ]
    return out


def demo_config(model):
    """The house's Overview for the demo house, every id and private label replaced."""
    return _walk(a3.overview(DEMO_HOUSE, DEMO_PEOPLE, _real_ids(model)))


# A starting state per fixture device the catalogue does not cover, varied by position in the
# list so the house is not all off.
def _initial(d, i):
    domain = d["entity"].split(".")[0]
    temp = 7.5 if d.get("room") == OUTDOOR_ROOM else 20.6 + (i % 4) * 0.4
    if domain == "light":
        return ("off", {}) if i % 2 else ("on", {"brightness": 200})
    if domain == "sensor":
        return f"{temp:.1f}", dict(TEMP)
    if domain == "binary_sensor":
        return "off", {"device_class": d["type"]}
    if domain in ("switch", "input_boolean"):
        return ("off" if i % 2 else "on"), {}
    if domain == "fan":
        return "on", {"percentage": 40}
    if domain == "cover":
        return ("closed", {}) if i % 2 else ("open", {"current_position": 100})
    if domain == "climate":
        cur = 20.8 + (i % 3) * 0.4
        return "heat", {
            "hvac_modes": ["off", "heat"],
            "current_temperature": round(cur, 1),
            "temperature": 21,
            "min_temp": 5,
            "max_temp": 30,
        }
    if domain == "water_heater":
        return "eco", {"current_temperature": 48, "temperature": 50, "min_temp": 40, "max_temp": 65}
    if domain == "alarm_control_panel":
        return "disarmed", {}
    if domain == "camera":
        return "idle", {}
    return "off", {}


def demo_states(model):
    """{"states": entity -> {state, attributes, ago?}, "mirrors": ...}: the catalogue's states,
    then every fixture device and the car that the catalogue does not cover."""
    states = {}
    for e in CATALOGUE.values():
        s = {"state": e["state"], "attributes": copy.deepcopy(e["attributes"])}
        if "ago" in e:
            s["ago"] = e["ago"]
        states[e["id"]] = s
    for i, d in enumerate(model.get("devices", [])):
        if d["entity"] not in states:
            state, attrs = _initial(d, i)
            states[d["entity"]] = {
                "state": state,
                "attributes": {"friendly_name": d["name"], **attrs},
            }
    car = model.get("car") or {}
    if car.get("entity"):
        states[car["entity"]] = {
            "state": "not_home",
            "attributes": {"friendly_name": car.get("name") or car["entity"], "arrived_at": None},
        }
    return {
        "states": states,
        "mirrors": copy.deepcopy(MIRRORS),
        "levels": copy.deepcopy(LEVELS),
        "hinnang": dict(HINNANG),
    }


# ---------- the simulated recorder (ADR-012) ----------

# What demo/recorder.js answers recorder and history requests from, and the states it computes at
# load: per statistic or entity a profile, never a stored series, so any day of any month has
# data. wave: a measurement around `level`, `amp` either side of its daily `peak` hour, drifting by
# `drift` over a few days. counter: kWh per hour, its state the sum since the day's or the month's
# start; `last` names last month's attribute (a utility meter's `last_period`, Daikin's month
# names). cost: a counter's kWh times the price. price: € per kWh with all fees, with a morning
# and an evening peak. duty: an on/off entity's daily hours on. pulses: a PIR's or a door's short
# on-events (ADR-015), `hours` [[from, to, per hour]] of the day, the same on every load, ending at
# its catalogue state `ago` minutes back and none in the QUIET_AGO minutes before it.
RECORDER_ZONE = "Europe/Tallinn"
# older than the 3D view's 15-minute motion glow: the 3D scenarios start with every PIR off this long
QUIET_AGO = 30
# each PIR's day in dashboard_config.SHARED + PRIVATE order, then each door's
PULSES = [
    [[6, 9, 12], [16, 21, 20]],
    [[7, 9, 6], [17, 23, 25]],
    [[6, 9, 15], [15, 23, 12]],
    [[7, 8, 3], [17, 18, 3]],
    [[6, 8, 10], [20, 22, 8]],
    [[6, 7, 6], [21, 23, 8]],
    [[7, 8, 8], [19, 21, 10]],
    [[7, 8, 6], [18, 21, 8]],
    [[9, 12, 10], [13, 17, 8]],
]
DOOR_PULSES = [[[7, 9, 2], [15, 19, 2]], [[12, 20, 1]], []]


def _pulses(real, hours, seed):
    e = CATALOGUE[real]
    return {
        "kind": "pulses",
        "hours": hours,
        "seed": seed,
        "state": e["state"],
        "ago": e.get("ago", 0),
        "quiet": QUIET_AGO,
    }


def _wave_profile(level, amp, peak, drift=0.0, decimals=1):
    return {
        "kind": "wave",
        "level": level,
        "amp": amp,
        "peak": peak,
        "drift": drift,
        "decimals": decimals,
    }


def _counter(base, amp, peak, state=None, last=None):
    return {"kind": "counter", "base": base, "amp": amp, "peak": peak, "state": state, "last": last}


def demo_recorder():
    """recorder.json: {zone, profiles, house, forecast, weather, rules}, every id the demo's own."""
    ids = {real: e["id"] for real, e in CATALOGUE.items()}
    consumption, cost, price = (STATISTICS[k] for k in (dc.CONSUMPTION, dc.COST, dc.PRICE_STAT))
    boiler = (0.1, 0.06, 6)
    vent = (0.04, 0.01, 12)
    profiles = {
        ids[dc.OUTDOOR]: _wave_profile(7.5, 2.5, 15, 2.0),
        ids[dc.PUMP_OUTDOOR]: _wave_profile(7.1, 2.5, 15, 2.0),
        ids[dc.SUPPLY]: _wave_profile(19.6, 1.0, 16, 0.4),
        ids[dc.EXTRACT]: _wave_profile(21.4, 0.4, 19, 0.2),
        ids[dc.HUMIDITY]: _wave_profile(41, 3, 20, 2.0, 0),
        ids[dc.PANEL_TEMP]: _wave_profile(21.2, 0.5, 18, 0.2),
        ids[dc.BOILER_TEMP]: _wave_profile(51, 3, 7, 1.0, 0),
        ids[dc.LEAVING]: _wave_profile(32.5, 2.5, 5, 1.5),
        consumption: _counter(0.9, 0.45, 19),
        cost: {"kind": "cost", "of": consumption, "price": price},
        price: {
            "kind": "price",
            "base": 0.14,
            "morning": 0.05,
            "evening": 0.09,
            "night": 0.05,
            "drift": 0.03,
        },
        ids[dc.BOILER_TODAY]: _counter(*boiler, state="day"),
        ids[dc.BOILER_MONTH]: _counter(*boiler, state="month", last="month"),
        ids[dc.VENT_MONTH]: _counter(*vent, state="month", last="last_period"),
        # the unit's own counter has the month's shape, so Ventilatsioon's bars sum to its month
        ids[dc.AHU_ENERGY]: _counter(*vent),
        # the house recovers 24 to 34 kWh a day, more in the cold of the night
        ids[dc.RECOVERED]: _counter(1.1, 0.35, 5),
        ids[dc.RECOVERY]: _wave_profile(1250, 350, 5, 120, 0),
        ids[dc.VENT_POWER_USE]: _wave_profile(38, 4, 18, 1, 0),
        ids[dc.EXCHANGER]: _wave_profile(97, 3, 5, 1, 0),
        ids[dc.EFFICIENCY]: _wave_profile(83, 1.5, 5, 0.5, 0),
        ids[dc.FILTER]: _wave_profile(34, 0, 12, 0, 0),
        ids[dc.HEATER_MONTH]: _counter(0, 0, 0, state="month", last="last_period"),
        # a shower most afternoons and a drizzle before dawn, some days dry; the two-hour sensor is
        # the next two hours of it, and the forecast reads the same profile
        ids[dc.RAIN_NOW]: {"kind": "rain", "showers": [[13, 15, 0.6], [4, 5, 0.3]]},
        ids[dc.RAIN_2H]: {"kind": "ahead", "of": ids[dc.RAIN_NOW], "hours": 2},
        ids[dc.PERGOLA_LIGHT]: {"kind": "duty", "on": [[17, 23]], "states": ["off", "on"]},
        ids[dc.TV]: {"kind": "duty", "on": [[7, 8], [19, 22]], "states": ["off", "playing"]},
        ids[dc.MODE]: {"kind": "duty", "on": [[18, 19]], "states": ["normal", "kitchen"]},
        **{
            ids[real]: _pulses(real, hours, i)
            for i, (real, hours) in enumerate(
                zip(
                    dc.SHARED + dc.PRIVATE + [e for e, _ in dc.DOORS],
                    PULSES + DOOR_PULSES,
                    strict=True,
                )
            )
        },
    }
    return {
        "zone": RECORDER_ZONE,
        "profiles": profiles,
        # the house's counters: kWh and their cost (kulu) and average price (hind) since a start
        "house": {
            "consumption": consumption,
            "cost": cost,
            "today": ids[dc.TODAY],
            "yesterday": ids[dc.YESTERDAY],
            "month": ids[dc.MONTH],
            "last_month": ids[dc.LAST_MONTH],
        },
        # today's and tomorrow's prices, and the level sensor's word, price and spot price now;
        # the spot price is the price less `fees`
        "forecast": {
            "entity": ids[dc.FORECAST],
            "price": price,
            "level": ids[dc.PRICE_LEVEL],
            "fees": 0.05,
        },
        # the weather entity's hourly forecast (ADR-014): the rain and outdoor profiles' next hours
        "weather": {
            "entity": ids[dc.WEATHER],
            "rain": ids[dc.RAIN_NOW],
            "temperature": ids[dc.OUTDOOR],
            "hours": 24,
        },
        # each rule's last run, the last time the clock read its [hour, minute] in the zone
        "rules": {ids[dc.RAIN_RULE]: [14, 19], ids[dc.SUNSET_RULE]: [15, 45]},
    }


# Made-up series, the same on every build: a smooth daily shape plus a fixed ripple.
def _wave(i, period, phase=0.0):
    return math.sin(2 * math.pi * (i + phase) / period)


def _days(n, base, amp, ripple, period=7, decimals=1):
    return [
        [d, round(base + amp * _wave(d, period, 1.3) + ripple * _wave(d, 3.1), decimals)]
        for d in range(-(n - 1), 1)
    ]


def _hours(base, amp, ripple, phase=0.0):
    return [
        [h / 2, round(base + amp * _wave(h / 2, 24, phase) + ripple * _wave(h / 2, 5.3), 1)]
        for h in range(-96, 1)
    ]


def demo_series():
    """Chart data keyed the way demo/charts.js asks: an apexcharts series by
    "<entity>|<series name>", a history or statistics line by its entity or statistic id. Offsets are in each key's step from now (hours), from today
    (days) or from this month (months)."""
    s = {}

    def put(key, step, points):
        s[key] = {"step": step, "points": points}

    ids = {real: e["id"] for real, e in CATALOGUE.items()}
    put(ids["sensor.komfovent_total_recovered_energy"], "day", _days(31, 9, 3, 1.5))
    put(ids["sensor.komfovent_total_ahu_energy"], "day", _days(31, 0.95, 0.12, 0.05, decimals=2))
    for i, real in enumerate(TV_WEEK):
        put(
            ids[real],
            "day",
            [
                [d, max(0.0, round(v, 1))]
                for d, v in _days(7, 0.8 - 0.12 * i, 0.5, 0.3, period=4 + i)
            ],
        )
    put(ids["sensor.komfovent_supply_temperature"], "hour", _hours(19.5, 1.2, 0.3, 3))
    put(ids["sensor.komfovent_extract_temperature"], "hour", _hours(21.4, 0.5, 0.2, 1))
    put(ids[dc.OUTDOOR], "hour", _hours(7.5, 3.5, 0.3, 9))
    return s


# ---------- the demo in English (ADR-003) ----------

VISIBLE = (
    *("title", "heading", "name", "text", "label", "caption", "aria", "state_text", "icon_label"),
    *(
        "confirm",
        "ok",
        "on",
        "off",
        "fault_text",
        "note",
        "foot",
        "unit",
        "legend",
        "caption_below",
        # a forecast cell's notes by its value
        "above",
        "below",
    ),
)
RAW = re.compile(r"^[a-z0-9_]*$")
NUMBER = re.compile(r"^-?\d+(\.\d+)?$")
WHEN = re.compile(r"^(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?|\d{2}:\d{2}(:\d{2})?)$")


def _en(s):
    """English for a visible string."""
    if s in en.SAME:
        return s
    if s not in en.EN:
        raise KeyError(f"no English for {s!r} (add it to dashboard_demo_en.EN or SAME)")
    return en.EN[s]


def _word(s):
    """English for a state value or select option; a raw HA key, a number or a time passes."""
    # a word the house writes in lower case (a price level) reads as a raw key otherwise
    if s in en.WORDS:
        return en.WORDS[s]
    # a state pattern: a "!" in front negates, a "*" at the end matches a prefix
    if RAW.match(s.removeprefix("!").removesuffix("*")):
        return s
    if NUMBER.match(s) or WHEN.match(s) or s in en.SAME:
        return s
    if s not in en.WORDS:
        raise KeyError(f"no English for the state word {s!r} (add it to dashboard_demo_en.WORDS)")
    return en.WORDS[s]


def _walk_en(o, key=None):
    if isinstance(o, dict):
        # the 3D card and the house's own cards take their words from their language (ADR-012)
        if o.get("type") == "custom:house3d-card" or str(o.get("type")).startswith("custom:khe-"):
            o = {**o, "language": "en"}
        md = o.get("type") == "markdown"
        return {k: _walk_en(v, "markdown" if md and k == "content" else k) for k, v in o.items()}
    if isinstance(o, list):
        return [_walk_en(v, key) for v in o]
    if isinstance(o, str):
        if key == "markdown":
            return en.TEXTS_EN[o] if o in en.TEXTS_EN else _en(o)
        # a tile's state_text list names its parts by attribute or entity
        if key == "state_text" and (RAW.match(o) or ID.match(o)):
            return o
        if key in VISIBLE:
            return _en(o)
        # a mode's option is the select's state word
        if key in ("state", "state_not", "option"):
            return _word(o)
    return o


def demo_config_en(model):
    """demo_config() in English, its 3D card set to English."""
    return _walk_en(demo_config(model))


def demo_states_en(model):
    """demo_states() in English: names, state words, options, mirrors, the price level's words,
    the sentences the house's templates write (en.ATTRS), and a decimal point in every other text
    attribute (the cost and price texts)."""
    data = demo_states(model)
    for st in data["states"].values():
        a = st["attributes"]
        a["friendly_name"] = _en(a["friendly_name"])
        st["state"] = _word(st["state"])
        if "options" in a:
            a["options"] = [_word(o) for o in a["options"]]
        for k, v in a.items():
            if k in ("tekst", "hinnang"):
                if v not in en.ATTRS:
                    raise KeyError(f"no English for the {k} text {v!r} (add it to en.ATTRS)")
                a[k] = en.ATTRS[v]
            elif k != "friendly_name" and isinstance(v, str):
                a[k] = re.sub(r"(\d),(\d)", r"\1.\2", v)
    for m in data["mirrors"].values():
        m["map"] = {k: _word(v) for k, v in m["map"].items()}
    data["levels"] = [[at, _word(w)] for at, w in data["levels"]]
    data["hinnang"] = {k: en.ATTRS[v] for k, v in data["hinnang"].items()}
    return data


def demo_series_en():
    """demo_series() keyed by the English config's series names."""
    out = {}
    for k, v in demo_series().items():
        entity, apex, name = k.partition("|")
        out[f"{entity}|{_en(name)}" if apex else k] = v
    return out


def demo_model_en(model):
    """The test house in English: room, device, car and future-item names and facts."""
    m = copy.deepcopy(model)
    for item in m.get("rooms", []) + m.get("devices", []):
        item["name"] = _en(item["name"])
    if (m.get("car") or {}).get("name"):
        m["car"]["name"] = _en(m["car"]["name"])
    for item in (m.get("future") or {}).get("items", []):
        item["name"] = _en(item["name"])
        if "facts" in item:
            item["facts"] = [_en(f) for f in item["facts"]]
    return m
