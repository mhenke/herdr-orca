# Orca parity for Herdr App — design (rev 2)

Date: 2026-11-06
Status: revised after review; supersedes rev 1.
Pinned versions: `herdr-app 0.1.13`, `gpui-shell 0.7.1`, `herdr-core (hc) 0.1.18`.

Rev 1 was not buildable. What changed and why is recorded in §Revisions so the errors are not repeated.

## Goal

Make `herdr-app` look and behave like Orca, as far as Herdr's model allows, without forking Herdr.

## What already exists

- `layouts/orca.json` — three columns at Orca's widths: left 280 (min 220, max 500), right 280 (min 220). Verified rendered at 280/280 by `herdr-app shot` + pixel scan.
- Shipped `spaces` groups linked worktrees under their checkout (`ordered()`, `spaces/main.js:258-293`) with `├─`/`└─`, branch, ahead/behind, and `space.move` persistence.
- Shipped `worktree` mod creates, opens, removes worktrees via `git worktree`, warning on dirty trees and unpushed submodules.
- Shipped `tabs` owns the right column: it runs `layout.select` + `layout.show/hide` on nodes `panel` and `panel-body` (`tabs/main.js:32-33` for per-space restore, `:88-89` for its buttons).
- Shipped `menu` renders pane/tab/space/global menus, but **only when opened by someone** — the space menu is opened from `spaces/main.js:250`, hardcoded to `mod: "menu"`.

None of the above is rebuilt.

## Source of truth for numbers

| Thing | Value | Source |
| --- | --- | --- |
| Left sidebar | 280, min 220, max 500 | `ui-slice-agent-actions.ts:48`, `sidebar/index.tsx:47-48` |
| Right sidebar | 280, min 220 | `right-sidebar-state.ts:41`, `right-sidebar-width.ts:1` |
| Activity bar | 36px tall, buttons 36×36, icons 16px | `right-sidebar-top-activity-bar.tsx:39`, `activity-bar-buttons.tsx:156` |
| Tab text | 12px, `px-1.5`, active 2px underline | `SortableTab.tsx:214`, `drop-indicator.ts:15-22` |
| Nav rows | 13px, `px-2 py-1.5` | `SidebarNav.tsx:87,97,129` |
| Font | Geist | `assets/main.css:190` |
| Dark tokens | bg `#0a0a0a`, fg `#f0f0f0`, card `#171717`, muted `#262626`, accent `#404040`, border `rgb(255 255 255 / .07)` | `assets/main.css:336-380` |
| Checks visibility | `gitOnly: true` — git repos only | `use-right-sidebar-activity-items.ts:117` |

## Package shape

Follows herdr-t3: `layouts/ mods/ keys.json themes/ README.md RECIPE.md preview.png scripts/sync.sh`.

- No `bin/` shipped into the app home, no test scripts, no sound installation. Those were rev 2 drift; herdr-t3 ships none of them and keeps shell tooling in `scripts/` for producing its own previews only.
- `scripts/sync.sh` is kept: herdr-t3 has one (`herdr-t3/scripts/sync.sh`), and it copies rather than symlinks because "Herdr App doesn't load a mod's own SVGs through a symlink".
- A mod cannot import outside its own folder (`herdr-t3/scripts/sync.sh:10`), so the clipboard helper lives as `mods/<mod>/clip.js`, copied into each mod that needs it — the same way herdr-t3 duplicates `focus.js` and `name.js`.
- Settings (fonts, sounds) are **documented** in the README for the person to apply, not written by the package.
- Orca's colours ship as `themes/orca-dark.json`, matching how herdr-t3 ships `t3-code-dark.json`.

## Where each kind of change belongs

Corrected in rev 2:

| Setting | Lives in | Not in |
| --- | --- | --- |
| `theme`, `colors`, `font`, `font_size`, `ui_font`, pane radius/border | root of `layouts/orca.json` — "A layout's own look wins" (`defaults/AGENTS.md:297`) | not a per-project settings file; `settings.json` is one file for the person |
| `sounds`, `zoom`, `font_ligatures` | `settings.json` (one file, already exists) | — |
| UI glyphs | inside the mod that draws them: `svg("mods/<mod>/x.svg")` | not a top-level `assets/icons/` — that directory does not exist |

`ui_font` is a **font family**, not a size (`defaults/AGENTS.md:326`: "`font` / `font_size`: the terminals'; `ui_font`: the mods'"). Rev 1's `ui_font: 13` was invalid.

Geist ships with Herdr ("JetBrains Mono, Geist Mono and Geist ship with Herdr", `defaults/AGENTS.md:340`), so there is no install step and no `fc-cache`.

## Phases

### Phase 1 — Look and sound

