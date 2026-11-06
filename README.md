# herdr-orca

An [Orca](https://github.com/orca-app/orca)-shaped window for Herdr App, reverse-engineered from Orca's renderer source rather than from screenshots.

Orca's three columns map onto Herdr's model with no custom mods: both of its sidebars are stock Herdr panels.

| Orca | Orca source | Here |
| --- | --- | --- |
| Left nav | `components/sidebar/`, `sidebarWidth: 280` | shipped `spaces` + `agents` |
| Explorer | `components/right-sidebar/file-explorer/`, `rightSidebarTab: 'explorer'` | shipped `files` |
| Source control | `right-sidebar/source-control/` | shipped `changes` |
| Center | tab bar + framed panes | shipped `tabs` + `pane` |

## Numbers, from Orca's source

| Thing | Orca | Notes |
| --- | --- | --- |
| Left sidebar | 280px, min 220, max 500 | `ui-slice-agent-actions.ts:48`, `sidebar/index.tsx:47-48` |
| Right sidebar | 280px, min 220 | `right-sidebar-state.ts:41`, `right-sidebar-width.ts:1` |
| Right activity bar | 40px | `RIGHT_SIDEBAR_SIDE_ACTIVITY_BAR_WIDTH` |
| Center minimum | 320px | `RIGHT_SIDEBAR_MIN_NON_SIDEBAR_AREA` |
| Right sidebar default tab | `explorer` | `right-sidebar-state.ts:42` |
| Nav rows | 13px, `px-2 py-1.5`, gap 2, radius 6 | `SidebarNav.tsx:87,97,129` |

The centre 320 minimum is a rule Herdr can't express: it has no "max = window minus sibling" size. Ours caps the panel at 900 instead.

## Install

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

`scripts/sync.sh` copies `layouts/`, `mods/` (once they exist) and `extras/themes/` into `~/.config/herdr-app` as real copies, not symlinks. Restart the app after the first sync: a running window keeps the layout set it loaded at start.

Explorer and Source Control are one stack, toggled from the tab bar and remembered per space by the shipped `tabs` mod, which finds the `panel` and `panel-body` nodes by id. Opening either shows the right column; pressing the active one again hides it. `ctrl-shift-b` toggles the left sidebar, `ctrl-shift-e` the right column.

Verified: 280 / 280 columns rendered, panel hidden and shown again, no layout errors.

## Themes

`extras/themes/` carries Orca's own two terminal palettes, taken from its defaults:

| Theme | Orca's name | Source |
| --- | --- | --- |
| `orca-dark` | Ghostty Default Style Dark | `terminal-themes/defaults.ts` |
| `orca-light` | Builtin Tango Light | same |

The layout follows the system's light or dark mode with `"theme": { "light": "orca-light", "dark": "orca-dark" }`.

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
[Orca](https://github.com/orca-app/orca); copy `ding.mp3` and `two-tone.mp3`
into `~/.config/herdr-app/data/sounds/` yourself.

## Panel-by-panel check against Orca's source

Verified by reading Orca's renderer, not from screenshots. "Herdr" is what exists in Herdr App today.

### Left sidebar

| Orca surface | Orca source | Herdr |
| --- | --- | --- |
| Search (worktree + browser-tab palette) | `SidebarNav.tsx:91` | `picker` mod, `ctrl-shift-k` |
| Tasks | `SidebarTaskNavButton.tsx` (GitHub/GitLab/Jira/Linear) | none. `herdr-tsk` exists only as a **TUI** plugin |
| Automations | `SidebarNav.tsx` `showAutomationsButton` | none |
| Artifacts / Skills / Agent Dashboard | `SidebarNav.tsx` | none |
| Orca Mobile | `SidebarNav.tsx` `showMobileButton` | none |
| Projects (grouped worktrees) | `SidebarHeader.tsx` (`groupBy === 'repo' ? 'Projects' : 'Workspaces'`), `worktree-list/` | `spaces` mod, 280px |
| Agents | `SidebarHeader.tsx` activity view toggle | `agents` mod |

The header's `Projects`/`Workspaces` title is a **groupBy toggle**, not a separate panel.

### Right sidebar activity bar

From `use-right-sidebar-activity-items.ts` and `right-sidebar-panel-content.tsx`. Visibility comes from `right-sidebar-activity-visibility.ts`: `gitOnly` hides in folder workspaces, `folderOnly` shows only there, `sshOnly` needs an SSH host.

| Orca activity | Icon | Shown when | Herdr |
| --- | --- | --- | --- |
| Explorer (files + search views) | Files | always | `files`. No search view |
| Agents (AI vault / session history) | AgentSessionHistoryIcon | always | `agents` is in the left sidebar instead |
| Attached worktrees | Workflow | folder workspaces | none |
| PR Checks | ListChecks | folder workspaces | reviewr (TUI only) |
| Source Control | GitBranch | git repos | `changes` |
| Checks | ListChecks | git repos | reviewr (TUI only) |
| Ports | Plug | SSH host | none |
| Plugin panels | — | `pluginSystemEnabled` | none |

The activity bar is an icon rail whose position is user-set (`top` or `side`, 40px when side) — `activity-bar-position-menu.tsx`.

### Gaps that are real

- **Explorer search**: Orca's explorer has `files` and `search` views (`rightSidebarExplorerView`). Herdr's `files` has no search.
- **Checks / PR Checks**: Orca has them in-app; Herdr's equivalents are `persiyanov.reviewr` in the TUI.
- **Ports, Attached worktrees, plugin panels**: nothing in Herdr.
- **Tasks, Automations, Artifacts, Skills, Mobile, AI vault**: nothing in Herdr.

## Known limits

- Tab colours, worktree parent links, project groups and Sleep have no Herdr equivalent; they'd need a custom mod plus state of their own.
- `files` opens a preview inline instead of opening an editor tab, so Orca's "View File" and editor-tab menu have no counterpart.
- Herdr's layout has no conditional sizing, so min/max are fixed numbers.

## Rebuilding from Orca

The constants above came from:

```sh
cd ~/Projects/orca/src/renderer/src
grep -rn "sidebarWidth\|rightSidebarWidth" store/slices/ui store/slices/editor/actions
grep -rn "MIN_WIDTH\|MAX_WIDTH" components/sidebar components/right-sidebar
grep -rn "ContextMenuItem" components/sidebar components/right-sidebar components/tab-bar components/terminal-pane
```
