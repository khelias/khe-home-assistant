"""Tests for scripts/house3d_model.py and scripts/house3d-build.py, on the synthetic fixture.

Run from the repo root: python3 -I -m unittest discover -s tests/house3d -v
"""
import copy, importlib.util, json, math, os, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
TWOSTOREY = ROOT / "tests/house3d/fixture-twostorey.md"
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
        self.assertEqual(L["rooms"]["rooms"][0]["name"], "Köök-elutuba")

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
    L["private"]["car"]["path"][0] = [35.213, -7.137]


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


def _glass_on_window(L):
    _walls(L)[0]["openings"][0]["glass"] = 0.2


def _glass_too_wide(L):
    _walls(L)[0]["openings"][2]["glass"] = 0.7


def _glass_c_outside(L):
    o = _walls(L)[0]["openings"][2]
    o.update(glass=0.2, glass_c=o["c"] + o["w"] / 2 - 0.1)


def _hinge_on_window(L):
    _walls(L)[0]["openings"][0].update(hinge="a", swing=[0, 1])


def _swing_along_wall(L):
    w = _walls(L)[0]
    w["openings"][2].update(hinge="b", swing=[w["b"][0] - w["a"][0], w["b"][1] - w["a"][1]])


def _hinge_without_swing(L):
    _walls(L)[0]["openings"][2]["hinge"] = "a"


def _open_too_far(L):
    w = _walls(L)[0]
    w["openings"][2].update(hinge="a", swing=[-(w["b"][1] - w["a"][1]), w["b"][0] - w["a"][0]], open=200)


def _chair_two_backs(L):
    L["geometry"]["furniture"][0].update(kind="chair", back=["x0", "z0"])


def _bloom_on_table(L):
    L["geometry"]["furniture"][0].update(kind="table", bloom=True)


def _picture_on_floor(L):
    f = L["geometry"]["furniture"][0]
    f.update(kind="picture", y=[0, 1])


def _art_too_high(L):
    L["geometry"]["furniture"][0].update(kind="picture", y=[1, 1.5], art=4)


def _open_without_hinge(L):
    _walls(L)[0]["openings"][2]["open"] = 90


def _kitchen_finish_on_desk(L):
    L["geometry"]["furniture"][0].update(kind="desk", finish="anthracite")


def _light_kind(L):
    _site(L)["lights"][0]["kind"] = "spot"


def _light_face(L):
    del _site(L)["lights"][1]["face"]


def _light_off_lot(L):
    _site(L)["lights"][0]["pos"] = [4, 2, 30]


def _festive_one_point(L):
    _site(L)["festive"]["icicles"][0]["path"] = [[33.28, 2.48, -3.02]]


def _festive_off_lot(L):
    _site(L)["festive"]["icicles"][1]["path"][0] = [31.32, 2.72, -7]


def _festive_drop(L):
    _site(L)["festive"]["icicles"][0]["drop"] = 2


def _christmas_tree_off_lot(L):
    _site(L)["festive"]["christmas_trees"][0]["pos"] = [24.9, 40]


def _christmas_tree_wide(L):
    _site(L)["festive"]["christmas_trees"][0]["base"] = 2.5


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
    _future(L, "greenhouse")["pos"] = [43.113, 12.113]


def _future_off_walls(L):
    del L["geometry"]["site"]["lot"]
    _future(L, "greenhouse")["pos"] = [15.113, 12.113]


def _future_rot(L):
    _future(L, "charger")["rot"] = 45


def _future_size(L):
    _future(L, "greenhouse")["size"] = [3, 0]


def _future_pv_size(L):
    del _future(L, "pv")["size"]


def _future_roof(L):
    _future(L, "pv")["roof"] = "roofX"


def _future_off_roof(L):
    _future(L, "pv")["pos"] = [31.013, 13.013]


def _future_off_notch(L):
    # a notch cut into the roof's north edge under the panels: every corner stays inside, an edge crosses
    outline = L["geometry"]["roofs"]["wingN"]["outline"]
    x = outline[1][0]
    outline[2:2] = [[x, 12], [35, 12], [35, 14], [x, 14]]


