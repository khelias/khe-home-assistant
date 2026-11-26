"""Remaining stock-card views still in the Overview: Süsteem, the four settings subviews and 3D."""

from . import entities as E
from .primitives import (
    confirm,
    dhw_boost_stock,
    label,
    note,
    nowrite,
    row,
    stock_section,
    stock_tile,
)
from .security import cam_detect, camera_stills, camera_views


def kaamerad_seaded(h):
    return {
        "title": "Kaamerate seaded",
        "path": "kaamerad-seaded",
        "icon": "mdi:tune",
        "type": "sections",
        "subview": True,
        "max_columns": 2,
        "sections": [
            stock_section(
                "Liikumistuvastus",
                [*row([stock_tile(cam_detect(slug), n, vertical=True) for slug, n in h.cams])],
                column_span=2,
            ),
            stock_section(
                "Põhivood",
                [*row([stock_tile("camera." + slug, n, vertical=True) for slug, n in h.cams])],
                column_span=2,
            ),
        ],
    }


pergola_seaded = {
    "title": "Pergola seaded",
    "path": "pergola-seaded",
    "icon": "mdi:tune",
    "type": "sections",
    "subview": True,
    "max_columns": 2,
    "sections": [
        stock_section(
            "Katus poolte kaupa",
            [
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "cover.pergola_parem",
                            "Parem",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "cover-open-close"}],
                        ),
                        stock_tile(
                            "cover.pergola_vasak",
                            "Vasak",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "cover-open-close"}],
                        ),
                    ],
                },
            ],
        ),
        stock_section(
            "Valgus poolte kaupa",
            [
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "light.pergola_parem_valgustus",
                            "Parem",
                            vertical=True,
                            features=[{"type": "light-brightness"}],
                        ),
                        stock_tile(
                            "light.pergola_vasak_valgustus",
                            "Vasak",
                            vertical=True,
                            features=[{"type": "light-brightness"}],
                        ),
                    ],
                },
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "select.pergola_parem_valguse_toon", "Toon parem", vertical=True
                        ),
                        stock_tile(
                            "select.pergola_vasak_valguse_toon", "Toon vasak", vertical=True
                        ),
                    ],
                },
            ],
        ),
        stock_section(
            "Katuse automaatika",
            [
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "input_boolean.pergola_katuse_automaatika", "Reegel", vertical=True
                        ),
                        stock_tile(
                            "input_boolean.pergola_vihma_teavitus", "Teavitus", vertical=True
                        ),
                    ],
                },
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "input_number.pergola_teavituse_vaikus",
                            "Vaikus",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "numeric-input", "style": "buttons"}],
                        ),
                        nowrite(
                            "input_datetime.pergola_vihmateade", "Viimane teade", vertical=True
                        ),
                    ],
                },
            ],
        ),
        stock_section(
            "Valguse automaatika",
            [
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "input_boolean.pergola_valguse_automaatika", "Reegel", vertical=True
                        ),
                        stock_tile(
                            "input_boolean.pergola_valgus_ainult_kodus",
                            "Ainult kui kodus",
                            vertical=True,
                        ),
                    ],
                },
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "input_number.pergola_valgus_nihe",
                            "Enne loojangut",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "numeric-input", "style": "buttons"}],
                        ),
                        stock_tile("input_datetime.pergola_valgus_kustub", "Kustub", vertical=True),
                    ],
                },
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "input_number.pergola_valguse_heledus",
                            "Heledus",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "numeric-input", "style": "buttons"}],
                        ),
                        stock_tile(
                            "input_select.pergola_ohtune_toon",
                            "Õhtune toon",
                            vertical=True,
                            hide_state=True,
                            features=[{"type": "select-options"}],
                        ),
                    ],
                },
            ],
        ),
    ],
}


