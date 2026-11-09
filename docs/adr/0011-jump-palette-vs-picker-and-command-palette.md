# 0011 — Jump Palette vs Picker and Command Palette

- **Status**: proposed (unimplemented specification)
- **Date**: 2026-11-07

> [!NOTE]
> **Implementation Status**: As of 2026-11-09, `mods/orca-palette` has not yet been built.
> `mods/orca-nav/main.js:164` currently opens Herdr's stock `picker` as an interim fallback,
> and `keys.json` does not yet bind `ctrl-p`. The full specification and implementation plan
> are tracked in `docs/superpowers/plans/2026-11-07-orca-palette.md`.

## Context

Herdr App provides two native overlays for discovery and navigation:
1. `picker` (`defaults/mods/picker/main.js`): A dropdown popup from the Terminals layout space chip displaying open spaces and tabs with Herdr's legacy ANSI color badges.
2. `app.palette` (`defaults/frame/palette/main.js`): The native command palette (`ctrl-shift-p`) that searches and runs registered Herdr commands and menu actions.

In Orca, the top-left Search trigger (`SidebarNav.tsx:90-118`) and the primary navigation shortcut (`worktree.palette`, `ctrl-p` / `cmd-p`) open `WorktreeJumpPalette` (`src/renderer/src/components/worktree-jump/WorktreeJumpPalette.tsx`). This modal dialog unifies multiple domains into a single search input:
- Recent and active tabs (terminals and agent sessions, with agent status and owning workspace)
- Workspaces and worktrees (with repository name badge, branch label, and rollup status)
- Quick actions (such as split pane, open terminal, toggle sidebar)
- Workspace creation ("Create workspace '<query>'")

Early versions of `herdr-orca` wired the Search button directly to `run("mod.open", { name: "picker" })`. A future maintainer seeing a third mod (`orca-palette`) will ask why neither Herdr's built-in `picker` nor Herdr's built-in `palette` was used.

## Decision

Build a dedicated, self-contained mod `mods/orca-palette` as a modal dialog overlay (`openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`), wire the `nav-search` trigger to open it, and bind `ctrl-p` to it in `keys.json`.

## Alternatives considered

- **Reuse Herdr's stock `picker` mod.** Rejected: `picker` only lists spaces and tabs, renders with ANSI color swatches contrary to Orca's styling, cannot search or execute quick actions, and cannot offer inline workspace creation.
- **Reuse Herdr's stock `palette` (`app.palette`).** Rejected: `palette` only indexes registered commands and layout switches; it has no concept of workspaces, worktrees, git repositories, or agent tab states.
- **Fork or modify Herdr's stock `picker` in-place.** Rejected: stock mods are rewritten on startup from the binary and shared across all Herdr layouts. Modifying them violates the package contract that `herdr-orca` is a declarative, non-forking package.

## Consequences

- The package ships `mods/orca-palette` with its own self-contained SVGs and search indexing logic.
- `SidebarNav`'s Search row opens `orca-palette` instead of `picker`.
- `keys.json` binds `ctrl-p` to `mod.open:orca-palette` for keyboard access matching Orca's default shortcut.
- `GLOSSARY.md` standardizes the term **Jump palette** and its target types (**Tab target**, **Worktree target**, **Action target**, **Create target**).
