"""Tests of A3 (scripts/dashboard_a3.py, ADR-005, ADR-007) on a made-up house: it keeps every
entity, action and confirmation of Kodu's first page, and overview() puts it first in the
Overview in Kodu's place, with the 3D view last and every other view as dashboard_config builds it.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import copy
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


def links(node):
    """Every view a page links to: its navigate actions and its sheets' view buttons."""
    return {d["navigation_path"] for d in walk(node) if d.get("action") == "navigate"} | {
        d["view"] for d in walk(node) if isinstance(d.get("view"), str)
    }


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

    def test_every_kodu_view_link_is_reachable(self):
        self.assertTrue(links(HOME))
        self.assertLessEqual(links(HOME), links(VIEW))

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
        self.assertEqual(view["sections"][0]["column_span"], view["max_columns"])
        self.assertTrue(all("row_span" not in sec for sec in view["sections"]))

    def test_the_hero_sits_left_two_rows_high_beside_elekter(self):
        first, elekter, controls, climate = VIEW["sections"]
        self.assertEqual(VIEW["max_columns"], 4)
        self.assertEqual((first["column_span"], first["row_span"]), (1, 2))
        _title, hero, _chips, _narrow = first["cards"]
        self.assertEqual(hero["type"], "custom:house3d-card")
        self.assertTrue(hero["stretch"])
        self.assertEqual(hero["height"], a3.HERO_HEIGHT)
        self.assertEqual(hero["model"], MODEL)
        self.assertEqual(elekter["row_span"], 2)
        self.assertEqual(elekter["cards"][0]["heading"], "Elekter")
        self.assertNotIn("row_span", controls)
        self.assertNotIn("row_span", climate)
        self.assertIn("var(--primary-background-color)", VIEW["background"])

    def test_wide_puts_the_title_over_the_hero_and_narrow_keeps_it_under(self):
        title, hero, chips, narrow = VIEW["sections"][0]["cards"]
        screen = lambda c: [
            v["media_query"] for v in c.get("visibility", []) if v["condition"] == "screen"
        ]
        self.assertEqual((title["part"], chips["part"]), ("title", "chips"))
        self.assertNotIn("part", narrow)
        self.assertEqual(screen(title), [a3.WIDE])
        self.assertEqual(screen(chips), [a3.WIDE])
        self.assertEqual(screen(narrow), [a3.NARROW])
        self.assertEqual(screen(hero), [])
        strip = lambda c: {k: v for k, v in c.items() if k not in ("part", "visibility")}
        self.assertEqual(strip(title), strip(narrow))
        self.assertEqual(strip(chips), strip(narrow))

    def test_a_fresh_copy_every_call(self):
        first = a3.build(HOUSE, PEOPLE, MODEL)
        first["views"][0]["sections"].clear()
        self.assertTrue(a3.build(HOUSE, PEOPLE, MODEL)["views"][0]["sections"])

    def test_no_entity_id_spelled_in_the_generator(self):
        src = (ROOT / "scripts/dashboard_a3.py").read_text()
        code = src.split('"""', 2)[2]
        quoted = set(re.findall(r'"([^"\s]+)"', code))
        spelled = (
            kodu_entities(KODU)
            | kodu_entities(VIEW)
            | kodu_entities(SOOJUSPUMP)
            | ids(VENTILATSIOON)
        )
        self.assertEqual(quoted & spelled, set())


OVERVIEW = a3.overview(HOUSE, PEOPLE, MODEL)
BUILT = dc.build(HOUSE, PEOPLE, MODEL)


def paths(config):
    return [v["path"] for v in config["views"]]


