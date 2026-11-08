# 0007 — Porting Orca terminal panel capabilities, actions, and menu routing

- **Status**: accepted
- **Date**: 2026-11-07

## Context

Orca's terminal panel is governed by two complementary components:
1. **The Terminal Pane Header Overlay** (`TerminalPaneHeaderOverlay.tsx`, `terminal.css`): A 24px header
   bar mounted over each terminal pane providing title display, click-to-edit renaming, a centered
   drag handle (`.pane-title-drag-handle`), and contextual action buttons (`.pane-title-actions`).
2. **The Terminal Context Menu** (`TerminalContextMenu.tsx`, `use-terminal-pane-context-menu.ts`):
   The primary action surface for terminal operations, defining standard actions across clipboard,
   terminal management, layout splits, and agent session workflows.

When evaluating parity between Orca's terminal panel and our `herdr-orca` port, five primary feature
groups must be accounted for:

1. **Clipboard & Buffer Operations**:
   - `Copy` (`terminal.copySelection`, `TerminalContextMenu.tsx:204-208`).
   - `Paste` (`terminal.paste`, `TerminalContextMenu.tsx:222-226`).
   - `Select All` (`TerminalContextMenu.tsx:217-221`).
2. **Terminal Maintenance & Reset**:
   - `Clear Screen` (`onClearScreen`, `TerminalContextMenu.tsx:359-362` $\to$ clears scrollback and screen).
   - `Reset Terminal` (`onResetTerminal`, `TerminalContextMenu.tsx:363-369` $\to$ resets terminal input modes).
3. **Identifiers**:
   - `Copy Terminal ID` (`TerminalContextMenu.tsx:337-343`).
   - `Copy Pane ID` (`TerminalContextMenu.tsx:344-347`).
   - `Copy Session ID` (`TerminalContextMenu.tsx:328-336`).
4. **Layout & Windowing**:
   - `Split Terminal Right` and `Split Terminal Down` (`TerminalContextMenu.tsx:265-280`).
   - `Expand Pane` / `Collapse Pane` (`TerminalContextMenu.tsx:293-307`).
   - `Equalize Pane Sizes` (`TerminalContextMenu.tsx:281-292`).
   - `Close Pane` / `Close tab` (`TerminalContextMenu.tsx:348-356`).
5. **Agent Continuation, Handoff & Chat**:
   - `Hand Off to Another Agent` (`MessageSquarePlus` in `TerminalPaneHeaderOverlay.tsx:212-238` and
     `AgentSessionContinuationMenuItem.tsx:1-23` in `TerminalContextMenu.tsx:236-238`).
   - `Fork Agent Session…` (`TerminalContextMenu.tsx:239-245`).
   - `Copy Context` (`AgentSessionContextCopyMenuItem.tsx:1-18`).
   - `Continue in Chat UI` / `Continue with Terminal Agent` (`TerminalContextMenu.tsx:247-263`).

### Host Architecture Differences

Porting these behaviors to Herdr exposes core architectural divergences:

- **Host Model & Commands**: Herdr runs terminals as native pty processes or sub-agents managed by `hc`.
  It provides atomic commands (`pane.split`, `pane.close`, `pane.zoom`, `pane.swap`, `terminal.copy`,
  `terminal.paste`, `terminal.park`, `terminal.keep`, `tab.rename`). It has no native chat view, no
  structured session entity separate from terminal addresses, and no continuation protocol.
- **Agent Handoff Implementation**: In Orca, `prepareAgentSessionContinuationFromPane`
  (`terminal-agent-session-continuation.ts:45-91`) parses on-disk session transcripts from TUI agents
  (Claude Code JSONL, Codex rollout files, Aider history) or serializes 800 lines of xterm scrollback,
  extracts prompt and assistant message state, and opens a modal session continuation dialog. Herdr
  has no transcript extractor or continuation wizard.
