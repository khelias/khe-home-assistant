"""Tests of the Bubble Card trial dashboard (scripts/dashboard_trial.py, ADR-004) on a made-up
house: it keeps Kodu's first page and its confirmations, and leaves Kodu as it was.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import dashboard_config as dc
import dashboard_trial as trial

HOUSE = {
    "cams": [["cam_one", "Üks"], ["cam_two", "Kaks"]],
    "phone": "sensor.test_phone",
    "nvr_app_url": "testnvr://",
    "updates": [["update.test_thing", "Test"]],
    "tv_profiles": [[1, "Profiil A"], [2, "Profiil B"]],
}
PEOPLE = [["person.test_adult", "Täiskasvanu on"], ["person.test_child", "Laps on"]]

# Kodu first-page entities that the trial moves off its first page, and why.
OFF_FIRST_PAGE = {
    dc.FORECAST: "the 48 h price chart is in the Elekter pop-up; the price sentence stays",
    "estfeed:estfeed_consumption_642b": "the 7-day usage chart is in the Elekter pop-up",
    "estfeed:estfeed_cost_642b": "the 7-day cost chart is in the Elekter pop-up",
}


def walk(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def entities(node):
    return {d["entity"] for d in walk(node) if isinstance(d.get("entity"), str)}


def is_popup(card):
    return card.get("card_type") == "pop-up"


VIEW = trial.build(HOUSE, PEOPLE)["views"][0]
KODU = dc.build(HOUSE, PEOPLE, None)


def view():
    return VIEW


def popups(v):
    return [d for d in walk(v) if is_popup(d)]


def first_page(v):
    """The view with every pop-up taken out."""

    def strip(node):
        if isinstance(node, dict):
            return {k: strip(x) for k, x in node.items()}
        if isinstance(node, list):
            return [strip(x) for x in node if not (isinstance(x, dict) and is_popup(x))]
        return node

    return strip(v)


def bare(action):
    return json.dumps({k: v for k, v in action.items() if k != "confirmation"}, sort_keys=True)


def card_actions(card):
    """A card's or badge's actions; `button_action` is read through its card."""
    if "type" not in card:
        return
    for key in ("tap_action", "icon_tap_action"):
        if isinstance(card.get(key), dict):
            yield card[key]
    if isinstance(card.get("button_action"), dict):
        yield card["button_action"]["tap_action"]


def kodu_confirmations():
    """(entity, action without its confirmation) -> the confirmations Kodu gives it."""
    out = {}
    for card in walk(KODU):
        for act in card_actions(card):
            key = (card.get("entity"), bare(act))
            out.setdefault(key, set()).add(json.dumps(act.get("confirmation")))
    return out


class FirstPage(unittest.TestCase):
    def test_every_kodu_entity_is_on_the_first_page(self):
        kodu = entities(dc.home(dc.House(HOUSE, PEOPLE)))
        page = entities(first_page(view()))
        missing = kodu - page - set(OFF_FIRST_PAGE)
        self.assertEqual(missing, set())
        self.assertLessEqual(set(OFF_FIRST_PAGE), kodu, "an exception Kodu no longer has")

    def test_moved_entities_are_in_the_elekter_popup(self):
        (elekter,) = [p for p in popups(view()) if p["hash"] == "#elekter"]
        self.assertLessEqual(set(OFF_FIRST_PAGE), entities(elekter))


class Actions(unittest.TestCase):
    def test_confirmations_match_kodu(self):
        kodu = kodu_confirmations()
        for card in walk(view()):
            for act in card_actions(card):
                key = (card.get("entity"), bare(act))
                got = json.dumps(act.get("confirmation"))
                with self.subTest(entity=key[0], action=key[1]):
                    self.assertIn(got, kodu.get(key, {json.dumps(None)}))
                    self.assertEqual(len(kodu.get(key, {got})), 1)

    def test_every_confirmed_kodu_action_is_on_the_first_page(self):
        def confirmed(node):
            return {
                (card.get("entity"), json.dumps(act, sort_keys=True))
                for card in walk(node)
                for act in card_actions(card)
                if "confirmation" in act
            }

        kodu = confirmed(dc.home(dc.House(HOUSE, PEOPLE)))
        self.assertTrue(kodu)
        self.assertLessEqual(kodu, confirmed(first_page(view())))

    def test_bubble_buttons_act_alike_on_icon_and_body(self):
        for card in walk(view()):
            if card.get("type") == trial.BUBBLE and card["card_type"] in ("button", "cover"):
                with self.subTest(card=card.get("name")):
                    self.assertIn("button_action", card)
                    self.assertEqual(card["button_action"]["tap_action"], card["tap_action"])


class Popups(unittest.TestCase):
    def test_each_hash_is_unique_and_has_one_opener(self):
        v = view()
        hashes = [p["hash"] for p in popups(v)]
        self.assertEqual(len(hashes), len(set(hashes)))
        for h in hashes:
            openers = [
                c
                for c in walk(v)
                if "type" in c and c.get("tap_action", {}).get("navigation_path") == h
            ]
            self.assertEqual(len(openers), 1, h)

    def test_no_blur_and_no_translucency(self):
        ps = popups(view())
        self.assertTrue(ps)
        for p in ps:
            self.assertEqual((p["bg_opacity"], p["bg_blur"]), ("100", "0"), p["hash"])
        self.assertIs(ps[0].get("hide_backdrop"), True)

    def test_links_into_kodu_are_seaded_or_cameras(self):
        allowed = {
            "/lovelace/" + v["path"]
            for v in KODU["views"]
            if v.get("subview")
            and (v["path"].endswith("-seaded") or v["path"].startswith("kaamera-"))
        }
        paths = {
            d["navigation_path"]
            for d in walk(view())
            if str(d.get("navigation_path", "")).startswith("/lovelace/")
        }
        self.assertTrue(paths)
        self.assertLessEqual(paths, allowed)

    def test_cameras_only_in_the_kaamerad_popup(self):
        v = view()
        (cams,) = [p for p in popups(v) if p["hash"] == "#kaamerad"]
        rest = json.dumps([p for p in popups(v) if p is not cams] + [first_page(v)])
        for slug, _ in HOUSE["cams"]:
            self.assertIn(slug, json.dumps(cams))
            self.assertNotIn(slug, rest)


class Build(unittest.TestCase):
    def test_kodu_is_unchanged_by_a_trial_build(self):
        before = dc.build(HOUSE, PEOPLE, None)
        trial.build(HOUSE, PEOPLE)
        self.assertEqual(dc.build(HOUSE, PEOPLE, None), before)

    def test_without_inputs_it_builds_and_leaves_the_cameras_out(self):
        config = trial.build({}, [])
        self.assertEqual(len(config["views"]), 1)
        v = config["views"][0]
        self.assertNotIn("#kaamerad", [p["hash"] for p in popups(v)])
        self.assertIn("#kute", [p["hash"] for p in popups(v)])


if __name__ == "__main__":
    unittest.main()
