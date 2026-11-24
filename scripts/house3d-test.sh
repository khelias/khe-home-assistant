#!/usr/bin/env bash
# The house 3D view's tests here: the demo build's tests (Python), the HA card's over the engine's
# harness, the demo dashboard's (in Estonian and in English, its scenarios and recorder), the
# dashboard cards', and a syntax check of every card, demo and test module. The engine's own
# tests are in khe-house3d; its copy here is checked by scripts/house3d-engine.sh --check.
# Runs from any directory; exits 1 when anything fails, after running everything.
set -u
cd "$(dirname "$0")/.." || exit 1

for tool in node python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "house3d-test: $tool is not installed" >&2
    exit 1
  fi
done

rc=0
fail() { echo "house3d-test: FAILED: $1" >&2; rc=1; }

python3 -I -m unittest discover -s tests/house3d || fail "python tests"
node --test tests/house3d/engine-card.test.mjs || fail "HA card tests"
node --test tests/house3d/demo.test.mjs || fail "demo tests"
node --test tests/house3d/demo-en.test.mjs || fail "English demo tests"
node --test tests/house3d/scenario.test.mjs || fail "scenario tests"
node --test tests/house3d/recorder.test.mjs || fail "recorder tests"
node --test tests/cards/cards-*.test.mjs || fail "card tests"

while IFS= read -r f; do
  node --input-type=module --check < "$f" || fail "syntax: $f"
done < <(find house3d/house3d-card.js cards demo tests/house3d tests/cards -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

[ "$rc" -eq 0 ] && echo "house3d-test: all passed"
exit "$rc"
