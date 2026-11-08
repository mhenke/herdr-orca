# Orca Jump Palette Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide parity with Orca's top-left search functionality by implementing a dedicated `mods/orca-palette` modal overlay that searches open tabs, workspaces, quick actions, and offers workspace creation.

**Architecture:** A self-contained Herdr mod `mods/orca-palette` registered as a modal dialog overlay (`openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`). It projects open tabs and workspaces from `spaces()`, `agents()`, and `git.cache.v2`, filters and ranks results dynamically against query input, handles full keyboard navigation (`↑`/`↓`/`Enter`/`Esc`), and integrates with `mods/orca-nav/main.js` and `keys.json`.

**Tech Stack:** gpui-kit, gpui-base, Herdr API (`herdr`), Node.js for syntax checks and unit tests, `herdr-app` CLI for mod validation.

**Spec:** [`docs/superpowers/specs/2026-11-07-orca-palette-design.md`](file:///home/mhenke/Projects/herdr-orca/docs/superpowers/specs/2026-11-07-orca-palette-design.md)

## Global Constraints

- **Self-contained mod:** A mod is self-contained. `svg()` resolves under appHome and cannot read outside the mod folder. Copy every icon into the mod ([AGENTS.md rule 9](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L9)).
- **Herdr owns status:** Vocabulary is strictly `working | blocked | done | idle` ([AGENTS.md rule 4](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L4)).
- **Cite Orca sources in edit comments:** Cite Orca file and line for port behavior ([AGENTS.md rule 1](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L1)).
- **Package shape parity:** Sync uses real copies, never symlinks ([AGENTS.md Package shape](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L78)).
- **Single-call cx:** Do not store `this.cx = cx` ([AGENTS.md rule 13](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L13)).

## Review Focus

1. **Empty query display:** When opened with no input text, the palette must display recent open tabs and active workspaces rather than an empty list ([`worktree-jump-palette-surface.tsx:121-149`](file:///home/mhenke/Projects/orca/src/renderer/src/components/worktree-jump/worktree-jump-palette-surface.tsx#L121-L149)).
2. **Keyboard capture & dismissal:** `Esc` must immediately dismiss the dialog via `closeOverlay(props().overlay)`, and pressing `Enter` must execute the highlighted item and close the overlay.
3. **Selection clamp during filtering:** When typing narrows results from N to M (where M < active index), the selection index must clamp to `[0, M-1]` to prevent out-of-bounds pointer states.
4. **Unopened worktree navigation:** Selecting an unopened worktree card must open a space via `space.new { folder }` rather than failing ([AGENTS.md rule 6](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L6)).
5. **No missing SVG assets:** All icons referenced via `svg("mods/orca-palette/...")` must exist within `mods/orca-palette/` and survive a clean sync to a fresh app directory.

---

### Task 1: Scaffolding, Mod Metadata, and Self-Contained Assets

**Files:**
- Create: `mods/orca-palette/mod.json`
- Create: `mods/orca-palette/gpui-kit.d.ts`
- Create: `mods/orca-palette/search.svg`
- Create: `mods/orca-palette/terminal.svg`
- Create: `mods/orca-palette/message-square.svg`
- Create: `mods/orca-palette/git-branch.svg`
- Create: `mods/orca-palette/folder.svg`
- Create: `mods/orca-palette/sliders.svg`
- Create: `mods/orca-palette/plus.svg`
- Create: `mods/orca-palette/spinner.svg`
- Create: `mods/orca-palette/alert-circle.svg`
- Create: `mods/orca-palette/circle-check.svg`
- Create: `mods/orca-palette/main.js` (minimal stub)

**Interfaces:**
- Produces: `mods/orca-palette` mod recognized by `herdr-app check mods/orca-palette`.

- [ ] **Step 1: Create `mods/orca-palette/mod.json`**

Create `mods/orca-palette/mod.json` with overlay spec:
```json
{
  "place": "none",
  "title": "Jump Palette",
  "overlay": {
    "kind": "dialog",
    "width": 680,
    "height": 460
  }
}
```

- [ ] **Step 2: Copy type definitions and SVG icons into `mods/orca-palette/`**

Copy `mods/orca-nav/gpui-kit.d.ts` to `mods/orca-palette/gpui-kit.d.ts`.
Copy required icons:
- `mods/orca-nav/search.svg` -> `mods/orca-palette/search.svg`
- `mods/orca-menu/terminal.svg` -> `mods/orca-palette/terminal.svg`
- `mods/orca-spaces/git-branch.svg` -> `mods/orca-palette/git-branch.svg`
- `mods/orca-spaces/folder.svg` -> `mods/orca-palette/folder.svg`
- `mods/orca-nav/sliders-horizontal.svg` -> `mods/orca-palette/sliders.svg`
- `mods/orca-menu/plus.svg` -> `mods/orca-palette/plus.svg`
- `mods/orca-spaces/spinner.svg` -> `mods/orca-palette/spinner.svg`
- `mods/orca-spaces/alert-circle.svg` -> `mods/orca-palette/alert-circle.svg`
- `mods/orca-spaces/circle-check.svg` -> `mods/orca-palette/circle-check.svg`
- `mods/orca-menu/message-square-plus.svg` -> `mods/orca-palette/message-square.svg`

- [ ] **Step 3: Write initial stub in `mods/orca-palette/main.js`**

Implement basic `View` export in `mods/orca-palette/main.js`:
```javascript
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme } from "herdr";

export default class Palette extends View {
  render() {
    const t = theme();
    return v_flex().w(680).h(460).bg(t.chrome).child(div().child("Orca Palette"));
  }
}
```

- [ ] **Step 4: Verify with `node --check` and `herdr-app check`**

Run: `node --check mods/orca-palette/main.js && herdr-app check mods/orca-palette`
Expected: check passed: mods/orca-palette

- [ ] **Step 5: Commit**

```bash
git add mods/orca-palette/
git commit -m "feat(orca-palette): scaffold mod metadata, assets, and stub"
```

---

### Task 2: Palette Indexing, Search Scoring, and Unit Tests

**Files:**
- Create: `mods/orca-palette/search.js`
- Create: `tests/palette-search.test.mjs`

**Interfaces:**
- Produces: `scoreItem(query, text)` and `buildPaletteItems({ spaces, agents, gitCache, commands })`
- Consumes: `spaces()`, `agents()`, `localStorage["git.cache.v2"]`

- [ ] **Step 1: Write unit tests in `tests/palette-search.test.mjs`**

Write test verifying:
1. Exact matches rank higher than prefix matches.
2. Prefix matches rank higher than substring matches.
3. Substring matches rank higher than non-matches.
4. Empty query returns recent items preserving recency.
5. Item projection correctly groups open tabs, workspaces, and actions.

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreItem, filterAndRank } from "../mods/orca-palette/search.js";

test("scoreItem ranks exact matches above substrings", () => {
  const exact = scoreItem("orca", "orca");
  const prefix = scoreItem("orca", "orca-nav");
  const sub = scoreItem("orca", "herdr-orca");
  const none = scoreItem("orca", "random");
  assert.ok(exact > prefix);
  assert.ok(prefix > sub);
  assert.ok(sub > none);
  assert.equal(none, 0);
});

test("filterAndRank filters and sorts by relevance", () => {
  const items = [
    { type: "workspace", name: "herdr-t3", repo: "herdr-t3" },
    { type: "workspace", name: "orca", repo: "orca" },
    { type: "tab", title: "orca terminal", space: "orca" }
  ];
  const results = filterAndRank("orca", items);
  assert.equal(results.length, 2);
  assert.equal(results[0].name, "orca");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/palette-search.test.mjs`
Expected: FAIL (module `search.js` does not exist yet)

- [ ] **Step 3: Implement `mods/orca-palette/search.js`**

Implement `scoreItem`, `filterAndRank`, and `collectPaletteItems`:
- Ported from Orca `match-quality.ts` & `worktree-palette-search.ts` ranking principles:
  - Exact match: 1000
  - Word prefix / boundary match: 500
  - Substring match: 200 + position bonus
  - Subsequence match: 50
- Collect items:
  - Open tabs: `{ type: "tab", id, title, spaceId, spaceName, status, agent }`
  - Workspaces: `{ type: "workspace", id, name, branch, folder, repo, status, opened }`
  - Quick actions: `{ type: "action", id, title, description, command, args }`
  - Fallback create workspace: `{ type: "create", name: query }`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/palette-search.test.mjs`
Expected: PASS (all assertions pass)

- [ ] **Step 5: Commit**

```bash
git add mods/orca-palette/search.js tests/palette-search.test.mjs
git commit -m "feat(orca-palette): add search indexing and ranking logic with unit tests"
```

---

### Task 3: Full Palette UI, Keyboard Navigation, and Execution

**Files:**
- Modify: `mods/orca-palette/main.js`

**Interfaces:**
- Consumes: `mods/orca-palette/search.js`, `gpui-kit`, `gpui-base`, `herdr`
- Produces: Complete `Palette` view component matching Orca `WorktreeJumpPaletteSurface`.

- [ ] **Step 1: Implement `init()` with input handling and focus**

In `mods/orca-palette/main.js`:
- Ported from Orca `WorktreeJumpPaletteSurface.tsx:70-95` and `useWorktreeJumpPaletteLocalState.ts`.
- Instantiate `this.input = InputState.new({ placeholder: "Search chats, terminals, workspaces, tasks, settings, and actions..." })`.
- Bind `this.input.on("change", ...)` to update `this.query`, recompute filtered items, clamp `this.at = 0`, and call `cx.notify()`.
- Listen for arrow navigation `↑` (decrement index with wrap), `↓` (increment index with wrap).
- Listen for `Enter` to run `this.executeSelected(cx)`.
- Listen for `Esc` to call `this.close()`.
- Acquire and activate focus handle `this.handle = cx.focus_handle()`.

- [ ] **Step 2: Implement `render()` matching Orca Jump Palette styling**

In `mods/orca-palette/main.js`:
- Ported from Orca `WorktreeJumpPaletteSurface.tsx:20-205`:
  - Outer dialog container: width 680, max height 460, rounded 8, border `rgba(255, 255, 255, 0.08)`, background `#141414` / `t.chrome`, shadow.
  - Search input bar:
    - Left search icon `mods/orca-palette/search.svg` (16px, muted).
    - Text input with placeholder `"Search chats, terminals, workspaces, tasks, settings, and actions..."` at 13px font.
    - Right trailing badge indicating result count.
  - Divider: 1px border.
  - Items scroll list:
    - Section headers: `"Recent Tabs"`, `"Workspaces"`, `"Actions"`.
    - Worktree rows: status dot (`PaletteWorktreeStatusDot` port), workspace title, branch tag (`git-branch.svg`), repo badge.
    - Open tab rows: agent/terminal icon, tab title, workspace parent label.
    - Quick action rows: action title and key command description.
    - Create workspace row: plus icon, `"Create workspace '<query>'"` label.
    - Highlight active row: `bg(t.accent).text_color(t.accent_foreground)` when index matches `this.at`.
  - Footer bar:
    - Ported from `WorktreeJumpPaletteSurface.tsx:156-177`:
    - Key chips: `↵ Open`, `Esc Close`, `↑↓ Move`.

- [ ] **Step 3: Implement execution handlers**

In `mods/orca-palette/main.js`:
- Ported from Orca `use-worktree-jump-palette-selection-actions.ts`:
  - For tab: `run("space.select", { id: item.spaceId }); run("tab.select", { id: item.id }); closeOverlay(props().overlay);`
  - For workspace: `if (item.opened) run("space.select", { id: item.id }); else run("space.new", { folder: item.folder }); closeOverlay(props().overlay);`
  - For action: `run(item.command, item.args); closeOverlay(props().overlay);`
  - For create workspace: `run("space.new", { folder: item.name }); closeOverlay(props().overlay);`

- [ ] **Step 4: Verify with `node --check` and `herdr-app check`**

Run: `node --check mods/orca-palette/main.js && herdr-app check mods/orca-palette`
Expected: check passed: mods/orca-palette

- [ ] **Step 5: Commit**

```bash
git add mods/orca-palette/main.js
git commit -m "feat(orca-palette): implement Jump Palette UI, keyboard navigation, and execution"
```

---

### Task 4: Connect `orca-nav`, Keybindings, and Documentation

**Files:**
- Modify: `mods/orca-nav/main.js:156-166`
- Modify: `keys.json`
- Modify: `RECIPE.md:107`

**Interfaces:**
- Consumes: `openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 })`

- [ ] **Step 1: Update `mods/orca-nav/main.js`**

In `mods/orca-nav/main.js:156-166`:
- Update comment citing Orca `SidebarNav.tsx:90-118`.
- Change `search` row `on_click`:
```javascript
      .on_click(() => openOverlay({ mod: "orca-palette", kind: "dialog", width: 680, height: 460 }))
```

- [ ] **Step 2: Update `keys.json`**

In `keys.json`, add keybinding for jump palette under `"layout:orca"`:
```json
    "ctrl-p": "mod.open:orca-palette"
```

- [ ] **Step 3: Update `RECIPE.md`**

In `RECIPE.md:107`, update description:
`- Clicking Search opens Orca's jump palette (openOverlay with orca-palette) for searching workspaces, open tabs, and quick actions.`

- [ ] **Step 4: Verify with `node --check` and `herdr-app check`**

Run: `node --check mods/orca-nav/main.js && herdr-app check mods/orca-nav`
Expected: check passed: mods/orca-nav

- [ ] **Step 5: Commit**

```bash
git add mods/orca-nav/main.js keys.json RECIPE.md
git commit -m "feat(orca-nav): wire search button and ctrl-p to orca-palette"
```

---

### Task 5: End-to-End Clean Sync and Verification

**Files:**
- Test: `scripts/sync.sh`
- Verification across synced mod directory.

- [ ] **Step 1: Test clean sync to a temporary test directory**

Run: `HERDR_APP_HOME=/tmp/fresh-sync bash scripts/sync.sh`
Expected: Synced cleanly without errors; `ls /tmp/fresh-sync/mods/orca-palette` contains all SVGs and JS files.

- [ ] **Step 2: Verify all mods in package pass `herdr-app check`**

Run check loop over all mods:
```bash
for m in mods/*/; do
  node --check "$m/main.js"
  herdr-app check "$m"
done
```
Expected: All checks exit 0.

- [ ] **Step 3: Run unit tests**

Run: `node --test tests/palette-search.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit any final polish**

```bash
git commit -m "chore: verify clean package sync and mod checks" --allow-empty
```
