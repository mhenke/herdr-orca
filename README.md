# Herdr Orca

An [Orca](https://github.com/stablyai/orca)-like layout for Herdr App: Orca's three columns, its activity rail, project cards and file menus.

![Herdr Orca](preview.png)

## Philosophy

**Keep the workspace where your hand expects it.**

Orca's shape is one window: a project list on the left, the work in the middle, the repository on the right. Herdr can draw that shape without forking it, so this package is a layout plus four small mods rather than a second application.

Every number here was read from Orca's renderer source, not estimated from a screenshot. The table in [RECIPE.md](RECIPE.md) cites the files.

## Features

- **Three columns at Orca's widths**: left sidebar 280 (min 220, max 500), right panel 350 (min 220, max 900), 1px dividers, square pane corners (radius 0). The center reads flat, as Orca's does.
- **Project cards in the sidebar**: each repo draws Orca's folder glyph in its section header, then one card per worktree titled by its branch, with `primary` on the repo's own checkout. Linked worktrees fold under their checkout. Drag a row to reorder it.
- **Activity rail**: 16px icons at the right of the tab strip, matching Orca's activity bar. Files is always there; Changes appears only in a git repository, which is Orca's `gitOnly` rule. The panel-right button hides the column; the active tool is saved with the layout, not per space.
- **Space menu**: right-click a space for Rename, Copy Path, Copy Worktree Name, Open in Terminal, New/Open/Remove worktree and Close.
- **File row menu**: right-click any file or folder for New File, New Folder, Copy Path, Copy Relative Path, Open in Terminal, Reveal, Rename and Delete. New and Rename ask for the name in place.
- **File search**: a query field above the tree runs `rg` and lists matches by line; click one to open it. Capped at 200 hits.
- **Orca's palettes**: `orca-dark` (Ghostty Default Style Dark, Orca's default) and `orca-light` (Builtin Tango Light), plus Orca's greys for the panels. A mod's `theme()` is the resolved theme as one flat name→colour map (`theme().canvas`, `theme().muted`, `theme().ansi4`); a missing name paints magenta by design. [RECIPE.md](RECIPE.md#colour) gives the file shape and every key.

## Install

By hand: copy `layouts/orca.json` and `layouts/orca.svg` into `~/.config/herdr-app/layouts/`, every `mods/orca-*` folder into `~/.config/herdr-app/mods/`, every `extras/themes/*.json` into `~/.config/herdr-app/themes/`, and merge `keys.json` into yours.

Or run the script, which does all four and merges the key section without touching your other bindings:

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Nothing here needs a restart: `layout.switch` changes the running window, the shown layout file is re-read when it changes, mod edits hot-reload, and a new mod folder is picked up by the running app. If the app is not running, start it after the sync; it opens the layout `layout.switch` saved.

How it should look and behave, and every number's source: [RECIPE.md](RECIPE.md).

## Keys

The layout's own, in the `layout:orca` section of `keys.json` — a `layout:<name>` section applies only while `layouts/<name>.json` shows. `sync.sh` merges them; they win over the same action in `global`.

| Key | Command | Does |
| --- | --- | --- |
| `ctrl-shift-b` | `layout.toggle:sidebar` | Shows or hides the left sidebar |
| `ctrl-shift-e` | `layout.toggle:panel` | Shows or hides the right panel |

Tabs, spaces and panes keep Herdr's own keys (`alt-1`…`alt-9` for spaces, `ctrl-1`…`ctrl-9` for tabs, `alt-h/j/k/l` to move between panes). The activity rail, the space menu and the file menu are mouse-driven.

## Settings

These belong to you, not the package; set them yourself in `settings.json`.

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

Update by pulling and re-running the sync:

```sh
git pull && sh scripts/sync.sh
```

`sync.sh` overwrites the layout, theme and `orca-*` mod files it ships (each destination mod folder is deleted first) and re-merges the key section. Your settings, key bindings outside `layout:orca`, and other mods are untouched. Your own edits to the copied files are lost.

## What it runs

- `orca-spaces`: read-only `git status` / `git rev-parse` / `git remote get-url` in your spaces'
  folders, and watches those repos for changes. It also asks `gh repo view` once per repo (to
  find a fork's parent avatar) and `gh api` for `pulls?head=<owner>:<branch>` once per branch
  (for the review badge; a settled answer is kept for the life of the process). Both are skipped
  on remote machines, and a missing or unauthenticated `gh` just leaves those two things undrawn.
- `orca-files`: `rg --vimgrep` while you type in the search field, and file operations you ask for (create, rename, delete, reveal).
- `orca-menu`: `wl-copy` / `xclip` / `pbcopy` for Copy Path, and `xdg-open` / `open` / `explorer.exe` for Reveal.

**One network request, once per repo.** Group headers show the repo's GitHub owner avatar, as
Orca's `RepoIconGlyph` does (`repository-icon-github.ts`). Orca shows the fork's **parent**
owner (`getRepoUpstream`, `repo-slug-upstream.ts`), keeping the origin only for a renamed fork, and
so does this: the first time a repo is seen, `orca-spaces` fetches
`https://github.com/<owner>.png?size=64` with `curl` and caches it in
`~/.config/herdr-app/avatars/`; every later render reads that file. A failed fetch keeps the
grey Folder icon. No telemetry, no other host.

## Credits and license

`orca-spaces` starts from Herdr App's `spaces` via [herdr-t3](https://github.com/JinJieBeWater/herdr-t3)'s `t3-spaces`; `orca-menu`, `orca-files` and `orca-tabs` start from Herdr App's shipped `menu`, `files` and `tabs`. The layout starts from Herdr App's `main`. Orca's numbers and palettes are [stablyai/orca](https://github.com/stablyai/orca)'s (MIT License, Copyright Orca). Icons are from Herdr App's shipped set. Apache-2.0, as Herdr App.
