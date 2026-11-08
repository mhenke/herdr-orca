# 0006 — Porting Orca tab capabilities and context actions to Herdr

- **Status**: accepted
- **Date**: 2026-11-07

## Context

Orca's tab surface (`SortableTab.tsx`, `tab-bar-surface.tsx`) and its contextual actions
(`SortableTabContextMenu.tsx`, `TerminalContextMenu.tsx`) define the primary day-to-day workflow
for organizing terminals and agent sessions. They provide five core capabilities:

1. **Move Tab**: Drag-and-drop tab reordering within the tab bar (`@dnd-kit/sortable`), plus moving
   tabs into split column/row tab groups via `TabWorkspaceLayoutMenuSection.tsx` (*"Move Tab to Split"*).
2. **Split Terminal**: Splitting a tab's viewport into multiple concurrent terminal panes right or down
   (`TerminalTabSplitMenuSection.tsx`), zooming/collapsing individual panes (`Minimize2`), and closing
   split panes (`CloseSplitPaneMenuItem.tsx`).
3. **Change Title**: Renaming tabs via double-click inline text edit (`use-sortable-tab-rename.ts`) or
   menu action (*"Change Title"*), while automatically stripping leading status glyphs when an agent
   provider icon is rendered (`agent-title-decoration.ts`).
4. **Tab Color**: Assigning an accent color from a 10-choice palette (`SortableTabContextMenu.tsx:19-80`),
   rendered as an 8px circular dot (`SortableTab.tsx:293-297`).
5. **Tab Lifecycle and Status**: Pinning tabs (`isPinned`, suppressing the close button), displaying live
   agent status indicators (spinner for `working`, checkmark for `done`, question for `blocked`), and
   context menu actions (*"Close"*, *"Close Others"*).

Porting these to Herdr encounters fundamental host architectural differences:

- **Single tab strip per space**: Herdr's data model (`TabInfo` in `herdr-app/defaults/herdr.d.ts`,
  `herdr-app/src/model.rs`) maintains a single flat sequence of tabs per workspace. It does not
  support multi-tabgroup columns where two tabs sit side-by-side in separate tab strips.
- **No native tab color property**: `TabInfo` contains status, indices, names, zoom, and settle state,
  but no `color` field.
- **UI primitives**: Herdr mods render via GPUI elements (`gpui-kit`). There is no DOM hover group
  inheritance (`group-hover`), no native inline `<input>` editing inside tab strip rows, and no
  multi-level nested flyout context submenus in popup overlays.
- **Domain scope**: Orca features such as *"Allow Auto-Close"* (for cloud orchestration workers) and
  *"Continue with Terminal Agent"* (toggling between structured native chat and a terminal) have no
  meaning in Herdr, which is strictly an interactive terminal and agent host.

## Decision

Port the behavior and visual output to Herdr's primitives following Iron Rule 1 (port, do not
transcribe, never invent), bridging host model gaps through honest equivalents.

### 1. Move Tab
- **Drag Reorder**: Implemented in `mods/orca-tabs/main.js:173-178` by tracking pointer press indices
  (`this.pressed = i`) and issuing `tab.move` (`{ id: source.id, index: targetIndex }`) on mouse-up
  over another tab.
- **Menu Reorder**: Implemented in `mods/orca-menu/main.js:124-125` as explicit `"Move Left"` and
  `"Move Right"` rows when the tab is not at the boundary.
- **Split Column Movement**: Omitted. Herdr spaces cannot have multiple tab bars. Panes split *within*
  a tab, not across multiple tab groups.

### 2. Split Terminal
- **Tab Context Menu**: Exposed as top-level rows `"Split Terminal Right"` and `"Split Terminal Down"`
  in `mods/orca-menu/main.js:116-121`, backed by `pane.split` (`commands.md:101`).
- **Pane Context Menu**: Also available by right-clicking directly inside the terminal pane
  (`orca-menu/main.js:67-68`).
- **Close Split Pane**: Ported in `orca-menu/main.js:137, 308-312`. When a tab has multiple panes,
  `"Close Split Pane"` closes all sibling panes and keeps only the focused pane.
- **Expand / Collapse Pane**: Ported in `mods/orca-tabs/main.js:214-225`. Zoomed panes display a 16px
  `Minimize2` button (`mods/orca-tabs/minimize-2.svg`) that invokes `pane.zoom`. A single-tab workspace
  with a zoomed pane also renders the collapse control in the titlebar (`TitlebarMainStrip.tsx:58-69`).