def _future_kwp(L):
    _future(L, "pv")["kwp"] = 0


def _future_panels(L):
    _future(L, "pv")["panels"] = 12.5


def _future_too_many(L):
    _future(L, "pv")["panels"] = 21


def _future_facts(L):
    _future(L, "pv")["facts"] = ["rida"] * 7


def _future_fact_long(L):
    _future(L, "pv")["facts"][0] = "x" * 81


def _future_as_of(L):
    L["private"]["future"]["as_of"] = "15.01.2026"


def _future_name(L):
    _future(L, "tub")["name"] = ""


def _furniture_kind(L):
    L["geometry"]["furniture"][0]["kind"] = "sink"


def _units(L):
    """The first furniture item as a valid 1.2 m run of base units along x."""
    f = L["geometry"]["furniture"][0]
    f.pop("circle", None)
    f.update(
        kind="base_units",
        rect=[1, 1, 2.2, 1.6],
        y=[0, 0.9],
        along="x",
        fronts=[["door", 0.6], ["drawers", 0.6]],
    )
    return f


def _front_type(L):
    _units(L)["fronts"][0][0] = "hatch"


def _front_width(L):
    _units(L)["fronts"][1][1] = 0


def _front_shape(L):
    _units(L)["fronts"][0] = "door"


def _no_along(L):
    del _units(L)["along"]


def _bad_along(L):
    _units(L)["along"] = "y"


def _no_fronts(L):
    del _units(L)["fronts"]


def _fronts_sum(L):
    _units(L)["fronts"][1][1] = 0.65


def _fronts_sum_on_z(L):
    _units(L)["along"] = "z"


def _fronts_on_table(L):
    f = _units(L)
    f["kind"] = "table"
    del f["along"]


def _along_on_table(L):
    f = _units(L)
    f["kind"] = "table"
    del f["fronts"]


def _units_circle(L):
    f = _units(L)
    del f["rect"]
    f["circle"] = [1, 1, 0.5]


def _sofa_edge(L):
    f = L["geometry"]["furniture"][0]
    f["kind"] = "sofa"
    f["back"] = ["north"]


def _back_on_table(L):
    f = L["geometry"]["furniture"][0]
    f["kind"] = "table"
    f["arm"] = ["x0"]


def _back_on_circle(L):
    f = L["geometry"]["furniture"][0]
    f.pop("rect", None)
    f.update(kind="sofa", circle=[1, 1, 0.5], back=["x0"])


def _vanity(L):
    """The first furniture item as a valid wall-hung vanity of two basins."""
    f = _units(L)
    f.update(kind="vanity", y=[0.45, 0.85], basins=2, finish="anthracite")
    return f


def _vanity_no_basins(L):
    del _vanity(L)["basins"]


def _vanity_three_basins(L):
    _vanity(L)["basins"] = 3


def _basins_on_table(L):
    f = L["geometry"]["furniture"][0]
    f["kind"] = "table"
    f["basins"] = 1


def _unknown_finish(L):
    _vanity(L)["finish"] = "oak"


def _finish_on_bed(L):
    f = L["geometry"]["furniture"][0]
    f["kind"] = "bed"
    f["finish"] = "white"


def _stove_circle(L):
    f = L["geometry"]["furniture"][0]
    f.pop("rect", None)
    f.update(kind="stove", circle=[1, 1, 0.3])


