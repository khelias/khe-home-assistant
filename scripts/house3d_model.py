#!/usr/bin/env python3
"""Read and validate the house 3D model for the HA card and the standalone viewer.

The model lives in the private khe-meta repo (house/house-model.md) as four fenced
blocks plus the optional surroundings, each with the info string `json house3d:<layer>`:

  geometry      walls, roofs, furniture, site            shareable
  rooms         rooms with neutral names                 shareable
  private       family room names, every HA device, the   HA only, never published
                car (profile and drive-in path) and the
                future items (PV, charger, battery, ...)
  showcase      title, room texts, feature points        standalone viewer only
  surroundings  neighbouring buildings and the street,   HA only, never published
                machine-written by house3d-surroundings.py

Each block is a JSON object; merging layers is a plain union of their keys. The car
is optional; when present, validation checks its profile and that its path ends with
the car parked straight inside its room. With site.gates, the gate the car's path
crosses is the drive gate, and the path has to start far enough out for the car to
clear it while it opens. The future items are optional too: things the house does not
have yet, each placed on the plan, a pv item on a roof with its panels fitting.

Roofs: geometry.roofs.<id>.kind is "shed" (the default), "hip", "gable" or "flat". A shed
roof has an outline [[x, z], ...] and falls east or west along x from high_x at high_y by
pitch_deg or slope. The other kinds are a set of wings, rects [[x0, z0, x1, z1], ...] with
the overhang included, each wing overlapping the next (wings that only touch are refused):
hip and gable have eave_y, the roof line at the wings' edges, and pitch_deg or slope, a gable
also ridge "x" or "z" (the axis its ridge runs along); flat has y. The height at (x, z) is the
highest wing there: hip eave_y + slope * the distance to the wing's nearest edge, gable to the
nearest edge across the ridge, flat y; outside every wing the nearest wing's at the nearest
point. roof_height(), roof_rects(), roof_bbox() and roof_area() read every kind. PV items lie
on a shed roof inside its outline, or on one face of a hip or gable roof: inside one wing, on one
side of its ridge, where that wing is the roof's surface; never on a flat roof.

Storeys: geometry.levels is the floor heights, ascending and holding 0, the ground storey's
(default [0]): [-2.6, 0, 2.9] has a basement, [0, 1.4, 2.8] a split level. A wall, room, chimney
or piece of furniture has level, an index into levels, by default the ground storey's. A wall's
openings, doors and sills are relative to levels[level]; its top, a height or a roof id, and the
furniture's y stay absolute. ceiling is the ground storey's cut, absolute; ceilings (optional,
one per level) is each storey's cut above its own floor, more than 1.8 (the ground storey's equal
to ceiling); a storey without one takes ceiling above its floor. Where a storey's rooms overlap
a higher storey's in plan, its cut stays CEILING_GAP below that storey's floor. A wall up to a
roof or above its storey's cut is cut there: below the cut it stands up to the lower of the roof
and the cut, above it only where the roof is higher, so a knee wall stands whole. The view
shows one storey at a time from inside: everything above that storey's cut lifts away with the
roofs. storeys() gives each storey's floor and cut and the ground's index. A piece of furniture
is on its level, else on the storey of the room under its centre whose floor is at or below its
y0, else on the highest storey whose floor is; item_level() says which. A room below 0 lies
inside the box round the ground storey's rooms, FOOTPRINT_SLACK out for their walls. A room may have a type (ROOM_TYPES) and furnish (false keeps
a furnisher out of it). A stair is a straight flight, its rect climbing to the edge up names from
y0 to y1, about STAIR_RISE a step; a landing is a slab whose top is y1; an L or U stair is two
flights and a landing. showcase.level_names {"<index>": name} names the storeys in a viewer's
picker; without it one above ground is "N. korrus", one below "Kelder".

Look: geometry.look (optional) is the house's finishes in the real style; without it the engine
draws a light, matt architectural model. surfaces maps an engine surface name (SURFACES) to
"#rrggbb" or {"color": "#rrggbb", "roughness": 0..1, "metalness": 0..1}; cladding is
{"pattern": "plain"} or {"pattern": "boards", "angle_deg": 0, 45 or 90} (0 horizontal), the
boards optionally with "board", their width in m (0.08-0.4, at 0 and 90 degrees), and "groove",
the groove's share of a board (0.02-0.25);
roof is {"pattern": "plain" | "seam" | "tile"} (plain by default, on pitched roofs only);
trims {"openings", "corners", "base", "fascia"} are booleans for the opening trims with their
reveals and sill flashings, the corner boards, the base strip (the plinth) and the roofs' fascia
under a lip of roof, each off by default; base may instead be {"height": h}, 0.05 <= h <= 1.0
above floor 0 (true is 0.12). The base strip is in the frame's surface unless surfaces names
base; the casings (opening trims, corner boards, the fascias, site.posts) unless it names trim.
The simple style ignores it.

Chimneys: geometry.chimneys (optional) is a list of {"id", "rect": [x0, z0, x1, z1], "top": y,
"level": 0}, upright blocks from levels[level] to top, which runs at least 0.5 above that floor.
A chimney above its storey's cut is cut there like a wall up to a roof and again at each cut it
rises through, each part above rising and fading with the band over that cut. The real style
draws them in the chimney surface.

Posts and the carport roof: site.posts (optional) is a list of {"at": [x, z], "top": y,
"size": 0.15, "braces": [[dx, dz], ...]}, square posts from the ground to top, each brace a
45 degree knee brace from 0.6 m below the top out 0.6 m along its direction; size and braces
are optional. site.garage_roof may carry "rim" (0-0.2 m), an upstand round each rect's edge,
and "bands" (1-4), its fascia as that many stacked boards; without them, or with 1, one block. The
real style draws both in the casings' surface.

Usage:  house3d_model.py --check FILE
        house3d_model.py --layers geometry,rooms,showcase FILE   (or --layers all)
Import: load(path, layers), validate(layers), private_strings(model)
"""

import argparse
import json
import math
import re
import sys
from datetime import date
from itertools import combinations, pairwise

REQUIRED = ("geometry", "rooms", "private", "showcase")
LAYERS = REQUIRED + ("surroundings",)
PUBLIC = ("geometry", "rooms", "showcase")
CARD = ("geometry", "rooms", "private", "surroundings")  # the HA card's model: no showcase
OUTDOOR = "oues"
GATE_KINDS = ("sliding", "swing1", "swing2")
ROOM_FLOORS = ("tile", "paving")  # the real style's floor finishes besides the default oak
PLANTS = ("thuja", "low")
PLANTER_FINISHES = ("frame", "cladding")
OPENING_FINISHES = ("cladding",)  # a door leaf in the walls' cladding; without it, by the wall
LIGHT_KINDS = ("ceiling", "wall")  # site.lights: under a roof or soffit, or on a wall's face
SLIDE_OFFSET = (
    0.12  # a sliding leaf runs this far to the lot side of the fence line, past its rails
)
CAR_CLEARANCE = 0.3  # between the car and a gate leaf's sweep
ROOF_KINDS = ("shed", "hip", "gable", "flat")
FUTURE_KINDS = ("pv", "charger", "battery", "greenhouse", "tub")
# furniture: what the real style draws an item as; without a kind it is a plain block
FURNITURE_KINDS = (
    "bed",
    "headboard",
    "wardrobe",
    "sofa",
    "table",
    "desk",
    "counter",
    "cabinet",
    "bath",
    "bench",
    "appliance",
    "base_units",
    "wall_units",
    "tall_units",
    "hood",
    "shelf",
    "splashback",
    "tv",
    "rug",
    "curtain",
    "toilet",
    "vanity",
    "mirror",
    "washer",
    "stove",
    "bookcase",
    "chair",
    "office_chair",
    "plant",
    "picture",
    "stair",
    "landing",
)
# a room's type, which a furnisher reads; neutral like the rooms layer's names
ROOM_TYPES = (
    "living", "kitchen", "kitchen_living", "dining", "bedroom", "kids", "office", "bathroom", "wc",
    "sauna", "washroom", "utility", "hall", "corridor", "storage", "dressing", "garage", "stairs",
    "other",
)  # fmt: skip
CEILING_MIN = 1.8  # a storey's cut above its floor, at least
CEILING_GAP = 0.1  # how far a storey's cut stays under the floor of a higher storey over it
STAIR_RISE = 0.18  # a stair's rise per step, the engine rounding the count
LEVEL_NAME_CHARS = 24
FOOTPRINT_SLACK = 0.5  # how far a basement room may reach past the ground rooms' box: their walls
# a run of units: along is the axis its fronts run on, fronts [type, width] from that axis's low end
FRONTED_KINDS = ("base_units", "wall_units", "tall_units", "vanity")
FINISHES = (
    "kitchen",
    "anthracite",
    "white",
    "dark_oak",
    "medium_oak",
)  # a fitted item's carcass and fronts, a table's, desk's or chair's wood; kitchen or oak without one
WOOD_FINISHES = ("dark_oak", "medium_oak")  # the only ones that recolour oak
WOOD_KINDS = ("table", "desk", "chair")
FINISHED_KINDS = (*FRONTED_KINDS, "bookcase", *WOOD_KINDS)
FRONT_TYPES = ("door", "drawers", "oven", "glass", "blank")
FRONTS_SUM = 0.01  # how far the fronts' widths may miss the item's size on along
SOFA_EDGES = ("x0", "x1", "z0", "z1")  # a sofa's back and arm: the rect's edges that carry one
# the edges a kind may name for its back and arm: None for any number, else exactly that many
EDGE_KEYS = {"sofa": {"back": None, "arm": None}, "chair": {"back": 1}, "office_chair": {"back": 1}}
RECT_ONLY_KINDS = ("stove", "plant", "picture", "stair", "landing")
WALL_HUNG_KINDS = ("mirror", "picture")  # y0 above the floor
PICTURE_ARTS = 4  # a picture's art: the engine's three palettes, 0 by default, or 3, its grey-blue brush strokes
DOOR_GLASS_MARGIN = 0.2  # how far a door's glass strip stays inside its opening on each side
FUTURE_ROT = (0, 90, 180, 270)
PANEL = (1.72, 1.13)  # a PV panel's long and short side; the engine lays them out the same way
PANEL_GAP = 0.02
FUTURE_FACTS, FACT_CHARS = 6, 80
# the real style's surface names, every key of the engine's kit.js REAL (a test compares them)
SURFACES = (
    "cladding", "roof", "frame", "base", "trim", "chimney", "unit", "glass", "interior", "door", "floor", "tile", "deck",
    "paving", "lawn", "outside", "hedge", "crown", "trunk", "bark", "fence", "car", "neighbour", "neighbourRoof", "road",
    "timber", "sand", "slide", "nest", "pad", "mat", "net", "mesh", "stone", "cut", "skirting",
    "linen", "fabric", "oak", "worktop", "cabinet", "furniture", "kitchen", "kitchenTop",
    "handle", "steel", "blackGlass", "screen", "rug", "sheer", "sofa", "anthracite", "white",
    "sanitary", "mirror", "stones", "darkOak", "mediumOak", "shell", "pot", "leaf", "bloom",
    "canvas", "artA", "artB", "artC", "artD", "brushGround", "brushA", "brushB", "brushC",
    "brushD", "snow", "spruce", "baubleRed", "baubleGold", "baubleSilver",
)  # fmt: skip
CLADDING_PATTERNS = ("plain", "boards")
BOARD_ANGLES = (0, 45, 90)
ROOF_PATTERNS = ("plain", "seam", "tile")
TRIMS = ("openings", "corners", "base", "fascia")
BOARD_WIDTH = (0.08, 0.4)  # a look's cladding board, m
GROOVE_SHARE = (0.02, 0.25)  # a look's cladding groove, a share of the board
BASE_HEIGHT = (0.05, 1.0)  # a look's trims.base {"height": h}: the plinth's range above floor 0
CHIMNEY_KEYS = ("id", "rect", "top", "level")
POST_KEYS = ("at", "top", "size", "braces")
POST_SIZE = (0.05, 0.5)  # a site.posts size, m
BRACE_DROP = 0.6  # how far below a post's top its knee braces start (the engine's BRACE)
RIM = (0, 0.2)  # site.garage_roof rim, m
BANDS = (1, 4)  # site.garage_roof bands
BAND_GAP, BAND_MIN = 0.01, 0.02  # the engine's gap between two bands, and a band's least height
CHIMNEY_MIN = 0.5  # how far a chimney's top stands at least above its level's floor
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
BLOCK = re.compile(r"^```json house3d:(\w+)[ \t]*\n(.*?)^```[ \t]*$", re.MULTILINE | re.DOTALL)