**Layout root** (`layouts/orca.json`): add `"theme": "graphite"`, `"ui_font": "Geist"`, `"font_size": 14`, and `"colors"` mapped from Orca's dark tokens. Reduce pane `radius` from 10 to 2 so the center reads flat as Orca's does. Keep the 1px border.

**Sounds** (`settings.json`): copy `ding.mp3` (done) and `two-tone.mp3` (blocked) from Orca's `resources/notification-sounds/` into `~/.config/herdr-app/data/sounds/`, set `sounds.done` and `sounds.blocked`. Sounds are a person setting, so they stay in `settings.json`.

Terminal `ansi` palette is left alone: changing it would shift every program's colours, which is not what Orca parity means.

Acceptance: `herdr-app status` shows no errors and no `*.error`; a screenshot shows Geist in mod text, Orca's greys, and 2px pane corners.

### Phase 2 — Icons, mod-local

15 glyphs are actually missing. Verified present already and therefore reused: `circle-check`, `files`, `git-compare`, `pin-off`, `square-pen`, `search`, `plus`, `bell`-adjacent equivalents.

Missing: `bell`, `bell-off`, `book-open`, `calendar-clock`, `copy`, `download`, `external-link`, `eye`, `folder-tree`, `list-checks`, `plug`, `smartphone`, `trash-2`, `unlink`, `workflow`.

Each is written as a 24×24 viewBox SVG using `currentColor`, and placed in the mod that consumes it (`mods/orca-spaces/*.svg`, `mods/orca-menu/*.svg`, `mods/orca-files/*.svg`). No shared icon directory. Herdr's existing `mods/workspace-chrome/*.svg` are referenced in place, exactly as shipped mods do.

Sizes follow Orca: 16px activity, 14px menu, 12–13px inline.

Acceptance: `herdr-app check` on each consuming mod passes; a screenshot shows the glyphs.

### Phase 3 — `orca-spaces` (clone of `spaces`)

Rev 1 said to clone `menu`. That does nothing: `menu` only renders a list; the space menu's contents are decided in `spaces/main.js:250`, which passes `mod: "menu"`. The writer is `spaces`.

Clone: `herdr-app do mod.clone '{"name":"spaces","as":"orca-spaces"}'`, point `layouts/orca.json` node `spaces` at `orca-spaces`, and change line 250 to `mod: "orca-menu"` only if a separate popup is wanted; otherwise put the extra items in an `orca-menu` clone opened from `orca-spaces`.

Phase 3 delivers an `orca-menu` clone plus the one-line change in `orca-spaces`. Items added to the `space` case, in Orca's order:

| Item | Mechanism | Verified |
| --- | --- | --- |
| Copy Path | temp file + `sh -c 'wl-copy < "$1"'` | yes — `wl-paste` returned the exact path |
| Copy Worktree Name | same | yes |
| Open in Terminal | `terminal.open { folder }` | command exists |
| Rename / New / Open / Remove worktree | unchanged from shipped | yes |

Separator rule: `menu/main.js` derives separators from `it[1].endsWith(".close")`; new items above Close need that predicate widened. `menuIcon()` maps command suffix → SVG; new commands need entries or they fall through to `terminal.svg`.

**Pin / Unpin — out of scope.** `terminal.pin` exists and `agents()` exposes `pinned`, but Herdr pins a *terminal*, and Orca pins a *worktree*. Mapping one onto the other is a guess, not a port. Not built.

**Platform.** Clipboard and reveal are OS-specific. Fallback chain, tried in order, with the first that exists on the machine:

1. Wayland: `wl-copy` / `wl-paste`
2. X11: `xclip -selection clipboard`
3. macOS: `pbcopy`
4. Windows: `clip.exe`

Reveal: `xdg-open` (Linux), `open` (macOS), `explorer` (Windows). Only the Linux/Wayland path is verifiable on this machine; the others are written but unverified, and the spec says so rather than claiming parity.

Acceptance: right-clicking a space shows the new items; Copy Path round-trips through the clipboard.

### Phase 4 — `orca-files` (clone of `files`)

Shipped `files` has **no right-click at all**. Clone it and add:

| Orca item | Herdr |
| --- | --- |
| New File / New Folder | `writeTextFile` (`expected: null`) / `exec mkdir -p` |
| Copy, Copy Path, Copy Relative Path | clipboard chain from Phase 3 |
| Duplicate | `exec cp -r` |
| Open in Terminal | `terminal.open { folder }` |
| Rename | `exec mv` |
| Delete | `exec rm -rf`, confirmed through the shipped `confirm` overlay, props `{title, detail, command: {name, args}}` (`mods/confirm/main.js:2`) |
| Reveal in file manager | platform chain from Phase 3 |
| View File | already: the mod previews inline |

