"""Climate views in A3's look: Soojuspump (ADR-011), Ventilatsioon and Pergola (ADR-014)."""

from . import entities as E
from .primitives import (
    BACKGROUND,
    MEAN,
    boost_tiles,
    card,
    heading,
    pergola_light_tile,
    roof_action,
    section,
    settings_row,
    tile,
    vent_tile,
    wide,
)

ON = {"state": "on"}


def soojuspump():
    """Soojuspump: the status, Küte with the shift, Soe vesi with the boost, the boiler's
    electricity and the settings row."""
    faults = [{"entity": e, "name": n} for e, n in E.FAULTS if e in (E.HEATING_FAULT, E.TANK_FAULT)]
    boosts = [
        wide({**t, "state_text": "Käib, lõpeb ise, kui vesi on soe" if t["active"] else "Väljas"})
        for t in boost_tiles()
    ]
    return {
        "title": "Soojuspump",
        "path": "soojuspump",
        "icon": "mdi:heat-pump",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Soojuspump",
                        faults=faults,
                        status={
                            "entity": E.HEATING,
                            "ok": "Korras, küte ja boiler töötavad",
                            "off": "Küte väljas",
                        },
                        grid_options={"columns": "full"},
                    ),
                    heading("Küte"),
                    card(
                        "reading-card",
                        label="Sees",
                        entity=E.PANEL_TEMP,
                        decimals=1,
                        note={"range": True},
                        chip={
                            "entity": E.HEATING,
                            "on": "Küte sees",
                            "off": "Küte väljas",
                            "fault": E.HEATING_FAULT,
                            "fault_text": "Küte seisab",
                        },
                        line={
                            "statistic": E.PANEL_TEMP,
                            "hours": 48,
                            "color": "orange",
                            "aria": "Toatemperatuur 48 tundi",
                        },
                        cells=[
                            {
                                "entity": E.LEAVING,
                                "name": "Küttevesi",
                                "caption": "pumbast välja",
                                "color": "heat",
                                "history": MEAN,
                            },
                            {
                                "entity": E.PUMP_OUTDOOR,
                                "name": "Väljas",
                                "caption": "pumba andur",
                                "color": "teal",
                                "history": MEAN,
                            },
                        ],
                        stepper={"entity": E.SHIFT, "name": "Küttevee nihe"},
                        grid_options={"columns": "full"},
                    ),
                    heading("Soe vesi"),
                    card(
                        "reading-card",
                        label="Boileris",
                        entity=E.BOILER_TEMP,
                        decimals=0,
                        note={"target": {"entity": E.DHW, "attribute": "temperature"}},
                        line={
                            "statistic": E.BOILER_TEMP,
                            "hours": 48,
                            "color": "blue",
                            "floor": E.DHW_FLOOR,
                            "name": "vesi",
                            "aria": "Boileri vesi 48 tundi",
                        },
                        grid_options={"columns": "full"},
                    ),
                    *boosts,
                ]
            ),
            section(
                [
                    heading("Boileri elekter", "/lovelace/energia"),
                    card(
                        "days-card",
                        days=16,
                        series=[
                            {
                                "name": "kWh",
                                "statistic": E.BOILER_TODAY,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "orange",
                                "caption": "kWh päevas keskmiselt",
                                "aria": "Boileri elekter päevade kaupa",
                                "title": "Boileri elekter",
                                "more": E.BOILER_TODAY,
                            }
                        ],
                        cells=[
                            {"name": "Täna", "entity": E.BOILER_TODAY, "note": "päev pole läbi"},
                            {"name": "Sel kuul", "entity": E.BOILER_MONTH, "share_of": E.MONTH},
                            {"entity": E.BOILER_MONTH, "last": "month", "note": "terve kuu"},
                        ],
                        foot="Küte oma elektrit ei mõõda; kogu maja on Energias.",
                        grid_options={"columns": "full"},
                    ),
                    settings_row(
                        E.HEATING,
                        "Küte välja, kütte režiim, boileri siht",
                        "/lovelace/soojuspump-seaded",
                    ),
                ]
            ),
        ],
    }


