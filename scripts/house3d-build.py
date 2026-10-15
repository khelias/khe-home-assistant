#!/usr/bin/env python3
"""Build the standalone house 3D viewer, and scan files for private house data.

Usage:  house3d-build.py MODEL OUTDIR           build, then scan OUTDIR
        house3d-build.py --demo OUTDIR          build the HA card demo of the test house
        house3d-build.py --scan MODEL PATH...   scan files or trees, exit 1 on any hit

The build writes OUTDIR/index.html (viewer.html), house3d.js, scene/, vendor/ and model.json
from the geometry, rooms and showcase layers of MODEL (khe-meta house/house-model.md). The
private and surroundings layers and the georeference never go in; model.json gets only the
plan's grid bearing in whole degrees as orientation.x_axis_bearing_deg, for the real style's
sun. Publishing the folder is a separate decision.

The demo build reads only the made-up test house (tests/house3d/fixture-model.md), never a
model argument or HOUSE3D_MODEL, and writes OUTDIR/index.html and demo.js (from demo/), the HA
card, the engine and model.json with every layer the card gets in HA. khe-sites publishes it at
khe.ee/house3d/. The fixture is public in this repo, so there is nothing to scan.

The scan reads the private layer of MODEL and fails on every occurrence of an entity id,
a device name, a family room name or the car's entity and name
(house3d_model.private_strings), of a `devices` key, and of a device's coordinates written
out as text: its [x, y, z] position, its ground [x, z] pair and a camera's look direction
(integer-only directions such as [0, 1] carry no location and are skipped). The car's
path points and side outline points count too, as [x, z] and [x, y] pairs, but only
pairs with a coordinate of two or more decimals: round pairs such as 0.5, 0.5 occur in
the vendored three.js. So do the surroundings layer's building and road vertices, by the
same two-decimal rule, and the georeference's origin_E and origin_N, as written in the
model and in whole metres; their labels name the layer and an index, never the
values. Run it over
house3d/ before every commit that touches it.
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
DEMO = ROOT / "demo"
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
DEVICES_KEY = re.compile(r"""["']?\bdevices["']?\s*:""")


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
    out.append(("a devices key", DEVICES_KEY))
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


def scan(model, paths):
    pats = patterns(model)
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
        for label, rx in pats:
            for m in rx.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{f}:{line}: {label}")
    return hits, len(files)


def full_model(path):
    layers = house3d_model.read_layers(path)
    problems = house3d_model.validate(layers)
    if problems:
        sys.exit("model problems:\n" + "\n".join(problems))
    return layers


def run_scan(model, paths):
    hits, n = scan(model, paths)
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


def card_version():
    m = re.search(
        r"^const HOUSE3D_VERSION = (\d+);", (SRC / "house3d-card.js").read_text(), re.MULTILINE
    )
    if not m:
        sys.exit("house3d-card.js: no HOUSE3D_VERSION")
    return m.group(1)


def build_demo(outdir):
    layers = full_model(FIXTURE)
    model = house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))
    out = copy_engine(outdir)
    shutil.copyfile(SRC / "house3d-card.js", out / "house3d-card.js")
    # nginx and Cloudflare cache .js for 30 days: ?v= on the card and demo.js, as on HA's resource URL
    version = card_version()
    for name in ("index.html", "demo.js"):
        text = (DEMO / name).read_text(encoding="utf-8")
        (out / name).write_text(text.replace("__HOUSE3D_VERSION__", version), encoding="utf-8")
    write_model(out, model)
    print(f"built demo {out} (card v{version})")
    return 0


def main(argv):
    if len(argv) >= 3 and argv[0] == "--scan":
        layers = full_model(argv[1])
        return run_scan(house3d_model.merge(layers, house3d_model.LAYERS), argv[2:])
    if len(argv) == 2 and argv[0] == "--demo":
        return build_demo(argv[1])
    if len(argv) == 2 and not argv[0].startswith("-"):
        return build(*argv)
    print(__doc__.split("\n\n")[1], file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