- **Terminal Right-Click Routing**: Herdr's layout engine routes right-clicks on the terminal canvas
  according to the layout root's `"terminal_menu"` property (`defaults/herdr.d.ts:235`,
  `defaults/AGENTS.md:265`, `src/window.rs:3492`). If `"terminal_menu"` is omitted, Herdr falls back to
  its stock `menu` mod (`defaults/mods/menu/main.js`), which lacks Orca's terminal actions.

## Decision

Port Orca's terminal panel features using Herdr primitives where supported, provide honest equivalents
where UI abstractions differ, explicitly omit features lacking a backend per Iron Rule 1 (port, do not
transcribe, never invent), and route all terminal right-clicks through `orca-menu`.

### 1. Clipboard & Buffer Actions
- **`Copy` & `Paste`**:
  Implemented in `mods/orca-menu/main.js:57, 61`. Because `terminal.copy` and `terminal.paste` act on the
  focused terminal, `orca-menu` focuses the clicked pane before invoking the command (`main.js:287-293`).
- **`Select All`**:
  Herdr has no text range selection in the terminal canvas. Ported honestly in `mods/orca-menu/main.js:60, 321-324`:
  the action executes `hc read <terminal>` to dump the buffer and scrollback, then writes it to the
  system clipboard via `clip.js`.

### 2. Terminal Identity & Diagnostics
- **`Copy Terminal ID` & `Copy Pane ID`**:
  Implemented in `mods/orca-menu/main.js:88-89, 319` using `clip.js` (`wl-copy` / `xclip` / `pbcopy`).
- **`Copy Session ID`**:
  Omitted. Herdr has no session entity distinct from terminal address and pane ID.

### 3. Screen Maintenance
- **`Clear Screen`**:
  Implemented in `mods/orca-menu/main.js:95, 327` by issuing `hc keys <terminal> ctrl+l`.
- **`Reset Terminal`**:
  Implemented in `mods/orca-menu/main.js:96, 328` by issuing `hc send <terminal> reset` to restore
  sane terminal line and cursor modes.

### 4. Agent Handoff, Continuation & Fork (`orca-handoff`)
- **`Copy Context`**:
  Implemented in `mods/orca-menu/main.js:63, 332-337` and backed by `transcript.js`. Directly captures
  terminal scrollback via `hc read <terminal>`, cleans ANSI escape sequences and control characters via
  `cleanAgentSessionForkTranscript` (`agent-session-fork-context.ts:35-66`), bounds to 36,000 chars,
  and copies to system clipboard via `clip.js` without opening a dialog. Matches Orca's
  `copyAgentSessionContextFromMenuPane` (`terminal-pane-menu-agent-session-actions.ts:58-65`).
- **`Hand Off to Another Agent`**:
  Implemented in `mods/orca-handoff/` and exposed in both the pane header actions
  (`mods/orca-pane/main.js:141-149`, `MessageSquarePlus`, `TerminalPaneHeaderOverlay.tsx:212-238`)
  and the context menu (`mods/orca-menu/main.js:61, 339-347`, `TerminalContextMenu.tsx:236-238`).
  Captures live terminal context via `hc read`, synthesizes the exact Orca continuation prompt
  (`buildAgentSessionContinuationPrompt`, `agent-session-continuation.ts:57-140`), provides a target
  agent picker (Claude Code, OpenCode, Codex, Pi, Gemini, Aider, Antigravity), and on submit executes
  `tab.new` with the target agent's `argv` and the synthesized continuation prompt as `task`.
- **`Fork Agent Session…`**:
  Implemented in `mods/orca-handoff/` and exposed in the context menu (`mods/orca-menu/main.js:62, 349-357`).
  Ports `TerminalAgentSessionForkDialog.tsx:1-132`. Captures terminal scrollback, generates the markdown
  fork prompt via `buildAgentSessionForkPrompt` (`agent-session-fork-context.ts:130-160`), and allows
  copying the fork prompt or launching an independent fork tab with `tab.new`.
- **`Add to chat` / `Continue in Chat UI`**:
  Omitted. Herdr is strictly an interactive terminal and agent host without a chat webview leaf.
- **Herdr Sub-Agent Management**:
  Sub-agents running under a parent terminal expose `"Send back to <parent>"` via `terminal.park`
  (`mods/orca-menu/main.js:93`), mapping Herdr's native sub-agent hierarchy.

