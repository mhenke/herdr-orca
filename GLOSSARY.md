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
- **Project key** — the string a project group folds on: the repo name, or `space:<id>` for a
  folder space that has no repo. The header and the collapse-all button must derive it the same
  way, or the button collapses a group the header does not close.
- **Top branch** — the branch the project group treats as primary: the main checkout's own
  branch. Only the main checkout can carry the `primary` badge; a linked worktree and a plain
  folder workspace carry none.
- **Worktree row** — one card in a project group, keyed by the worktree's path, not by a space.
  A worktree with no space open in it is still a *row*; clicking it opens a space there.
- **Card** — the clickable row for one space inside a project group.
- **Agent** — a terminal Herdr recognises as running a known program. Its status word is one of
  `working | blocked | done | idle`. That is the whole vocabulary: Herdr folds `error` into
  `blocked` before a mod sees it, and Orca's other states (`monitoring`, `permission`,
  `unconfirmed`, `interrupted`) do not exist here.
- **Mark** — the status glyph at the head of a card or an agent row. Not a dot: the mark differs
  by state — a turning ring for `working`, a question glyph for `blocked` (Herdr's word for
  Orca's `permission`), a filled dot for `done`, a quieter dot for `idle`. A card's mark shows
  the most urgent status among that card's own agents.
- **Review** — the pull request filed for a worktree's own branch, drawn as a mark at the end of
  the card's meta row. A review belongs to a **branch**, never to a repo: two worktrees of one
  repo have different reviews, and a worktree with no PR has none. It is a distinct thing from
  the card, the group and the space.
- **Port** — reproduce Orca's behaviour and result using Herdr's primitives. Not *transcribe*
  (copy its markup literally, impossible here) and not *invent* (a control Orca has no
  counterpart for). See AGENTS.md rule 1.
