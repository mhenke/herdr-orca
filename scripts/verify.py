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

# Cited names that belong to this package or to Herdr, not to Orca: our own helpers, the type
# stubs each mod ships, and the `herdr` module's generated herdr.d.ts. A citation of these is
# a reference to a local file, not an Orca parity claim.
LOCAL = {
    "main.js", "project.js", "status.js", "indentation.js", "focus.js", "tip.js", "clip.js",
    "worktree-plan.js", "review-store.js", "usage.js", "crew.js", "crew.test.js",
    "mod.js", "mod.json", "jsconfig.json", "tsconfig.json", "gpui-kit.d.ts", "herdr.d.ts",
    # Herdr's own kind-binding file. A mod names it to explain how Herdr spells a key
    # ("ctrl-shift-t"), which is a fact about Herdr, not a parity claim about Orca.
    "keys.json",
    # Herdr's standard-agent catalog. A mod names it to say which agents it can offer, which is
    # a fact about Herdr, not a parity claim about Orca.
    "programs.json",
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


def comments(text):
    """Only the lines that are comments.

    A citation is a claim about Orca, and the mods make those claims in comments. Scanning the
    whole file made a table of *filenames* — `orca-files`' extension-to-icon map — read as a
    page of parity claims, so `vitest.config.js` and `package.json` failed as MISSING/AMBIGUOUS
    when they were only data being compared against. Prose in a string is not a citation either.
    """
    out = []
    in_block = False
    for line in text.splitlines():
        stripped = line.lstrip()
        if in_block:
            out.append(stripped)
            if "*/" in stripped:
                in_block = False
            continue
        if stripped.startswith("/*"):
            out.append(stripped)
            in_block = "*/" not in stripped
            continue
        if stripped.startswith("//") or stripped.startswith("*"):
            out.append(stripped)
    return "\n".join(out)


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
            for match in CITE.finditer(comments(text)):
                cited, first, last = match.group(1), match.group(2), match.group(3)
                base = os.path.basename(cited)
                if base in LOCAL:
                    continue
                seen += 1
                hits = index.get(base)
                if not hits:
                    problems.append(f"  MISSING  {cited}  <- {os.path.relpath(path, ROOT)}")
                    continue
                # A citation that names a directory must name the RIGHT one. Indexing by
                # basename alone let `sidebar/ProjectsCollapseAllButton.tsx:23` pass while the
                # file actually lives at `sidebar/worktree-list/controls/` — the gate proved the
                # filename existed, not the path, so a wrong path read as verified.
                if "/" in cited:
                    want = "/" + cited.strip("/")
                    paths = [h for h in hits if h.replace(os.sep, "/").endswith(want)]
                    if not paths:
                        problems.append(
                            f"  BADPATH  {cited}  (file exists elsewhere: "
                            f"{os.path.relpath(hits[0], ORCA)})  <- {os.path.relpath(path, ROOT)}"
                        )
                        continue
                    hits = paths
                elif len(hits) > 1:
                    # A bare basename that matches several files proves nothing: it names a
                    # directory-less file, so any of them satisfies it. `PortsPanel.tsx` passed
                    # this way while the cited one was never the one read. Name the directory.
                    problems.append(
                        f"  AMBIGUOUS  {cited}  (matched {len(hits)}: "
                        f"{', '.join(os.path.relpath(h, ORCA) for h in hits[:3])})  <- {os.path.relpath(path, ROOT)}"
                    )
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


def check_assets():
    """Every `svg("mods/<mod>/<name>.svg")` must name a real file in that mod's own folder.

    Earned by three defects that shipped and drew nothing: `orca-files/circle-slash.svg` and
    `orca-files/folder-open.svg` did not exist, and `orca-spaces` loaded its machine glyphs
    from `mods/t3-inbox/`, a different package. `herdr-app check` passes on all of them —
    a missing asset resolves to nothing rather than an error (`assets.rs:109-115`), so the
    only signal is a blank icon nobody files a bug about.
    """
    import glob

    mods = {os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(MODS, "*") + os.sep)}
    problems = []
    seen = 0
    for path in sorted(glob.glob(os.path.join(MODS, "*", "main.js"))):
        with open(path, encoding="utf-8", errors="ignore") as fh:
            text = fh.read()
        for match in re.finditer(r'\bsvg\(\s*(`[^`]*`|"[^"]*")', text):
            body = match.group(1)[1:-1]
            line = text[: match.start()].count("\n") + 1
            head = re.match(r"mods/([\w-]+)/(.*)$", body)
            if not head:
                continue
            mod, rest = head.group(1), head.group(2)
            names, unresolved = [""], False
            for part in re.split(r"(\$\{[^}]*\})", rest):
                if part.startswith("${"):
                    branches = re.findall(r'"([\w.-]+)"', part)
                    if branches:
                        names = [n + b for n in names for b in branches]
                    else:
                        unresolved = True
                else:
                    names = [n + part for n in names]
            if unresolved:
                continue  # a helper parameter; its call sites are the real claim
            for name in names:
                if not name.endswith(".svg"):
                    continue
                seen += 1
                where = os.path.join(MODS, mod, name)
                if mod not in mods:
                    problems.append(f"  FOREIGN  mods/{mod}/{name} (another package's mod folder)"
                                    f"  <- {os.path.relpath(path, ROOT)}:{line}")
                elif not os.path.exists(where):
                    problems.append(f"  MISSING  mods/{mod}/{name}  <- {os.path.relpath(path, ROOT)}:{line}")
    print(f"assets: {seen} resolved, {len(problems)} problem(s)")
    for line in problems:
        print(line)
    return not problems


def main():
    results = [check_citations(), check_syntax(), check_mods(), check_assets()]
    if "--smoke" in sys.argv:
        results.append(check_smoke())
    ok = all(results)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
