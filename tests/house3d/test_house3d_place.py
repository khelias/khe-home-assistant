"""Tests for scripts/house3d-place.py's apply, on a temporary copy of the synthetic fixture.

Run from the repo root: python3 -I -m unittest discover -s tests/house3d -v
"""
import contextlib, importlib.util, io, json, shutil, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests/house3d/fixture-model.md"

_spec = importlib.util.spec_from_file_location("house3d_place", ROOT / "scripts/house3d-place.py")
hp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hp)


class ApplyFuture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.model = Path(self.tmp.name) / "model.md"
        shutil.copyfile(FIXTURE, self.model)

    def tearDown(self):
        self.tmp.cleanup()

    def apply(self, changes):
        f = Path(self.tmp.name) / "changes.json"
        f.write_text(json.dumps(changes), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()) as out:
            hp.apply(str(self.model), str(f))
        return out.getvalue()

    def changed_lines(self):
        old = FIXTURE.read_text(encoding="utf-8").split("\n")
        new = self.model.read_text(encoding="utf-8").split("\n")
        self.assertEqual(len(old), len(new))
        return [(a, b) for a, b in zip(old, new) if a != b]

    def test_a_moved_item_rewrites_its_line_only_and_stays_valid(self):
        out = self.apply({"future": {"tub": {"pos": [10.113, 13.317]}, "greenhouse": {"pos": [14.513, 12.113], "rot": 0}}})
        self.assertIn("future item tub: moved", out)
        self.assertIn("rot 90 -> 0", out)
        lines = self.changed_lines()
        self.assertEqual(len(lines), 2)
        items = [json.loads(b.strip().rstrip(",")) for _, b in lines]
        tub = next(it for it in items if it["id"] == "tub")
        self.assertEqual(tub["pos"], [10.113, 13.317])
        self.assertEqual(tub["facts"], [])
        self.assertTrue(lines[-1][1].rstrip().endswith("}"), "the last item keeps no trailing comma")
        self.assertEqual(hp.house3d_model.validate(hp.house3d_model.read_layers(self.model)), [])

    def test_moving_pv_off_its_roof_is_refused_before_writing(self):
        before = self.model.read_text(encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as e:
            self.apply({"future": {"pv": {"pos": [7.013, 3.151]}}})
        self.assertIn("future item pv: its rectangle is not inside roof roofN's outline", str(e.exception))
        self.assertEqual(self.model.read_text(encoding="utf-8"), before)

    def test_unknown_item_and_bad_rot_are_refused(self):
        with self.assertRaises(SystemExit) as e:
            self.apply({"future": {"sauna": {"pos": [1.5, 2.5]}}})
        self.assertIn("sauna", str(e.exception))
        with self.assertRaises(SystemExit) as e:
            self.apply({"future": {"tub": {"pos": [1.5, 2.5], "rot": 45}}})
        self.assertIn("rot 45", str(e.exception))


if __name__ == "__main__":
    unittest.main()
