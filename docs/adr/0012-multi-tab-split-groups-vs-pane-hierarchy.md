# 0012 — Multi-tab split groups vs single-active-tab pane hierarchy

- **Status**: accepted
- **Date**: 2026-11-09
- **Amends**: [0006](0006-tab-surface-and-actions-port.md) and [0007](0007-terminal-panel-capabilities-and-actions.md)

## Context

In Orca (`~/Projects/orca`), the layout engine is built on a recursive tree of **Tab Groups**
(`TabGroupLayoutNode` and `TabGroup` in `src/shared/tab-types.ts:7-27,49-65`).

Every visible split pane in Orca is an independent `TabGroup` container (`TabGroupPanel.tsx:281-315`),
possessing:
1. Its own attached tab strip (`h-[32px]`, `TAB_GROUP_TAB_STRIP_HEIGHT_PX = 32`, `tab-drop-zone.ts:4`).
2. Its own tab list (`tabOrder: string[]`) and its own active tab (`activeTabId`).
3. An add-tab button (`+`) to open additional tabs *within that specific split pane*.
4. A quick-command button (`TabBarQuickCommandsButton`, `> Command`) and pane controls (`TabGroupPaneActionsMenu`).

When a tab is dragged in Orca, the target panel is divided into distinct zones (`tab-drop-zone.ts:19-88`):
- **Outer 20% bands** (`left`, `right`, `up`, `down`): Resolves to a split. Orca inserts a new
  `TabGroup` split node into the layout tree, moving the dragged tab into that new group
  (`tabs-drop-actions.ts:68-97`).
- **Middle 60% center zone** (`center`): Resolves to a **merge/join**. Orca calls
  `dropUnifiedTab(activeData.unifiedTabId, { groupId: overData.groupId })` (`tab-drag-drop-commit.ts:184-210`),
  which appends the dragged tab to the destination group's `tabOrder` (`tabs-drop-actions.ts:105-143`).
  The target split pane now displays **both tabs** in its header strip, and the source split group
  collapses if empty (`collapseGroupLayout`, `tabs-drop-actions.ts:149-158`).

In user workflows (e.g. dragging tabs to organize side-by-side terminal sessions), a split column
frequently contains multiple tabs (such as two tabs in the right column while the left column has one).
Dropping onto the center moves the tab into that split column without creating a further split.

## The Architectural Gap in Herdr

Herdr's core engine (`herdr-app/src/model.rs:13-40` and `defaults/herdr.d.ts`) is designed around a
completely different hierarchy:

```
Orca:
Worktree
 └── TabGroupLayout (Tree of Splits)
      ├── TabGroup A (Split Left)  ── owns Tab Bar [ Tab 1, Tab 2 ]
      └── TabGroup B (Split Right) ── owns Tab Bar [ Tab 3, Tab 4 ]

Herdr App (model.rs):
Space
 ├── Tabs List (Top Tab Bar: [ Tab 1, Tab 2, Tab 3 ])  <-- Exactly ONE active tab
 └── Active Tab
      └── Pane Tree (Internal Terminal Splits: [ Terminal A | Terminal B ])
```

In Herdr:
1. **Single active tab per space**: A `Space` holds a flat vector of tabs (`Vec<Tab>`), but only **one**
   tab is ever active and rendered at any given time (`space.active: Option<String>`, `model.rs:39`).
2. **Splits belong to the tab, not to groups**: Split panes are nodes in an internal layout tree
   (`tab.root: Node`, `model.rs:17`) belonging to the currently active tab.
3. **Panes cannot own tabs**: A terminal pane in Herdr is strictly a PTY terminal viewport; it has no
   model field for child tabs or a nested tab list.
4. **Tabs cannot sit side-by-side**: Herdr cannot display two distinct `Tab` instances simultaneously.

## Why Multi-Tab Splits and Center-Merge Drops Cannot Exist in Herdr

Because a Herdr split pane cannot own tabs and two Herdr tabs cannot be viewed concurrently:

1. **Center drop join is impossible**: Dropping a tab in the center of a pane cannot join that pane's
   "tab group", because panes in Herdr have no tab group.
2. **Moving a tab to a split destroys its tab identity**: In `herdr-orca`, the only way to display two
   terminals side-by-side is to park the terminal of the dragged tab (`terminal.park`), detaching it from
   its original tab (which closes that tab), and mounting it as a child pane inside the active tab
   (`terminal.keep { place }`, `mods/orca-tabs/main.js:152-205`). The dragged tab disappears from the
   top tab bar and becomes a split pane inside the destination tab.
3. **Multi-tab split columns cannot be preserved**: If a user drags two tabs into a split, they cannot
   remain stacked inside that split column; each split pane is necessarily a single terminal.

Attempting to fake multi-tab splits inside `herdr-orca` would require building a complete virtual window
manager and sub-tab model inside QuickJS mods, conflicting with Herdr's PTY lifecycle, zooming, and focus
routing (`model.rs:20-24`, `commands.rs:40-46`).

## Decision

1. **Acknowledge the boundary honestly**: Document the architectural constraint here and in code
   comments. Never pretend center-drop merge is supported when the host cannot represent it.
2. **Directional outer edge splits**: Retain directional edge splitting (`left`, `right`, `up`, `down`)
   in `mods/orca-tabs/main.js` using Orca's 20% outer edge math (`tab-drop-zone.ts:38-88`), mapping it to
   `terminal.park` + `terminal.keep` + `pane.swap`.
3. **Center drop fallback**: Since Orca's `'center'` drop zone (`tab-drop-zone.ts:19-36`) has no host
   counterpart, `mods/orca-tabs/main.js:272-282` falls back to the nearest edge split rather than a
   dead no-op, preserving the user's intent to view the terminals concurrently.
4. **Header parity without sub-tabs**: In `layouts/orca.json`, configure `pane.header` with Orca's
   attached 32px height and persistent visibility (`"reveal": "always"`), drawing terminal title pills,
   quick commands (`> Command`), and split/close buttons to match Orca's `TabGroupPanel` visual affordance.
5. **Bidirectional unsplit parity**: Provide unsplitting through:
   - Dragging the split pane header handle to the top tab strip area (`y <= 48 * zoom`).
   - The *"Move to New Tab"* context menu action (`SortableTabContextMenu.tsx:42-93`).
   Both trigger `unsplitPaneToTab` (`terminal.park` + `terminal.keep { place: "tab" }`), restoring the
   split pane as an independent top-level tab.

## Consequences

- The visual presentation matches Orca's geometry, spacing, and menu options as closely as GPUI permits.
- Users and agents understand why dropping in the center splits the terminal rather than grouping
  multiple tabs into a single split column.
- Future refactorings will not attempt to implement multi-tab split groups without upstream changes to
  Herdr App's `Model` struct in Rust.
