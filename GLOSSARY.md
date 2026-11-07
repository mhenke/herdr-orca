# Glossary

Terms that kept being confused while building the Orca layout for Herdr. Each one means
exactly one thing here.

- **Repo** — a git repository on disk. Identified by its git common dir, so a main checkout and
  all of its linked worktrees share one repo.
- **Space** — a Herdr workspace: one folder with tabs. A space is not a repo; several spaces can
  belong to one repo, a space can belong to none, and two spaces on one checkout share one card.
- **Main checkout** — a repo's own working copy, the one holding `.git`. Orca marks it
  `isMain`.
- **Linked worktree** — a `git worktree` of a repo, living in its own folder with a `.git` *file*
  pointing back. Secondary to its repo's main checkout by definition.
- **Project group** — the sidebar unit Orca heads with one `SectionHeader`: a repo on one machine
  plus every worktree of it. Exactly one header per repo, never one per space.
- **Project key** — the string a project group folds on: the repo identity
  `JSON.stringify([machine, common-dir])`, or `space:<id>` for a folder with no repo
  (`mods/orca-spaces/main.js:310`, `:657-659`). The header keys on `foldKey` (`:671`) and
  collapse-all maps the rendered rows through it via `projectKeys` (`:70-71`, `:664-667`), so
  they cannot disagree.
- **Top branch** — the branch the project group treats as primary: the main checkout's own
  branch. Only the main checkout can carry the `primary` badge; a linked worktree and a plain
  folder workspace carry none.
- **Worktree row** — one card in a project group, identified by its machine and path, not by an
  open space (`mods/orca-spaces/main.js:424-438`). Two spaces on one checkout are one row; a
  worktree with no space is still a row, and clicking it opens a space there (`:462-470`).
- **Card** — the clickable row for one worktree row inside a project group; its agents span every
  space open on that checkout.
- **Agent** — a terminal Herdr recognises as running a known program. Its status word is one of
  `working | blocked | done | idle` (`herdr-app/src/model.rs:528-536`). That is the whole
  vocabulary: Herdr folds `error` into `blocked` before a mod sees it (`:532`), and Orca's other
  states (`monitoring`, `permission`, `unconfirmed`, `interrupted`) do not exist here.
- **Mark** — the status glyph at the head of a card or an agent row. Not a dot: the mark differs
  by state — a turning ring for `working`, a question glyph for `blocked` (Herdr's word for
  Orca's `permission`), a filled dot for `done`, a quieter dot for `idle`. A card's mark shows
  the most urgent status among that card's own agents.
- **Status mark** — the state a mark encodes: exactly `working`, `blocked`, `done` or `idle`
  (`herdr-app/src/model.rs:528-536`). `done` means finished and not yet seen (`:533`); a card
  rolls up the most urgent state of its own agents.
- **Card title** — the 13px line a card leads with: the worktree's display name. Orca derives
  an unpinned display name from the branch (`display-name-provenance.ts:17-19`), so on an
  untouched worktree the title *is* the branch. Named worktrees keep their name.
- **Card meta** — the 11px line under the title: the branch for a git worktree, the folder's own
  last segment for a folder workspace. **Not a second title.** Orca's classic template prints it
  unconditionally whenever a branch exists (`default-workspace-card.json`, `vars.branch`), so on
  a worktree whose title is its branch Orca genuinely draws the same string twice. We drop that
  repeat: the meta line is the only part removed, and it is removed only when its text equals
  the title. This is a deviation, not a port — record it as one.
- **Title-only card** — a card with no meta line and no agent rows. It collapses to one line with
  8px padding; any card with a meta line or agent rows takes 5px/6px
  (`worktree-card-surface.tsx:67`, `singleLine` in the same template). Both facts derive from
  the meta text, never from a separate flag.
- **Review** — the pull request for a worktree's own branch, drawn as a mark at the end of the
  card's meta row. A review belongs to a **branch**, never to a repo: two worktrees of one repo
  have different reviews, and a worktree with no PR has none. It is read from a persisted cache
  keyed `<common-dir>::<branch>`, not fetched while rendering (`mods/orca-spaces/main.js:82-88`,
  `:350-357`); a cached `null` means "asked, no PR".
- **Port** — reproduce Orca's behaviour and result using Herdr's primitives. Not *transcribe*
  (copy its markup literally, impossible here) and not *invent* (a control Orca has no
  counterpart for). See AGENTS.md rule 1.