def _mirror_on_floor(L):
    f = L["geometry"]["furniture"][0]
    f.update(kind="mirror", y=[0, 1.8])


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
    ("glass on a window", _glass_on_window, "walls[0].openings[0]: glass is a door's strip"),
    ("a glass strip too wide for its door", _glass_too_wide, "walls[0].openings[2]: glass is a door's strip"),
    ("a glass strip off its leaf", _glass_c_outside, "walls[0].openings[2]: glass is a door's strip"),
    ("a hinge on a window", _hinge_on_window, "walls[0].openings[0]: an open door has hinge a or b"),
    ("a swing along the wall", _swing_along_wall, "walls[0].openings[2]: an open door has hinge a or b"),
    ("a hinge without a swing", _hinge_without_swing, "walls[0].openings[2]: an open door has hinge a or b"),
    ("a door opened past 180", _open_too_far, "walls[0].openings[2]: an open door has hinge a or b"),
    ("unknown light kind", _light_kind, "site.lights[0]: kind 'spot' is not one of ceiling, wall"),
    ("wall light without face", _light_face, "site.lights[1]: a wall light needs face [dx, dz], its outward direction"),
    ("light off the lot", _light_off_lot, "site.lights[0]: pos is outside the lot"),
    ("icicle path of one point", _festive_one_point, "site.festive.icicles[0]: path must be two or more [x, y, z] points"),
    ("icicle point off the lot", _festive_off_lot, "site.festive.icicles[1]: a point is outside the lot"),
    ("icicle drop of 2", _festive_drop, "site.festive.icicles[0]: drop must be above 0 and at most 1"),
    ("christmas tree off the lot", _christmas_tree_off_lot, "site.festive.christmas_trees[0]: pos is outside the lot"),
    ("christmas tree wider than tall", _christmas_tree_wide, "site.festive.christmas_trees[0]: base must be above 0 and at most the height"),
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
    ("pv over the roof's edge", _future_off_roof, "future item pv: its rectangle is not inside roof wingN's outline"),
    ("pv over a notch in the roof", _future_off_notch, "future item pv: its rectangle is not inside roof wingN's outline"),
    ("pv kwp zero", _future_kwp, "future item pv: kwp is not a positive number"),
    ("pv panels not whole", _future_panels, "future item pv: panels is not a positive whole number"),
    ("pv panels do not fit", _future_too_many, "future item pv: 21 panels do not fit in 3.5 x 11.5 m (at most 20)"),
    ("seven facts", _future_facts, "future item pv: facts must be a list of at most 6 lines"),
    ("a fact of 81 characters", _future_fact_long, "future item pv: every fact must be a line of 1 to 80 characters"),
    ("as_of not ISO", _future_as_of, "future: as_of '15.01.2026' is not a date YYYY-MM-DD"),
    ("future name empty", _future_name, "future item tub: name missing"),
    ("unknown furniture kind", _furniture_kind, "furniture[0]: kind 'sink' is not one of bed, headboard"),
    ("unknown front type", _front_type, "furniture[0].fronts[0]: type 'hatch' is not one of door, drawers"),
    ("front of no width", _front_width, "furniture[0].fronts[1]: width 0 is not a positive number"),
    ("front not a pair", _front_shape, "furniture[0].fronts[0]: must be [type, width]"),
    ("units without along", _no_along, "furniture[0]: along None is not x or z"),
    ("units along y", _bad_along, "furniture[0]: along 'y' is not x or z"),
    ("units without fronts", _no_fronts, "furniture[0]: fronts must be a list of [type, width]"),
    ("fronts that miss the width", _fronts_sum, "furniture[0]: fronts sum to 1.250 m, the item is 1.200 m on x"),
    ("fronts measured on along", _fronts_sum_on_z, "furniture[0]: fronts sum to 1.200 m, the item is 0.600 m on z"),
    ("fronts on a table", _fronts_on_table, "furniture[0]: fronts is only for base_units"),
    ("along on a table", _along_on_table, "furniture[0]: along is only for base_units"),
    ("units on a circle", _units_circle, "furniture[0]: a run of units needs a rect"),
    ("sofa back on an unknown edge", _sofa_edge, "furniture[0]: back must be a list of x0, x1, z0, z1"),
    ("arm on a table", _back_on_table, "furniture[0]: arm is only for sofa"),
    ("a chair with two backs", _chair_two_backs, "furniture[0]: a chair's back is 1 edge"),
    ("sofa back on a circle", _back_on_circle, "furniture[0]: back needs a rect"),
    ("vanity without basins", _vanity_no_basins, "furniture[0]: basins None is not 1 or 2"),
    ("vanity of three basins", _vanity_three_basins, "furniture[0]: basins 3 is not 1 or 2"),
    ("basins on a table", _basins_on_table, "furniture[0]: basins is only for vanity"),
    ("unknown finish", _unknown_finish, "furniture[0]: finish 'oak' is not one of kitchen, anthracite, white"),
    ("finish on a bed", _finish_on_bed, "furniture[0]: finish is only for base_units"),
    ("stove on a circle", _stove_circle, "furniture[0]: a stove needs a rect"),
    ("mirror on the floor", _mirror_on_floor, "furniture[0]: a mirror hangs on the wall, its y0 above 0"),
    ("picture on the floor", _picture_on_floor, "furniture[0]: a picture hangs on the wall, its y0 above 0"),
    ("bloom on a table", _bloom_on_table, "furniture[0]: bloom is true or false on a plant"),
    ("art past the palettes", _art_too_high, "furniture[0]: art is 0 to 3 on a picture"),
    ("open without a hinge", _open_without_hinge, "walls[0].openings[2]: an open door has hinge a or b"),
    ("a kitchen finish on a desk", _kitchen_finish_on_desk, "furniture[0]: finish 'anthracite' is not one of dark_oak, medium_oak"),
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


