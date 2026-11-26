"""Shared fixtures and helpers for tests/dashboard/test_*.py."""

import copy
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

import dashboard as D  # noqa: E402
import house3d_model  # noqa: E402

FIXTURE_PATH = ROOT / "tests/house3d/fixture-model.md"
# the made-up house the public demo shows, on the test house's device ids
DEMO_PATH = ROOT / "tests/house3d/fixture-demo.md"
HOUSE = {
    "cams": [["cam_one", "Üks"], ["cam_two", "Kaks"]],
    "phone": "sensor.test_phone",
    "nvr_app_url": "testnvr://",
    "updates": [["update.test_thing", "Test"]],
    "tv_profiles": [[1, "Profiil A"], [2, "Profiil B"]],
}
PEOPLE = [["person.test_adult", "Täiskasvanu on"], ["person.test_child", "Laps on"]]
MODEL = {"walls": []}
H = D.House(HOUSE, PEOPLE)

ENTITY_ID = re.compile(r"^(?:[a-z_]+\.[a-z0-9_]+|[a-z_]+:[a-z0-9_]+)$")
walk = D.walk


def card_model(path):
    layers = house3d_model.read_layers(path)
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


def fixture_model():
    return card_model(FIXTURE_PATH)


def demo_model():
    return card_model(DEMO_PATH)


FIXTURE = fixture_model()
FIXTURE_PIRS = [d["entity"] for d in FIXTURE["devices"] if d["type"] == "motion"]


def placed(model, pirs):
    """The fixture house with its PIRs under the given ids, in order."""
    out = copy.deepcopy(model)
    rename = dict(zip(FIXTURE_PIRS, pirs, strict=False))
    for d in out["devices"]:
        d["entity"] = rename.get(d["entity"], d["entity"])
    return out


def paths(config):
    return [v["path"] for v in config["views"]]


def screens(c):
    """The media queries of c's screen conditions, in order."""
    return [v["media_query"] for v in c.get("visibility", []) if v["condition"] == "screen"]


def unscreened(c):
    """c without its screen conditions, any other visibility kept."""
    return {**c, "visibility": [v for v in c.get("visibility", []) if v["condition"] != "screen"]}


def narrow_matches(query):
    """Whether a phone (under 736 px) matches one of A3's media queries."""
    return {
        D.WIDE: False,
        D.NARROW: True,
        D.FOUR: False,
        D.BELOW_FOUR: True,
        D.THREE: False,
        D.NOT_THREE: True,
    }[query]


def ids(node):
    """Every entity or statistic id read by cards, excluding service names."""
    out = set()
    for d in walk(node):
        for k, v in d.items():
            if k != "perform_action" and isinstance(v, str) and ENTITY_ID.match(v):
                out.add(v)
    return out


def without_sheets(node):
    if isinstance(node, dict):
        return {
            k: without_sheets(v) for k, v in node.items() if k not in ("history", "usage_history")
        }
    if isinstance(node, list):
        return [without_sheets(v) for v in node]
    return node


def links(node):
    """Every view a page links to: its navigate actions and its sheets' view buttons."""
    return {d["navigation_path"] for d in walk(node) if d.get("action") == "navigate"} | {
        d["view"] for d in walk(node) if isinstance(d.get("view"), str)
    }


def tiles_of(node, entity):
    return [
        c for c in walk(node) if c.get("type") == "custom:khe-tile-card" and c["entity"] == entity
    ]


def cards_of(node, kind):
    return [c for c in walk(node) if c.get("type") == "custom:khe-" + kind]


def card_actions(card):
    """What a card or badge hands to HA: taps, buttons, corner, modes and slider."""
    if "type" not in card:
        return
    for key in ("tap_action", "icon_tap_action"):
        if isinstance(card.get(key), dict):
            yield card[key]
    if not card["type"].startswith("custom:khe-"):
        return
    for b in card.get("buttons", []):
        yield b["tap_action"]
    if isinstance(card.get("corner"), dict):
        yield card["corner"]["tap_action"]
    for m in card.get("modes", []):
        if "tap_action" in m:
            yield m["tap_action"]
            continue
        entity = card.get("modes_entity", card["entity"])
        yield {
            "action": "perform-action",
            "perform_action": entity.split(".")[0] + ".select_option",
            "target": {"entity_id": entity},
            "data": {"option": m["option"]},
            **({"confirmation": {"text": m["confirm"]}} if m.get("confirm") else {}),
        }
    if card.get("switch"):
        yield {"action": "toggle", "entity": card["entity"]}
    if card.get("slider"):
        yield {
            "action": "perform-action",
            "perform_action": "light.turn_on",
            "target": {"entity_id": card["entity"]},
            "data": {"brightness_pct": 50},
        }