def read_layers(path):
    """Return {layer: dict} for every house3d block in the Markdown file."""
    with open(path, encoding="utf-8") as f:
        return parse_layers(f.read())


def parse_layers(text):
    """read_layers for Markdown already in memory."""
    layers = {}
    for name, body in BLOCK.findall(text):
        if name in layers:
            raise ValueError(f"layer {name} appears twice")
        layers[name] = json.loads(body)
    return layers


def merge(layers, names):
    out = {}
    for name in names:
        for key, value in layers.get(name, {}).items():
            if key in out:
                raise ValueError(f"key {key} is in more than one layer")
            out[key] = value
    return out


def load(path, names=LAYERS):
    return merge(read_layers(path), names)


def with_room_names(model):
    """A merged model that includes the private layer, with the family room names in place
    of the neutral ones and room_names removed."""
    names = model.pop("room_names", {})
    # new room dicts: merge() shares them with the layers, and the rooms layer is shareable
    model["rooms"] = [dict(r, name=names.get(r["id"], r["name"])) for r in model["rooms"]]
    return model


def storeys(model):
    """(ground, [{"floor": f, "cut": c}, ...]): the ground storey's index and each storey's floor
    and cut, absolute; the engine's storeysOf() gives the same."""
    # a malformed list reads as one storey, so the validator reports it rather than dies on it
    levels = model.get("levels")
    if not (isinstance(levels, list) and levels and all(_num(v) for v in levels)):
        levels = [0]
    ground = levels.index(0) if 0 in levels else 0
    ceiling = model["ceiling"] if _num(model.get("ceiling")) else 0
    ceilings = model["ceilings"] if isinstance(model.get("ceilings"), list) else []
    out = []
    for i, floor in enumerate(levels):
        h = ceilings[i] if i < len(ceilings) and _num(ceilings[i]) else ceiling
        out.append({"floor": floor, "cut": ceiling if i == ground else floor + h})
    return ground, out


def _centre(item):
    if _rect(item.get("rect")):
        x0, z0, x1, z1 = item["rect"]
        return (x0 + x1) / 2, (z0 + z1) / 2
    c = item.get("circle")
    return (c[0], c[1]) if _point(c, 3) else None


def item_level(model, item, eps=0.01):
    """The storey a piece of furniture is on: its level, else the room under its centre whose floor
    is at or below its y0 (the highest such floor), else the highest storey whose floor is."""
    ground, st = storeys(model)
    if isinstance(item.get("level"), int) and not isinstance(item["level"], bool):
        return item["level"]
    y0 = item["y"][0] if _point(item.get("y")) else 0
    c = _centre(item)
    under = [
        lv
        for r in model.get("rooms", [])
        if isinstance(lv := r.get("level", ground), int)
        and not isinstance(lv, bool)
        and 0 <= lv < len(st)
        and st[lv]["floor"] <= y0 + eps
        and c
        and any(
            _rect(q) and q[0] <= c[0] <= q[2] and q[1] <= c[1] <= q[3] for q in r.get("rects", [])
        )
    ]
    if under:
        return max(under, key=lambda lv: st[lv]["floor"])
    below = [i for i, s in enumerate(st) if s["floor"] <= y0 + eps]
    return max(below, key=lambda i: st[i]["floor"]) if below else 0


def _overlap(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]) > 1e-6 and min(a[3], b[3]) - max(a[1], b[1]) > 1e-6


def _door_glass_ok(o):
    """A door's glass strip, glass wide at glass_c along the wall (c by default), 0.2 inside."""
    g, gc = o.get("glass"), o.get("glass_c", o["c"])
    if o.get("kind") != "door" or not (_num(g) and _num(gc)) or g <= 0:
        return False
    return abs(gc - o["c"]) + g / 2 <= o["w"] / 2 - DOOR_GLASS_MARGIN + 1e-9


def _door_swing_ok(o, w):
    """A door drawn open: hinged at its wall's a or b end, swinging to one side square to it,
    turned open up to 180 degrees (flat against the wall, the default)."""
    sw = o.get("swing")
    if o.get("kind") != "door" or "glass" in o or o.get("hinge") not in ("a", "b"):
        return False
    if "open" in o and not (_num(o["open"]) and 0 < o["open"] <= 180):
        return False
    if not _point(sw):
        return False
    ux, uz = w["b"][0] - w["a"][0], w["b"][1] - w["a"][1]
    # square within about a degree, so a swing read off a slanted wall still passes
    n = math.hypot(*sw) * math.hypot(ux, uz)
    return n > 0 and abs(sw[0] * ux + sw[1] * uz) <= 0.02 * n


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _within(v, lo_hi):
    return _num(v) and lo_hi[0] <= v <= lo_hi[1]


def _point(v, n=2):
    return isinstance(v, list) and len(v) == n and all(_num(x) for x in v)


def _lot(model):
    """The site's lot outline when it is valid (three or more [x, z] points), else None."""
    lot = (model.get("site") or {}).get("lot")
    return lot if isinstance(lot, list) and len(lot) >= 3 and all(_point(p) for p in lot) else None


def _rect(v):
    return _point(v, 4) and v[0] < v[2] and v[1] < v[3]


def _area(ring):
    return abs(sum(x0 * z1 - x1 * z0 for (x0, z0), (x1, z1) in zip(ring, ring[1:] + ring[:1]))) / 2


def _kind(roof):
    return roof.get("kind", "shed")


def _rect_problem(where, v):
    """The problem with a rect [x0, z0, x1, z1], or None."""
    if not _rect(v):
        return f"{where}: rect {v} is not [x0, z0, x1, z1] with x0 < x1 and z0 < z1"
    return None


def roof_rects(roof):
    """A roof's plan rects: a wing roof's own, a shed roof's outline box as one."""
    if _kind(roof) == "shed":
        return [roof_bbox(roof)]
    return [list(q) for q in roof["rects"]]


def roof_bbox(roof):
    """[x0, z0, x1, z1] round a roof's outline or wings."""
    if _kind(roof) == "shed":
        xs, zs = [p[0] for p in roof["outline"]], [p[1] for p in roof["outline"]]
        return [min(xs), min(zs), max(xs), max(zs)]
    q = roof["rects"]
    return [min(r[0] for r in q), min(r[1] for r in q), max(r[2] for r in q), max(r[3] for r in q)]


