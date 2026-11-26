"""Security views in A3's look: Valve (ADR-015) and Kaamerad (ADR-016), plus camera subviews."""

import math

from . import entities as E
from .primitives import (
    BACKGROUND,
    MEAN,
    ONOFF,
    card,
    heading,
    section,
    settings_row,
    tile,
    wide,
)

ALARM_MODES = list(zip(E.ALARM_MODES, ["Eemal", "Kodus", "Öö", "Maas"], strict=True))
ALARM_DOING = [
    ("triggered", "Häire", "bad"),
    ("pending", "Sisenemise viivitus", "bad"),
    ("arming", "Valvesse minek", "info"),
]
ALARM_LINE = list(
    zip(E.ALARM_MODES, ["Eemal valves", "Kodus valves", "Öö valves", "Valvest maas"], strict=True)
) + [(state, text) for state, text, _ in ALARM_DOING]
DOOR_KINDS = ("door", "glassdoor")


def cam_path(slug):
    return "kaamera-" + slug


def cam_sub(slug):
    """A camera's substream, the one its stills come from."""
    return "camera." + slug + "_alamvoog"


def cam_detect(slug):
    """A camera's motion detection switch."""
    return "switch." + slug + "_liikumistuvastus"


def camera_views(h):
    """Where the full-screen button of the 3D card's camera panel goes: that camera's full
    screen (cam_view)."""
    return {"camera." + s: "/lovelace/" + cam_path(s) for s, _ in h.cams}


def camera_stills(h):
    """Where the 3D card's camera panel takes a camera's still from: its substream (ADR-016)."""
    return {"camera." + s: cam_sub(s) for s, _ in h.cams}


def camera_positions(model):
    return {
        d["entity"]: d["pos"]
        for d in (model or {}).get("devices", [])
        if d["entity"].startswith("camera.") and d.get("pos")
    }


def cam_view(h, slug, name, pos=None):
    """One full-screen panel subview per camera behind the Kaamerad grid."""
    pos = pos or {}
    here = pos.get("camera." + slug)

    def dist(s):
        there = pos.get("camera." + s)
        return math.dist(here, there) if here and there else math.inf

    near = sorted((c for c in h.cams if c[0] != slug), key=lambda c: dist(c[0]))
    others = [{"camera_entity": "camera." + s, "title": t} for s, t in near]
    return {
        "title": "Kaamerad",
        "path": cam_path(slug),
        "icon": "mdi:cctv",
        "type": "panel",
        "subview": True,
        "cards": [
            {
                "type": "custom:advanced-camera-card",
                "cameras": [{"camera_entity": "camera." + slug, "title": name}] + others,
                "view": {"default": "live"},
                "menu": {"style": "hover"},
                "live": {"display": {"mode": "single"}},
                "status_bar": {"style": "outside", "position": "bottom"},
            }
        ],
    }


def plan_slice(model, pirs):
    """What the motion card draws the house plan and its trail from (ADR-015): every room's id
    and rects, a name only for a room with a PIR, every wall with its door openings as [c, w], and
    the room of each PIR in `pirs` that the model places in one of its rooms. None without a model
    or without such a PIR. Never the model's devices or anything else of it."""
    if not model:
        return None
    rooms = model.get("rooms", [])
    ids = {r["id"] for r in rooms}
    where = {d["entity"]: d.get("room") for d in model.get("devices", [])}
    placed = [{"entity": e, "room": where[e]} for e in pirs if where.get(e) in ids]
    if not placed:
        return None
    walls = [
        {
            "a": w["a"],
            "b": w["b"],
            "t": w.get("t", 0),
            "doors": [[o["c"], o["w"]] for o in w.get("openings", []) if o["kind"] in DOOR_KINDS],
        }
        for w in model.get("walls", [])
    ]
    sensed = {p["room"] for p in placed}
    return {
        "rooms": [
            {
                "id": r["id"],
                "rects": r["rects"],
                **({"name": r["name"]} if r["id"] in sensed else {}),
            }
            for r in rooms
        ],
        "walls": walls,
        "pirs": placed,
    }


