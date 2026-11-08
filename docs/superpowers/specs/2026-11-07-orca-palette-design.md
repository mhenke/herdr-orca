# Orca Jump Palette Parity for Herdr App — Design Doc

Date: 2026-11-07  
Status: Proposed (Approach A selected)  
Author: Antigravity  

## Intent & The Why

In Orca, the search button in the top-left sidebar ([`SidebarNav.tsx:90-118`](file:///home/mhenke/Projects/orca/src/renderer/src/components/sidebar/SidebarNav.tsx#L90-L118)) triggers `openModal('worktree-palette')`, opening the `WorktreeJumpPalette` modal dialog ([`WorktreeJumpPalette.tsx`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/WorktreeJumpPalette.tsx), [`worktree-jump-palette-surface.tsx`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-surface.tsx)).

In `herdr-orca`, the search button currently calls `run("mod.open", { name: "picker" })` ([`mods/orca-nav/main.js:164`](file:///home/mhenke/Projects/herdr-orca/mods/orca-nav/main.js#L164)), falling back to Herdr App's stock `picker` mod (`defaults/mods/picker/main.js`). This dropdown menu uses legacy ANSI color badges and shows a generic space/tab tree rather than Orca's unified command and workspace jump palette.

The goal is to replace this fallback with a dedicated, self-contained mod `mods/orca-palette` that delivers parity with Orca's `WorktreeJumpPalette`.

---

## Goals, Non-Goals, Anti-Goals

### Goals
- **Self-contained mod (`mods/orca-palette`)**:
  - Implemented as a centered modal dialog overlay opened via `openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`.
  - Self-contained SVG icons inside `mods/orca-palette/` (search, terminal, bot/agent, git-branch, folder, settings, corner-down-left).
- **Orca Visual Parity**:
  - Dark modal styling conforming to `orca-dark` theme: border `rgba(255,255,255,0.08)`, bg `#121212` / `t.chrome`, rounded 8px.
  - Search input with search icon and placeholder: `"Search chats, terminals, workspaces, tasks, settings, and actions..."` ([`worktree-jump-palette-surface.tsx:73`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-surface.tsx#L73)).
  - Section headers (`Recent tabs`, `Workspaces`, `Actions`) or cohesive grouping matching Orca's section model ([`use-worktree-jump-palette-sections.ts:125-188`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/use-worktree-jump-palette-sections.ts#L125-L188)).
  - Row rendering:
    - **Open tabs**: Tab title, owning workspace/repo badge, agent status indicator / agent icon (`SquareTerminal`, `MessageSquare`, or agent icon) ([`worktree-jump-palette-workspace-tab-row.tsx:61-100`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-workspace-tab-row.tsx#L61-L100)).
    - **Workspaces/worktrees**: Status dot (`working`, `blocked`, `done`, `idle`), workspace name, branch name, repo badge ([`worktree-jump-palette-worktree-row.tsx:82-120`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-worktree-row.tsx#L82-L120)).
    - **Quick actions**: Common actions (New Workspace, New Terminal, Split Pane Right/Down, Settings, Toggle Sidebar) ([`worktree-jump-palette-model.ts:54-58`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-model.ts#L54-L58)).
    - **Create workspace**: "Create workspace '<query>'" row when query has text ([`use-worktree-jump-palette-create-action.ts`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/use-worktree-jump-palette-create-action.ts)).
  - Footer bar with keyboard hints: `↵ Open`, `Esc Close`, `↑↓ Move` ([`worktree-jump-palette-surface.tsx:164-175`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-surface.tsx#L164-L175)).
- **Keyboard Navigation**:
  - Search input focused on open (`InputState`, `cx.focus_handle()`).
  - `↑` / `↓` keys move active selection.
  - `Enter` invokes selection:
    - For tab: `space.select` + `tab.select`.
    - For workspace: `space.select` (or `space.new {folder}` if not opened).
    - For action: `run(command, args)`.
    - For create workspace: opens new workspace or worktree prompt.
  - `Esc` closes the overlay via `closeOverlay(props().overlay)`.
- **Integration**:
  - `mods/orca-nav/main.js` search row opens `orca-palette` dialog overlay.
  - `keys.json` binds `ctrl-p` to `openOverlay:orca-palette` or `mod.open:orca-palette`.
  - Package sync via `scripts/sync.sh` installs the new mod.

### Non-Goals
- Linear issue search / remote SSH crawler integration that relies on external server APIs not present in Herdr App.

### Anti-Goals
- Do not invent custom status states; adhere strictly to Herdr's `working | blocked | done | idle` ([AGENTS.md rule 4](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L4)).
- Do not import files from outside `mods/orca-palette/`; all assets and utilities must reside inside the mod directory ([AGENTS.md rule 9](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L9)).

---

## Approaches

### Approach A: Dedicated `mods/orca-palette` Mod (Selected)
- Build a new mod `mods/orca-palette/` with its own `main.js`, self-contained SVG icons, and input handling.
- Wire `orca-nav`'s `nav-search` button to launch it via `openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`.
- Bind keyboard shortcuts in `keys.json`.
- **Trade-offs**: Clean separation, full visual fidelity with Orca, adheres to all Herdr mod standards.

### Approach B: Modifying or Relying on Stock `picker` (Rejected)
- Stock `picker` lives in Herdr App's binary defaults (`defaults/mods/picker/main.js`) and is restored or shared with standard Herdr layouts. Customizing it breaks stock layouts and lacks Orca's multi-entity search index.

---

## Technical Specifications & Architecture

### Mod File Structure
```
mods/orca-palette/
  ├── main.js             # View implementation, search indexing, keyboard handling
  ├── search.svg          # Search icon
  ├── terminal.svg        # Terminal tab icon
  ├── message-square.svg  # Agent tab icon
  ├── git-branch.svg      # Branch icon
  ├── folder.svg          # Workspace icon
  ├── sliders.svg         # Settings icon
  ├── plus.svg            # Create workspace icon
  └── gpui-kit.d.ts       # Types for local checking
```

### Data Sources & Projections
- Workspaces: `spaces()` from `herdr`, enriched with `git.cache.v2` from `localStorage` for repository name, branch, and worktree folder.
- Open Tabs: `space.tabs` across all `spaces()`, cross-referenced with `agents()` for active agent type and status.
- Status Rollup: Uses `space.status` and `agent.status` adhering to Herdr's 4-state vocabulary (`working`, `blocked`, `done`, `idle`).
- Actions: Selected standard commands from Herdr runtime (`tab.new`, `terminal.open`, `pane.split:right`, `pane.split:down`, `layout.toggle:sidebar`, `app.settings`).

### Overlay Lifecycle
- Opened via `openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`.
- When an action is taken or `Esc` is pressed, call `closeOverlay(props().overlay)`.
- Focus is automatically granted to `InputState` on mount.

---

## Verification Plan
1. `node --check mods/orca-palette/main.js` and `herdr-app check orca-palette`.
2. `node --check mods/orca-nav/main.js` and `herdr-app check orca-nav`.
3. Clean installation test: `HERDR_APP_HOME=/tmp/fresh-check bash scripts/sync.sh` to ensure all SVGs and files are self-contained.
4. Visual and interaction verification via `herdr-app shot` or live verification.