class Overview(unittest.TestCase):
    def test_a3_is_first_at_kodus_path_and_3d_is_last(self):
        self.assertEqual(OVERVIEW["views"][0], VIEW)
        self.assertEqual(paths(OVERVIEW)[0], "kodu")
        self.assertEqual(paths(OVERVIEW)[-1], "maja-3d")
        self.assertNotIn(dc.home(dc.House(HOUSE, PEOPLE)), OVERVIEW["views"])

    def test_every_other_view_is_dashboard_configs_in_its_order(self):
        swapped = {
            "kodu": VIEW,
            "energia": a3.energia(),
            "soojuspump": SOOJUSPUMP,
            "ventilatsioon": VENTILATSIOON,
        }
        built = [swapped.get(v["path"], v) for v in BUILT["views"] if v["path"] != "maja-3d"]
        self.assertEqual(OVERVIEW["views"][:-1], built)
        self.assertEqual(sorted(paths(OVERVIEW)), sorted(v["path"] for v in BUILT["views"]))

    def test_energia_is_a3s_at_kodus_energia_place(self):
        kodu = [p for p in paths(BUILT) if p != "maja-3d"]
        self.assertEqual(paths(OVERVIEW).index("energia"), kodu.index("energia"))
        self.assertEqual(OVERVIEW["views"][paths(OVERVIEW).index("energia")], a3.energia())

    def test_without_inputs_no_3d_view_and_no_hero(self):
        config = a3.overview({}, [], None)
        self.assertNotIn("maja-3d", paths(config))
        self.assertEqual(paths(config)[0], "kodu")
        types = [c["type"] for c in config["views"][0]["sections"][0]["cards"]]
        self.assertNotIn("custom:house3d-card", types)

    def test_a_fresh_copy_and_dashboard_config_unchanged(self):
        before = copy.deepcopy(BUILT)
        first = a3.overview(HOUSE, PEOPLE, MODEL)
        first["views"].clear()
        self.assertTrue(a3.overview(HOUSE, PEOPLE, MODEL)["views"])
        self.assertEqual(dc.build(HOUSE, PEOPLE, MODEL), before)
        self.assertEqual(paths(before)[:2], ["maja-3d", "kodu"])

    def test_every_lovelace_link_lands_on_a_view(self):
        views = {"/lovelace/" + p for p in paths(OVERVIEW)}
        lovelace = {link for link in links(OVERVIEW) if link.startswith("/lovelace/")}
        self.assertTrue(lovelace)
        self.assertEqual(lovelace - views, set())

    def test_every_lovelace_url_in_the_packages_lands_on_a_view(self):
        views = set(paths(OVERVIEW))
        found = set()
        for f in (ROOT / "config/packages").glob("*.yaml"):
            found |= set(re.findall(r"/lovelace/([a-z0-9-]+)", f.read_text()))
        self.assertTrue(found)
        self.assertEqual(found - views, set())


ENERGIA = a3.energia()
KODU_ENERGIA = dc.energy
# Kodu's price chart names the price sensor only because apexcharts needs a state; its data is the
# price statistic, which A3's Energia reads directly.
BORROWED = {dc.PRICE_NOW}


class Energia(unittest.TestCase):
    def test_every_kodu_energia_entity_is_on_the_page(self):
        missing = kodu_entities(KODU_ENERGIA) - ids(ENERGIA) - BORROWED
        self.assertEqual(missing, set())
        self.assertLessEqual(BORROWED, kodu_entities(KODU_ENERGIA))
        self.assertIn(dc.PRICE_STAT, ids(ENERGIA))

    def test_every_kodu_energia_link_is_reachable(self):
        self.assertTrue(links(KODU_ENERGIA))
        self.assertLessEqual(links(KODU_ENERGIA), links(ENERGIA))

    def test_kodus_title_icon_and_columns_with_a3s_background(self):
        for k in ("title", "path", "icon", "max_columns"):
            self.assertEqual(ENERGIA[k], KODU_ENERGIA[k])
        self.assertEqual(ENERGIA["background"], VIEW["background"])

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in ENERGIA["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertLessEqual(
            {"custom:khe-month-card", "custom:khe-days-card", "custom:khe-split-card"}, types
        )

    def test_the_price_bands_are_kodus(self):
        (price,) = [
            c for c in walk(ENERGIA) if c.get("type") == "custom:khe-days-card" and c["days"] == 30
        ]
        thresholds = [t["value"] for t in dc.price_chart["series"][0]["color_threshold"]][1:]
        self.assertEqual(price["series"][0]["bands"], thresholds)

    def test_every_split_row_has_a_statistic_and_a_view(self):
        (split,) = [c for c in walk(ENERGIA) if c.get("type") == "custom:khe-split-card"]
        for part in split["parts"]:
            with self.subTest(part=part["name"]):
                self.assertIn(part["last"], ("month", "last_period"))
                self.assertTrue(part["view"].startswith("/lovelace/"))