def susteem(h):
    return {
        "title": "Süsteem",
        "path": "susteem",
        "icon": "mdi:home-assistant",
        "type": "sections",
        "subview": True,
        "max_columns": 2,
        "sections": [
            stock_section(
                "Uuendused",
                [
                    {"type": "entities", "entities": h.update_rows},
                ],
            ),
            stock_section(
                "Võrk",
                [
                    *row(
                        [
                            *[nowrite(e, n, vertical=True) for e, n in E.NET],
                            nowrite(E.WAN, "Internet", vertical=True),
                            nowrite("sensor.u6_lr_kliendid", "WiFi kliendid", vertical=True),
                        ]
                    ),
                ],
            ),
            stock_section(
                "Telefon",
                [
                    *row(
                        [
                            *[
                                nowrite(e, n.removesuffix(" on"), vertical=True)
                                for e, n in h.people[:1]
                            ],
                            *(
                                [
                                    nowrite(h.phone + "_battery_level", "Aku", vertical=True),
                                    nowrite(h.phone + "_connection_type", "Ühendus", vertical=True),
                                ]
                                if h.phone
                                else []
                            ),
                        ]
                    ),
                ],
            ),
            stock_section(
                "Nord Pool toorandmed",
                [
                    *row(
                        [
                            nowrite(
                                "sensor.nord_pool_ee_praegune_hind", "Börs praegu", vertical=True
                            ),
                            nowrite(
                                "sensor.nord_pool_ee_jargmine_hind", "Börs järgmine", vertical=True
                            ),
                            nowrite("sensor.elektri_hind_kokku", "Kokku, 15 min", vertical=True),
                            nowrite(E.FORECAST, "Prognoos katab", vertical=True),
                        ]
                    ),
                    *row(
                        [
                            nowrite(
                                "sensor.nord_pool_ee_madalaim_hind", "Täna madalaim", vertical=True
                            ),
                            nowrite(
                                "sensor.nord_pool_ee_korgeim_hind", "Täna kõrgeim", vertical=True
                            ),
                        ]
                    ),
                ],
                column_span=2,
            ),
        ],
    }


def mode_row(key, timer=False):
    """One mode's settings as grid cells of vertical tiles: fans, setpoint, heater flag, optional timer."""
    cards = [
        stock_tile(f"number.komfovent_{key}_supply_flow", "Sisse", vertical=True),
        stock_tile(f"number.komfovent_{key}_extract_flow", "Välja", vertical=True),
        stock_tile(f"number.komfovent_{key}_temperature", "Sihttemp", vertical=True),
        confirm(
            f"switch.komfovent_{key}_electric_heater",
            "Järelküte",
            "Järelküte selles režiimis. Kindel?",
            vertical=True,
        ),
    ]
    if timer:
        cards.append(stock_tile(f"number.komfovent_{key}_timer", "Kestus min", vertical=True))
    return row(cards)


