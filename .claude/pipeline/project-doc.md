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
| `orca-spaces` | the project tree: repo-anchored groups, worktrees, cards, status, reviews, owner avatars, saved folders | 1300 |
| `orca-tabs` | the tab rail, window controls, right-sidebar toggle, close guards, drag reorder, drop-to-split indicators | 1110 |
| `orca-pane` | the attached 32px pane header: tab pill, command/ellipsis menu, split controls, drag-to-unsplit | 350 |
| `orca-pane-status` | the agent mark drawn in a pane header | 37 |
| `orca-panel-head` | the right panel's activity switcher | 118 |
| `orca-panel-gap` | the honest body for a panel or page Herdr has no backend for | 61 |
| `orca-files` | the file tree (virtualized), preview, name/content search, row context menu; opens a file from `props.file` | 1090 |
| `orca-changes` | the source-control list, split commit actions, conflict resolution, PR creation, uncommitted-entry context menu | 788 |
| `orca-agents` | the agents panel: live scopes, search, and session history with resume | 546 |
| `orca-status` | the bottom status bar: provider usage cluster, updates, hosts | 159 |
| `orca-menu` | every context menu: `pane`, `tab`, `space`, `group`, `global`, plus the transcript capture shared with handoff | 740 |
| `new-menu` | the create popup behind `+`: agent launch and model list drilldown | 314 |
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
mods/               eighteen self-contained mod folders, each with mod.json + main.js + assets
extras/themes/      orca-dark.json, orca-light.json
extras/icons/       the marks extras/programs.json names (omp.svg)
extras/programs.json  program-table entry for `omp`, merged into the target's programs.json by hand
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
- **What `verify.py` checks**: every `file.ext:NN` in a mod comment resolves to a real file in Orca with at least that many lines (811 citations checked); every mod script parses (`node --check`); every mod folder passes `herdr-app check`; and with `--smoke`, the app restarts and the run fails on any script error in the log.
- **Known untested areas**: pointer interaction. Keys are injectable — this build's `hyprctl` speaks the Lua dispatcher, and `hl.dsp.send_key_state({mods="", state="down", key="f"})` reaches the focused window (a programmatically focused `Input` accepted typed text this way). Pointer is not: `hl.dsp.cursor` exposes only `move` and `move_to_corner`, and `xdotool`, `ydotool`, `wlrctl` are absent while `/dev/uinput` is root-only. So hover, click and drag stay code-verified; typing is verifiable when a probe can focus an element.

## Entry Points

| Path | Role |
|---|---|
| `layouts/orca.json` | the layout root: geometry, theme name, block→mod mapping |
| `scripts/sync.sh` | installs layouts, themes, `extras/icons/` and mods, then merges the `layout:orca` key section (the program table is left alone) |
| `scripts/verify.py` | the audit gate (`--smoke` for a restart check) |
| `mods/orca-spaces/main.js` | the largest behaviour surface: grouping, cards, probes, reviews |
| `keys.json` | `ctrl-shift-b` toggles the sidebar, `ctrl-shift-e` the panel, `ctrl-alt-a` the floating agent panel, `ctrl-shift-s` the split menu; `ctrl-shift-m` names `orca-tab-move`, a mod the package does not ship |
| `AGENTS.md` | the rules; read before any edit |

## Changed Files