SOOJUSPUMP = a3.soojuspump(dc.House(HOUSE, PEOPLE))
KODU_SOOJUSPUMP = dc.soojuspump


class Soojuspump(unittest.TestCase):
    def test_every_kodu_soojuspump_entity_is_on_the_page(self):
        missing = kodu_entities(KODU_SOOJUSPUMP) - ids(without_sheets(SOOJUSPUMP))
        self.assertEqual(missing, set())

    def test_the_settings_subview_is_reachable(self):
        self.assertIn("/lovelace/soojuspump-seaded", links(SOOJUSPUMP))
        self.assertLessEqual(links(KODU_SOOJUSPUMP), links(SOOJUSPUMP))

    def test_kodus_title_icon_and_columns_with_a3s_background(self):
        for k in ("title", "path", "icon", "max_columns"):
            self.assertEqual(SOOJUSPUMP[k], KODU_SOOJUSPUMP[k])
        self.assertEqual(SOOJUSPUMP["background"], VIEW["background"])

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in SOOJUSPUMP["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertIn("custom:khe-reading-card", types)

    def test_the_boost_confirmations_are_kodus(self):
        kodu = confirmations(KODU)
        found = 0
        for card in walk(SOOJUSPUMP):
            for act in card_actions(card):
                if "confirmation" not in act:
                    continue
                found += 1
                key = (card.get("entity"), bare(act))
                self.assertEqual(kodu.get(key), {json.dumps(act["confirmation"])})
        self.assertEqual(found, 2)

    def test_the_boost_tiles_are_full_width_here_and_half_on_kodu(self):
        def boosts(node):
            return [c for c in walk(node) if c.get("entity") == dc.DHW and "icon_tap_action" in c]

        self.assertEqual(len(boosts(SOOJUSPUMP)), 2)
        self.assertTrue(all(c["grid_options"] == {"columns": 12} for c in boosts(SOOJUSPUMP)))
        self.assertTrue(all(c["grid_options"] == {"columns": 6} for c in boosts(VIEW)))
        # the water's temperature is the reading above, not repeated on the tiles
        self.assertTrue(all(isinstance(c["state_text"], str) for c in boosts(SOOJUSPUMP)))

    def test_the_stepper_is_the_shift_and_the_floor_is_the_boilers(self):
        readings = [c for c in walk(SOOJUSPUMP) if c.get("type") == "custom:khe-reading-card"]
        self.assertEqual([c["stepper"]["entity"] for c in readings if "stepper" in c], [dc.SHIFT])
        self.assertEqual([c["line"].get("floor") for c in readings], [None, dc.DHW_FLOOR])

    def test_every_sheet_names_its_source(self):
        for c in walk(SOOJUSPUMP):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))

    def test_kodus_soojuspump_is_unchanged(self):
        before = copy.deepcopy(dc.soojuspump)
        a3.soojuspump(dc.House(HOUSE, PEOPLE))
        self.assertEqual(dc.soojuspump, before)

    def test_energia_is_unchanged(self):
        (days, _price) = [c for c in walk(ENERGIA) if c.get("type") == "custom:khe-days-card"]
        self.assertNotIn("cells", days)
        self.assertNotIn("foot", days)


VENTILATSIOON = a3.ventilatsioon(dc.House(HOUSE, PEOPLE))
KODU_VENT = dc.ventilatsioon


def vent_tiles(node):
    return [c for c in walk(node) if c.get("entity") == dc.MODE and c.get("modes")]


