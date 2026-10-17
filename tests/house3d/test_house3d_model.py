"""Tests for scripts/house3d_model.py and scripts/house3d-build.py, on the synthetic fixture.

Run from the repo root: python3 -I -m unittest discover -s tests/house3d -v
"""
import copy, importlib.util, json, os, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
ENGINE = ROOT / "house3d"
BUILD = ROOT / "scripts/house3d-build.py"

_spec = importlib.util.spec_from_file_location("house3d_model", ROOT / "scripts/house3d_model.py")
hm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hm)
_bspec = importlib.util.spec_from_file_location("house3d_build", BUILD)
hb = importlib.util.module_from_spec(_bspec)
_bspec.loader.exec_module(hb)
DEMO = ROOT / "demo"


def layers():
    return hm.read_layers(FIXTURE)


def run(*args, env=None):
    return subprocess.run([sys.executable, "-I", str(BUILD), *map(str, args)], capture_output=True, text=True, env=env)


class FixtureModel(unittest.TestCase):
    def test_fixture_validates(self):
        self.assertEqual(hm.validate(layers()), [])

    def test_merge_is_a_union_of_keys(self):
        L = layers()
        model = hm.merge(L, hm.LAYERS)
        for name, layer in L.items():
            for key in layer:
                self.assertIn(key, model)
        self.assertNotIn("devices", hm.merge(L, hm.PUBLIC))

    def test_with_room_names_replaces_neutral_names(self):
        L = layers()
        model = hm.with_room_names(hm.merge(L, hm.LAYERS))
        names = {r["id"]: r["name"] for r in model["rooms"]}
        self.assertEqual(names["r1"], L["private"]["room_names"]["r1"])
        self.assertEqual(names["r2"], L["private"]["room_names"]["r2"])
        self.assertEqual(names["carport"], "Varjualune")
        self.assertNotIn("room_names", model)
        # the shareable rooms layer keeps its neutral names
        self.assertEqual(L["rooms"]["rooms"][0]["name"], "Elutuba")

    def test_private_strings(self):
        L = layers()
        out = hm.private_strings(hm.merge(L, hm.LAYERS))
        for d in L["private"]["devices"]:
            self.assertIn(d["entity"], out)
            self.assertIn(d["name"], out)
        for name in L["private"]["room_names"].values():
            self.assertIn(name, out)
        self.assertIn(L["private"]["car"]["entity"], out)
        self.assertIn(L["private"]["car"]["name"], out)


def _walls(L):
    return L["geometry"]["walls"]


def _gr(L):
    return L["geometry"]["site"]["garage_roof"]


def _no_sill(L):
    del _walls(L)[0]["openings"][0]["sill"]


def _bad_kind(L):
    _walls(L)[0]["openings"][0]["kind"] = "hatch"


def _both(L):
    _gr(L)["rect"] = [12.8, 0.8, 17.2, 7.2]


def _neither(L):
    del _gr(L)["rects"]


def _empty(L):
    _gr(L)["rects"] = []


def _three(L):
    _gr(L)["rects"][0] = [12.8, 0.8, 17.2]


def _y_reversed(L):
    _gr(L)["y"] = [2.8, 2.6]


def _x_reversed(L):
    _gr(L)["rects"][1] = [14, 7.2, 12.8, 9]


def _no_private(L):
    del L["private"]


def _twice(L):
    L["rooms"]["ceiling"] = 2.6


def _bad_finish(L):
    _walls(L)[6]["finish"] = "brick"


def _bad_floor(L):
    L["rooms"]["rooms"][0]["floor"] = "carpet"


def _short_path(L):
    L["private"]["car"]["path"][0] = [15.137, -7.137]


def _site(L):
    return L["geometry"]["site"]


def _bar_fence_point(L):
    _site(L)["bar_fences"][0] = [[0, -6]]


def _trampoline_flat(L):
    _site(L)["trampoline"]["height"] = 0


def _trampoline_rect(L):
    _site(L)["trampoline"]["rect"] = [10, 12, 8, 13]