Not implemented, with the reason shown rather than silently omitted: Add as Project (no command), Open in Orca Browser (none), Download (local only).

**Search view.** Orca's explorer switches `files` ↔ `search`. Add a query field running `rg --vimgrep --smart-case` via `exec` in the focused pane's cwd, capped at **200 hits** because `exec` caps at 8 MiB and 30s and would otherwise fail rather than truncate. Clicking a hit opens the file at that line.

Acceptance: right-click creates, renames and deletes a real file in a scratch repo; search finds a known token and opens the right line.

### Phase 5 — `orca-tabs`, a fork of `tabs`

Rev 1 made this a separate `orca-rail` mod writing `layout.select`/`show`/`hide` on `panel` and `panel-body`. That is two writers over one piece of state: `tabs` already does exactly that (`tabs/main.js:32-33`, `:88-89`), so the two would fight, and the rail's own state would be overwritten on every space switch.

Single-writer design: clone `tabs` as `orca-tabs`, and draw Orca's 36px activity strip inside it, above the tab strip or in place of its two panel buttons. `orca-tabs` stays the only writer of `panel`, `panel-body` and the per-space panel memory.

Cost, stated plainly: this is a fork of Herdr's tab bar and stops receiving upstream fixes to it.

Content: **Files** always; **Changes** in git repos. **Checks is not included** — Herdr has no checks mod, and Orca's rule is `gitOnly`, not the "gh remote" condition rev 1 invented.

Acceptance: the rail switches Files/Changes and hides the column on a second press; Changes is absent in a non-git folder; switching spaces restores each space's panel.

## Out of scope, with reasons

| Orca | Why not |
| --- | --- |
| Checks panel | No Herdr mod; would be a new mod over `gh` (separate decision, not part of parity) |
| Pin / Unpin of a worktree | `terminal.pin` pins a terminal; no worktree-shaped target |
| Settings UI (681 files) | Herdr has `app.settings` |
| Native chat ↔ terminal (547) | Herdr agents are terminals |
| Embedded browser, Design Mode (263) | No browser in Herdr |
| `cmd-j` palette (34) | `picker` covers pane/agent jumping |
| Automations, Skills, Artifacts, Dashboard | No backing feature |
| Orca Mobile, remote servers, cloud VMs | Different product |
| Child worktrees, project groups, sleep subtree | Git/Herdr cannot express them |
| Drag files into agent prompts | No drag path from mod to terminal |

## Risks

- **Version drift.** Built against `herdr-app 0.1.13` / `gpui-shell 0.7.1`. Shipped mods are replaced on every start, so `mod.clone` output is a snapshot; a Herdr upgrade that changes `spaces`, `files` or `tabs` internals makes the clones diverge silently. Re-run `herdr-app check` and a screenshot after every upgrade, and re-clone when the upstream changed materially.
- Forking `tabs` (Phase 5) and `spaces`/`files` (Phases 3–4) means upstream fixes stop arriving. Keep each clone's diff minimal so a re-clone stays cheap.
- `exec` caps at 30s and 8 MiB: every read path must be bounded (200 search hits).
- Clipboard shells out through a temp file because `exec` takes no stdin (`herdr.d.ts`: `exec(command, args?, {cwd, on})`).
- Only Linux/Wayland paths are verified; macOS and Windows branches are written but untested here.

## Verification

Per phase: `herdr-app status` reports no errors and no `*.error`, then `herdr-app shot` inspected, plus the phase-specific acceptance above. Committed separately so each phase reverts alone.

## Revisions from rev 1

| Rev 1 said | Wrong because | Rev 2 |
| --- | --- | --- |
| `settings/orca.json` with `ui_font: 13` | That file does not exist; `ui_font` is a family, not a size | Look goes in the layout root; `ui_font: "Geist"` |
| Install Geist, `fc-cache` | Geist ships with Herdr | No install step |
| Clone `menu` for the space menu | The space menu's contents are decided in `spaces/main.js:250` | Clone `spaces`, adjust the `menu` it opens |
| New `orca-rail` mod owning the panel | `tabs` already owns `panel`/`panel-body`; two writers conflict | Fork `tabs` as `orca-tabs`, single writer |
| "Checks only when a gh remote exists" | Invented; Orca uses `gitOnly` | Checks dropped; rule was wrong |
| Icons in `assets/icons/`, list including `circle-check`, `files`, `git-compare` | Those exist; no shared icon dir | Mod-local; 15 actually-missing glyphs |
| Pin / Unpin for worktrees | No worktree-shaped pin target | Out of scope |
| `wl-copy`, `xdg-open` hardcoded | Breaks off Linux | Fallback chain per platform |
