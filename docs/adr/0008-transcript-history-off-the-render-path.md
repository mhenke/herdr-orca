# 0008 — Add bounded transcript history beside the live agent list

- **Status**: accepted, supersedes [0005](0005-live-agent-scoping-vs-transcript-indexing.md)
- **Date**: 2026-11-07

## Context

ADR 0005 bound the Agents panel to Herdr's live `agents()` and rejected crawling on-disk session
transcripts, on three grounds: disk I/O on the UI path, races, and brittle dependencies on other
tools' transcript schemas. Its stated consequence was that past sessions stay invisible.

That left the panel's headline Orca job unported: `AiVaultPanel` exists to find and resume a past
session, not only to list running ones. The gap was reported as the top remaining divergence, and
the live list is a different feature.

## Decision

Keep the live rows exactly as 0005 specified — they still own scope, status marks and
`agent.focus` — and add history as a separate, bounded read that never runs on the render path.

1. **Off the render path**: `init` spawns one scan and a 60-second timer repeats it; render reads
   only the resulting in-memory array. A loading flag prevents overlap, so a slow disk cannot
   queue scans behind each other.
2. **Bounded per run**: the 12 newest transcripts; each read as a 64 KiB head plus a 16 KiB tail
   through `exec`, because the mod-level `readTextFile` caps at 1 MiB and real transcripts reach
   32 MB.
3. **One adapter, named**: the reader knows OMP's jsonl shape (`{"type":"session", id, cwd, title}`
   then message records) behind `scanOmpSessions`. Another CLI is another adapter, not a rewrite.
4. **Resume uses the recorded cwd**: `terminal.open { argv: ["omp", "--resume=<path>"], folder }`,
   never the focused terminal's folder.

## Consequences

- The panel now answers "where was I?" and can resume, at the cost of one bounded shell call per
  minute while the panel is mounted.
- The history is adapter-specific: only OMP sessions appear until other stores get their own
  adapter, and the panel must not imply otherwise.
- A transcript whose schema drifts renders as an error row, not as invented data (Rule 1).
- The status vocabulary is still `working | blocked | done | idle`; a resumed session's status
  comes from the live list once it appears there, not from the transcript.

## Alternatives rejected

- **Keeping 0005's live-only panel**: leaves the panel's primary Orca behavior unported.
- **Indexing transcripts at render time**: the exact latency and race 0005 warned about, and
  still the wrong place for I/O.
- **A host-side index in the app**: a Manifold change outside this package's scope, and it would
  still need the same per-CLI adapters.
