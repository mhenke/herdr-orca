# 0010 — Per-File Provenance and Mixed Licensing

- **Status**: accepted
- **Date**: 2026-11-07

## Context

The package is Apache-2.0 (matching Herdr App). Its mods derive from two sources with different
terms: Herdr App's shipped mods (Apache-2.0) and Orca's code (MIT, Lovecast Inc.). Some files are
close ports of Orca; many are derived from Herdr App's `defaults/mods/`. A future reader sees MIT
headers inside an Apache repo and asks why.

## Decision

Keep the whole package Apache-2.0. Mark each file that copies or closely derives from Orca (MIT)
or from Herdr App's mods (Apache-2.0) with a header naming its source, and list those files in
`NOTICE`. Full MIT text lives in `NOTICE`. Behavior-only ports (no copied expression) carry no
header; they are judged by the shingle check (Orca overlap above ~30% gets a header).

## Alternatives considered

- **Relicense the whole package to MIT** to match Orca. Rejected: it drops Apache's patent grant
  and Herdr alignment, and Apache-derived mods would still need their notices kept.
- **Relicense only the Orca-derived files to MIT** and leave the rest Apache in the same tree.
  Rejected as a repo-wide policy: it splits the license by file with no tooling to enforce it.
  The per-file header plus `NOTICE` gives the same obligations without splitting the package.
- **No headers, rely on `NOTICE` alone.** Rejected: the notice cannot say which lines came from
  where, and Apache §4(b) requires modified files to be marked.

## Consequences

- New ports that copy Orca expression must add the MIT header and a `NOTICE` entry in the same
  change. Behavior-only ports stay header-free.
- The shingle check is the gate for "close port": run it before merging a new port (see AGENTS.md,
  "Porting code: licenses").
- The 5-gram check is a heuristic, not a legal test; a high score triggers a header, a low score
  does not clear a file of Orca-derived expression that renamed its identifiers.
- **Standalone asset replicas**: When an asset or icon from Orca or Herdr App is duplicated across
  standalone mods to satisfy Rule 9 ("A mod must work alone", e.g. in `mods/orca-tabs/agent-icons/`),
  every replica must carry its source attribution comment and be catalogued in `NOTICE`.
