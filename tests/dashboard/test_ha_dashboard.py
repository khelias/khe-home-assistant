"""Tests of scripts/ha-dashboard.py's merge of the house file into the 3D card model.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import copy
import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import house3d_model

FIXTURE = ROOT / "tests/house3d/fixture-model.md"


def load_ha_dashboard():
    spec = importlib.util.spec_from_file_location("ha_dashboard", ROOT / "scripts/ha-dashboard.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def model_without_car_entity():
    layers = house3d_model.read_layers(FIXTURE)
    model = house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))
    del model["car"]["entity"]
    return model


def card_car(config):
    (view,) = [v for v in config["views"] if v["path"] == "maja-3d"]
    return view["cards"][0]["model"]["car"]


class CarEntity(unittest.TestCase):
    def setUp(self):
        self.ha = load_ha_dashboard()

    def test_house_key_fills_a_missing_entity(self):
        model = model_without_car_entity()
        before = copy.deepcopy(model)
        merged = self.ha.with_car_entity(model, "switch.test_stand_in")
        self.assertEqual(merged["car"]["entity"], "switch.test_stand_in")
        self.assertEqual(model, before)

    def test_never_overrides_the_models_entity(self):
        model = model_without_car_entity()
        model["car"]["entity"] = "binary_sensor.test_car_home"
        merged = self.ha.with_car_entity(model, "switch.test_stand_in")
        self.assertEqual(merged["car"]["entity"], "binary_sensor.test_car_home")

    def test_no_key_no_car_or_no_model_leaves_it_alone(self):
        model = model_without_car_entity()
        self.assertNotIn("entity", self.ha.with_car_entity(model, None)["car"])
        del model["car"]
        self.assertNotIn("car", self.ha.with_car_entity(model, "switch.test_stand_in"))
        self.assertIsNone(self.ha.with_car_entity(None, "switch.test_stand_in"))

    def test_a_malformed_key_stops_the_save(self):
        with self.assertRaises(SystemExit):
            self.ha.with_car_entity(model_without_car_entity(), "test_stand_in")

    def test_local_config_gives_the_3d_cars_entity_from_the_house_file(self):
        files = {"ha-house.json": {"car_entity": "switch.test_stand_in"}, "ha-people.json": []}
        self.ha._local = lambda name, default: files.get(name, default)
        self.ha.house3d_card_model = model_without_car_entity
        self.assertEqual(card_car(self.ha.local_config())["entity"], "switch.test_stand_in")


if __name__ == "__main__":
    unittest.main()
