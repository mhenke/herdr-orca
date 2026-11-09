# Herdr Orca

An Orca-like workspace for Herdr App. It brings Orca's three-column layout straight into Herdr: a 280px left sidebar, a flat terminal work area, a 350px right utility panel, and a 24px status bar across the bottom. Projects organize into collapsible groups with worktree cards for your branches, live agent status marks, and primary checkout badges. Tabs sit flat with full-bleed active underline bars routing into Ghostty-dark terminal panes (or a clean landing view when you close your spaces), while the right activity bar switches between a full file explorer, your Git changes, and your agent sessions.

![Herdr Orca](preview.png)

## Keep the workspace where your hand expects it

I wanted Orca's layout in Herdr without running a separate app or maintaining a hard fork. Orca's layout just makes sense: projects on the left, your work in the center, repository tools on the right, and a clean status bar along the bottom. 

Herdr can draw that entire workspace natively. We built it using a layout definition and focused mods for each panel. Every number, pixel offset, and color here was pulled straight from Orca's renderer source code rather than guessing from screenshots. If you want to see the exact file and line citations behind every measurement, check out [RECIPE.md](RECIPE.md).

## What's in the box

The layout brings together 18 self-contained mods under `mods/`:

- **Three columns at Orca's geometry**: 280px left sidebar (resizes from 220px to 500px), flexible center work area, and 350px right panel (resizes from 220px to 900px), separated by 1px borders with square pane corners (radius 0).
- **Project cards in the sidebar (`orca-spaces`)**: Repositories group into collapsible folders. Worktrees show up as cards titled by branch, with a `primary` badge on the main checkout. Even if you only open a linked worktree, Herdr discovers the main checkout and keeps it at the top of the group. Linked worktrees indent 18px underneath, and the scrollbar sits in Orca's dedicated gutter so card alignment stays steady.
- **Live agent status rollup**: Herdr tracks four core agent states (working, blocked, done, idle). You'll see turning spinners when an agent is busy, red alert marks when it needs approval or input, and green checkmarks when a run finishes.
- **Activity rail and right panel (`orca-panel-head`)**: A 36px activity bar switches between a full-bleed Files explorer (`orca-files`) with 30+ language icons plus a Names/Contents search filter, a Changes panel (`orca-changes`) with Git staging, diff views, and an inline commit composer, and an Agents panel (`orca-agents`) that lists your live agents above the OMP session history it reads from disk. Click a past session there and it resumes in a new terminal.
- **Flat tab strip (`orca-tabs`)**: Tabs sit flat with a full-width 2px bottom underline on the active tab, program icons, close buttons, and tab color dots that stay in sync with the menu store. Drag a tab along the strip to reorder it, middle-click one to close it, and Herdr asks before it closes a tab that has a live agent or a running command. We also put the sidebar toggle button right in the tab bar so you can always bring the sidebar back.
- **Attached pane headers (`orca-pane`)**: Every terminal carries Orca's 32px attached header: a tab pill with the pane's title and close button, a split-right `+`, a `▷ Command` pill and ellipsis that open the pane menu, split right/down, and close. When a tab holds more than one pane, a 6-dot grip sits in the middle of the header. Drag the header into the tab strip to move that pane into a tab of its own. `ctrl-shift-s` opens the same split choices on their own, including splits for the file browser and the changes panel.
- **Full-span status bar (`orca-status`)**: A 24px bar running across the full window bottom. On the left, provider usage for Antigravity, Claude, Codex and Cursor shows the tightest rate-limit window with a refresh button that re-probes on demand (also every 120s). Maintenance segments on the right cover remote-server updates, app updates, connected hosts, and the floating-workspace toggle, which carries an amber dot while the panel is closed and an agent is waiting on you.
- **Quick create dropdown (`new-menu`)**: A 288px dropdown for quickly launching agents. It lists the agents Herdr's program table knows about, then opens that agent's model list for the ones that report models (Claude, Codex, Gemini and Grok aliases, plus `omp models` and `agy models` for the account-scoped ones). It also opens folders and creates new Git worktrees. OMP needs one entry in your program table before it shows up in this list; `extras/programs.json` holds it.
- **Floating agent panel (`orca-float`)**: `ctrl-alt-a` drops a 920x560 panel in the bottom right that lists every live agent on one 24px line, Orca's agent-row density: state mark, agent mark, name. Click a row and it jumps to that agent, and the `+` in the header opens the agent launcher. Orca floats a whole terminal workspace there, which Herdr cannot do inside a float, so the panel shows the agent sessions Herdr tracks instead.
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
- Icon files in `extras/icons/*.svg` go into `~/.config/herdr-app/icons/`
- Merge `keys.json` into your `~/.config/herdr-app/keys.json`

There is one step the script cannot do for you. `extras/programs.json` adds `omp` to Herdr's program table, and that table is your settings, so nothing writes it. Merge the entry into `~/.config/herdr-app/programs.json` by hand. Without it OMP is missing from the create menu, because that list is built from the program table. The tab strip and the sidebar still draw OMP's bundled mark, since those files live inside the mods.

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
| `ctrl-alt-a` | `orca-float.toggle` | Show or hide the floating agent panel |
| `ctrl-shift-s` | `mod.open:orca-split-menu` | Open the split menu |

`ctrl-shift-s` opens the split menu as a popup. The pane header's 6-dot grip and the right-click menus reach the same splits without a key.

While a terminal has focus, `ctrl-v` pastes the clipboard (`terminal.paste`). That overrides Herdr's default `terminal.paste_image`, which hands `^V` to the program when the clipboard holds no image; Herdr's `ctrl-shift-v` still pastes text as well.

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
- `orca-files`: Watches folders with `watchFolder` and handles file actions (create, rename, duplicate, view, delete, reveal). Runs `rg --vimgrep` for content searches.
- `orca-changes`: Handles Git status, diff views, staging, conflict resolution, and commits (`git status`, `git diff`, `git add`, `git restore`, `git commit`).
- `orca-agents`: Runs `sh` through `exec` in your own environment to list and read OMP's JSONL sessions under `$HOME`, and resumes one with `omp --resume=<path>` in the folder that session recorded. It is the only panel that reads files outside a repository.
- `orca-status`: Probes provider rate-limit usage every 120s (`agy`, Claude, Codex and Cursor credentials) and reads Herdr's update and machine state for its maintenance segments.
- `orca-menu`: Clipboard writes go to GPUI's in-app clipboard and to the host display server (`wl-copy`, `xclip`, `pbcopy`, `powershell.exe`), so copied text pastes inside Herdr and into other programs. File reveals go through the desktop opener (`xdg-open`, `open`, `explorer.exe`).

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
