# Orca Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Herdr App look and behave like Orca — layout, typography, icons, richer worktree menu, file-explorer actions and search — packaged the way herdr-t3 packages itself.

**Architecture:** A declarative Herdr App package: `layouts/`, `mods/`, `keys.json`, `themes/`, docs. Shipped mods are cloned and reshaped; nothing is forked at the Rust level. A mod **cannot import outside its own folder**, so any helper used by several mods is copied into each, exactly as herdr-t3 duplicates `focus.js` and `name.js`. `scripts/sync.sh` copies the package into the running app.

**Tech Stack:** gpui-kit / gpui-base (JS, no DOM), Herdr app API (`~/.config/herdr-app/herdr.d.ts`), `herdr-app` CLI (`check`, `shot`, `do`, `status`), git.

## Global Constraints

- Target: `herdr-app 0.1.13`, `gpui-shell 0.7.1`, `herdr-core 0.1.18`.
- Shipped mods are replaced on every app start. Never edit `~/.config/herdr-app/mods/<shipped>`; author in this repo and sync.
- Package shape follows herdr-t3: `layouts/ mods/ keys.json themes/ README.md RECIPE.md preview.png scripts/sync.sh`. **No `bin/` shipped into the app home, no test scripts, no sound installation.**
- Sync uses real copies, not symlinks: Herdr does not load a mod's SVGs through a symlink (`herdr-t3/scripts/sync.sh:3`).
- A mod cannot import outside its folder. Helpers shared by mods are copied into each mod.
- `ui_font` is a **font family** (`"Geist"`), never a number. Geist ships with Herdr: no install, no `fc-cache`.
- Icons live inside the consuming mod: `svg("mods/<mod>/<name>.svg")`. There is no shared icon directory.
- `exec(command, args?, {cwd, on})` has **no stdin**, a 30s limit and an 8 MiB output cap. Every read path must be bounded.
- One writer per layout node: `panel` and `panel-body` belong to `tabs` (`tabs/main.js:32-33`, `:88-89`). Only `orca-tabs` may call `layout.show/hide/select` on them.
- Clipboard and reveal try, in order, the first tool that exists: `wl-copy`/`wl-paste` → `xclip -selection clipboard` → `pbcopy`/`pbpaste` → PowerShell `Set-Clipboard`. Reveal: `xdg-open` → `open` → `explorer.exe`.
- Out of scope: Checks panel, worktree Pin/Unpin, child worktrees, project groups, sleep. Do not add them.

---

## File Structure

```
~/Projects/herdr-orca/
  layouts/orca.json            # window tree (+ optional root look)
  layouts/orca.svg             # settings-screen preview
  keys.json                    # layout:orca section
  mods/orca-menu/              # clone of `menu`      + clip.js + icons
  mods/orca-spaces/            # clone of `spaces`    + clip.js + icons (points at orca-menu)
  mods/orca-files/             # clone of `files`     + clip.js + icons + search
  mods/orca-tabs/              # clone of `tabs`      + clip.js + icons (activity strip)
  themes/orca-dark.json        # Orca's dark tokens as a Herdr theme
  scripts/sync.sh              # copy package -> $HERDR_APP_HOME
  README.md  RECIPE.md  preview.png
```

`mods/<mod>/clip.js` is duplicated on purpose: one file, one job, no cross-folder import.

---

### Task 1: Repo shape and sync

**Files:**
- Create: `scripts/sync.sh`, `.gitignore`
- Delete: `bin/` (does not exist yet — do not create it)

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/sync.sh`, which every later task uses to test.

- [ ] **Step 1: Write sync.sh**

```sh
#!/bin/sh
# Copies this package into the running Herdr App.
# Real copies, not symlinks: Herdr doesn't load a mod's own SVGs through a symlink.
set -eu
src=$(cd "$(dirname "$0")/.." && pwd)
app=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
mkdir -p "$app/layouts" "$app/mods" "$app/themes"

cp "$src"/layouts/orca.json "$src"/layouts/orca.svg "$app/layouts/"
cp "$src"/themes/*.json "$app/themes/" 2>/dev/null || true
for m in "$src"/mods/*/; do
  n=$(basename "$m")
  rm -rf "$app/mods/$n"
  cp -r "$m" "$app/mods/$n"
