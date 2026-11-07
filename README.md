# Herdr Orca

An [Orca](https://github.com/stablyai/orca)-like workspace layout for [Herdr App](https://herdr.dev): Orca's distinctive three columns, collapsible project worktree hierarchy, activity rail, flat tabs, file explorer, Git changes inspector, and bottom status bar.

![Herdr Orca](preview.png)

## Philosophy

**Keep the workspace where your hand expects it.**

Orca's shape is one cohesive window: a project list on the left, the work in the middle, the repository on the right, and a unified status bar along the bottom. Herdr draws that entire shape natively without forking it, combining the layout definition with focused mods for each panel.

Every figure and measurement was read directly from Orca's renderer source code, not estimated from screenshots. Full specifications and source citations are detailed in [RECIPE.md](RECIPE.md).

## Features

- **Three columns at Orca's widths**: left sidebar 280 (min 220, max 500), right panel 350 (min 220, max 900), 1px dividers, square pane corners (radius 0). The center reads flat, as Orca's does.
- **Project cards in the sidebar**: repositories organize into collapsible groups with folder glyphs. Worktrees render as cards carrying branch identities, with `primary` badges on main checkouts. Linked worktrees nest under their checkout.
- **Agent status indicators**: live rollup across cards, tabs, and the status bar using Herdr's 4 priority states (`working`, `blocked`, `done`, `idle`), showing turning spinners, red alert glyphs, or green checkmarks.
- **Activity rail & right panel**: 36px activity bar header with 16px icons. Switches between a full-bleed **Files** tree (with 30+ extension icons and a live "Find files" filter) and a **Changes** panel (Git staging, diff review, and inline commit composer).
- **Flat tab strip**: full-bleed flat tabs with active 2px bottom underline bars, program icons, close buttons, and an integrated sidebar collapse toggle.
- **Full-width status bar**: 24px bar spanning the window bottom with Git branch, dirty file counter, ahead/behind indicators, and active agent execution summaries.
- **Create dropdown**: 288px popover menu for launching agents (OpenCode, Antigravity, Claude Code, Codex), opening folders, or initializing Git worktrees.
- **Context menus**: right-click menus for worktrees, project headers, and tabs with full mouse and keyboard navigation (arrows, Enter, Space, Home, End, Esc).
- **Orca's palettes**: `orca-dark` (Ghostty Default Style Dark, Orca's default) and `orca-light` (Builtin Tango Light), plus Orca's greys for the chrome and panels.

## Install

### Community Distribution
This layout is published under Community on Herdr:
- **Layout**: Available on [herdr.dev/layouts](https://herdr.dev/layouts) via repo topic `herdr-layout`.
- **Standalone Mods**: Individual mods from this package are also distributed at [mhenke/herdr-orca-mods](https://github.com/mhenke/herdr-orca-mods) on [herdr.dev/mods](https://herdr.dev/mods).

### Manual Installation
Copy the files into your Herdr configuration directory (`~/.config/herdr-app`):
- `layouts/orca.json` and `layouts/orca.svg` into `~/.config/herdr-app/layouts/`
- Every folder in `mods/` into `~/.config/herdr-app/mods/`
- Every theme in `extras/themes/*.json` into `~/.config/herdr-app/themes/`
- Merge `keys.json` into `~/.config/herdr-app/keys.json`

Or run the included sync script:

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Nothing requires an app restart: `layout.switch` live-swaps the layout in the running window, edited layout files auto-reload, and mods hot-reload on save.

How it looks, behaves, and every number's source: [RECIPE.md](RECIPE.md).

## Keys

Defined in the `layout:orca` section of `keys.json` — active whenever `layouts/orca.json` is displayed. `sync.sh` merges them into your existing key bindings:

| Key | Command | Does |
| --- | --- | --- |
| `ctrl-shift-b` | `layout.toggle:sidebar` | Shows or hides the left sidebar |
| `ctrl-shift-e` | `layout.toggle:panel` | Shows or hides the right utility panel |

Tabs, spaces, and panes retain Herdr's standard navigation shortcuts (`alt-1`…`alt-9` for spaces, `ctrl-1`…`ctrl-9` for tabs, `alt-h/j/k/l` to move focus between panes).

## Settings

Theme fonts and sounds belong to your environment; configure them in `~/.config/herdr-app/settings.json`:

```json
{
  "font": "Geist Mono",
  "ui_font": "Geist",
  "font_size": 14,
  "sounds": {
    "enabled": true,
    "done": "data/sounds/ding.mp3",
    "blocked": "data/sounds/two-tone.mp3"
  }
}
```

The notification sounds correspond to Orca's `resources/notification-sounds/` in [stablyai/orca](https://github.com/stablyai/orca); place `ding.mp3` and `two-tone.mp3` into `~/.config/herdr-app/data/sounds/`. Geist ships embedded with Herdr.

## Updating

Pull updates and re-sync:

```sh
git pull && sh scripts/sync.sh
```

`sync.sh` updates the layout, themes, and shipped mod folders while preserving your custom settings and personal key bindings outside `layout:orca`.

## What it runs

- `orca-spaces`: runs read-only `git status`, `git rev-parse`, and `git worktree list --porcelain` to discover worktrees. Probes `gh` for pull request review numbers and caches results in `localStorage`.
- `orca-files`: watches workspace directories via `watchFolder` and provides file operations (create, rename, delete, reveal).
- `orca-changes`: runs Git status, diff, staging, and commit operations (`git status`, `git diff`, `git add`, `git restore`, `git commit`).
- `orca-status`: periodically checks local git branch and dirty status.
- `orca-menu`: clipboard integration (`wl-copy` / `xclip` / `pbcopy`) and system file reveals (`xdg-open` / `open` / `explorer.exe`).

All Git executions pass `--no-optional-locks -c core.fsmonitor=false` to ensure locks are never held and file watches are not triggered in loops.

## Credits and License

- Architecture and styling ported from [stablyai/orca](https://github.com/stablyai/orca) (MIT License, Copyright Orca).
- Space models and avatars informed by [herdr-t3](https://github.com/JinJieBeWater/herdr-t3) (Apache-2.0).
- Shipped under the Apache-2.0 License, matching Herdr App.