def _union_area(rects):
    xs = sorted({v for r in rects for v in (r[0], r[2])})
    zs = sorted({v for r in rects for v in (r[1], r[3])})
    total = 0.0
    for x0, x1 in pairwise(xs):
        for z0, z1 in pairwise(zs):
            if any(r[0] <= x0 and x1 <= r[2] and r[1] <= z0 and z1 <= r[3] for r in rects):
                total += (x1 - x0) * (z1 - z0)
    return total


def roof_area(roof):
    """A roof's plan area in m2: its outline's, or its wings' union."""
    if _kind(roof) == "shed":
        return _area(roof["outline"])
    return _union_area(roof["rects"])


def roof_slope(roof):
    return roof["slope"] if _num(roof.get("slope")) else math.tan(math.radians(roof["pitch_deg"]))


def _edge_distances(roof, q, x, z):
    """(x, z)'s distances to wing q's edges across its ridge (a gable's two, a hip's four, in
    the order x0, x1, z0, z1); the nearest names the face the point lies on."""
    x0, z0, x1, z1 = q
    ds = [x - x0, x1 - x, z - z0, z1 - z]
    if _kind(roof) == "gable":
        ds = ds[2:] if roof["ridge"] == "x" else ds[:2]
    return ds


def _wing_height(roof, q, x, z):
    if _kind(roof) == "flat":
        return roof["y"]
    return roof["eave_y"] + roof_slope(roof) * min(_edge_distances(roof, q, x, z))


def roof_height(roof, x, z):
    """The roof line's height at plan point (x, z), for every kind (see the module docstring)."""
    if _kind(roof) == "shed":
        sign = -1 if roof["falls"] == "west" else 1
        return roof["high_y"] - sign * (x - roof["high_x"]) * roof_slope(roof)
    rects = roof["rects"]
    inside = [q for q in rects if q[0] <= x <= q[2] and q[1] <= z <= q[3]]
    if inside:
        return max(_wing_height(roof, q, x, z) for q in inside)

    def clamp(q):
        return min(max(x, q[0]), q[2]), min(max(z, q[1]), q[3])

    q = min(rects, key=lambda q: math.dist((x, z), clamp(q)))
    return _wing_height(roof, q, *clamp(q))


def _roof_problems(rid, roof):
    """A roof's problems, empty when it is usable."""
    out = []
    _validate_roof(rid, roof, out.append)
    return out


def _validate_roof(rid, roof, bad):
    kind = _kind(roof)
    if kind not in ROOF_KINDS:
        bad(f"roof {rid}: kind {kind!r} is not one of {', '.join(ROOF_KINDS)}")
        return
    if not _num(roof.get("thick")):
        bad(f"roof {rid}: thick is not a number")
    if kind == "shed":
        if not all(_point(p) for p in roof.get("outline", [])) or len(roof.get("outline", [])) < 3:
            bad(f"roof {rid}: outline needs three or more [x, z] points")
        if not (_num(roof.get("pitch_deg")) or _num(roof.get("slope"))):
            bad(f"roof {rid}: needs pitch_deg or slope")
        for k in ("high_x", "high_y"):
            if not _num(roof.get(k)):
                bad(f"roof {rid}: {k} is not a number")
        if roof.get("falls") not in ("east", "west"):
            bad(f"roof {rid}: falls must be east or west (heights run along x)")
        return
    if "outline" in roof:
        bad(f"roof {rid}: a {kind} roof has rects, not an outline")
    rects = roof.get("rects")
    if not (isinstance(rects, list) and rects):
        bad(f"roof {rid}: rects must be a non-empty list of [x0, z0, x1, z1]")
        return
    good = True
    for i, q in enumerate(rects):
        if problem := _rect_problem(f"roof {rid}: rects[{i}]", q):
            bad(problem)
            good = False
    if kind == "flat":
        if not _num(roof.get("y")):
            bad(f"roof {rid}: a flat roof needs y")
    else:
        if not _num(roof.get("eave_y")):
            bad(f"roof {rid}: eave_y is not a number")
        if not (_num(roof.get("pitch_deg")) or _num(roof.get("slope"))):
            bad(f"roof {rid}: needs pitch_deg or slope")
    if kind == "gable" and roof.get("ridge") not in ("x", "z"):
        bad(f"roof {rid}: a gable roof's ridge must be x or z")
    if not good:
        return

    # wings that touch must overlap, and all of them must hang together through the overlaps
    def span(a, b):
        return min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])

    for (i, a), (j, b) in combinations(enumerate(rects), 2):
        w, d = span(a, b)
        if w >= 0 and d >= 0 and min(w, d) <= 1e-6:
            bad(f"roof {rid}: rects[{i}] and rects[{j}] only touch; wings must overlap")
    linked, todo = {0}, [0]
    while todo:
        a = rects[todo.pop()]
        for j, b in enumerate(rects):
            if j not in linked and min(span(a, b)) > 1e-6:
                linked.add(j)
                todo.append(j)
    if len(linked) < len(rects):
        bad(f"roof {rid}: its wings do not overlap into one roof")


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _segments_cross(p, q, a, b):
    """True when segment p-q meets segment a-b (touching counts)."""
    d1, d2, d3, d4 = _cross(a, b, p), _cross(a, b, q), _cross(p, q, a), _cross(p, q, b)
    if ((d1 > 0) != (d2 > 0) or d1 == 0 or d2 == 0) and (
        (d3 > 0) != (d4 > 0) or d3 == 0 or d4 == 0
    ):
        return (
            min(p[0], q[0]) <= max(a[0], b[0])
            and min(a[0], b[0]) <= max(p[0], q[0])
            and min(p[1], q[1]) <= max(a[1], b[1])
            and min(a[1], b[1]) <= max(p[1], q[1])
        )
    return False


def _inside(p, ring):
    """True when point p is inside the closed ring (even-odd rule)."""
    x, z = p
    inside = False
    for (x0, z0), (x1, z1) in zip(ring, ring[1:] + ring[:1]):
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0):
            inside = not inside
    return inside


def _quad_in_ring(corners, ring):
    """True when the quad lies wholly inside the ring, which may be non-convex: every corner
    inside and no quad edge meeting a ring edge (touching counts)."""
    if not all(_inside(c, ring) for c in corners):
        return False
    quad = list(zip(corners, corners[1:] + corners[:1]))
    edges = list(zip(ring, ring[1:] + ring[:1]))
    return not any(_segments_cross(p, q, a, b) for p, q in quad for a, b in edges)


PV_SAMPLE = 0.05  # m: the grid pv_face() reads a quad's surface on


def pv_face(roof, corners, eps=1e-6):
    """The face of a hip or gable roof a plan quad lies on, as the plan axis its slope runs
    along ("x" or "z"), or None when the quad is not on one face: its corners inside one wing
    and on its centre's side of the ridge (a hip's faces are convex, so the corners settle it;
    one on the ridge counts), with that wing the roof's surface all over it. Where wings meet
    the surface is not convex, so a higher wing crossing the quad's middle misses every corner:
    the surface is read on a PV_SAMPLE grid, its edges included."""
    cx = sum(c[0] for c in corners) / 4
    cz = sum(c[1] for c in corners) / 4
    x0, z0 = min(c[0] for c in corners), min(c[1] for c in corners)
    x1, z1 = max(c[0] for c in corners), max(c[1] for c in corners)
    nx, nz = math.ceil((x1 - x0) / PV_SAMPLE), math.ceil((z1 - z0) / PV_SAMPLE)
    grid = [
        (x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz)
        for i in range(nx + 1)
        for j in range(nz + 1)
    ]
    for q in roof["rects"]:
        if not all(q[0] <= x <= q[2] and q[1] <= z <= q[3] for x, z in corners):
            continue
        mid = _edge_distances(roof, q, cx, cz)
        face = mid.index(min(mid))
        if all(
            (ds := _edge_distances(roof, q, x, z))[face] <= min(ds) + eps for x, z in corners
        ) and all(
            abs(roof_height(roof, x, z) - _wing_height(roof, q, x, z)) <= eps for x, z in grid
        ):
            if _kind(roof) == "gable":
                return "z" if roof["ridge"] == "x" else "x"
            return "x" if face < 2 else "z"
    return None


def pv_size(item, roof, axis=None):
    """A pv item's [w, d] along its roof: its plan size, on a hip or gable face with the side
    that runs up the slope lengthened to its true length (a shed roof's low pitch is left as
    planned), so the panels lie edge to edge on the face as they do in the engine. axis is
    pv_face()'s answer when the caller has it."""
    w, d = item["size"]
    if not axis and _kind(roof) in ("hip", "gable"):
        axis = pv_face(roof, future_corners(item))
    if not axis:
        return [w, d]
    stretch = math.hypot(1, roof_slope(roof))
    along_x = item.get("rot", 0) in (0, 180)
    if (axis == "x") == along_x:
        return [w * stretch, d]
    return [w, d * stretch]


def panel_fit(w, d):
    """How many PV panels fit in a w x d m rectangle, the better of the long side along w
    (landscape) and along d (portrait), PANEL_GAP between them."""
    n = lambda size, side: math.floor((size + PANEL_GAP) / (side + PANEL_GAP) + 1e-9)
    return max(n(w, PANEL[0]) * n(d, PANEL[1]), n(w, PANEL[1]) * n(d, PANEL[0]))


def future_corners(item):
    """The plan corners of a sized future item: its size centred on pos, turned by rot."""
    w, d = item["size"] if item.get("rot", 0) in (0, 180) else item["size"][::-1]
    x, z = item["pos"]
    return [
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d / 2],
        [x - w / 2, z + d / 2],
    ]