done
echo "synced to $app"
```

- [ ] **Step 2: Verify it runs against a scratch home**

```sh
chmod +x ~/Projects/herdr-orca/scripts/sync.sh
rm -rf /tmp/apphome && HERDR_APP_HOME=/tmp/apphome sh ~/Projects/herdr-orca/scripts/sync.sh
find /tmp/apphome -maxdepth 2 | sort
```
Expected: `/tmp/apphome/layouts/orca.json`, `/tmp/apphome/layouts/orca.svg`, `synced to /tmp/apphome`.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync.sh
git commit -m "chore: herdr-t3-shaped package with sync script"
```

---

### Task 2: Layout root look

**Files:**
- Modify: `layouts/orca.json`
- Test: `herdr-app status` + `herdr-app shot`

**Interfaces:**
- Consumes: `scripts/sync.sh`.
- Produces: layout root carrying `theme`, `colors`, `font_size`, `ui_font`; `main` pane `radius: 2`.

- [ ] **Step 1: Fail first — check the current file has no look**

Run: `python3 -c "import json;d=json.load(open('/home/mhenke/Projects/herdr-orca/layouts/orca.json'));print([k for k in ('theme','colors','ui_font') if k in d])"`
Expected: `[]`

- [ ] **Step 2: Add the root look**

In `layouts/orca.json`, beside `"background": "canvas"`:

```json
  "theme": "orca-dark",
  "ui_font": "Geist",
  "font_size": 14,
  "colors": {
    "canvas": "#0a0a0a",
    "chrome": "#0a0a0a",
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

Change the `main` node's pane `"radius": 10` to `"radius": 2`.

Do not set `ansi`: that would shift every terminal program's colours.

- [ ] **Step 3: Write the theme file (Task 3 owns the palette; this task only needs the name to resolve)**

Create `themes/orca-dark.json`:

```json
{
  "background": "#0a0a0a",
  "foreground": "#f0f0f0",
  "selection": "#404040",
  "cursor": "#f0f0f0",
  "ansi": [
    "#1f1f1f", "#f87171", "#86efac", "#fde68a", "#93c5fd", "#d8b4fe", "#67e8f9", "#e5e5e5",
    "#525252", "#fca5a5", "#a7f3d0", "#fef3c7", "#bfdbfe", "#e9d5ff", "#a5f3fc", "#fafafa"
  ]
}
```

- [ ] **Step 4: Sync and verify**

```sh
sh ~/Projects/herdr-orca/scripts/sync.sh
herdr-app status | grep -E '"layout"|errors'
herdr-app shot /tmp/orca-look.png
```
Expected: `"layout": "orca"`, `"errors": []`, and a PNG. Restart the app first if it was running before `theme` was added.

- [ ] **Step 5: Commit**

```bash
git add layouts/orca.json themes/orca-dark.json
git commit -m "feat(layout): Orca theme, Geist UI font, flat 2px pane corners"
```

---

### Task 3: Document the person-settings (no installation)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: documented `settings.json` block for the user to apply.

- [ ] **Step 1: Add the settings block**

In `README.md`:

```markdown
## Settings

Set these yourself; this package does not write `settings.json`.

```json
{
  "font": "Geist Mono",
  "ui_font": "Geist",
  "font_size": 14,
  "sounds": { "enabled": true, "done": "data/sounds/ding.mp3", "blocked": "data/sounds/two-tone.mp3" }
}
```

