"""Shared layout constants and card builders for the A3 views and remaining stock subviews."""

from . import entities as E

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
# and 32 px of padding each side.
WIDE = "(min-width: 736px)"
NARROW = "not all and (min-width: 736px)"
# Four columns need 1440 px of content (four 320 px columns, three 32 px gaps, 32 px padding each
# side) plus HA's 256 px sidebar and 20 px for the scrollbar.
FOUR = "(min-width: 1716px)"
BELOW_FOUR = "not all and (min-width: 1716px)"

MEAN = {"source": "statistics", "type": "mean"}
ONOFF = {"source": "history"}

VENT_MODES = [
    ("Tavaline", "normal"),
    ("Köök", "kitchen"),
    ("Boost", "boost"),
]


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


def settings_row(entity, text, path):
    """A view's wide "Seaded" row, to its settings subview."""
    return wide(
        tile(
            entity,
            "Seaded",
            icon="tune",
            active=[],
            state_text=text,
            chevron=True,
            tap_action={"action": "navigate", "navigation_path": path},
        )
    )


def section(cards, span=1, rows=1):
    s = {"type": "grid", "column_span": span, "cards": cards}
    if rows > 1:
        s["row_span"] = rows
    return s


def screen(c, query):
    """c shown only on screens matching query, on top of any visibility it already has."""
    return {
        **c,
        "visibility": [*c.get("visibility", []), {"condition": "screen", "media_query": query}],
    }


def around(hero, title_chips):
    """The title over the hero and the chips under it: the chips card drawn in two parts."""
    return [{**title_chips, "part": "title"}, *hero, {**title_chips, "part": "chips"}]


def screened(cards, query):
    return [screen(c, query) for c in cards]


def walk(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


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


def roof_action(service):
    return {"action": "perform-action", "perform_action": service, "target": {"entity_id": E.ROOF}}


def cover_button(name, state, service):
    """A roof button: pressed while the roof is in its state, a tap runs the service."""
    return {"name": name, "state": state, "tap_action": roof_action(service)}


def pergola_light_tile(name, view=None, **kw):
    """The pergola light as a wide A3 tile: the icon toggles it, the slider sets its brightness and
    the sheet shows when it was on, linking to `view` when it has one."""
    return wide(
        tile(
            E.PERGOLA_LIGHT,
            name,
            icon="bulb",
            color="yellow",
            icon_tap_action={"action": "toggle"},
            icon_label="Pergola valgus sisse või välja",
            slider={"attribute": "brightness"},
            history={**ONOFF, "view": view} if view else dict(ONOFF),
            **kw,
        )
    )


def vent_modes():
    """The ventilation's mode buttons: name, option and confirmation."""
    return [
        {"name": name, "option": opt, "confirm": f"Ventilatsioon režiimile {name}?"}
        for name, opt in VENT_MODES
    ]


def vent_tile(state_text, view=None):
    """The ventilation modes as one wide A3 tile; the sheet counts the modes but normal as on, and
    links to `view` when it has one."""
    ms = vent_modes()
    history = {**ONOFF, "active": [m["option"] for m in ms if m["option"] != "normal"]}
    return wide(
        tile(
            E.MODE,
            "Ventilatsioon",
            icon="vent",
            color="blue",
            active=["*"],
            state_text=state_text,
            modes=ms,
            history={**history, "view": view} if view else history,
        )
    )


def _dhw_action(mode, text):
    return {
        "action": "perform-action",
        "perform_action": "water_heater.set_operation_mode",
        "target": {"entity_id": E.DHW},
        "data": {"operation_mode": mode},
        "confirmation": {"text": text},
    }


DHW_STOP_TEXT = "Lõpetad boileri kiirsoojenduse? Vesi soojeneb edasi tavarežiimis."
DHW_START_TEXT = "Boileri kiirsoojendus (Daikin Powerful) sisse? Lõpeb ise, kui vesi on soe."


def boost_tiles():
    """Two A3 boost tiles, one per water-heater state: the icon runs the confirmed action, the body
    opens the boiler water's history."""
    specs = [
        (
            "Kiirsoojendus sees",
            ["performance"],
            _dhw_action("on", DHW_STOP_TEXT),
            [{"condition": "state", "entity": E.DHW, "state": "performance"}],
        ),
        (
            "Kiirsoojendus",
            [],
            _dhw_action("performance", DHW_START_TEXT),
            [{"condition": "state", "entity": E.DHW, "state_not": "performance"}],
        ),
    ]
    return [
        half(
            tile(
                E.DHW,
                name,
                icon="flame",
                color="orange",
                active=active,
                state_text=[{"attribute": "current_temperature", "label": "Boiler"}],
                icon_tap_action=act,
                icon_label=name,
                history={"entity": E.BOILER_TEMP, **MEAN, "unit": "°C", "title": "Boileri vesi"},
                visibility=vis,
            )
        )
        for name, active, act, vis in specs
    ]


# Stock-card helpers still used by the settings subviews and Süsteem.


def stock_tile(entity, name=None, **kw):
    c = {"type": "tile", "entity": entity}
    if name:
        c["name"] = name
    c.update(kw)
    return c


def nowrite(entity, name, **kw):
    return stock_tile(
        entity, name, tap_action={"action": "none"}, icon_tap_action={"action": "none"}, **kw
    )


def row(cards):
    cols = {1: 12, 2: 6, 4: 6}.get(len(cards), 4)
    for c in cards:
        c["grid_options"] = {"columns": cols, "rows": 2}
    return cards


def stock_section(title, cards, column_span=1, **kw):
    return {
        "type": "grid",
        "column_span": column_span,
        "cards": [{"type": "heading", "heading": title, **kw}] + cards,
    }


def action_tile(entity, name, icon, color, perform_action, data, text, **kw):
    act = {
        "action": "perform-action",
        "perform_action": perform_action,
        "target": {"entity_id": entity},
        "data": data,
        "confirmation": {"text": text},
    }
    return stock_tile(
        entity,
        name,
        icon=icon,
        color=color,
        hide_state=True,
        tap_action=act,
        icon_tap_action=act,
        **kw,
    )


def by_state(entity, value, on, off):
    on["visibility"] = [{"condition": "state", "entity": entity, "state": value}]
    off["visibility"] = [{"condition": "state", "entity": entity, "state_not": value}]
    return [on, off]


def label(sensor, select, name, **kw):
    act = {"action": "more-info", "entity": select}
    return stock_tile(sensor, name, tap_action=act, icon_tap_action=act, **kw)


def note(text):
    return {"type": "heading", "heading": text, "heading_style": "subtitle"}


def confirm(entity, name, text, **kw):
    act = {"action": "toggle", "confirmation": {"text": text}}
    return stock_tile(entity, name, tap_action=act, icon_tap_action=act, **kw)


def dhw_boost_stock():
    return by_state(
        E.DHW,
        "performance",
        action_tile(
            E.DHW,
            "Kiirsoojendus sees",
            "mdi:water-boiler",
            "orange",
            "water_heater.set_operation_mode",
            {"operation_mode": "on"},
            DHW_STOP_TEXT,
        ),
        action_tile(
            E.DHW,
            "Kiirsoojendus",
            "mdi:water-boiler",
            "disabled",
            "water_heater.set_operation_mode",
            {"operation_mode": "performance"},
            DHW_START_TEXT,
        ),
    )
