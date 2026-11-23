"""Tests of the assembled Overview dashboard, camera subviews, 3D view and package invariants."""

import json
import re
import subprocess
import sys
import unittest

from helpers import HOUSE, MODEL, PEOPLE, ROOT, fixture_model, ids, links, paths, walk

import dashboard as D

OVERVIEW = D.overview(HOUSE, PEOPLE, MODEL)
VIEW = D.build(HOUSE, PEOPLE, MODEL)["views"][0]


class Overview(unittest.TestCase):
    def test_import_reads_no_file_and_needs_no_websockets(self):
        probe = (
            "import builtins, io, sys\n"
            "def no(*a, **k): raise AssertionError(f'opened {a[0]!r}')\n"
            "builtins.open = io.open = no\n"
            f"sys.path.insert(0, {str(ROOT / 'scripts')!r})\n"
            "import dashboard\n"
            "assert 'websockets' not in sys.modules\n"
        )
        r = subprocess.run(
            [sys.executable, "-I", "-c", probe], check=False, capture_output=True, text=True
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_view_order_has_a3_views_first_and_3d_last(self):
        self.assertEqual(OVERVIEW["views"][0], VIEW)
        self.assertEqual(
            paths(OVERVIEW),
            [
                "kodu",
                "energia",
                "soojuspump",
                "ventilatsioon",
                "pergola",
                "valve",
                "kaamerad",
                "teler",
                "susteem",
                "komfovent-seaded",
                "soojuspump-seaded",
                "pergola-seaded",
                "kaamerad-seaded",
                "kaamera-cam_one",
                "kaamera-cam_two",
                "maja-3d",
            ],
        )

    def test_without_inputs_no_3d_view_no_hero_and_no_camera_subview(self):
        config = D.overview({}, [], None)
        p = paths(config)
        self.assertNotIn("maja-3d", p)
        self.assertFalse([x for x in p if x.startswith("kaamera-")])
        self.assertIn("kaamerad", p)
        self.assertIn("kaamerad-seaded", p)
        self.assertEqual(p[0], "kodu")
        types = [c["type"] for c in config["views"][0]["sections"][0]["cards"]]
        self.assertNotIn("custom:house3d-card", types)

    def test_with_the_fixture_model_the_3d_view_is_last(self):
        config = D.overview({}, [], fixture_model())
        self.assertEqual(paths(config)[-1], "maja-3d")
        self.assertEqual(config["views"][-1]["cards"][0]["type"], "custom:house3d-card")

    def test_a_camera_tap_in_the_3d_card_opens_its_own_subview(self):
        house = {"cams": [["test_a", "A"], ["test_b", "B"]]}
        config = D.overview(house, [], fixture_model())
        (card,) = [v for v in config["views"] if v["path"] == "maja-3d"][0]["cards"]
        self.assertEqual(
            card["views"],
            {
                "camera.test_a": "/lovelace/kaamera-test_a",
                "camera.test_b": "/lovelace/kaamera-test_b",
            },
        )
        for path in card["views"].values():
            self.assertIn(path.removeprefix("/lovelace/"), paths(config))

    def test_a_cameras_subview_steps_to_the_nearest_camera_first(self):
        h = D.House({"cams": [["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"]]}, [])
        pos = {"camera.a": [0, 2, 0], "camera.b": [9, 2, 0], "camera.c": [1, 2, 1]}
        order = [c["camera_entity"] for c in D.cam_view(h, "a", "A", pos)["cards"][0]["cameras"]]
        self.assertEqual(order, ["camera.a", "camera.c", "camera.b", "camera.d"])
        no_model = D.cam_view(h, "b", "B")["cards"][0]["cameras"]
        self.assertEqual([c["title"] for c in no_model], ["B", "A", "C", "D"])

    def test_each_call_is_a_fresh_copy(self):
        a = D.overview(HOUSE, PEOPLE, fixture_model())
        b = D.overview(HOUSE, PEOPLE, fixture_model())
        self.assertEqual(json.dumps(a), json.dumps(b))
        before = json.dumps(b)
        a["views"][0]["title"] = "x"
        a["views"][-1].clear()
        for v in a["views"]:
            for s in v.get("sections", []):
                s["cards"].clear()
        self.assertEqual(json.dumps(b), before)
        self.assertEqual(json.dumps(D.overview(HOUSE, PEOPLE, fixture_model())), before)

    def test_every_lovelace_link_lands_on_a_view(self):
        views = {"/lovelace/" + p for p in paths(OVERVIEW)}
        lovelace = {link for link in links(OVERVIEW) if link.startswith("/lovelace/")}
        self.assertTrue(lovelace)
        self.assertEqual(lovelace - views, set())

    def test_the_heros_expand_button_lands_on_the_3d_view(self):
        hero = next(c for c in walk(OVERVIEW["views"][0]) if c.get("type") == "custom:house3d-card")
        self.assertEqual(hero["full_view"], "/lovelace/" + paths(OVERVIEW)[-1])

    def test_every_lovelace_url_in_the_packages_lands_on_a_view(self):
        views = set(paths(OVERVIEW))
        found = set()
        for f in (ROOT / "config/packages").glob("*.yaml"):
            found |= set(re.findall(r"/lovelace/([a-z0-9-]+)", f.read_text()))
        self.assertTrue(found)
        self.assertEqual(found - views, set())

    def test_no_entity_id_spelled_in_a3_view_modules(self):
        spelled = {i for i in ids(OVERVIEW) if not i.startswith("mdi:")}
        a3_modules = ("kodu.py", "energia.py", "climate.py", "security.py", "media.py", "overview.py")
        for name in a3_modules:
            src = (ROOT / "scripts/dashboard" / name).read_text()
            code = src.split('"""', 2)[2]
            quoted = set(re.findall(r'"([^"\s]+)"', code))
            with self.subTest(module=name):
                self.assertEqual(quoted & spelled, set())


class DaysSheets(unittest.TestCase):
    """A days card's headline opens its series' sheet over 30 days, 90 days and 12 months
    (ADR-013); a stack has no one statistic and no sheet (ADR-017)."""

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
