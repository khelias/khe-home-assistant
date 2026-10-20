#!/usr/bin/env python3
"""Build the standalone house 3D viewer, and scan files for private house data.

Usage:  house3d-build.py MODEL OUTDIR                   build, then scan OUTDIR
        house3d-build.py --demo OUTDIR                  build the HA dashboard demo of the test house
        house3d-build.py --scan [--count] [ALLOW]... MODEL PATH...
                                                        scan files or trees, exit 1 on any hit

The build writes OUTDIR/index.html (viewer.html), house3d.js, scene/, vendor/ and model.json
from the geometry, rooms and showcase layers of MODEL (khe-meta house/house-model.md). The
private and surroundings layers and the georeference never go in; model.json gets only the
plan's grid bearing in whole degrees as orientation.x_axis_bearing_deg, for the real style's
sun. Publishing the folder is a separate decision.

The demo build reads only the made-up test house (tests/house3d/fixture-model.md), never a
model argument or HOUSE3D_MODEL, and writes every .html, .js, .css and .svg of demo/, the HA
card, the engine, the dashboard cards (cards/khe-cards.js), model.json with every layer the card
gets in HA, and the dashboard: the real generator's views on made-up data
(scripts/dashboard_demo.py) as dashboard.json, their starting states as states.json and their
chart data as series.json, and the same in English with the test house's model as
dashboard.en.json, states.en.json, series.en.json and model.en.json. In the demo's files __HOUSE3D_VERSION__ becomes the card's version,
__KHE_CARDS_VERSION__ the dashboard cards' version and __DEMO_VERSION__ a hash of the demo's
files, the generated JSON files and those two versions. khe-sites publishes it at khe.ee/house3d/. The fixture is
public; the dashboard comes from the generator, which names the real house's devices, so
check.sh scans the demo build with the real model whenever one is at hand.

The scan reads the private layer of MODEL and fails on every occurrence of an entity id,
a device name, a family room name or the car's entity and name
(house3d_model.private_strings), of a `devices` key, and of a device's coordinates written
out as text: its [x, y, z] position, its ground [x, z] pair and a camera's look direction
(integer-only directions such as [0, 1] carry no location and are skipped). The car's
path points and side outline points count too, as [x, z] and [x, y] pairs, but only
pairs with a coordinate of two or more decimals: round pairs such as 0.5, 0.5 occur in
the vendored three.js. So do the surroundings layer's building and road vertices, by the
same two-decimal rule, the future items' [x, z] positions with at least one decimal, and
the georeference's origin_E and origin_N, as written in the model and in whole metres; their
labels name the layer and an index, never the values. Run it over
house3d/ before every commit that touches it. With --count it prints only the number of hits
per kind (private strings, devices keys, coordinates), never the matched text, so its output
can go into a log. Each ALLOW lets one file carry one thing the scan would flag:
--allow-devices-key FILE a `devices` key, --allow-device-name ENTITY FILE the name of the test
house's device ENTITY, which keeps a private name that was judged generic out of the command.
"""

import hashlib
import json
import math
import re
import shutil
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dashboard_demo
import house3d_model

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "house3d"
DEMO = ROOT / "demo"
CARDS = ROOT / "cards" / "khe-cards.js"
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
DEMO_SUFFIXES = (".html", ".js", ".css", ".svg")
DEVICES_KEY = re.compile(r"""["']?\bdevices["']?\s*:""")
DEVICES_KEY_LABEL = "a devices key"


def _num(v):
    """Regex for a number as JS or JSON might write it: 5 matches 5 and 5.0, 1.3 matches 1.30."""
    # the shortest exact decimal, without exponent or rounding; -0.0 is written 0
    whole, _, frac = format(Decimal(repr(abs(float(v)) if v == 0 else float(v))), "f").partition(
        "."
    )
    frac = frac.rstrip("0")
    body = re.escape(whole) + (r"\." + frac + "0*" if frac else r"(?:\.0+)?")
    return r"(?<![\d.])" + body + r"(?![\d])"


def _seq(values):
    return re.compile(r"\s*,\s*".join(_num(v) for v in values))


