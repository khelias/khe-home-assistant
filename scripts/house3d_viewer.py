#!/usr/bin/env python3
"""Build the standalone house 3D viewer, and scan files for private house data.

Usage:  house3d_viewer.py MODEL OUTDIR [--bake DIR]     build, then scan OUTDIR
        house3d_viewer.py --scan [--count] [ALLOW]... MODEL PATH...
                                                        scan files or trees, exit 1 on any hit

The build writes OUTDIR/index.html (viewer.html), house3d.js, scene/, vendor/ and model.json
from the geometry, rooms and showcase layers of MODEL. The private and surroundings layers
and the georeference never go in; model.json gets only the plan's grid bearing in whole
degrees as orientation.x_axis_bearing_deg, for the real style's sun. With --bake it also copies
DIR's bake.json and bake-ao.png (scripts/house3d-bake.sh), the house's baked contact shadows,
which the viewer then applies; the scan reads bake.json and skips the atlas, a grey image with no
text. Publishing the folder is a separate decision.

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

import json
import math
import re
import shutil
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import house3d_model

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "house3d"
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
# the made-up house the public demo shows, on the test house's device ids
DEMO = ROOT / "tests/house3d/fixture-demo.md"
DEVICES_KEY = re.compile(r"""["']?\bdevices["']?\s*:""")
DEVICES_KEY_LABEL = "a devices key"
BAKE_FILES = ("bake.json", "bake-ao.png")
BAKE_META = '<meta name="house3d-bake" content="{}">'


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


def build(model_path, outdir, bake=None):
    layers = full_model(model_path)
    public = house3d_model.merge(layers, house3d_model.PUBLIC)
    # a public page should not pin the house; whole degrees of bearing turn the sun, not a map
    geo = public.pop("georef", None) or {}
    if isinstance(geo.get("x_axis_bearing_deg"), (int, float)):
        public["orientation"] = {"x_axis_bearing_deg": round(geo["x_axis_bearing_deg"])}
    assert "surroundings" not in public, (
        "the surroundings layer fixes the location; it never goes public"
    )
    for name in BAKE_FILES if bake else ():
        if not (Path(bake) / name).is_file():
            raise SystemExit(f"build: {Path(bake) / name} does not exist")
    out = copy_engine(outdir)
    page = (SRC / "viewer.html").read_text(encoding="utf-8")
    write_model(out, public)
    for name in BAKE_FILES:
        # a build without a bake leaves no earlier one behind to be published
        (out / name).unlink(missing_ok=True)
        if bake:
            shutil.copyfile(Path(bake) / name, out / name)
    if bake:
        page = page.replace(BAKE_META.format(""), BAKE_META.format(f"./{BAKE_FILES[0]}"))
    (out / "index.html").write_text(page, encoding="utf-8")
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
    bake = None
    if len(argv) == 4 and argv[2] == "--bake":
        argv, bake = argv[:2], argv[3]
    if len(argv) == 2 and not any(a.startswith("-") for a in argv):
        return build(*argv, bake=bake)
    print(__doc__.split("\n\n")[1], file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
