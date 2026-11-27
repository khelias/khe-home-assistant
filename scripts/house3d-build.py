#!/usr/bin/env python3
"""Build the HA dashboard demo of the made-up demo house; the standalone viewer build and the
privacy scan are the engine's (house3d_viewer.py, vendored from khe-house3d), and every other
argument goes to it.

Usage:  house3d-build.py --demo OUTDIR                  build the HA dashboard demo of the demo house
        house3d-build.py MODEL OUTDIR                   house3d_viewer.py: build the viewer, then scan
        house3d-build.py --scan [--count] [ALLOW]... MODEL PATH...
                                                        house3d_viewer.py: scan, exit 1 on any hit

The demo build reads only the made-up demo house (tests/house3d/fixture-demo.md), never a
model argument or HOUSE3D_MODEL, and writes every .html, .js, .css and .svg of demo/, the HA
card, the engine, the dashboard cards (cards/khe-cards.js), model.json with every layer the card
gets in HA, and the dashboard: the house's Overview on made-up data
(scripts/dashboard_demo.py) as dashboard.json, their starting states as states.json, their
chart data as series.json and the scenarios a visitor plays (scripts/dashboard_scenarios.py) as
scenarios.json, the simulated recorder it reads its history and dated states from as
recorder.json (one file for both languages), and the same in English with the demo house's model as dashboard.en.json,
states.en.json, series.en.json, scenarios.en.json and model.en.json. In the demo's files __HOUSE3D_VERSION__ becomes the card's version,
__KHE_CARDS_VERSION__ the dashboard cards' version and __DEMO_VERSION__ a hash of the demo's
files, the generated JSON files and those two versions. khe-sites publishes it at khe.ee/ha/demo/, in a window on khe.ee/ha/. The demo house is
public; the dashboard comes from the generator, which names the real house's devices, so
check.sh scans the demo build with the real model whenever one is at hand.
"""

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dashboard_demo
import dashboard_scenarios
import house3d_model
import house3d_viewer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "house3d"
DEMO = ROOT / "demo"
CARDS = ROOT / "cards" / "khe-cards.js"
CARDS_PARTS = ROOT / "cards" / "parts"
DEMO_HOUSE = house3d_viewer.DEMO
DEMO_SUFFIXES = (".html", ".js", ".css", ".svg")


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
    layers = house3d_viewer.full_model(DEMO_HOUSE)
    return house3d_model.with_room_names(house3d_model.merge(layers, house3d_model.CARD))


def demo_data(model):
    """The demo dashboard's generated files, name -> text: the config, states, series and
    scenarios, and the same in English with the demo house's model (ADR-003)."""
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    return {
        "dashboard.json": dump(dashboard_demo.demo_config(model)),
        "states.json": dump(dashboard_demo.demo_states(model)),
        "series.json": dump(dashboard_demo.demo_series()),
        "dashboard.en.json": dump(dashboard_demo.demo_config_en(model)),
        "states.en.json": dump(dashboard_demo.demo_states_en(model)),
        "series.en.json": dump(dashboard_demo.demo_series_en()),
        "model.en.json": dump(dashboard_demo.demo_model_en(model)),
        "scenarios.json": dump(dashboard_scenarios.demo_scenarios(model)),
        "recorder.json": dump(dashboard_demo.demo_recorder()),
        "scenarios.en.json": dump(dashboard_scenarios.demo_scenarios_en(model)),
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
    out = house3d_viewer.copy_engine(outdir)
    shutil.copyfile(SRC / "house3d-card.js", out / "house3d-card.js")
    shutil.copyfile(CARDS, out / CARDS.name)
    shutil.copytree(CARDS_PARTS, out / CARDS_PARTS.name, dirs_exist_ok=True)
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
    house3d_viewer.write_model(out, model)
    for name, text in data.items():
        (out / name).write_text(text, encoding="utf-8")
    print(f"built demo {out} (card v{version}, cards v{cards}, demo {demo})")
    return 0


def main(argv):
    if len(argv) == 2 and argv[0] == "--demo":
        return build_demo(argv[1])
    if argv[:1] == ["--demo"]:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    return house3d_viewer.main(argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