def vent_cell(entity, name, caption, **kw):
    """A reading card's cell that opens its hourly means."""
    return {
        "entity": entity,
        "name": name,
        "caption": caption,
        "color": "teal",
        "history": MEAN,
        **kw,
    }


def ventilatsioon():
    """Ventilatsioon: the status, the modes, the room air as a 48-hour line, the unit, whether it
    pays for itself by the day, its alarms and the settings row."""
    faults = [{"entity": e, "name": n} for e, n in E.FAULTS if e in (E.VENT_FAULT, E.VENT_WARNING)]
    return {
        "title": "Ventilatsioon",
        "path": "ventilatsioon",
        "icon": "mdi:fan",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Ventilatsioon",
                        faults=faults,
                        notes=[{"entity": E.FLOW_DOWN, "name": "Õhuvool alandatud", "icon": "fan"}],
                        status={
                            "entity": E.VENT_POWER,
                            "ok": "Korras, vigu ega hoiatusi pole",
                            "off": "Seade väljas",
                        },
                        grid_options={"columns": "full"},
                    ),
                    vent_tile([{"entity": E.MODE_LABEL}, {"entity": E.ECO, "label": "ECO"}]),
                    heading("Toaõhk"),
                    card(
                        "reading-card",
                        label="Niiskus",
                        entity=E.HUMIDITY,
                        decimals=0,
                        note={"range": True},
                        line={
                            "statistic": E.HUMIDITY,
                            "hours": 48,
                            "color": "teal",
                            "aria": "Niiskus 48 tundi",
                        },
                        cells=[
                            vent_cell(E.SUPPLY, "Tuppa", "sissepuhe", decimals=1),
                            vent_cell(E.EXTRACT, "Toast", "väljatõmme", decimals=1),
                            vent_cell(E.OUTDOOR, "Väljas", "välisõhk", decimals=1),
                        ],
                        grid_options={"columns": "full"},
                    ),
                    heading("Seade"),
                    card(
                        "reading-card",
                        label="Kasutegur",
                        entity=E.EFFICIENCY,
                        decimals=0,
                        note={"text": "soojusvaheti"},
                        meter={
                            "entity": E.FILTER,
                            "name": "Filter",
                            "note": "ummistunud",
                            "max": 100,
                        },
                        cells=[
                            vent_cell(
                                E.RECOVERY,
                                "Tagastab",
                                "soojust praegu",
                                scale=0.001,
                                unit="kW",
                                decimals=1,
                                color="green",
                            ),
                            vent_cell(E.VENT_POWER_USE, "Võtab", "elektrit praegu", color="indigo"),
                            vent_cell(E.EXCHANGER, "Vaheti", "lahti", color="blue"),
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
            section(
                [
                    heading("Kas tasub end ära"),
                    card(
                        "days-card",
                        days=16,
                        series=[
                            {
                                "name": "kWh",
                                "legend": "tagastatud soojus",
                                "statistic": E.RECOVERED,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "green",
                                "headline": "ratio",
                                "caption": "rohkem soojust tagasi, kui seade elektrit võtab",
                                "caption_below": "vähem soojust tagasi, kui seade elektrit võtab",
                                "aria": "Tagastatud soojus ja seadme elekter päevade kaupa",
                                "title": "Tagastatud soojus",
                                "more": E.RECOVERED,
                                "overlay": {
                                    "statistic": E.AHU_ENERGY,
                                    "type": "change",
                                    "name": "seadme elekter",
                                    "unit": "kWh",
                                    "decimals": 2,
                                },
                            }
                        ],
                        cells=[
                            {"kind": "avg", "name": "Tagastas", "note": "päevas keskmiselt"},
                            {
                                "name": "Elekter sel kuul",
                                "entity": E.VENT_MONTH,
                                "unit": "kWh",
                                "decimals": 1,
                                "note_last": "last_period",
                            },
                            {
                                "name": "Järelküte",
                                "entity": E.HEATER_MONTH,
                                "unit": "kWh",
                                "note": "sel kuul",
                                "bad_above": 0,
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                    wide(
                        tile(
                            E.ACTIVE_ALARMS,
                            "Aktiivsed alarmid",
                            icon="alert",
                            color="red",
                            active=["*"],
                            visibility=[
                                {"condition": "state", "entity": E.ACTIVE_ALARMS, "state_not": ""}
                            ],
                        )
                    ),
                    settings_row(
                        E.MODE,
                        "Ajakava, ECO, kamin, eemal, taimerid",
                        "/lovelace/komfovent-seaded",
                    ),
                ]
            ),
        ],
    }


def when(entity, label, *conditions, attribute=None):
    """A tile's second-line part: a moment of `entity` (its state, or `attribute`) in HA's zone
    after `label`, shown while each condition holds."""
    p = {"entity": entity, "format": "when", "label": label, "if": list(conditions)}
    return {**p, "attribute": attribute} if attribute else p


def rain_cell(entity, name, decimals=1, **kw):
    """A forecast card's cell that opens its hourly means."""
    return {"entity": entity, "name": name, "decimals": decimals, "history": MEAN, **kw}


def pergola():
    """Pergola: whether it rains, the roof's three commands, the light with its tone, the next
    hours' forecast with the rain and the outdoor temperature, the two rules with their switches
    and when they last acted, and the settings row."""
    return {
        "title": "Pergola",
        "path": "pergola",
        "icon": "mdi:awning-outline",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Pergola",
                        status={"entity": E.RAIN_NOW, "above": 0, "on": "Sajab", "ok": "Kuiv"},
                        grid_options={"columns": "full"},
                    ),
                    wide(
                        tile(
                            E.ROOF,
                            "Katus",
                            icon="roof",
                            color="teal",
                            active=[],
                            state_text="Poole peal peata Stopiga · asend pole teada",
                            modes=[
                                {"name": "Ava", "tap_action": roof_action("cover.open_cover")},
                                {"name": "Stopp", "tap_action": roof_action("cover.stop_cover")},
                                {"name": "Sulge", "tap_action": roof_action("cover.close_cover")},
                            ],
                        )
                    ),
                    pergola_light_tile(
                        "Valgus",
                        modes_entity=E.TONE,
                        modes=[{"name": t, "option": t} for t in E.TONES],
                        state_text=[
                            when(E.LIGHT_OFF, "kustub", ON, {**ON, "entity": E.LIGHT_AUTO})
                        ],
                    ),
                    heading("Ilm"),
                    card(
                        "forecast-card",
                        entity=E.WEATHER,
                        hours=14,
                        cells=[
                            rain_cell(
                                E.RAIN_NOW,
                                "Praegu",
                                color="blue",
                                note_above={"value": 0, "above": "sajab", "below": "ei saja"},
                            ),
                            rain_cell(E.RAIN_2H, "Kahe tunniga", color="blue", caption="sademeid"),
                            rain_cell(E.OUTDOOR, "Väljas", color="teal", caption="maja juures"),
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
            section(
                [
                    heading("Mida see ise teeb"),
                    wide(
                        tile(
                            E.ROOF_AUTO,
                            "Vihm sulgeb katuse",
                            icon="rain",
                            color="blue",
                            switch=True,
                            state_text=[
                                when(E.RAIN_RULE, "viimati", ON, attribute="last_triggered")
                            ],
                        )
                    ),
                    wide(
                        tile(
                            E.LIGHT_AUTO,
                            "Õhtune valgus",
                            icon="sunset",
                            color="orange",
                            switch=True,
                            state_text=[
                                when(E.SUNSET_RULE, "süttis", ON, attribute="last_triggered"),
                                when(E.LIGHT_OFF, "kustub", ON),
                            ],
                        )
                    ),
                    settings_row(
                        E.ROOF_AUTO,
                        "Pooled eraldi, vihmateade, õhtune valgus",
                        "/lovelace/pergola-seaded",
                    ),
                ]
            ),
        ],
    }
