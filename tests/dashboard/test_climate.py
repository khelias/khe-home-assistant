"""Tests of the A3 climate views: Soojuspump (ADR-011), Ventilatsioon and Pergola (ADR-014)."""

import json
import re
import unittest

from helpers import (
    HOUSE,
    MODEL,
    PEOPLE,
    ROOT,
    card_actions,
    ids,
    links,
    tiles_of,
    walk,
    without_sheets,
)

import dashboard as D
from dashboard.primitives import tile, vent_modes, wide

VIEW = D.build(HOUSE, PEOPLE, MODEL)["views"][0]
SOOJUSPUMP = D.soojuspump()
VENTILATSIOON = D.ventilatsioon()
PERGOLA = D.pergola()


def vent_tiles(node):
    return [c for c in walk(node) if c.get("entity") == D.MODE and c.get("modes")]


class Soojuspump(unittest.TestCase):
    def test_entities_links_and_metadata(self):
        expected = {
            D.HEATING,
            D.HEATING_FAULT,
            D.TANK_FAULT,
            D.PANEL_TEMP,
            D.LEAVING,
            D.PUMP_OUTDOOR,
            D.SHIFT,
            D.BOILER_TEMP,
            D.DHW,
            D.BOILER_TODAY,
            D.BOILER_MONTH,
            D.MONTH,
        }
        self.assertLessEqual(expected, ids(without_sheets(SOOJUSPUMP)))
        self.assertLessEqual({"/lovelace/soojuspump-seaded", "/lovelace/energia"}, links(SOOJUSPUMP))
        self.assertEqual(
            (SOOJUSPUMP["title"], SOOJUSPUMP["path"], SOOJUSPUMP["icon"], SOOJUSPUMP["max_columns"]),
            ("Soojuspump", "soojuspump", "mdi:heat-pump", 2),
        )
        self.assertEqual(SOOJUSPUMP["background"], VIEW["background"])
        types = {c["type"] for s in SOOJUSPUMP["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertIn("custom:khe-reading-card", types)

    def test_boost_confirmations_and_widths(self):
        confirmed = [
            act["confirmation"]["text"]
            for card in walk(SOOJUSPUMP)
            for act in card_actions(card)
            if "confirmation" in act
        ]
        self.assertEqual(len(confirmed), 2)

        def boosts(node):
            return [c for c in walk(node) if c.get("entity") == D.DHW and "icon_tap_action" in c]

        self.assertEqual(len(boosts(SOOJUSPUMP)), 2)
        self.assertTrue(all(c["grid_options"] == {"columns": 12} for c in boosts(SOOJUSPUMP)))
        self.assertTrue(all(c["grid_options"] == {"columns": 6} for c in boosts(VIEW)))
        self.assertTrue(all(isinstance(c["state_text"], str) for c in boosts(SOOJUSPUMP)))

    def test_the_stepper_is_the_shift_and_the_floor_is_the_boilers(self):
        readings = [c for c in walk(SOOJUSPUMP) if c.get("type") == "custom:khe-reading-card"]
        self.assertEqual([c["stepper"]["entity"] for c in readings if "stepper" in c], [D.SHIFT])
        self.assertEqual([c["line"].get("floor") for c in readings], [None, D.DHW_FLOOR])

    def test_every_sheet_names_its_source(self):
        for c in walk(SOOJUSPUMP):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))


