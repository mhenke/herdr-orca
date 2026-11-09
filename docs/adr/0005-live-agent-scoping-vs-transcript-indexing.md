# 0005 — Scope Agents panel from live host models, not on-disk transcript indexing

- **Status**: amended / partially superseded by [0008](0008-transcript-history-off-the-render-path.md)
- **Date**: 2026-11-07

## Context

Orca's AI Vault panel (`AiVaultPanel.tsx`, `useAiVaultSessions.ts`) presents agent sessions by
indexing on-disk session transcripts and event stores written by tools like Claude Code and Codex
across project directories.

In Herdr, UI mods run inside the GPUI environment without a background indexing daemon or direct
access to internal transcript databases. However, Herdr's host runtime already maintains a
first-class live model of running agent processes (`agents()` in `herdr-app/src/model.rs:528-536`).
Each live agent record tracks an active status (`working`, `blocked`, `done`, `idle`), plus
`space`, `tab`, `app`, and `program` (`AgentInfo` in `defaults/herdr.d.ts`).

When porting the Agents panel and its three-way scope toggle (`Workspace`, `Project`, `All`), we
had to decide whether to crawl and parse on-disk transcript folders from mods or bind directly to
the live agent hierarchy.

## Decision

Bind the Agents panel and its `VaultScopeSwitch` (`AiVaultPanelControls.tsx:87-160`) directly to
Herdr's in-memory live agent collection (`agents()`).

1. **Scope filtering via the space hierarchy**:
   - `Workspace`: agents belonging strictly to the focused space (`a.space === activeSpace.id`).
   - `Project`: agents belonging to spaces that share the active workspace's root repository or
     folder on disk (using `git.cache.v2` in `localStorage` to correlate linked worktrees across spaces).
   - `All`: all live agents across every open space on the machine.
2. **In-memory live query**:
   Filter rows using an `InputState` search bar (`AiVaultPanelHeader.tsx:161-202`).
   *(Amended by [0008](0008-transcript-history-off-the-render-path.md): when bounded transcript history
   was added, the search query and count bar were assigned to past session history, while live agent
   counts moved into the `"Live agents"` section header).*
3. **Orca empty states and session counts**:
   Maintain Orca's session count strip (`AiVaultSessionListBar.tsx:50-54`) and contextual empty
   states (`AiVaultSessionListStates.tsx:39-42`) when a scope or query contains no matching agents.
4. **No invented history**:
   Only real agent processes are displayed. When an agent process exits, it leaves the live list.
   Past session history is handled separately off the render path per ADR 0008.

## Consequences

- **Zero I/O overhead**: Repainting and filtering are pure in-memory operations taking <1ms, avoiding
  file I/O or external process execution during the render loop.
- **Consistent status semantics**: The agent marks in the Agents panel use the exact same status
  vocabulary (`working`, `blocked`, `done`, `idle`) as the worktree cards (`model.rs:554`), avoiding
  divergence between the sidebar and the right panel.
- **Cost**: Past agent sessions do not persist once a terminal tab closes. Persisted session history
  remains absent until Herdr exposes a native historical session store.

## Alternatives rejected

- **Crawling disk transcripts with shell commands (`find`/`cat`/`jq`)**:
  Spawning shell processes or traversing directories on the UI path introduces disk latency, race
  conditions, and brittle dependencies on external tool transcript schemas.
- **Leaving Agents as an unavailable gap panel**:
  Unnecessary, because Herdr already tracks live agents. A live view of active agents fulfills the
  primary operational need of the panel.
- **Faking historical transcripts**:
  Violates Rule 1 and ADR 0004. Invented data teaches the user that the interface cannot be trusted.
