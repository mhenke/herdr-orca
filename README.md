# Herdr Orca

An Orca-like workspace for Herdr App. It brings Orca's three-column layout straight into Herdr: a 280px left sidebar, a flat terminal work area, a 350px right utility panel, and a 24px status bar across the bottom. Projects organize into collapsible groups with worktree cards for your branches, live agent status marks, and primary checkout badges. Tabs sit flat with full-bleed active underline bars routing into Ghostty-dark terminal panes (or a clean landing view when you close your spaces), while the right activity bar switches between a full file explorer and your Git changes.

![Herdr Orca](preview.png)

## Keep the workspace where your hand expects it

I wanted Orca's layout in Herdr without running a separate app or maintaining a hard fork. Orca's layout just makes sense: projects on the left, your work in the center, repository tools on the right, and a clean status bar along the bottom. 

Herdr can draw that entire workspace natively. We built it using a layout definition and focused mods for each panel. Every number, pixel offset, and color here was pulled straight from Orca's renderer source code rather than guessing from screenshots. If you want to see the exact file and line citations behind every measurement, check out [RECIPE.md](RECIPE.md).

## What's in the box

The layout brings together 16 self-contained mods under `mods/`:

- **Three columns at Orca's geometry**: 280px left sidebar (resizes from 220px to 500px), flexible center work area, and 350px right panel (resizes from 220px to 900px), separated by 1px borders with square pane corners (radius 0).
- **Project cards in the sidebar (`orca-spaces`)**: Repositories group into collapsible folders. Worktrees show up as cards titled by branch, with a `primary` badge on the main checkout. Even if you only open a linked worktree, Herdr discovers the main checkout and keeps it at the top of the group. Linked worktrees indent 18px underneath, and the scrollbar sits in Orca's dedicated gutter so card alignment stays steady.
- **Live agent status rollup**: Herdr tracks four core agent states (working, blocked, done, idle). You'll see turning spinners when an agent is busy, red alert marks when it needs approval or input, and green checkmarks when a run finishes.
- **Activity rail and right panel (`orca-panel-head`)**: A 36px activity bar switches between a full-bleed Files explorer (`orca-files`) with 30+ language icons plus a Names/Contents search filter, and a Changes panel (`orca-changes`) with Git staging, diff views, and an inline commit composer.
- **Flat tab strip (`orca-tabs`)**: Tabs sit flat with a full-width 2px bottom underline on the active tab, program icons, close buttons, and tab color dots that stay in sync with the menu store. We also put the sidebar toggle button right in the tab bar so you can always bring the sidebar back.
- **Hover pane headers (`orca-pane`)**: Hovering over a terminal reveals a slim 24px header with custom tab names, split buttons, zoom toggle, and close.
- **Full-span status bar (`orca-status`)**: A 24px bar running across the full window bottom showing your Git branch, dirty file counter, ahead/behind sync stats, and overall agent status.
- **Quick create dropdown (`new-menu`)**: A 288px dropdown for quickly launching agents (OpenCode, Antigravity, Claude Code, Codex), opening folders, or creating new Git worktrees.
- **Context menus (`orca-menu`)**: Right-click menus for worktrees, project headers, and tabs with full mouse and keyboard navigation (arrow keys, Enter, Space, Home, End, Esc).
- **Palettes that match Orca**: `orca-dark` (Ghostty Default Style Dark) and `orca-light` (Tango Light), plus Orca's grey panel tones.

## How to install

