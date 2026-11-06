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
cp layouts/orca.json layouts/orca.svg ~/.config/herdr-app/layouts/
cp keys.json ~/.config/herdr-app/            # merge into yours if you have one
herdr-app do layout.switch '{"name":"orca"}'
```

Restart the app after adding a layout file: a running window keeps the set it loaded at start.

Explorer and Source Control are one stack, toggled from the tab bar and remembered per space by the shipped `tabs` mod, which finds the `panel` and `panel-body` nodes by id. Opening either shows the right column; pressing the active one again hides it. `ctrl-shift-b` toggles the left sidebar, `ctrl-shift-e` the right column.

Verified: 280 / 280 columns rendered, panel hidden and shown again, no layout errors.

## What Orca has that this does not

Reverse-engineered from Orca's renderer, and each one is a real gap rather than a styling detail.

| Surface | Orca's right-click / actions |
| --- | --- |
| Worktree row | Update, status, Open in…, Copy Path, Copy Worktree Name, Pin/Unpin, Mark Read/Unread, New group from project, Move to group, New Child Worktree, Open/Remove parent, Sleep (and subtree), Delete (Remove Project on a primary) |
| File row | New File, New Folder, Copy, Copy (Relative) Path(s), Duplicate, Add as Project, Open in Terminal, View File, Open in Orca Browser, Markdown Preview, Download, Collapse Folder, Find in Folder, Open in…, Reveal, Rename, Delete |
| Terminal | Copy, Paste, Select All, Add to chat, Set Title, Clear Screen, Reset Terminal, Copy Pane/Terminal/Session ID, Split Right/Down, Equalize Pane Sizes, Collapse/Expand Pane, Continue in Chat UI, Fork Agent Session |
| Tab | Pin/Unpin, Close, Close Others, Change Title, Tab Color (10 colours) |

Herdr's shipped mods cover a slice of this: `spaces` has a right-click menu (Rename, New worktree, Remove worktree, Open worktree) and the terminal menu has Copy, Paste, Split Right/Down, Zoom, Close. The shipped `files` mod has **no right-click at all**, so the biggest Orca gap is file actions.

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
