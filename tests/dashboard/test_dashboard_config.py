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


if __name__ == "__main__":
    unittest.main()
