"""A3, the house's Overview in A3's look, as data (ADR-005 to ADR-008, ADR-010, ADR-011).

overview(house, people, model) is the Overview the house saves: dashboard_config.build()'s views
with A3's views in place of Kodu's at the same paths (`kodu`, `energia`, `soojuspump`,
`ventilatsioon`) and the 3D view moved last, which the public demo builds too (ADR-012). dashboard_config.build() itself
stays Kodu with 3D first, the house's fallback. energia() is Energia: the month, the days, who used what and the price, from daily
statistics. soojuspump(h) is Soojuspump: the status, the indoor and boiler temperatures as 48-hour
lines from hourly statistics, the heating shift as a stepper, the boost and the boiler's
electricity by the day. ventilatsioon(h) is Ventilatsioon: the status, Kodu's mode tile, the room
air as a 48-hour line, the unit with its filter as a meter, and whether it pays for itself as the
heat it recovers against its electricity by the day.

build(house, people, model) returns A3 as a one-view Lovelace config: the 3D house as
the hero, then the page's title with the outdoor temperature, people, alarms and live faults as
chips, and Elekter, Juhtimine, Kliima and Süsteem as glass cards from cards/khe-cards.js. Every
entity, action and confirmation of Kodu's first page stays on this page; a tap on a value or a
device opens its history sheet.

The layout follows HA's column count (ADR-010): one column stacks the hero with the title, Elekter,
Juhtimine and Kliima; from two columns the hero and the title sit on the left, two rows high, and
the hero stretches to the tallest section beside it. Two columns: Elekter beside the hero,
Juhtimine and Kliima under them. Three: Elekter and Juhtimine beside it, Kliima under Juhtimine.
Four: all three beside it. Entity ids, names and confirmation texts come from
dashboard_config (its constants, or Kodu's own first page as dashboard_config.home() builds it);
nothing here spells one, and nothing here changes what dashboard_config builds.

Where each sheet reads its history, measured on the house on 2026-11-12
(`recorder/list_statistic_ids`):

    entity                        source       type
    outdoor, supply, extract,     statistics   mean, min, max (5minute, hour, day)
      humidity, boiler water
    estfeed consumption and cost  statistics   change (hour, day)
    heating leaving water,        history      numeric line (no statistics kept)
      the pump's outdoor sensor
    indoor panel, boiler water    statistics   mean (hour), Soojuspump's 48-hour lines
    boiler energy today           statistics   change (day), Soojuspump's 16 days
    pergola light, TV             history      on/off
    ventilation mode              history      the modes but normal count as on
    pergola roof                  none         a group without position: its state is unknown
    boiler, ventilation and       statistics   change (hour, day), Energia's split rows
      afterheater this month
    estfeed price                 statistics   mean, max (day), Energia's price bars
    the unit's recovered heat     statistics   change (day), Ventilatsioon's 16 days and ratio
      and its own electricity
    recovery, power, exchanger,   statistics   mean (5minute, hour, day), Ventilatsioon's cells
      efficiency, filter
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
COLUMNS = 4
# HA's sections view gets a second column at 736 px of content: two 320 px columns, a 32 px gap
# and 32 px of padding each side. HA's open sidebar narrows the content, so between 870 and 990 px
# the wide order can show in one column.
WIDE = "(min-width: 736px)"
NARROW = "not all and (min-width: 736px)"

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


def vent_tile(home, state_text, view=None):
    """Kodu's ventilation modes as one wide A3 tile, Kodu's confirmations; the sheet counts the
    modes but normal as on, and links to `view` when it has one."""
    ms = modes(home)
    history = {**ONOFF, "active": [m["option"] for m in ms if m["option"] != "normal"]}
    return wide(
        tile(
            dc.MODE,
            "Ventilatsioon",
            icon="vent",
            color="blue",
            active=["*"],
            state_text=state_text,
            modes=ms,
            history={**history, "view": view} if view else history,
        )
    )


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


def section(cards, span=1, rows=1):
    s = {"type": "grid", "column_span": span, "cards": cards}
    if rows > 1:
        s["row_span"] = rows
    return s


def first(hero, title_chips):
    """The first section: the title and chips under the hero in one column; from two columns
    (WIDE, the hero beside the cards) the title over the hero and the chips under it."""
    if not hero:
        return [title_chips]

    def shown(c, query, **kw):
        return {**c, **kw, "visibility": [{"condition": "screen", "media_query": query}]}

    return [
        shown(title_chips, WIDE, part="title"),
        *hero,
        shown(title_chips, WIDE, part="chips"),
        shown(title_chips, NARROW),
    ]


def build(house, people, model):
    h = dc.House(house, people)
    home = dc.home(h)
    hero = (
        [
            {
                "type": "custom:house3d-card",
                "model": model,
                "views": dc.camera_views(h),
                "height": HERO_HEIGHT,
                "stretch": True,
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
        vent_tile(home, [{"entity": dc.MODE_LABEL}], "/lovelace/ventilatsioon"),
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
    # with a hero, the first section and Elekter are two rows high beside the other two; without
    # one, three columns hold the three sections under the title
    columns, span, rows = (COLUMNS, 1, 2) if hero else (3, 3, 1)
    view = {
        "title": "Kodu",
        "path": "kodu",
        "icon": "mdi:home-heart",
        "type": "sections",
        "max_columns": columns,
        "background": BACKGROUND,
        "sections": [
            section(first(hero, chips(h)), span, rows),
            section([heading("Elekter", "/lovelace/energia"), price()], rows=rows),
            section(controls),
            section(climate),
        ],
    }
    return copy.deepcopy({"title": "Kodu", "views": [view]})


def energia():
    """Energia in A3's look (ADR-007, ADR-008): the month, the days, who used what and the price."""
    thresholds = dc.price_chart["series"][0]["color_threshold"]
    return {
        "title": dc.energy["title"],
        "path": dc.energy["path"],
        "icon": dc.energy["icon"],
        "type": "sections",
        "max_columns": dc.energy["max_columns"],
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "month-card",
                        title="Energia",
                        month=dc.MONTH,
                        last_month=dc.LAST_MONTH,
                        today=dc.TODAY,
                        yesterday=dc.YESTERDAY,
                        consumption=dc.CONSUMPTION,
                        usage_history={
                            "entity": dc.CONSUMPTION,
                            "cost": dc.COST,
                            "source": "statistics",
                            "type": "change",
                        },
                        grid_options={"columns": "full"},
                    ),
                    heading("Päevad", "/energy"),
                    card(
                        "days-card",
                        days=31,
                        cutoff=dc.CONSUMPTION,
                        series=[
                            {
                                "name": "kWh",
                                "statistic": dc.CONSUMPTION,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "indigo",
                                "caption": "kWh päevas keskmiselt",
                                "aria": "Tarbimine päevade kaupa",
                                "today": {"entity": dc.TODAY},
                            },
                            {
                                "name": "Eurod",
                                "statistic": dc.COST,
                                "type": "change",
                                "unit": "€",
                                "decimals": 2,
                                "color": "teal",
                                "caption": "€ päevas keskmiselt, ilma kuutasudeta",
                                "aria": "Kulu päevade kaupa",
                                "today": {"entity": dc.TODAY, "attribute": "kulu"},
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
            section(
                [
                    heading("Kes võtab sel kuul"),
                    card(
                        "split-card",
                        total=dc.MONTH,
                        fresh=dc.STALE,
                        parts=[
                            {
                                "entity": dc.BOILER_MONTH,
                                "name": "Boiler",
                                "icon": "flame",
                                "color": "orange",
                                "last": "month",
                                "view": "/lovelace/soojuspump",
                            },
                            {
                                "entity": dc.VENT_MONTH,
                                "name": "Ventilatsioon",
                                "icon": "vent",
                                "color": "blue",
                                "last": "last_period",
                                "view": "/lovelace/ventilatsioon",
                            },
                            {
                                "entity": dc.HEATER_MONTH,
                                "name": "Järelküte",
                                "icon": "thermometer",
                                "color": "red",
                                "last": "last_period",
                                "hide_zero": True,
                                "view": "/lovelace/ventilatsioon",
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                    heading("Hind 30 päeva"),
                    card(
                        "days-card",
                        days=30,
                        series=[
                            {
                                "name": "Hind",
                                "statistic": dc.PRICE_STAT,
                                "type": "mean",
                                "peak": True,
                                "scale": 100,
                                "decimals": 1,
                                "bands": [thresholds[1]["value"], thresholds[2]["value"]],
                                "unit": "senti/kWh",
                                "caption": "senti/kWh keskmiselt, kõigi tasudega",
                                "aria": "Elektri hinna päeva keskmine ja kalleim tund",
                            }
                        ],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
        ],
    }


def soojuspump(h):
    """Soojuspump in A3's look (ADR-007, ADR-011): the status, Küte with the shift, Soe vesi with
    the boost, the boiler's electricity and the settings row."""
    home = dc.home(h)
    faults = [
        {"entity": e, "name": n} for e, n in dc.FAULTS if e in (dc.HEATING_FAULT, dc.TANK_FAULT)
    ]
    # full width in a wide tile's row here, Kodu keeps them half; the water's temperature is the
    # reading above them, so they say what the boost does instead
    boost_tiles = [
        wide({**t, "state_text": "Käib, lõpeb ise, kui vesi on soe" if t["active"] else "Väljas"})
        for t in boost(home)
    ]
    sp = dc.soojuspump
    return {
        "title": sp["title"],
        "path": sp["path"],
        "icon": sp["icon"],
        "type": "sections",
        "max_columns": sp["max_columns"],
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title=sp["title"],
                        faults=faults,
                        status={
                            "entity": dc.HEATING,
                            "ok": "Korras, küte ja boiler töötavad",
                            "off": "Küte väljas",
                        },
                        grid_options={"columns": "full"},
                    ),
                    heading("Küte"),
                    card(
                        "reading-card",
                        label="Sees",
                        entity=dc.PANEL_TEMP,
                        decimals=1,
                        note={"range": True},
                        chip={
                            "entity": dc.HEATING,
                            "on": "Küte sees",
                            "off": "Küte väljas",
                            "fault": dc.HEATING_FAULT,
                            "fault_text": "Küte seisab",
                        },
                        line={
                            "statistic": dc.PANEL_TEMP,
                            "hours": 48,
                            "color": "orange",
                            "aria": "Toatemperatuur 48 tundi",
                        },
                        cells=[
                            {
                                "entity": dc.LEAVING,
                                "name": "Küttevesi",
                                "caption": "pumbast välja",
                                "color": "heat",
                                "history": MEAN,
                            },
                            {
                                "entity": dc.PUMP_OUTDOOR,
                                "name": "Väljas",
                                "caption": "pumba andur",
                                "color": "teal",
                                "history": MEAN,
                            },
                        ],
                        stepper={"entity": dc.SHIFT, "name": "Küttevee nihe"},
                        grid_options={"columns": "full"},
                    ),
                    heading("Soe vesi"),
                    card(
                        "reading-card",
                        label="Boileris",
                        entity=dc.BOILER_TEMP,
                        decimals=0,
                        note={"target": {"entity": dc.DHW, "attribute": "temperature"}},
                        line={
                            "statistic": dc.BOILER_TEMP,
                            "hours": 48,
                            "color": "blue",
                            "floor": dc.DHW_FLOOR,
                            "name": "vesi",
                            "aria": "Boileri vesi 48 tundi",
                        },
                        grid_options={"columns": "full"},
                    ),
                    *boost_tiles,
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
                                "statistic": dc.BOILER_TODAY,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "orange",
                                "caption": "kWh päevas keskmiselt",
                                "aria": "Boileri elekter päevade kaupa",
                            }
                        ],
                        cells=[
                            {"name": "Täna", "entity": dc.BOILER_TODAY, "note": "päev pole läbi"},
                            {"name": "Sel kuul", "entity": dc.BOILER_MONTH, "share_of": dc.MONTH},
                            {"entity": dc.BOILER_MONTH, "last": "month", "note": "terve kuu"},
                        ],
                        foot="Küte oma elektrit ei mõõda; kogu maja on Energias.",
                        grid_options={"columns": "full"},
                    ),
                    wide(
                        tile(
                            dc.HEATING,
                            "Seaded",
                            icon="tune",
                            active=[],
                            state_text="Küte välja, kütte režiim, boileri siht",
                            chevron=True,
                            tap_action={
                                "action": "navigate",
                                "navigation_path": "/lovelace/soojuspump-seaded",
                            },
                        )
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


def ventilatsioon(h):
    """Ventilatsioon in A3's look (ADR-007, ADR-008, ADR-011): the status, the modes, the room air
    as a 48-hour line, the unit, whether it pays for itself by the day, its alarms and the
    settings row."""
    home = dc.home(h)
    v = dc.ventilatsioon
    faults = [
        {"entity": e, "name": n} for e, n in dc.FAULTS if e in (dc.VENT_FAULT, dc.VENT_WARNING)
    ]
    return {
        "title": v["title"],
        "path": v["path"],
        "icon": v["icon"],
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title=v["title"],
                        faults=faults,
                        notes=[
                            {"entity": dc.FLOW_DOWN, "name": "Õhuvool alandatud", "icon": "fan"}
                        ],
                        status={
                            "entity": dc.VENT_POWER,
                            "ok": "Korras, vigu ega hoiatusi pole",
                            "off": "Seade väljas",
                        },
                        grid_options={"columns": "full"},
                    ),
                    vent_tile(
                        home, [{"entity": dc.MODE_LABEL}, {"entity": dc.ECO, "label": "ECO"}]
                    ),
                    heading("Toaõhk"),
                    card(
                        "reading-card",
                        label="Niiskus",
                        entity=dc.HUMIDITY,
                        decimals=0,
                        note={"range": True},
                        line={
                            "statistic": dc.HUMIDITY,
                            "hours": 48,
                            "color": "teal",
                            "aria": "Niiskus 48 tundi",
                        },
                        cells=[
                            vent_cell(dc.SUPPLY, "Tuppa", "sissepuhe", decimals=1),
                            vent_cell(dc.EXTRACT, "Toast", "väljatõmme", decimals=1),
                            vent_cell(dc.OUTDOOR, "Väljas", "välisõhk", decimals=1),
                        ],
                        grid_options={"columns": "full"},
                    ),
                    heading("Seade"),
                    card(
                        "reading-card",
                        label="Kasutegur",
                        entity=dc.EFFICIENCY,
                        decimals=0,
                        note={"text": "soojusvaheti"},
                        meter={
                            "entity": dc.FILTER,
                            "name": "Filter",
                            "note": "ummistunud",
                            "max": 100,
                        },
                        cells=[
                            vent_cell(
                                dc.RECOVERY,
                                "Tagastab",
                                "soojust praegu",
                                scale=0.001,
                                unit="kW",
                                decimals=1,
                                color="green",
                            ),
                            vent_cell(
                                dc.VENT_POWER_USE, "Võtab", "elektrit praegu", color="indigo"
                            ),
                            vent_cell(dc.EXCHANGER, "Vaheti", "lahti", color="blue"),
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
                                "statistic": dc.RECOVERED,
                                "type": "change",
                                "unit": "kWh",
                                "decimals": 1,
                                "color": "green",
                                "headline": "ratio",
                                "caption": "rohkem soojust tagasi, kui seade elektrit võtab",
                                "caption_below": "vähem soojust tagasi, kui seade elektrit võtab",
                                "aria": "Tagastatud soojus ja seadme elekter päevade kaupa",
                                "overlay": {
                                    "statistic": dc.AHU_ENERGY,
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
                                "entity": dc.VENT_MONTH,
                                "unit": "kWh",
                                "decimals": 1,
                                "note_last": "last_period",
                            },
                            {
                                "name": "Järelküte",
                                "entity": dc.HEATER_MONTH,
                                "unit": "kWh",
                                "note": "sel kuul",
                                "bad_above": 0,
                            },
                        ],
                        grid_options={"columns": "full"},
                    ),
                    wide(
                        tile(
                            dc.ACTIVE_ALARMS,
                            "Aktiivsed alarmid",
                            icon="alert",
                            color="red",
                            active=["*"],
                            visibility=[
                                {"condition": "state", "entity": dc.ACTIVE_ALARMS, "state_not": ""}
                            ],
                        )
                    ),
                    wide(
                        tile(
                            dc.MODE,
                            "Seaded",
                            icon="tune",
                            active=[],
                            state_text="Ajakava, ECO, kamin, eemal, taimerid",
                            chevron=True,
                            tap_action={
                                "action": "navigate",
                                "navigation_path": "/lovelace/komfovent-seaded",
                            },
                        )
                    ),
                ]
            ),
        ],
    }


def overview(house, people, model):
    """The house's Overview: dashboard_config.build() with A3's views in place of Kodu's (`kodu`,
    `energia`, `soojuspump`, `ventilatsioon`) and the 3D view (`maja-3d`) last. A fresh copy every
    call."""
    config = dc.build(house, people, model)
    h = dc.House(house, people)
    a3 = {
        "kodu": build(house, people, model)["views"][0],
        "energia": energia(),
        "soojuspump": soojuspump(h),
        "ventilatsioon": ventilatsioon(h),
    }
    views = [a3.get(v["path"], v) for v in config["views"]]
    config["views"] = sorted(views, key=lambda v: v["path"] == "maja-3d")
    return config
