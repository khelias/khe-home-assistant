"""Tests of the dashboard config builder (scripts/dashboard_config.py) on made-up inputs.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import dashboard_config as dc
import house3d_model

FIXTURE = ROOT / "tests/house3d/fixture-model.md"


def fixture_model():
    layers = house3d_model.read_layers(FIXTURE)
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


def paths(config):
    return [v["path"] for v in config["views"]]


class Build(unittest.TestCase):
    def test_import_reads_no_file_and_needs_no_websockets(self):
        probe = (
            "import builtins, io, sys\n"
            "def no(*a, **k): raise AssertionError(f'opened {a[0]!r}')\n"
            "builtins.open = io.open = no\n"
            f"sys.path.insert(0, {str(ROOT / 'scripts')!r})\n"
            "import dashboard_config\n"
            "assert 'websockets' not in sys.modules\n"
        )
        r = subprocess.run(
            [sys.executable, "-I", "-c", probe], check=False, capture_output=True, text=True
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_without_inputs_no_3d_view_and_no_camera_subview(self):
        p = paths(dc.build({}, [], None))
        self.assertNotIn("maja-3d", p)
        self.assertFalse([x for x in p if x.startswith("kaamera-")])
        self.assertIn("kaamerad", p)
        self.assertIn("kaamerad-seaded", p)

    def test_with_the_fixture_model_the_3d_view_is_present(self):
        config = dc.build({}, [], fixture_model())
        (view,) = [v for v in config["views"] if v["path"] == "maja-3d"]
        self.assertEqual(view["cards"][0]["type"], "custom:house3d-card")

    def test_3d_is_the_first_view_with_a_model_and_kodu_without(self):
        self.assertEqual(paths(dc.build({}, [], fixture_model()))[:2], ["maja-3d", "kodu"])
        self.assertEqual(paths(dc.build({}, [], None))[0], "kodu")

    def test_cameras_become_subviews(self):
        house = {"cams": [["test_a", "A"], ["test_b", "B"]]}
        p = paths(dc.build(house, [], None))
        self.assertEqual(
            [x for x in p if x.startswith("kaamera-")], ["kaamera-test_a", "kaamera-test_b"]
        )

    def test_each_call_is_a_fresh_copy(self):
        house = {"cams": [["test_a", "A"]], "phone": "sensor.test_phone"}
        people = [["person.test", "Test on"]]
        a = dc.build(house, people, fixture_model())
        b = dc.build(house, people, fixture_model())
        self.assertEqual(json.dumps(a), json.dumps(b))
        before = json.dumps(b)
        a["views"][0]["title"] = "x"
        a["views"][-1].clear()
        for v in a["views"]:
            for s in v.get("sections", []):
                s["cards"].clear()
        self.assertEqual(json.dumps(b), before)
        self.assertEqual(json.dumps(dc.build(house, people, fixture_model())), before)


def kodu(people=()):
    (view,) = [v for v in dc.build({}, list(people), None)["views"] if v["path"] == "kodu"]
    return view


def typed(o):
    """Every dict with a type, nested ones included."""
    if isinstance(o, dict):
        if isinstance(o.get("type"), str):
            yield o
        for v in o.values():
            yield from typed(v)
    elif isinstance(o, list):
        for v in o:
            yield from typed(v)


class Kodu(unittest.TestCase):
    def test_drawn_with_the_three_own_cards_and_no_badges(self):
        view = kodu()
        types = {c["type"] for c in typed(view["sections"])}
        for t in ("custom:khe-summary-card", "custom:khe-price-card", "custom:khe-tile-card"):
            self.assertIn(t, types)
        self.assertNotIn("badges", view)
        self.assertEqual(view["max_columns"], 2)
        # Ülevaade has no heading
        self.assertNotEqual(view["sections"][0]["cards"][0]["type"], "heading")

    def test_every_fault_and_the_meter_freshness_reach_the_summary(self):
        (s,) = [c for c in typed(kodu()) if c["type"] == "custom:khe-summary-card"]
        faults = {f["entity"]: f for f in s["faults"]}
        for e, _ in dc.FAULTS:
            self.assertIn(e, faults)
        self.assertEqual(faults[dc.METER_FRESH]["bad"], "off")
        self.assertEqual([a["entity"] for a in s["alarms"]], [e for e, _ in dc.ALARMS])

    def test_people_names_lose_the_verb_and_no_people_file_means_none(self):
        (s,) = [c for c in typed(kodu([["person.test", "Test on"]])) if "people" in c]
        self.assertEqual(s["people"], [{"entity": "person.test", "name": "Test"}])
        (s,) = [c for c in typed(kodu()) if "people" in c]
        self.assertEqual(s["people"], [])

    def test_no_tile_toggles_the_read_only_heating_switch(self):
        heat = "switch.space_heating_climate_control"
        tiles = [c for c in typed(kodu()) if c.get("entity") == heat]
        self.assertTrue(tiles)
        for c in tiles:
            # an absent icon action does what the body does
            for a in (c.get("tap_action"), c.get("icon_tap_action")):
                if a:
                    self.assertNotIn(a["action"], ("toggle", "perform-action"))

    def test_navigate_targets_are_view_paths(self):
        views = set(paths(dc.build({}, [], None)))
        targets = list(_paths(kodu()))
        self.assertTrue(targets)
        for t in targets:
            self.assertTrue(t.startswith("/lovelace/"), t)
            self.assertIn(t.removeprefix("/lovelace/"), views, t)

    def test_tiles_fill_half_a_section_and_the_mode_tile_the_width(self):
        tiles = [c for c in typed(kodu()) if c["type"] == "custom:khe-tile-card"]
        for c in tiles:
            want = {"columns": "full"} if "modes" in c else {"columns": 6, "rows": 2}
            self.assertEqual(c["grid_options"], want, c["name"])
        (vent,) = [c for c in tiles if "modes" in c]
        self.assertEqual([m["option"] for m in vent["modes"]], ["normal", "kitchen", "boost"])


def _paths(o):
    """Every navigation_path and *_path value under o."""
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("navigation_path", "energy_path") and isinstance(v, str):
                yield v
            else:
                yield from _paths(v)
    elif isinstance(o, list):
        for v in o:
            yield from _paths(v)


if __name__ == "__main__":
    unittest.main()
