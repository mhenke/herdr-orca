# 0009 — Invariant Space Scope and Decoupled Review Store with TTL Invalidation

- **Status**: accepted
- **Date**: 2026-11-07

## Context

Two architectural fault lines created friction across multiple UI mods:

1. **Space Folder Invariant Violation**:
   `GLOSSARY.md` defines a space folder as the invariant anchor for all surfaces that follow the
   space ("the space is the scope; the terminal is only where keystrokes go"). However,
   `orca-files`, `orca-changes`, `worktree-plan.js`, and `orca-menu` each implemented divergent
   heuristics inspecting the live terminal's `cwd`. When a terminal changed directory (e.g. `cd src`
   or `cd /tmp`), the file explorer re-rooted, expanded folder states were wiped, relative path
   computations developed distorted `../` prefixes, and sidebar cards were ejected from their repo
   groups or hijacked by other repositories.
2. **Review Cache Trap and Mod Isolation**:
   ADR 0001 established reading reviews from a cache off the render path. However, the cache
   (`pr.cache.v2`) was encapsulated privately inside the `Spaces` view instance with zero TTL.
   When a branch was first checked before PR creation or if the GitHub CLI was rate-limited,
   `{ data: null }` was permanently stored in `localStorage`, causing future probes to short-circuit
   forever. Furthermore, when `orca-changes` drafted and published a hosted review via `gh pr create`,
   it explicitly could not update or invalidate the review cache, leaving sidebar cards showing no review.

## Decision

1. **Anchor Scope Strictly to `space.folder`**:
   All space-scoped surfaces (`orca-files`, `orca-changes`, `orca-menu`, `worktree-plan.js`) resolve
   their root folder strictly as `space.folder`. Terminal execution directory changes never re-root
   the explorer, alter workspace identity keys (`where`), or move sidebar cards.
2. **Decouple Review Store with Orca TTLs**:
   Extract review caching into a shared `review-store` module (`mods/orca-spaces/review-store.js` and
   `mods/orca-changes/review-store.js`) implementing Orca's refresh pacing:
   - `FOUND_REVIEW_TTL_MS = 60_000` (1 minute for discovered pull requests).
   - `NO_REVIEW_REFRESH_INTERVAL_MS = 15 * 60_000` (15 minutes for negative results).
   - Out-of-band expiration replaces the permanent negative cache trap.
   - Paced background probing (`MAX_INFLIGHT_PR_LOOKUPS = 2`) eliminates 250ms process bursts.
3. **Cross-Mod Invalidation on Hosted Review Creation**:
   Upon successful `gh pr create`, `orca-changes` immediately derives the repository git common
   directory, parses the newly created PR number/URL, records the entry in `review-store`, and
   broadcasts via `setShared("pr.cache.v2", cache)` so sidebar badges appear instantly.
4. **Git Common Directory Project Scoping for Live Agents**:
   In `orca-agents`, `Project` vault scope resolves spaces that share the repository git common
   directory rather than checking raw path string prefixes, correctly incorporating sibling linked
   worktrees.

## Consequences

- Terminal navigation inside workspaces is completely safe: `cd`ing into subdirectories or outside
  the workspace never disrupts explorer trees, breadcrumbs, or sidebar cards.
- Newly published PRs appear on sidebar cards immediately upon creation.
- Negative review lookups re-probe after 15 minutes, preventing permanent badge omission.
- Memory and child process execution are bounded across unopened worktrees.
