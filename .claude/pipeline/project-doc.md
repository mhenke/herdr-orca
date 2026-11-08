# Project Documentation
> Generated: 2026-11-07T17:45:00Z | Mode: FULL

## Tech Stack

- **Runtime**: Herdr App (GPUI desktop shell) — the mods execute in a JavaScript runtime embedded in the shell, not Node.
- **Language**: JavaScript (ES modules, no build step, no TypeScript compilation). Type surface is the vendored `gpui-kit.d.ts` / `gpui-base` declarations.
- **Framework**: Herdr's declarative layout + mod system. There is no application framework, router or bundler.
- **Database**: none. State is per-mod-copy `localStorage` plus a `shared()` cross-mod channel (in-process only).
- **Styling**: `extras/themes/orca-dark.json` / `orca-light.json`, consumed through the nested `colors` map. Defaults per element are set in code with hex literals taken from Orca's Tailwind classes.
- **State Management**: no store library. Each mod `View` holds fields assigned in `init`; cross-mod values travel via `setShared`/`shared`, mod commands (`<mod>.<command>` → `nextCommand`), or are recomputed each render.

## Dependencies

**Core (runtime, supplied by Herdr App — never vendored)**
- `gpui-kit` — element builders (`div`, `svg`, `image`), `View`
- `gpui-base` — `h_flex`, `v_flex`, form controls
- `herdr` — `spaces()`, `machines()`, `panes()`, `agents()`, `run()`, `exec()`, `openOverlay()`, `theme()`, `shared()`, `setShared()`, `watchFolder()`, `props()`, `nextCommand()`