komfovent_seaded = {
    "title": "Ventilatsiooni seaded",
    "path": "komfovent-seaded",
    "icon": "mdi:tune",
    "type": "sections",
    "subview": True,
    "max_columns": 3,
    "sections": [
        stock_section(
            "Juhtimine",
            [
                label(E.MODE_LABEL, E.MODE, "Režiim"),
                label(
                    "sensor.ventilatsiooni_ajakava", "select.komfovent_scheduler_mode", "Ajakava"
                ),
                stock_tile("switch.komfovent_auto_mode", "Automaatrežiim"),
                confirm(E.VENT_POWER, "Seade sees", "Lülitad kogu ventilatsiooni. Kindel?"),
            ],
        ),
        stock_section(
            "ECO",
            [
                stock_tile(E.ECO, "ECO sees"),
                confirm(
                    "switch.komfovent_eco_heater_blocking",
                    "Kütteblokeering",
                    "Väljalülitamine lubab elektrilise järelkütte. Kindel?",
                    color="green",
                ),
                confirm(
                    "switch.komfovent_eco_free_heating_cooling",
                    "Vaba jahutus",
                    "Suvine vaba jahutus. Sees: soojusvaheti seisab, kui välisõhk on toast jahedam. Talvel peab olema väljas. Kindel?",
                ),
                stock_tile("select.komfovent_eco_heat_recovery", "Soojustagastus"),
                stock_tile("number.komfovent_eco_min_supply_temperature", "Min sissepuhe"),
                stock_tile("number.komfovent_eco_max_supply_temperature", "Max sissepuhe"),
            ],
        ),
        stock_section("Tavaline", mode_row("normal")),
        stock_section("Köök", mode_row("kitchen", timer=True)),
        stock_section("Boost", mode_row("boost")),
        stock_section("Kamin", mode_row("fireplace", timer=True)),
        stock_section("Eemal", mode_row("away")),
        stock_section(
            "Harva kasutatavad režiimid",
            [
                note("Intensiivne"),
                *mode_row("intensive"),
                note("Override"),
                *mode_row("override", timer=True),
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "number.komfovent_override_delay_start", "Viide start", vertical=True
                        ),
                        stock_tile(
                            "number.komfovent_override_delay_stop", "Viide stopp", vertical=True
                        ),
                    ],
                },
                note("Puhkus"),
                {
                    "type": "horizontal-stack",
                    "cards": [
                        stock_tile(
                            "number.komfovent_holidays_temperature", "Sihttemp", vertical=True
                        ),
                        confirm(
                            "switch.komfovent_holidays_electric_heater",
                            "Järelküte",
                            "Järelküte selles režiimis. Kindel?",
                            vertical=True,
                        ),
                        label(
                            "sensor.puhkuse_mikroventilatsioon",
                            "select.komfovent_holidays_micro_ventilation",
                            "Mikroventilatsioon",
                            vertical=True,
                        ),
                    ],
                },
            ],
            column_span=2,
        ),
        stock_section(
            "Hooldus",
            [
                {
                    "type": "button",
                    "name": "Puhaste filtrite kalibreerimine",
                    "icon": "mdi:gesture-tap-button",
                    "tap_action": {
                        "action": "perform-action",
                        "perform_action": "button.press",
                        "target": {"entity_id": "button.komfovent_clean_filters_calibration"},
                        "confirmation": {"text": "Kindel?"},
                    },
                },
                {
                    "type": "button",
                    "name": "Kustuta alarmid",
                    "icon": "mdi:gesture-tap-button",
                    "tap_action": {
                        "action": "perform-action",
                        "perform_action": "button.press",
                        "target": {"entity_id": "button.komfovent_clear_active_alarms"},
                        "confirmation": {"text": "Kindel?"},
                    },
                },
                {
                    "type": "button",
                    "name": "Sea seadme kell",
                    "icon": "mdi:gesture-tap-button",
                    "tap_action": {
                        "action": "perform-action",
                        "perform_action": "button.press",
                        "target": {"entity_id": "button.komfovent_set_system_time"},
                        "confirmation": {"text": "Kindel?"},
                    },
                },
            ],
        ),
    ],
}

soojuspump_seaded = {
    "title": "Soojuspumba seaded",
    "path": "soojuspump-seaded",
    "icon": "mdi:tune",
    "type": "sections",
    "subview": True,
    "max_columns": 2,
    "sections": [
        stock_section(
            "Küte",
            [
                confirm(E.HEATING, "Küte", "Lülitad maja kütte. Kindel?"),
                label("sensor.kutte_reziim", "select.space_heating_operation_mode", "Kütte režiim"),
                stock_tile(
                    E.SHIFT,
                    "Küttevee nihe",
                    features=[{"type": "numeric-input", "style": "buttons"}],
                ),
            ],
        ),
        stock_section(
            "Soe vesi",
            [
                note(f"Siht 55 °C, mitte alla {E.DHW_FLOOR} °C (legionella)."),
                stock_tile(
                    E.DHW,
                    "Boiler",
                    state_content=["current_temperature"],
                    features=[{"type": "target-temperature"}],
                ),
                *dhw_boost_stock(),
            ],
        ),
        stock_section(
            "Hinnajuhtimine",
            [
                stock_tile(E.DHW_AUTO, "Boileri hinnajuhtimine"),
                stock_tile(E.SHADOW_NOTIFY, "Varjuplaani teavitused"),
            ],
        ),
    ],
}


def house3d_view(h, model):
    return {
        "title": "3D",
        "path": E.HOUSE3D_PATH,
        "icon": "mdi:floor-plan",
        "type": "panel",
        "cards": [
            {
                "type": "custom:house3d-card",
                "model": model,
                "views": camera_views(h),
                "stills": camera_stills(h),
            }
        ],
    }
