#!/usr/bin/env bash
# The 3D engine's pinned copy from khelias/khe-house3d (estate ADR-052): the engine's house3d/
# files, its model validator and viewer build, its test harness and the made-up test house, at
# the same paths as there, listed with their sha256 in house3d-engine.json.
#
# Usage:  scripts/house3d-engine.sh COMMIT    write the copy at COMMIT (a full sha) and the list
#         scripts/house3d-engine.sh --check   fail when a git-tracked file of the copy is changed
#                                             or missing, or house3d/ tracks a file that is
#                                             neither the copy's nor the card's
# The copy is never edited here: change khe-house3d and bump the commit, with the card's
# HOUSE3D_VERSION and the Lovelace resource's ?v=.
set -u
cd "$(dirname "$0")/.." || exit 1

REPO=khelias/khe-house3d
MANIFEST=house3d-engine.json

if [ "${1:-}" = "--check" ]; then
  python3 -I - "$MANIFEST" <<'EOF'
import hashlib, json, subprocess, sys
CARD = "house3d/house3d-card.js"
manifest = json.load(open(sys.argv[1], encoding="utf-8"))
ls = subprocess.run(["git", "ls-files", "-z"], capture_output=True, text=True, check=True)
tracked = set(ls.stdout.split("\0")) - {""}
files, bad = manifest["files"], []
for path, want in sorted(files.items()):
    if path not in tracked:
        bad.append(f"{path}: missing")
        continue
    try:
        got = hashlib.sha256(open(path, "rb").read()).hexdigest()
    except OSError:
        bad.append(f"{path}: missing")
        continue
    if got != want:
        bad.append(f"{path}: changed")
for path in sorted(tracked):
    if path.startswith("house3d/") and path not in files and path != CARD:
        bad.append(f"{path}: not in the engine copy")
for b in bad:
    print(f"house3d-engine: {b}", file=sys.stderr)
if bad:
    print(f"house3d-engine: the copy differs from {manifest['repo']}@{manifest['commit'][:12]}; "
          "change it there and run scripts/house3d-engine.sh <commit>", file=sys.stderr)
    sys.exit(1)
print(f"house3d-engine: {len(files)} files match {manifest['repo']}@{manifest['commit'][:12]}")
EOF
  exit $?
fi

commit=${1:-}
if ! printf '%s' "$commit" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "usage: $0 COMMIT (a full 40-character sha) | --check" >&2
  exit 2
fi

# only a commit on khe-house3d's main: GitHub serves a fork's commits under the same repo URL
compare=$(curl -fsSL "https://api.github.com/repos/$REPO/compare/$commit...main") || {
  echo "house3d-engine: $REPO has no commit $commit" >&2
  exit 1
}
status=$(printf '%s' "$compare" | python3 -I -c 'import json, sys; print(json.load(sys.stdin).get("status", ""))')
case "$status" in
  ahead|identical) ;;
  *) echo "house3d-engine: $commit is not on $REPO main ($status)" >&2; exit 1 ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$commit" -o "$tmp/engine.tar.gz" || exit 1
mkdir "$tmp/src"
tar -xzf "$tmp/engine.tar.gz" -C "$tmp/src" --strip-components 1 || exit 1

python3 -I - "$tmp/src" "$REPO" "$commit" "$MANIFEST" <<'EOF'
import hashlib, json, shutil, sys
from pathlib import Path
src, repo, commit, manifest = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
CARD = Path("house3d/house3d-card.js")
SINGLE = ("scripts/house3d_model.py", "scripts/house3d_viewer.py",
          "tests/house3d/engine-harness.mjs", "tests/house3d/fixture-model.md")
want = sorted(p.relative_to(src) for p in (src / "house3d").rglob("*") if p.is_file())
want += [Path(p) for p in SINGLE]
links = [str(p.relative_to(src)) for p in src.rglob("*") if p.is_symlink()]
if links:
    sys.exit(f"house3d-engine: {commit[:12]} has symlinks ({', '.join(links)}); nothing was changed")
missing = [str(p) for p in want if not (src / p).is_file()]
if missing:
    sys.exit(f"house3d-engine: {commit[:12]} has no {', '.join(missing)}; nothing was changed")
# what the engine no longer has goes; the card is this repo's own
for p in sorted(Path("house3d").rglob("*")):
    if p.is_file() and p != CARD and p not in want:
        p.unlink()
files = {}
for rel in want:
    Path(rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src / rel, rel, follow_symlinks=False)
    files[str(rel)] = hashlib.sha256(Path(rel).read_bytes()).hexdigest()
Path(manifest).write_text(json.dumps({"repo": repo, "commit": commit, "files": dict(sorted(files.items()))}, indent=1) + "\n", encoding="utf-8")
print(f"house3d-engine: {len(files)} files from {repo}@{commit[:12]}")
EOF