def _crossing(ring):
    """The first pair of non-adjacent edges (indexes) of a closed ring that meet, or None."""
    edges = list(zip(ring, ring[1:] + ring[:1]))
    n = len(edges)
    for i in range(n):
        for j in range(i + 2, n):
            if (i, j) != (0, n - 1) and _segments_cross(*edges[i], *edges[j]):
                return i, j
    return None


def gate_sweep(gate):
    """(out, in): how far a gate's leaves reach to the street side and to the lot side of its line."""
    w = math.dist(gate["a"], gate["b"])
    if gate["kind"] == "sliding":
        return 0.0, SLIDE_OFFSET
    reach = w if gate["kind"] == "swing1" else w / 2
    return (reach, 0.0) if gate["opens"] == "out" else (0.0, reach)


def gate_inward(gate, lot):
    """The unit normal of a gate's line that points into the lot (towards the lot's bbox centre,
    as the engine does)."""
    (ax, az), (bx, bz) = gate["a"], gate["b"]
    w = math.dist(gate["a"], gate["b"])
    nx, nz = -(bz - az) / w, (bx - ax) / w
    cx = (min(p[0] for p in lot) + max(p[0] for p in lot)) / 2
    cz = (min(p[1] for p in lot) + max(p[1] for p in lot)) / 2
    return (nx, nz) if (cx - ax) * nx + (cz - az) * nz >= 0 else (-nx, -nz)


def drive_gates(model):
    """Indexes of the gates in site.gates that the car's path, as straight legs, crosses."""
    path = (model.get("car") or {}).get("path") or []
    gates = (model.get("site") or {}).get("gates") or []
    return [
        i
        for i, g in enumerate(gates)
        if isinstance(g, dict)
        and _point(g.get("a"))
        and _point(g.get("b"))
        and any(_segments_cross(p, q, g["a"], g["b"]) for p, q in pairwise(path))
    ]


