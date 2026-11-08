# Project Documentation
> Generated: 2026-11-08T03:08:00Z | Mode: DELTA (updated from 2026-11-08T01:54:00Z)

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

Eighteen mods, all `"place": "none"` (composed into blocks rather than floated):

| Mod | Owns | LOC |
|---|---|---|
| `orca-chrome` | titlebar strip and the sidebar footer | 68 |
| `orca-nav` | Search, Tasks/Automations/Orca Mobile rows, history arrows, Projects header and its options menu | 429 |
| `orca-spaces` | the project tree: repo-anchored groups, worktrees, cards, status, reviews, saved folders | 1297 |
| `orca-tabs` | the tab rail, window controls, right-sidebar toggle, close guards, drag reorder | 606 |
| `orca-pane` | the terminal pane header, move/split grip, and split controls | 168 |
| `orca-pane-status` | the agent mark drawn in a pane header | 37 |
| `orca-panel-head` | the right panel's activity switcher | 118 |
| `orca-panel-gap` | the honest body for a panel or page Herdr has no backend for | 61 |
| `orca-files` | the file tree (virtualized), preview, name/content search; opens a file from `props.file` | 1024 |
| `orca-changes` | the source-control list, split commit actions, conflict resolution, and PR creation | 715 |
| `orca-agents` | the agents panel: live scopes, search, and session history with resume | 546 |
| `orca-status` | the bottom status bar | 70 |
| `orca-menu` | every context menu: `pane`, `tab`, `space`, `group`, `global`, plus the transcript capture shared with handoff | 598 |
| `new-menu` | the create popup behind `+`: agent launch and model list drilldown | 338 |
| `orca-landing` | the empty-workspace page | 111 |
| `orca-float` | the floating agent-session panel | 162 |
| `orca-handoff` | the hand off / fork agent-session dialog | 366 |
| `orca-split-menu` | the pane split menu with directional split controls | 360 |

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
- **Cross-mod channels are explicit**: `shared()` for values read at render (or broadcasted via `setShared`), `<mod>.<command>` into `nextCommand()`, and `openOverlay` to raise another mod as a popup.
- **Pure helpers in sibling modules** — `project.js` (remotes, avatars), `status.js` (marks, `STATUS_RANK`), `indentation.js` (`resolveRowGeometry`), `review-store.js` (freshness, caching), `worktree-plan.js` (projection pipeline), `tip.js` (tooltip glue), `focus.js` (focus rings). These are importable only within their respective mods.

## Data Architecture

No persistence layer of the package's own. Four data sources, read at different cadences:

0. **Layout selection** — which child of a stack is shown (`main` = terminals or a page,
   `panel-body` = the right panel's tab) is read from `layout()`, never cached.
1. **Host model, live** — `spaces()`, `panes()`, `agents()`, `machines()` are read directly during render. `space.status` and `agent.status` are already rolled up by `Model::rollup`; the package never re-derives urgency.
2. **git, polled** — `check()` runs `git status --porcelain=v2 --branch` per place, at most once per second per repo, plus `watchFolder` on the git dir. Local repos only for anything expensive.
3. **GitHub, polled out of band with TTL** — reviews come from `review-store.js` (`pr.cache.v2` in `localStorage`), implementing Orca's dual TTLs (`FOUND_REVIEW_TTL_MS = 60s`, `NO_REVIEW_REFRESH_INTERVAL_MS = 15m`). Creating a PR in `orca-changes` immediately updates and invalidates the cache, broadcasting across mods via `setShared("pr.cache.v2", cache)`. Background lookups are throttled to `MAX_INFLIGHT_PR_LOOKUPS = 2`.
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
- `mods/new-menu/main.js` & `mods/new-menu/models.js` (new): Interactive agent launch with dynamic agent discovery via `knownAgents()`, model list drilldown with universal aliases (`MODELS`), filter search input, and account-scoped model probes.
- `mods/orca-tabs/main.js`: Tab drag reordering with Orca's 2px blue insertion indicator line (`overSide` left/right) and insertion index offset math, middle-click tab closure, active process close guard dialog (`CloseTerminalDialog.tsx`), settled tab close confirmation (`PinnedTabCloseDialog.tsx`), and bulk tab close dialogs.
- `mods/orca-pane/main.js`: Added 6-dot grip affordance (`.pane-title-drag-handle`) centered on hover when multiple panes exist to open move/split layout menu, and added split-down header button.
- `mods/orca-menu/main.js`: Added 4-quadrant pane swap actions (`Swap with Left/Right/Above/Below`), split left/up actions, and bulk tab close actions (`close-others`, `close-right`, `close-left`).
- `mods/orca-spaces/main.js` & `status.js`: Bundled agent icons for OpenCode (`omp.svg`), Droid, Kilo, Aider (`.svg`), and Gemini, Cursor, Grok, Qoder, Hermes, DSH (`.png`). Removed unneeded remote avatar fetches in favor of bundled Folder marks. Updated `statusMark` so idle tabs share the emerald quiet-terminal dot with done per `StatusIndicator.tsx:105-110`.
- `GLOSSARY.md`: Added canonical domain terms for `Startable agent`, `Create menu`, `Model list`, `Settled tab`, `Close guard`, `Bulk tab close`, and sharpened `Drop quadrant` and `Drop indicator`.
- `NOTICE`: Added `models.js` and Orca agent icon assets under MIT.
- `docs/adr/0006-tab-surface-and-actions-port.md` & `docs/adr/0007-terminal-panel-capabilities-and-actions.md`: Updated to document drag reordering, drop boundaries, close guards, and pane grip affordances.
- `README.md` & `RECIPE.md`: Documented create menu agent model list and key interactions.

## Last Scanned

2026-11-08T03:08:00Z
