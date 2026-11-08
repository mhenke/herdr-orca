# Worked examples behind the AGENTS.md rules

## Rule 1: port behavior with Herdr primitives

- `ProjectsCollapseAllButton` is a Radix `Tooltip` plus `Button`, wrapped in `w-0 opacity-0` until `group-hover/sidebar-header` or `focus-within` reveals it (`ProjectsCollapseAllButton.tsx:32-41`; `SidebarHeader.tsx:61` is the `group/sidebar-header`). Herdr has no CSS descendant selector. An element-level `.on_hover` on the header row is the honest gate: `orca-nav` tracks that row's pointer and mounts the 24px button only then. `focus-within` has no counterpart, because the button is not mounted while hidden.
- Orca reads a persisted `prCache` written by `src/main` IPC. Herdr mods share no process like that, so the cache lives in `localStorage`. The reader stays pure, and the writer runs in the refresh cycle. Orca's layering is kept; its transport is replaced.

## Rule 12: name only real symbols

- `askPr()` does not exist in Orca. The real pair is `lookupPRByBranchName` (`src/main/github/client/lookup/pr-branch-lookup.ts`), which writes the cache, and `readWorkspaceReviewPR` (`src/shared/sidebar-list/workspace-review-facts.ts`), which only reads it. Fetching from render was the bug; the invented name hid it.
- A two-button collapse/expand pair does not exist. Orca has one toggle, `ProjectsCollapseAllButton.tsx`, whose glyph is `allCollapsed ? ChevronsUpDown : ChevronsDownUp` (`:23`) and whose click always toggles (`:51`).
- `gh pr list --head <branch>` silently returns `[]` for `owner:branch`. Orca's primary path is REST: `repos/<owner>/<repo>/pulls?head=<owner>:<branch>&state=all&per_page=10` (`getRestPRForBranch`), with `pullRequestMatchesHeadRepository` rejecting a mismatched head. The unscoped form matches a fork's same-named branch.

## Rule 11: verify before calling a capability blocked

Pointer injection was once wrongly reported as blocked by Wayland. The session runs Hyprland, and `hyprctl clients` sees the window. What failed was `xdotool` (X11) and an assumed `/dev/uinput` path: the wrong tools, not a blocked system.

## Rule 2: the graph is not the Input source

The typings say `Input.new(state)` takes a state. Only `vendor/gpui-kit/crates/base/src/input/input/mod.rs` settles whether swapping that state across renders rebinds: `Input` is a `RenderOnce` holding `Entity<InputState>`, taken from the element value on every render.

## Redesign examples (principle skill)

- **Wrong place.** Agent status moved out of Orca's pane title into a bottom-right overlay. Deleting it from the header "fixed" the extra element and silently lost the status. The requirement was "put it where Orca puts it".
- **Wrong region.** The explorer toolbar was missing because the band was never in the tree; patching the filter row could not add it.
- **Wrong owner.** Two mods drew the same activity bar (titlebar and right panel). Restyling one left two on screen.
- **Wrong layer.** A scrollbar painted over the rows because the scroll container owned it. No inset fixes that; the bar must be a sibling in its own gutter.
