"""The Bubble Card trial dashboard "Kodu katse", as data (ADR-004).

build(house, people) returns a one-view Lovelace config beside Kodu: Kodu's badges, its
readable values and its one-tap actions on one page as Bubble Card buttons, and one pop-up
per system with that system view's sections. Everything comes from dashboard_config.build(),
which returns a fresh copy, so nothing here reaches Kodu. Kodu stays the source of every
entity id, name and confirmation; nothing here spells one.
"""

import copy

import dashboard_config as dc

BUBBLE = "custom:bubble-card"

# The pop-ups, in button order: hash, name, icon and the Kodu view each one replaces.
SYSTEMS = [
    ("kute", "Küte", "mdi:heat-pump", "soojuspump"),
    ("ventilatsioon", "Ventilatsioon", "mdi:fan", "ventilatsioon"),
    ("pergola", "Pergola", "mdi:awning-outline", "pergola"),
    ("elekter", "Elekter", "mdi:lightning-bolt", "energia"),
    ("valve", "Valve", "mdi:shield-home", "valve"),
    ("teler", "Teler", "mdi:television", "teler"),
    ("kaamerad", "Kaamerad", "mdi:cctv", "kaamerad"),
    ("susteem", "Süsteem", "mdi:home-assistant", "susteem"),
]
SLUG = {"/lovelace/" + path: slug for slug, *_, path in SYSTEMS}
MORE_INFO = {"action": "more-info"}
CHARTS = ("vertical-stack", "statistics-graph")


def bubble(card_type, **kw):
    return {"type": BUBBLE, "card_type": card_type, **kw}


def actions(act):
    """Bubble Card's icon tap is `tap_action`, its body tap `button_action.tap_action`; both
    carry the same action so that a tap does the same thing wherever it lands."""
    return {"tap_action": act, "button_action": {"tap_action": act}}


# A Kodu tile in a colour other than grey is the running mode or the active boost; Bubble Card
# colours only on/off entities by itself, so the running state is painted the same way.
def painted(color):
    return (
        f"ha-card {{ --bubble-icon-background-color: var(--{color}-color) !important; }}\n"
        ".bubble-icon { color: var(--white-color, #fff) !important; }"
    )


def button(tile):
    """A Kodu tile or badge as a Bubble Card button: same entity, name, icon, state line,
    actions and visibility. A hidden state makes a name button; a tile Kodu sizes to a third
    of a row (the ventilation modes) stays a third."""
    hidden = tile.get("hide_state") or tile.get("show_state") is False
    b = bubble(
        "button",
        button_type="name" if hidden else "state",
        entity=tile["entity"],
        **{k: tile[k] for k in ("name", "icon", "state_content", "visibility") if k in tile},
        **actions(tile.get("tap_action", MORE_INFO)),
        grid_options={"columns": 4 if tile.get("grid_options", {}).get("columns") == 4 else 6},
    )
    if tile.get("type") == "tile" and tile.get("color") not in (None, "disabled", "red"):
        b["styles"] = painted(tile["color"])
    return b


def cover(tile):
    """The roof: Bubble Card's cover card carries the open, stop and close buttons the Kodu
    tile has as a feature. The state stays hidden, as on Kodu: the roof reports no position."""
    return bubble(
        "cover",
        entity=tile["entity"],
        name=tile["name"],
        show_state=False,
        **actions(MORE_INFO),
        grid_options={"columns": 12},
    )


def slider(tile):
    """The pergola light: a slider button for the brightness the Kodu tile's feature sets;
    a tap toggles it, as the tile's icon does."""
    return bubble(
        "button",
        button_type="slider",
        entity=tile["entity"],
        name=tile["name"],
        **actions({"action": "toggle"}),
        grid_options={"columns": 12},
    )


def is_control(tile):
    """A tile that acts: a confirmed action or a toggle, or one whose state Kodu hides
    because the tile is a button (a mode, the boost, the TV's off switch)."""
    return tile.get("hide_state") or tile.get("tap_action", {}).get("action") in (
        "perform-action",
        "toggle",
    )