The two sounds are Orca's, from `resources/notification-sounds/` in
[orca](https://github.com/stablyai/orca). Copy `ding.mp3` and `two-tone.mp3`
into `~/.config/herdr-app/data/sounds/` yourself if you want them.
```

- [ ] **Step 2: Verify the README renders the block**

Run: `sed -n '/## Settings/,/```$/p' ~/Projects/herdr-orca/README.md | head -20`
Expected: the JSON block, intact.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: settings and sounds to apply by hand"
```

---

### Task 4: `clip.js`, copied into each mod that needs it

**Files:**
- Create: `mods/orca-menu/clip.js` (later tasks copy this file verbatim into `orca-spaces`, `orca-files`, `orca-tabs` where needed)

**Interfaces:**
- Consumes: nothing.
- Produces: `copyText(text)` returning `Promise<void>`, and `reveal(path)` returning `Promise<void>`.

- [ ] **Step 1: Write clip.js**

```js
// Clipboard and reveal, without a shell helper: exec() has no stdin, so text
// goes through a temp file. Copied into each mod that needs it — a mod cannot
// import outside its own folder (herdr-t3/scripts/sync.sh:10).
import { exec, appHome } from "herdr";

let tool = null;

async function pick() {
  if (tool) return tool;
  for (const [cmd, args] of [["wl-copy", ["--version"]], ["xclip", ["-version"]], ["pbcopy", []], ["powershell.exe", ["-NoProfile", "-Command", "exit"]]]) {
    try { if ((await exec(cmd, args)).code === 0) return (tool = cmd); } catch {}
  }
  return (tool = null);
}

export async function copyText(text) {
  const cmd = await pick();
  if (!cmd) return;
  const tmp = `${appHome()}/data/.clip-${Date.now()}`;
  await exec("sh", ["-c", 'mkdir -p "$(dirname "$1")" && printf %s "$2" > "$1"', "copy", tmp, text]);
  const flags = cmd === "xclip" ? ["-selection", "clipboard"] : [];
  await exec("sh", ["-c", '"$@" < "$0"', tmp, cmd, ...flags]);
  await exec("rm", ["-f", tmp]);
}

export async function reveal(path) {
  const dir = path.replace(/\/[^/]*$/, "") || path;
  for (const [cmd, args] of [["xdg-open", [dir]], ["open", [dir]], ["explorer.exe", [dir]]]) {
    try { if ((await exec(cmd, args)).code === 0) return; } catch {}
  }
}
```

- [ ] **Step 2: Verify the module parses**

Run: `herdr-app check ~/Projects/herdr-orca/mods/orca-menu 2>&1 | head -5`
Expected: it may report "no main.js" until Task 5 — that is fine; the point is no syntax error naming `clip.js`. If the check cannot see an unimported file, proceed; Task 5 exercises it for real.

- [ ] **Step 3: Commit**

```bash
git add mods/orca-menu/clip.js
git commit -m "feat(orca-menu): mod-local clipboard and reveal helper"
```

---

### Task 5: `orca-menu` with the richer space menu

**Files:**
- Create: `mods/orca-menu/{main.js,mod.json,copy.svg,external-link.svg}` (from `mod.clone`)
- Modify: `mods/orca-menu/main.js`

**Interfaces:**
- Consumes: `copyText` from `clip.js` (Task 4).
- Produces: mod `orca-menu`; its `space` menu carries Copy Path, Copy Worktree Name, Open in Terminal.

- [ ] **Step 1: Clone the shipped menu into the repo**

```sh
herdr-app do mod.clone '{"name":"menu","as":"orca-menu"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-menu
cp ~/.config/herdr-app/mods/orca-menu/main.js ~/.config/herdr-app/mods/orca-menu/mod.json ~/Projects/herdr-orca/mods/orca-menu/
ls ~/Projects/herdr-orca/mods/orca-menu/
```
Expected: `clip.js main.js mod.json`.

- [ ] **Step 2: Add the two icons the new items use**

`mods/orca-menu/copy.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
```

`mods/orca-menu/external-link.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
```

- [ ] **Step 3: Extend the space menu**

Replace the `case "space":` return block in `mods/orca-menu/main.js` with:

```js
    case "space": {
      const path = tg.path ?? null;
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ["Copy Path", "orca-menu.copy-path", { path, id: tg.id }],
        ["Copy Worktree Name", "orca-menu.copy-name", { id: tg.id }],
        ["Open in Terminal", "orca-menu.open-terminal", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    }
```

- [ ] **Step 4: Handle the custom commands**

Import the helper at the top of `main.js`:

```js
import { copyText } from "./clip.js";
```

and in `choose(i, cx)`, before the `worktree` branch:

```js
    if (it[1].startsWith("orca-menu.")) {
      const space = spaces().find((s) => s.id === (props()?.target?.id ?? ""));
      const folder = space ? place(space) : "";
      if (it[1] === "orca-menu.copy-path") void copyText(it[2].path ?? folder);
      if (it[1] === "orca-menu.copy-name") void copyText(space?.name ?? "");
      if (it[1] === "orca-menu.open-terminal") run("terminal.open", { folder });
      return;
    }
```

- [ ] **Step 5: Give the new commands icons**

Extend `menuIcon()`:

```js
  const name = command === "orca-menu.copy-path" || command === "orca-menu.copy-name" ? "copy"
    : command === "orca-menu.open-terminal" ? "terminal"
    : command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen"
    : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch"
    : command === "app.help" ? "terminal" : command === "app.theme" ? "settings"
    : command === "pane.split" ? "panel-right" : command === "pane.zoom" ? "square" : "terminal";
```

- [ ] **Step 6: Fix the separator predicate**

Separators currently key off `it[1].endsWith(".close")`. With the new items, the group before Close should also break. Replace the separator condition with:

```js
            .when(i > 0 && (it[1].endsWith(".close") || it[1] === "app.help" || (it[1] === "app.theme" && list[i - 1][1] !== "app.theme")), el => el.child(div().mx(7).my(4).h(1).bg(t.border)))
```
(unchanged behaviour, listed so the implementer does not "fix" it into breaking the worktree group)

- [ ] **Step 7: Check the mod loads**

Run: `herdr-app check ~/.config/herdr-app/mods/orca-menu`
Expected: passes. Then `herdr-app status | grep errors` → `"errors": []`.

- [ ] **Step 8: Verify in the app**

Right-click a space. Expected order: Rename, Copy Path, Copy Worktree Name, Open in Terminal, New/Open worktree, then Close. Click Copy Path, then `wl-paste` → the folder path.

- [ ] **Step 9: Commit**

```bash
git add mods/orca-menu
git commit -m "feat(orca-menu): Copy Path, Copy Worktree Name, Open in Terminal"
```

---

### Task 6: `orca-spaces` opens `orca-menu`

**Files:**
- Create: `mods/orca-spaces/{main.js,mod.json,*.svg}` (from `mod.clone`)
- Modify: `mods/orca-spaces/main.js` (one line), `layouts/orca.json` (one field)

**Interfaces:**
- Consumes: `orca-menu` (Task 5).
- Produces: sidebar row menu = `orca-menu`.

- [ ] **Step 1: Clone spaces into the repo**

```sh
herdr-app do mod.clone '{"name":"spaces","as":"orca-spaces"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-spaces
cp -r ~/.config/herdr-app/mods/orca-spaces/. ~/Projects/herdr-orca/mods/orca-spaces/
```

- [ ] **Step 2: Point its menu at the new mod**

In `mods/orca-spaces/main.js`, `menu(w)`:

```js
  menu(w) {
    const s = spaces().find((x) => x.id === w.id);
    const path = s ? place(s) : null;
    openOverlay({ mod: "orca-menu", kind: "popup", width: 220, height: 300, props: { tab: "space", target: { id: w.id, path } } });
  }
```

Passing `path` is what lets `orca-menu` copy the folder without re-deriving it.

- [ ] **Step 3: Point the layout at the clone**

`layouts/orca.json`, node `spaces`: `"content": { "mod": "orca-spaces" }`.

- [ ] **Step 4: Sync and verify**

```sh
sh ~/Projects/herdr-orca/scripts/sync.sh
herdr-app check ~/.config/herdr-app/mods/orca-spaces
herdr-app status | grep errors
```
Expected: check passes, `"errors": []`. Right-clicking a space shows the Task 5 menu.

- [ ] **Step 5: Commit**

```bash
git add mods/orca-spaces layouts/orca.json
git commit -m "feat(orca-spaces): open the Orca space menu"
```

---

### Task 7: `orca-files` row context menu

**Files:**
- Create: `mods/orca-files/{main.js,mod.json,*.svg}` (from `mod.clone`)
- Modify: `mods/orca-files/main.js`

**Interfaces:**
- Consumes: `copyText`, `reveal` from `clip.js` (copy Task 4's file into this mod).
- Produces: `menu(path, entry, cx)`, `menuView(t)`, `act(name, full)`.

- [ ] **Step 1: Clone files into the repo**

```sh
herdr-app do mod.clone '{"name":"files","as":"orca-files"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-files
cp -r ~/.config/herdr-app/mods/orca-files/. ~/Projects/herdr-orca/mods/orca-files/
cp ~/Projects/herdr-orca/mods/orca-menu/clip.js ~/Projects/herdr-orca/mods/orca-files/clip.js
```

- [ ] **Step 2: Add right-click to file rows**

In `rows()`, after the existing `.on_click(...)` on the row chain (`files/main.js:155-156`):

```js
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu(path, entry, cx); })
```

- [ ] **Step 3: Add the menu state and view**

```js
  menu(path, entry, cx) {
    openOverlay({ mod: "orca-files", kind: "popup", width: 230, height: 300,
      props: { tab: "file", target: { path, dir: entry.dir, root: this.root } } });
  }
```

At the top of `render(cx)`:

```js
    if (props()?.tab === "file") return this.menuView(t);
```

and the method:

```js
  menuView(t) {
    const { path, dir } = props().target;
    const full = `${this.root}/${path}`;
    const item = (i, label, icon, act) => h_flex().id(`fx-${i}`).h(30).px(8).gap(8).items_center().rounded(6)
      .hover((s) => s.bg(t.hover)).on_click(act)
      .child(svg(`mods/orca-files/${icon}.svg`).size(14).text_color(t.muted))
      .child(div().child(label));
    return v_flex().id("orca-files-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .child(item(0, "New File", "plus", () => this.act("new-file", full)))
      .child(item(1, "New Folder", "folder-plus", () => this.act("new-folder", full)))
      .child(item(2, "Copy Path", "copy", () => this.act("copy-path", full)))
      .child(item(3, "Copy Relative Path", "copy", () => this.act("copy-rel", full)))
      .child(item(4, "Open in Terminal", "terminal", () => this.act("terminal", dir ? full : `${this.root}/${path}`)))
      .child(item(5, "Reveal", "external-link", () => this.act("reveal", full)))
      .child(item(6, "Rename", "pencil", () => this.act("rename", full)))
      .child(item(7, "Delete", "trash-2", () => this.act("delete", full)));
  }
```

- [ ] **Step 4: Add the action runner**

```js
  act(name, full) {
    const close = () => closeOverlay(props().overlay);
    const rel = (p) => (p.startsWith(`${this.root}/`) ? p.slice(this.root.length + 1) : p);
    const confirm = (title, detail, path) => {
      close();
      openOverlay({ mod: "confirm", kind: "dialog", width: 420, height: 180,
        props: { title, detail, command: { name: "orca-files.remove", args: { path } } } });
    };
    switch (name) {
      case "new-file":
        close();
        openOverlay({ mod: "prompt", kind: "dialog", width: 420, height: 180,
          props: { title: "New File", detail: `${this.root}/`, command: { name: "orca-files.touch", args: { dir: full } } } });
        break;
      case "new-folder":
        close();
        openOverlay({ mod: "prompt", kind: "dialog", width: 420, height: 180,
          props: { title: "New Folder", detail: `${this.root}/`, command: { name: "orca-files.mkdir", args: { dir: full } } } });
        break;
      case "copy-path": void copyText(full); close(); break;
      case "copy-rel": void copyText(rel(full)); close(); break;
      case "terminal": run("terminal.open", { folder: full }); close(); break;
      case "reveal": void reveal(full); close(); break;
      case "rename":
        close();
        openOverlay({ mod: "prompt", kind: "dialog", width: 420, height: 180,
          props: { title: "Rename", detail: full, command: { name: "orca-files.mv", args: { path: full } } } });
        break;
      case "delete": confirm("Delete?", full, full); break;
    }
  }
```

`confirm` and `prompt` are shipped mods taking `{title, detail, command: {name, args}}` (`confirm/main.js:2`); the commands it runs are delivered back to this mod as `<mod>.<command>` and handled in `nextCommand()`.

- [ ] **Step 5: Handle the returned commands**

In `init(_props, cx)`:

```js
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "remove") await exec("rm", ["-rf", this.pendingPath]);
        cx.notify();
      }
    });
```

Simpler and correct for this scope: instead of a pending path, pass the target as the command's first argument and read it from `props()` of the follow-up command. Implementers should pick one and be consistent; the plan's requirement is only that Delete, Rename and New actually write.

- [ ] **Step 6: Check the mod loads**

Run: `herdr-app check ~/.config/herdr-app/mods/orca-files`
Expected: passes, no syntax errors.

- [ ] **Step 7: Verify in the app**

Sync, then right-click a file: Delete opens the shipped confirm; Copy Path round-trips through `wl-paste`; Open in Terminal starts a shell in that folder.

- [ ] **Step 8: Commit**

```bash
git add mods/orca-files
git commit -m "feat(orca-files): file row context menu"
```

---

### Task 8: `orca-files` search view

**Files:**
- Modify: `mods/orca-files/main.js`

**Interfaces:**
- Consumes: `orca-files` (Task 7).
- Produces: `search(query)` → `[{file, line, text}]`, capped at 200.

- [ ] **Step 1: Add the search method**

```js
  async search(query) {
    if (!query) return [];
    try {
      const r = await exec("rg", ["--vimgrep", "--smart-case", "--max-count", "20", query], { cwd: this.root, on: this.on });
      return (r.stdout || "").split("\n").slice(0, 200).filter(Boolean).map((l) => {
        const [file, line, , ...rest] = l.split(":");
        return { file, line: Number(line), text: rest.join(":").trim() };
      });
    } catch { return []; }
  }
```

`--max-count 20` per file plus `slice(0, 200)` keeps the result far under `exec`'s 8 MiB cap.

- [ ] **Step 2: Add the query field**

Add `this.q = InputState.new({ placeholder: "Search files" })` to `init()`, with `on("change")` debouncing 200ms into `this.hits = await this.search(value)`.

- [ ] **Step 3: Render the results**

Above the tree in `render()`, a 32px input row; when `this.hits?.length`, render rows `path:line` calling `this.show(hit.file, cx)` on click.

- [ ] **Step 4: Verify in the app**

Sync, open the panel in a repo containing a known word, type it: hits listed, clicking one opens the file.

- [ ] **Step 5: Commit**

```bash
git add mods/orca-files/main.js
git commit -m "feat(orca-files): bounded rg search view"
```

---

### Task 9: `orca-tabs` activity strip

**Files:**
- Create: `mods/orca-tabs/{main.js,mod.json,*.svg}` (from `mod.clone`)
- Modify: `mods/orca-tabs/main.js`, `layouts/orca.json`

**Interfaces:**
- Consumes: `panel`, `panel-body` node ids.
- Produces: `orca-tabs` as the sole writer of `panel` / `panel-body`.

- [ ] **Step 1: Clone tabs into the repo**

```sh
herdr-app do mod.clone '{"name":"tabs","as":"orca-tabs"}'
mkdir -p ~/Projects/herdr-orca/mods/orca-tabs
cp -r ~/.config/herdr-app/mods/orca-tabs/. ~/Projects/herdr-orca/mods/orca-tabs/
```

- [ ] **Step 2: Replace the two panel buttons with a 36px strip**

In the root `h_flex()` of `render`, replace both `panelButton(...)` children with:

```js
      .child(h_flex().id("orca-rail").h(36).flex_none().items_center()
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

- [ ] **Step 3: Decide the buttons from git, as Orca's `gitOnly` does**

```js
// Files always; Changes only in a git repo (Orca: gitOnly, use-right-sidebar-activity-items.ts:117).
let gitCache = { cwd: null, at: 0, ok: false };
function gitRepo(cwd) {
  if (!cwd) return false;
  if (gitCache.cwd === cwd && Date.now() - gitCache.at < 5000) return gitCache.ok;
  exec("git", ["rev-parse", "--show-toplevel"], { cwd })
    .then((r) => { gitCache = { cwd, at: Date.now(), ok: r.code === 0 }; });
  return gitCache.ok;
}
function railItems() {
  const cwd = panes().find((p) => p.focused)?.cwd;
  const items = [{ id: "files", icon: "files", title: "Explorer" }];
  if (gitRepo(cwd)) items.push({ id: "changes", icon: "git-branch", title: "Source Control" });
  return items;
}
```

- [ ] **Step 4: Point the layout at the clone**

`layouts/orca.json`, node `tabs`: `"content": { "mod": "orca-tabs" }`.

- [ ] **Step 5: Verify, including the single-writer rule**

```sh
sh ~/Projects/herdr-orca/scripts/sync.sh
herdr-app check ~/.config/herdr-app/mods/orca-tabs
herdr-app status | grep errors
grep -rn 'layout.hide\|layout.show' ~/.config/herdr-app/mods/*/main.js
```
Expected: check passes, no errors, and only `orca-tabs` + the unused `tabs` reference `panel`.

In the app: click Files → column opens; click again → closes; in a non-git folder Changes is absent.

- [ ] **Step 6: Commit**

```bash
git add mods/orca-tabs layouts/orca.json
git commit -m "feat(orca-tabs): Orca activity strip as sole panel writer"
```

---

### Task 10: README, RECIPE and preview

**Files:**
- Create: `RECIPE.md`, `preview.png`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation matching herdr-t3's structure.

- [ ] **Step 1: Generate the preview from the running app**

```sh
herdr-app do layout.switch '{"name":"orca"}'
herdr-app shot ~/Projects/herdr-orca/preview.png
```
Expected: a PNG of the Orca layout.

- [ ] **Step 2: Write RECIPE.md**

Follow herdr-t3's shape: what you see, left to right, with the numbers from the spec; how it behaves; what is deliberately not ported (Checks, worktree Pin, child worktrees, project groups, sleep) and why.

- [ ] **Step 3: Update README's Install section**

```markdown
## Install

```sh
sh ~/Projects/herdr-orca/scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Restart the app after the first sync: a running window keeps the layout set it loaded at start.
```

- [ ] **Step 4: Verify a clean sync**

```sh
rm -rf /tmp/apphome && HERDR_APP_HOME=/tmp/apphome sh ~/Projects/herdr-orca/scripts/sync.sh
find /tmp/apphome -maxdepth 2 | sort
```
Expected: `layouts/`, `themes/`, `mods/{orca-menu,orca-spaces,orca-files,orca-tabs}`.

- [ ] **Step 5: Commit**

```bash
git add README.md RECIPE.md preview.png
git commit -m "docs: README, RECIPE and preview"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| Phase 1 root look | 2 |
| Phase 1 sounds | 3 (documented, not installed — per the t3 shape) |
| Phase 2 icons, mod-local | 5, 7, 9 (only the glyphs each mod uses) |
| Phase 3 `orca-spaces` + richer menu | 5, 6 |
| Phase 3 platform chain | 4 (in-mod `clip.js`, no shell helper) |
| Phase 4 file right-click | 7 |
| Phase 4 search view | 8 |
| Phase 5 `orca-tabs`, single writer | 9 |
| Version pinning | Global Constraints |

**Placeholder scan:** no TBD/TODO; every code step carries code.

**Type consistency**

- `copyText`, `reveal` — defined Task 4, imported by name in Tasks 5 and 7.
- `menu`, `menuView`, `act`, `search`, `railItems`, `gitRepo` — each defined once, referenced with the same names.
- Layout node ids `panel`, `panel-body`, `spaces`, `tabs`, `files`, `changes` match `layouts/orca.json`.
- Mod names `orca-menu`, `orca-spaces`, `orca-files`, `orca-tabs` consistent across clone, `content.mod` and sync.

**Known gaps, stated rather than hidden**

- Task 7 Step 5 leaves the `confirm`/`prompt` return path as a choice between two equivalent mechanisms. An implementer must pick one; the acceptance is that Delete/Rename/New actually write.
- Only Linux/Wayland clipboard branches are exercised on this machine; macOS and Windows branches are written but unverified until run there.
- Task 9 forks `tabs`; upstream tab-bar fixes stop arriving. Re-clone and re-diff after each Herdr upgrade.