def validate(layers):
    """Return a list of problems, empty when the model is usable."""
    problems = []
    bad = problems.append
    for name in LAYERS:
        if name not in layers:
            if name in REQUIRED:
                bad(f"layer {name} is missing")
        elif not isinstance(layers[name], dict):
            bad(f"layer {name} is not a JSON object")
    if problems:
        return problems
    try:
        model = merge(layers, LAYERS)
    except ValueError as e:
        return [str(e)]

    def rect(where, v):
        if problem := _rect_problem(where, v):
            bad(problem)

    def ids(where, values):
        seen = set()
        for v in values:
            if v in seen:
                bad(f"{where}: id {v!r} is not unique")
            seen.add(v)

    roofs = model.get("roofs", {})
    if not isinstance(roofs, dict) or not roofs:
        bad("geometry: roofs missing")
        roofs = {}
    for rid, roof in roofs.items():
        for problem in _roof_problems(rid, roof):
            bad(problem)
    for i, s in enumerate(model.get("roof_steps", [])):
        if not (_point(s.get("a")) and _point(s.get("b"))):
            bad(f"roof_steps[{i}]: a and b must be [x, z]")
        for k in ("top", "bot"):
            if s.get(k) not in roofs:
                bad(f"roof_steps[{i}]: {k} {s.get(k)!r} is not a roof")
    if not _num(model.get("ceiling")):
        bad("geometry: ceiling is not a number")
    levels = model.get("levels", [0])
    if not (
        isinstance(levels, list)
        and levels
        and all(_num(v) for v in levels)
        and 0 in levels
        and all(a < b for a, b in pairwise(levels))
    ):
        bad(f"geometry: levels {levels!r} must be ascending floor heights holding 0")
        levels = [0]
    ground = levels.index(0)
    if "ceilings" in model:
        cs = model["ceilings"]
        if not (isinstance(cs, list) and len(cs) == len(levels) and all(_num(c) for c in cs)):
            bad(f"geometry: ceilings must be one number per level ({len(levels)})")
        else:
            for i, c in enumerate(cs):
                if c <= CEILING_MIN:
                    bad(f"geometry: ceilings[{i}] {c} is not more than {CEILING_MIN}")
            if _num(model.get("ceiling")) and abs(cs[ground] - model["ceiling"]) > 1e-6:
                bad(f"geometry: ceilings[{ground}] is not ceiling {model['ceiling']}")
    if "look" in model:
        _validate_look(model["look"], bad)

    def level_of(where, item):
        lv = item.get("level", ground)
        if isinstance(lv, int) and not isinstance(lv, bool) and 0 <= lv < len(levels):
            return lv
        bad(f"{where}: level {lv!r} is not an index into levels (0..{len(levels) - 1})")
        return 0

    chimneys = model.get("chimneys", [])
    if not isinstance(chimneys, list):
        bad("geometry: chimneys is not a list")
        chimneys = []
    for i, c in enumerate(chimneys):
        where = f"chimneys[{i}]"
        if not isinstance(c, dict):
            bad(f"{where}: is not a JSON object")
            continue
        for k in sorted(set(c) - set(CHIMNEY_KEYS)):
            bad(f"{where}: unknown key {k!r}")
        if not (isinstance(c.get("id"), str) and c["id"]):
            bad(f"{where}: id is not a name")
        rect(where, c.get("rect"))
        lv = level_of(where, c)
        if not _num(c.get("top")) or c["top"] < levels[lv] + CHIMNEY_MIN:
            bad(
                f"{where}: top {c.get('top')!r} is not {CHIMNEY_MIN} or more above its floor {levels[lv]}"
            )
    ids("chimneys", [c.get("id") for c in chimneys if isinstance(c, dict)])

    for i, w in enumerate(model.get("walls", [])):
        where = f"walls[{i}]"
        if not (_point(w.get("a")) and _point(w.get("b"))):
            bad(f"{where}: a and b must be [x, z]")
            continue
        if not _num(w.get("t")) or w["t"] <= 0:
            bad(f"{where}: t is not a positive number")
        lv = level_of(where, w)
        top = w.get("top")
        if not (_num(top) or top in roofs):
            bad(f"{where}: top {top!r} is neither a height nor a roof id")
        elif _num(top) and top <= levels[lv]:
            bad(f"{where}: top {top} is not above its level's floor {levels[lv]}")
        elif (
            top in roofs
            and not _roof_problems(top, roofs[top])
            and min(roof_height(roofs[top], *p) for p in (w["a"], w["b"])) <= levels[lv]
        ):
            bad(f"{where}: roof {top} runs below its level's floor {levels[lv]}")
        if "cut" in w and not _num(w["cut"]):
            bad(f"{where}: cut is not a number")
        if "finish" in w and w["finish"] != "panel":
            bad(f"{where}: finish {w['finish']!r} is not panel")
        length = math.dist(w["a"], w["b"])
        for j, o in enumerate(w.get("openings", [])):
            if not all(_num(o.get(k)) for k in ("c", "w", "h")):
                bad(f"{where}.openings[{j}]: c, w and h must be numbers")
                continue
            if o.get("kind") not in ("window", "door", "glassdoor"):
                bad(
                    f"{where}.openings[{j}]: kind {o.get('kind')!r} is not window, door or glassdoor"
                )
            if o.get("kind") == "window" and not _num(o.get("sill")):
                bad(f"{where}.openings[{j}]: a window needs a sill")
            if ("glass" in o or "glass_c" in o) and not _door_glass_ok(o):
                bad(
                    f"{where}.openings[{j}]: glass is a door's strip, wider than 0 and at least 0.2 "
                    "inside the opening on each side, at glass_c if given"
                )
            if ("hinge" in o or "swing" in o or "open" in o) and not _door_swing_ok(o, w):
                bad(
                    f"{where}.openings[{j}]: an open door has hinge a or b, a swing [dx, dz] "
                    "square to its wall, open up to 180 and no glass"
                )
            if "finish" in o and o["finish"] not in OPENING_FINISHES:
                bad(
                    f"{where}.openings[{j}]: finish {o['finish']!r} is not one of {', '.join(OPENING_FINISHES)}"
                )
            if o["c"] - o["w"] / 2 < -1e-6 or o["c"] + o["w"] / 2 > length + 1e-6:
                bad(
                    f"{where}.openings[{j}]: span {o['c'] - o['w'] / 2:.3f}..{o['c'] + o['w'] / 2:.3f} "
                    f"is outside the wall (length {length:.3f})"
                )

    for i, f in enumerate(model.get("furniture", [])):
        where = f"furniture[{i}]"
        if "rect" in f:
            rect(where, f["rect"])
        elif not (_point(f.get("circle"), 3) and f["circle"][2] > 0):
            bad(f"{where}: needs rect [x0, z0, x1, z1] or circle [x, z, r]")
        if not (_point(f.get("y")) and f["y"][0] < f["y"][1]):
            bad(f"{where}: y must be [y0, y1] with y0 < y1")
        if "kind" in f and f["kind"] not in FURNITURE_KINDS:
            bad(f"{where}: kind {f['kind']!r} is not one of {', '.join(FURNITURE_KINDS)}")
        if "level" in f:
            level_of(where, f)
        floor = levels[ground]
        if _point(f.get("y")):
            if f["y"][0] < levels[0] - 1e-6:
                bad(f"{where}: y0 {f['y'][0]} is below the lowest floor {levels[0]}")
            lv = item_level(model, f)
            floor = levels[lv] if 0 <= lv < len(levels) else floor
        if f.get("kind") == "stair":
            if f.get("up") not in SOFA_EDGES:
                bad(f"{where}: a stair's up {f.get('up')!r} is not one of {', '.join(SOFA_EDGES)}")
        elif "up" in f:
            bad(f"{where}: up is only for stair")
        _validate_fronts(where, f, bad)
        _validate_edges(where, f, bad)
        _validate_fitted(where, f, bad, floor)

    site = model.get("site", {})
    lot = _lot(model)
    if not lot:
        bad("site: lot needs three or more [x, z] points")
    for key in ("hedges", "fences", "bar_fences"):
        for i, seg in enumerate(site.get(key, [])):
            if not (isinstance(seg, list) and len(seg) == 2 and all(_point(p) for p in seg)):
                bad(f"site.{key}[{i}]: must be [[x, z], [x, z]]")
    # an item is a rect [x0, z0, x1, z1] or an outline [[x, z], ...]; one problem per item
    for key in ("decks", "paving"):
        for i, v in enumerate(site.get(key, [])):
            where = f"site.{key}[{i}]"
            if not (isinstance(v, list) and v and isinstance(v[0], list)):
                rect(where, v)
            elif not (len(v) >= 3 and all(_point(p) for p in v)):
                bad(f"{where}: an outline needs three or more [x, z] points")
            elif _area(v) < 1:
                bad(f"{where}: outline area {_area(v):.2f} m2 is under 1 m2")
            elif any(p == q for p, q in zip(v, v[1:] + v[:1])):
                bad(
                    f"{where}: outline repeats a point (it closes by itself, do not repeat the first point)"
                )
            elif c := _crossing(v):
                bad(f"{where}: outline edges {c[0]} and {c[1]} cross")
    for key in ("porch",):
        if key in site:
            rect(f"site.{key}", site[key])
    for key in ("sandpit", "swing", "pergola", "trampoline"):
        if key in site and not isinstance(site[key], dict):
            bad(f"site.{key}: not a JSON object")
        elif key in site:
            rect(f"site.{key}", site[key].get("rect"))
    if isinstance(site.get("trampoline"), dict) and not (
        _num(site["trampoline"].get("height")) and site["trampoline"]["height"] > 0
    ):
        bad("site.trampoline: height is not a positive number")
    if (
        isinstance(site.get("swing"), dict)
        and "slide" in site["swing"]
        and not _point(site["swing"]["slide"])
    ):
        bad("site.swing: slide must be [x, z]")
    for i, p in enumerate(site.get("planters", [])):
        where = f"site.planters[{i}]"
        if not isinstance(p, dict):
            bad(f"{where}: not a JSON object")
            continue
        rect(where, p.get("rect"))
        if not (_point(p.get("y")) and p["y"][0] < p["y"][1]):
            bad(f"{where}: y must be [y0, y1] with y0 < y1")
        if "plant" in p and p["plant"] not in PLANTS:
            bad(f"{where}: plant {p['plant']!r} is not one of {', '.join(PLANTS)}")
        if "finish" in p and p["finish"] not in PLANTER_FINISHES:
            bad(f"{where}: finish {p['finish']!r} is not one of {', '.join(PLANTER_FINISHES)}")
    for i, st in enumerate(site.get("steps", [])):
        if not isinstance(st, dict):
            bad(f"site.steps[{i}]: not a JSON object")
            continue
        rect(f"site.steps[{i}]", st.get("rect"))
        if not (_num(st.get("height")) and st["height"] > 0):
            bad(f"site.steps[{i}]: height is not a positive number")
    lights = site.get("lights", [])
    if not isinstance(lights, list):
        bad("site.lights: not a list")
        lights = []
    for i, li in enumerate(lights):
        where = f"site.lights[{i}]"
        if not isinstance(li, dict):
            bad(f"{where}: not a JSON object")
            continue
        if not _point(li.get("pos"), 3):
            bad(f"{where}: pos must be [x, y, z]")
        elif lot and not _inside([li["pos"][0], li["pos"][2]], lot):
            bad(f"{where}: pos is outside the lot")
        if li.get("kind") not in LIGHT_KINDS:
            bad(f"{where}: kind {li.get('kind')!r} is not one of {', '.join(LIGHT_KINDS)}")
        elif li["kind"] == "wall" and not (_point(li.get("face")) and math.hypot(*li["face"]) > 0):
            bad(f"{where}: a wall light needs face [dx, dz], its outward direction")
    if "garage_roof" in site:
        gr = site["garage_roof"]
        if ("rect" in gr) == ("rects" in gr):
            bad("site.garage_roof: needs either rect or rects")
        elif "rect" in gr:
            rect("site.garage_roof", gr["rect"])
        elif not (isinstance(gr["rects"], list) and gr["rects"]):
            bad("site.garage_roof.rects: not a non-empty list")
        else:
            for i, r in enumerate(gr["rects"]):
                rect(f"site.garage_roof.rects[{i}]", r)
        if not (_point(gr.get("y")) and gr["y"][0] < gr["y"][1]):
            bad("site.garage_roof: y must be [y0, y1] with y0 < y1")
        if "rim" in gr and not _within(gr["rim"], RIM):
            bad(f"site.garage_roof: rim {gr['rim']!r} is not between {RIM[0]} and {RIM[1]} m")
        b = gr.get("bands", 1)
        if not (isinstance(b, int) and not isinstance(b, bool) and BANDS[0] <= b <= BANDS[1]):
            bad(f"site.garage_roof: bands {b!r} is not a whole number {BANDS[0]} to {BANDS[1]}")
        elif _point(gr.get("y")) and gr["y"][1] - gr["y"][0] < b * BAND_MIN + (b - 1) * BAND_GAP:
            bad(f"site.garage_roof: {b} bands do not fit in y {gr['y']}")
    posts = site.get("posts", [])
    if not isinstance(posts, list):
        bad("site.posts: not a list")
        posts = []
    for i, p in enumerate(posts):
        where = f"site.posts[{i}]"
        if not isinstance(p, dict):
            bad(f"{where}: not a JSON object")
            continue
        for k in sorted(set(p) - set(POST_KEYS)):
            bad(f"{where}: unknown key {k!r}")
        if not _point(p.get("at")):
            bad(f"{where}: at must be [x, z]")
        elif lot and not _inside(p["at"], lot):
            bad(f"{where}: at is outside the lot")
        if not (_num(p.get("top")) and p["top"] > BRACE_DROP):
            bad(f"{where}: top is not a height over {BRACE_DROP} m")
        if "size" in p and not _within(p["size"], POST_SIZE):
            bad(f"{where}: size {p['size']!r} is not between {POST_SIZE[0]} and {POST_SIZE[1]} m")
        braces = p.get("braces", [])
        if not (isinstance(braces, list) and all(_point(d) and math.hypot(*d) > 0 for d in braces)):
            bad(f"{where}: braces must be a list of [dx, dz] directions")
    for i, u in enumerate(site.get("outdoor_units", [])):
        rect(f"site.outdoor_units[{i}]", u.get("rect"))
        if not (_point(u.get("y")) and u["y"][0] < u["y"][1]):
            bad(f"site.outdoor_units[{i}]: y must be [y0, y1] with y0 < y1")
    good_gates = _validate_gates(site.get("gates", []), bad)
    trees = site.get("trees", [])
    if not isinstance(trees, list):
        bad("site.trees: not a list")
        trees = []
    ids(
        "site.trees",
        [t["id"] for t in trees if isinstance(t, dict) and isinstance(t.get("id"), str)],
    )
    for i, t in enumerate(trees):
        if not isinstance(t, dict):
            bad(f"site.trees[{i}]: not a JSON object")
            continue
        if isinstance(t.get("id"), str) and t["id"]:
            where = f"tree {t['id']}"
        else:
            where = f"site.trees[{i}]"
            bad(f"{where}: id is not a non-empty string")
        if not (isinstance(t.get("kind"), str) and t["kind"]):
            bad(f"{where}: kind missing")
        if not _point(t.get("pos")):
            bad(f"{where}: pos must be [x, z]")
        for k in ("height", "crown"):
            if not (_num(t.get(k)) and t[k] > 0):
                bad(f"{where}: {k} is not a positive number")
    if "festive" in site:
        _validate_festive(site["festive"], lot, bad)
    if "future" in model:
        _validate_future(model, roofs, bad)

    rooms = model.get("rooms", [])
    room_ids = [r.get("id") for r in rooms]
    ids("rooms", room_ids)
    if OUTDOOR in room_ids:
        bad(f"rooms: {OUTDOOR!r} is reserved for outdoor devices")
    for r in rooms:
        where = f"room {r.get('id')}"
        level_of(where, r)
        if not (isinstance(r.get("name"), str) and r["name"]):
            bad(f"{where}: name missing")
        if not r.get("rects"):
            bad(f"{where}: rects missing")
        for q in r.get("rects", []):
            rect(where, q)
        if "label" in r and not _point(r["label"]):
            bad(f"{where}: label must be [x, z]")
        if "floor" in r and r["floor"] not in ROOM_FLOORS:
            bad(f"{where}: floor {r['floor']!r} is not one of {', '.join(ROOM_FLOORS)}")
        if "type" in r and r["type"] not in ROOM_TYPES:
            bad(f"{where}: type {r['type']!r} is not one of {', '.join(ROOM_TYPES)}")
        if "furnish" in r and not isinstance(r["furnish"], bool):
            bad(f"{where}: furnish is true or false")
    _validate_storeys(model, levels, ground, rooms, bad)

    known = set(room_ids)
    for rid in model.get("room_names", {}):
        if rid not in known:
            bad(f"private.room_names: {rid!r} is not a room")
    devices = model.get("devices", [])
    ids("devices", [d.get("entity") for d in devices])
    for d in devices:
        where = f"device {d.get('entity')}"
        if not (isinstance(d.get("entity"), str) and "." in d["entity"]):
            bad(f"{where}: entity is not an entity id")
        if not (isinstance(d.get("name"), str) and d["name"]):
            bad(f"{where}: name missing")
        if d.get("room") != OUTDOOR and d.get("room") not in known:
            bad(f"{where}: room {d.get('room')!r} does not exist")
        if not _point(d.get("pos"), 3):
            bad(f"{where}: pos must be [x, y, z]")
        if "look" in d and not _point(d["look"]):
            bad(f"{where}: look must be [dx, dz]")

    car_ok = False
    if "car" in model:
        n = len(problems)
        _validate_car(model["car"], {r.get("id"): r for r in rooms}, bad)
        car_ok = len(problems) == n
    if car_ok and site.get("gates") and lot:
        _validate_drive(model, good_gates, bad)
    if "surroundings" in layers:
        _validate_surroundings(layers["surroundings"], bad)

    show = model.get("showcase", {})
    for rid in show.get("rooms", {}):
        if rid not in known:
            bad(f"showcase.rooms: {rid!r} is not a room")
    names = show.get("level_names", {})
    if not isinstance(names, dict):
        bad("showcase.level_names: not a JSON object")
        names = {}
    for k, v in names.items():
        if not (k.isdigit() and int(k) < len(levels)):
            bad(f"showcase.level_names: {k!r} is not a level index (0..{len(levels) - 1})")
        if not (isinstance(v, str) and 0 < len(v) <= LEVEL_NAME_CHARS):
            bad(f"showcase.level_names[{k}]: a name of 1 to {LEVEL_NAME_CHARS} characters")
    features = show.get("features", [])
    ids("showcase.features", [f.get("id") for f in features])
    for f in features:
        if not _point(f.get("pos"), 3):
            bad(f"showcase feature {f.get('id')}: pos must be [x, y, z]")
    return problems