def _slide_three(L):
    _site(L)["swing"]["slide"] = [1, 2, 3]


def _planter_y(L):
    _site(L)["planters"][0]["y"] = [0.5, 0]


def _planter_plant(L):
    _site(L)["planters"][0]["plant"] = "palm"


def _opening_finish(L):
    _walls(L)[0]["openings"][2]["finish"] = "frame"


def _light_kind(L):
    _site(L)["lights"][0]["kind"] = "spot"


def _light_face(L):
    del _site(L)["lights"][1]["face"]


def _light_off_lot(L):
    _site(L)["lights"][0]["pos"] = [4, 2, 30]


def _planter_finish(L):
    _site(L)["planters"][1]["finish"] = "brick"


def _step_height(L):
    _site(L)["steps"][0]["height"] = -0.1


def _planter_list(L):
    _site(L)["planters"][0] = [11, -1, 11.6, -0.4]


def _step_rect(L):
    _site(L)["steps"][0]["rect"] = [11, 1.3, 10, 1.8]


def _future(L, i=None):
    items = L["private"]["future"]["items"]
    return items if i is None else next(it for it in items if it["id"] == i)


def _future_kind(L):
    _future(L, "tub")["kind"] = "sauna"


def _future_dup(L):
    _future(L, "tub")["id"] = "pv"


def _future_pos(L):
    _future(L, "tub")["pos"] = [9.113]


def _future_off_lot(L):
    _future(L, "greenhouse")["pos"] = [25.113, 12.113]


def _future_off_walls(L):
    del L["geometry"]["site"]["lot"]
    _future(L, "greenhouse")["pos"] = [14.513, 12.113]


def _future_rot(L):
    _future(L, "charger")["rot"] = 45


def _future_size(L):
    _future(L, "greenhouse")["size"] = [3, 0]


def _future_pv_size(L):
    del _future(L, "pv")["size"]


def _future_roof(L):
    _future(L, "pv")["roof"] = "roofX"


def _future_off_roof(L):
    _future(L, "pv")["pos"] = [7.013, 7.151]


def _future_off_notch(L):
    # a notch cut into the roof's south edge under the panels: every corner stays inside, an edge crosses
    L["geometry"]["roofs"]["roofN"]["outline"] = [[1.7, 6], [6, 6], [6, 7], [8, 7], [8, 6], [12.3, 6], [12.3, 10.3], [1.7, 10.3]]


def _future_kwp(L):
    _future(L, "pv")["kwp"] = 0


def _future_panels(L):
    _future(L, "pv")["panels"] = 12.5


def _future_too_many(L):
    _future(L, "pv")["panels"] = 13


def _future_facts(L):
    _future(L, "pv")["facts"] = ["rida"] * 7


def _future_fact_long(L):
    _future(L, "pv")["facts"][0] = "x" * 81


def _future_as_of(L):
    L["private"]["future"]["as_of"] = "15.01.2026"


def _future_name(L):
    _future(L, "tub")["name"] = ""


