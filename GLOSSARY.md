# Glossary

Terms that kept being confused while building the Orca layout for Herdr. Each one means
exactly one thing here.

- **Repo** — a git repository on disk. Identified by its git common dir, so a main checkout and
  all of its linked worktrees share one repo.
- **Space** — a Herdr space (`space.new`): one folder with tabs. A space is not a repo; several spaces can
  belong to one repo, a space can belong to none, and two spaces on one checkout share one card.
- **Main checkout** — a repo's own working copy, the one holding `.git`. Orca marks it
  `isMain`.
- **Linked worktree** — a `git worktree` of a repo, living in its own folder with a `.git` *file*
  pointing back. Secondary to its repo's main checkout by definition.
- **Project group** — the sidebar unit Orca heads with one header: a repo on one machine
  plus every worktree of it. Exactly one header per repo, never one per space.
- **Project key** — the string a project group folds on: the repo identity
  repo identity (machine and common dir), or `space:<id>` for a folder with no repo. The header
  and collapse-all use the same key, so they cannot disagree.
- **Top branch** — the branch the project group treats as primary: the main checkout's own
  branch. Only the main checkout can carry the `primary` badge; a linked worktree and a plain
  folder workspace carry none.
- **Card** — the clickable row for one worktree inside a project group, identified by its machine
  and path, not by a space. Two spaces on one checkout are one card; a worktree with no space is
  still a card, and clicking it opens a space there. Its agents span every space open on that checkout.
- **Worktree menu** — the context menu a card opens. It belongs to the worktree, not to a space: `Update` and `Close` need an open space on the checkout; the rest works on a closed checkout too.
  _Avoid_: space menu, card menu, workspace context menu.
- **Pane menu** — the context menu opened from a pane's header or surface. Evaluates the pane
  and terminal identity, providing clipboard, screen maintenance, split, and agent continuation actions.
  _Avoid_: terminal menu, terminal context menu, buffer menu, right-click popup.
- **Space-born action** — a menu action that needs a live Herdr space to name its target, as
  opposed to a worktree action, which needs only the checkout's facts. `Update` and `Close` are
  space-born; everything else on a card is worktree-born.
  _Avoid_: space-only, tab action.
- **Agent** — a terminal Herdr recognises as running a known program. Its status word is one of
  `working | blocked | done | idle`
  vocabulary: Herdr folds `error` into `blocked` before a mod sees it, and Orca's other
  states (`monitoring`, `permission`, `unconfirmed`, `interrupted`) do not exist here.
- **Tab** — one space's set of panes, drawn in the tab rail. A tab belongs to exactly one space,
  and a pane to exactly one tab; moving a tab to another space is not `space.move`.
  _Avoid_: workspace, window, session.
- **Pane** — an individual viewport slot inside a tab. Holds either a running terminal process or an
  embedded mod view.
  _Avoid_: window, tile, split, view.
- **Mod pane** — a pane hosting a mod view (such as a file tree or git diff) rather than a shell terminal.
  Sits beside terminal panes inside a tab's layout tree.
  _Avoid_: widget pane, plugin window, tool split.
- **Terminal split** — the division of a tab's viewport into two adjacent panes, either vertically
  (`right`, `left`) or horizontally (`down`, `up`).
  _Avoid_: tab split, window split, column split.
- **Split direction** — the orientation of a new pane relative to an existing one: `Right`, `Left`,
  `Down`, or `Up`.
  _Avoid_: split orientation, layout direction, axis.
- **Drop quadrant** — one of four peripheral zones on a terminal pane (`left`, `right`, `bottom`,
  `top`) where releasing a dragged tab or pane grip splits the viewport in that direction.
  _Avoid_: drop zone, pane quadrant, split area.
- **Drop indicator** — the accent-colored preview overlay highlighting the target quadrant where
  a dragged pane or tab will land.
  _Avoid_: drop outline, blue box, split preview.
