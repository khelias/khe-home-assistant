#!/usr/bin/env bash
# The repo's whole check: what the commit gate and CI run. Runs everything,
# then exits 1 if anything failed.
set -u
cd "$(dirname "$0")/.." || exit 1

rc=0
fail() { echo "check: FAILED: $1" >&2; rc=1; }

for f in scripts/*.sh; do
  bash -n "$f" || fail "bash -n $f"
done
bash scripts/house3d-test.sh || fail "house3d tests"
python3 -I -m unittest discover -s tests/dashboard || fail "dashboard tests"

# The demo dashboard comes from the real generator, so it is scanned with the real model (the
# main checkout's khe-meta, also from a worktree, or HOUSE3D_MODEL); CI has none and skips.
common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
model=${HOUSE3D_MODEL:-${common:+$(dirname "$common")/../khe-meta/house/house-model.md}}
if [ -n "$model" ] && [ -f "$model" ]; then
  out=$(mktemp -d)
  if python3 -I scripts/house3d-build.py --demo "$out" >/dev/null; then
    python3 -I scripts/house3d-build.py --scan --count "$model" house3d demo scripts/dashboard_demo.py \
      "$out/dashboard.json" "$out/states.json" "$out/series.json" || fail "privacy scan"
  else
    fail "demo build"
  fi
  rm -rf -- "$out"
else
  echo "check: privacy scan skipped, no real model (CI)"
fi

RUFF=${RUFF:-.venv/bin/ruff}
$RUFF check scripts || fail "ruff check"
$RUFF format --check scripts || fail "ruff format"

[ "$rc" -eq 0 ] && echo "check: all passed"
exit "$rc"
