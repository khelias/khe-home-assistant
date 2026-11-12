"""A3, the first view of the house's Overview, as data (ADR-005, ADR-006, ADR-007).

overview(house, people, model) is the Overview the house saves: dashboard_config.build()'s views
with A3's view in place of Kodu, at Kodu's path, and the 3D view moved last. dashboard_config.build()
itself stays Kodu with 3D first, which the public demo builds.

build(house, people, model) returns A3 as a one-view Lovelace config: the 3D house as
the hero, then the page's title with the outdoor temperature, people, alarms and live faults as
chips, and Elekter, Juhtimine, Kliima and Süsteem as glass cards from cards/khe-cards.js. Every
entity, action and confirmation of Kodu's first page stays on this page; a tap on a value or a
device opens its history sheet. Entity ids, names and confirmation texts come from
dashboard_config (its constants, or Kodu's own first page as dashboard_config.home() builds it);
nothing here spells one, and nothing here changes what dashboard_config builds.

Where each sheet reads its history, measured on the house on 2026-11-12
(`recorder/list_statistic_ids`):

    entity                        source       type
    outdoor, supply, extract,     statistics   mean, min, max (5minute, hour, day)
      humidity, boiler water
    estfeed consumption and cost  statistics   change (hour, day)
    heating leaving water         history      numeric line (no statistics kept)
    pergola light, TV             history      on/off
    ventilation mode              history      the modes but normal count as on
    pergola roof                  none         a group without position: its state is unknown
"""

import copy

import dashboard_config as dc

# One CSS value: three soft tints mixed into HA's own theme background, so it follows light and
# dark with HA (light-dark() would follow the browser's scheme instead; ADR-005 decision 3).
TINTS = [
    ("120% 60% at 12% 0%", 58, "#f2a65e", 62),
    ("100% 70% at 100% 26%", 56, "#5b8fd6", 66),
    ("90% 60% at 24% 100%", 62, "#8fc7a8", 70),
]
BACKGROUND = ", ".join(
    [
        f"radial-gradient({at}, color-mix(in srgb, var(--primary-background-color) {mix}%, {tint})"
        f" 0%, transparent {fade}%)"
        for at, mix, tint, fade in TINTS
    ]
    + ["var(--primary-background-color)"]
)
HERO_HEIGHT = 300
COLUMNS = 3

MEAN = {"source": "statistics", "type": "mean"}
ONOFF = {"source": "history"}


def card(kind, **kw):
    return {"type": "custom:khe-" + kind, **kw}


def tile(entity, name, **kw):
    return card("tile-card", style="a3", entity=entity, name=name, **kw)


def wide(c):
    c["wide"] = True
    c["grid_options"] = {"columns": 12}
    return c


def half(c):
    c["grid_options"] = {"columns": 6}
    return c


def heading(text, path=None):
    return card(
        "heading-card",
        heading=text,
        **({"tap_action": {"action": "navigate", "navigation_path": path}} if path else {}),
        grid_options={"columns": "full"},
    )


