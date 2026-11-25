"""Single source of truth for the house's entity ids, labels and local-input wrapper.

Every view module under scripts/dashboard/ and the public demo (scripts/dashboard_demo.py)
imports entity ids and house-specific labels from here, so the privacy scan in scripts/check.sh
covers every other module in scripts/dashboard/ without listing real device ids twice.
"""

FORECAST = "sensor.elektri_hinna_prognoos"
DHW = "water_heater.hot_water_tank_domestic_hot_water_tank"

# Rows are named after the thing being updated: the entity's own name is "Update", so the
# default reads "HACS Update" seven times over. House-file entries are [entity_id, name].
BASE_UPDATES = [
    ("update.hacs_update", "HACS"),
    ("update.komfovent_update", "Komfovent"),
    ("update.daikin_altherma_update", "Daikin Altherma"),
    ("update.estfeed_update", "Estfeed"),
    ("update.apexcharts_card_update", "ApexCharts Card"),
    ("update.advanced_camera_card_update", "Advanced Camera Card"),
    ("update.unifi_gateway_pusivara", "UniFi Gateway"),
    ("update.u6_lr_pusivara", "UniFi AP"),
]
NET = [("sensor.unifi_gateway_olek", "Ruuter"), ("sensor.u6_lr_olek", "Pääsupunkt")]
# A firmware update passes through these on its own; only the rest is a fault worth a red tile.
NET_OK = ["connected", "upgrading", "provisioning"]
WAN = "sensor.unifi_gateway_cloudflare_wan_latentsus"

SMOKE = "binary_sensor.suitsuandurid"
VALVE_LINK_RAW = "sensor.valve_uhendus"
VALVE_LINK = "binary_sensor.valve_uhendus"
VALVE_BATTERY = "sensor.valve_aku"
VALVE_SUPPLY = "sensor.valve_toide"
TAMPER = "binary_sensor.valve_rikkumine"
SIREN = "binary_sensor.valissireen"
SMOKE_GROUP = "Suitsuandurid"
ALARMS = [("alarm_control_panel.maja", "Maja"), ("alarm_control_panel.garaaz", "Garaaž")]
ALARM_MODES = ["armed_away", "armed_home", "armed_night", "disarmed"]

ROOF = "cover.pergola_katus"
ROOF_NAME = "Pergola katus"
PERGOLA_LIGHT = "light.pergola_valgustus"
OUTDOOR = "sensor.komfovent_outdoor_temperature"
RAIN_NOW = "sensor.sademed_praegu"
RAIN_2H = "sensor.sademed_kahe_tunniga"
ROOF_AUTO = "input_boolean.pergola_katuse_automaatika"
LIGHT_AUTO = "input_boolean.pergola_valguse_automaatika"
TONE = "input_select.pergola_valguse_toon"
TONES = ["Soe", "Valge"]
WEATHER = "weather.forecast_kodu"
RAIN_RULE = "automation.pergola_vihm_sulgeb_katuse"
SUNSET_RULE = "automation.pergola_valgustus_loojangul"
LIGHT_OFF = "input_datetime.pergola_valgus_kustub"

PRICE_LEVEL = "sensor.elektri_hinna_tase"
PRICE_NOW = "sensor.elektri_hind_see_tund"
PRICE_STAT = "estfeed:estfeed_price"
PRICE_BANDS = [0.15, 0.25]
WASH = "sensor.odavaim_aken_pesu"
SAUNA = "sensor.odavaim_aken_saun"
TOMORROW = "sensor.homme_elekter"
TOMORROW_READY = "binary_sensor.nord_pool_ee_homne_hind_on_saadaval"
STALE = "binary_sensor.maja_andmed_varsked"
TODAY = "sensor.maja_tana"
YESTERDAY = "sensor.maja_eile"
MONTH = "sensor.maja_sel_kuul"
LAST_MONTH = "sensor.maja_eelmine_kuu"
BOILER_MONTH = "sensor.boiler_energy_month"
VENT_MONTH = "sensor.ventilatsioon_sel_kuul"
HEATER_MONTH = "sensor.jarelkute_sel_kuul"
USAGE = [
    (TODAY, "Täna"),
    (YESTERDAY, "Eile"),
    (MONTH, "Sel kuul"),
]
CONSUMPTION = "estfeed:estfeed_consumption_642b"
COST = "estfeed:estfeed_cost_642b"

HEATING = "switch.space_heating_climate_control"
LEAVING = "sensor.space_heating_leaving_water_temperature"
BOILER_TEMP = "sensor.boileri_vee_temperatuur"
# "Sees" is the Komfovent wall panel in the utility room, the one indoor thermometer the house has.
PANEL_TEMP = "sensor.komfovent_panel_1_temperature"
PUMP_OUTDOOR = "sensor.space_heating_outdoor_temperature"
SHIFT = "number.space_heating_temperature_control"
BOILER_TODAY = "sensor.boiler_energy_today"
HEATING_FAULT = "binary_sensor.space_heating_unit_state"
TANK_FAULT = "binary_sensor.hot_water_tank_state"
# The boiler's legionella floor, °C.
DHW_FLOOR = 45
SHADOW_OFFSET = "sensor.kutte_soovitatav_nihe"
SHADOW_DHW = "sensor.boileri_soovitatav_siht"
SHADOW_NOTIFY = "input_boolean.kutte_varjuteavitused"
DHW_AUTO = "input_boolean.boileri_hinnajuhtimine"
DHW_RULE = "automation.boiler_hinnajuhtimine"