def motion_names(plan):
    """Each PIR's row name: its room's name in the plan when no other PIR shares the room, else
    the public room name in entities.MOTION_ROOMS."""
    names = dict(E.MOTION_ROOMS)
    if plan:
        room = {r["id"]: r.get("name") for r in plan["rooms"]}
        count = {}
        for p in plan["pirs"]:
            count[p["room"]] = count.get(p["room"], 0) + 1
        names.update({p["entity"]: room[p["room"]] for p in plan["pirs"] if count[p["room"]] == 1})
    return names


def alarm_tile(entity, name):
    """A partition: its mode by name or what it is doing, and its four modes marked by state; any tap
    opens HA's more-info dialog, whose keypad takes the code (the card never sees one)."""
    return wide(
        tile(
            entity,
            name,
            icon="shield",
            icon_on="shield-check",
            color="teal",
            state_text=[{"text": text, "if": [{"state": state}]} for state, text in ALARM_LINE],
            modes=[
                {
                    "name": n,
                    "option": state,
                    "tap_action": {"action": "more-info"},
                    **({"color": "teal"} if state != "disarmed" else {}),
                }
                for state, n in ALARM_MODES
            ],
        )
    )


def armed_rules(entity, state="on"):
    """A cell's bad_if: the entity in `state` while either partition is armed."""
    return [
        [{"entity": entity, "state": state}, {"entity": a, "state": "armed_*"}] for a, _ in E.ALARMS
    ]


def fault_cell(entity, name, words, color):
    """A Süsteem cell that reads fine while off: green in its words, red while on or unavailable."""
    return {
        "entity": entity,
        "name": name,
        "words": words,
        "good": ["off"],
        "bad_if": [{"state": "on"}, {"state": "unavailable"}],
        "history": ONOFF,
        "color": color,
    }