**Core (host binaries invoked through `exec`)**
- `git` — `status --porcelain=v2 --branch`, `rev-parse --show-toplevel`, `rev-parse --git-common-dir`, `worktree list --porcelain`, `remote get-url`
- `gh` — `repo view --json isFork,parent`, `api repos/<o>/<r>/pulls?head=…`, `pr list`
- `curl` — repo avatar download only (Herdr's `fetch` exposes `text()`/`json()` with no bytes)

**Dev / tooling**
- `node --check` — syntax gate
- `herdr-app check <abs mod path>` — mod validation
- `scripts/verify.py` — citation, syntax, mod and smoke audit (Python 3 stdlib only)
- `graphify` — code graphs for `~/Projects/orca` (237,654 nodes) and `~/Projects/herdr-t3`

No `package.json`, no lockfile, no installed npm dependencies. That is intentional: the package is copied into `~/.config/herdr-app` and interpreted.

## Architecture Pattern

**One owner per visual region, composed by layout.**

`layouts/orca.json` is the root of the system and owns geometry: three columns, their sizes, dividers, background, theme name and the terminal padding. Each region's contents come from exactly one mod. Mods draw; the layout arranges. A mod that also tried to size itself would fight the layout, so sizes live in the layout and only padding/type inside mods.

Sixteen mods, all `"place": "none"` (composed into blocks rather than floated):

| Mod | Owns | LOC |
|---|---|---|
| `orca-chrome` | titlebar strip and the sidebar footer | 66 |
| `orca-nav` | Search, Tasks/Automations/Orca Mobile rows, history arrows, Projects header | 142 |
| `orca-spaces` | the project tree: repo-anchored groups, worktrees, cards, status, reviews, saved folders | 1175 |
| `orca-tabs` | the tab rail, window controls, right-sidebar toggle | 311 |
| `orca-pane` | the terminal pane header, incl. its right-click | 100 |
| `orca-pane-status` | the agent mark drawn in a pane header | 35 |
| `orca-panel-head` | the right panel's activity switcher | 115 |
| `orca-panel-gap` | the honest body for a panel or page Herdr has no backend for | 61 |
| `orca-files` | the file tree (virtualized), preview, name/content search | 1021 |
| `orca-changes` | the source-control list, split commit actions, and PR creation | 482 |
| `orca-agents` | the agents panel with workspace/project/all scopes and search | 204 |
| `orca-status` | the bottom status bar | 68 |
| `orca-menu` | every context menu: `pane`, `tab`, `space`, `group`, `global` | 405 |
| `new-menu` | the create popup behind `+` | 119 |
| `orca-landing` | the empty-workspace page | 108 |
| `orca-float` | the floating agent-session panel | 160 |

Three rules shape the composition:

- **A repo, not a session, is the sidebar unit.** One group per repo, anchored on its main
  checkout; the rows under it are `git worktree list`, including worktrees no space has opened
  (`mods/orca-spaces/worktree-plan.js`). Spaces only decide where you already are.
- **A page, not a panel, is where the sidebar's Tasks/Automations/Orca Mobile rows go.** Each is
  a child of the `main` stack in `layouts/orca.json`, selected with `layout.select`; choosing a
  workspace or tab selects the terminals back.
- **A gap is a surface, not an omission.** When Herdr lacks the backend (PR Checks, Ports,
  Tasks, Automations, Orca Mobile, …), the control still renders where Orca puts it and its body
  names what is missing in Orca's unavailable-state geometry (`docs/adr/0004-…`).

Mods are isolated by rule: **a mod cannot import or read outside its own folder**. `svg()`/`image()` resolve against `~/.config/herdr-app`, so icons are copied per mod, and each ships its own `gpui-kit.d.ts` and `jsconfig.json`. The duplication is deliberate — it is what makes a mod folder independently installable.

## Folder Structure

```
layouts/            orca.json (the layout), orca.svg (its preview)
mods/               sixteen self-contained mod folders, each with mod.json + main.js + assets
extras/themes/      orca-dark.json, orca-light.json
scripts/            sync.sh (install), verify.py (audit)
docs/               superpowers plans/specs (historical)
.agents/skills/     graphify, project-scoped
.claude/pipeline/   this document
keys.json           key bindings merged into the target's keys.json
README.md           what it looks like, philosophy, caveats
RECIPE.md           how to port another design, step by step
AGENTS.md           the rules an agent must follow when editing
GLOSSARY.md         the domain vocabulary
preview.png         the screenshot in README
```

## Code Style Conventions

- **Mod entry**: `export default class X extends View` with `init(_props, cx)` and `render(cx)`.
- **Builders**: chained snake_case GPUI names on one expression (`.flex().items_center().gap(6)`), so a visual region reads as a single block.
- **Naming**: functions are named for the Orca symbol they port (`foldKey`, `reviewOf`, `lookupPRByBranch`) or in Herdr's vocabulary — never a plausible-looking Orca name that does not exist.
- **Comments**: cite Orca's file and line, and name any deliberate divergence in one line. The comment is where parity is proven or the gap is admitted.
- **No dead branches**: a state Herdr cannot produce is not ported. Orca's `failed`/`interrupted` dots are absent because `Model::status` never returns them.
- **Imports**: grouped `gpui-kit`, then `gpui-base`, then `herdr`, then local siblings in one `./x.js` line each.

## Modularity Practices

- **Ship copies, not symlinks** — `sync.sh` copies `mods/*/` whole (`rm -rf` then `cp -r`), so an installed mod is exactly the folder in the repo.
- **One owner per region** — adding a second mod to a block replaces the first, so overlap is impossible by construction.
- **Cross-mod channels are explicit**: `shared()` for values read at render (no notification — the consumer re-reads when it next renders), `<mod>.<command>` into `nextCommand()`, and `openOverlay` to raise another mod as a popup.
- **Pure helpers in sibling modules** — `project.js` (remotes, avatars), `status.js` (marks), `indentation.js` (geometry), `tip.js` (tooltip glue), `focus.js` (focus rings). These are importable only within `orca-spaces`.

## Data Architecture

No persistence layer of the package's own. Four data sources, read at different cadences:

0. **Layout selection** — which child of a stack is shown (`main` = terminals or a page,
   `panel-body` = the right panel's tab) is read from `layout()`, never cached.
1. **Host model, live** — `spaces()`, `panes()`, `agents()`, `machines()` are read directly during render. `space.status` and `agent.status` are already rolled up by `Model::rollup`; the package never re-derives urgency.
2. **git, polled** — `check()` runs `git status --porcelain=v2 --branch` per place, at most once per second per repo, plus `watchFolder` on the git dir. Local repos only for anything expensive.
3. **GitHub, polled out of band** — reviews come from a cache keyed `<git-common-dir>::<branch>` in `localStorage` (`pr.cache.v2`). The reader (`reviewOf`) is pure; the writer (`lookupPRByBranch`) runs from the refresh cycle, never from render. A fork's same-named branch cannot answer because the head owner must match origin's.
4. **localStorage, per mod copy** — `git.cache.v2` (per-place branch/repo/worktree list; v1 is retired because it lacked worktrees for linked checkouts), `pr.cache.v2`, `repos.folded`, `agents.folded`, `machines.folded`, `machines.reconnecting`, `projects.saved.v1` (folders added to the sidebar), `tab.colors.v1` (`{tabId: hex}` written by orca-menu, read by orca-tabs). Each is a JSON array or object, written after the in-memory `Set`/`Map` changes.

## Cross-Cutting Concerns

- **Errors**: a mod exception does not exit the app — it is logged and the region keeps its last
  good frame under a 2px bar naming the error (`docs/adr/0002-…`). Two engine limits shape the
  code: a render call is cut off at 50 ms and an event handler at 500 ms (`gpui-kit`
  `sandbox.rs` `Budgets`), so a list that can grow must render through `v_virtual_list` — it
  hands the renderer a `{start,end}` range and takes `on_item_click`/`on_item_secondary_click`
  instead of per-row handlers, which the runtime refuses inside an item renderer. Building every
  row in one frame overruns the budget and paints the bar while the user types.
- **Off-machine safety**: `exec` carries `on` (the machine name); git probes run there, but `gh` and `curl` are local-only because a remote may not be authenticated.
- **No network by default**: only the repo avatar (one `curl` per owner, cached to `avatars/`) and `gh` reads. No telemetry.
- **Settings are documented, never written** — fonts and sounds are the reader's to set.
- **Accessibility**: every interactive element carries `role("button")` and an `accessibility_label`.

## Service Communication

All outbound work is `exec` against host binaries; there is no HTTP client of the package's own and no server. Two Herdr facilities are used as channels:

- `shared` / `setShared` — orca-spaces publishes `space.colors` and `projects.allCollapsed`; orca-nav reads them.
- `openOverlay({mod, kind, props})` — orca-pane and orca-tabs raise orca-menu with `{tab: 'pane'|'tab', target}`.

## Test Coverage

- **Overall coverage**: 0% by unit-test measure. There is no test runner, no `package.json` and no test files.
- **Testing framework**: none. `scripts/verify.py` is an audit, not a suite.
- **Rationale**: the defects this project actually shipped were four runtime throws, three invented values and three fabricated citations. None is visible to a unit test; the oracle for a value is `~/Projects/orca`, which is not a JS dependency. So the audit checks what would have caught them, and it did — it found three fabricated line citations in its first run.
- **What `verify.py` checks**: every `file.ext:NN` in a mod comment resolves to a real file in Orca with at least that many lines (480 citations checked); every mod script parses (`node --check`); every mod folder passes `herdr-app check`; and with `--smoke`, the app restarts and the run fails on any script error in the log.
- **Known untested areas**: pointer interaction. Keys are injectable — this build's `hyprctl` speaks the Lua dispatcher, and `hl.dsp.send_key_state({mods="", state="down", key="f"})` reaches the focused window (a programmatically focused `Input` accepted typed text this way). Pointer is not: `hl.dsp.cursor` exposes only `move` and `move_to_corner`, and `xdotool`, `ydotool`, `wlrctl` are absent while `/dev/uinput` is root-only. So hover, click and drag stay code-verified; typing is verifiable when a probe can focus an element.

## Entry Points

| Path | Role |
|---|---|
| `layouts/orca.json` | the layout root: geometry, theme name, block→mod mapping |
| `scripts/sync.sh` | installs layouts, themes, mods and merges the `layout:herdr-orca` key section |
| `scripts/verify.py` | the audit gate (`--smoke` for a restart check) |
| `mods/orca-spaces/main.js` | the largest behaviour surface: grouping, cards, probes, reviews |
| `keys.json` | `ctrl-shift-b` toggles the sidebar, `ctrl-shift-e` the panel |
| `AGENTS.md` | the rules; read before any edit |

## Changed Files

`.claude/pipeline/project-doc.md` is a DELTA patch over the previous delta. Re-scanned files:
- `mods/orca-agents/main.js`: Added Orca's `VaultScopeSwitch` (`workspace`, `project`, `all`) from `AiVaultPanelControls.tsx:87-160`, live search filter from `AiVaultPanelHeader.tsx:161-202`, and count bar from `AiVaultSessionListBar.tsx:50-54`. Added `search.svg` and `x.svg`.
- `mods/orca-changes/main.js`: Added split commit action button from `commit-action-menu.tsx:34-85`, action dropdown with compound actions from `source-control-dropdown-items.ts:128-143`, and Create PR modal dialog/workflow via `gh pr create` from `use-hosted-review-creation.ts:80-150` and `review-animated-visual-ship-styles.tsx:7`. Added `git-pull-request.svg`.
- `mods/orca-menu/main.js`: Fixed display name resolution line citation to `worktree-default-display-name.ts:13-25`.
- `mods/orca-spaces/main.js`: Focus fallback on first group header's `space-new` and remote machine string passing.
- `mods/orca-files/main.js`: Dropped the invented `rg --max-count 20` (Orca sets no per-file cap, so badges and totals no longer undercount); search summary `text-2xs` = 11px; match-row gap 4px (`SearchResultItems.tsx:178`). Match-click reveal is left unimplemented and documented: `EditorState`'s JS surface is `value`/`set_value`/`on`/`release` only, so no line or scroll target reaches JS.
- `mods/orca-spaces/main.js` + `mods/orca-menu/main.js`: The `space` menu is now worktree-keyed (`WorktreeContextMenuView.tsx:165-298`): `Update`/`Close` only for an open space, `Open in`/`Copy Path`/`Copy Worktree Name` and the worktree actions always, `Remove worktree` only when linked. Opener passes `{id, path, top, branch, machine, linked, folder}`. Agent rows activate their pane (`worktree-card-compact-agent-row.tsx:311`) and stop the card's press.
- `mods/orca-changes/main.js`: Commit & Push / Push / Sync actions and the Create-PR dialog (`gh pr create`); the PR cache is not written from this mod because the sidebar keys it `JSON.stringify([machine, commonDir])`.
- `/.claude/pipeline/project-doc.md`: LOC table refreshed to current `main.js` sizes (orca-spaces 1175, orca-files 1021, orca-changes 482, orca-menu 405).
- Re-scanned, no substantive change: `README.md` (prose rewrite, 78+/113-), `RECIPE.md` (6 lines), `mods/orca-float/main.js` (4 lines — the session row's focus click was already present).
- `GLOSSARY.md`: Added canonical definitions for `Vault scope`, `Commit action menu`, and `Hosted review creation`.
- `docs/adr/0005-live-agent-scoping-vs-transcript-indexing.md`: Recorded the architectural decision to bind the Agents panel to in-memory live agent models rather than crawling on-disk transcripts.

## Last Scanned

2026-11-08T00:21:26Z
