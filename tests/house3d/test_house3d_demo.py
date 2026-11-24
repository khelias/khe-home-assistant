"""Tests of scripts/house3d-build.py --demo: the HA dashboard demo of the made-up test house.

Run from the repo root: python3 -I -m unittest discover -s tests/house3d -v
"""
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests/house3d/fixture-model.md"
ENGINE = ROOT / "house3d"
BUILD = ROOT / "scripts/house3d-build.py"
DEMO = ROOT / "demo"

_spec = importlib.util.spec_from_file_location("house3d_model", ROOT / "scripts/house3d_model.py")
hm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hm)
_bspec = importlib.util.spec_from_file_location("house3d_build", BUILD)
hb = importlib.util.module_from_spec(_bspec)
_bspec.loader.exec_module(hb)


def layers():
    return hm.read_layers(FIXTURE)


def run(*args, env=None):
    return subprocess.run([sys.executable, "-I", str(BUILD), *map(str, args)], capture_output=True, text=True, env=env)

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