def twostorey():
    return hm.read_layers(TWOSTOREY)


def _geo(L):
    return L["geometry"]


# mutations of the two-storey fixture: (name, mutate(layers), substring of the problem)
TWO_MUTATIONS = [
    ("a roof kind that does not exist", lambda L: _geo(L)["roofs"]["main"].update(kind="mansard"), "roof main: kind 'mansard' is not one of"),
    ("wings that only touch", lambda L: _geo(L)["roofs"]["main"].update(rects=[[0, 0, 6, 8], [6, 0, 12, 8]]), "roof main: rects[0] and rects[1] only touch"),
    ("wings that only meet at a corner", lambda L: _geo(L)["roofs"]["main"].update(rects=[[0, 0, 6, 8], [6, 8, 12, 14]]), "only touch"),
    ("wings apart", lambda L: _geo(L)["roofs"]["main"].update(rects=[[0, 0, 6, 8], [7, 0, 12, 8]]), "roof main: its wings do not overlap into one roof"),
    ("a reversed wing", lambda L: _geo(L)["roofs"]["main"]["rects"].__setitem__(0, [12, 0, 0, 8]), "roof main: rects[0]"),
    ("a gable ridge that is no axis", lambda L: _geo(L)["roofs"]["garage"].update(ridge="y"), "roof garage: a gable roof's ridge must be x or z"),
    ("a hip roof without eave_y", lambda L: _geo(L)["roofs"]["main"].pop("eave_y"), "roof main: eave_y is not a number"),
    ("a hip roof without a pitch", lambda L: _geo(L)["roofs"]["main"].pop("pitch_deg"), "roof main: needs pitch_deg or slope"),
    ("a flat roof without y", lambda L: _geo(L)["roofs"]["porch"].pop("y"), "roof porch: a flat roof needs y"),
    ("a hip roof with an outline", lambda L: _geo(L)["roofs"]["main"].update(outline=[[0, 0], [1, 0], [1, 1]]), "roof main: a hip roof has rects, not an outline"),
    ("levels not ascending", lambda L: _geo(L).update(levels=[0, 3, 2]), "geometry: levels [0, 3, 2] must be ascending"),
    ("levels not from 0", lambda L: _geo(L).update(levels=[0.5, 3]), "must be ascending floor heights from 0"),
    ("a wall on a level that does not exist", lambda L: _geo(L)["walls"][9].update(level=2), "walls[9]: level 2 is not an index into levels"),
    ("a room on a level that does not exist", lambda L: L["rooms"]["rooms"][3].update(level=-1), "room bed: level -1 is not an index"),
    ("an upper wall's top under its floor", lambda L: _geo(L)["walls"][15].update(top=2.8), "walls[15]: top 2.8 is not above its level's floor 3"),
    ("an upper wall under a roof below its floor", lambda L: _geo(L)["walls"][9].update(top="garage"), "walls[9]: roof garage runs below its level's floor 3"),
]


