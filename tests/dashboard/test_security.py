"""Tests of the A3 security views: Valve (ADR-015) and Kaamerad (ADR-016)."""

import json
import unittest

from helpers import (
    FIXTURE,
    FIXTURE_PIRS,
    H,
    HOUSE,
    MODEL,
    PEOPLE,
    ROOT,
    card_actions,
    cards_of,
    ids,
    paths,
    placed,
    tiles_of,
    walk,
    without_sheets,
)

import dashboard as D
from dashboard.security import ALARM_MODES

VIEW = D.build(HOUSE, PEOPLE, MODEL)["views"][0]
OVERVIEW = D.overview(HOUSE, PEOPLE, MODEL)
VALVE = D.valve(MODEL)
CAMERAS = D.cameras(H)


class Valve(unittest.TestCase):
    def test_entities_metadata_and_background(self):
        expected = {
            *[e for e, _ in D.ALARMS],
            *[e for e, _ in D.DOORS],
            *D.SHARED,
            *D.PRIVATE,
            D.SMOKE,
            D.VALVE_BATTERY,
            D.VALVE_SUPPLY,
            D.VALVE_LINK,
            D.VALVE_LINK_RAW,
            D.TAMPER,
            D.SIREN,
        }
        self.assertLessEqual(expected, ids(without_sheets(VALVE)))
        self.assertEqual(
            (VALVE["title"], VALVE["path"], VALVE["icon"], VALVE["max_columns"]),
            ("Valve", "valve", "mdi:shield-home", 2),
        )
        self.assertEqual(VALVE["background"], VIEW["background"])
        types = {c["type"] for s in VALVE["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))

    def test_the_alarm_tiles_open_more_info_and_the_page_calls_no_service(self):
        for e, n in D.ALARMS:
            (t,) = tiles_of(VALVE, e)
            self.assertEqual(t["name"], n)
            self.assertNotIn("tap_action", t)
            self.assertEqual([m["option"] for m in t["modes"]], [s for s, _ in ALARM_MODES])
            for m in t["modes"]:
                self.assertEqual(m["tap_action"], {"action": "more-info"})
        for c in walk(VALVE):
            for act in card_actions(c):
                self.assertNotEqual(act.get("action"), "perform-action", c.get("type"))
                self.assertNotEqual(act.get("action"), "toggle", c.get("type"))

    def test_the_status_runs_alarm_to_disarmed_over_both_partitions(self):
        (chips,) = cards_of(VALVE, "chips-card")
        rules = chips["status"]["map"]
        self.assertEqual(
            [r["state"] for r in rules], ["triggered", "pending", "arming", "armed_*", "disarmed"]
        )
        for r in rules:
            self.assertEqual(r["entities"], [e for e, _ in D.ALARMS])
        self.assertEqual({f["entity"] for f in chips["faults"]}, {D.SMOKE, D.VALVE_LINK})

    def test_a_door_is_red_while_open_and_either_partition_armed(self):
        (doors,) = [
            c
            for c in cards_of(VALVE, "reading-card")
            if any(x["entity"] == D.DOORS[0][0] for x in c.get("cells", []))
        ]
        self.assertNotIn("entity", doors)
        self.assertEqual([x["entity"] for x in doors["cells"]], [e for e, _ in D.DOORS])
        for x in doors["cells"]:
            self.assertEqual(x["note"], {"last_on": True, "label": "avati"})
            self.assertEqual(
                x["bad_if"],
                [
                    [{"entity": x["entity"], "state": "on"}, {"entity": a, "state": "armed_*"}]
                    for a, _ in D.ALARMS
                ],
            )

    def test_the_system_cells_and_the_notice(self):
        system = cards_of(VALVE, "reading-card")[-1]
        self.assertEqual(
            [x["entity"] for x in system["cells"]],
            [D.SMOKE, D.VALVE_BATTERY, D.VALVE_LINK, D.TAMPER, D.SIREN],
        )
        self.assertEqual(system["cells"][1]["note"]["entity"], D.VALVE_SUPPLY)
        self.assertIn("Teavitus tuleb", system["note"]["text"])

    def test_without_a_model_the_motion_cards_have_no_plan_and_the_public_names(self):
        plan_card, motion = cards_of(D.valve(None), "motion-card")
        self.assertEqual((plan_card["part"], motion["part"]), ("plan", "rows"))
        self.assertEqual(plan_card["groups"], motion["groups"])
        self.assertNotIn("plan", plan_card)
        self.assertNotIn("plan", motion)
        rows = [r for g in motion["groups"] for r in g["rooms"]]
        self.assertEqual([r["entity"] for r in rows], D.SHARED + D.PRIVATE)
        self.assertEqual(
            [r["name"] for r in rows], [D.MOTION_ROOMS[e] for e in D.SHARED + D.PRIVATE]
        )
        self.assertEqual([g["name"] for g in motion["groups"]], ["Ühisruumid", "Toad"])
        self.assertEqual(motion["alarms"], [{"entity": e, "name": n} for e, n in D.ALARMS])

    def test_the_slice_has_rooms_walls_doors_and_placed_pirs_and_never_the_devices(self):
        pirs = D.SHARED + D.PRIVATE
        model = placed(FIXTURE, pirs)
        sl = D.plan_slice(model, pirs)
        self.assertEqual(sorted(sl), ["pirs", "rooms", "walls"])
        self.assertNotIn('"devices"', json.dumps(sl))
        for w in sl["walls"]:
            self.assertEqual(sorted(w), ["a", "b", "doors", "t"])
        room_ids = {r["id"] for r in sl["rooms"]}
        sensed = {p["room"] for p in sl["pirs"]}
        self.assertEqual({r["id"] for r in sl["rooms"] if "name" in r}, sensed)
        names = {r["name"] for r in sl["rooms"] if "name" in r}
        strings = {v for d in walk(sl) for v in d.values() if isinstance(v, str)}
        self.assertEqual(strings - room_ids - names - {p["entity"] for p in sl["pirs"]}, set())
        where = {d["entity"]: d["room"] for d in model["devices"]}
        self.assertEqual(
            sl["pirs"], [{"entity": e, "room": where[e]} for e in pirs if where.get(e) in room_ids]
        )
        self.assertIsNone(D.plan_slice(None, pirs))
        self.assertIsNone(D.plan_slice(FIXTURE, ["binary_sensor.nowhere"]))

    def test_rows_take_their_rooms_name_unless_two_pirs_share_it(self):
        pirs = D.SHARED + D.PRIVATE
        sl = D.plan_slice(placed(FIXTURE, pirs), pirs)
        names = D.motion_names(sl)
        rooms = {r["id"]: r.get("name") for r in sl["rooms"]}
        count = {}
        for p in sl["pirs"]:
            count[p["room"]] = count.get(p["room"], 0) + 1
        for p in sl["pirs"]:
            expected = rooms[p["room"]] if count[p["room"]] == 1 else D.MOTION_ROOMS[p["entity"]]
            self.assertEqual(names[p["entity"]], expected)
        self.assertIn(2, count.values(), "the fixture has a room with two PIRs")
        plan_card, rows_card = cards_of(D.valve(placed(FIXTURE, pirs)), "motion-card")
        self.assertEqual(plan_card["plan"], sl)
        self.assertNotIn("plan", rows_card)

    def test_the_cards_plan_fixture_is_the_test_houses_slice(self):
        pirs = FIXTURE_PIRS + ["binary_sensor.demo_room_a_motion"]
        fixture = json.loads((ROOT / "tests/cards/fixtures/plan.json").read_text())
        self.assertEqual(fixture, D.plan_slice(FIXTURE, pirs))


class Kaamerad(unittest.TestCase):
    def test_entities_exclude_noisy_motion_sensors(self):
        page = ids(without_sheets(CAMERAS))
        expected = {
            D.NVR,
            *{"camera." + slug + "_alamvoog" for slug, _ in H.cams},
            *{"switch." + slug + "_liikumistuvastus" for slug, _ in H.cams},
        }
        self.assertLessEqual(expected, page)
        motion = {"binary_sensor." + slug + "_liikumine" for slug, _ in H.cams}
        self.assertEqual(page & motion, set(), "motion fires every half minute: noise")

    def test_metadata_and_background(self):
        self.assertEqual(
            (CAMERAS["title"], CAMERAS["path"], CAMERAS["icon"], CAMERAS["max_columns"]),
            ("Kaamerad", "kaamerad", "mdi:cctv", 2),
        )
        self.assertEqual(CAMERAS["background"], VIEW["background"])
        types = {c["type"] for s in CAMERAS["sections"] for c in s["cards"]}
        self.assertTrue(all(t.startswith("custom:khe-") for t in types))

    def test_the_status_runs_the_nvr_then_each_camera_then_all_well(self):
        (chips,) = cards_of(CAMERAS, "chips-card")
        rules = chips["status"]["map"]
        subs = ["camera." + slug + "_alamvoog" for slug, _ in H.cams]
        self.assertEqual(
            [(r["entities"], r["state"], r["tone"]) for r in rules],
            [([D.NVR], "!OK", "bad")]
            + [([e], "unavailable", "bad") for e in subs]
            + [([D.NVR], "OK", "ok")],
        )
        self.assertEqual([r["text"] for r in rules[1:-1]], [n + " ei vasta" for _, n in H.cams])

    def test_the_hero_is_the_house_files_first_camera_and_each_opens_its_live_view(self):
        (cams,) = cards_of(CAMERAS, "cameras-card")
        self.assertEqual(
            [(c["entity"], c["name"]) for c in cams["cameras"]],
            [("camera." + slug + "_alamvoog", n) for slug, n in H.cams],
        )
        views = {"/lovelace/" + p for p in paths(OVERVIEW)}
        for c, (slug, _) in zip(cams["cameras"], H.cams, strict=True):
            self.assertEqual(c["tap_action"]["action"], "navigate")
            self.assertEqual(c["tap_action"]["navigation_path"], "/lovelace/kaamera-" + slug)
            self.assertIn(c["tap_action"]["navigation_path"], views)

    def test_every_3d_card_takes_its_camera_stills_from_the_substreams(self):
        house3d = [c for c in walk(OVERVIEW) if c.get("type") == "custom:house3d-card"]
        self.assertTrue(house3d)
        subs = {"camera." + slug: "camera." + slug + "_alamvoog" for slug, _ in H.cams}
        views = {"/lovelace/" + p for p in paths(OVERVIEW)}
        for card in house3d:
            self.assertEqual(card["stills"], subs)
            self.assertEqual(set(card["views"]), set(subs))
            self.assertLessEqual(set(card["views"].values()), views)

    def test_salvestised_only_with_the_nvr_app(self):
        url = [d for d in walk(CAMERAS) if d.get("action") == "url"]
        self.assertEqual(url, [{"action": "url", "url_path": HOUSE["nvr_app_url"]}])
        bare = D.cameras(D.House({**HOUSE, "nvr_app_url": None}, PEOPLE))
        self.assertEqual([d for d in walk(bare) if d.get("action") == "url"], [])
        self.assertEqual([t["name"] for t in tiles_of(bare, D.NVR)], ["Seaded"])

    def test_the_system_cells_count_the_substreams_and_the_switches(self):
        (reading,) = cards_of(CAMERAS, "reading-card")
        nvr, cams, detect = reading["cells"]
        self.assertEqual(nvr["entity"], D.NVR)
        self.assertEqual(nvr["bad_if"], [{"state": "!OK"}])
        self.assertEqual(nvr["words"], {"OK": "korras", "*": "viga"})
        self.assertEqual(
            [e["entity"] for e in cams["count"]["entities"]],
            ["camera." + slug + "_alamvoog" for slug, _ in H.cams],
        )
        self.assertEqual(cams["count"]["state"], "*")
        self.assertEqual(
            [e["entity"] for e in detect["count"]["entities"]],
            ["switch." + slug + "_liikumistuvastus" for slug, _ in H.cams],
        )
        self.assertEqual(detect["count"]["state"], "on")

    def test_without_cameras_no_cameras_card(self):
        bare = D.cameras(D.House({}, []))
        self.assertEqual(cards_of(bare, "cameras-card"), [])
        self.assertEqual(len(cards_of(bare, "chips-card")), 1)


if __name__ == "__main__":
    unittest.main()
