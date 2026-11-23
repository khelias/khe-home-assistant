"""Teler view in A3's look (ADR-007, ADR-017)."""

from . import entities as E
from .primitives import BACKGROUND, card, heading, section


def _profile_action(i, name):
    return {
        "action": "perform-action",
        "perform_action": f"script.teler_profiil_{i}",
        "confirmation": {
            "text": f"Vahetad teleri profiilile {name}?"
            + (" PIN tuleb sisestada teleris." if i == 1 else "")
        },
    }


def teler(h):
    """Teler: what is on now with the TV's controls, today's watch time by app, today's sessions
    and the week stacked by app."""
    remote = {"action": "more-info", "entity": E.TV}
    off = {
        "action": "perform-action",
        "perform_action": "media_player.turn_off",
        "target": {"entity_id": E.TV},
        "confirmation": {"text": "Lülitad teleri välja?"},
    }
    entities = [{"entity": e, "name": n, "color": c} for n, e, _, c in E.TV_APPS]
    stack = [
        {"statistic": w["entity"], "name": n, "color": c, "today": {"entity": e}}
        for (n, e, _, c), w in zip(E.TV_APPS, E.tv_week["entities"], strict=True)
    ]
    return {
        "title": "Teler",
        "path": "teler",
        "icon": "mdi:television",
        "type": "sections",
        "max_columns": 2,
        "background": BACKGROUND,
        "sections": [
            section(
                [
                    card(
                        "chips-card",
                        style="a3",
                        title="Teler",
                        grid_options={"columns": "full"},
                    ),
                    card(
                        "tv-card",
                        entity=E.TV,
                        app=E.TV_APP,
                        sessions=E.TV_SESSIONS,
                        apps=[{"name": x["name"], "color": x["color"]} for x in entities],
                        buttons={
                            "power_off": off,
                            "power_on": {
                                "action": "perform-action",
                                "perform_action": "media_player.turn_on",
                                "target": {"entity_id": E.TV},
                            },
                            "remote": remote,
                        },
                        profiles=[
                            {"name": n, "tap_action": _profile_action(i, n), "lock": i == 1}
                            for i, n in h.tv_profiles
                        ],
                        grid_options={"columns": "full"},
                    ),
                    heading("Täna"),
                    card(
                        "usage-card",
                        part="today",
                        entities=entities,
                        compare={"entity": E.TV_YESTERDAY},
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
            section(
                [
                    heading("Täna ajas"),
                    card(
                        "usage-card",
                        part="sessions",
                        entities=entities,
                        sessions=E.TV_SESSIONS,
                        grid_options={"columns": "full"},
                    ),
                    heading("Nädal"),
                    card(
                        "days-card",
                        days=7,
                        series=[{"name": "Nädal", "stack": stack}],
                        grid_options={"columns": "full"},
                    ),
                ]
            ),
        ],
    }