def walk(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def acting(home, entity):
    """Kodu's tiles that run a confirmed action on the entity, in page order."""
    return [
        t
        for t in walk(home)
        if t.get("type") == "tile"
        and t.get("entity") == entity
        and "confirmation" in t.get("tap_action", {})
    ]


def modes(home):
    """The ventilation's mode buttons as Kodu has them: name, option and confirmation."""
    out = []
    for t in acting(home, dc.MODE):
        act = t["tap_action"]
        out.append(
            {
                "name": t["name"],
                "option": act["data"]["option"],
                "confirm": act["confirmation"]["text"],
            }
        )
    return out


def boost(home):
    """Kodu's two boost tiles, one per water-heater state, as two A3 tiles: the icon runs the
    confirmed action, the body opens the boiler water's history."""
    out = []
    for t in acting(home, dc.DHW):
        lit = t["color"] != "disabled"
        c = half(
            tile(
                dc.DHW,
                t["name"],
                icon="flame",
                color="orange",
                active=["performance"] if lit else [],
                state_text=[{"attribute": "current_temperature", "label": "Boiler"}],
                icon_tap_action=t["tap_action"],
                icon_label=t["name"],
                history={"entity": dc.BOILER_TEMP, **MEAN, "unit": "°C", "title": "Boileri vesi"},
                visibility=t["visibility"],
            )
        )
        out.append(c)
    return out


def tv(home):
    (off,) = acting(home, dc.TV)
    return half(
        tile(
            dc.TV,
            "Teler",
            icon="tv",
            color="indigo",
            active=["on", "playing", "paused", "idle", "standby", "buffering"],
            state_text=[{"entity": dc.TV_APP}],
            corner={"icon": "power", "label": off["name"], "tap_action": off["tap_action"]},
            history={**ONOFF, "view": "/lovelace/teler"},
        )
    )


def system(h):
    items = [{"entity": e, "name": n, "ok": {"state": dc.NET_OK}} for e, n in dc.NET] + [
        {"entity": dc.WAN, "name": "Internet", "value": True},
        {"entity": dc.NVR, "name": "NVR ketas", "ok": {"state": ["OK"]}},
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
    faults = [{"entity": e, "name": n} for e, n in dc.FAULTS] + [
        {"entity": dc.STALE, "name": "Estfeedi andmed hilinevad", "bad": "off"}
    ]
    return card(
        "chips-card",
        style="a3",
        title="Kodu",
        outdoor={"entity": dc.OUTDOOR, "name": "Õues", "decimals": 1, "history": MEAN},
        people=[{"entity": e, "name": n.removesuffix(" on")} for e, n in h.people],
        alarms=[{"entity": e, "name": n} for e, n in dc.ALARMS],
        faults=faults,
        grid_options={"columns": "full"},
    )


def price():
    thresholds = dc.price_chart["series"][0]["color_threshold"]
    return card(
        "price-card",
        style="a3",
        level=dc.PRICE_LEVEL,
        forecast=dc.FORECAST,
        bands=[thresholds[1]["value"], thresholds[2]["value"]],
        windows=[
            {"entity": dc.WASH, "name": "Pesu 4 h", "icon": "wash"},
            {"entity": dc.SAUNA, "name": "Saun 2 h", "icon": "sauna"},
        ],
        tomorrow=dc.TOMORROW,
        tomorrow_flag=dc.TOMORROW_READY,
        usage=[{"entity": e, "name": n} for e, n in dc.USAGE],
        # Kodu's two 7-day charts are this sheet's 7-day range.
        usage_history={
            "entity": dc.CONSUMPTION,
            "cost": dc.COST,
            "source": "statistics",
            "type": "change",
        },
        grid_options={"columns": "full"},
    )


def value(entity, name, icon, color, caption, history, **kw):
    return half(
        tile(
            entity,
            name,
            layout="value",
            icon=icon,
            color=color,
            caption=caption,
            history=history,
            **kw,
        )
    )


def cover_button(name, state, service):
    """A roof button: pressed while the roof is in its state, a tap runs the service."""
    act = {"action": "perform-action", "perform_action": service, "target": {"entity_id": dc.ROOF}}
    return {"name": name, "state": state, "tap_action": act}


def section(cards, span=1):
    return {"type": "grid", "column_span": span, "cards": cards}


def build(house, people, model):
    h = dc.House(house, people)
    home = dc.home(h)
    hero = (
        [
            {
                "type": "custom:house3d-card",
                "model": model,
                "height": HERO_HEIGHT,
                "grid_options": {"columns": "full"},
            }
        ]
        if model is not None
        else []
    )
    mode_names = [m["option"] for m in modes(home)]
    controls = [
        heading("Juhtimine"),
        wide(
            tile(
                dc.ROOF,
                dc.ROOF_NAME,
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
        wide(
            tile(
                dc.PERGOLA_LIGHT,
                "Pergola valgus",
                icon="bulb",
                color="yellow",
                icon_tap_action={"action": "toggle"},
                icon_label="Pergola valgus sisse või välja",
                slider={"attribute": "brightness"},
                history={**ONOFF, "view": "/lovelace/pergola"},
            )
        ),
        wide(
            tile(
                dc.MODE,
                "Ventilatsioon",
                icon="vent",
                color="blue",
                active=["*"],
                state_text=[{"entity": dc.MODE_LABEL}],
                modes=modes(home),
                history={
                    **ONOFF,
                    "active": [o for o in mode_names if o != "normal"],
                    "view": "/lovelace/ventilatsioon",
                },
            )
        ),
        *boost(home),
        tv(home),
    ]
    climate = [
        heading("Kliima", "/lovelace/soojuspump"),
        value(
            dc.LEAVING,
            "Küttevesi",
            "waves",
            "heat",
            "küttevesi",
            {"source": "history", "numeric": True},
            label=[{"entity": dc.HEATING, "label": "Küte"}],
            decimals=1,
        ),
        value(dc.HUMIDITY, "Niiskus", "drop", "blue", "toaõhk", MEAN),
        value(dc.SUPPLY, "Sissepuhe", "supply", "teal", "tuppa tulev õhk", MEAN, decimals=1),
        value(dc.EXTRACT, "Väljatõmme", "extract", "teal", "toast väljuv õhk", MEAN, decimals=1),
        system(h),
    ]
    view = {
        "title": "Kodu",
        "path": "kodu",
        "icon": "mdi:home-heart",
        "type": "sections",
        "max_columns": COLUMNS,
        "background": BACKGROUND,
        "sections": [
            section([*hero, chips(h)], COLUMNS),
            section([heading("Elekter", "/lovelace/energia"), price()]),
            section(controls),
            section(climate),
        ],
    }
    return copy.deepcopy({"title": "Kodu", "views": [view]})


def overview(house, people, model):
    """The house's Overview: dashboard_config.build() with A3's view in place of the `kodu` view
    and the 3D view (`maja-3d`) last. A fresh copy every call."""
    config = dc.build(house, people, model)
    a3 = build(house, people, model)["views"][0]
    views = [a3 if v["path"] == "kodu" else v for v in config["views"]]
    config["views"] = sorted(views, key=lambda v: v["path"] == "maja-3d")
    return config
