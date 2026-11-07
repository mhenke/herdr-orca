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
| Right panel width | 350 (min 220; this layout caps it at 900) | `startup-ui-hydration.ts:45`, `right-sidebar-width.ts:1` |
| Top band height | 36 in all three columns | `main.css:1072-1074` (`titlebar`), `:1086-1088` (`titlebar-left`), `right-sidebar-top-activity-bar.tsx:40` |
| Status bar | 24, `px-3 gap-4`, `border-t`, `text-xs` | `StatusBarSurface.tsx:121` |
| App canvas | `#0a0a0a` | `main.css:336` (`--background`) |
| Sidebar surface | `#2a2a2a` | `main.css:384` (`--worktree-sidebar`) |
| Panel surface | `#171717` | `main.css:392` (`--sidebar`) |
| Terminal background | `#282c34` | `terminal-themes/defaults.ts:6-12` (Ghostty Default Style Dark) |

Sizes must be written as `"size": { "px": 36 }` (`layout.rs:81-84`, the field at `:324`). A bare `"px": 36` on the node is ignored silently — `Node` has no `px` field, so the node falls back to content size.

## Colour

A mod's `theme()` is the theme JSON `mods.rs:1049` serialises: the **resolved** theme, one flat object mapping colour names to `#rrggbb[aa]` strings (`Theme` at `settings.rs:301`). `t.canvas`, `t.muted`, `t.ansi4` — there is no nested `colors` object and no `ColorTokens` in it. (`apply_theme`, `mods.rs:1110-1131`, separately maps a fixed token list onto `gpui_base::ColorTokens` for `cx.theme()` inside native render code; that is a different view. The old note here claiming mods read it was wrong.)

`themes/<name>.json` is a palette plus overrides (`settings.rs:103-114`): top-level `background`, `foreground`, `selection`, `cursor` (optional) and exactly sixteen `ansi` entries, each `#rrggbb`; optional `colors` map, each value `#rrggbb` or `#rrggbbaa` (`settings.rs:190-215`). The struct denies unknown fields, so any other top-level key makes the theme fail to parse (`settings.rs:105`).

`resolve` turns the palette into names (`settings.rs:306-363`): `background`, `terminal_foreground`, `foreground`, `surface`, `canvas`, `chrome`, `popover`, `raised`, `hover`, `selected`, `border`, `input`, `muted`, `dim`, `accent`, `accent_foreground`, `solid`, `solid_foreground`, `ring`, `selection`, `cursor`, `working`, `blocked`, `done`, `idle`, `unknown` (`settings.rs:326-352`), plus `ansi0`…`ansi15` (`:357-358`). The file's `colors` map is inserted last (`:360-362`), so it replaces any of those names and adds new ones — that is how `extras/themes/orca-dark.json` carries Orca's greys.

A name that does not exist paints **magenta** by design, `hsla(0.83, 1.0, 0.5, 1.0)` (`settings.rs:654-655`). Magenta on screen is a misspelt token, not a styling bug.

