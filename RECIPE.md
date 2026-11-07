# Recipe — Orca, by hand

What this package builds, left to right, and why each number is what it is. Every figure below was read from Orca's renderer source, not estimated from a screenshot; the file that fixes it is named beside it.

## The window

```
root (column)
  body (row)
    sidebar (column) 280
      brand (block) 36
      nav (column)
        nav-top (block) 168     ← orca-nav
        spaces (block) weight 1 ← orca-spaces
      sidebar-footer (block) 32
    work (column)
      tabs (block) 36           ← orca-tabs
      work-body (row)
        main (block)            ← terminal
        panel (column) 350
          panel-head (block) 36 ← orca-panel-head
          panel-body (stack) weight 1
            files               ← orca-files
            changes             ← orca-changes
  status (block) 24             ← orca-status
```

`status` sits **outside** `body`, so the bar spans the whole window. Orca does the same: `StatusBar` is rendered by `AppRootSurfaces`, not inside a column (`AppRootSurfaces.tsx:183`).

| Figure | Value | Source |
| --- | --- | --- |
| Sidebar width | 280 (min 220, max 500) | `ui-slice-agent-actions.ts:48`, `sidebar/index.tsx:47-48` |
| Right panel width | 350 (min 220) | `startup-ui-hydration.ts:45`, `right-sidebar-width.ts` |
| Top band height | 36 in all three columns | `main.css:1072-1074` (`titlebar`), `:1086-1088` (`titlebar-left`), `right-sidebar-top-activity-bar.tsx:40` |
| Status bar | 24, `px-3 gap-4`, `border-t`, `text-xs` | `StatusBarSurface.tsx:121` |
| Panel surface | `#171717` | `main.css:392` (`--sidebar`) |
| Sidebar surface | `#2a2a2a` | `main.css` (`--worktree-sidebar`) |

Sizes must be written as `"size": { "px": 36 }`. A bare `"px": 36` is ignored silently — the node then falls back to content size.

## Colour

Mods read `theme()` from the **nested `colors` map** in `themes/orca-dark.json`. `apply_theme` (`mods.rs:1109-1126`) maps a fixed token list onto them; a made-up top-level key never arrives. `canvas` is the panel surface (`#171717`), `chrome` is the sidebar (`#2a2a2a`), `background` is the terminal (`#0e1116`).

Adding a token to the JSON is therefore not enough — only the names already in that list take effect.

## Left column — `orca-nav`, `orca-spaces`, `orca-chrome`

- **Search** (`SidebarNav.tsx:99-116`) is a *button*, not an input: `openModal('worktree-palette')`. It is drawn as `h-28 px-8 gap-8 rounded-6 bg-foreground/5`, text 13 medium at 60%, icon 16 at 30%. Here it opens Herdr's palette.
- **Nav rows** (`SidebarNav.tsx:130+`) are full-width inside a `px-2 pt-2 pb-1` container, `rounded-md px-2 py-1.5 text-[13px]`, inactive `foreground/60`, hover `foreground/8`. Tasks, Automations and Orca Mobile have no Herdr backing, so they are drawn and inert — stated, not hidden.
- **Projects header** (`SidebarHeader.tsx:61-66`) is `mt-2 h-8 px-2 gap-1.5`; the title is `pl-2 pr-0.5 text-xs semibold muted/80`; actions are `gap-1` of `icon-xs` (24px) buttons with 14px icons at stroke 2.25. Three exist in Orca: a Bell activity toggle (`w-8`), `folder-plus` Add project, `plus` New workspace.
- **Project rows** (`worktree-card-surface.tsx:76-86`) are `rounded-lg`, `ml-1`, `py-2` for a single line, with the active wash `foreground/10` over the sidebar plus a `foreground/18` border (`main.css:1514-1527`). The leading element is a **status lane** (`mr-1 w-5`), not a lettered avatar; `RepoChip` is a separate `h-4` pill shown only when the repo isn't already the name.
- **Brand bar** (`TitlebarLeftControls.tsx`) uses a 16px logo at `opacity .75` with `margin 0 4px 0 10px`, then 14px icon buttons at `p-4 rounded-4` (`.titlebar-logo`, `.titlebar-icon-button`).

## Middle column — `orca-tabs`

Tabs are flat, not pills: `h-full px-1.5 text-xs` (`SortableTab.tsx:214`), active `bg-tab-active` = `--card` `#171717`, inactive = `foreground` at 4% over the card (`drop-indicator.ts:15-22`), and the active indicator is `inset-x-0 bottom-0 h-[2px]`, full width, not an inset bar.

The sidebar toggle lives here, outside the sidebar, because Orca's sits in the titlebar (`TitlebarLeftControls.tsx`). Hiding the sidebar must never remove the only way to bring it back.

## Right column — `orca-panel-head`, `orca-files`, `orca-changes`

- **Activity bar** (`activity-bar-buttons.tsx:145-177`): `h-[36px] w-9` flat buttons, icon 16, inactive `muted-foreground/60` brightening on hover with **no fill**, active `foreground` plus `bottom-0 left-[25%] right-[25%] h-[2px] bg-foreground`. Changes is hidden outside a git work tree, which is Orca's `gitOnly` rule.
- **File filter** (`FileExplorerNameFilter.tsx:23`): `h-8 rounded-md border border-border bg-input/50 px-2`, `ListFilter` at 14px, placeholder **Find files**, `text-xs`. The inner input must be transparent and the row clipped, or it paints square corners over the container.
- **Tree rows** (`FileExplorerRow.tsx:147-152`): `w-full gap-1 rounded-sm px-2 py-1 text-xs`, indent `depth * 16 + 8`. Rows are full-bleed — without `w_full()` the hover fill stops at the label instead of the column edge.
- **Dropdown/menu rows** (`dropdown-menu.tsx:115`): `gap-2 rounded-md px-2.5 py-1 text-[13px] leading-4`, hover `white/14` in dark.

## Why the mods are clones

Herdr replaces shipped mods on every start, so a clone is a snapshot. Every mod here is prefixed `orca-` and the layout references **only** `orca-*` names: Herdr filters a layout out of the layout list if it names a mod folder that isn't installed (`missing_mods`, `window.rs:172,212`). `orca-pane` exists for that reason — it is the shipped `pane` header, copied, so the center column has no external dependency.

Icons are copied into each mod that uses them. A mod cannot read outside its own folder, so a shared `mods/workspace-chrome/search.svg` path would break on a clean install.

## After a Herdr upgrade

Re-clone `pane`, `tabs`, `files`, `spaces` and re-apply the diffs described above. Do not hand-merge: the point of the clone is that the diff stays small enough to redo.

## What is deliberately not ported

| Orca | Why not |
| --- | --- |
| Checks panel | Needs a new mod over `gh`; a separate decision |
| Dialogs' frame | Herdr draws overlay frames itself; a mod can suppress (`frame: "none"`) but not restyle them |
| Project → branch → agent nesting | Herdr's model is space → tab → pane |
| Worktree pin/unpin | `terminal.pin` pins a terminal, not a worktree |
| Orca Mobile, remote servers, cloud VMs, Sleep | Different product, no equivalent |

## Applying it

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Restart after the first sync: a running window keeps the layout set it loaded at start. Settings that belong to the person — fonts, sounds — are documented, never written.