`.claude/pipeline/project-doc.md` is a DELTA patch over the previous delta. Re-scanned files:
- `mods/orca-pane/main.js`: pane header upgraded from a 24px hover overlay to Orca's attached 32px split-group header (`TabGroupPanel.tsx:281-315`): tab pill with pane title and close, split-right `+`, `▷ Command` pill, ellipsis pane-actions, split right/down and close. The centre is a drag handle (poll at 16ms, 8px activation) that tracks the cursor into the tab strip (`terminal-tab-strip-drop-target.ts:12-16`) and unsplits the pane into its own tab via `terminal.park`/`terminal.keep` (`terminal-pane-tab-detach.ts:40-58`). Release is inferred after ~240ms of stillness because the host exposes no global mouse-up. Right-click on the header opens the pane menu (`TerminalPaneHeaderOverlay.tsx:149`).
- `mods/orca-tabs/main.js`: tab drag rework for split groups: the drop record lives in the `orca-tabs.drop` shared key so the overlay copy can resolve the release; the drop poll honours a `released` flag, still-ticks raised to 20 (~320ms), and the overlay requests resolution through `shared()` instead of holding a stale `cx`.
- `mods/orca-files/main.js`: row context menu rebuilt from `file-explorer-row-context-menu.tsx`: Duplicate (`useFileDuplicate.ts:34-63`, picks `name copy` / `name copy 2`), View File (`:216-225`, opens preview through the shared `orca-files.viewFile` key), platform-named reveal row, Open in Terminal gated to directories, destructive Delete. Module-level `mainFilesView` lets the popup's commands refresh the installed view; the `command` loop now handles `remove`, `refresh` and `view`.
- `mods/orca-changes/main.js`: right-click on an uncommitted entry opens `SourceControlEntryContextMenu` (`entry-context-menu.tsx:90-150`): View, conflict resolutions, Copy Path / Copy Relative Path, Reveal in File Manager (disabled for deleted files), Open in File Explorer. `openEntry` and `resolveConflict` accept the popup's `root`/`on` so a popup copy acts on the same repo; `recordReview` now carries the PR title and the entry list refreshes from the installed view.
- `mods/orca-menu/main.js`: pane and tab menu rows follow Orca's gating: Hand Off only for agent panes (`canContinueAgentSessionInNewSession`/`isTuiAgent`), Move to New Tab for split panes, new marks (`bell`, `bell-off`, `eraser`, `rotate-ccw`, `text-select`); copy actions pass their click `cx` to the native clipboard.
- `mods/orca-spaces/main.js`, `project.js`: repo owner avatars from `repo-icon.ts:37-54`: a GitHub-shaped owner URL downloads once to `$app/avatars/<host>_<owner>.png` (`curl`, then `convert` to PNG, Folder fallback on failure), and a renamed fork keeps its own owner. Fork PR lookup no longer overwrites `slug`, so `baseRepo` and the avatar owner stay separate.
- `mods/*/clip.js` (4 copies, identical): clipboard writes go through `cx.write_to_clipboard` with `globalThis.__clipboard_write_text` as fallback (`quickjs/host.rs:93,917`), replacing `wl-copy`/`xclip`/`pbcopy` subprocesses and temp files; reveal spawns the desktop opener detached. Rationale and evidence: ADR 0013.
- `mods/orca-handoff/main.js`: awaited clipboard write and `cx.timer.after` instead of `setTimeout` (ADR 0002 / rule 13).
- `mods/orca-status/main.js`, `usage.js` (new): Orca's usage cluster (`StatusBarSurface.tsx:308-370`) with provider probing (`agy`, Claude, Codex, Cursor) every 120s, tightest-window label selection (`rate-limit-window-label.ts`), and an on-demand refresh whose icon spins while in flight.
- `layouts/orca.json`: the terminal pane's `header` is `height: 32`, no `reveal`, and `lone: false` to match the attached header.
- `docs/adr/0012-multi-tab-split-groups-vs-pane-hierarchy.md`, `0013-native-gpui-clipboard-over-cli-daemons.md`, `0014` (recorded in 85cf2f2), `docs/adr/README.md` (new).
- `docs/adr/*` (existing): amendments pointing at 0009/0012 and the built split-group reality, plus the standalone-asset provenance rule.
- `NOTICE`: `mods/orca-status/main.js` and the `orca-tabs/agent-icons` replicas catalogued.
- `GLOSSARY.md`: floating agent panel, agent transcript, review store defined, project key wording fixed.
- `README.md`, `RECIPE.md`: pane header now documented as the attached 32px header with drag-to-new-tab; status bar documented as the provider usage cluster; clipboard and file-menu claims corrected; row/entry menus listed.
- `scripts/verify.py`: `usage.js` added to the mod-owned module allowlist (811 citations checked).

## Last Scanned

2026-11-09T17:02:19Z
