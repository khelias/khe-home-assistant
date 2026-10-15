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

RUFF=${RUFF:-.venv/bin/ruff}
$RUFF check scripts || fail "ruff check"
$RUFF format --check scripts || fail "ruff format"

[ "$rc" -eq 0 ] && echo "check: all passed"
exit "$rc"