def _validate_storeys(model, levels, ground, rooms, bad):
    """A storey's cut stays under the floor of a higher storey whose rooms overlap its own in plan,
    and a room below 0 lies inside the box round the ground storey's rooms, grown by their walls."""
    _, st = storeys(dict(model, levels=levels))
    by = {}
    for r in rooms:
        lv = r.get("level", ground)
        if isinstance(lv, int) and not isinstance(lv, bool) and 0 <= lv < len(levels):
            by.setdefault(lv, []).extend(q for q in r.get("rects", []) if _rect(q))
    for lo, hi in combinations(sorted(by), 2):
        gap = st[hi]["floor"] - st[lo]["cut"]
        if gap < CEILING_GAP - 1e-6 and any(_overlap(a, b) for a in by[lo] for b in by[hi]):
            bad(
                f"geometry: level {lo}'s cut {st[lo]['cut']:.2f} is not {CEILING_GAP} under "
                f"level {hi}'s floor {st[hi]['floor']} over it"
            )
    s = FOOTPRINT_SLACK
    above = [
        q
        for r in rooms
        if r.get("level", ground) == ground and r.get("floor") != "paving"
        for q in r.get("rects", [])
        if _rect(q)
    ]
    box = (
        [min(q[0] for q in above) - s, min(q[1] for q in above) - s]
        + [max(q[2] for q in above) + s, max(q[3] for q in above) + s]
        if above
        else None
    )
    for r in rooms:
        lv = r.get("level", ground)
        below = (
            isinstance(lv, int)
            and not isinstance(lv, bool)
            and 0 <= lv < len(levels)
            and levels[lv] < 0
        )
        inside = box and all(
            box[0] <= q[0] and box[1] <= q[1] and q[2] <= box[2] and q[3] <= box[3]
            for q in r.get("rects", [])
            if _rect(q)
        )
        if below and not inside:
            bad(
                f"room {r.get('id')}: a room below ground must lie inside the ground storey's rooms' box"
            )


def _validate_fronts(where, f, bad):
    """A run of units needs along and fronts that fill its size on that axis; no other item has
    either."""
    if f.get("kind") not in FRONTED_KINDS:
        for key in ("along", "fronts"):
            if key in f:
                bad(f"{where}: {key} is only for {', '.join(FRONTED_KINDS)}")
        return
    along = f.get("along")
    if along not in ("x", "z"):
        bad(f"{where}: along {along!r} is not x or z")
    if "rect" not in f:
        bad(f"{where}: a run of units needs a rect")
    fronts = f.get("fronts")
    if not (isinstance(fronts, list) and fronts):
        return bad(f"{where}: fronts must be a list of [type, width]")
    whole = True
    for j, front in enumerate(fronts):
        if not (isinstance(front, list) and len(front) == 2):
            bad(f"{where}.fronts[{j}]: must be [type, width]")
            whole = False
            continue
        if front[0] not in FRONT_TYPES:
            bad(f"{where}.fronts[{j}]: type {front[0]!r} is not one of {', '.join(FRONT_TYPES)}")
        if not (_num(front[1]) and front[1] > 0):
            bad(f"{where}.fronts[{j}]: width {front[1]!r} is not a positive number")
            whole = False
    if whole and along in ("x", "z") and _rect(f.get("rect")):
        axis = "xz".index(along)
        size = f["rect"][axis + 2] - f["rect"][axis]
        total = sum(front[1] for front in fronts)
        if abs(total - size) > FRONTS_SUM + 1e-9:
            bad(f"{where}: fronts sum to {total:.3f} m, the item is {size:.3f} m on {along}")


def _validate_fitted(where, f, bad, floor=0):
    """A vanity counts its basins, a finished kind may name its finish, some kinds need a rect or
    hang above the floor, a plant may bloom and a picture name its art."""
    kind = f.get("kind")
    if kind == "vanity":
        if not (type(f.get("basins")) is int and f["basins"] in (1, 2)):
            bad(f"{where}: basins {f.get('basins')!r} is not 1 or 2")
    elif "basins" in f:
        bad(f"{where}: basins is only for vanity")
    if kind in FINISHED_KINDS:
        allowed = WOOD_FINISHES if kind in WOOD_KINDS else FINISHES
        if "finish" in f and f["finish"] not in allowed:
            bad(f"{where}: finish {f['finish']!r} is not one of {', '.join(allowed)}")
    elif "finish" in f:
        bad(f"{where}: finish is only for {', '.join(FINISHED_KINDS)}")
    if kind in RECT_ONLY_KINDS and "rect" not in f:
        bad(f"{where}: a {kind} needs a rect")
    if kind in WALL_HUNG_KINDS and _point(f.get("y")) and f["y"][0] <= floor:
        bad(f"{where}: a {kind} hangs on the wall, its y0 above its floor {floor}")
    if "bloom" in f and (kind != "plant" or not isinstance(f["bloom"], bool)):
        bad(f"{where}: bloom is true or false on a plant")
    if "art" in f and (
        kind != "picture" or type(f["art"]) is not int or not 0 <= f["art"] < PICTURE_ARTS
    ):
        bad(f"{where}: art is 0 to {PICTURE_ARTS - 1} on a picture")


def _validate_edges(where, f, bad):
    """The kinds in EDGE_KEYS may name the rect's edges that carry a back or an arm, so two sofas
    join into a corner sofa; no other item has either."""
    for key in ("back", "arm"):
        if key not in f:
            continue
        kinds = [k for k, keys in EDGE_KEYS.items() if key in keys]
        if f.get("kind") not in kinds:
            bad(f"{where}: {key} is only for {', '.join(kinds)}")
        elif "rect" not in f:
            bad(f"{where}: {key} needs a rect")
        elif not (isinstance(f[key], list) and all(e in SOFA_EDGES for e in f[key])):
            bad(f"{where}: {key} must be a list of {', '.join(SOFA_EDGES)}")
        elif (n := EDGE_KEYS[f["kind"]][key]) is not None and len(f[key]) != n:
            bad(f"{where}: a {f['kind']}'s {key} is {n} edge")