class Ventilatsioon(unittest.TestCase):
    def test_entities_links_and_metadata(self):
        expected = {
            D.VENT_POWER,
            D.VENT_FAULT,
            D.VENT_WARNING,
            D.FLOW_DOWN,
            D.MODE,
            D.MODE_LABEL,
            D.ECO,
            D.HUMIDITY,
            D.SUPPLY,
            D.EXTRACT,
            D.OUTDOOR,
            D.EFFICIENCY,
            D.FILTER,
            D.RECOVERY,
            D.VENT_POWER_USE,
            D.EXCHANGER,
            D.RECOVERED,
            D.AHU_ENERGY,
            D.VENT_MONTH,
            D.HEATER_MONTH,
            D.ACTIVE_ALARMS,
        }
        self.assertLessEqual(expected, ids(without_sheets(VENTILATSIOON)))
        self.assertIn("/lovelace/komfovent-seaded", links(VENTILATSIOON))
        self.assertEqual(
            (
                VENTILATSIOON["title"],
                VENTILATSIOON["path"],
                VENTILATSIOON["icon"],
                VENTILATSIOON["max_columns"],
            ),
            ("Ventilatsioon", "ventilatsioon", "mdi:fan", 2),
        )
        self.assertEqual(VENTILATSIOON["background"], VIEW["background"])
        types = {c["type"] for s in VENTILATSIOON["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        self.assertLessEqual({"custom:khe-reading-card", "custom:khe-days-card"}, types)

    def test_mode_confirmations_and_tile_layout(self):
        confirmed = [
            act["confirmation"]["text"]
            for card in walk(VENTILATSIOON)
            for act in card_actions(card)
            if "confirmation" in act
        ]
        self.assertEqual(len(confirmed), 3)
        (here,) = vent_tiles(VENTILATSIOON)
        (kodu,) = vent_tiles(VIEW)
        self.assertEqual(
            here["state_text"], [{"entity": D.MODE_LABEL}, {"entity": D.ECO, "label": "ECO"}]
        )
        self.assertNotIn("view", here["history"])
        self.assertEqual(kodu["history"]["view"], "/lovelace/ventilatsioon")
        self.assertEqual(
            {**here, "state_text": kodu["state_text"]}, {**kodu, "history": here["history"]}
        )

    def test_kodus_tile_matches_spec(self):
        ms = vent_modes()
        expected = wide(
            tile(
                D.MODE,
                "Ventilatsioon",
                icon="vent",
                color="blue",
                active=["*"],
                state_text=[{"entity": D.MODE_LABEL}],
                modes=ms,
                history={
                    **D.ONOFF,
                    "active": [m["option"] for m in ms if m["option"] != "normal"],
                    "view": "/lovelace/ventilatsioon",
                },
            )
        )
        self.assertEqual(json.dumps(vent_tiles(VIEW)[0]), json.dumps(expected))

    def test_flow_down_is_a_note_not_a_fault(self):
        (chips,) = [c for c in walk(VENTILATSIOON) if c.get("type") == "custom:khe-chips-card"]
        self.assertEqual([f["entity"] for f in chips["faults"]], [D.VENT_FAULT, D.VENT_WARNING])
        self.assertEqual([n["entity"] for n in chips["notes"]], [D.FLOW_DOWN])
        self.assertEqual(chips["status"]["entity"], D.VENT_POWER)

    def test_the_payback_overlays_the_units_electricity_with_a_ratio(self):
        (days,) = [c for c in walk(VENTILATSIOON) if c.get("type") == "custom:khe-days-card"]
        (s,) = days["series"]
        self.assertEqual((s["statistic"], s["overlay"]["statistic"]), (D.RECOVERED, D.AHU_ENERGY))
        self.assertEqual(s["headline"], "ratio")
        self.assertEqual(days["days"], 16)
        cells = {c.get("entity", c.get("kind")): c for c in days["cells"]}
        self.assertEqual(cells[D.VENT_MONTH]["note_last"], "last_period")
        self.assertEqual(cells[D.HEATER_MONTH]["bad_above"], 0)
        self.assertIn("avg", cells)

    def test_the_alarms_tile_shows_only_with_alarms(self):
        (t,) = [
            c for c in walk(VENTILATSIOON) if c.get("entity") == D.ACTIVE_ALARMS and "type" in c
        ]
        self.assertEqual(
            t["visibility"], [{"condition": "state", "entity": D.ACTIVE_ALARMS, "state_not": ""}]
        )

    def test_every_sheet_names_its_source(self):
        for c in walk(VENTILATSIOON):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))