MUTATIONS = [
    ("window without sill", _no_sill, "a window needs a sill"),
    ("unknown opening kind", _bad_kind, "is not window, door or glassdoor"),
    ("garage_roof with rect and rects", _both, "site.garage_roof: needs either rect or rects"),
    ("garage_roof with neither", _neither, "site.garage_roof: needs either rect or rects"),
    ("garage_roof with empty rects", _empty, "site.garage_roof.rects: not a non-empty list"),
    ("garage_roof rect of three numbers", _three, "site.garage_roof.rects[0]: rect"),
    ("garage_roof y reversed", _y_reversed, "site.garage_roof: y must be [y0, y1]"),
    ("rect with x0 > x1", _x_reversed, "site.garage_roof.rects[1]: rect"),
    ("private layer missing", _no_private, "layer private is missing"),
    ("key in two layers", _twice, "key ceiling is in more than one layer"),
    ("car path does not clear the drive gate", _short_path, "car: path starts"),
    ("unknown wall finish", _bad_finish, "walls[6]: finish 'brick' is not panel"),
    ("unknown floor finish", _bad_floor, "room r1: floor 'carpet' is not one of tile, paving"),
    ("bar fence of one point", _bar_fence_point, "site.bar_fences[0]: must be [[x, z], [x, z]]"),
    ("trampoline without height", _trampoline_flat, "site.trampoline: height is not a positive number"),
    ("trampoline rect reversed", _trampoline_rect, "site.trampoline: rect"),
    ("slide of three numbers", _slide_three, "site.swing: slide must be [x, z]"),
    ("planter y reversed", _planter_y, "site.planters[0]: y must be [y0, y1]"),
    ("unknown plant", _planter_plant, "site.planters[0]: plant 'palm' is not one of thuja, low"),
    ("unknown opening finish", _opening_finish, "walls[0].openings[2]: finish 'frame' is not one of cladding"),
    ("unknown light kind", _light_kind, "site.lights[0]: kind 'spot' is not one of ceiling, wall"),
    ("wall light without face", _light_face, "site.lights[1]: a wall light needs face [dx, dz], its outward direction"),
    ("light off the lot", _light_off_lot, "site.lights[0]: pos is outside the lot"),
    ("unknown planter finish", _planter_finish, "site.planters[1]: finish 'brick' is not one of frame, cladding"),
    ("step without height", _step_height, "site.steps[0]: height is not a positive number"),
    ("planter not an object", _planter_list, "site.planters[0]: not a JSON object"),
    ("step rect reversed", _step_rect, "site.steps[0]: rect"),
    ("unknown future kind", _future_kind, "future item tub: kind 'sauna' is not one of"),
    ("future id twice", _future_dup, "future.items: id 'pv' is not unique"),
    ("future pos of one number", _future_pos, "future item tub: pos must be [x, z]"),
    ("future item off the lot", _future_off_lot, "future item greenhouse: pos is outside the lot"),
    ("future item outside the walls' box without a lot", _future_off_walls, "future item greenhouse: pos is outside the lot"),
    ("future rot of 45", _future_rot, "future item charger: rot 45 is not one of"),
    ("future size not positive", _future_size, "future item greenhouse: size must be [w, d]"),
    ("pv without size", _future_pv_size, "future item pv: size must be [w, d]"),
    ("pv on an unknown roof", _future_roof, "future item pv: roof 'roofX' is not a roof"),
    ("pv over the roof's edge", _future_off_roof, "future item pv: its rectangle is not inside roof roofN's outline"),
    ("pv over a notch in the roof", _future_off_notch, "future item pv: its rectangle is not inside roof roofN's outline"),
    ("pv kwp zero", _future_kwp, "future item pv: kwp is not a positive number"),
    ("pv panels not whole", _future_panels, "future item pv: panels is not a positive whole number"),
    ("pv panels do not fit", _future_too_many, "future item pv: 13 panels do not fit in 7.2 x 3.6 m (at most 12)"),
    ("seven facts", _future_facts, "future item pv: facts must be a list of at most 6 lines"),
    ("a fact of 81 characters", _future_fact_long, "future item pv: every fact must be a line of 1 to 80 characters"),
    ("as_of not ISO", _future_as_of, "future: as_of '15.01.2026' is not a date YYYY-MM-DD"),
    ("future name empty", _future_name, "future item tub: name missing"),
]


class Mutations(unittest.TestCase):
    def test_each_mutation_reports_its_problem(self):
        base = layers()
        for name, mutate, problem in MUTATIONS:
            with self.subTest(name):
                L = copy.deepcopy(base)
                mutate(L)
                problems = hm.validate(L)
                self.assertTrue(any(problem in p for p in problems), f"{problem!r} not in {problems}")