### 5. Layout Routing (`terminal_menu: "orca-menu"`)
- The layout root in `layouts/orca.json` must declare:
  ```json
  "terminal_menu": "orca-menu"
  ```
  This ensures that right-clicking anywhere on the terminal canvas opens `orca-menu` rather than
  Herdr's stock `menu`. Right-clicking the pane header bar (`mods/orca-pane/main.js:110-114`) explicitly
  opens `orca-menu` as well.

### 6. Pane Header Overlay Affordances
- **Title Display**:
  Ported in `mods/orca-pane/main.js:50, 89`. Displays the named tab title or terminal title. Inline
  renaming in the header is omitted because Herdr lacks inline input controls in pane headers; renaming
  is handled via the `"Set Title…"` context menu action (`tab.rename`).
- **Drag Grip Handle**:
  Ported in `mods/orca-pane/main.js:90-143`. Centered 32px grip handle (`.pane-title-drag-handle` from
  `TerminalPaneHeaderOverlay.tsx:188-196`, `terminal.css:275-306`) rendered when `paneCount > 1` on hover,
  with `cursor_grab()`, `active(s => s.cursor_grabbing())`, and a 6-dot grip affordance. Clicking it
  opens the pane layout & move/split popup menu.
- **Split & Close Buttons**:
  Ported in `mods/orca-pane/main.js:145-166`. Hovering the header reveals `SquareSplitVertical`
  (`pane.split:right`), `split-down` (`pane.split:down`), and `X` (`pane.close`).
- **Full Quadrant Split & Swap Menus**:
  Ported in `mods/orca-menu/main.js:76-89`. Context menu provides 4-direction splits (`Split Terminal Right`,
  `Split Terminal Left`, `Split Terminal Down`, `Split Terminal Up`) and 4-direction swaps (`Swap with Left`,
  `Swap with Right`, `Swap with Above`, `Swap with Below`) when multiple panes exist.

## Consequences

### Positive
- **Parity with Orca Menu Hierarchy**: The context menu order matches `TerminalContextMenu.tsx:204-370`
  (Copy, Select All, Paste, Quick Commands, Hand Off, Fork, Copy Context, Splits, Expand/Collapse, Title/ID, Close, Clear, Reset).
- **Full Agent Continuation & Fork Support**: Handing off to another agent, forking sessions, and copying
  clean session context are backed by real buffer capture and Orca's prompt synthesis algorithms.
- **Consistent Right-Click Behavior**: Configuring `terminal_menu: "orca-menu"` ensures identical menus
  whether right-clicking the terminal buffer or the pane header.
- **Working Screen Controls**: Clear screen and reset terminal work non-destructively through `hc`
  without requiring window focus tricks.

### Negative / Gaps
- **Scrollback-Bound Handoff**: Because Herdr does not maintain historical transcript disk indexes,
  handoffs capture up to the last 36,000 characters of terminal scrollback (`hc read`) rather than the
  complete offline conversation history.
- **No Inline Header Rename**: Editing a pane title requires opening the `tab.rename` dialog instead of
  typing directly into the header bar.
- **Buffer-Based Select All**: Selecting all text puts the buffer into the clipboard rather than
  highlighting visual text on screen, as the VT layer does not expose arbitrary selection geometry to mods.

## Alternatives Rejected

1. **Stubbing "Hand Off to Another Agent" with a Toast**:
   Displaying a button that shows "Not supported in Herdr" violates Rule 11 and clutters the title actions.
2. **Leaving `terminal_menu` unset in `layouts/orca.json`**:
   Left the terminal canvas showing Herdr's stock `menu` (only 6 basic items), causing users to miss
   Copy, Clear Screen, and Terminal ID unless they happened to right-click the narrow 24px header.
3. **Simulating Inline Header Text Input**:
   Mounting an unmanaged `InputState` inside a hover-revealed 24px header caused focus traps and IME
   desync in testing. Relying on `tab.rename` matches Herdr's stable modal pattern.
