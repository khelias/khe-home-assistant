#!/usr/bin/env bash
# A consumer's pinned copy of this engine (estate ADR-052 point 3). The script travels in the
# copy and runs from the consumer's root, where house3d-engine.json lists what is copied:
#   include  paths of khe-house3d to copy, a folder with a trailing slash; this script among them
#   exclude  paths under an included folder that the consumer does not take (a folder with a
#            trailing slash), e.g. house3d/assets/; optional
#   own      the consumer's own files inside an included folder, never touched
#   files    every copied file with its sha256, written by this script
#
# Usage:  bash scripts/house3d-copy.sh COMMIT    write the copy at COMMIT (a full sha on main)
#         bash scripts/house3d-copy.sh --check   fail when a git-tracked file of the copy is
#                                                changed or missing, or an included folder
#                                                tracks a file that is neither copied nor own
# The copy is never edited in the consumer: change khe-house3d and bump the commit.
# HOUSE3D_COPY_SOURCE=DIR, for tests only, takes the files from DIR instead of GitHub and skips
# the check that COMMIT is on main.
#
# Every file, this one included, is replaced through a temp file, so a bump that changes this
# script never rewrites it under the running bash; the body in a function called on the last
# line is a second guard.
set -u

REPO=khelias/khe-house3d
MANIFEST=house3d-engine.json
tmp=

# copy_py check MANIFEST | copy_py write MANIFEST SRC REPO COMMIT
copy_py() {
  python3 -I - "$@" <<'EOF'
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path, PurePosixPath

mode, manifest_path = sys.argv[1], sys.argv[2]
manifest = json.load(open(manifest_path, encoding="utf-8"))
SELF = "scripts/house3d-copy.sh"
if SELF not in manifest.get("include", []):
    sys.exit(f"house3d-copy: {manifest_path} has no include list with {SELF} in it")


def rel(p):
    q = PurePosixPath(p)
    if q.is_absolute() or ".." in q.parts or "." in p.split("/") or not q.parts:
        sys.exit(f"house3d-copy: {p!r} in {manifest_path} is not a plain path inside the repo")
    return q


include = [(rel(e), e.endswith("/")) for e in manifest["include"]]
folders = [p for p, is_folder in include if is_folder]
own = {rel(p) for p in manifest.get("own", [])}
exclude = [(rel(e), e.endswith("/")) for e in manifest.get("exclude", [])]


def excluded(q):
    return any(q == p or (is_folder and p in q.parents) for p, is_folder in exclude)


if excluded(PurePosixPath(SELF)):
    sys.exit(f"house3d-copy: {manifest_path} excludes {SELF}, which travels in the copy")


def in_folder(q):
    return any(f in q.parents for f in folders)


def sha(data):
    return hashlib.sha256(data).hexdigest()


if mode == "check":
    files = manifest.get("files")
    if not files:
        sys.exit(f"house3d-copy: {manifest_path} lists no copied files; run scripts/house3d-copy.sh <commit>")
    paths = [str(f) for f in folders] + list(files)
    ls = subprocess.run(["git", "ls-files", "-z", "--", *paths], capture_output=True, text=True, check=True)
    tracked = set(ls.stdout.split("\0")) - {""}
    at = f"{manifest['repo']}@{manifest['commit'][:12]}"
    bad = []
    for path, want in sorted(files.items()):
        if path not in tracked or not os.path.isfile(path):
            bad.append(f"{path}: missing")
        elif sha(Path(path).read_bytes()) != want:
            bad.append(f"{path}: changed")
    for path in sorted(tracked):
        q = PurePosixPath(path)
        if in_folder(q) and path not in files and q not in own:
            bad.append(f"{path}: not in the engine copy")
    for b in bad:
        print(f"house3d-copy: {b}", file=sys.stderr)
    if bad:
        sys.exit(f"house3d-copy: the copy differs from {at}; change it there and run scripts/house3d-copy.sh <commit>")
    print(f"house3d-copy: {len(files)} files match {at}")
    sys.exit(0)

src, repo, commit = Path(sys.argv[3]), sys.argv[4], sys.argv[5]


def linked(p):
    # the path itself or any folder above it inside the source
    return any((src / Path(*p.parts[:i])).is_symlink() for i in range(1, len(p.parts) + 1))


want, links, missing = set(), [], []
for p, is_folder in include:
    if linked(p):
        links.append(str(p))
    elif is_folder and not (src / p).is_dir():
        missing.append(str(p) + "/")
    elif is_folder:
        for root, dirs, names in os.walk(src / p):
            for n in dirs + names:
                full = Path(root, n)
                if full.is_symlink():
                    links.append(str(full.relative_to(src)))
                elif full.is_file():
                    want.add(PurePosixPath(full.relative_to(src).as_posix()))
    elif (src / p).is_file():
        want.add(p)
    else:
        missing.append(str(p))
want = {q for q in want - own if not excluded(q)}
if links:
    sys.exit(f"house3d-copy: {commit[:12]} has symlinks ({', '.join(sorted(links))}); nothing was changed")
if missing:
    sys.exit(f"house3d-copy: {commit[:12]} has no {', '.join(sorted(missing))}; nothing was changed")
# what the engine no longer has goes; the consumer's own files stay
for f in folders:
    for p in sorted(Path(f).rglob("*")):
        q = PurePosixPath(p.as_posix())
        if not p.is_dir() and q not in want and q not in own:
            p.unlink()


def replace(dest, data, like=None):
    t = dest.with_name(f".{dest.name}.house3d-copy")
    t.write_bytes(data)
    if like:
        shutil.copymode(like, t)
    os.replace(t, dest)


files = {}
for p in sorted(want):
    data = (src / p).read_bytes()
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    replace(Path(p), data, src / p)
    files[str(p)] = sha(data)
manifest |= {"repo": repo, "commit": commit, "files": dict(sorted(files.items()))}
replace(Path(manifest_path), (json.dumps(manifest, indent=1) + "\n").encode())
print(f"house3d-copy: {len(files)} files from {repo}@{commit[:12]}")
EOF
}

