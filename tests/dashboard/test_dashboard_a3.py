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
import house3d_model

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
    """Every entity id the A3 cards read: any string value that is one, whatever its key, but a
    service name (`cover.open_cover` reads like an id)."""
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
            | ids(PERGOLA)
            | ids(VALVE)
            | ids(CAMERAS)
            | ids(TELER)
        )
        self.assertEqual(quoted & spelled, set())


VALVE = a3.valve(MODEL)
H = dc.House(HOUSE, PEOPLE)
CAMERAS = a3.cameras(H)
TELER = a3.teler(H)
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
            "pergola": PERGOLA,
            "valve": VALVE,
            "kaamerad": CAMERAS,
            "teler": TELER,
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


class DaysSheets(unittest.TestCase):
    """A days card's headline opens its series' sheet over 30 days, 90 days and 12 months
    (ADR-013): the series names the sheet's title and a real entity for "Rohkem". A stack has no one
    statistic and no sheet (ADR-017)."""

    def test_every_days_series_has_a_title_and_a_real_entity_for_more(self):
        series = [
            s
            for v in OVERVIEW["views"]
            for c in walk(v)
            if c.get("type") == "custom:khe-days-card"
            for s in c["series"]
        ]
        self.assertEqual(len(series), 6)
        stacks = [s for s in series if "stack" in s]
        self.assertEqual(len(stacks), 1)
        self.assertTrue(all("statistic" not in s and "more" not in s for s in stacks))
        series = [s for s in series if "stack" not in s]
        for s in series:
            with self.subTest(s["name"], statistic=s["statistic"]):
                self.assertTrue(s["title"])
                self.assertRegex(s["more"], r"^[a-z_]+\.[a-z0-9_]+$")
        titles = [s["title"] for s in series]
        self.assertEqual(len(set(titles)), len(titles))


if __name__ == "__main__":
    unittest.main()


PERGOLA = a3.pergola()
KODU_PERGOLA = dc.pergola


def tiles_of(node, entity):
    return [
        c for c in walk(node) if c.get("type") == "custom:khe-tile-card" and c["entity"] == entity
    ]