class Pergola(unittest.TestCase):
    def test_entities_links_and_metadata(self):
        expected = {
            D.ROOF,
            D.PERGOLA_LIGHT,
            D.TONE,
            D.WEATHER,
            D.RAIN_NOW,
            D.RAIN_2H,
            D.OUTDOOR,
            D.ROOF_AUTO,
            D.LIGHT_AUTO,
            D.RAIN_RULE,
            D.SUNSET_RULE,
            D.LIGHT_OFF,
        }
        self.assertLessEqual(expected, ids(without_sheets(PERGOLA)))
        self.assertIn("/lovelace/pergola-seaded", links(PERGOLA))
        self.assertEqual(
            (PERGOLA["title"], PERGOLA["path"], PERGOLA["icon"], PERGOLA["max_columns"]),
            ("Pergola", "pergola", "mdi:awning-outline", 2),
        )
        self.assertEqual(PERGOLA["background"], VIEW["background"])

    def test_forecast_and_status(self):
        types = {c["type"] for s in PERGOLA["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))
        (fc,) = [c for c in walk(PERGOLA) if c.get("type") == "custom:khe-forecast-card"]
        self.assertEqual(fc["entity"], D.WEATHER)
        self.assertEqual([x["entity"] for x in fc["cells"]], [D.RAIN_NOW, D.RAIN_2H, D.OUTDOOR])
        for x in fc["cells"]:
            self.assertEqual(x["history"], D.MEAN)
        (chips,) = [c for c in walk(PERGOLA) if c.get("type") == "custom:khe-chips-card"]
        self.assertEqual(
            chips["status"], {"entity": D.RAIN_NOW, "above": 0, "on": "Sajab", "ok": "Kuiv"}
        )

    def test_roof_commands_and_tone_options_match_package(self):
        (roof,) = tiles_of(PERGOLA, D.ROOF)
        self.assertEqual(
            [(m["name"], m["tap_action"]["perform_action"]) for m in roof["modes"]],
            [
                ("Ava", "cover.open_cover"),
                ("Stopp", "cover.stop_cover"),
                ("Sulge", "cover.close_cover"),
            ],
        )
        for m in roof["modes"]:
            self.assertEqual(m["tap_action"]["target"], {"entity_id": D.ROOF})
            self.assertNotIn("option", m)
        self.assertNotIn("history", roof)

        (light,) = tiles_of(PERGOLA, D.PERGOLA_LIGHT)
        self.assertEqual(light["modes_entity"], D.TONE)
        yaml = (ROOT / "config/packages/pergola.yaml").read_text()
        block = yaml.split(D.TONE.split(".")[1] + ":", 1)[1].split("options:", 1)[1]
        options = re.findall(r"^\s+- (\S+)$", block.split("\n\n", 1)[0], re.M)
        self.assertEqual([m["option"] for m in light["modes"]], options)
        self.assertEqual(light["slider"], {"attribute": "brightness"})

    def test_light_sheet_and_off_time(self):
        (here,) = tiles_of(PERGOLA, D.PERGOLA_LIGHT)
        (kodu,) = tiles_of(VIEW, D.PERGOLA_LIGHT)
        self.assertEqual(here["history"], D.ONOFF)
        self.assertEqual(kodu["history"]["view"], "/lovelace/pergola")
        (part,) = here["state_text"]
        self.assertEqual((part["entity"], part["format"]), (D.LIGHT_OFF, "when"))
        self.assertEqual(part["if"], [{"state": "on"}, {"entity": D.LIGHT_AUTO, "state": "on"}])

    def test_rules_match_package_automations(self):
        rules = [c for c in walk(PERGOLA) if c.get("switch")]
        self.assertEqual([c["entity"] for c in rules], [D.ROOF_AUTO, D.LIGHT_AUTO])
        self.assertEqual(
            [[(p["entity"], p.get("attribute")) for p in c["state_text"]] for c in rules],
            [
                [(D.RAIN_RULE, "last_triggered")],
                [(D.SUNSET_RULE, "last_triggered"), (D.LIGHT_OFF, None)],
            ],
        )
        for c in rules:
            for p in c["state_text"]:
                self.assertEqual(p["if"], [{"state": "on"}])
        yaml = (ROOT / "config/packages/pergola.yaml").read_text()
        aliases = re.findall(r'alias: "(Pergola: [^"]+)"', yaml)
        slug = {re.sub(r"[^a-z0-9]+", "_", a.lower().replace("õ", "o")).strip("_") for a in aliases}
        for e in (D.RAIN_RULE, D.SUNSET_RULE):
            self.assertIn(e.split(".")[1], slug)

    def test_every_sheet_names_its_source(self):
        for c in walk(PERGOLA):
            h = c.get("history")
            if isinstance(h, dict):
                with self.subTest(card=c.get("name")):
                    self.assertIn(h["source"], ("statistics", "history"))


if __name__ == "__main__":
    unittest.main()
