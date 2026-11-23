"""Tests of the A3 front page (Kodu: entities, actions, sheets and responsive layouts)."""

import unittest

from helpers import (
    HOUSE,
    MODEL,
    PEOPLE,
    card_actions,
    ids,
    links,
    narrow_matches,
    screens,
    unscreened,
    walk,
    without_sheets,
)

import dashboard as D

CONFIG = D.build(HOUSE, PEOPLE, MODEL)
VIEW = CONFIG["views"][0]


class FirstPage(unittest.TestCase):
    def test_required_entities_are_on_the_page_and_usage_stats_in_sheet(self):
        on_page = ids(without_sheets(VIEW))
        expected = {
            D.OUTDOOR,
            D.PRICE_LEVEL,
            D.FORECAST,
            D.WASH,
            D.SAUNA,
            D.TOMORROW,
            D.TOMORROW_READY,
            D.STALE,
            D.TODAY,
            D.YESTERDAY,
            D.MONTH,
            D.ROOF,
            D.PERGOLA_LIGHT,
            D.MODE,
            D.MODE_LABEL,
            D.DHW,
            D.TV,
            D.TV_APP,
            D.LEAVING,
            D.HEATING,
            D.HUMIDITY,
            D.SUPPLY,
            D.EXTRACT,
            D.WAN,
            D.NVR,
            *[e for e, _ in D.ALARMS],
            *[e for e, _ in D.FAULTS],
            *[e for e, _ in D.NET],
            *[e for e, _ in PEOPLE],
        }
        self.assertLessEqual(expected, on_page)
        sheets = [d["usage_history"] for d in walk(VIEW) if "usage_history" in d]
        self.assertLessEqual({D.CONSUMPTION, D.COST}, ids(sheets))

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in VIEW["sections"] for c in s["cards"]}
        self.assertLessEqual(
            types, {"custom:house3d-card"} | {t for t in types if t.startswith("custom:khe-")}
        )
        self.assertIn("custom:house3d-card", types)


class Actions(unittest.TestCase):
    def test_confirmed_actions_cover_vent_modes_boost_and_tv_off(self):
        confirmed = {
            (card.get("entity"), act.get("perform_action"), act["confirmation"]["text"])
            for card in walk(VIEW)
            for act in card_actions(card)
            if "confirmation" in act
        }
        self.assertEqual(
            confirmed,
            {
                (D.MODE, "select.select_option", "Ventilatsioon režiimile Tavaline?"),
                (D.MODE, "select.select_option", "Ventilatsioon režiimile Köök?"),
                (D.MODE, "select.select_option", "Ventilatsioon režiimile Boost?"),
                (
                    D.DHW,
                    "water_heater.set_operation_mode",
                    "Lõpetad boileri kiirsoojenduse? Vesi soojeneb edasi tavarežiimis.",
                ),
                (
                    D.DHW,
                    "water_heater.set_operation_mode",
                    "Boileri kiirsoojendus (Daikin Powerful) sisse? Lõpeb ise, kui vesi on soe.",
                ),
                (D.TV, "media_player.turn_off", "Lülitad teleri välja?"),
            },
        )

    def test_view_links_reach_primary_views(self):
        self.assertLessEqual(
            {
                "/lovelace/energia",
                "/lovelace/soojuspump",
                "/lovelace/ventilatsioon",
                "/lovelace/pergola",
                "/lovelace/teler",
                "/lovelace/susteem",
            },
            links(VIEW),
        )

    def test_the_roof_and_the_light_controls(self):
        (roof,) = [c for c in walk(VIEW) if c.get("entity") == D.ROOF and "buttons" in c]
        self.assertEqual(
            [b["tap_action"]["perform_action"] for b in roof["buttons"]],
            ["cover.open_cover", "cover.close_cover"],
        )
        (light,) = [c for c in walk(VIEW) if c.get("entity") == D.PERGOLA_LIGHT]
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