class RoofKinds(unittest.TestCase):
    def test_the_two_storey_fixture_validates(self):
        self.assertEqual(hm.validate(twostorey()), [])

    def test_each_mutation_reports_its_problem(self):
        base = twostorey()
        for name, mutate, problem in TWO_MUTATIONS:
            with self.subTest(name):
                L = copy.deepcopy(base)
                mutate(L)
                problems = hm.validate(L)
                self.assertTrue(any(problem in p for p in problems), f"{problem!r} not in {problems}")

    def test_pv_on_a_hip_roof_is_refused(self):
        L = layers()
        L["geometry"]["roofs"]["wingN"] = {"kind": "hip", "rects": [[30, 3, 38, 23]], "eave_y": 4, "slope": 0.2, "thick": 0.3}
        self.assertIn("future item pv: roof wingN is not a shed roof; PV lies on shed roofs only", hm.validate(L))

    def test_heights_of_each_kind(self):
        roofs = _geo(twostorey())["roofs"]
        main, porch, garage = roofs["main"], roofs["porch"], roofs["garage"]
        slope = math.tan(math.radians(22))
        # hip: eave at the edge, rising by the distance to the nearest edge
        self.assertAlmostEqual(hm.roof_height(main, -0.5, 4), 5.4)
        self.assertAlmostEqual(hm.roof_height(main, 0.5, 4), 5.4 + slope)
        self.assertAlmostEqual(hm.roof_height(main, 6, 4), 5.4 + 4.5 * slope, msg="the long wing's ridge")
        self.assertAlmostEqual(hm.roof_height(main, 12, 4), 5.4 + 0.5 * slope, msg="its hipped end")
        # gable, ridge along z: across x only, so the gable end stands at the ridge's height
        gs = math.tan(math.radians(30))
        self.assertAlmostEqual(hm.roof_height(garage, 18, 0.6), 2.5 + 3.3 * gs)
        self.assertAlmostEqual(hm.roof_height(garage, 15, 5), 2.5 + 0.3 * gs)
        # flat
        self.assertEqual(hm.roof_height(porch, 13, 4), 3.3)
        # outside every wing: the nearest wing at the nearest point
        self.assertAlmostEqual(hm.roof_height(main, -3, 4), 5.4)
        self.assertAlmostEqual(hm.roof_height(garage, 18, -1), 2.5 + 3.3 * gs)

    def test_the_l_valley_is_both_wings_roofs(self):
        main = _geo(twostorey())["roofs"]["main"]
        slope = math.tan(math.radians(22))
        a, b = main["rects"]
        wing = lambda q, x, z: 5.4 + slope * min(x - q[0], q[2] - x, z - q[1], q[3] - z)
        # the inner corner (6.5, 8.5): on its 45-degree diagonal into the overlap both wings agree
        for t in (0.5, 1.5, 3):
            x, z = 6.5 - t, 8.5 - t
            self.assertAlmostEqual(wing(a, x, z), wing(b, x, z))
            self.assertAlmostEqual(hm.roof_height(main, x, z), wing(a, x, z))
        # off the diagonal the higher wing wins
        self.assertAlmostEqual(hm.roof_height(main, 3, 7), max(wing(a, 3, 7), wing(b, 3, 7)))

    def test_rects_bbox_and_area(self):
        roofs = _geo(twostorey())["roofs"]
        self.assertEqual(hm.roof_bbox(roofs["main"]), [-0.5, -0.5, 12.5, 14.5])
        self.assertAlmostEqual(hm.roof_area(roofs["main"]), 13 * 9 + 7 * 6)
        self.assertEqual(hm.roof_rects(roofs["garage"]), [[14.7, 0.6, 21.3, 8.4]])
        wing_n = _geo(layers())["roofs"]["wingN"]
        self.assertEqual(hm.roof_bbox(wing_n), [30.7, 3.7, 37.3, 22.3])
        self.assertEqual(hm.roof_rects(wing_n), [hm.roof_bbox(wing_n)])
        self.assertAlmostEqual(hm.roof_area(wing_n), 6.3 * 18.6 + 0.3 * 8)
        # a shed roof's height is its plane, the same at every z
        self.assertAlmostEqual(hm.roof_height(wing_n, 37.3, 5), 5)
        self.assertAlmostEqual(hm.roof_height(wing_n, 31, 20), 5 - 6.3 * math.tan(math.radians(7)))


