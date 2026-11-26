"""A3 front page (Kodu, ADR-005, ADR-006, ADR-010, ADR-018)."""

import copy

from . import entities as E
from .primitives import (
    BACKGROUND,
    BELOW_FOUR,
    COLUMNS,
    FOUR,
    HERO_HEIGHT,
    MEAN,
    NARROW,
    NOT_THREE,
    ONOFF,
    THREE,
    WIDE,
    around,
    boost_tiles,
    card,
    cover_button,
    half,
    heading,
    pergola_light_tile,
    screen,
    screened,
    section,
    tile,
    value,
    vent_tile,
    wide,
)
from .security import camera_views


def tv_tile():
    return half(
        tile(
            E.TV,
            "Teler",
            icon="tv",
            color="indigo",
            active=["on", "playing", "paused", "idle", "standby", "buffering"],
            state_text=[{"entity": E.TV_APP}],
            corner={
                "icon": "power",
                "label": "Lülita välja",
                "tap_action": {
                    "action": "perform-action",
                    "perform_action": "media_player.turn_off",
                    "target": {"entity_id": E.TV},
                    "data": {},
                    "confirmation": {"text": "Lülitad teleri välja?"},
                },
            },
            history={**ONOFF, "view": "/lovelace/teler"},
        )
    )


def system(h):
    items = [{"entity": e, "name": n, "ok": {"state": E.NET_OK}} for e, n in E.NET] + [
        {"entity": E.WAN, "name": "Internet", "value": True},
        {"entity": E.NVR, "name": "NVR ketas", "ok": {"state": ["OK"]}},
    ]
    if h.phone:
        items.append(
            {
                "entity": h.phone + "_battery_level",
                "name": "Telefon",
                "value": True,
                "ok": {"above": 30},
            }
        )
    updates = [{"entity": u, "name": n or u} for u, n in h.updates]
    return card(
        "status-card",
        style="a3",
        title="Süsteem",
        items=items,
        updates=updates,
        tap_action={"action": "navigate", "navigation_path": "/lovelace/susteem"},
        grid_options={"columns": "full"},
    )


def chips(h):
    faults = [{"entity": e, "name": n} for e, n in E.FAULTS] + [
        {"entity": E.STALE, "name": "Estfeedi andmed hilinevad", "bad": "off"}
    ]
    return card(
        "chips-card",
        style="a3",
        title="Kodu",
        outdoor={"entity": E.OUTDOOR, "name": "Õues", "decimals": 1, "history": MEAN},
        people=[{"entity": e, "name": n.removesuffix(" on")} for e, n in h.people],
        alarms=[{"entity": e, "name": n} for e, n in E.ALARMS],
        faults=faults,
        grid_options={"columns": "full"},
    )


def price():
    return card(
        "price-card",
        style="a3",
        level=E.PRICE_LEVEL,
        forecast=E.FORECAST,
        bands=list(E.PRICE_BANDS),
        windows=[
            {"entity": E.WASH, "name": "Pesu 4 h", "icon": "wash"},
            {"entity": E.SAUNA, "name": "Saun 2 h", "icon": "sauna"},
        ],
        tomorrow=E.TOMORROW,
        tomorrow_flag=E.TOMORROW_READY,
        usage=[{"entity": e, "name": n} for e, n in E.USAGE],
        usage_history={
            "entity": E.CONSUMPTION,
            "cost": E.COST,
            "source": "statistics",
            "type": "change",
        },
        grid_options={"columns": "full"},
    )


def first(hero, title_chips):
    """The first section below four columns: the title and chips under the hero in one column;
    from two columns (WIDE, the hero beside the cards) the title over the hero and the chips
    under it."""
    title, *middle, chips_part = around(hero, title_chips)
    return [screen(title, WIDE), *middle, screen(chips_part, WIDE), screen(title_chips, NARROW)]


def kodu(h, model):
    hero = (
        [
            {
                "type": "custom:house3d-card",
                "model": model,
                "views": camera_views(h),
                "height": HERO_HEIGHT,
                "stretch": True,
                "full_view": "/lovelace/" + E.HOUSE3D_PATH,
                "grid_options": {"columns": "full"},
            }
        ]
        if model is not None
        else []
    )
    controls = [
        heading("Juhtimine"),
        wide(
            tile(
                E.ROOF,
                E.ROOF_NAME,
                icon="roof",
                color="teal",
                active=["open"],
                hide_state=True,
                buttons=[
                    cover_button("Ava", "open", "cover.open_cover"),
                    cover_button("Sulge", "closed", "cover.close_cover"),
                ],
            )
        ),
        pergola_light_tile("Pergola valgus", "/lovelace/pergola"),
        vent_tile([{"entity": E.MODE_LABEL}], "/lovelace/ventilatsioon"),
        *boost_tiles(),
        tv_tile(),
    ]
    climate = [
        heading("Kliima", "/lovelace/soojuspump"),
        value(
            E.LEAVING,
            "Küttevesi",
            "waves",
            "heat",
            "küttevesi",
            {"source": "history", "numeric": True},
            label=[{"entity": E.HEATING, "label": "Küte"}],
            decimals=1,
        ),
        value(E.HUMIDITY, "Niiskus", "drop", "blue", "toaõhk", MEAN),
        value(E.SUPPLY, "Sissepuhe", "supply", "teal", "tuppa tulev õhk", MEAN, decimals=1),
        value(E.EXTRACT, "Väljatõmme", "extract", "teal", "toast väljuv õhk", MEAN, decimals=1),
        system(h),
    ]
    elekter = [heading("Elekter", "/lovelace/energia"), price()]
    if hero:
        # ADR-010 by default, ADR-018 from four columns and on three. HA has no span per
        # width, so every layout is emitted under screen visibility conditions.
        title_chips = chips(h)
        left_half = around([{**c, "stretch": "beside"} for c in hero], title_chips)
        sections = [
            section(screened(first(hero, title_chips), BELOW_FOUR, NOT_THREE), 1, 2),
            section(screened(left_half, FOUR), 2, 3),
            section(screened(around(hero, title_chips), THREE), 2),
            section(screened(elekter, NOT_THREE), rows=2),
            section(screened(elekter, THREE)),
            section(screened(climate, THREE), 2),
            section(controls),
            section(screened(climate, BELOW_FOUR, NOT_THREE)),
            section(screened(climate, FOUR), 2),
        ]
        columns = COLUMNS
    else:
        sections = [
            section([chips(h)], 3),
            section(elekter),
            section(controls),
            section(climate),
        ]
        columns = 3
    return {
        "title": "Kodu",
        "path": "kodu",
        "icon": "mdi:home-heart",
        "type": "sections",
        "max_columns": columns,
        "background": BACKGROUND,
        "sections": sections,
    }


def build(house, people, model):
    """A3 as a one-view Lovelace config, a fresh copy every call."""
    h = E.House(house, people)
    return copy.deepcopy({"title": "Kodu", "views": [kodu(h, model)]})