class Ventilatsioon(unittest.TestCase):
    def test_every_kodu_ventilatsioon_entity_is_on_the_page(self):
        kodu = {i for i in kodu_entities(KODU_VENT) | ids(KODU_VENT) if not i.startswith("mdi:")}
        self.assertIn(dc.MODE_LABEL, kodu)
        self.assertEqual(kodu - ids(without_sheets(VENTILATSIOON)), set())

    def test_the_settings_subview_is_reachable(self):
        self.assertIn("/lovelace/komfovent-seaded", links(VENTILATSIOON))
        self.assertLessEqual(links(KODU_VENT), links(VENTILATSIOON))

    def test_kodus_title_and_icon_two_columns_and_a3s_background(self):
        for k in ("title", "path", "icon"):
            self.assertEqual(VENTILATSIOON[k], KODU_VENT[k])
        self.assertEqual(VENTILATSIOON["max_columns"], 2)
        self.assertEqual(VENTILATSIOON["background"], VIEW["background"])

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in VENTILATSIOON["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertLessEqual({"custom:khe-reading-card", "custom:khe-days-card"}, types)

    def test_the_mode_confirmations_are_kodus(self):
        kodu = confirmations(KODU)
        found = 0
        for card in walk(VENTILATSIOON):
            for act in card_actions(card):
                if "confirmation" not in act:
                    continue
                found += 1
                key = (card.get("entity"), bare(act))
                self.assertEqual(kodu.get(key), {json.dumps(act["confirmation"])})
        self.assertEqual(found, len(a3.modes(HOME)))
        self.assertEqual(found, 3)

    def test_the_tile_names_the_mode_and_eco_and_links_nowhere_here(self):
        (here,) = vent_tiles(VENTILATSIOON)
        (kodu,) = vent_tiles(VIEW)
        self.assertEqual(
            here["state_text"], [{"entity": dc.MODE_LABEL}, {"entity": dc.ECO, "label": "ECO"}]
        )
        self.assertNotIn("view", here["history"])
        self.assertEqual(kodu["history"]["view"], "/lovelace/ventilatsioon")
        self.assertEqual(
            {**here, "state_text": kodu["state_text"]}, {**kodu, "history": here["history"]}
        )

    def test_kodus_tile_is_unchanged(self):
        expected = a3.wide(
            a3.tile(
                dc.MODE,
                "Ventilatsioon",
                icon="vent",
                color="blue",
                active=["*"],
                state_text=[{"entity": dc.MODE_LABEL}],
                modes=a3.modes(HOME),
                history={
                    **a3.ONOFF,
                    "active": [m["option"] for m in a3.modes(HOME) if m["option"] != "normal"],
                    "view": "/lovelace/ventilatsioon",
                },
            )
        )
        self.assertEqual(json.dumps(vent_tiles(VIEW)[0]), json.dumps(expected))

    def test_flow_down_is_a_note_not_a_fault(self):
        (chips,) = [c for c in walk(VENTILATSIOON) if c.get("type") == "custom:khe-chips-card"]
        self.assertEqual([f["entity"] for f in chips["faults"]], [dc.VENT_FAULT, dc.VENT_WARNING])
        self.assertEqual([n["entity"] for n in chips["notes"]], [dc.FLOW_DOWN])
        self.assertEqual(chips["status"]["entity"], dc.VENT_POWER)

    def test_the_payback_overlays_the_units_electricity_with_a_ratio(self):
        (days,) = [c for c in walk(VENTILATSIOON) if c.get("type") == "custom:khe-days-card"]
        (s,) = days["series"]
        self.assertEqual((s["statistic"], s["overlay"]["statistic"]), (dc.RECOVERED, dc.AHU_ENERGY))
        self.assertEqual(s["headline"], "ratio")
        self.assertEqual(days["days"], 16)
        cells = {c.get("entity", c.get("kind")): c for c in days["cells"]}
        self.assertEqual(cells[dc.VENT_MONTH]["note_last"], "last_period")
        self.assertEqual(cells[dc.HEATER_MONTH]["bad_above"], 0)
        self.assertIn("avg", cells)

    def test_every_sheet_names_its_source(self):
        for c in walk(VENTILATSIOON):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))

    def test_the_alarms_tile_shows_only_with_alarms(self):
        (t,) = [
            c for c in walk(VENTILATSIOON) if c.get("entity") == dc.ACTIVE_ALARMS and "type" in c
        ]
        self.assertEqual(
            t["visibility"], [{"condition": "state", "entity": dc.ACTIVE_ALARMS, "state_not": ""}]
        )

    def test_kodus_ventilatsioon_is_unchanged(self):
        before = copy.deepcopy(dc.ventilatsioon)
        a3.ventilatsioon(dc.House(HOUSE, PEOPLE))
        self.assertEqual(dc.ventilatsioon, before)


if __name__ == "__main__":
    unittest.main()
