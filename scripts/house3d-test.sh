#!/usr/bin/env bash
# The house 3D view's tests: the model, build and placement tests, the engine, dashboard card and demo
# dashboard tests in Node (the demo in Estonian and in English), and a syntax check of every engine,
# card, demo and test module (vendored three.js excepted).
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
node --test tests/house3d/engine.test.mjs || fail "engine tests"
node --test tests/house3d/demo.test.mjs || fail "demo tests"
node --test tests/house3d/demo-en.test.mjs || fail "English demo tests"
node --test tests/cards/cards.test.mjs || fail "card tests"

engine=house3d
while IFS= read -r f; do
  node --input-type=module --check < "$f" || fail "syntax: $f"
done < <(find "$engine" cards demo tests/house3d tests/cards -path "$engine/vendor" -prune -o -type f \( -name '*.js' -o -name '*.mjs' \) -print | sort)

[ "$rc" -eq 0 ] && echo "house3d-test: all passed"
exit "$rc"
