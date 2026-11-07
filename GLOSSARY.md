# Glossary

Terms that kept being confused while building the Orca layout for Herdr. Each one means
exactly one thing here.

- **Repo** — a git repository on disk. Identified by its git common dir, so a main checkout and
  all of its linked worktrees share one repo.
- **Space** — a Herdr workspace: one folder with tabs. The sidebar row for a space is a *card*.
  A space is not a repo; several spaces can belong to one repo, and a space can belong to none.
- **Main checkout** — a repo's own working copy, the one holding `.git`. Orca marks it
  `isMain`.
- **Linked worktree** — a `git worktree` of a repo, living in its own folder with a `.git` *file*
  pointing back. Secondary to its repo's main checkout by definition.
- **Project group** — the sidebar unit Orca heads with one `SectionHeader`: a repo plus every
  worktree of it. Exactly one header per repo, never one per space.
- **Top branch** — the branch the project group treats as primary: the main checkout's own
  branch. Only the main checkout can carry the `primary` badge; a linked worktree and a plain
  folder workspace carry none.
- **Agent** — a terminal Herdr recognises as running a known program. Its status word is one of
  `blocked | done | working | idle | error`. Orca's richer states (`monitoring`, `permission`,
  `unconfirmed`, `interrupted`) do not exist in Herdr.
- **Indicator** — the status dot at the head of a card or an agent row. A card's shows the most
  urgent status among that card's own agents.
- **Card** — the clickable row for one space inside a project group.
