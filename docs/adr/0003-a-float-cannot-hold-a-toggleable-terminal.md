# 0003 — A float cannot hold a toggleable terminal, so it floats agents

- **Status**: accepted
- **Date**: 2026-11-07

## Context

Orca keeps one floating workspace. `floatingTerminal.toggle` — `Mod+Alt+A`, global, allowed
while a terminal has focus — shows and hides it (`src/shared/keybindings/definitions-core-1.ts:280-286`);
it is closed unless the persisted view state said open and the `floatingTerminalEnabled`
setting is on (`src/renderer/src/store/slices/ui/ui-slice-surface-actions.ts:204`,
`floating-workspace-panel-selector.ts:34`). It is a workspace, not a widget: 920x560 by
default, min 420x280, clamped to the viewport minus 48/96 px, anchored bottom-right 24/84,
with 12/36 px maximize margins and bounds stored under
`orca-floating-terminal-panel-bounds-v1` (`floating-terminal-panel-bounds.ts:1-12,74-97`).

Inside it sit Orca's ordinary `TabBar`, `TabGroupSplitNodeTree`, drag layer, resize handles
and window controls (`FloatingTerminalPanelSurface.tsx:1-30,181-206`), creating terminal,
browser and markdown tabs under `FLOATING_TERMINAL_WORKTREE_ID`. Each terminal keeps the
normal hover header, right-hand cluster included: hand off to another agent, show terminal
or resume in chat, split right, close (`TerminalPaneSurface.tsx:352` →
`TerminalPaneHeaderOverlay.tsx:211-343`). Maximize and minimize are commands of their own —
`floatingWorkspace.maximize` (`Mod+Alt+Shift+A` on macOS, unbound on Linux/Windows;
`definitions-core-1.ts:289-307`) and `floatingWorkspace.minimize` (unbound by default;
`definitions-core-2.ts:6-20`).

Herdr's primitive is smaller. A float is `Float { id, content, edge, align, peek, hidden }`
(`src/layout.rs:64-78`), snapped to a node's edge with `MARGIN = 12` px
(`src/window/floats.rs:14`), sized to its content, its frame drawn by the app. Three
properties decide this ADR:

1. **A float's content may be a terminal, but its visibility is not command-addressable.**
   `Content::Terminal` is a legal float content (`src/layout.rs:12-19`), yet visibility lives
   in `Float.hidden`, and `layout.toggle|show|hide` resolves the id through `chrome.find_mut`
   (`src/window.rs:3238-3247`) — a walk over `Node`s only (`src/layout.rs:506-514`).
   `find_float_mut` exists (`src/layout.rs:516`) but only layout sync calls it
   (`src/layout_sync.rs:198-206`), i.e. a layout-file rewrite and reload, not a key.
2. **A mod is a View.** It can draw anything, but it cannot create a terminal: terminals are
   layout `Content`, not children a mod can instantiate.
3. **Empty content collapses the float.** A zero natural size drops both frame and content
   (`src/window/floats.rs:186-198`) — the one way a mod can dismiss itself.

Together: a terminal in a float would be permanently on screen with no chord able to put it
away, and a mod float can be toggled but only draws what a mod can draw.

## Decision

Float `orca-float` (`layouts/orca.json:30-37`: `edge: bottom`, `align: end`, so bottom-right)
and give it the widest content Herdr can toggle — the live agent sessions.

- **Toggle** — the mod's own command `orca-float.toggle`, bound to `ctrl-alt-a`
  (`keys.json:5`): Orca's chord in Herdr's modifier spelling. The mod starts closed, as Orca
  does unless its persisted state said open.
- **Panel** — Orca's `min(920, viewport - 48) x min(560, viewport - 96)`, floored at 420x280
  (`mods/orca-float/main.js`), placed bottom-right by the layout.
- **Chrome** — a "Floating Workspace" / "Live agent sessions" header and a `×` that sets
  `open = false`, i.e. the empty-content collapse.
- **Rows** — a 10px dot for Orca's three visible states (`AgentStateDot`), the title falling
  back title → app → program, and `app · space · tab`; clicking focuses the agent.
- **Repaint** — `agents()` does not notify, so the set is re-read on a 1 s timer and redrawn
  only when it changed (`mods/orca-agents` uses the same loop).

Named divergences, each a consequence of the three properties above:

- **No tabbed workspace, no splits, no browser or markdown tabs.** The float lists agent
  sessions instead of hosting a second workspace.
- **No resize handles, maximize, minimize, or stored bounds.** The layout places the float and
  its content sizes it; Orca's 920x560 is reproduced as content size, not as a draggable
  window the mod can persist.
- **The pane header's four actions have no surface inside the float.** `mods/orca-pane` ports
  split and close for the main terminals (`mods/orca-pane/main.js:72-83`); inside the float
  there is no terminal pane for them to act on.

## Consequences

- `ctrl-alt-a` opens a panel over the workspace that the same chord or the `×` dismisses —
  the toggle Orca's shortcut promises.
- The panel cannot be mistaken for a second workspace: it lists live sessions, and a click
  lands in the real one.
- **Cost**: an agent's terminal is one keystroke away (`agent.focus`), not one glance;
  Orca's read-only peeking at pane contents inside the panel is gone.

## Alternatives rejected

- **A terminal as the float's content.** `Content::Terminal` would be a genuine terminal, but
  it renders for the life of the layout: `layout.toggle` cannot find a float, so no chord
  could hide it. A permanently open 920x560 terminal over the workspace is worse than no panel.
- **Rewrite the float's `hidden` from a mod.** Layout sync is the file→chrome path
  (`src/layout_sync.rs:198-206`) — an edit plus reload, not a command — and it would mean a
  mod writing the user's layout.
- **A status pill only.** That is what `RECIPE.md` used to say, and it drops the list Orca
  actually shows; the agent list is the part of the panel Herdr can render honestly.
- **Starting open.** Orca starts closed and restores persisted state; a float that opens
  itself would cover the workspace on every launch with no key pressed.