def unlinked(cards, keep):
    """A system view's cards for a pop-up: a heading or tile that opened another view loses
    the link, since the pop-up replaces the view; links in `keep` (the Seaded subviews and
    the camera panels, which cannot sit in a pop-up) stay."""
    for c in cards:
        path = c.get("tap_action", {}).get("navigation_path")
        if path is not None and path not in keep:
            c.pop("tap_action")
        unlinked(c.get("cards", []), keep)
    return cards


def popup(slug, name, icon, view, lead, keep):
    """A pop-up at #slug: Kodu's charts for that system first, then the view's badges as
    buttons and every section's cards."""
    cards = [*lead, *(button(b) for b in view.get("badges", []))]
    for s in view.get("sections", []):
        cards += unlinked(s["cards"], keep)
    return bubble(
        "pop-up",
        hash="#" + slug,
        name=name,
        icon=icon,
        # No blur and no translucency (ADR-004, estate ADR-021).
        bg_opacity="100",
        bg_blur="0",
        cards=cards,
    )


def opener(slug, name, icon):
    return bubble(
        "button",
        button_type="name",
        name=name,
        icon=icon,
        **actions({"action": "navigate", "navigation_path": "#" + slug}),
        grid_options={"columns": 6},
    )


def tiles(card):
    """A card, or the tiles of a horizontal stack Kodu groups some of them in."""
    if card.get("type") == "horizontal-stack":
        for c in card["cards"]:
            yield from tiles(c)
    else:
        yield card


def build(house, people):
    h = dc.House(house, people)
    views = {v["path"]: v for v in dc.build(house, people, None)["views"]}
    home = views["kodu"]
    keep = {
        "/lovelace/" + p
        for p, v in views.items()
        if v.get("subview") and "/lovelace/" + p not in SLUG
    }

    badges = home["badges"]
    shown = {b["entity"] for b in badges}
    alerts, values, controls, extra = [], [], [], []
    leads = {}
    for s in home["sections"]:
        heading, *cards = s["cards"]
        slug = SLUG.get(heading.get("tap_action", {}).get("navigation_path"))
        if "visibility" in s:
            # A section that shows only at times (the TV while it is on) stays one.
            extra.append(
                {
                    **dc.section(heading["heading"], [button(c) for c in cards]),
                    "visibility": s["visibility"],
                }
            )
            continue
        # A heading's badges are alerts (Elekter's) or a readable value (the ventilation mode).
        for b in heading.get("badges", []):
            if "visibility" in b:
                badges.append(b)
            else:
                values.append(button(b))
        for c in cards:
            if c.get("type") in CHARTS:
                leads.setdefault(slug, []).append(c)
                continue
            for t in tiles(c):
                feature = (t.get("features") or [{}])[0].get("type")
                if feature == "cover-open-close":
                    controls.append(cover(t))
                elif feature == "light-brightness":
                    controls.append(slider(t))
                elif t.get("type") == "tile" and is_control(t):
                    controls.append(button(t))
                elif "visibility" in t:
                    # Shown only while something is wrong; a fault the badges already carry
                    # is not repeated.
                    if t.get("entity") not in shown:
                        alerts.append(t)
                elif t.get("type") == "tile":
                    values.append(button(t))
                else:
                    values.append(t)

    systems = [s for s in SYSTEMS if s[0] != "kaamerad" or h.cams]
    popups = [
        popup(slug, name, icon, views[path], leads.get(slug, []), keep)
        for slug, name, icon, path in systems
    ]
    # On the dashboard's first pop-up, this turns the translucent backdrop off for all of them.
    popups[0]["hide_backdrop"] = True

    view = {
        **{k: home[k] for k in ("type", "max_columns", "badges", "header")},
        "title": "Kodu katse",
        "path": "kodu",
        "icon": "mdi:home-variant",
        "sections": [
            dc.section("Täna", [*alerts, *values]),
            dc.section("Juhtimine", controls),
            *extra,
            dc.section("Süsteemid", [opener(slug, name, icon) for slug, name, icon, _ in systems]),
            {"type": "grid", "cards": popups},
        ],
    }
    return copy.deepcopy({"title": "Kodu katse", "views": [view]})