MODE = "select.komfovent_operation_mode"
MODE_LABEL = "sensor.ventilatsiooni_reziim"
SUPPLY = "sensor.komfovent_supply_temperature"
EXTRACT = "sensor.komfovent_extract_temperature"
HUMIDITY = "sensor.komfovent_panel_1_humidity"
VENT_POWER = "switch.komfovent_power"
ECO = "switch.komfovent_eco_mode"
VENT_FAULT = "binary_sensor.komfovent_status_alarm_fault"
VENT_WARNING = "binary_sensor.komfovent_status_alarm_warning"
FLOW_DOWN = "binary_sensor.komfovent_status_flow_down"
ACTIVE_ALARMS = "sensor.komfovent_active_alarms"
EXCHANGER = "sensor.komfovent_heat_exchanger"
EFFICIENCY = "sensor.komfovent_heat_exchanger_efficiency"
RECOVERY = "sensor.komfovent_heat_recovery"
FILTER = "sensor.komfovent_filter_clogging"
VENT_POWER_USE = "sensor.komfovent_power_consumption"
RECOVERED = "sensor.komfovent_total_recovered_energy"
AHU_ENERGY = "sensor.komfovent_total_ahu_energy"

FAULTS = [
    (SMOKE, "Tulekahju"),
    (HEATING_FAULT, "Soojuspumba viga"),
    (TANK_FAULT, "Boileri viga"),
    (VENT_FAULT, "Ventilatsiooni viga"),
    (VENT_WARNING, "Ventilatsiooni hoiatus"),
]

TV = "media_player.google_tv_streamer"
TV_APP = "sensor.teleri_app"
TV_SESSIONS = "sensor.teleri_seansid"
TV_YESTERDAY = "sensor.teler_sees_eile"
TV_APPS = [
    ("YouTube", "sensor.youtube_tana", "mdi:youtube", "#e53935"),
    ("Elisa Elamus", "sensor.elisa_elamus_tana", "mdi:television-classic", "#7e57c2"),
    ("Jupiter", "sensor.jupiter_tana", "mdi:television-play", "#1e88e5"),
    ("Go3", "sensor.go3_tana", "mdi:play-box-multiple", "#fb8c00"),
    ("Stremio", "sensor.stremio_tana", "mdi:movie-open-play", "#43a047"),
    ("Muu", "sensor.muu_tana", "mdi:dots-horizontal", "#90a4ae"),
]
# The weekly stacked statistics are the total_increasing copies of the per-app daily counters.
tv_week = {
    "entities": [{"entity": e.replace("_tana", "_vaadatud"), "name": n} for n, e, _, _ in TV_APPS],
}

NVR = "sensor.nvr_ketas"

DOORS = [
    ("binary_sensor.peauks", "Peauks"),
    ("binary_sensor.elutoa_uks", "Elutoa uks"),
    ("binary_sensor.vannitoa_uks", "Vannitoa uks"),
]
SHARED = [
    "binary_sensor.kook_liikumine",
    "binary_sensor.elutuba_liikumine",
    "binary_sensor.koridor_liikumine",
    "binary_sensor.garaaz_liikumine",
    "binary_sensor.tehnoruum_liikumine",
]
PRIVATE = [
    "binary_sensor.vanemate_tuba_liikumine",
    "binary_sensor.magamistuba_2",
    "binary_sensor.magamistuba_4",
    "binary_sensor.kontor_liikumine",
]
MOTION_ROOMS = dict(
    zip(
        SHARED + PRIVATE,
        [
            "Köök",
            "Elutuba",
            "Koridor",
            "Garaaž",
            "Tehnoruum",
            "Magamistuba 1",
            "Magamistuba 2",
            "Magamistuba 3",
            "Kabinet",
        ],
        strict=True,
    )
)

HOUSE3D_PATH = "maja-3d"


class House:
    """What the two local files carry (the format is in ha-dashboard.py)."""

    def __init__(self, house, people):
        self.cams = [tuple(c) for c in house.get("cams", [])]
        self.phone = house.get("phone")
        self.nvr_app = house.get("nvr_app_url")
        self.tv_profiles = [tuple(p) for p in house.get("tv_profiles", [])]
        self.people = [tuple(p) for p in people]
        self.updates = BASE_UPDATES + [
            tuple(u) if isinstance(u, list) else (u, None) for u in house.get("updates", [])
        ]
        self.update_ids = [u for u, _ in self.updates]
        # Estfeed has no brand image, so its row showed "icon not available"; an explicit icon
        # wins over the picture.
        self.update_rows = [
            {
                "entity": u,
                **({"name": n} if n else {}),
                **({"icon": "mdi:meter-electric"} if u == "update.estfeed_update" else {}),
            }
            for u, n in self.updates
        ]