### 3. Change Title
- **Double Click**: Bound on the tab item (`orca-tabs/main.js:173`), opening Herdr's native rename prompt
  via `run("tab.rename", { id: c.id })`.
- **Context Menus**: Ported as `"Change Title"` in the tab context menu (`orca-menu/main.js:138`) and
  `"Set Title…"` / `"Clear Pane Title"` in the pane context menu (`orca-menu/main.js:73-75`).
- **Agent Decoration Stripping**: The tab label strips leading unicode status decorations
  (`stripLeadingAgentTitleDecoration` in `orca-tabs/main.js:8-13`) exactly as Orca's
  `agent-title-decoration.ts` does, preventing duplicate status symbols next to the agent icon.

### 4. Tab Color
- **Palette**: Ported Orca's exact 10-color palette (`SortableTabContextMenu.tsx:19-80`): None,
  Blue (`#3b82f6`), Purple (`#a855f7`), Pink (`#ec4899`), Red (`#ef4444`), Orange (`#f97316`),
  Yellow (`#eab308`), Green (`#22c55e`), Teal (`#14b8a6`), and Gray (`#9ca3af`).
- **Storage**: Persisted out-of-band in `localStorage["tab.colors.v1"]` (`orca-menu/main.js:314-318`).
  The writer lives in the menu; the reader in the tab strip.
- **Context Menu Presentation**: Rendered as a list of selectable rows with active radio marks
  (`● Tab Color: Blue` / `○ Tab Color: Red`), replacing Orca's horizontal swatch row since Herdr's
  popup menu is a vertical keyboard-navigable list.
- **Tab Rendering**: Rendered as an 8px circular dot (`size(8).rounded(4).mr(6).bg(tabColour)`) in
  `mods/orca-tabs/main.js:209-210`, positioned before the collapse and close buttons matching
  `SortableTab.tsx:293-297`.

### 5. Tab Lifecycle and Status
- **Agent Status**: Ported in `orca-tabs/main.js:197-204` using Orca's iconography and colors
  (`TerminalTabLeadingIcon.tsx:38-100`): spinning yellow spinner for `working`, emerald checkmark for
  `done`, orange question icon for `blocked`.
- **Pin / Settle**: Orca's `isPinned` maps to Herdr's `settled` state (`TabInfo.settled`). Settled tabs
  hide the close button (`orca-tabs/main.js:226-235`), and `orca-menu/main.js:129` surfaces this as
  `"Put Tab Away"` / `"Bring Tab Back"`.
- **Close & Close Others**: Implemented in `orca-tabs/main.js:230-235` (revealed on tab hover or when active)
  and `orca-menu/main.js:134, 303-307` (looping over sibling tabs in the space and calling `tab.close`).
- **New Tab Menu**: The `+` button in `orca-tabs/main.js:282` opens `new-menu` (width 288, height 512),
  porting Orca's `tab-bar-surface.tsx:221-232` static create actions.

## Consequences

- **Parity achieved**: Tab moving, terminal splitting, title renaming, tab coloring, agent status
  dots, close behaviors, and new-tab creation match Orca's appearance and operational semantics.
- **Decoupled data storage**: Mod-local storage (`localStorage`) allows full tab color persistence
  without requiring modifications to Herdr's upstream Rust data structures (`TabInfo`).
- **Flat context menus**: Because GPUI popup menus cannot host nested flyout submenus or horizontal
  swatch grids, actions like splits and color choices are surfaced directly in the root context menu.
- **Modal vs inline rename**: Tab renaming uses Herdr's native dialog prompt rather than an in-situ
  DOM text input.
- **Cost**: Tab colors are preserved locally in the web view environment; if local storage is cleared,
  tabs revert to uncolored state.

## Alternatives rejected

- **Inventing a custom multi-tab-bar layout manager**: Attempting to implement Orca's multi-column
  tab groups inside GPUI mods would conflict with Herdr's native workspace switching, keyboard navigation,
  and layout engine.
- **Omitting tab color due to missing host field**: Would create a noticeable visual regression from
  Orca's tab management. Storing the color map in `localStorage` provides full fidelity with zero host
  runtime complexity.
- **Faking submenus with chained popups**: Opening secondary popups on hover introduces race conditions
  and focus trapping issues in GPUI overlays. Flat menu lists maintain reliable keyboard and mouse
  interaction.
