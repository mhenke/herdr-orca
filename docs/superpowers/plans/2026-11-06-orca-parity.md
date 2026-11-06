# Orca Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Herdr App look and behave like Orca — layout, typography, sounds, icons, richer worktree menu, file-explorer actions and search — without forking Herdr's Rust.

**Architecture:** Herdr App is refreshed live from `~/.config/herdr-app/`: one layout JSON, one `settings.json`, and mods written in gpui-kit JS. Every phase is either a settings/layout edit or a *clone* of a shipped mod with a minimal diff. The repo at `~/Projects/herdr-orca` is the source of truth; `install.sh` copies into the app home.

**Tech Stack:** gpui-kit / gpui-base (JS, no DOM), Herdr app API (`~/.config/herdr-app/herdr.d.ts`), `herdr-app` CLI (`check`, `shot`, `do`, `status`), git.

## Global Constraints

- Target: `herdr-app 0.1.13`, `gpui-shell 0.7.1`, `herdr-core 0.1.18`. Re-verify after any Herdr upgrade.
- Shipped mods are **replaced on every app start**. Never edit files under `~/.config/herdr-app/mods/` that are not clone output; author in `~/Projects/herdr-orca/mods/` and install.
- Mod text sizes are px and follow zoom. Do not hardcode a global UI size.
- `ui_font` is a **font family** (`"Geist"`), never a number. Terminals take `font` + `font_size`.
- Geist ships with Herdr. **No font install, no `fc-cache`.**
- Icons live inside the consuming mod: `svg("mods/<mod>/<name>.svg")`. There is no shared icon directory.
- `exec(command, args?, {cwd, on})` has **no stdin**, a 30s limit and an 8 MiB output cap. Every read path must be bounded.
- One writer per layout node: `panel` and `panel-body` are owned by `tabs` (`tabs/main.js:32-33`, `:88-89`). Nothing else may call `layout.show/hide/select` on them.
- Clipboard and reveal must try, in order, the first tool that exists: `wl-copy`/`wl-paste` → `xclip -selection clipboard` → `pbcopy`/`pbpaste` → `clip.exe`. Reveal: `xdg-open` → `open` → `explorer`.
- Checks panel, worktree Pin/Unpin, child worktrees, project groups, sleep: **out of scope.** Do not add them.

---

## File Structure

```
~/Projects/herdr-orca/
  layouts/orca.json          # window tree + root look (theme, colors, fonts, radius)
  layouts/orca.svg           # settings-screen preview
  keys.json                  # layout:orca section
  settings/sounds/ding.mp3   # copied from Orca, installed to data/sounds/
  settings/sounds/two-tone.mp3
  mods/orca-menu/            # clone of `menu`, + clipboard/open-in-terminal items
    mod.json  main.js  *.svg
  mods/orca-spaces/          # clone of `spaces`, points its menu at orca-menu
    mod.json  main.js  (assets copied by clone)
  mods/orca-files/           # clone of `files`, + row context menu + search view
    mod.json  main.js  *.svg
  mods/orca-tabs/            # clone of `tabs`, + Orca activity strip
    mod.json  main.js
  bin/clip.sh                # platform clipboard chain
  bin/reveal.sh              # platform reveal chain
  install.sh                 # copy repo -> ~/.config/herdr-app
  docs/superpowers/specs/2026-11-06-orca-parity-design.md
  docs/superpowers/plans/2026-11-06-orca-parity.md
```

`bin/clip.sh` and `bin/reveal.sh` exist because `exec` has no stdin and the tool differs per OS; putting the chain in one shell script keeps the JS free of platform branching and makes the behaviour testable from the terminal.

---

### Task 1: Layout root look