class Festive(unittest.TestCase):
    def test_every_key_is_optional(self):
        for key in ("icicles", "planters"):
            with self.subTest(key):
                L = layers()
                del _site(L)["festive"][key]
                self.assertEqual(hm.validate(L), [])
        L = layers()
        del _site(L)["festive"]
        self.assertEqual(hm.validate(L), [])


class FurnitureKind(unittest.TestCase):
    def test_kind_is_optional(self):
        L = layers()
        for f in L["geometry"]["furniture"]:
            f.pop("kind", None)
        self.assertEqual(hm.validate(L), [])

    def test_fronts_fill_the_run_within_a_centimetre(self):
        L = layers()
        f = _units(L)
        self.assertEqual(hm.validate(L), [])
        f["fronts"][1][1] = 0.609
        self.assertEqual(hm.validate(L), [])

    def test_a_vanity_and_a_finished_bookcase_pass(self):
        L = layers()
        _vanity(L)
        self.assertEqual(hm.validate(L), [])
        f = L["geometry"]["furniture"][0]
        for key in ("along", "fronts", "basins"):
            del f[key]
        f.update(kind="bookcase", finish="white")
        self.assertEqual(hm.validate(L), [])


class FuturePanels(unittest.TestCase):
    def test_panel_fit_takes_the_better_orientation(self):
        # landscape 4 x 3, portrait 6 x 2: 12 either way; the fixture's strip holds 20 landscape
        self.assertEqual(hm.panel_fit(7.2, 3.6), 12)
        self.assertEqual(hm.panel_fit(3.5, 11.5), 20)
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
            self.assertEqual(model["orientation"], {"x_axis_bearing_deg": 354})
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
    DATA_FILES = (
        "dashboard.json",
        "states.json",
        "series.json",
        "dashboard.en.json",
        "states.en.json",
        "series.en.json",
        "model.en.json",
        "scenarios.json",
        "scenarios.en.json",
    )

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
            self.assertTrue((out / "parts").is_dir())
            for part in hb.CARDS_PARTS.glob("*.js"):
                self.assertEqual((out / "parts" / part.name).read_bytes(), part.read_bytes(), part.name)
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
            for lang in ("", ".en"):
                views = data[f"dashboard{lang}.json"]["views"]
                self.assertEqual((views[0]["path"], views[-1]["path"]), ("kodu", "maja-3d"))
                self.assertIn("states", data[f"states{lang}.json"])
                self.assertTrue(data[f"series{lang}.json"])
            self.assertIn("walls", data["model.en.json"])
            self.assertFalse((out / "dashboard.js").exists())

    def test_demo_carries_the_card_and_demo_versions(self):
        version = re.search(r"^const HOUSE3D_VERSION = (\d+);", (ENGINE / "house3d-card.js").read_text(), re.M).group(1)
        cards = hb.cards_version()
        demo = hb.demo_version(f"{version}/{cards}")
        self.assertEqual(
            demo, hb.demo_version(f"{version}/{cards}", data=hb.demo_data(hb.demo_model()))
        )
        self.assertRegex(demo, r"^[0-9a-f]{10}$")
        with tempfile.TemporaryDirectory() as tmp:
            out = self.build(tmp)
            self.assertIn(f"?v={version}", (out / "demo.js").read_text(encoding="utf-8"))
            self.assertIn(f"khe-cards.js?v={cards}", (out / "demo.js").read_text(encoding="utf-8"))
            self.assertEqual((out / "khe-cards.js").read_bytes(), hb.CARDS.read_bytes())
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
                self.assertNotIn("__KHE_CARDS_VERSION__", text, name)
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