def _validate_look(look, bad):
    """geometry.look: the surfaces' finishes, the cladding and roof patterns, and which trims are drawn."""
    if not isinstance(look, dict):
        bad("look: is not a JSON object")
        return
    for k in sorted(set(look) - {"surfaces", "cladding", "roof", "trims"}):
        bad(f"look: unknown key {k!r}")
    surfaces = look.get("surfaces", {})
    if not isinstance(surfaces, dict):
        bad("look.surfaces: is not a JSON object")
        surfaces = {}
    for name, v in surfaces.items():
        where = f"look.surfaces.{name}"
        if name not in SURFACES:
            bad(f"{where}: {name!r} is not an engine surface")
            continue
        if isinstance(v, str):
            v = {"color": v}
        if not isinstance(v, dict):
            bad(f"{where}: is not a colour or an object")
            continue
        for k in sorted(set(v) - {"color", "roughness", "metalness"}):
            bad(f"{where}: unknown key {k!r}")
        if not (isinstance(v.get("color"), str) and HEX.fullmatch(v["color"])):
            bad(f"{where}: color {v.get('color')!r} is not #rrggbb")
        for k in ("roughness", "metalness"):
            if k in v and not (_num(v[k]) and 0 <= v[k] <= 1):
                bad(f"{where}: {k} {v[k]!r} is not between 0 and 1")
    if "cladding" in look:
        c = look["cladding"]
        if not isinstance(c, dict):
            bad("look.cladding: is not a JSON object")
        elif c.get("pattern") not in CLADDING_PATTERNS:
            bad(
                f"look.cladding: pattern {c.get('pattern')!r} is not one of {', '.join(CLADDING_PATTERNS)}"
            )
        else:
            allowed = (
                {"pattern", "angle_deg", "board", "groove"}
                if c["pattern"] == "boards"
                else {"pattern"}
            )
            for k in sorted(set(c) - allowed):
                bad(f"look.cladding: unknown key {k!r} for {c['pattern']}")
            for k, (lo, hi) in (("board", BOARD_WIDTH), ("groove", GROOVE_SHARE)):
                if k in c and not _within(c[k], (lo, hi)):
                    bad(f"look.cladding: {k} {c[k]!r} is not between {lo} and {hi}")
            a = c.get("angle_deg", 45)
            if c["pattern"] == "boards" and not (_num(a) and a in BOARD_ANGLES):
                bad(f"look.cladding: angle_deg {a!r} is not one of 0, 45, 90")
    if "roof" in look:
        r = look["roof"]
        if not isinstance(r, dict):
            bad("look.roof: is not a JSON object")
        elif r.get("pattern") not in ROOF_PATTERNS:
            bad(f"look.roof: pattern {r.get('pattern')!r} is not one of {', '.join(ROOF_PATTERNS)}")
        else:
            for k in sorted(set(r) - {"pattern"}):
                bad(f"look.roof: unknown key {k!r}")
    if "trims" in look:
        t = look["trims"]
        if not isinstance(t, dict):
            bad("look.trims: is not a JSON object")
        else:
            for k, v in t.items():
                if k not in TRIMS:
                    bad(f"look.trims: unknown key {k!r}")
                elif k == "base" and isinstance(v, dict):
                    h = v.get("height")
                    if set(v) != {"height"} or not (
                        _num(h) and BASE_HEIGHT[0] <= h <= BASE_HEIGHT[1]
                    ):
                        bad(
                            f'look.trims.base: {v!r} is not {{"height": h}} with '
                            f"{BASE_HEIGHT[0]} <= h <= {BASE_HEIGHT[1]}"
                        )
                elif not isinstance(v, bool):
                    what = 'true, false or {"height": h}' if k == "base" else "true or false"
                    bad(f"look.trims.{k}: {v!r} is not {what}")


def _validate_festive(festive, lot, bad):
    """site.festive, the winter layer's lights, every key optional: icicles [{ path: [[x, y, z],
    ...], drop?, ground? }] with each path of two or more points on the lot above the ground,
    planters (true winds a string round every tall planter plant) and christmas_trees [{ pos:
    [x, z], height, base }] on the lot, base no wider than the tree is tall."""
    if not isinstance(festive, dict):
        bad("site.festive: not a JSON object")
        return
    icicles = festive.get("icicles", [])
    if not isinstance(icicles, list):
        bad("site.festive.icicles: not a list")
        icicles = []
    for i, ic in enumerate(icicles):
        where = f"site.festive.icicles[{i}]"
        if not isinstance(ic, dict):
            bad(f"{where}: not a JSON object")
            continue
        path = ic.get("path")
        if not (isinstance(path, list) and len(path) >= 2 and all(_point(p, 3) for p in path)):
            bad(f"{where}: path must be two or more [x, y, z] points")
        else:
            for p in path:
                if p[1] <= 0:
                    bad(f"{where}: a point's y is not above 0")
                    break
                if lot and not _inside([p[0], p[2]], lot):
                    bad(f"{where}: a point is outside the lot")
                    break
        if "drop" in ic and not (_num(ic["drop"]) and 0 < ic["drop"] <= 1):
            bad(f"{where}: drop must be above 0 and at most 1")
        if "ground" in ic and not isinstance(ic["ground"], bool):
            bad(f"{where}: ground must be true or false")
    if "planters" in festive and not isinstance(festive["planters"], bool):
        bad("site.festive.planters: must be true or false")
    trees = festive.get("christmas_trees", [])
    if not isinstance(trees, list):
        bad("site.festive.christmas_trees: not a list")
        trees = []
    for i, t in enumerate(trees):
        where = f"site.festive.christmas_trees[{i}]"
        if not isinstance(t, dict):
            bad(f"{where}: not a JSON object")
            continue
        if not _point(t.get("pos"), 2):
            bad(f"{where}: pos must be [x, z]")
        elif lot and not _inside(t["pos"], lot):
            bad(f"{where}: pos is outside the lot")
        height, base = t.get("height"), t.get("base")
        if not (_num(height) and 0.5 <= height <= 4):
            bad(f"{where}: height must be from 0.5 to 4")
        elif not (_num(base) and 0 < base <= height):
            bad(f"{where}: base must be above 0 and at most the height")


def _validate_future(model, roofs, bad):
    """The private future layer: items the house does not have yet, each placed on the plan
    inside the lot (the walls' box without one, as the engine falls back), a pv item's
    rectangle on its roof and its panels fitting there."""
    fut = model["future"]
    if not isinstance(fut, dict):
        return bad("future: not a JSON object")
    as_of = fut.get("as_of")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", as_of):
            raise ValueError
        date.fromisoformat(as_of)
    except (TypeError, ValueError):
        bad(f"future: as_of {as_of!r} is not a date YYYY-MM-DD")
    items = fut.get("items")
    if not isinstance(items, list):
        return bad("future: items is not a list")
    lot = _lot(model)
    if not lot:
        ends = [p for w in model.get("walls", []) for p in (w.get("a"), w.get("b")) if _point(p)]
        if not ends:
            lot = None
        else:
            x0, x1 = min(p[0] for p in ends), max(p[0] for p in ends)
            z0, z1 = min(p[1] for p in ends), max(p[1] for p in ends)
            lot = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    ids = set()
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            bad(f"future.items[{i}]: not a JSON object")
            continue
        where = f"future.items[{i}]"
        if isinstance(it.get("id"), str) and it["id"]:
            where = f"future item {it['id']}"
            if it["id"] in ids:
                bad(f"future.items: id {it['id']!r} is not unique")
            ids.add(it["id"])
        else:
            bad(f"{where}: id is not a non-empty string")
        kind = it.get("kind")
        if kind not in FUTURE_KINDS:
            bad(f"{where}: kind {kind!r} is not one of {', '.join(FUTURE_KINDS)}")
        if not (isinstance(it.get("name"), str) and it["name"]):
            bad(f"{where}: name missing")
        placed = _point(it.get("pos"))
        if not placed:
            bad(f"{where}: pos must be [x, z]")
        elif lot and not _inside(it["pos"], lot):
            bad(f"{where}: pos is outside the lot")
        if it.get("rot", 0) not in FUTURE_ROT:
            bad(f"{where}: rot {it.get('rot')!r} is not one of 0, 90, 180, 270")
        sized = "size" in it and _point(it["size"]) and min(it["size"]) > 0
        if ("size" in it or kind == "pv") and not sized:
            bad(f"{where}: size must be [w, d], both positive")
        facts = it.get("facts", [])
        if not (isinstance(facts, list) and len(facts) <= FUTURE_FACTS):
            bad(f"{where}: facts must be a list of at most {FUTURE_FACTS} lines")
        elif not all(isinstance(f, str) and 0 < len(f) <= FACT_CHARS for f in facts):
            bad(f"{where}: every fact must be a line of 1 to {FACT_CHARS} characters")
        if kind != "pv":
            continue
        if not (_num(it.get("kwp")) and it["kwp"] > 0):
            bad(f"{where}: kwp is not a positive number")
        panels = it.get("panels")
        if not (isinstance(panels, int) and not isinstance(panels, bool) and panels > 0):
            bad(f"{where}: panels is not a positive whole number")
            panels = None
        roof = roofs.get(it.get("roof")) if isinstance(it.get("roof"), str) else None
        if not roof:
            bad(f"{where}: roof {it.get('roof')!r} is not a roof")
        elif _kind(roof) == "flat":
            bad(f"{where}: roof {it['roof']} is flat; PV lies on a shed, hip or gable roof")
            continue
        if not (placed and sized and it.get("rot", 0) in FUTURE_ROT):
            continue
        fit = it["size"]
        if roof and _kind(roof) != "shed":
            if _roof_problems(it["roof"], roof):
                continue
            axis = pv_face(roof, future_corners(it))
            if not axis:
                bad(f"{where}: its rectangle is not on one face of roof {it['roof']}")
                continue
            fit = pv_size(it, roof, axis)
        elif roof:
            outline = roof.get("outline")
            if (
                isinstance(outline, list)
                and len(outline) >= 3
                and all(_point(p) for p in outline)
                and not _quad_in_ring(future_corners(it), outline)
            ):
                bad(f"{where}: its rectangle is not inside roof {it['roof']}'s outline")
        if panels and panel_fit(*fit) < panels:
            bad(
                f"{where}: {panels} panels do not fit in {fit[0]:g} x {fit[1]:g} m "
                f"(at most {panel_fit(*fit)})"
            )