def patterns(model):
    """(label, regex) pairs for everything a public file must not contain."""
    out = [
        (f"private string {s!r}", re.compile(r"(?<!\w)" + re.escape(s) + r"(?!\w)"))
        for s in house3d_model.private_strings(model)
    ]
    out.append((DEVICES_KEY_LABEL, DEVICES_KEY))
    for d in model.get("devices", []):
        x, y, z = d["pos"]
        out.append((f"position of {d['entity']}", _seq([x, y, z])))
        out.append((f"ground position of {d['entity']}", _seq([x, z])))
        look = d.get("look")
        if look and not all(float(v).is_integer() for v in look):
            out.append((f"view direction of {d['entity']}", _seq(look)))
    car = model.get("car") or {}
    pairs = [(f"car path point {i}", p) for i, p in enumerate(car.get("path", []))]
    pairs += [
        (f"car outline point {i}", p)
        for i, p in enumerate((car.get("profile") or {}).get("side", []))
    ]
    sur = model.get("surroundings") or {}
    for i, b in enumerate(sur.get("buildings", [])):
        pairs += [(f"surroundings building {i}", p) for p in b.get("outline", [])]
    for i, r in enumerate(sur.get("roads", [])):
        pairs += [
            (f"surroundings road {i}", p)
            for ring in [r.get("outline", [])] + r.get("holes", [])
            for p in ring
        ]
    for label, p in pairs:
        if any(_decimals(v) >= 2 for v in p):
            out.append((label, _seq(p)))
    # the future items' places, written with decimals so a whole-metre pair cannot hit three.js
    for i, it in enumerate((model.get("future") or {}).get("items", [])):
        p = it.get("pos") if isinstance(it, dict) else None
        if house3d_model._point(p) and any(_decimals(v) >= 1 for v in p):
            out.append((f"future item {i} position", _seq(p)))
    geo = model.get("georef") or {}
    for k in ("origin_E", "origin_N"):
        v = geo.get(k)
        if isinstance(v, (int, float)):
            out.append((f"georef {k}", re.compile(_num(v))))
            for whole in sorted({round(v), math.floor(v)}):
                out.append((f"georef {k} in whole metres", re.compile(_num(whole))))
    return out


def _decimals(v):
    return len(format(Decimal(repr(float(v))), "f").partition(".")[2].rstrip("0"))


def scan(model, paths, allow=()):
    """allow: (file, label) pairs, a hit with that label in that file is not one."""
    pats = patterns(model)
    allowed = {(Path(p).resolve(), label) for p, label in allow}
    hits = []
    files = []
    for p in map(Path, paths):
        if not p.exists():
            # a mistyped path must not pass as a clean scan
            raise SystemExit(f"scan: {p} does not exist")
        files.extend(sorted(f for f in p.rglob("*") if f.is_file()) if p.is_dir() else [p])
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        here = f.resolve() if allowed else None
        for label, rx in pats:
            if (here, label) in allowed:
                continue
            for m in rx.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{f}:{line}: {label}")
    return hits, len(files)


def fixture_device_name(fixture, entity):
    names = [d["name"] for d in fixture["private"]["devices"] if d["entity"] == entity]
    if not names:
        raise SystemExit(f"scan: the test house has no device {entity}")
    return names[0]


def full_model(path):
    layers = house3d_model.read_layers(path)
    problems = house3d_model.validate(layers)
    if problems:
        sys.exit("model problems:\n" + "\n".join(problems))
    return layers


def _kind(hit):
    label = hit.rsplit(": ", 1)[1]
    if label.startswith("private string"):
        return "private strings"
    return "devices keys" if label == DEVICES_KEY_LABEL else "coordinates"


def run_scan(model, paths, count=False, allow=()):
    hits, n = scan(model, paths, allow)
    if count:
        kinds = {k: 0 for k in ("private strings", "devices keys", "coordinates")}
        for h in hits:
            kinds[_kind(h)] += 1
        detail = ", ".join(f"{k} {v}" for k, v in kinds.items())
        print(f"scan: {len(hits)} hit(s) in {n} file(s): {detail}")
    else:
        for h in hits:
            print(h)
        print(f"scan: {len(hits)} hit(s) in {n} file(s)")
    return 1 if hits else 0


def build(model_path, outdir):
    layers = full_model(model_path)
    public = house3d_model.merge(layers, house3d_model.PUBLIC)
    # a public page should not pin the house; whole degrees of bearing turn the sun, not a map
    geo = public.pop("georef", None) or {}
    if isinstance(geo.get("x_axis_bearing_deg"), (int, float)):
        public["orientation"] = {"x_axis_bearing_deg": round(geo["x_axis_bearing_deg"])}
    assert "surroundings" not in public, (
        "the surroundings layer fixes the location; it never goes public"
    )
    out = copy_engine(outdir)
    shutil.copyfile(SRC / "viewer.html", out / "index.html")
    write_model(out, public)
    print(f"built {out}")
    return run_scan(house3d_model.merge(layers, house3d_model.LAYERS), [out])