### From Herdr Community
This layout is published directly to Herdr Community:
- **Layout**: Grab it from [herdr.dev/layouts](https://herdr.dev/layouts) (tagged with `herdr-layout`).
- **Standalone Mods**: If you only want specific pieces (like the file explorer or Git staging panel in your own layout), grab them from [mhenke/herdr-orca-mods](https://github.com/mhenke/herdr-orca-mods) on [herdr.dev/mods](https://herdr.dev/mods).

### Manual install or local sync
If you're cloning this repo locally, you can copy the files right into your Herdr directory (`~/.config/herdr-app`):
- `layouts/orca.json` and `layouts/orca.svg` go into `~/.config/herdr-app/layouts/`
- Every folder in `mods/` goes into `~/.config/herdr-app/mods/`
- Theme files in `extras/themes/*.json` go into `~/.config/herdr-app/themes/`
- Merge `keys.json` into your `~/.config/herdr-app/keys.json`

Or run the sync script to handle all of it:

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

You don't need to restart Herdr. `layout.switch` swaps the layout live in your running window, layout edits reload automatically, and mods hot-reload when you save changes. Pretty sweet :-).

## Keyboard shortcuts

These are defined in the `layout:orca` section of `keys.json` and activate whenever the Orca layout is active:

| Key | Command | Action |
| --- | --- | --- |
| `ctrl-shift-b` | `layout.toggle:sidebar` | Toggle the left sidebar on or off |
| `ctrl-shift-e` | `layout.toggle:panel` | Toggle the right utility panel on or off |

All of Herdr's default shortcuts still work as expected (`alt-1` through `alt-9` for spaces, `ctrl-1` through `ctrl-9` for tabs, and `alt-h/j/k/l` to move between panes).

## Settings

Fonts and sounds are up to you. Set them in `~/.config/herdr-app/settings.json`:

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

If you want Orca's notification sounds, grab `ding.mp3` and `two-tone.mp3` from `resources/notification-sounds/` in [stablyai/orca](https://github.com/stablyai/orca) and drop them into `~/.config/herdr-app/data/sounds/`. Geist comes bundled with Herdr, so no font install is needed.

## What it runs under the hood

We keep things lightweight and local:

- `orca-spaces`: Runs read-only `git status`, `git rev-parse`, and `git worktree list --porcelain` to discover worktrees concurrently. It probes `gh` for pull request review numbers and caches what it finds in `localStorage`.
- `orca-files`: Watches folders with `watchFolder` and handles basic file actions (create, rename, delete, reveal). Runs `rg --vimgrep` for content searches.
- `orca-changes`: Handles Git status, diff views, staging, and commits (`git status`, `git diff`, `git add`, `git restore`, `git commit`).
- `orca-status`: Periodically checks branch name and dirty status.
- `orca-menu`: Clipboard support (`wl-copy`, `xclip`, `pbcopy`) and system file reveals (`xdg-open`, `open`, `explorer.exe`).

Every Git command passes `--no-optional-locks -c core.fsmonitor=false` so we never lock your repository index or trigger file watcher feedback loops.

## Releases and the release skill

We follow Semantic Versioning and Keep a Changelog format. Everything is tracked in [CHANGELOG.md](CHANGELOG.md) using `git-cliff` with Conventional Commits.

### Releasing with the `herdr-orca-release` skill
If you're pairing with an AI coding agent (Antigravity, Claude Code, or OpenCode), we have a dedicated release skill bundled in [`.agents/skills/herdr-orca-release/SKILL.md`](.agents/skills/herdr-orca-release/SKILL.md). It walks through verification checks, SemVer versioning, changelog generation, and GitHub release creation.

### Releasing from the command line
You can also run the release script directly:

```sh
# 1. Preview changes and changelog in dry-run mode
./scripts/release.sh --dry-run <version>

# 2. Run checks, update CHANGELOG.md, commit, and tag
./scripts/release.sh <version>

# 3. Push and create a GitHub Release with tarball archives
./scripts/release.sh <version> --push --github-release
```

GitHub Actions (`.github/workflows/release.yml`) builds `.tar.gz` and `.zip` distribution bundles automatically whenever a tag is pushed.

## Verification tests

We built tests to catch regressions and verify that citations match the real Orca codebase:

```sh
# Validate citations against ~/Projects/orca, test syntax, and check all mods
python3 scripts/verify.py

# Optional smoke test (restarts the app and checks for runtime errors in the log)
python3 scripts/verify.py --smoke
```

## Credits and license

Huge thanks to the team at [stablyai/orca](https://github.com/stablyai/orca) for creating Orca (MIT License, Copyright (c) 2026 Lovecast Inc.). Space models and avatars were inspired by [herdr-t3](https://github.com/JinJieBeWater/herdr-t3) (Apache-2.0).

Several mods are derived from Herdr App's shipped mods in `defaults/mods/` (Apache-2.0). Each derived file is marked with its source.

This package is licensed under Apache-2.0, matching Herdr App. Files ported from Orca are MIT-licensed as noted in their headers. See `LICENSE` and `NOTICE`.