def _validate_gates(gates, bad):
    """Check site.gates; return the indexes of the gates that are whole."""
    if not isinstance(gates, list):
        bad("site.gates: not a list")
        return set()
    good, placed = set(), []
    for i, g in enumerate(gates):
        where = f"site.gates[{i}]"
        if not isinstance(g, dict):
            bad(f"{where}: not a JSON object")
            continue
        if isinstance(g.get("name"), str) and g["name"]:
            where = f"gate {g['name']}"
        elif "name" in g:
            bad(f"{where}: name is not a non-empty string")
        n = 0
        if _point(g.get("a")) and _point(g.get("b")) and math.dist(g["a"], g["b"]) > 0:
            placed.append(i)
        else:
            bad(f"{where}: a and b must be two distinct [x, z] points")
            n += 1
        if not (_num(g.get("height")) and g["height"] > 0):
            bad(f"{where}: height is not a positive number")
            n += 1
        kind = g.get("kind")
        if kind not in GATE_KINDS:
            bad(f"{where}: kind {kind!r} is not {', '.join(GATE_KINDS[:-1])} or {GATE_KINDS[-1]}")
            n += 1
        elif kind == "sliding" and g.get("slide") not in ("a", "b"):
            bad(f"{where}: a sliding gate needs slide a or b, the end its leaf slides past")
            n += 1
        elif kind != "sliding" and g.get("opens") not in ("in", "out"):
            bad(f"{where}: a swing gate needs opens in or out")
            n += 1
        if not n:
            good.add(i)
    # two gates on one line may share a post, not a stretch of the line
    for i in placed:
        g = gates[i]
        w = math.dist(g["a"], g["b"])
        ux, uz = (g["b"][0] - g["a"][0]) / w, (g["b"][1] - g["a"][1]) / w
        for j in (j for j in placed if j > i):
            h = gates[j]
            if any(abs(_cross(g["a"], g["b"], p)) / w > 0.01 for p in (h["a"], h["b"])):
                continue
            lo, hi = sorted(
                (p[0] - g["a"][0]) * ux + (p[1] - g["a"][1]) * uz for p in (h["a"], h["b"])
            )
            if min(w, hi) - max(0, lo) > 1e-6:
                bad(f"site.gates[{i}] and site.gates[{j}] overlap along their line")
    return good


def _validate_drive(model, good, bad):
    """The car must stand wholly outside the drive gate, clear of its leaves, before it opens."""
    gates = model["site"]["gates"]
    crossed = drive_gates(model)
    if len(crossed) > 1:
        return bad(
            f"car: path crosses {len(crossed)} gates (site.gates {crossed}); at most one may be the drive gate"
        )
    if not crossed or crossed[0] not in good:
        return
    g = gates[crossed[0]]
    nx, nz = gate_inward(g, model["site"]["lot"])
    start = model["car"]["path"][0]
    before = -((start[0] - g["a"][0]) * nx + (start[1] - g["a"][1]) * nz)
    out = gate_sweep(g)[0]
    need = model["car"]["profile"]["length"] / 2 + out + CAR_CLEARANCE
    if before < need - 1e-6:
        bad(
            f"car: path starts {before:.2f} m before the drive gate's line, needs {need:.2f} m "
            f"(half the car, the leaves' outward sweep {out:.2f} m and {CAR_CLEARANCE} m)"
        )


def _ring(where, ring, bad):
    if not (isinstance(ring, list) and len(ring) >= 3 and all(_point(p) for p in ring)):
        return bad(f"{where}: needs three or more [x, z] points")
    if _area(ring) < 1:
        bad(f"{where}: area {_area(ring):.2f} m2 is under 1 m2")


def _validate_surroundings(layer, bad):
    if set(layer) != {"surroundings"}:
        return bad(
            f"layer surroundings: holds {sorted(layer)}, only the key surroundings belongs there"
        )
    s = layer["surroundings"]
    if not isinstance(s, dict):
        return bad("surroundings: not a JSON object")
    if not (isinstance(s.get("source"), str) and s["source"].strip()):
        bad("surroundings: source is not a non-empty string")
    for key in ("buildings", "roads"):
        if not isinstance(s.get(key), list):
            bad(f"surroundings: {key} is not a list")
    for i, b in enumerate(s.get("buildings") if isinstance(s.get("buildings"), list) else []):
        where = f"surroundings.buildings[{i}]"
        if not isinstance(b, dict):
            bad(f"{where}: not a JSON object")
            continue
        _ring(f"{where}.outline", b.get("outline"), bad)
        if not (_num(b.get("height")) and 0 < b["height"] <= 100):
            bad(f"{where}: height {b.get('height')!r} is not in (0, 100]")
        if "assumed" in b and not isinstance(b["assumed"], bool):
            bad(f"{where}: assumed is not true or false")
    for i, r in enumerate(s.get("roads") if isinstance(s.get("roads"), list) else []):
        where = f"surroundings.roads[{i}]"
        if not isinstance(r, dict):
            bad(f"{where}: not a JSON object")
            continue
        _ring(f"{where}.outline", r.get("outline"), bad)
        holes = r.get("holes", [])
        if not isinstance(holes, list):
            bad(f"{where}: holes is not a list")
            continue
        for j, h in enumerate(holes):
            _ring(f"{where}.holes[{j}]", h, bad)


def _validate_car(car, rooms, bad):
    if not isinstance(car, dict):
        return bad("car: not a JSON object")
    if "entity" in car and not (isinstance(car["entity"], str) and "." in car["entity"]):
        bad("car: entity is not an entity id")
    if not (isinstance(car.get("name"), str) and car["name"]):
        bad("car: name missing")
    room = rooms.get(car.get("room")) if isinstance(car.get("room"), str) else None
    if not room:
        bad(f"car: room {car.get('room')!r} does not exist")

    prof = car.get("profile")
    if not isinstance(prof, dict):
        return bad("car: profile is not a JSON object")
    dims_ok = True
    for k in ("length", "width", "height"):
        if not (_num(prof.get(k)) and prof[k] > 0):
            bad(f"car.profile: {k} is not a positive number")
            dims_ok = False
    for k in ("side", "glass"):
        pts = prof.get(k)
        if not (isinstance(pts, list) and len(pts) >= 3 and all(_point(p) for p in pts)):
            bad(f"car.profile: {k} needs three or more [x, y] points")
    wheels = prof.get("wheels")
    if not (
        isinstance(wheels, dict)
        and _num(wheels.get("r"))
        and wheels["r"] > 0
        and _point(wheels.get("x"))
        and _num(wheels.get("track"))
        and wheels["track"] > 0
    ):
        bad("car.profile: wheels needs r > 0, x [rear, front] and a positive track")
    lights = prof.get("lights")
    if not isinstance(lights, dict):
        bad("car.profile: lights is not a JSON object")
    else:
        for k in ("front", "rear"):
            segs = lights.get(k, [])
            if not (
                isinstance(segs, list)
                and all(
                    isinstance(s, list) and len(s) == 2 and all(_point(p, 3) for p in s)
                    for s in segs
                )
            ):
                bad(f"car.profile.lights: {k} must be a list of [[x, y, z], [x, y, z]] segments")

    path = car.get("path")
    if not (isinstance(path, list) and len(path) >= 3 and all(_point(p) for p in path)):
        return bad("car: path needs three or more [x, z] points")
    a, b, c = path[-3:]
    if math.dist(a, c) == 0 or math.dist(b, c) == 0:
        return bad("car: path's last three points do not set a direction")
    # distance of the middle point from the line through the outer two
    off = abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / math.dist(a, c)
    if off > 0.01:
        bad(f"car: path's last three points are {off:.3f} m off a straight line (1 cm allowed)")
    if not (room and dims_ok):
        return
    # the parked footprint, turned along the last segment, must fit one of the room's rects
    b, c = path[-2:]
    ux, uz = (c[0] - b[0]) / math.dist(b, c), (c[1] - b[1]) / math.dist(b, c)
    hl, hw = prof["length"] / 2, prof["width"] / 2
    corners = [
        (c[0] + ux * s * hl - uz * t * hw, c[1] + uz * s * hl + ux * t * hw)
        for s in (-1, 1)
        for t in (-1, 1)
    ]
    inside = lambda q: all(
        q[0] - 1e-6 <= x <= q[2] + 1e-6 and q[1] - 1e-6 <= z <= q[3] + 1e-6 for x, z in corners
    )
    if not any(_rect(q) and inside(q) for q in room.get("rects", [])):
        span = ", ".join(f"[{x:.2f}, {z:.2f}]" for x, z in corners)
        bad(f"car: path ends with the car outside room {car['room']} (corners {span})")


def private_strings(model):
    """Every string a public output must not contain: entity ids, device names,
    family room names and the car's entity and name. Pass a model that includes the
    private layer."""
    out = set()
    for d in model.get("devices", []):
        out.update(s for s in (d.get("entity"), d.get("name")) if s)
    out.update(model.get("room_names", {}).values())
    car = model.get("car") or {}
    out.update(s for s in (car.get("entity"), car.get("name")) if isinstance(s, str) and s)
    return sorted(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true", help="validate and print one line per problem")
    g.add_argument("--layers", help="comma-separated layers to merge and print as JSON, or 'all'")
    ap.add_argument("file")
    a = ap.parse_args(argv)
    try:
        layers = read_layers(a.file)
    except (OSError, ValueError) as e:
        print(f"{a.file}: {e}")
        return 1
    if a.check:
        problems = validate(layers)
        for p in problems:
            print(p)
        if not problems:
            print(f"{a.file}: ok ({', '.join(sorted(layers))})")
        return 1 if problems else 0
    # all: the required layers, and the optional ones the file has
    names = (
        tuple(n for n in LAYERS if n in REQUIRED or n in layers)
        if a.layers == "all"
        else tuple(a.layers.split(","))
    )
    unknown = [n for n in names if n not in LAYERS]
    if unknown:
        print(f"unknown layer(s): {', '.join(unknown)}")
        return 2
    missing = [n for n in names if n not in layers]
    if missing:
        print(f"{a.file}: layer(s) not in the file: {', '.join(missing)}")
        return 1
    json.dump(merge(layers, names), sys.stdout, ensure_ascii=False, indent=1)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
