"""Tests of the Kodu A3 dashboard (scripts/dashboard_a3.py, ADR-005) on a made-up house: it keeps
every entity, action and confirmation of Kodu's first page, and leaves Kodu as it was.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import dashboard_a3 as a3
import dashboard_config as dc

HOUSE = {
    "cams": [["cam_one", "Üks"], ["cam_two", "Kaks"]],
    "phone": "sensor.test_phone",
    "nvr_app_url": "testnvr://",
    "updates": [["update.test_thing", "Test"]],
    "tv_profiles": [[1, "Profiil A"], [2, "Profiil B"]],
}
PEOPLE = [["person.test_adult", "Täiskasvanu on"], ["person.test_child", "Laps on"]]
MODEL = {"walls": []}

# Kodu first-page entities A3 shows only inside a history sheet, and why.
IN_A_SHEET = {
    dc.CONSUMPTION: "Kodu's 7-day usage chart is the usage sheet's 7-day range",
    dc.COST: "Kodu's 7-day cost chart is the usage sheet's 7-day range",
}
ENTITY_ID = re.compile(r"^(?:[a-z_]+\.[a-z0-9_]+|[a-z_]+:[a-z0-9_]+)$")


walk = a3.walk


def kodu_entities(node):
    return {d["entity"] for d in walk(node) if isinstance(d.get("entity"), str)}


def ids(node):
    """Every entity id the A3 cards read: any string value that is one, whatever its key."""
    out = set()
    for d in walk(node):
        for v in d.values():
            if isinstance(v, str) and ENTITY_ID.match(v):
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


def bare(action):
    return json.dumps({k: v for k, v in action.items() if k != "confirmation"}, sort_keys=True)


def card_actions(card):
    """What a card or badge hands to HA: its taps, its buttons, its corner, its modes as the
    select_option the card emits and its slider as the light.turn_on it emits."""
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
        yield {
            "action": "perform-action",
            "perform_action": "select.select_option",
            "target": {"entity_id": card["entity"]},
            "data": {"option": m["option"]},
            **({"confirmation": {"text": m["confirm"]}} if m.get("confirm") else {}),
        }
    if card.get("slider"):
        yield {
            "action": "perform-action",
            "perform_action": "light.turn_on",
            "target": {"entity_id": card["entity"]},
            "data": {"brightness_pct": 50},
        }


CONFIG = a3.build(HOUSE, PEOPLE, MODEL)
VIEW = CONFIG["views"][0]
KODU = dc.build(HOUSE, PEOPLE, None)
HOME = dc.home(dc.House(HOUSE, PEOPLE))


def confirmations(node):
    out = {}
    for card in walk(node):
        for act in card_actions(card):
            key = (card.get("entity"), bare(act))
            out.setdefault(key, set()).add(json.dumps(act.get("confirmation")))
    return out


class FirstPage(unittest.TestCase):
    def test_every_kodu_entity_is_on_the_page(self):
        missing = kodu_entities(HOME) - ids(without_sheets(VIEW)) - set(IN_A_SHEET)
        self.assertEqual(missing, set())
        self.assertLessEqual(
            set(IN_A_SHEET), kodu_entities(HOME), "an exception Kodu no longer has"
        )

    def test_sheet_entities_are_in_a_sheet(self):
        sheets = [d["usage_history"] for d in walk(VIEW) if "usage_history" in d]
        self.assertLessEqual(set(IN_A_SHEET), ids(sheets))

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in VIEW["sections"] for c in s["cards"]}
        self.assertLessEqual(
            types, {"custom:house3d-card"} | {t for t in types if t.startswith("custom:khe-")}
        )
        self.assertIn("custom:house3d-card", types)


class Actions(unittest.TestCase):
    def test_confirmations_match_kodu(self):
        kodu = confirmations(KODU)
        for card in walk(VIEW):
            for act in card_actions(card):
                key = (card.get("entity"), bare(act))
                got = json.dumps(act.get("confirmation"))
                with self.subTest(entity=key[0], action=key[1]):
                    self.assertIn(got, kodu.get(key, {json.dumps(None)}))
                    self.assertEqual(len(kodu.get(key, {got})), 1)

    def test_every_confirmed_kodu_action_is_on_the_page(self):
        def confirmed(node):
            return {
                (card.get("entity"), json.dumps(act, sort_keys=True))
                for card in walk(node)
                for act in card_actions(card)
                if "confirmation" in act
            }

        kodu = confirmed(HOME)
        self.assertTrue(kodu)
        self.assertLessEqual(kodu, confirmed(VIEW))

    def test_the_roof_and_the_light_act_as_kodus_features(self):
        (roof,) = [c for c in walk(VIEW) if c.get("entity") == dc.ROOF and "buttons" in c]
        self.assertEqual(
            [b["tap_action"]["perform_action"] for b in roof["buttons"]],
            ["cover.open_cover", "cover.close_cover"],
        )
        (light,) = [c for c in walk(VIEW) if c.get("entity") == dc.PERGOLA_LIGHT]
        self.assertEqual(light["icon_tap_action"], {"action": "toggle"})
        self.assertIn("slider", light)

    def test_every_sheet_names_its_source(self):
        for c in walk(VIEW):
            h = c.get("history") or c.get("usage_history")
            if isinstance(h, dict) and "type" in c:
                with self.subTest(card=c.get("name") or c["type"]):
                    self.assertIn(h["source"], ("statistics", "history"))
                    if h["source"] == "statistics":
                        self.assertIn(h["type"], ("mean", "change"))


class Build(unittest.TestCase):
    def test_kodu_is_unchanged_by_an_a3_build(self):
        before = dc.build(HOUSE, PEOPLE, None)
        a3.build(HOUSE, PEOPLE, MODEL)
        self.assertEqual(dc.build(HOUSE, PEOPLE, None), before)

    def test_without_inputs_it_builds_without_the_hero(self):
        config = a3.build({}, [], None)
        (view,) = config["views"]
        types = [c["type"] for s in view["sections"] for c in s["cards"]]
        self.assertNotIn("custom:house3d-card", types)
        self.assertIn("custom:khe-chips-card", types)

    def test_the_hero_spans_the_view(self):
        hero = VIEW["sections"][0]
        self.assertEqual(hero["column_span"], VIEW["max_columns"])
        self.assertEqual(hero["cards"][0]["height"], a3.HERO_HEIGHT)
        self.assertEqual(hero["cards"][0]["model"], MODEL)
        self.assertIn("var(--primary-background-color)", VIEW["background"])

    def test_a_fresh_copy_every_call(self):
        first = a3.build(HOUSE, PEOPLE, MODEL)
        first["views"][0]["sections"].clear()
        self.assertTrue(a3.build(HOUSE, PEOPLE, MODEL)["views"][0]["sections"])

    def test_no_entity_id_spelled_in_the_generator(self):
        src = (ROOT / "scripts/dashboard_a3.py").read_text()
        code = src.split('"""', 2)[2]
        quoted = set(re.findall(r'"([^"\s]+)"', code))
        self.assertEqual(quoted & (kodu_entities(KODU) | kodu_entities(VIEW)), set())


if __name__ == "__main__":
    unittest.main()