class FuturePanels(unittest.TestCase):
    def test_panel_fit_takes_the_better_orientation(self):
        # landscape 4 x 3, portrait 6 x 2: 12 either way; the fixture's roof holds 18
        self.assertEqual(hm.panel_fit(7.2, 3.6), 12)
        self.assertEqual(hm.panel_fit(10.6, 4.3), 18)
        # 1.8 m deep holds one row either way: two panels landscape, three portrait
        self.assertEqual(hm.panel_fit(3.5, 1.8), 3)
        self.assertEqual(hm.panel_fit(1.0, 1.0), 0)

    def test_future_corners_turn_with_rot(self):
        it = {"pos": [10, 20], "size": [4, 2], "rot": 90}
        self.assertEqual(hm.future_corners(it), [[9, 18], [11, 18], [11, 22], [9, 22]])


class BuildAndScan(unittest.TestCase):
    def test_build_keeps_the_bearing_and_leaves_out_georef_and_devices(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = run(FIXTURE, tmp)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            model = json.loads((Path(tmp) / "model.json").read_text(encoding="utf-8"))
            self.assertNotIn("georef", model)
            self.assertEqual(model["orientation"], {"x_axis_bearing_deg": 30})
            self.assertNotIn("devices", model)
            self.assertNotIn("car", model)
            self.assertNotIn("surroundings", model)

    def test_scan_of_the_engine_is_clean(self):
        r = run("--scan", FIXTURE, ENGINE)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_scan_finds_an_entity_id(self):
        entity = layers()["private"]["devices"][0]["entity"]
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "house3d.js"
            shutil.copyfile(ENGINE / "house3d.js", f)
            with f.open("a", encoding="utf-8") as out:
                out.write(f"\n// {entity}\n")
            r = run("--scan", FIXTURE, f)
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn(f"private string {entity!r}", r.stdout)

    def test_scan_finds_a_future_item_position(self):
        x, z = next(it for it in layers()["private"]["future"]["items"] if it["id"] == "tub")["pos"]
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "model.json"
            f.write_text(f'{{"pos":[{x},{z}]}}', encoding="utf-8")
            r = run("--scan", FIXTURE, f)
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn(f"{f}:1: future item 4 position", r.stdout)
            self.assertNotIn(str(x), r.stdout)

    def test_scan_skips_whole_metre_future_positions(self):
        model = hm.merge(layers(), hm.LAYERS)
        model["future"]["items"][4]["pos"] = [9, 12]
        labels = [label for label, _ in hb.patterns(model)]
        self.assertNotIn("future item 4 position", labels)
        self.assertIn("future item 0 position", labels)

    def test_scan_allows_a_devices_key_only_in_the_named_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            allowed, other = Path(tmp) / "model.json", Path(tmp) / "other.json"
            entity = layers()["private"]["devices"][0]["entity"]
            allowed.write_text(f'{{"devices": ["{entity}"]}}', encoding="utf-8")
            other.write_text('{"devices": []}', encoding="utf-8")
            r = run("--scan", "--allow-devices-key", allowed, FIXTURE, tmp)
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn(f"{other}:1: a devices key", r.stdout)
            self.assertNotIn(f"{allowed}:1: a devices key", r.stdout)
            self.assertIn(f"{allowed}:1: private string {entity!r}", r.stdout)

    def test_scan_allows_a_test_house_device_name_only_in_the_named_file(self):
        device = layers()["private"]["devices"][0]
        with tempfile.TemporaryDirectory() as tmp:
            allowed, other = Path(tmp) / "model.json", Path(tmp) / "other.json"
            for f in (allowed, other):
                f.write_text(f'"{device["name"]}"', encoding="utf-8")
            r = run("--scan", "--allow-device-name", device["entity"], allowed, FIXTURE, tmp)
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn(f"{other}:1: private string {device['name']!r}", r.stdout)
            self.assertNotIn(str(allowed), r.stdout)
            r = run("--scan", "--allow-device-name", "light.nowhere", allowed, FIXTURE, tmp)
            self.assertIn("no device light.nowhere", r.stderr)


class Demo(unittest.TestCase):
    DEMO_FILES = ("index.html", "demo.js", "house3d-card.js", "house3d.js", "model.json")
    DATA_FILES = ("dashboard.json", "states.json", "series.json")

    def build(self, tmp, env=None):
        r = run("--demo", tmp, env=env)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        return Path(tmp)

    def test_demo_writes_the_card_engine_and_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            for name in self.DEMO_FILES:
                self.assertTrue((out / name).is_file(), name)
            self.assertTrue((out / "scene").is_dir())
            self.assertTrue((out / "vendor").is_dir())
            model = json.loads((out / "model.json").read_text(encoding="utf-8"))
            L = layers()
            self.assertEqual(model["devices"], L["private"]["devices"])
            self.assertEqual(model["car"], L["private"]["car"])
            self.assertEqual(model["surroundings"], L["surroundings"]["surroundings"])
            self.assertIn("walls", model)
            self.assertNotIn("showcase", model)
            self.assertNotIn("room_names", model)

    def test_demo_writes_the_dashboard_states_and_series(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            data = {n: json.loads((out / n).read_text(encoding="utf-8")) for n in self.DATA_FILES}
            self.assertEqual(data["dashboard.json"]["views"][0]["path"], "maja-3d")
            self.assertIn("states", data["states.json"])
            self.assertTrue(data["series.json"])
            self.assertFalse((out / "dashboard.js").exists())

    def test_demo_carries_the_card_and_demo_versions(self):
        version = re.search(r"^const HOUSE3D_VERSION = (\d+);", (ENGINE / "house3d-card.js").read_text(), re.M).group(1)
        demo = hb.demo_version(version)
        self.assertEqual(demo, hb.demo_version(version, data=hb.demo_data(hb.demo_model())))
        self.assertRegex(demo, r"^[0-9a-f]{10}$")
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            self.assertIn(f"?v={version}", (out / "demo.js").read_text(encoding="utf-8"))
            for name in ("index.html", "demo.js"):
                self.assertIn(f"?v={demo}", (out / name).read_text(encoding="utf-8"), name)

    def test_demo_copies_every_demo_file_without_placeholders(self):
        names = [f.name for f in hb.demo_files()]
        self.assertIn("index.html", names)
        self.assertIn("demo.js", names)
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            for name in names:
                text = (out / name).read_text(encoding="utf-8")
                self.assertNotIn("__HOUSE3D_VERSION__", text, name)
                self.assertNotIn("__DEMO_VERSION__", text, name)
            self.assertFalse(any(p.name.startswith(".") for p in out.iterdir()))

    def test_demo_version_follows_the_demo_files_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "demo"
            shutil.copytree(DEMO, copy)
            base = hb.demo_version("18", copy)
            self.assertEqual(base, hb.demo_version("18", DEMO))
            (copy / ".DS_Store").write_bytes(b"\0\1")
            (copy / "notes.txt").write_text("not shipped", encoding="utf-8")
            self.assertEqual(hb.demo_version("18", copy), base)
            self.assertNotEqual(hb.demo_version("19", copy), base)
            f = copy / "demo.js"
            f.write_bytes(f.read_bytes() + b"\n")
            self.assertNotEqual(hb.demo_version("18", copy), base)

    def test_demo_ignores_house3d_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            other = Path(tmp) / "other-model.md"
            text = FIXTURE.read_text(encoding="utf-8").replace("Testvalgusti", "Muuvalgusti")
            other.write_text(text, encoding="utf-8")
            plain = self.build(Path(tmp) / "plain")
            planted = self.build(Path(tmp) / "planted", env={**os.environ, "HOUSE3D_MODEL": str(other)})
            for f in sorted(p for p in plain.rglob("*") if p.is_file()):
                self.assertEqual(f.read_bytes(), (planted / f.relative_to(plain)).read_bytes(), f.name)

    def test_demo_takes_no_model_argument(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = run("--demo", FIXTURE, tmp)
            self.assertEqual(r.returncode, 2, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
