# Herdr Orca

An [Orca](https://github.com/stablyai/orca)-like layout for Herdr App: Orca's three columns, its activity rail, project cards and file menus.

![Herdr Orca](preview.png)

## Philosophy

**Keep the workspace where your hand expects it.**

Orca's shape is one window: a project list on the left, the work in the middle, the repository on the right. Herdr can draw that shape without forking it, so this package is a layout plus four small mods rather than a second application.

Every number here was read from Orca's renderer source, not estimated from a screenshot. The table in [RECIPE.md](RECIPE.md) cites the files.

## Features

- **Three columns at Orca's widths**: left sidebar 280 (min 220, max 500), right panel 280 (min 220), 1px dividers, 2px pane corners. The center reads flat, as Orca's does.
- **Project cards in the sidebar**: each space draws its project's mark — the repo's own icon when it has one, else a monogram in a stable color — with its branch and ahead/behind where they matter. Linked worktrees fold under their checkout. Drag a row to reorder it.
- **Activity rail**: 36×36 buttons with 16px icons at the right of the tab strip, matching Orca's activity bar. Explorer is always there; Source Control appears only in a git repository, which is Orca's `gitOnly` rule. Pressing the active one hides the column again; each space remembers its own choice.
- **Space menu**: right-click a space for Rename, Copy Path, Copy Worktree Name, Open in Terminal, New/Open/Remove worktree and Close.
- **File row menu**: right-click any file or folder for New File, New Folder, Copy Path, Copy Relative Path, Open in Terminal, Reveal, Rename and Delete. New and Rename ask for the name in place.
- **File search**: a query field above the tree runs `rg` and lists matches by line; click one to open it. Capped at 200 hits.
- **Orca's palettes**: `orca-dark` (Ghostty Default Style Dark, Orca's default) and `orca-light` (Builtin Tango Light), plus Orca's greys for the panels.

## Install

By hand: copy `layouts/orca.json`, `layouts/orca.svg`, every `mods/orca-*` into `~/.config/herdr-app/`, `extras/themes/*.json` into `~/.config/herdr-app/themes/`, and merge `keys.json` into yours.

Or run the script, which does all four and merges the key section without touching your other bindings:

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Restart the app after the first sync: a running window keeps the layout set it loaded at start. Mod edits reload on save; a new mod folder needs a restart.

How it should look and behave, and every number's source: [RECIPE.md](RECIPE.md).

## Keys

The layout's own, in the `layout:orca` section of `keys.json`. `sync.sh` merges them; they win over the same action in `global`.

| Key | Command | Does |
| --- | --- | --- |
| `ctrl-shift-b` | `layout.toggle:sidebar` | Shows or hides the left sidebar |
| `ctrl-shift-e` | `layout.toggle:panel` | Shows or hides the right panel |

Tabs, spaces and panes keep Herdr's own keys (`alt-1`…`alt-9` for spaces, `ctrl-1`…`ctrl-9` for tabs, `alt-h/j/k/l` to move between panes). The activity rail, the space menu and the file menu are mouse-driven.

## Settings

These belong to you, not the package; it never writes `settings.json`.

Set these yourself; this package does not write `settings.json`.

```json
{
  "font": "Geist Mono",
  "ui_font": "Geist",
  "font_size": 14,
  "sounds": { "enabled": true, "done": "data/sounds/ding.mp3", "blocked": "data/sounds/two-tone.mp3" }
}
```

The two sounds come from Orca's `resources/notification-sounds/` in [stablyai/orca](https://github.com/stablyai/orca); copy `ding.mp3` and `two-tone.mp3` into `~/.config/herdr-app/data/sounds/` yourself.

Geist ships with Herdr, so there is no font install step.

## Update

Herdr does not update mods or layouts from others, and an install never overwrites: adding this again would create `orca-spaces-2`. Update by overwriting:

```sh
git pull && sh scripts/sync.sh
```

Mods reload on save. A layout change needs a restart. Your settings, key bindings outside `layout:orca`, and other mods are untouched. Your own edits to the copied files are lost.

## What it runs

- `orca-spaces`: read-only `git status` / `git rev-parse` in your spaces' folders, and watches those repos for changes.
- `orca-files`: `rg --vimgrep` while you type in the search field, and file operations you ask for (create, rename, delete, reveal).
- `orca-menu`: `wl-copy` / `xclip` / `pbcopy` for Copy Path, and `xdg-open` / `open` / `explorer.exe` for Reveal.

No network requests.

## Credits and license

`orca-spaces` starts from Herdr App's `spaces` via [herdr-t3](https://github.com/JinJieBeWater/herdr-t3)'s `t3-spaces`; `orca-menu`, `orca-files` and `orca-tabs` start from Herdr App's shipped `menu`, `files` and `tabs`. The layout starts from Herdr App's `main`. Orca's numbers and palettes are [stablyai/orca](https://github.com/stablyai/orca)'s (MIT License, Copyright Orca). Icons are from Herdr App's shipped set. Apache-2.0, as Herdr App.
