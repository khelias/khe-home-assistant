"""Tests of the A3 Teler view (ADR-017)."""

import unittest

from helpers import H, HOUSE, MODEL, PEOPLE, cards_of, ids, tiles_of

import dashboard as D

VIEW = D.build(HOUSE, PEOPLE, MODEL)["views"][0]
OVERVIEW = D.overview(HOUSE, PEOPLE, MODEL)
TELER = D.teler(H)


class Teler(unittest.TestCase):
    def test_entities_metadata_and_background(self):
        expected = {
            D.TV,
            D.TV_APP,
            D.TV_SESSIONS,
            D.TV_YESTERDAY,
            *{e for _, e, _, _ in D.TV_APPS},
            *{w["entity"] for w in D.tv_week["entities"]},
        }
        self.assertLessEqual(expected, ids(TELER))
        self.assertEqual(
            (TELER["title"], TELER["path"], TELER["icon"], TELER["max_columns"]),
            ("Teler", "teler", "mdi:television", 2),
        )
        self.assertEqual(TELER["background"], VIEW["background"])
        types = {c["type"] for s in TELER["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        (chips,) = cards_of(TELER, "chips-card")
        self.assertNotIn("status", chips)

    def test_actions_confirmations_and_profiles(self):
        (tv,) = cards_of(TELER, "tv-card")
        b = tv["buttons"]
        self.assertEqual(b["power_off"]["perform_action"], "media_player.turn_off")
        self.assertEqual(b["power_off"]["confirmation"], {"text": "Lülitad teleri välja?"})
        self.assertEqual(b["power_off"]["target"], {"entity_id": D.TV})
        self.assertEqual(
            b["power_on"],
            {
                "action": "perform-action",
                "perform_action": "media_player.turn_on",
                "target": {"entity_id": D.TV},
            },
        )
        self.assertEqual(b["remote"], {"action": "more-info", "entity": D.TV})
        self.assertNotIn("on", tv, "the English walk translates an `on` key")
        self.assertNotIn("off", tv)
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
        want = [(n, e, c) for n, e, _, c in D.TV_APPS]
        (tv,) = cards_of(TELER, "tv-card")
        self.assertEqual([(a["name"], a["color"]) for a in tv["apps"]], [(n, c) for n, _, c in want])
        today, sessions = cards_of(TELER, "usage-card")
        self.assertEqual((today["part"], sessions["part"]), ("today", "sessions"))
        for u in (today, sessions):
            self.assertEqual([(x["name"], x["entity"], x["color"]) for x in u["entities"]], want)
        self.assertEqual(today["compare"], {"entity": D.TV_YESTERDAY})
        self.assertEqual(sessions["sessions"], D.TV_SESSIONS)
        (days,) = cards_of(TELER, "days-card")
        self.assertEqual(days["days"], 7)
        (series,) = days["series"]
        stack = series["stack"]
        self.assertEqual(
            [(x["name"], x["statistic"], x["color"], x["today"]["entity"]) for x in stack],
            [(n, w["entity"], c, e) for (n, e, c), w in zip(want, D.tv_week["entities"], strict=True)],
        )

    def test_kodus_tv_tile_still_lands_here(self):
        (tile,) = tiles_of(VIEW, D.TV)
        self.assertEqual(tile["history"]["view"], "/lovelace/" + TELER["path"])
        self.assertIn(TELER, OVERVIEW["views"])

    def test_without_profiles_no_profile_buttons(self):
        bare = D.teler(D.House({}, []))
        (tv,) = cards_of(bare, "tv-card")
        self.assertEqual(tv["profiles"], [])


if __name__ == "__main__":
    unittest.main()