- **Pane grip** — the top-center affordance on a pane header that initiates moving or splitting
  the pane by dragging.
  _Avoid_: header handle, drag bar, move grip.
- **Tab reordering** — changing the position of a tab within its current space's tab strip by
  dragging horizontally or using move menu actions.
  _Avoid_: tab shift.
- **Tab migration** — transferring an active tab and its running terminals from one space into another.
  Distinct from tab reordering, which only changes position within the current space.
  _Avoid_: tab move, space move, workspace transfer.
- **Tab color** — the accent tint assigned to a tab, drawn as an indicator dot before the label.
  _Avoid_: tab theme, tab badge, tab tag.
- **Tab color swatch** — the compact circular color button in the tab context menu used to select
  an accent tint from Orca's 10-color palette.
  _Avoid_: color picker, color button, tint row.
- **Tab group** — Orca's multi-column container allowing multiple parallel tab strips in one workspace.
  Not a Herdr construct: Herdr maintains strictly one tab strip per space.
  _Avoid_: split tab bar, tab column, workspace column.
- **Session capture** — the sanitised, bounded tail of a pane's scrollback that seeds a fork or a
  handoff. It is a raw digest of the session, never the session, and carries no instruction framing.
  _Avoid_: transcript, log dump, history.
- **Fork prompt** — a markdown instruction envelope enclosing a session capture that directs the
  *same* agent to treat the prior transcript as background context for an independent session.
  _Avoid_: fork context, fork template.
- **Continuation prompt** — a markdown instruction envelope enclosing a session capture that directs
  a *different* agent to continue from that stopping point.
  _Avoid_: handoff prompt, continuation context.
- **Resume** — reopening a past session in its own CLI, in the folder the session recorded. It is
  the same session; nothing is seeded and no new prompt is written.
  _Avoid_: restore, reopen, continue.
- **Fork** — a new session of the *same* agent, seeded with a fork prompt, so the earlier work
  carries over while the original stays untouched. If in a git repository, the fork opens in an
  isolated branch; otherwise it opens in an independent tab in the same folder.
  _Avoid_: clone, duplicate, branch.
- **Handoff** — a new session of a *different* agent, seeded with a continuation prompt. Fork and
  handoff share their mechanism; they differ only in whether the agent changes.
  _Avoid_: continue, transfer, hand-over.
- **Mark** — the status glyph at the head of a card or agent row. Its shape differs by state: a turning ring for `working`, a question glyph for `blocked`, a filled dot for `done`, a quieter dot for `idle`. A card shows the most urgent status among its own agents.
- **Status mark** — the state a mark encodes: exactly `working`, `blocked`, `done` or `idle`.
  `done` means finished and not yet seen; a card rolls up the most urgent state of its own agents.
- **Card title** — the 13px line a card leads with: the worktree's display name. Orca derives
  an unpinned display name from the branch, so on an
  untouched worktree the title *is* the branch. Named worktrees keep their name.
- **Card meta** — the 11px line under the title: the branch for a git worktree, or the folder's last segment for a folder workspace. Dropped when its text equals the title, so the same string never appears twice.
- **Review** — the pull request for a worktree's own branch, shown as a mark at the end of the card's meta row. A review belongs to a branch, not a repo, so two worktrees of one repo can have different reviews. Read from a cache, never fetched while rendering. Creating a pull request updates the badge.
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
  restricts agents to the active space, `Repo` encompasses all spaces sharing the same repository
  or root folder, and `All` includes every live agent across the system.
  _Avoid_: agent filter, session scope, agent mode.
- **Commit action menu** — the split action trigger in the Changes panel pairing the primary commit
  operation with a dropdown of git synchronization and review actions.
  _Avoid_: git dropdown, commit menu, action list.
- **Hosted review creation** — the workflow of drafting, configuring, and publishing a pull request
  on the remote host directly from the Changes panel.
  _Avoid_: PR dialog, review modal, make PR.
