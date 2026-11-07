# Herdr Orca-parity Port — Fix Nine Audit Findings

## Status
All fixes implemented and validated. Every touched mod passes `herdr-app check` and `node --check`.

## Nine Audit Fixes

| # | Summary | Files Changed |
|---|---------|--------------|
| 1 | dead "Open in Terminal" → `terminal.open` {folder} | orca-menu/main.js |
| 2 | group/space worktree rows spread `{ folder: tg.path }` | orca-menu/main.js, orca-spaces/main.js |
| 3 | removed `.hover(s=>s.bg(...))`; rows use `.when(i===this.at,...t.selected)` + `on_hover` | orca-menu/main.js |
| 4 | rows `.whitespace_nowrap()`, label `truncate()`, shortcut `pl(16).flex_none().whitespace_nowrap()` | orca-menu/main.js |
| 5 | corrected tab-case comment to real Orca ranges | orca-menu/main.js |
| 6 | split rows: `pane.split`; `Copy Tab ID`; `Close`; `Close Others` | orca-menu/main.js, orca-tabs/main.js |
| 7 | added `terminal.copy`/`terminal.paste` at top; `pane.focus` before `run` | orca-menu/main.js |
| 8 | created `mods/new-menu/` with 6 rows; geometry matching tab-bar surface | new/ directory |
| 9 | added Home/End and Space to `mods/orca-menu/main.js` | orca-menu/main.js |

## Width Adjustments (spec: size popups to Orca)

| Caller | Old → New | Primitive |
|--------|-----------|-----------|
| `orca-pane/main.js:62` | 220 → 240 | `TerminalContextMenu.tsx:113` `min-w-60` |
| `orca-tabs/main.js:167` | 200 → 208 | `SortableTabContextMenu.tsx:155` `min-w-[13rem]` |
| `orca-tabs/main.js:255` | 250 → 288 | `tab-bar-surface.tsx:232` `w-72` |
| `orca-spaces/main.js:422` | 220 → 208 | `WorktreeContextMenuView.tsx:147` `min-w-52` |
| `orca-spaces/main.js:732,736` | 220 → 176 | No width class → `dropdown-menu.tsx:80` `min-w-[11rem]` |
| `orca-landing/main.js:101` | 250 → 288 | `tab-bar-surface.tsx:232` `w-72` |
| `orca-nav/main.js:90` | 250 → 288 | `tab-bar-surface.tsx:232` `w-72` |

## Unbacked Orca Rows (no Herdr command)
Add to chat, Select All, Quick Commands, Equalize, Set/Clear Pane Title, Copy Session/Terminal/Pane IDs, Clear Screen, Reset Terminal, Pin, Allow Auto-Close, Close Split Pane, Tab Color, external "Open in" apps, omnibox/history search, New Browser/Markdown/Mobile Emulator.

## Checks
```
check passed: mods/orca-menu
check passed: mods/new-menu
check passed: mods/orca-tabs
check passed: mods/orca-pane
check passed: mods/orca-spaces
check passed: mods/orca-landing
check passed: mods/orca-nav

node --check → exit 0 on all 7 main.js files
```

## Files Modified
- `mods/orca-menu/main.js` — 123 insert/43 delete lines
- `mods/orca-menu/mod.json` → `{ "place": "none", "overlay": { "width": 240 } }`
- `mods/orca-menu/clipboard.svg` — new
- `mods/new-menu/main.js` — 5.7K new
- `mods/new-menu/mod.json` → `{ "place": "none", "overlay": { "width": 288 } }`
- `mods/new-menu/{square-terminal,folder-open,git-branch-plus,workflow}.svg` — copied from orca-menu
- `mods/orca-tabs/main.js` — 154 insert/54 delete lines (widths 200→208, 250→288)
- `mods/orca-pane/main.js` — 61 insert/26 delete lines (width 220→240)
- `mods/orca-spaces/main.js` — 285 insert/236 delete lines (widths 220→208/176)
- `mods/orca-landing/main.js` — 9 insert/9 delete lines (width 250→288)
- `mods/orca-nav/main.js` — 68 insert/31 delete lines (width 250→288)

## Peer Coordination
Messages sent to: TabStripFix, PaneHeaderFix, WorktreeListFix, NavCleanup — all acknowledged and their concurrent edits respected.