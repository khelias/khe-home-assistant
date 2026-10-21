"""Tests of the demo's scenarios (scripts/dashboard_scenarios.py) on the made-up fixture house:
every entity and state is the demo's own, and a step labelled as an automation does only what
that real automation in config/packages/ does. The packages are read as text: no PyYAML under -I.

Run from the repo root: python3 -I -m unittest discover -s tests/dashboard
"""

import json
import re
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import dashboard_demo as dd
import dashboard_demo_en as en
import dashboard_scenarios as ds
from test_dashboard_demo import fixture_model

PACKAGES = ROOT / "config/packages"
ALARM_STATES = {"disarmed", "armed_home", "armed_away", "armed_night", "arming", "pending", "triggered"}
GLOW_MINUTES = 15


def automations():
    """alias -> (trigger text, action text): an automation's block runs from its alias to the
    next one or the next top-level key (a column-0 comment is neither); its triggers end where
    its conditions or actions start."""
    out = {}
    for f in sorted(PACKAGES.glob("*.yaml")):
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r'^\s*- alias: "([^"]+)"\n', text, re.MULTILINE):
            end = re.search(r'^\s*- alias: "|^[^\s#]', text[m.end() :], re.MULTILINE)
            block = text[m.end() : m.end() + end.start()] if end else text[m.end() :]
            trig = re.search(r"^\s*triggers:\n(.*?)^\s*(?:conditions|actions):", block, re.M | re.S)
            act = re.search(r"^\s*actions:\n(.*)", block, re.M | re.S)
            out[m.group(1)] = (trig.group(1) if trig else "", act.group(1) if act else "")
    return out


def real_ids():
    """demo id -> the real ids the catalogue maps to it."""
    out = {}
    for real, e in dd.CATALOGUE.items():
        out.setdefault(e["id"], set()).add(real)
    return out


def touched(st):
    """The entities a step acts on."""
    if "set" in st:
        return [st["set"][0]]
    if "service" in st:
        e = st["service"][2]
        return e if isinstance(e, list) else [e]
    return []


def names(text, ids):
    return any(re.search(rf"(?<![\w.]){re.escape(i)}(?![\w])", text) for i in ids)


class Scenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = fixture_model()
        cls.states = dd.demo_states(cls.model)["states"]
        cls.scenarios = ds.demo_scenarios(cls.model)
        cls.automations = automations()
        cls.real = real_ids()

    def steps(self):
        for s in self.scenarios:
            for st in s["steps"]:
                yield s, st

    def assert_valid_state(self, entity, state, where):
        a = self.states[entity]["attributes"]
        domain = entity.split(".")[0]
        if "options" in a:
            self.assertIn(state, a["options"], where)
        elif domain in ("binary_sensor", "light", "switch", "input_boolean", "fan"):
            self.assertIn(state, ("on", "off"), where)
        elif domain == "alarm_control_panel":
            self.assertIn(state, ALARM_STATES, where)
        elif domain == "cover":
            self.assertIn(state, ("open", "closed", "opening", "closing"), where)
        elif domain == "device_tracker":
            self.assertIn(state, ("home", "not_home"), where)
        elif domain == "sensor" and a.get("unit_of_measurement"):
            float(state)

    def test_ids_views_and_order(self):
        self.assertEqual(len({s["id"] for s in self.scenarios}), len(self.scenarios))
        paths = {v["path"] for v in dd.demo_config(self.model)["views"]}
        for s in self.scenarios:
            self.assertIn(s["view"], paths, s["id"])
            self.assertTrue(s["steps"], s["id"])
            ats = [st["at"] for st in s["steps"]]
            self.assertEqual(ats, sorted(set(ats)), f"{s['id']}: at rises")

    def test_every_entity_and_state_is_the_demos(self):
        for s in self.scenarios:
            for e, o in s["start"].items():
                self.assertIn(e, self.states, f"{s['id']} start")
                self.assert_valid_state(e, o["state"], f"{s['id']} start {e}")
        for s, st in self.steps():
            actions = [k for k in ("set", "service", "time", "car") if k in st]
            self.assertLessEqual(len(actions), 1, f"{s['id']} {st['at']}: one action")
            self.assertTrue(actions or st.get("caption"), f"{s['id']} {st['at']}: does nothing")
            for e in touched(st):
                self.assertIn(e, self.states, f"{s['id']} {st['at']}")
            if "set" in st:
                self.assert_valid_state(st["set"][0], st["set"][1], f"{s['id']} {st['at']}")
            if "service" in st and "option" in st["service"][3]:
                for e in touched(st):
                    self.assert_valid_state(e, st["service"][3]["option"], f"{s['id']} {st['at']}")
            if "time" in st:
                self.assertTrue(s["time"], f"{s['id']}: a time step needs the 3D view")
                datetime.fromisoformat(st["time"])

    def test_every_alias_is_a_real_automation(self):
        for _, st in self.steps():
            if "automation" in st:
                self.assertIn(st["automation"], self.automations)

    def test_an_automation_step_touches_only_what_its_actions_name(self):
        acting = 0
        for s, st in self.steps():
            if "automation" not in st:
                continue
            _, actions = self.automations[st["automation"]]
            for e in touched(st):
                acting += 1
                self.assertTrue(
                    names(actions, self.real.get(e, set())),
                    f"{s['id']} {st['at']}: {st['automation']} does not act on {e}",
                )
        self.assertGreater(acting, 0)

    def test_a_caption_only_automation_step_follows_one_of_its_triggers(self):
        for s in self.scenarios:
            seen = set()
            for st in s["steps"]:
                if "automation" in st and not touched(st):
                    triggers, _ = self.automations[st["automation"]]
                    self.assertTrue(
                        any(names(triggers, self.real.get(e, set())) for e in seen),
                        f"{s['id']} {st['at']}: nothing set a trigger of {st['automation']}",
                    )
                if "set" in st:
                    seen.add(st["set"][0])

    def test_a_step_without_automation_names_no_alias(self):
        for s, st in self.steps():
            if "automation" not in st:
                for alias in self.automations:
                    self.assertNotIn(alias, st.get("caption", ""), f"{s['id']} {st['at']}")

    def test_a_3d_scenario_starts_quiet(self):
        rooms = {r["id"] for r in self.model["rooms"] if r.get("floor") != "paving"}
        motion = {d["entity"] for d in self.model["devices"] if d["type"] == "motion" and d["room"] in rooms}
        lights = {
            d["entity"]
            for d in self.model["devices"]
            if d["entity"].startswith("light.") and d["room"] in rooms
        }
        self.assertTrue(motion and lights)
        for s in self.scenarios:
            if not s["time"]:
                continue
            for e in motion:
                st = {**self.states[e], **s["start"].get(e, {})}
                self.assertEqual(st["state"], "off", f"{s['id']}: {e}")
                self.assertGreaterEqual(st.get("ago", 0), GLOW_MINUTES, f"{s['id']}: {e}")
            for e in lights:
                st = {**self.states[e], **s["start"].get(e, {})}
                self.assertEqual(st["state"], "off", f"{s['id']}: {e}")

    def test_scene_times_are_instants_on_one_day(self):
        for s in self.scenarios:
            times = [s["time"], *(st["time"] for st in s["steps"] if "time" in st)]
            for t in filter(None, times):
                d = datetime.fromisoformat(t)
                self.assertEqual(d.utcoffset(), timedelta(hours=2), t)
                self.assertEqual(d.date().isoformat(), ds.DATE, t)

    def test_english(self):
        out = ds.demo_scenarios_en(self.model)
        self.assertNotRegex(json.dumps(out, ensure_ascii=False), "[õäöüšžÕÄÖÜŠŽ]")
        self.assertEqual([s["id"] for s in out], [s["id"] for s in self.scenarios])
        states = dd.demo_states_en(self.model)["states"]
        for s in out:
            for st in s["steps"]:
                if "service" in st and "option" in st["service"][3]:
                    for e in touched(st):
                        self.assertIn(st["service"][3]["option"], states[e]["attributes"]["options"])

    def test_a_missing_english_caption_fails_the_build(self):
        caption = self.scenarios[0]["steps"][0]["caption"]
        with mock.patch.dict(en.EN):
            del en.EN[caption]
            with self.assertRaises(KeyError):
                ds.demo_scenarios_en(self.model)


if __name__ == "__main__":
    unittest.main()
