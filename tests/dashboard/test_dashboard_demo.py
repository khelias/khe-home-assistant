"""Tests of the demo dashboard (scripts/dashboard_demo.py) on the made-up fixture house: no
khe-meta, so CI runs them too.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import dashboard_config as dc
import dashboard_demo as dd
import house3d_model

FIXTURE = ROOT / "tests/house3d/fixture-model.md"


def fixture_model():
    layers = house3d_model.read_layers(FIXTURE)
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


def strings(o, key=None):
    """(key, string) for every string value, perform_action values left out."""
    if isinstance(o, dict):
        for k, v in o.items():
            if k != "perform_action":
                yield from strings(v, k)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v, key)
    elif isinstance(o, str):
        yield key, o


def cards(o):
    """Every dict in the config that has a type, nested ones included."""
    if isinstance(o, dict):
        if isinstance(o.get("type"), str):
            yield o
        for v in o.values():
            yield from cards(v)
    elif isinstance(o, list):
        for v in o:
            yield from cards(v)


def is_id(s):
    return bool(dd.ID.match(s) or (dd.STAT.match(s) and not s.startswith("mdi:")))


MODEL = fixture_model()
CONFIG = dd.demo_config(MODEL)
STATES = dd.demo_states(MODEL)["states"]
SERIES = dd.demo_series()
FIXTURE_IDS = {d["entity"] for d in MODEL["devices"]} | {MODEL["car"]["entity"]}


class DemoConfig(unittest.TestCase):
    def test_every_id_is_a_demo_or_fixture_id_with_a_state(self):
        demo_ids = {e["id"] for e in dd.CATALOGUE.values()} | set(dd.STATISTICS.values())
        for _, s in strings(CONFIG):
            if is_id(s):
                self.assertTrue(s in demo_ids or s in FIXTURE_IDS, s)
                if dd.ID.match(s):
                    self.assertIn(s, STATES, s)

    def test_no_template_or_script_survives(self):
        text = json.dumps(CONFIG, ensure_ascii=False)
        for bad in ("{{", "{%", "data_generator", "callWS"):
            self.assertNotIn(bad, text)
        house3d = [c for c in cards(CONFIG) if c["type"] == "custom:house3d-card"]
        self.assertEqual(house3d, [{"type": "custom:house3d-card"}])

    def test_every_id_the_generator_emits_is_catalogued(self):
        # without the model: the 3D card carries it inline, fixture ids and all
        raw = dc.build(dd.DEMO_HOUSE, dd.DEMO_PEOPLE, None)
        missing = sorted(
            {
                s
                for _, s in strings(raw)
                if is_id(s) and s not in dd.CATALOGUE and s not in dd.STATISTICS
            }
        )
        self.assertEqual(missing, [])

    def test_every_real_view_in_order_3d_first(self):
        real = [v["path"] for v in dc.build(dd.DEMO_HOUSE, dd.DEMO_PEOPLE, MODEL)["views"]]
        demo = [v["path"] for v in CONFIG["views"]]
        self.assertEqual(demo, real)
        self.assertEqual(demo[:2], ["maja-3d", "kodu"])
        for path in ("energia", "soojuspump", "ventilatsioon", "pergola", "valve", "kaamerad"):
            self.assertIn(path, demo)
        self.assertIn("teler", demo)
        self.assertTrue([p for p in demo if p.startswith("kaamera-")])

    def test_selects_and_numbers_hold_valid_states(self):
        for e, st in STATES.items():
            domain, a = e.split(".")[0], st["attributes"]
            if domain in ("select", "input_select"):
                self.assertIn(st["state"], a["options"], e)
            if domain in ("number", "input_number"):
                self.assertTrue(a["min"] <= float(st["state"]) <= a["max"], e)

    def test_series_cover_every_chart(self):
        wanted = set()
        for c in cards(CONFIG):
            if c["type"] in ("statistics-graph", "history-graph"):
                wanted |= {x["entity"] for x in c["entities"]}
            if c["type"] == "custom:apexcharts-card":
                wanted |= {f"{x['entity']}|{x['name']}" for x in c["series"]}
            if c["type"] == "weather-forecast":
                wanted.add(c["entity"])
        self.assertTrue(wanted)
        self.assertEqual(sorted(wanted - set(SERIES)), [])

    def test_state_content_keys_exist_on_their_states(self):
        for c in cards(CONFIG):
            sc = c.get("state_content")
            if not sc:
                continue
            for k in [sc] if isinstance(sc, str) else sc:
                if k in ("state", "name", "last_changed", "last_updated"):
                    continue
                self.assertIn(k, STATES[c["entity"]]["attributes"], (c["entity"], k))

    def test_no_private_label_survives(self):
        for _, s in strings(CONFIG):
            for label in dd.LABELS:
                self.assertNotIn(label, s)

    def test_the_real_config_is_unchanged_by_the_demo(self):
        before = json.dumps(dc.build({}, [], MODEL), ensure_ascii=False)
        dd.demo_config(MODEL)
        self.assertEqual(json.dumps(dc.build({}, [], MODEL), ensure_ascii=False), before)

    def test_an_uncatalogued_id_fails_the_build(self):
        with self.assertRaises(KeyError):
            dd._walk({"type": "tile", "entity": "sensor.not_in_the_catalogue"})
        with self.assertRaises(ValueError):
            dd._walk({"type": "markdown", "content": "{{ states('sensor.x') }}"})

    def test_mirrors_follow_catalogued_selects(self):
        for target, m in dd.demo_states(MODEL)["mirrors"].items():
            self.assertIn(target, STATES)
            self.assertIn(m["from"], STATES)
            self.assertEqual(STATES[target]["state"], m["map"][STATES[m["from"]]["state"]])


if __name__ == "__main__":
    unittest.main()
