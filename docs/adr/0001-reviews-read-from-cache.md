# 0001 — Read reviews from a cache, write them off the render path

- **Status**: accepted
- **Date**: 2026-11-07

## Context

A card shows the pull request filed for its worktree's branch. Getting that number means
asking GitHub. The obvious implementation is to ask while drawing the card.

That is what shipped first, and it was wrong in three separate ways that only showed up
together:

1. **It ran during render.** `ordered()` is a layout function. Calling `exec` from it makes
   every repaint a network operation.
2. **It hung off the repo group, not the row.** A row built as `{...r.g}` inherited the main
   worktree's review, so every sibling worktree claimed the main branch's PR.
3. **It trusted the branch name alone.** `gh pr list --head main` matches `main` in *any*
   repo. A fork's `main` answered for `stablyai/orca`'s, and a real PR appeared on a branch
   that has none.

Orca does none of this. `buildWorkspaceReviewFacts` reads a persisted cache; the fetch lives
in `src/main` behind `lookupPRByBranchName`, which pins the repo, requires the head owner to
match origin (`pullRequestMatchesHeadRepository`), and prefers the open PR on a page of ten
(`preferOpenPullRequest`). The renderer only ever reads.

## Decision

Split the two halves, as Orca does.

- **Reader** — `reviewOf(info)` is pure: look up `<git-common-dir>::<branch>` in `pr.cache.v2`
  and return it. No I/O, safe in render.
- **Writer** — `lookupPRByBranch` runs from the git refresh cycle (`check()`), never from
  `ordered()`. It hydrates one key at a time, marks the key in flight so a second render cannot
  duplicate the request, and settles to `null` on any failure.
- **Query** — Orca's REST primary path:
  `gh api repos/<owner>/<repo>/pulls?head=<origin-owner>:<branch>&state=all&per_page=10`,
  filtered to the head owner, preferring `open`.
- **State** — `merged_at` decides `merged`; REST reports a merged PR as `closed`, so without
  that check every merged PR painted as closed instead of purple.

## Consequences

- A repaint costs a `localStorage` read, never a request.
- A review belongs to a branch, which is what makes the sibling-worktree bug impossible by
  construction rather than by a fix.
- The cache is keyed per branch, so a same-named branch on a foreign fork cannot collide.
- **Cost**: a settled answer is kept for the life of the process. A PR that merges while the
  app runs keeps its old glyph until the key is re-fetched. This is the shortcut, recorded in
  the code; revisit if a stale badge is ever noticed after a merge.
- **Cost**: two `gh` calls can now run per repo on first sight (the fork probe and the review
  lookup). Both are local-only and both settle.

## Alternatives rejected

- **Fetch in render, memoized by branch.** Still couples layout to network and still needs the
  in-flight guard; the memo becomes the cache with none of the clarity.
- **`gh pr list --head <owner>:<branch>`.** Silently returns `[]` — verified. It looks right
  and does not work, which is worse than the unscoped form because it fails quietly.
- **Trust the branch name, filter nothing.** This is what produced the false positive.