fetch() {
  local commit=$1 compare status
  # only a commit on khe-house3d's main: GitHub serves a fork's commits under the same repo URL
  compare=$(curl -fsSL "https://api.github.com/repos/$REPO/compare/$commit...main?per_page=1") || {
    echo "house3d-copy: $REPO has no commit $commit" >&2
    return 1
  }
  status=$(printf '%s' "$compare" | python3 -I -c 'import json, sys; print(json.load(sys.stdin).get("status", ""))')
  case "$status" in
    ahead|identical) ;;
    *) echo "house3d-copy: $commit is not on $REPO main ($status)" >&2; return 1 ;;
  esac
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$commit" -o "$tmp/engine.tar.gz" || return 1
  mkdir "$tmp/src" && tar -xzf "$tmp/engine.tar.gz" -C "$tmp/src" --strip-components 1
}

main() {
  if [ ! -f "$MANIFEST" ]; then
    echo "house3d-copy: no $MANIFEST here; run it from the consumer's root" >&2
    return 2
  fi
  if [ "${1:-}" = "--check" ]; then
    copy_py check "$MANIFEST"
    return
  fi
  local commit=${1:-} src
  if ! [[ $commit =~ ^[0-9a-f]{40}$ ]]; then
    echo "usage: scripts/house3d-copy.sh COMMIT (a full 40-character sha) | --check" >&2
    return 2
  fi
  if [ -n "${HOUSE3D_COPY_SOURCE:-}" ]; then
    echo "house3d-copy: files from HOUSE3D_COPY_SOURCE=$HOUSE3D_COPY_SOURCE; the commit is not checked against $REPO"
    src=$HOUSE3D_COPY_SOURCE
  else
    tmp=$(mktemp -d)
    trap 'rm -rf -- "$tmp"' EXIT
    fetch "$commit" || return 1
    src=$tmp/src
  fi
  copy_py write "$MANIFEST" "$src" "$REPO" "$commit"
}

main "$@"; exit $?