def valve(model):
    """Valve: the status over both partitions, Maja and Garaaž with their modes, the doors with
    when they last opened, the trail through the house plan and each room by the hour, and the
    panel's own sensors."""
    pirs = E.SHARED + E.PRIVATE
    plan = plan_slice(model, pirs)
    names = motion_names(plan)
    alarms = [e for e, _ in E.ALARMS]
    status = [
        {"entities": alarms, "state": state, "text": text, "tone": tone}
        for state, text, tone in [
            *ALARM_DOING,
            ("armed_*", "Valves", "info"),
            ("disarmed", "Valvest maas", "ok"),
        ]
    ]
    doors = [
        {
            "entity": e,
            "name": n,
            "words": {"off": "kinni", "on": "lahti"},
            "note": {"last_on": True, "label": "avati"},
            "bad_if": armed_rules(e),
            "history": ONOFF,
            "color": "blue",
        }
        for e, n in E.DOORS
    ]
    korras = {"off": "korras"}
    system = [
        fault_cell(E.SMOKE, E.SMOKE_GROUP, {"off": "korras", "on": "tulekahju"}, "red"),
        {
            "entity": E.VALVE_BATTERY,
            "name": "Aku",
            "decimals": 1,
            "note": {"entity": E.VALVE_SUPPLY, "label": "toide", "decimals": 1},
            "history": MEAN,
            "color": "green",
        },
        {
            "entity": E.VALVE_LINK,
            "name": "Ühendus",
            "words": {"on": "olemas", "off": "katkes"},
            "good": ["on"],
            "bad_if": [{"state": "off"}, {"entity": E.VALVE_LINK_RAW, "state": "!online"}],
            "history": ONOFF,
            "color": "blue",
        },
        fault_cell(E.TAMPER, "Rikkumine", korras, "red"),
        fault_cell(E.SIREN, "Sireen", korras, "red"),
    ]
    groups = [
        {"name": label, "rooms": [{"entity": e, "name": names[e]} for e in ents]}
        for label, ents in (("Ühisruumid", E.SHARED), ("Toad", E.PRIVATE))
    ]
    alarms = [{"entity": e, "name": n} for e, n in E.ALARMS]
    motion = [
        card(
            "motion-card",
            part=part,
            **({"plan": plan} if plan and part == "plan" else {}),
            groups=groups,
            alarms=alarms,
            minutes=15,
            grid_options={"columns": "full"},
        )
        for part in ("plan", "rows")
    ]
    notice = "Teavitus tuleb tulekahjust, häirest, paanikanupust, toite kadumisest ja rikkumisest."
    return {
        "title": "Valve",
        "path": "valve",
        "icon": "mdi:shield-home",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Valve",
                        status={"map": status},
                        faults=[
                            {"entity": E.SMOKE, "name": "Tulekahju"},
                            {"entity": E.VALVE_LINK, "name": "Ühendus katkes", "bad": "off"},
                        ],
                        grid_options={"columns": "full"},
                    ),
                    *[alarm_tile(e, n) for e, n in E.ALARMS],
                    heading("Uksed"),
                    card("reading-card", cells=doors, grid_options={"columns": "full"}),
                ]
            ),
            section(
                [
                    heading("Liikumine"),
                    *motion,
                    heading("Süsteem"),
                    card(
                        "reading-card",
                        cells=system,
                        note={"text": notice},
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
        ],
    }


def cameras(h):
    """Kaamerad: the status, the stills with the first camera large and the others as thumbnails,
    the recordings in the NVR app, the system cells and the settings row."""
    sub = [(cam_sub(slug), n, slug) for slug, n in h.cams]
    status = [
        {"entities": [E.NVR], "state": "!OK", "text": "NVR ketas viga", "tone": "bad"},
        *[
            {"entities": [e], "state": "unavailable", "text": n + " ei vasta", "tone": "bad"}
            for e, n, _ in sub
        ],
        {"entities": [E.NVR], "state": "OK", "text": "Kõik kaamerad ja NVR korras", "tone": "ok"},
    ]
    system = [
        {
            "entity": E.NVR,
            "name": "NVR ketas",
            "words": {"OK": "korras", "*": "viga"},
            "good": ["OK"],
            "bad_if": [{"state": "!OK"}],
            "history": ONOFF,
            "color": "blue",
        },
        {
            "name": "Kaamerad",
            "count": {"entities": [{"entity": e, "name": n} for e, n, _ in sub], "state": "*"},
            "note": {"missing": "kõik vastavad"},
        },
        {
            "name": "Tuvastus",
            "count": {
                "entities": [{"entity": cam_detect(slug), "name": n} for slug, n in h.cams],
                "state": "on",
            },
            "note": {"missing": "sees"},
        },
    ]
    recordings = (
        [
            wide(
                tile(
                    E.NVR,
                    "Salvestised",
                    icon="play",
                    active=[],
                    state_text="Avab NVR-i äpi",
                    chevron=True,
                    tap_action={"action": "url", "url_path": h.nvr_app},
                )
            )
        ]
        if h.nvr_app
        else []
    )
    return {
        "title": "Kaamerad",
        "path": "kaamerad",
        "icon": "mdi:cctv",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Kaamerad",
                        status={"map": status},
                        grid_options={"columns": "full"},
                    ),
                    *(
                        [
                            card(
                                "cameras-card",
                                cameras=[
                                    {
                                        "entity": e,
                                        "name": n,
                                        "tap_action": {
                                            "action": "navigate",
                                            "navigation_path": "/lovelace/" + cam_path(slug),
                                        },
                                    }
                                    for e, n, slug in sub
                                ],
                                grid_options={"columns": "full"},
                            )
                        ]
                        if sub
                        else []
                    ),
                    *recordings,
                ]
            ),
            section(
                [
                    heading("Süsteem"),
                    card("reading-card", cells=system, grid_options={"columns": "full"}),
                    settings_row(E.NVR, "Liikumistuvastus, põhivood", "/lovelace/kaamerad-seaded"),
                ]
            ),
        ],
    }