The terminal's background is the resolved `background` name (`vt.rs:72`). The theme file's top-level `background` seeds it (`settings.rs:327`), so `extras/themes/orca-dark.json` paints the terminal `#282c34` (`terminal-themes/defaults.ts:6-12`, Ghostty Default Style Dark, Orca's default) — distinct from the chrome `#0a0a0a` (`main.css:336`). A `colors.background` entry overrides the name, because the `colors` map is inserted last (`:360-362`); neither theme in `extras/themes/` changes the terminal background.

The layout names its theme as a string or a `{ "light": …, "dark": … }` pair (`layout.rs:176-183`); `layouts/orca.json` says `"theme": "orca-dark"`. The name resolves to `themes/<name>.json` (`settings.rs:180-188`).

## Left column — `orca-nav`, `orca-spaces`, `orca-chrome`

- **Search** (`SidebarNav.tsx:99-116`) is a *button*, not an input: `openModal('worktree-palette')`. It is drawn as `h-28 px-8 gap-8 rounded-6 bg-foreground/5`, text 13 medium at 60%, icon 16 at 30%. Here it opens Herdr's palette.
- **Nav rows** (`SidebarNav.tsx:130+`) are full-width inside a `px-2 pt-2 pb-1` container, `rounded-md px-2 py-1.5 text-[13px]`, inactive `foreground/60`, hover `foreground/8`. Tasks, Automations and Orca Mobile have no Herdr backing, so they are drawn and inert — stated, not hidden.
- **Projects header** (`SidebarHeader.tsx:61-66`) is `mt-2 h-8 px-2 gap-1.5`; the title is `pl-2 pr-0.5 text-xs semibold muted/80`; actions are `gap-1` of `icon-xs` (24px) buttons with 14px icons at stroke 2.25. Three exist in Orca: a Bell activity toggle (`w-8`), `folder-plus` Add project, `plus` New workspace.
- **Project rows** are two tiers, as in Orca.
  - **Header** (`worktree-list/rows/SectionHeader.tsx:227-340`): `h-7 w-full gap-1.5 pr-2`, a 16px icon slot (`size-4 rounded-[4px]`, glyph `size-3.5`), a `text-[13px] font-semibold leading-4` label, and a `size-5 rounded-md` collapse chevron (`size-3.5`, `-rotate-90` when collapsed) that appears whenever the group has rows. The whole header toggles collapse; only the chevron takes a hover fill (`hover:bg-accent/70`).
  - **Card** (`workspace-card/surface/worktree-card-surface.tsx:56-70`): `ml-1`, single-line `py-2` (36px), `rounded-lg`, active wash `foreground/10` over the sidebar plus a `foreground/18` border (`main.css:1514-1527`). The leading element is a **status lane**, legacy card style (the shipped default: `experimentalNewWorktreeCardStyle: false`) — `shrink-0 flex justify-center items-start pt-[2px]`, no fixed width, holding `StatusIndicator`'s `h-3 w-3` box around an 8px dot. The color follows the host's rollup (`working | blocked | done | idle`), so read `space.status` / `agent.status` rather than re-deriving it.
  - **Primary badge** (`identity/worktree-card-header-items.tsx:193`): `h-[16px] px-1.5 text-[10px] font-medium rounded`, `text-foreground/70 border-foreground/20 bg-foreground/[0.06]`, on the main checkout.
  - Card titles carry the worktree/branch; the project name lives once in the header. Nested cards add `SIDEBAR_TREE_INDENT` (18) so the title lands under the header label (`worktree-list/rows/indentation.ts`).
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

Re-clone the shipped mods these folders started from — `pane`, `tabs`, `files`, `menu` and `spaces` (`orca-spaces` from herdr-t3's `t3-spaces`) — and re-apply the diffs described above. Do not hand-merge: the point of the clone is that the diff stays small enough to redo.

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

`sync.sh` copies `layouts/orca.json` and `layouts/orca.svg`, every `extras/themes/*.json`, and every `mods/orca-*/` folder into `$HERDR_APP_HOME` (`~/.config/herdr-app` by default), deleting each destination mod folder first. It merges `keys.json` by section: a binding in this package's sections replaces the same keystroke in the person's file, and every other key and section is left alone (`scripts/sync.sh`). It never writes `settings.json`.

A key section is named `layout:<layout name>`: the window's key context is `Herdr layout = <name>` (`window.rs:4859`) and `keys.rs:118-125` builds `layout == <name>` from the suffix. This package therefore needs `layout:orca` for `layouts/orca.json`.

Nothing needs a restart. `layout.switch` replaces the chrome in the running window (`window.rs:964-1000`); the shown layout file is re-read when it changes (`window.rs:1002-1034`); an edited mod hot-reloads (`window.rs:3872-3884`); and a new mod folder is found by the recursive watch of `mods/` (`window.rs:3891-3920`, `files.rs:15-33`). If the app is not running, start it after the sync; it opens the layout that `layout.switch` saved.

Settings that belong to the person — fonts, sounds — are documented, never written.