class Pergola(unittest.TestCase):
    def test_every_kodu_pergola_entity_is_on_the_page(self):
        kodu = {i for i in ids(KODU_PERGOLA) if not i.startswith("mdi:")}
        self.assertIn(dc.WEATHER, kodu)
        self.assertEqual(kodu - ids(without_sheets(PERGOLA)), set())

    def test_the_settings_subview_is_reachable(self):
        self.assertIn("/lovelace/pergola-seaded", links(PERGOLA))
        self.assertLessEqual(links(KODU_PERGOLA), links(PERGOLA))

    def test_kodus_title_path_and_icon_two_columns_and_a3s_background(self):
        for k in ("title", "path", "icon"):
            self.assertEqual(PERGOLA[k], KODU_PERGOLA[k])
        self.assertEqual(PERGOLA["path"], "pergola")
        self.assertEqual(PERGOLA["max_columns"], 2)
        self.assertEqual(PERGOLA["background"], VIEW["background"])

    def test_cards_are_the_repos_own_with_the_forecast_in_the_weather_cards_place(self):
        types = {c["type"] for s in PERGOLA["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        (fc,) = [c for c in walk(PERGOLA) if c.get("type") == "custom:khe-forecast-card"]
        self.assertEqual(fc["entity"], dc.WEATHER)
        self.assertEqual([x["entity"] for x in fc["cells"]], [dc.RAIN_NOW, dc.RAIN_2H, dc.OUTDOOR])
        for x in fc["cells"]:
            self.assertEqual(x["history"], a3.MEAN)

    def test_the_status_reads_rain_above_zero(self):
        (chips,) = [c for c in walk(PERGOLA) if c.get("type") == "custom:khe-chips-card"]
        self.assertEqual(
            chips["status"], {"entity": dc.RAIN_NOW, "above": 0, "on": "Sajab", "ok": "Kuiv"}
        )

    def test_the_roof_row_runs_the_three_cover_services_and_shows_none_pressed(self):
        (roof,) = [c for c in tiles_of(PERGOLA, dc.ROOF)]
        self.assertEqual(
            [(m["name"], m["tap_action"]["perform_action"]) for m in roof["modes"]],
            [
                ("Ava", "cover.open_cover"),
                ("Stopp", "cover.stop_cover"),
                ("Sulge", "cover.close_cover"),
            ],
        )
        for m in roof["modes"]:
            self.assertEqual(m["tap_action"]["target"], {"entity_id": dc.ROOF})
            self.assertNotIn("option", m)
        self.assertNotIn("history", roof)

    def test_the_segment_is_the_tone_select_with_its_package_options(self):
        (light,) = tiles_of(PERGOLA, dc.PERGOLA_LIGHT)
        self.assertEqual(light["modes_entity"], dc.TONE)
        yaml = (ROOT / "config/packages/pergola.yaml").read_text()
        block = yaml.split(dc.TONE.split(".")[1] + ":", 1)[1].split("options:", 1)[1]
        options = re.findall(r"^\s+- (\S+)$", block.split("\n\n", 1)[0], re.M)
        self.assertEqual([m["option"] for m in light["modes"]], options)
        self.assertEqual(light["slider"], {"attribute": "brightness"})

    def test_the_light_sheet_links_nowhere_here_and_to_pergola_from_kodu(self):
        (here,) = tiles_of(PERGOLA, dc.PERGOLA_LIGHT)
        (kodu,) = tiles_of(VIEW, dc.PERGOLA_LIGHT)
        self.assertEqual(here["history"], a3.ONOFF)
        self.assertEqual(kodu["history"]["view"], "/lovelace/pergola")

    def test_kodus_light_tile_is_unchanged(self):
        expected = {
            "type": "custom:khe-tile-card",
            "style": "a3",
            "entity": dc.PERGOLA_LIGHT,
            "name": "Pergola valgus",
            "icon": "bulb",
            "color": "yellow",
            "icon_tap_action": {"action": "toggle"},
            "icon_label": "Pergola valgus sisse või välja",
            "slider": {"attribute": "brightness"},
            "history": {"source": "history", "view": "/lovelace/pergola"},
            "wide": True,
            "grid_options": {"columns": 12},
        }
        self.assertEqual(json.dumps(tiles_of(VIEW, dc.PERGOLA_LIGHT)[0]), json.dumps(expected))

    def test_the_light_line_is_its_off_time_while_on_and_the_rule_on(self):
        (light,) = tiles_of(PERGOLA, dc.PERGOLA_LIGHT)
        (part,) = light["state_text"]
        self.assertEqual((part["entity"], part["format"]), (dc.LIGHT_OFF, "when"))
        self.assertEqual(part["if"], [{"state": "on"}, {"entity": dc.LIGHT_AUTO, "state": "on"}])

    def test_the_rules_switch_their_booleans_and_say_when_their_automations_ran(self):
        rules = [c for c in walk(PERGOLA) if c.get("switch")]
        self.assertEqual([c["entity"] for c in rules], [dc.ROOF_AUTO, dc.LIGHT_AUTO])
        self.assertEqual(
            [[(p["entity"], p.get("attribute")) for p in c["state_text"]] for c in rules],
            [
                [(dc.RAIN_RULE, "last_triggered")],
                [(dc.SUNSET_RULE, "last_triggered"), (dc.LIGHT_OFF, None)],
            ],
        )
        for c in rules:
            for p in c["state_text"]:
                self.assertEqual(p["if"], [{"state": "on"}])

    def test_the_rules_are_the_packages_automations(self):
        yaml = (ROOT / "config/packages/pergola.yaml").read_text()
        aliases = re.findall(r'alias: "(Pergola: [^"]+)"', yaml)
        slug = {re.sub(r"[^a-z0-9]+", "_", a.lower().replace("õ", "o")).strip("_") for a in aliases}
        for e in (dc.RAIN_RULE, dc.SUNSET_RULE):
            self.assertIn(e.split(".")[1], slug)

    def test_every_sheet_names_its_source(self):
        for c in walk(PERGOLA):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))

    def test_kodus_pergola_is_unchanged(self):
        before = copy.deepcopy(dc.pergola)
        a3.pergola()
        self.assertEqual(dc.pergola, before)