def copy_engine(outdir):
    """Copy the engine, its scene modules and vendored three.js into outdir; return its Path."""
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC / "house3d.js", out / "house3d.js")
    shutil.copytree(SRC / "scene", out / "scene", dirs_exist_ok=True)
    shutil.copytree(SRC / "vendor", out / "vendor", dirs_exist_ok=True)
    return out


def write_model(out, model):
    (out / "model.json").write_text(
        json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )


def version_of(path, name):
    """The integer a JS module declares as `[export] const <name> = N;`."""
    m = re.search(rf"^(?:export )?const {name} = (\d+);", path.read_text(), re.MULTILINE)
    if not m:
        sys.exit(f"{path.name}: no {name}")
    return m.group(1)


def card_version():
    return version_of(SRC / "house3d-card.js", "HOUSE3D_VERSION")


def cards_version():
    return version_of(CARDS, "KHE_CARDS_VERSION")


def demo_files(demo=DEMO):
    """The demo's own files, flat and sorted; nothing else (a .DS_Store) goes out."""
    return sorted(f for f in Path(demo).iterdir() if f.is_file() and f.suffix in DEMO_SUFFIXES)


def demo_model():
    layers = full_model(FIXTURE)
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


def demo_data(model):
    """The demo dashboard's generated files, name -> text: the config, states and series, and
    the same in English with the test house's model (ADR-003)."""
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    return {
        "dashboard.json": dump(dashboard_demo.demo_config(model)),
        "states.json": dump(dashboard_demo.demo_states(model)),
        "series.json": dump(dashboard_demo.demo_series()),
        "dashboard.en.json": dump(dashboard_demo.demo_config_en(model)),
        "states.en.json": dump(dashboard_demo.demo_states_en(model)),
        "series.en.json": dump(dashboard_demo.demo_series_en()),
        "model.en.json": dump(dashboard_demo.demo_model_en(model)),
    }


def demo_version(card, demo=DEMO, data=None):
    """First 10 hex of a SHA-256 over the demo's files, its generated JSON and the card version
    they import: a generator change moves the version as a demo file change does."""
    if data is None:
        data = demo_data(demo_model())
    h = hashlib.sha256(card.encode())
    for f in demo_files(demo):
        h.update(b"\0" + f.name.encode() + b"\0" + f.read_bytes())
    for name in sorted(data):
        h.update(b"\0" + name.encode() + b"\0" + data[name].encode())
    return h.hexdigest()[:10]


def build_demo(outdir):
    model = demo_model()
    data = demo_data(model)
    out = copy_engine(outdir)
    shutil.copyfile(SRC / "house3d-card.js", out / "house3d-card.js")
    shutil.copyfile(CARDS, out / CARDS.name)
    # nginx and Cloudflare cache .js for 30 days: ?v= on every module, as on HA's resource URL.
    # The card and engine keep the card's version, and the dashboard cards theirs, so HA's
    # resource URLs move only with them.
    version, cards = card_version(), cards_version()
    demo = demo_version(f"{version}/{cards}", data=data)
    for f in demo_files():
        text = f.read_text(encoding="utf-8")
        text = text.replace("__HOUSE3D_VERSION__", version).replace("__DEMO_VERSION__", demo)
        text = text.replace("__KHE_CARDS_VERSION__", cards)
        (out / f.name).write_text(text, encoding="utf-8")
    write_model(out, model)
    for name, text in data.items():
        (out / name).write_text(text, encoding="utf-8")
    print(f"built demo {out} (card v{version}, cards v{cards}, demo {demo})")
    return 0


def main(argv):
    if argv[:1] == ["--scan"]:
        args = argv[1:]
        count = args[:1] == ["--count"]
        args = args[count:]
        allow = []
        fixture = None
        while True:
            if args[:1] == ["--allow-devices-key"] and len(args) >= 2:
                allow.append((args[1], DEVICES_KEY_LABEL))
                args = args[2:]
            elif args[:1] == ["--allow-device-name"] and len(args) >= 3:
                fixture = fixture or full_model(FIXTURE)
                name = fixture_device_name(fixture, args[1])
                allow.append((args[2], f"private string {name!r}"))
                args = args[3:]
            else:
                break
        if len(args) >= 2:
            layers = full_model(args[0])
            model = house3d_model.merge(layers, house3d_model.LAYERS)
            return run_scan(model, args[1:], count, allow)
    if len(argv) == 2 and argv[0] == "--demo":
        return build_demo(argv[1])
    if len(argv) == 2 and not argv[0].startswith("-"):
        return build(*argv)
    print(__doc__.split("\n\n")[1], file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
