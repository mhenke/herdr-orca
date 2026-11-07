#!/usr/bin/env python3
"""Checks that would have caught this project's real failures.

Not a unit-test suite: nothing here asserts a layout value or a tone, because those have
no oracle in this repo — the oracle is `~/Projects/orca`, and that is what check 1 reads.

Three checks, each earned by a defect that actually shipped:

  1. citations — every `file.ts:NN` in a mod comment must resolve to a real file in Orca and
     a line that exists. Caught: `review-state-presentation.ts:44-49` in a 39-line file,
     `worktree-review-presentation.tsx:105` in a 95-line file, `default-workspace-card.js`
     (it is `.json`). A fabricated citation reads as verified and is worse than none.
  2. syntax — `node --check` on every mod script. Cheap, and a typo here is a render throw.
  3. mods — `herdr-app check` on every mod folder, which resolves imports and asset paths.

Check 4 is opt-in (`--smoke`): restart the app and fail on any script error in the log.
That is the only check that catches a render-path throw — `this.cx` undefined and the
reserved-word `base` both killed whole regions this way, and no pure test would see them.

Usage: python3 scripts/verify.py [--smoke]
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODS = os.path.join(ROOT, "mods")
ORCA = os.path.expanduser("~/Projects/orca")

# Cited names that belong to this package, not to Orca: our own helpers and the type stubs
# each mod ships. A citation of these is a reference to a local file, not a parity claim.
LOCAL = {
    "main.js", "project.js", "status.js", "indentation.js", "focus.js", "tip.js", "clip.js",
    "mod.js", "mod.json", "jsconfig.json", "tsconfig.json", "gpui-kit.d.ts",
}

CITE = re.compile(r"([A-Za-z0-9_./-]+\.(?:tsx?|jsx?|json|css))(?![\w.])(?::(\d+)(?:-(\d+))?)?")

# Every file in Orca, indexed once by basename. Walking per citation was the slow part.
def orca_index():
    index = {}
    for root, dirs, files in os.walk(ORCA):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", "out")]
        for name in files:
            index.setdefault(name, []).append(os.path.join(root, name))
    return index


def line_count(path):
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def check_citations():
    index = orca_index()
    problems = []
    seen = 0
    for root, dirs, files in os.walk(MODS):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for name in files:
            if not name.endswith((".js", ".json")):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8", errors="ignore") as fh:
                text = fh.read()
            for match in CITE.finditer(text):
                cited, first, last = match.group(1), match.group(2), match.group(3)
                base = os.path.basename(cited)
                if base in LOCAL:
                    continue
                seen += 1
                hits = index.get(base)
                if not hits:
                    problems.append(f"  MISSING  {cited}  <- {os.path.relpath(path, ROOT)}")
                    continue
                if not first:
                    continue
                longest = max(line_count(h) for h in hits)
                want = int(last or first)
                if want > longest:
                    problems.append(
                        f"  BADLINE  {cited}:{first}{'-' + last if last else ''}"
                        f"  (longest match has {longest} lines)  <- {os.path.relpath(path, ROOT)}"
                    )
    print(f"citations: {seen} checked")
    for line in problems:
        print(line)
    return not problems


def check_syntax():
    bad = []
    for root, dirs, files in os.walk(MODS):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for name in files:
            if not name.endswith(".js"):
                continue
            path = os.path.join(root, name)
            run = subprocess.run(["node", "--check", path], capture_output=True, text=True)
            if run.returncode != 0:
                bad.append(f"  {os.path.relpath(path, ROOT)}: {run.stderr.strip().splitlines()[-1]}")
    print(f"syntax: {0 if bad else 'ok'}")
    for line in bad:
        print(line)
    return not bad


def check_mods():
    bad = []
    for name in sorted(os.listdir(MODS)):
        path = os.path.join(MODS, name)
        if not os.path.isdir(path):
            continue
        run = subprocess.run(["herdr-app", "check", path], capture_output=True, text=True)
        if run.returncode != 0 or "check passed" not in run.stdout:
            bad.append(f"  {name}: {(run.stdout + run.stderr).strip().splitlines()[-1]}")
    print(f"mods: {0 if bad else 'ok'}")
    for line in bad:
        print(line)
    return not bad


# A mod exception does not exit the app: it is logged and the region goes blank, which is
# exactly how the avatars and the collapse button vanished. Only the log shows it.
ERROR_LINE = re.compile(r"\b(ERROR|script: .*?(is not initialized|is not a function|TypeError|ReferenceError))")


def check_smoke():
    import shutil
    import time

    log = "/tmp/verify-smoke.log"
    if shutil.which("herdr-app") is None:
        print("smoke: skipped (herdr-app not on PATH)")
        return True
    subprocess.run(["pkill", "-x", "herdr-app"], capture_output=True)
    time.sleep(2)
    sock = os.path.expanduser("~/.config/herdr-app/herdr-app.sock")
    if os.path.exists(sock):
        os.remove(sock)
    with open(log, "wb") as out:
        subprocess.Popen(
            ["setsid", "herdr-app"], stdout=out, stderr=out, stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    time.sleep(25)
    with open(log, encoding="utf-8", errors="ignore") as fh:
        errors = [line.rstrip() for line in fh if ERROR_LINE.search(line)]
    print(f"smoke: {len(errors)} script error(s)")
    for line in errors[:10]:
        print("  " + line)
    return not errors


def main():
    results = [check_citations(), check_syntax(), check_mods()]
    if "--smoke" in sys.argv:
        results.append(check_smoke())
    ok = all(results)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