FIXTURE = house3d_model.with_room_names(
    house3d_model.merge(
        house3d_model.read_layers(ROOT / "tests/house3d/fixture-model.md"), house3d_model.CARD
    )
)
FIXTURE_PIRS = [d["entity"] for d in FIXTURE["devices"] if d["type"] == "motion"]


def placed(model, pirs):
    """The fixture house with its PIRs under the given ids, in order."""
    out = copy.deepcopy(model)
    rename = dict(zip(FIXTURE_PIRS, pirs, strict=False))
    for d in out["devices"]:
        d["entity"] = rename.get(d["entity"], d["entity"])
    return out


class Valve(unittest.TestCase):
    def test_every_stock_valve_entity_is_on_the_page(self):
        stock = {i for i in ids(dc.valve) if not i.startswith("mdi:")}
        self.assertIn(dc.VALVE_LINK_RAW, stock)
        self.assertEqual(stock - ids(without_sheets(VALVE)), set())

    def test_stock_title_path_and_icon_two_columns_and_a3s_background(self):
        for k in ("title", "path", "icon"):
            self.assertEqual(VALVE[k], dc.valve[k])
        self.assertEqual(VALVE["max_columns"], 2)
        self.assertEqual(VALVE["background"], VIEW["background"])
        types = {c["type"] for s in VALVE["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))

    def test_the_alarm_tiles_open_more_info_and_the_page_calls_no_service(self):
        for e, n in dc.ALARMS:
            (t,) = tiles_of(VALVE, e)
            self.assertEqual(t["name"], n)
            self.assertNotIn("tap_action", t, "the body opens more-info by default")
            self.assertEqual([m["option"] for m in t["modes"]], [s for s, _ in a3.ALARM_MODES])
            for m in t["modes"]:
                self.assertEqual(m["tap_action"], {"action": "more-info"})
        for c in walk(VALVE):
            for act in card_actions(c):
                self.assertNotEqual(act.get("action"), "perform-action", c.get("type"))
                self.assertNotEqual(act.get("action"), "toggle", c.get("type"))

    def test_the_status_runs_alarm_to_disarmed_over_both_partitions(self):
        (chips,) = [c for c in walk(VALVE) if c.get("type") == "custom:khe-chips-card"]
        rules = chips["status"]["map"]
        self.assertEqual(
            [r["state"] for r in rules], ["triggered", "pending", "arming", "armed_*", "disarmed"]
        )
        for r in rules:
            self.assertEqual(r["entities"], [e for e, _ in dc.ALARMS])
        self.assertEqual({f["entity"] for f in chips["faults"]}, {dc.SMOKE, dc.VALVE_LINK})

    def test_a_door_is_red_while_open_and_either_partition_armed(self):
        (doors,) = [
            c
            for c in walk(VALVE)
            if c.get("type") == "custom:khe-reading-card"
            and any(x["entity"] == dc.DOORS[0][0] for x in c.get("cells", []))
        ]
        self.assertNotIn("entity", doors)
        self.assertEqual([x["entity"] for x in doors["cells"]], [e for e, _ in dc.DOORS])
        for x in doors["cells"]:
            self.assertEqual(x["note"], {"last_on": True, "label": "avati"})
            self.assertEqual(
                x["bad_if"],
                [
                    [{"entity": x["entity"], "state": "on"}, {"entity": a, "state": "armed_*"}]
                    for a, _ in dc.ALARMS
                ],
            )

    def test_the_system_cells_and_the_notice(self):
        cards = [c for c in walk(VALVE) if c.get("type") == "custom:khe-reading-card"]
        system = cards[-1]
        self.assertEqual(
            [x["entity"] for x in system["cells"]],
            [dc.SMOKE, dc.VALVE_BATTERY, dc.VALVE_LINK, dc.TAMPER, dc.SIREN],
        )
        self.assertEqual(system["cells"][1]["note"]["entity"], dc.VALVE_SUPPLY)
        self.assertIn("Teavitus tuleb", system["note"]["text"])

    def test_without_a_model_the_motion_cards_have_no_plan_and_the_public_names(self):
        plan_card, motion = [
            c for c in walk(a3.valve(None)) if c.get("type") == "custom:khe-motion-card"
        ]
        self.assertEqual((plan_card["part"], motion["part"]), ("plan", "rows"))
        self.assertEqual(plan_card["groups"], motion["groups"])
        self.assertNotIn("plan", plan_card)
        self.assertNotIn("plan", motion)
        rows = [r for g in motion["groups"] for r in g["rooms"]]
        self.assertEqual([r["entity"] for r in rows], dc.SHARED + dc.PRIVATE)
        self.assertEqual(
            [r["name"] for r in rows], [dc.MOTION_ROOMS[e] for e in dc.SHARED + dc.PRIVATE]
        )
        self.assertEqual([g["name"] for g in motion["groups"]], ["Ühisruumid", "Toad"])
        self.assertEqual(motion["alarms"], [{"entity": e, "name": n} for e, n in dc.ALARMS])

    def test_the_slice_has_rooms_walls_doors_and_placed_pirs_and_never_the_devices(self):
        pirs = dc.SHARED + dc.PRIVATE
        model = placed(FIXTURE, pirs)
        sl = a3.plan_slice(model, pirs)
        self.assertEqual(sorted(sl), ["pirs", "rooms", "walls"])
        self.assertNotIn('"devices"', json.dumps(sl))
        for w in sl["walls"]:
            self.assertEqual(sorted(w), ["a", "b", "doors", "t"])
        # every string is a room id, a placed PIR's id or the name of a room with a PIR
        room_ids = {r["id"] for r in sl["rooms"]}
        sensed = {p["room"] for p in sl["pirs"]}
        self.assertEqual({r["id"] for r in sl["rooms"] if "name" in r}, sensed)
        names = {r["name"] for r in sl["rooms"] if "name" in r}
        strings = {v for d in walk(sl) for v in d.values() if isinstance(v, str)}
        self.assertEqual(strings - room_ids - names - {p["entity"] for p in sl["pirs"]}, set())
        # only the PIRs the model places in a room, in the card's order
        where = {d["entity"]: d["room"] for d in model["devices"]}
        self.assertEqual(
            sl["pirs"], [{"entity": e, "room": where[e]} for e in pirs if where.get(e) in room_ids]
        )
        self.assertIsNone(a3.plan_slice(None, pirs))
        self.assertIsNone(a3.plan_slice(FIXTURE, ["binary_sensor.nowhere"]))

    def test_rows_take_their_rooms_name_unless_two_pirs_share_it(self):
        pirs = dc.SHARED + dc.PRIVATE
        sl = a3.plan_slice(placed(FIXTURE, pirs), pirs)
        names = a3.motion_names(sl)
        rooms = {r["id"]: r.get("name") for r in sl["rooms"]}
        count = {}
        for p in sl["pirs"]:
            count[p["room"]] = count.get(p["room"], 0) + 1
        for p in sl["pirs"]:
            expected = rooms[p["room"]] if count[p["room"]] == 1 else dc.MOTION_ROOMS[p["entity"]]
            self.assertEqual(names[p["entity"]], expected)
        self.assertIn(2, count.values(), "the fixture has a room with two PIRs")
        plan_card, rows_card = [
            c
            for c in walk(a3.valve(placed(FIXTURE, pirs)))
            if c.get("type") == "custom:khe-motion-card"
        ]
        self.assertEqual(plan_card["plan"], sl)
        self.assertNotIn("plan", rows_card, "only the card that draws it carries the slice")

    def test_the_cards_plan_fixture_is_the_test_houses_slice(self):
        pirs = FIXTURE_PIRS + ["binary_sensor.demo_room_a_motion"]
        fixture = json.loads((ROOT / "tests/cards/fixtures/plan.json").read_text())
        self.assertEqual(fixture, a3.plan_slice(FIXTURE, pirs))

    def test_stock_valve_is_unchanged(self):
        before = copy.deepcopy(dc.valve)
        a3.valve(FIXTURE)
        self.assertEqual(dc.valve, before)


def cards_of(node, kind):
    return [c for c in walk(node) if c.get("type") == "custom:khe-" + kind]


class Kaamerad(unittest.TestCase):
    def test_every_stock_entity_but_the_motion_sensors_is_on_the_page(self):
        stock = {i for i in ids(dc.cameras(H)) if not i.startswith("mdi:")}
        motion = {"binary_sensor." + slug + "_liikumine" for slug, _ in H.cams}
        self.assertLessEqual(motion, stock)
        page = ids(without_sheets(CAMERAS))
        self.assertEqual(stock - motion - page, set())
        self.assertEqual(page & motion, set(), "motion fires every half minute: noise")
        switches = {"switch." + slug + "_liikumistuvastus" for slug, _ in H.cams}
        self.assertLessEqual(switches, page)

    def test_stock_title_path_and_icon_two_columns_and_a3s_background(self):
        stock = dc.cameras(H)
        for k in ("title", "path", "icon"):
            self.assertEqual(CAMERAS[k], stock[k])
        self.assertEqual(CAMERAS["max_columns"], 2)
        self.assertEqual(CAMERAS["background"], VIEW["background"])
        types = {c["type"] for s in CAMERAS["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))

    def test_the_status_runs_the_nvr_then_each_camera_then_all_well(self):
        (chips,) = cards_of(CAMERAS, "chips-card")
        rules = chips["status"]["map"]
        subs = ["camera." + slug + "_alamvoog" for slug, _ in H.cams]
        self.assertEqual(
            [(r["entities"], r["state"], r["tone"]) for r in rules],
            [([dc.NVR], "!OK", "bad")]
            + [([e], "unavailable", "bad") for e in subs]
            + [([dc.NVR], "OK", "ok")],
        )
        self.assertEqual([r["text"] for r in rules[1:-1]], [n + " ei vasta" for _, n in H.cams])

    def test_the_hero_is_the_house_files_first_camera_and_each_opens_its_live_view(self):
        (cams,) = cards_of(CAMERAS, "cameras-card")
        self.assertEqual(
            [(c["entity"], c["name"]) for c in cams["cameras"]],
            [("camera." + slug + "_alamvoog", n) for slug, n in H.cams],
        )
        views = {"/lovelace/" + p for p in paths(OVERVIEW)}
        for c, (slug, _) in zip(cams["cameras"], H.cams, strict=True):
            self.assertEqual(c["tap_action"]["action"], "navigate")
            self.assertEqual(c["tap_action"]["navigation_path"], "/lovelace/kaamera-" + slug)
            self.assertIn(c["tap_action"]["navigation_path"], views)

    def test_salvestised_only_with_the_nvr_app(self):
        url = [d for d in walk(CAMERAS) if d.get("action") == "url"]
        self.assertEqual(url, [{"action": "url", "url_path": HOUSE["nvr_app_url"]}])
        bare = a3.cameras(dc.House({**HOUSE, "nvr_app_url": None}, PEOPLE))
        self.assertEqual([d for d in walk(bare) if d.get("action") == "url"], [])
        self.assertEqual(
            [t["name"] for t in tiles_of(bare, dc.NVR)], ["Seaded"], "the settings row stays"
        )

    def test_the_system_cells_count_the_substreams_and_the_switches(self):
        (reading,) = cards_of(CAMERAS, "reading-card")
        nvr, cams, detect = reading["cells"]
        self.assertEqual(nvr["entity"], dc.NVR)
        self.assertEqual(nvr["bad_if"], [{"state": "!OK"}])
        self.assertEqual(nvr["words"], {"OK": "korras", "*": "viga"})
        self.assertEqual(
            [e["entity"] for e in cams["count"]["entities"]],
            ["camera." + slug + "_alamvoog" for slug, _ in H.cams],
        )
        self.assertEqual(cams["count"]["state"], "*")
        self.assertEqual(
            [e["entity"] for e in detect["count"]["entities"]],
            ["switch." + slug + "_liikumistuvastus" for slug, _ in H.cams],
        )
        self.assertEqual(detect["count"]["state"], "on")

    def test_without_cameras_no_cameras_card(self):
        bare = a3.cameras(dc.House({}, []))
        self.assertEqual(cards_of(bare, "cameras-card"), [])
        self.assertEqual(len(cards_of(bare, "chips-card")), 1)

    def test_stock_cameras_is_unchanged(self):
        before = copy.deepcopy(dc.cameras(H))
        a3.cameras(H)
        self.assertEqual(dc.cameras(H), before)


class Teler(unittest.TestCase):
    """Teler in A3's look (ADR-017)."""

    def test_every_stock_entity_is_on_the_page(self):
        stock = {i for i in ids(dc.teler(H)) if not i.startswith("mdi:")}
        self.assertEqual(stock - ids(TELER), set())
        self.assertLessEqual({dc.TV_SESSIONS, dc.TV_YESTERDAY}, ids(TELER))

    def test_stock_title_path_and_icon_two_columns_and_a3s_background(self):
        stock = dc.teler(H)
        for k in ("title", "path", "icon"):
            self.assertEqual(TELER[k], stock[k])
        self.assertEqual(TELER["max_columns"], 2)
        self.assertEqual(TELER["background"], VIEW["background"])
        types = {c["type"] for s in TELER["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        (chips,) = cards_of(TELER, "chips-card")
        self.assertNotIn("status", chips)

    def test_every_stock_action_with_its_confirmation_and_turn_on(self):
        (tv,) = cards_of(TELER, "tv-card")
        b = tv["buttons"]
        self.assertEqual(b["power_off"]["perform_action"], "media_player.turn_off")
        self.assertEqual(b["power_off"]["confirmation"], {"text": "Lülitad teleri välja?"})
        self.assertEqual(b["power_off"]["target"], {"entity_id": dc.TV})
        self.assertEqual(
            b["power_on"],
            {
                "action": "perform-action",
                "perform_action": "media_player.turn_on",
                "target": {"entity_id": dc.TV},
            },
        )
        self.assertEqual(b["remote"], {"action": "more-info", "entity": dc.TV})
        self.assertNotIn("on", tv, "the English walk translates an `on` key")
        self.assertNotIn("off", tv)
        stock = [x["tap_action"] for x in dc.teler(H)["badges"]]
        self.assertEqual(
            [a for a in stock if a["action"] != "more-info"],
            [b["power_off"]] + [p["tap_action"] for p in tv["profiles"]],
        )
        self.assertEqual(
            [(p["name"], p["lock"], p["tap_action"]) for p in tv["profiles"]],
            [
                (
                    "Profiil A",
                    True,
                    {
                        "action": "perform-action",
                        "perform_action": "script.teler_profiil_1",
                        "confirmation": {
                            "text": "Vahetad teleri profiilile Profiil A? PIN tuleb sisestada teleris."
                        },
                    },
                ),
                (
                    "Profiil B",
                    False,
                    {
                        "action": "perform-action",
                        "perform_action": "script.teler_profiil_2",
                        "confirmation": {"text": "Vahetad teleri profiilile Profiil B?"},
                    },
                ),
            ],
        )

    def test_names_and_colours_from_tv_apps(self):
        want = [(n, e, c) for n, e, _, c in dc.TV_APPS]
        (tv,) = cards_of(TELER, "tv-card")
        self.assertEqual([(a["name"], a["color"]) for a in tv["apps"]], [(n, c) for n, _, c in want])
        today, sessions = cards_of(TELER, "usage-card")
        self.assertEqual((today["part"], sessions["part"]), ("today", "sessions"))
        for u in (today, sessions):
            self.assertEqual([(x["name"], x["entity"], x["color"]) for x in u["entities"]], want)
        self.assertEqual(today["compare"], {"entity": dc.TV_YESTERDAY})
        self.assertEqual(sessions["sessions"], dc.TV_SESSIONS)
        (days,) = cards_of(TELER, "days-card")
        self.assertEqual(days["days"], 7)
        (series,) = days["series"]
        stack = series["stack"]
        self.assertEqual(
            [(x["name"], x["statistic"], x["color"], x["today"]["entity"]) for x in stack],
            [(n, w["entity"], c, e) for (n, e, c), w in zip(want, dc.tv_week["entities"])],
        )

    def test_kodus_tv_tile_still_lands_here(self):
        (tile,) = tiles_of(VIEW, dc.TV)
        self.assertEqual(tile["history"]["view"], "/lovelace/" + TELER["path"])
        self.assertIn(TELER, OVERVIEW["views"])

    def test_without_profiles_no_profile_buttons(self):
        bare = a3.teler(dc.House({}, []))
        (tv,) = cards_of(bare, "tv-card")
        self.assertEqual(tv["profiles"], [])

    def test_stock_teler_is_unchanged(self):
        before = copy.deepcopy(dc.teler(H))
        a3.teler(H)
        self.assertEqual(dc.teler(H), before)
