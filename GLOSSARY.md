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
  `JSON.stringify([machine, common-dir])`, or `space:<id>` for a folder with no repo. The header
  keys on `foldKey` (`worktree-plan.js`) and collapse-all maps the rendered rows through it via
  `projectKeys`, so they cannot disagree.
- **Top branch** — the branch the project group treats as primary: the main checkout's own
  branch. Only the main checkout can carry the `primary` badge; a linked worktree and a plain
  folder workspace carry none.
- **Worktree row** — one card in a project group, identified by its machine and path, not by an
  open space (`ordered()` builds the rows, `card()` draws them). Two spaces on one checkout are
  one row; a worktree with no space is still a row, and clicking it opens a space there.
- **Card** — the clickable row for one worktree row inside a project group; its agents span every
  space open on that checkout.
- **Worktree menu** — the context menu a card opens, belonging to its worktree rather than to a
  space: `Update` and `Close` exist only while a space is open on the checkout, while `Open in`,
  the copy actions and the worktree actions are offered on a closed checkout too. Herdr's tab is
  still named `space`; the concept is the worktree (`WorktreeContextMenuView.tsx:165-298`).
  _Avoid_: space menu, card menu, workspace context menu.
- **Space-born action** — a menu action that needs a live Herdr space to name its target, as
  opposed to a worktree action, which needs only the checkout's facts. `Update` and `Close` are
  space-born; everything else on a card is worktree-born.
  _Avoid_: space-only, tab action.
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
- **Title-only card** — Orca's template branch for a card with no meta line, no agent rows and
  no lineage toggle (`singleLine`, `worktree-card-surface.tsx:61-67`). It is not a shape this
  port ever draws: the `inline-agents` migration gives every user's card agent rows
  (`normalize-loaded-ui-state.ts:106`), so `singleLine` is false for a migrated card and the
  padding is always the meta-row pair, 5px above and 6px below. A card's padding does not depend
  on whether an agent is running.
- **Review** — the pull request for a worktree's own branch, drawn as a mark at the end of the
  card's meta row. A review belongs to a **branch**, never to a repo: two worktrees of one repo
  have different reviews, and a worktree with no PR has none. It is read from a persisted cache
  keyed `<common-dir>::<branch>`, not fetched while rendering; a cached `null` means "asked, no
  PR". Unlike the project key it carries no machine, but the lookup only ever runs on the local
  machine (`if (!on && info.branch)`), so a remote worktree shows no review rather than a wrong
  one; the hostless key is latent, not a live collision.
- **Port** — reproduce Orca's behaviour and result using Herdr's primitives. Not *transcribe*
  (copy its markup literally, impossible here) and not *invent* (a control Orca has no
  counterpart for). See AGENTS.md rule 1.

- **Page** — a full view that replaces the middle column: Tasks, Automations, Orca Mobile. A
  page is not a sidebar panel: its body occupies the workspace column and is selected in the
  `main` stack, and choosing a workspace or tab shows the terminals again. A row in the sidebar
  may open a page; the page is the destination, not the row.
- **Gap** — a surface Herdr has no backend for, drawn where Orca draws it, with Orca's
  unavailable-state geometry and one sentence naming what is missing. A gap is reachable and
  says why; it is not a dead control and never shows invented data. Removing a gap means
  implementing its backend, not hiding the surface (ADR 0004).
- **Saved project** — a folder someone added to the sidebar that outlives its space. It is a
  project that exists with nothing open on it; a folder that is gone stays listed and marked
  until it is removed, rather than disappearing.
- **Space folder** — the one folder a space is bound to when it is created. Every surface that
  follows the space reads this folder, never the focused terminal's working directory: a
  terminal that `cd`s into another repo does not move the file explorer or its title, and a
  space created on the wrong folder shows that folder everywhere until a new space is opened on
  the right one. The space is the scope; the terminal is only where keystrokes go.
- **Explorer mode** — which body the file explorer draws: **Names** filters the tree by path,
  **Contents** searches file text. One panel, two modes, not two panels: switching keeps both
  query rows mounted, does not run a search, and does not move focus. A search runs only when
  the user types in the Contents row or submits it.
- **Search result** — a Contents-mode answer, grouped by file: the file, its match count and its
  matching lines. A result belongs to a file, and the summary counts matches *and* files, so
  "no results" means no matching text, not an empty tree.
- **Vault scope** — the visibility boundary applied to agents in the Agents panel: `Workspace`
  restricts agents to the active space, `Project` encompasses all spaces sharing the same repository
  or root folder, and `All` includes every live agent across the system.
  _Avoid_: agent filter, session scope, agent mode.
- **Commit action menu** — the split action trigger in the Changes panel pairing the primary commit
  operation with a dropdown of git synchronization and review actions.
  _Avoid_: git dropdown, commit menu, action list.
- **Hosted review creation** — the workflow of drafting, configuring, and publishing a pull request
  on the remote host directly from the Changes panel.
  _Avoid_: PR dialog, review modal, make PR.
