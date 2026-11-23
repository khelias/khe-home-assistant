"""Tests of the A3 Energia view (ADR-008, ADR-013)."""

import unittest

from helpers import HOUSE, MODEL, PEOPLE, ids, links, walk

import dashboard as D

VIEW = D.build(HOUSE, PEOPLE, MODEL)["views"][0]
ENERGIA = D.energia()


class Energia(unittest.TestCase):
    def test_entities_and_links_are_present(self):
        expected = {
            D.MONTH,
            D.LAST_MONTH,
            D.TODAY,
            D.YESTERDAY,
            D.CONSUMPTION,
            D.COST,
            D.STALE,
            D.BOILER_MONTH,
            D.VENT_MONTH,
            D.HEATER_MONTH,
            D.PRICE_STAT,
            D.PRICE_LEVEL,
        }
        self.assertLessEqual(expected, ids(ENERGIA))
        self.assertLessEqual(
            {"/energy", "/lovelace/soojuspump", "/lovelace/ventilatsioon"}, links(ENERGIA)
        )

    def test_metadata_and_background(self):
        self.assertEqual(
            (ENERGIA["title"], ENERGIA["path"], ENERGIA["icon"], ENERGIA["max_columns"]),
            ("Energia", "energia", "mdi:lightning-bolt", 2),
        )
        self.assertEqual(ENERGIA["background"], VIEW["background"])

    def test_cards_are_the_repos_own(self):
        types = {c["type"] for s in ENERGIA["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertLessEqual(
            {"custom:khe-month-card", "custom:khe-days-card", "custom:khe-split-card"}, types
        )

    def test_price_bands_and_days_cards(self):
        (days, price) = [c for c in walk(ENERGIA) if c.get("type") == "custom:khe-days-card"]
        self.assertNotIn("cells", days)
        self.assertNotIn("foot", days)
        self.assertEqual(price["days"], 30)
        self.assertEqual(price["series"][0]["bands"], D.PRICE_BANDS)

    def test_every_split_row_has_a_statistic_and_a_view(self):
        (split,) = [c for c in walk(ENERGIA) if c.get("type") == "custom:khe-split-card"]
        for part in split["parts"]:
            with self.subTest(part=part["name"]):
                self.assertIn(part["last"], ("month", "last_period"))
                self.assertTrue(part["view"].startswith("/lovelace/"))


if __name__ == "__main__":
    unittest.main()
