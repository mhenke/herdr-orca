# Orca parity for Herdr App — design

Date: 2026-11-06
Status: design approved in conversation; phases below are independently shippable.

## Goal

Make `herdr-app` look and behave like Orca, as far as Herdr's model allows, without forking Herdr itself.

## What already exists

Verified in this repo and against the installed app:

- `layouts/orca.json` — three columns at Orca's own widths: left 280 (min 220, max 500), right 280 (min 220), center flexible. Verified rendered at 280/280 with `herdr-app shot` and a pixel scan.
- Shipped `spaces` groups linked worktrees under their checkout (`ordered()`, `spaces/main.js:258-293`), with `├─`/`└─` lines, branch, ahead/behind, and `space.move` persistence.
- Shipped `worktree` mod creates, opens and removes worktrees via `git worktree`, warning on dirty trees and unpushed submodules.
- Shipped `tabs` toggles the Files/Changes column per space and remembers the choice.

None of the above is rebuilt by this design.

## Source of truth for numbers

Read from Orca's renderer, with file:line:

| Thing | Value | Source |
| --- | --- | --- |
| Left sidebar | 280, min 220, max 500 | `ui-slice-agent-actions.ts:48`, `components/sidebar/index.tsx:47-48` |
| Right sidebar | 280, min 220 | `store/slices/editor/actions/right-sidebar-state.ts:41`, `right-sidebar-width.ts:1` |
| Activity bar | 36px tall top, buttons 36×36, icons 16px; side 40px, buttons 40×40, icons 18px | `right-sidebar-top-activity-bar.tsx:39`, `activity-bar-buttons.tsx:156` |
| Activity status dot | 7px at `top-[8px] right-[5px]`, `ring-1` | `activity-bar-buttons.tsx:165-173` |
| Tabs | full height, `px-1.5`, 12px text, active 2px underline | `SortableTab.tsx:214`, `drop-indicator.ts:15-22` |
| Nav rows | 13px, `px-2 py-1.5`, gap 2 | `SidebarNav.tsx:87,97,129` |
| Font | Geist | `assets/main.css:190` |
| Dark tokens | bg `#0a0a0a`, fg `#f0f0f0`, card/popover `#171717`, muted `#262626`, accent `#404040`, border `rgb(255 255 255 / .07)` | `assets/main.css:336-380` |
| Sounds | 9 MP3s | `resources/notification-sounds/` |

## Phases

### Phase 1 — Look and sound (settings and assets only)

No mod code. Files: `settings/orca.json`, `themes/orca.json`, `assets/sounds/*.mp3`, `fonts/`.

- Install Geist: copy `Geist-Regular.ttf`, `Geist-Bold.ttf` from Orca's `docs/site/src/assets/fonts/` to `~/.local/share/fonts/`, run `fc-cache -f`. Verified absent today (`fc-list | grep -ci geist` = 0).
- `settings.json` gains `font: "Geist"`, `ui_font: 13`, `font_ligatures: false`.
- `themes/orca.json`: Herdr's theme shape is `{background, foreground, selection, cursor, ansi[16]}`. Map Orca's dark tokens onto it; `ansi` stays the current terminal palette so terminal output does not shift.
- Sounds: copy `ding.mp3` (done) and `two-tone.mp3` (blocked) to `~/.config/herdr-app/data/sounds/`; set `sounds.done` / `sounds.blocked`.
- Layout look: drop the pane `radius` from 10 to 2, keep the 1px border, set nav/agent row text to Orca's sizes.

Acceptance: `herdr-app status` reports no errors; a screenshot shows Geist, Orca's greys, and unrounded panes.

### Phase 2 — Icons

Files: `assets/icons/*.svg`.

Herdr ships 30 lucide-style SVGs in `mods/workspace-chrome/`. Orca uses lucide for 1,173 of its icon references. Reuse every name that already exists; hand-write the missing glyphs as 24×24 viewBox SVGs with `currentColor`:

`bell`, `bell-off`, `book-open`, `calendar-clock`, `circle-check`, `copy`, `download`, `external-link`, `eye`, `files`, `folder-tree`, `git-compare`, `list-checks`, `plug`, `smartphone`, `trash-2`, `unlink`, `workflow`, `pencil`, `search` (exists), `pin-off` (exists).

Sizes follow Orca: 16px rail, 14px menu, 12–13px inline.

Acceptance: each SVG renders in the app (`herdr-app check` on the consuming mod, then a screenshot).

### Phase 3 — `orca-menu`

Clone, do not rewrite: `herdr-app do mod.clone '{"name":"menu","as":"orca-menu"}'`.

Extend only the `space` case of `items()`. Today it returns Rename, New worktree, Open worktree, Remove worktree (linked only), Close.

Add, in Orca's order:

| Item | Mechanism |
| --- | --- |
| Copy Path | `exec` has no stdin parameter, so write the text to a temp file and run `exec("sh", ["-c", "wl-copy < \"$1\"", "copy", tmp])`. Verified: `wl-paste` returns the exact path. Fall back to `xclip -selection clipboard`. |
| Copy Worktree Name | same, with the space name |
| Open in Terminal | `terminal.open { folder }` |
| Pin / Unpin | reads `agents()`/`terminals()` pinned state |

Items Orca has that are out of scope, with the reason stated in the UI rather than silently missing: New Child Worktree (git cannot express it), Move to group (no group concept), Sleep subtree (no workspace-level sleep), batch delete (single remove only).

Interface constraint discovered: separators are derived from `it[1].endsWith(".close")`, so adding items above Close needs the separator predicate widened. `menuIcon()` maps command suffix to SVG; new commands need entries or they fall through to `terminal.svg`.

Acceptance: right-clicking a space shows the new items; Copy Path puts the real path on the clipboard, verified by `wl-paste`.

### Phase 4 — `orca-files`

Clone `files`. Two additions.

**Row right-click.** Shipped `files` has none. Orca's file row menu (`file-explorer-row-context-menu.tsx`) has 17 items; implement the ones Herdr can do:

| Orca item | Herdr |
| --- | --- |
| New File / New Folder | `writeTextFile` with `expected: null`; mkdir via `exec` |
| Copy / Copy Path / Copy Relative Path | temp file + `sh -c 'wl-copy < "$1"'`, as in Phase 3 |
| Duplicate | `exec cp` |
| Open in Terminal | `terminal.open { folder }` |
| Rename | `exec mv` |
| Delete | `exec` `rm`; confirm via the shipped `confirm` overlay, props `{title, detail, command: {name, args}}` (confirmed at `mods/confirm/main.js:2`) |
| Reveal in file manager | `exec xdg-open <dir>` |
| View File | already: the mod previews inline |

Not feasible: Add as Project (no such command), Open in Orca Browser (no browser), Download (local only), Find in Folder (no search API in `files`).

**Search view.** Orca's explorer switches between `files` and `search` (`rightSidebarExplorerView`). Implement a query field that runs `rg --vimgrep --smart-case` via `exec` in the focused pane's cwd and lists hits; clicking a hit opens the file at that line. Bounded to 200 hits.

Acceptance: right-click creates, renames and deletes a real file in a scratch repo; search finds a known token and opens the right line.

### Phase 5 — `orca-rail`

New mod, `mods/orca-rail/`. Draws Orca's activity strip: 36px tall, 36×36 buttons, 16px icons, active item underlined 2px `inset-x-0 bottom-0`, inactive at 60% opacity.

It owns the Files/Changes/Checks switch: `layout.select { stack: "panel-body", child }` then `layout.show { id: "panel" }`; pressing the active item runs `layout.hide { id: "panel" }`.

Layout gains one node: `panel-header`, a `block` above `panel-body` inside `panel`.

Visibility rules follow Orca's `right-sidebar-activity-visibility.ts`: Files always; Changes in git repos; Checks only when a `gh` remote exists. Herdr cannot express that in a layout, so the mod hides item buttons by reading `exec("git", ["rev-parse", ...])`.

Acceptance: the rail switches panels, hides the column on a second press, and Changes does not appear in a non-git folder.

## Out of scope, with reasons

| Orca | Why not |
| --- | --- |
| Settings UI (681 files) | Herdr has its own `app.settings` |
| Native chat ↔ terminal (547) | Herdr agents are terminals; no chat surface |
| Embedded browser, Design Mode (263) | No browser in Herdr |
| `cmd-j` palette (34) | `picker` covers pane/agent jumping; worktree+host palette is separate work |
| Automations, Skills, Artifacts, Dashboard | No backing feature |
| Orca Mobile, remote servers, cloud VMs | Different product |
| Child worktrees, project groups, sleep subtree | Git/Herdr cannot express them; would need private state and a story for drift |
| Drag files into agent prompts | No drag path from mod to terminal |

## Risks

- Cloned mods stop receiving upstream fixes. `menu` is 153 lines and `files` ~180; both are small enough to own, but a Herdr update that changes the layout node ids (`panel`, `panel-body`) breaks Phase 5.
- `exec` has a 30s limit and 8 MiB output cap; a large `rg` over a big tree must be bounded (200 hits) or it fails rather than truncates.
- Clipboard shells out through a temp file because `exec` takes no stdin (`herdr.d.ts`: `exec(command, args?, {cwd, on})`). If a Herdr release adds a clipboard function, prefer it.
- Geist is installed system-wide, not per-app: other applications will see it.

## Verification

Each phase: `herdr-app status` reports no errors and no `*.error` files, then `herdr-app shot` inspected, plus the phase-specific check above. Phases are committed separately so any one can be reverted alone.