class Layout(unittest.TestCase):
    def test_without_inputs_it_builds_without_the_hero(self):
        config = D.build({}, [], None)
        (view,) = config["views"]
        self.assertEqual(len(view["sections"]), 4)
        types = [c["type"] for s in view["sections"] for c in s["cards"]]
        self.assertNotIn("custom:house3d-card", types)
        self.assertIn("custom:khe-chips-card", types)
        self.assertEqual(view["sections"][0]["column_span"], view["max_columns"])
        self.assertTrue(all("row_span" not in sec for sec in view["sections"]))
        self.assertEqual(
            [sec["column_span"] for sec in view["sections"][1:]], [1, 1, 1], "no span of two"
        )
        queries = {q for s in view["sections"] for c in s["cards"] for q in screens(c)}
        self.assertFalse(queries & {D.FOUR, D.BELOW_FOUR})

    def test_the_six_sections_and_their_spans(self):
        self.assertEqual(VIEW["max_columns"], 4)
        spans = [(s["column_span"], s.get("row_span", 1)) for s in VIEW["sections"]]
        self.assertEqual(spans, [(1, 2), (2, 3), (1, 2), (1, 1), (1, 1), (2, 1)])
        self.assertEqual(VIEW["sections"][2]["cards"][0]["heading"], "Elekter")
        self.assertEqual(VIEW["sections"][3]["cards"][0]["heading"], "Juhtimine")
        for n in (4, 5):
            self.assertEqual(VIEW["sections"][n]["cards"][0]["heading"], "Kliima")
        self.assertIn("var(--primary-background-color)", VIEW["background"])

    def test_each_doubled_section_is_all_below_four_or_all_four(self):
        below, half, _elekter, _controls, climate, climate_four = VIEW["sections"]
        for sec, query in (
            (below, D.BELOW_FOUR),
            (climate, D.BELOW_FOUR),
            (half, D.FOUR),
            (climate_four, D.FOUR),
        ):
            for c in sec["cards"]:
                self.assertIn(query, screens(c), c["type"])
        for sec in VIEW["sections"][2:4]:
            for c in sec["cards"]:
                self.assertFalse({D.FOUR, D.BELOW_FOUR} & set(screens(c)), c["type"])
        self.assertEqual(
            [unscreened(c) for c in climate["cards"]], [unscreened(c) for c in climate_four["cards"]]
        )

    def test_one_3d_card_on_each_side_of_four_columns(self):
        heroes = [c for c in walk(VIEW) if c.get("type") == "custom:house3d-card"]
        self.assertEqual(len(heroes), 2)
        below, four = heroes
        self.assertEqual(screens(below), [D.BELOW_FOUR])
        self.assertEqual(screens(four), [D.FOUR])
        self.assertIs(below["stretch"], True)
        self.assertEqual(four["stretch"], "beside")
        self.assertEqual(below["height"], D.HERO_HEIGHT)
        self.assertEqual(below["model"], MODEL)
        self.assertEqual(
            {k: v for k, v in below.items() if k not in ("stretch", "visibility")},
            {k: v for k, v in four.items() if k not in ("stretch", "visibility")},
        )

    def test_below_four_the_first_section_puts_the_title_over_the_hero_on_wide_screens(self):
        title, hero, chips, narrow = VIEW["sections"][0]["cards"]
        self.assertEqual((title["part"], chips["part"]), ("title", "chips"))
        self.assertNotIn("part", narrow)
        self.assertEqual(screens(title), [D.WIDE, D.BELOW_FOUR])
        self.assertEqual(screens(chips), [D.WIDE, D.BELOW_FOUR])
        self.assertEqual(screens(narrow), [D.NARROW, D.BELOW_FOUR])
        self.assertEqual(screens(hero), [D.BELOW_FOUR])
        strip = lambda c: {k: v for k, v in c.items() if k not in ("part", "visibility")}
        self.assertEqual(strip(title), strip(narrow))
        self.assertEqual(strip(chips), strip(narrow))

    def test_from_four_the_left_half_holds_the_title_the_hero_and_the_chips(self):
        title, hero, chips = VIEW["sections"][1]["cards"]
        self.assertEqual(
            (title["part"], hero["type"], chips["part"]), ("title", "custom:house3d-card", "chips")
        )
        for c in (title, hero, chips):
            self.assertEqual(screens(c), [D.FOUR])

    def test_the_phone_sees_the_same_sections_and_cards_as_without_hero(self):
        def phone(c):
            return all(narrow_matches(q) for q in screens(c))

        shown = [[unscreened(c) for c in s["cards"] if phone(c)] for s in VIEW["sections"]]
        shown = [cards for cards in shown if cards]
        hero, narrow = shown[0]
        self.assertEqual(hero["type"], "custom:house3d-card")
        self.assertEqual(narrow["type"], "custom:khe-chips-card")
        self.assertNotIn("part", narrow)
        plain = D.build(HOUSE, PEOPLE, None)["views"][0]["sections"]
        self.assertEqual(shown[1:], [[unscreened(c) for c in s["cards"]] for s in plain[1:]])

    def test_a_fresh_copy_every_call(self):
        first = D.build(HOUSE, PEOPLE, MODEL)
        first["views"][0]["sections"].clear()
        self.assertTrue(D.build(HOUSE, PEOPLE, MODEL)["views"][0]["sections"])


if __name__ == "__main__":
    unittest.main()