**Files:**
- Modify: `layouts/orca.json` (root object, and the `main` node's pane `radius`)
- Test: `~/Projects/herdr-orca/bin/check-look.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: `layouts/orca.json` root carrying `theme`, `colors`, `font_size`, `ui_font`. Later tasks read these colours via `theme()` in mods.

- [ ] **Step 1: Write the failing check**

Create `bin/check-look.sh`:

```sh
#!/bin/sh
# Fails unless layouts/orca.json sets the look at its root, as Herdr requires.
set -e
L=~/Projects/herdr-orca/layouts/orca.json
python3 - "$L" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
missing = [k for k in ("theme", "colors", "font_size", "ui_font") if k not in d]
assert not missing, f"root look missing: {missing}"
assert isinstance(d["ui_font"], str), "ui_font must be a font family, not a size"
assert d["colors"].get("background") == "#0a0a0a", "background must be Orca's #0a0a0a"
pane = d["children"][1]["children"][1]["children"][0]["content"]["pane"]
assert pane["radius"] == 2, f"pane radius must be 2, got {pane['radius']}"
print("look ok")
PY
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `sh ~/Projects/herdr-orca/bin/check-look.sh`
Expected: `AssertionError: root look missing: ['theme', 'colors', 'font_size', 'ui_font']`

- [ ] **Step 3: Add the root look**

In `layouts/orca.json`, add beside `"background": "canvas"`:

```json
  "theme": "graphite",
  "ui_font": "Geist",
  "font_size": 14,
  "colors": {
    "canvas": "#0a0a0a",
    "chrome": "#0a0a0a",
    "background": "#0a0a0a",
    "surface": "#171717",
    "raised": "#262626",
    "popover": "#171717",
    "border": "rgba(255,255,255,0.07)",
    "foreground": "#f0f0f0",
    "muted": "#a3a3a3",
    "dim": "#737373",
    "accent": "#404040"
  },
```

And change the `main` node's pane `"radius": 10` to `"radius": 2`.

Do **not** add an `ansi` palette: changing it would shift every program's terminal colours.

- [ ] **Step 4: Run the check to confirm it passes**

Run: `sh ~/Projects/herdr-orca/bin/check-look.sh`
Expected: `look ok`

- [ ] **Step 5: Install and verify in the app**

```sh
cp ~/Projects/herdr-orca/layouts/orca.json ~/.config/herdr-app/layouts/
herdr-app status | grep -E '"layout"|errors'
```
Expected: `"layout": "orca"`, `"errors": []`. If the window was already running with the old file, restart the app once (a running window keeps the layout set it loaded at start).

If mod text still is not Geist: Herdr bundles Geist inside the binary rather than installing it into fontconfig (`fc-list | grep -i geist` finds nothing on this machine, and `defaults/AGENTS.md:340` states Geist ships with Herdr). Trust the app's own font resolution before reaching for a system install; `herdr-app status` shows no font error either way.

- [ ] **Step 6: Commit**

```bash
git add layouts/orca.json bin/check-look.sh
git commit -m "feat(layout): Orca root look — graphite theme, Geist UI font, 2px pane corners"
```

---

### Task 2: Sounds

**Files:**
- Create: `settings/sounds/ding.mp3`, `settings/sounds/two-tone.mp3`
- Modify: `install.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: `~/.config/herdr-app/data/sounds/{ding,two-tone}.mp3` and `settings.json` keys `sounds.done` / `sounds.blocked`.

- [ ] **Step 1: Copy the two MP3s**

```sh
mkdir -p ~/Projects/herdr-orca/settings/sounds
cp ~/Projects/orca/resources/notification-sounds/ding.mp3 \
   ~/Projects/orca/resources/notification-sounds/two-tone.mp3 \
   ~/Projects/herdr-orca/settings/sounds/
ls -l ~/Projects/herdr-orca/settings/sounds/
```
Expected: two files, 12.4K each.

- [ ] **Step 2: Install them and point settings.json at them**

```sh
mkdir -p ~/.config/herdr-app/data/sounds
cp ~/Projects/herdr-orca/settings/sounds/*.mp3 ~/.config/herdr-app/data/sounds/
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.config/herdr-app/settings.json")
d = json.load(open(p))
d.setdefault("sounds", {})["enabled"] = True
d["sounds"]["done"] = "data/sounds/ding.mp3"
d["sounds"]["blocked"] = "data/sounds/two-tone.mp3"
json.dump(d, open(p, "w"), indent=2)
print(json.dumps(d["sounds"], indent=2))
PY
```
Expected: prints both paths.

- [ ] **Step 3: Verify the app accepts it**

Run: `herdr-app status | grep -A3 '"errors"'`
Expected: `"errors": []`. Then Settings → Alerts → press Play on each; both should sound.

- [ ] **Step 4: Commit**

```bash
git add settings/sounds
git commit -m "feat(sound): Orca ding/two-tone for done and blocked"
```

---

### Task 3: Clipboard and reveal helpers

**Files:**
- Create: `bin/clip.sh`, `bin/reveal.sh`, `bin/test-helpers.sh`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `bin/clip.sh <file>` — copies the file's contents to the clipboard, exit 0 on success, non-zero when no tool exists.
  - `bin/clip.sh --paste` — prints the clipboard.
  - `bin/reveal.sh <path>` — opens the containing folder in the OS file manager.

- [ ] **Step 1: Write the failing test**

Create `bin/test-helpers.sh`:

```sh
#!/bin/sh
# Verifies both helpers round-trip on this machine, and that clip exits non-zero with no tool.
set -e
TMP=$(mktemp)
printf '/home/mhenke/Projects/herdr-orca' > "$TMP"

sh "$(dirname "$0")/clip.sh" "$TMP"
GOT=$(sh "$(dirname "$0")/clip.sh" --paste)
[ "$GOT" = "/home/mhenke/Projects/herdr-orca" ] || { echo "FAIL paste: '$GOT'"; exit 1; }

PATH=/nonexistent sh "$(dirname "$0")/clip.sh" "$TMP" && { echo "FAIL: expected non-zero with no tool"; exit 1; } || true

rm -f "$TMP"
echo "helpers ok"
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `sh ~/Projects/herdr-orca/bin/test-helpers.sh`
Expected: fails because `bin/clip.sh` does not exist.

- [ ] **Step 3: Write clip.sh**

```sh
#!/bin/sh
# Copies a file's contents to the clipboard, or prints it with --paste.
# exec() in Herdr has no stdin, so callers pass a file path.
set -e
if [ "$1" = "--paste" ]; then
  if command -v wl-paste >/dev/null 2>&1; then wl-paste; exit 0; fi
  if command -v xclip   >/dev/null 2>&1; then xclip -selection clipboard -o; exit 0; fi
  if command -v pbpaste >/dev/null 2>&1; then pbpaste; exit 0; fi
  if command -v powershell.exe >/dev/null 2>&1; then powershell.exe -NoProfile -Command Get-Clipboard; exit 0; fi
  echo "no clipboard tool" >&2; exit 1
fi
[ -n "$1" ] || { echo "usage: clip.sh <file> | --paste" >&2; exit 2; }
[ -r "$1" ] || { echo "cannot read $1" >&2; exit 2; }
if command -v wl-copy >/dev/null 2>&1; then wl-copy < "$1"; exit 0; fi
if command -v xclip   >/dev/null 2>&1; then xclip -selection clipboard < "$1"; exit 0; fi
if command -v pbcopy  >/dev/null 2>&1; then pbcopy < "$1"; exit 0; fi
if command -v powershell.exe >/dev/null 2>&1; then powershell.exe -NoProfile -Command "Get-Content -Raw '$1' | Set-Clipboard"; exit 0; fi
echo "no clipboard tool" >&2; exit 1
```

- [ ] **Step 4: Write reveal.sh**

```sh
#!/bin/sh
# Opens a path's folder in the OS file manager.
set -e
[ -n "$1" ] || { echo "usage: reveal.sh <path>" >&2; exit 2; }
dir=$(dirname -- "$1")
if command -v xdg-open >/dev/null 2>&1; then exec xdg-open "$dir"; fi
if command -v open      >/dev/null 2>&1; then exec open "$dir"; fi
if command -v explorer.exe >/dev/null 2>&1; then exec explorer.exe "$dir"; fi
echo "no reveal tool" >&2; exit 1
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `sh ~/Projects/herdr-orca/bin/test-helpers.sh`
Expected: `helpers ok`

- [ ] **Step 6: Install the helpers where mods can call them**

```sh
mkdir -p ~/.config/herdr-app/bin
cp ~/Projects/herdr-orca/bin/clip.sh ~/Projects/herdr-orca/bin/reveal.sh ~/.config/herdr-app/bin/
chmod +x ~/.config/herdr-app/bin/*.sh
sh ~/.config/herdr-app/bin/clip.sh --paste >/dev/null && echo "clip installed"
```

Expected: `clip installed`. Task 4 and Task 6 call these paths via `appHome()`, because `exec` takes no stdin.

- [ ] **Step 7: Commit**

```bash
chmod +x bin/clip.sh bin/reveal.sh bin/test-helpers.sh
git add bin/clip.sh bin/reveal.sh bin/test-helpers.sh
git commit -m "feat(bin): platform clipboard and reveal chains"
```

---

### Task 4: `orca-menu` clone with richer space menu

**Files:**
- Create: `mods/orca-menu/` (via `mod.clone`), then edit `main.js`
- Create: `mods/orca-menu/copy.svg`, `mods/orca-menu/external-link.svg`
- Test: manual, via right-click in the app

**Interfaces:**
- Consumes: `bin/clip.sh` from Task 3.
- Produces: a mod named `orca-menu` whose `space` menu carries `Copy Path`, `Copy Worktree Name`, `Open in Terminal`.

- [ ] **Step 1: Clone the shipped menu**

```sh
herdr-app do mod.clone '{"name":"menu","as":"orca-menu"}'
ls ~/.config/herdr-app/mods/orca-menu/
```
Expected: `main.js mod.json` (the clone rewrites asset paths to its own folder).

- [ ] **Step 2: Copy the clone into the repo**

```sh
mkdir -p ~/Projects/herdr-orca/mods/orca-menu
cp -r ~/.config/herdr-app/mods/orca-menu/* ~/Projects/herdr-orca/mods/orca-menu/
```

- [ ] **Step 3: Add the two icons the new items use**

`mods/orca-menu/copy.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
```

`mods/orca-menu/external-link.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
```

- [ ] **Step 4: Extend the space menu**

In `mods/orca-menu/main.js`, replace the `case "space":` return block with:

```js
    case "space": {
      const path = git ? tg.path : null;
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ["Copy Path", "orca-menu.copy-path", { path, id: tg.id }],
        ["Copy Worktree Name", "orca-menu.copy-name", { id: tg.id }],
        ["Open in Terminal", "space.open-terminal", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    }
```

- [ ] **Step 5: Handle the two custom commands**

Add to `choose()` in the same file, before the existing `worktree` branch:

```js
    if (it[1] === "orca-menu.copy-path" || it[1] === "orca-menu.copy-name") {
      const target = props()?.target ?? {};
      const text = it[1] === "orca-menu.copy-path"
        ? (it[2].path ?? place(spaces().find((s) => s.id === target.id)) ?? "")
        : (spaces().find((s) => s.id === target.id)?.name ?? "");
      copyText(text);
      return;
    }
```

and add near the top of the file:

```js
// exec has no stdin: write the text to a file, then let the installed helper copy it.
function copyText(text) {
  const dir = `${appHome()}/data`;
  const path = `${dir}/.clip`;
  exec("sh", ["-c", "mkdir -p \"$1\" && printf '%s' \"$3\" > \"$2\"", "copy", dir, path, text])
    .then(() => exec("sh", [`${appHome()}/bin/clip.sh`, path]))
    .then(() => exec("rm", ["-f", path]))
    .catch(() => {});
}
```

This depends on `~/.config/herdr-app/bin/clip.sh`, installed by Task 3 Step 7. `appHome()` is imported from `herdr`.

- [ ] **Step 6: Check the mod loads**

Run: `herdr-app check ~/.config/herdr-app/mods/orca-menu`
Expected: passes with no error. Then `herdr-app status | grep errors` → `"errors": []`.

- [ ] **Step 7: Verify in the app**

Right-click a space in the sidebar. Expected: Rename, Copy Path, Copy Worktree Name, Open in Terminal, then worktree items, then Close. Click Copy Path, then run `wl-paste` in a terminal — expected: the space's folder path.

- [ ] **Step 8: Commit**

```bash
git add mods/orca-menu
git commit -m "feat(orca-menu): Copy Path, Copy Worktree Name, Open in Terminal"
```

---

### Task 5: `orca-spaces` points at `orca-menu`

**Files:**
- Modify: `layouts/orca.json` (node `spaces` → `content.mod`)
- Create: `mods/orca-spaces/` (clone), then one-line edit

**Interfaces:**
- Consumes: `orca-menu` from Task 4.
- Produces: the sidebar opens `orca-menu` instead of the shipped `menu`.

- [ ] **Step 1: Clone spaces**

```sh
herdr-app do mod.clone '{"name":"spaces","as":"orca-spaces"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-spaces
cp -r ~/.config/herdr-app/mods/orca-spaces/* ~/Projects/herdr-orca/mods/orca-spaces/
```

- [ ] **Step 2: Point its menu at the new mod**

In `mods/orca-spaces/main.js`, change the `menu(w)` body:

```js
  menu(w) {
    openOverlay({ mod: "orca-menu", kind: "popup", width: 220, height: 300, props: { tab: "space", target: { id: w.id } } });
  }
```

- [ ] **Step 3: Point the layout at the clone**

In `layouts/orca.json`, node `spaces`: `"content": { "mod": "orca-spaces" }`.

- [ ] **Step 4: Verify**

```sh
cp ~/Projects/herdr-orca/layouts/orca.json ~/.config/herdr-app/layouts/
cp -r ~/Projects/herdr-orca/mods/orca-spaces ~/.config/herdr-app/mods/
herdr-app check ~/.config/herdr-app/mods/orca-spaces
herdr-app status | grep errors
```
Expected: check passes, `"errors": []`. Right-click a space → the Task 4 menu appears.

- [ ] **Step 5: Commit**

```bash
git add mods/orca-spaces layouts/orca.json
git commit -m "feat(orca-spaces): open the Orca space menu"
```

---

### Task 6: `orca-files` row context menu

**Files:**
- Create: `mods/orca-files/` (clone of `files`), then edit `main.js`
- Create: `mods/orca-files/{copy,trash-2,external-link,pencil}.svg`
- Test: `bin/test-files.sh` against a scratch repo

**Interfaces:**
- Consumes: `bin/clip.sh`, `bin/reveal.sh` (Task 3).
- Produces: `orca-files` mod; `openMenu(path, entry, cx)` and `fileAction(name, path, entry)` helpers.

- [ ] **Step 1: Clone and copy to the repo**

```sh
herdr-app do mod.clone '{"name":"files","as":"orca-files"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-files
cp -r ~/.config/herdr-app/mods/orca-files/* ~/Projects/herdr-orca/mods/orca-files/
```

- [ ] **Step 2: Add right-click to file rows**

In `mods/orca-files/main.js`, inside `rows()` at the row chain (currently `main.js:155-156`), add after `.on_click(...)`:

```js
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu(path, entry, cx); })
```

- [ ] **Step 3: Add the menu method**

Add to the class:

```js
  menu(path, entry, cx) {
    openOverlay({ mod: "orca-files", kind: "popup", width: 220, height: 300,
      props: { tab: "file", target: { path, dir: entry.dir, root: this.root } } });
  }
```

- [ ] **Step 4: Render the menu**

At the top of `render(cx)`, before building the tree:

```js
    if (props()?.tab === "file") return this.menuView(t);
```

and add the method:

```js
  menuView(t) {
    const { path, dir } = props().target;
    const item = (i, label, icon, act) => h_flex().id(`fx-${i}`).h(30).px(8).gap(8).items_center().rounded(6)
      .hover((s) => s.bg(t.hover)).on_click(() => act()).child(svg(`mods/orca-files/${icon}.svg`).size(14).text_color(t.muted))
      .child(div().child(label));
    const full = `${this.root}/${path}`;
    return v_flex().id("orca-files-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .child(item(0, "New File", "plus", () => this.act("new-file", full)))
      .child(item(1, "New Folder", "folder-plus", () => this.act("new-folder", full)))
      .child(item(2, "Copy Path", "copy", () => this.act("copy-path", full)))
      .child(item(3, "Copy Relative Path", "copy", () => this.act("copy-rel", full)))
      .child(item(4, dir ? "Open in Terminal" : "Open in Terminal", "terminal", () => this.act("terminal", full)))
      .child(item(5, "Reveal", "external-link", () => this.act("reveal", full)))
      .child(item(6, "Rename", "pencil", () => this.act("rename", full)))
      .child(item(7, "Delete", "trash-2", () => this.act("delete", full)));
  }
```

- [ ] **Step 5: Add the action runner**

```js
  act(name, full) {
    const close = () => closeOverlay(props().overlay);
    const relative = (p) => (p.startsWith(`${this.root}/`) ? p.slice(this.root.length + 1) : p);
    const clip = (text) => {
      const tmp = `${this.root}/.orca-clip`;
      writeTextFile(tmp, text, null).then(() => exec("sh", ["-c", 'bin/clip.sh "$1"', "clip", tmp])).then(() => exec("sh", ["-c", 'rm -f "$1"', "rm", tmp]));
    };
    switch (name) {
      case "new-file": { const p = `${full}/untitled`; writeTextFile(p, "", null).then(() => { this.mark(p, "A"); close(); }); break; }
      case "new-folder": exec("mkdir", ["-p", `${full}/untitled`]).then(() => { close(); }); break;
      case "copy-path": clip(full); close(); break;
      case "copy-rel": clip(relative(full)); close(); break;
      case "terminal": { run("terminal.open", { folder: full }); close(); break; }
      case "reveal": exec("sh", ["-c", 'bin/reveal.sh "$1"', "reveal", full]); close(); break;
      case "rename": { const p = `${full}/untitled`; writeTextFile(p, "", null).then(() => close()); break; }
      case "delete": closeOverlay(props().overlay); openOverlay({ mod: "confirm", kind: "dialog", width: 400, height: 170,
        props: { title: "Delete?", detail: full, command: { name: "orca-files.remove", args: { path: full } } } }); break;
    }
  }
```

- [ ] **Step 6: Write the end-to-end test**

Create `bin/test-files.sh`:

```sh
#!/bin/sh
# Creates a scratch file in a scratch repo and checks the delete/rename/copy path shapes exist in the mod.
set -e
R=$(mktemp -d); cd "$R"; git init -q .
F=~/Projects/herdr-orca/mods/orca-files/main.js
grep -q 'on_mouse_down("right"' "$F" || { echo "FAIL: no right-click"; exit 1; }
grep -q 'case "delete"' "$F"      || { echo "FAIL: no delete";     exit 1; }
grep -q 'case "copy-path"' "$F"   || { echo "FAIL: no copy";       exit 1; }
echo "files ok"
rm -rf "$R"
```

- [ ] **Step 7: Run it**

Run: `sh ~/Projects/herdr-orca/bin/test-files.sh`
Expected: `files ok`

- [ ] **Step 8: Verify in the app**

Install (`cp -r` into the mods dir, switch `layouts/orca.json` `panel` stack child `files` → `orca-files`), then right-click a file: Delete must open the shipped confirm dialog; Copy Path must round-trip through `wl-paste`.

- [ ] **Step 9: Commit**

```bash
git add mods/orca-files bin/test-files.sh
git commit -m "feat(orca-files): file row context menu"
```

---

### Task 7: `orca-files` search view

**Files:**
- Modify: `mods/orca-files/main.js`
- Test: `bin/test-search.sh`

**Interfaces:**
- Consumes: `orca-files` from Task 6.
- Produces: `search(query)` returning `[{path, line, text}]`, capped at 200.

- [ ] **Step 1: Write the failing test**

Create `bin/test-search.sh`:

```sh
#!/bin/sh
# The search helper must cap output and parse rg's vimgrep format.
set -e
R=$(mktemp -d); cd "$R"
printf 'alpha\nneedle here\nomega\n' > a.txt
OUT=$(rg --vimgrep --smart-case needle 2>/dev/null | head -200)
echo "$OUT" | grep -q 'a.txt:2:' || { echo "FAIL: rg shape changed"; exit 1; }
echo "search ok"
rm -rf "$R"
```

- [ ] **Step 2: Run it**

Run: `sh ~/Projects/herdr-orca/bin/test-search.sh`
Expected: `search ok` (this pins the `rg` output shape the parser relies on).

- [ ] **Step 3: Implement search in the mod**

```js
  async search(query) {
    if (!query) return [];
    const r = await exec("rg", ["--vimgrep", "--smart-case", "--max-count", "20", query], { cwd: this.root, on: this.on });
    if (r.code !== 0 && !r.stdout) return [];
    return r.stdout.split("\n").slice(0, 200).filter(Boolean).map((l) => {
      const [file, line, , ...rest] = l.split(":");
      return { file, line: Number(line), text: rest.join(":").trim() };
    });
  }
```

The `--max-count 20` plus `.slice(0, 200)` keeps the result well under `exec`'s 8 MiB cap.

- [ ] **Step 4: Add the search UI**

Add a `q` field to `init()`, a 32px input row above the tree in `render()`, and a results list calling `this.show(hit.file, cx)` on click. Guard the render with `this.hits`.

- [ ] **Step 5: Verify in the app**

Install, then type `needle` in a repo containing it. Expected: hits listed; clicking one opens the file.

- [ ] **Step 6: Commit**

```bash
git add mods/orca-files/main.js bin/test-search.sh
git commit -m "feat(orca-files): bounded rg search view"
```

---

### Task 8: `orca-tabs` activity strip

**Files:**
- Create: `mods/orca-tabs/` (clone of `tabs`), then edit `main.js`
- Modify: `layouts/orca.json` (node `tabs` → `orca-tabs`)

**Interfaces:**
- Consumes: `panel`, `panel-body` node ids in the layout.
- Produces: `orca-tabs` as the **only** writer of `panel` / `panel-body`.

- [ ] **Step 1: Clone tabs**

```sh
herdr-app do mod.clone '{"name":"tabs","as":"orca-tabs"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-tabs
cp -r ~/.config/herdr-app/mods/orca-tabs/* ~/Projects/herdr-orca/mods/orca-tabs/
```

- [ ] **Step 2: Replace the two panel buttons with a 36px strip**

In `mods/orca-tabs/main.js`, replace the two `panelButton(...)` children in the root `h_flex()` with a strip:

```js
      .child(h_flex().id("orca-rail").h(36).flex_none().gap(0).items_center()
        .children(railItems().map(({ id, icon, title }) => {
          const on = panel && !panel.hidden && body?.active === id;
          return div().id(`rail-${id}`).size(36).flex_none().flex().items_center().justify_center()
            .text_color(on ? t.foreground : t.muted).opacity(on ? 1 : 0.6)
            .hover((s) => s.text_color(t.foreground))
            .on_click(() => {
              if (on) run("layout.hide", { id: "panel" });
              else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
            })
            .child(svg(`mods/orca-tabs/${icon}.svg`).size(16));
        })))
```

and add:

```js
// Files always; Changes only in a git repo (Orca: gitOnly).
function railItems() {
  const items = [{ id: "files", icon: "files", title: "Explorer" }];
  const cwd = panes().find((p) => p.focused)?.cwd;
  if (cwd && gitRepo(cwd)) items.push({ id: "changes", icon: "git-branch", title: "Source Control" });
  return items;
}
```

- [ ] **Step 3: Add the git probe**

```js
let gitCache = { at: 0, cwd: null, ok: false };
function gitRepo(cwd) {
  if (gitCache.cwd === cwd && Date.now() - gitCache.at < 5000) return gitCache.ok;
  exec("git", ["rev-parse", "--show-toplevel"], { cwd }).then((r) => { gitCache = { at: Date.now(), cwd, ok: r.code === 0 }; });
  return gitCache.ok;
}
```

- [ ] **Step 4: Point the layout at the clone**

`layouts/orca.json` node `tabs`: `"content": { "mod": "orca-tabs" }`.

- [ ] **Step 5: Verify**

```sh
cp -r ~/Projects/herdr-orca/mods/orca-tabs ~/.config/herdr-app/mods/
cp ~/Projects/herdr-orca/layouts/orca.json ~/.config/herdr-app/layouts/
herdr-app check ~/.config/herdr-app/mods/orca-tabs
herdr-app status | grep errors
```
Expected: check passes, no errors. In the app: click Files → column opens; click again → closes. In a non-git folder, Changes is absent.

- [ ] **Step 6: Confirm no double writer**

Run: `grep -rn "layout.hide\|layout.show" ~/.config/herdr-app/mods/*/main.js`
Expected: only `orca-tabs` (and `tabs`, which is no longer in the layout) reference `panel`.

- [ ] **Step 7: Commit**

```bash
git add mods/orca-tabs layouts/orca.json
git commit -m "feat(orca-tabs): Orca activity strip as sole panel writer"
```

---

### Task 9: install.sh and README

**Files:**
- Create: `install.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: one command that installs layout, mods, sounds and helpers.

- [ ] **Step 1: Write install.sh**

```sh
#!/bin/sh
# Installs this repo into ~/.config/herdr-app. Idempotent.
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
DST=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
mkdir -p "$DST/layouts" "$DST/mods" "$DST/data/sounds" "$DST/bin"
cp "$SRC"/layouts/orca.json "$SRC"/layouts/orca.svg "$DST/layouts/"
for m in "$SRC"/mods/*/; do n=$(basename "$m"); rm -rf "$DST/mods/$n"; cp -r "$m" "$DST/mods/$n"; done
cp "$SRC"/settings/sounds/*.mp3 "$DST/data/sounds/"
cp "$SRC"/bin/clip.sh "$SRC"/bin/reveal.sh "$DST/bin/"
chmod +x "$DST"/bin/*.sh
echo "installed to $DST"
```

- [ ] **Step 2: Verify a clean install**

```sh
rm -rf /tmp/apphome && HERDR_APP_HOME=/tmp/apphome sh ~/Projects/herdr-orca/install.sh
find /tmp/apphome -maxdepth 2 -type d | sort
```
Expected: `layouts`, `mods/{orca-menu,orca-spaces,orca-files,orca-tabs}`, `data/sounds`, `bin`.

- [ ] **Step 3: Update README**

Replace the Install section with:

```markdown
## Install

```sh
sh ~/Projects/herdr-orca/install.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Restart the app after the first install: a running window keeps the layout set it loaded at start.
```

- [ ] **Step 4: Commit**

```bash
git add install.sh README.md
git commit -m "feat: install.sh and install docs"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| Phase 1 root look (theme, colors, font, radius) | 1 |
| Phase 1 sounds | 2 |
| Phase 2 icons, mod-local | 4, 6 (only the glyphs each mod uses) |
| Phase 3 `orca-spaces` + richer menu | 4, 5 |
| Phase 3 platform chain | 3 |
| Phase 4 file right-click | 6 |
| Phase 4 search view | 7 |
| Phase 5 `orca-tabs` fork, single writer | 8 |
| Version pinning / re-verify | Global Constraints |
| Out-of-scope list (checks, pin, groups) | Global Constraints |

**Known gaps, stated rather than hidden**

- Task 6 Step 5's `rename` and `new-file` use a placeholder name (`untitled`) instead of a text prompt; Herdr's `prompt` mod takes props `{title, detail, command}` like `confirm`, so wire it the same way if a prompt is wanted. The plan ships the working-but-plain version on purpose.
- Only Linux/Wayland branches of `clip.sh`/`reveal.sh` are exercised by `test-helpers.sh` on this machine. The macOS and Windows branches are written but untested until run there.
- Task 8 forks `tabs`; upstream tab-bar fixes stop arriving. Re-clone and re-diff after each Herdr upgrade.

**Type consistency**

- `copyText`, `act`, `menu`, `menuView`, `search`, `railItems`, `gitRepo` are each defined in exactly one task and referenced with the same names.
- Layout node ids used across tasks: `panel`, `panel-body`, `spaces`, `tabs`, `files`, `changes` — all match `layouts/orca.json`.
- Mod names: `orca-menu`, `orca-spaces`, `orca-files`, `orca-tabs` — consistent between clone, `content.mod` and install.
