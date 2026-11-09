# 0006 — Porting Orca tab capabilities and context actions to Herdr

- **Status**: accepted (amended by [0007](0007-terminal-panel-capabilities-and-actions.md) §7 and [0012](0012-multi-tab-split-groups-vs-pane-hierarchy.md))
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
- **Drag Reorder**: Implemented in `mods/orca-tabs/main.js` using Orca's hover insertion model
  (`SortableTab.tsx:213`, `tab-drag-drop-commit.ts:116-126`, and `drop-indicator.ts:4-12`). When dragging
  a tab along the strip, `on_mouse_move` evaluates pointer position against tab width to determine the
  insertion side (`left` vs `right`) and renders Orca's 2px blue insertion bar (`#3b82f6`). On release,
  index offsets are computed via Orca's insertion formula:
  `rawInsertIndex = i + (overSide === "right" ? 1 : 0)`,
  `nextIndex = oldIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex`,
  dispatching `run("tab.move", { id, index: nextIndex + 1 })`.
- **Terminal Drop Boundary**: In GPUI, `on_mouse_up` and `on_mouse_move` only fire while the pointer
  is within an element's hitbox (`vendor/gpui-pre/src/elements/div.rs:219`). Because layout blocks enforce
  `overflow_hidden` (`herdr-app/src/window.rs:3988`), dragging a tab down past the 36px tab bar into the
  terminal area leaves the mod's element tree. While standard inter-block DOM pointer capture is unavailable,
  drop-to-split was achieved via a frameless popup overlay window pattern (documented in [0007](0007-terminal-panel-capabilities-and-actions.md) §7
  and [0012](0012-multi-tab-split-groups-vs-pane-hierarchy.md)) which tracks global pointer position,
  rendering 20% edge drop zones and fallback splitting.
- **Menu Reorder**: Implemented in `mods/orca-menu/main.js:150-158` as explicit `"Move Tab to Split Right"`,
  `"Move Tab to Split Left"`, `"Move Tab to Split Down"`, and `"Move Tab to Split Up"` actions.

### 2. Split Terminal
- **Tab Context Menu**: Exposed as top-level rows `"Split Terminal Right"`, `"Split Terminal Left"`,
  `"Split Terminal Down"`, and `"Split Terminal Up"` in `mods/orca-menu/main.js:126-132`, backed by
  `pane.split` and `pane.swap` (`commands.md:101`).
- **Split Menu**: `mods/orca-split-menu/main.js:42-66` provides dedicated directional options and
  hotkeys for all 4 quadrants (`1` right, `2` left, `3` down, `4` up).
- **Pane Context Menu**: Also available by right-clicking directly inside the terminal pane
  (`orca-menu/main.js:67-68`).
- **Close Split Pane**: Ported in `orca-menu/main.js:148, 319-324`. When a tab has multiple panes,
  `"Close Split Pane"` closes all sibling panes and keeps only the focused pane.
- **Expand / Collapse Pane**: Ported in `mods/orca-tabs/main.js:248-260`. Zoomed panes display a 16px
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
- **Storage & Reactivity**: Persisted out-of-band in `localStorage["tab.colors.v1"]` and shared live
  via `setShared("tab.colors", ...)` (`orca-menu/main.js:370-380`). The writer in `orca-menu` notifies
  GPUI views immediately; the reader in `orca-tabs` reads `shared("tab.colors")` reactively.
- **Context Menu Presentation**: Ported Orca's compact circular swatch palette from
  `SortableTabContextMenu.tsx:223-250` (10 circular 16px swatches with active selection indicators and
  tooltips) in `mods/orca-menu/main.js:450-485`.
- **Tab Rendering**: Rendered as an 8px circular dot (`size(8).rounded(4).mr(6).bg(tabColour)`) in
  `mods/orca-tabs/main.js:250-255`, positioned before the collapse and close buttons matching
  `SortableTab.tsx:293-297`.

### 5. Tab Lifecycle and Status
- **Agent Status**: Ported in `orca-tabs/main.js:197-204` using Orca's iconography and colors
  (`TerminalTabLeadingIcon.tsx:38-100`): spinning yellow spinner for `working`, emerald checkmark for
  `done`, orange question icon for `blocked`.
- **Pin / Settle**: Orca's `isPinned` maps to Herdr's `settled` state (`TabInfo.settled`). Settled tabs
  hide the close button (`orca-tabs/main.js:226-235`), and `orca-menu/main.js:167` surfaces this as
  `"Pin Tab"` / `"Unpin Tab"`.
- **Close & Close Others**: Implemented in `orca-tabs/main.js` and `orca-menu/main.js`.
  Closing a tab (via strip `X`, middle-click, or context menu) evaluates Orca's close guard
  (`running-terminal-close-guard.ts:22-34`, `terminal-tab-actions.ts:121-131`):
  - **Idle shells**: Close immediately with no modal friction.
  - **Active work & agents**: Closing a tab with an active agent (`working` or `blocked`) or a running
    command opens Orca's `CloseTerminalDialog.tsx` modal (384px, destructive confirm, checkbox to persist
    `orca.skipCloseTerminalWithRunningProcessConfirm`).
  - **Settled tabs**: Closing a settled tab opens `PinnedTabCloseDialog.tsx` modal, persisting
    `orca.confirmClosePinnedTab`.
  - **Close Others**: Prompts Orca's bulk close confirmation (`bulk-tab-close-confirmation.ts:5-15`)
    and closes unpinned sibling tabs in the space upon confirmation.
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
