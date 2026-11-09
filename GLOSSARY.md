# Glossary

Terms that kept being confused while building the Orca layout for Herdr. Each one means
exactly one thing here.

- **Repo** — a git repository on disk. Identified by its git common dir, so a main checkout and
  all of its linked worktrees share one repo.
- **Space** — a Herdr space (`space.new`): one folder with tabs. A space is not a repo; several spaces can
  belong to one repo, a space can belong to none, and two spaces on one checkout share one card.
- **Main checkout** — a repo's own working copy, the one holding `.git`. Orca marks it
  `isMainWorktree` (`src/shared/sidebar-list/workspace-rows.ts:40`). The badge word is
  `primary`; the term is *Main checkout*.
- **Linked worktree** — a `git worktree` of a repo, living in its own folder with a `.git` *file*
  pointing back. Secondary to its repo's main checkout by definition.
- **Project group** — the sidebar unit Orca heads with one header: a repo on one machine
  plus every worktree of it. Exactly one header per repo, never one per space.
- **Project key** — the string a project group folds on: the repo identity (machine and common dir),
  or `space:<id>` for a folder with no repo. The header and collapse-all use the same key, so they cannot disagree.
- **Main branch** — the branch the project group treats as its main: the main checkout's own
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
- **Tab menu** — the context menu opened by right-clicking a tab in the top tab strip (`SortableTabContextMenu.tsx`).
  Evaluates tab identity, controlling tab splitting, settling (pinning), bulk closure, title renaming, and tab color tinting.
  _Avoid_: tab bar menu, tab popup, tab right-click.
- **Group header menu** — the context menu opened from a project group header row (`repo-header-project-actions.tsx`).
  Evaluates repository identity, providing worktree provisioning, repository path copying, and workspace lifecycle actions across the repo.
  _Avoid_: repo menu, project menu, group context menu.
- **Explorer menu** — the context menu opened from an entry row in the File Explorer (`file-explorer-row-context-menu.tsx`).
  Actions adapt strictly to entry kind: directories provide creation, navigation, and terminal launching; files provide duplication, in-place viewing, and relative path copying.
  _Avoid_: file menu, directory menu, tree context menu.
- **Change entry menu** — the context menu opened from an uncommitted file row in the Changes panel (`entry-context-menu.tsx`).
  Provides diff and file viewing, conflict resolution choices, clipboard path copying, file manager reveal, and cross-navigation to the file explorer.
  _Avoid_: diff menu, git context menu, change row menu.
- **Space-born action** — a menu action that needs a live Herdr space to name its target, as
  opposed to a worktree action, which needs only the checkout's facts. `Update` and `Close` are
  space-born; everything else on a card is worktree-born.
  _Avoid_: space-only, tab action.
- **Agent** — a terminal that reports status (`AgentInfo`). Its `program` may be the generic
  `agent` entry (`programs.json`, key `agent`) when Herdr has no entry for what it runs. Its status word is one of
  `working | blocked | done | idle`
  vocabulary: Herdr folds `error` into `blocked` before a mod sees it, and Orca's other
  states (`monitoring`, `permission`, `unconfirmed`, `interrupted`) do not exist here.
- **Startable agent** — a program the program table can start as an agent (`knownAgents()`): a
  `run` argv plus an installed check. It is not an **Agent** yet — an Agent is a running
  terminal that reports status — and one startable agent can be running as several Agents at
  once.
  _Avoid_: harness, agent type, available agent.
- **Create menu** — the `+` menu at the end of the tab rail: the create rows (terminal, file
  browser, worktree) and, under them, every startable agent this machine has, then the first
  two it could install. One popup, one list.
  _Avoid_: new-tab dialog, plus menu, omnibox.
- **Model list** — the models a startable agent offers, shown as a second step of the create
  menu: Orca's alias seed where the set is universal, otherwise what the agent itself reports,
  because an account scopes it. The first row is **Default**: launch with no model flag at all.
  A model is picked for a launch and never changes a running agent.
  _Avoid_: model picker, provider list, model family.
- **Agent mark** — the identity glyph beside a card row, a tab, or a menu row: which mark an
  agent has is Orca's `AgentIcon` decision, and what decides its drawing is whether the mark
  brings its own fills. omp's gradient, Kilo's yellow/black, Droid's white-on-black and the
  bundled favicons keep their colors, so they are images; a `currentColor` glyph — Codex, Pi,
  Aider, OpenCode, Copilot — takes the text color. A mark is not a **Mark**: the mark says which
  agent, a Mark says what it is doing.
  _Avoid_: icon, logo, avatar, agent type icon.
- **Tab** — one space's set of panes, drawn in the tab rail. A tab belongs to exactly one space,
  and a pane to exactly one tab; moving a tab to another space is not `space.move`.
  _Avoid_: workspace, window, session.
- **Pane** — an individual viewport slot inside a tab. Holds either a running terminal process or an
  embedded mod view.
  _Avoid_: window, tile, split, view.
- **Mod pane** — a pane hosting a mod view (such as a file tree or git diff) rather than a shell terminal.
  Sits beside terminal panes inside a tab's layout tree.
  _Avoid_: widget pane, plugin window, tool split.
- **Floating agent panel** — the toggleable overlay workspace (Mod+Alt+A, ADR 0003) hosting active agent sessions across spaces, rather than a
  standalone shell terminal.
  _Avoid_: floating terminal, float window, agent popup.
- **Terminal split** — the division of a tab's viewport into two adjacent panes, either vertically
  (`right`, `left`) or horizontally (`down`, `up`).
  _Avoid_: tab split, window split, column split.
- **Split direction** — the orientation of a new pane relative to an existing one: `Right`, `Left`,
  `Down`, or `Up`.
  _Avoid_: split orientation, layout direction, axis.
- **Drop quadrant** — one of four peripheral zones on a target pane (`Left`, `Right`, `Bottom`,
  `Top`) where releasing either a dragged tab or a dragged pane grip splits or swaps the pane in that
  direction.
  _Avoid_: drop zone, pane quadrant, split area.
- **Center drop zone** — the central region of a pane body inside the outer 20% peripheral split
  bands. In Orca, dropping a tab here merges it into that pane's tab group. In Herdr, because panes
  cannot host multiple tabs, center drops fall back to the nearest peripheral drop quadrant (ADR 0012).
  _Avoid_: middle zone, merge area, inner quadrant.
- **Attached tab strip** — the persistent 32px header bar on an individual split pane (`TabGroupPanel`).
  Displays that pane's tab pill, prompt icon (`>`), add button (`+`), command button (`> Command`), and
  pane actions (`...`, split, close). Rendered only when multiple panes exist (`paneCount > 1`).
  _Avoid_: split header, pane titlebar, pane bar.
- **Unsplit** — the operation of detaching a split pane from its parent tab and converting it back into
  an independent top-level tab. Triggered by dragging the pane's header to the tab strip area or via the
  *"Move to New Tab"* context menu action.
  _Avoid_: extract tab, detach split, promote pane, pop out.
- **Drop indicator** — the accent-colored preview overlay highlighting where an item will land.
  For tab reordering, it is a 2px vertical blue line at the insertion edge (`SortableTab.tsx:213`).
  For pane dragging, it is a blue bounding box highlighting the target quadrant or center swap area (`pane_drag.rs:157`).
  _Avoid_: drop outline, blue box, split preview.
- **Pane grip** — the top-center affordance on a pane header (`.pane-title-drag-handle` in
  `TerminalPaneHeaderOverlay.tsx:190`, `grip-{pane}` in `pane_drag.rs:56`) that initiates moving,
  splitting, or swapping the pane by dragging. Rendered when multiple panes exist (`paneCount > 1`).
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
- **Settled tab** — a tab put away on the current screen (`tab.settle`). It keeps running in the background
  and returns when selected or when an agent inside it needs attention. Functions as Orca's pin analogue,
  hiding the tab's close button and requiring confirmation to close.
  _Avoid_: pinned tab, stashed tab, hidden tab, parked tab.
- **Close guard** — the confirmation prompt that intercepts tab or session closure when active work
  (a running command or active agent) or a settled tab would be terminated. Idle shells bypass the guard
  and close immediately.
  _Avoid_: close dialog, exit modal, kill prompt, confirm dialog.
- **Bulk tab close** — closing multiple tabs relative to a target tab (`others`, `right`, or `left`) in
  one action, while preserving settled tabs.
  _Avoid_: batch close, mass close, close-all.
- **Tab group** — Orca's multi-column container allowing multiple parallel tab strips in one workspace.
  Not a Herdr construct: Herdr maintains strictly one tab strip per space.
  _Avoid_: split tab bar, tab column, workspace column.
- **Session capture** — the sanitised, bounded tail of a pane's scrollback that seeds a fork or a
  handoff. It is a raw digest of the session, never the session, and carries no instruction framing.
  _Avoid_: transcript, log dump, history.
- **Agent transcript** — the persistent on-disk record of an agent's past execution, messages, and
  tool interactions. Indexed asynchronously to power past session discovery and resume. Distinct from
  **Session capture**, which is an active pane's scrollback digest.
  _Avoid_: scrollback capture, terminal log, prompt capture.
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
- **Display name precedence** — the strict resolution order determining a worktree's title:
  (1) user-assigned custom name, (2) git branch label, (3) checkout folder basename. An open space
  whose title has not been explicitly renamed by the user is *unnamed* and resolves to its git branch,
  never defaulting to the folder basename when a branch is present.
  _Avoid_: name resolution, title fallback, card name hierarchy.
- **Card meta** — the 11px line under the title: the branch for a git worktree, or the folder's last segment for a folder workspace. Dropped when its text equals the title, so the same string never appears twice.
- **Review** — the pull request for a worktree's own branch, shown as a mark at the end of the card's meta row. A review belongs to a branch, not a repo, so two worktrees of one repo can have different reviews. Read from a cache, never fetched while rendering. Creating a pull request updates the badge.
- **Review store** — the time-bounded cache tracking pull request status across branches and workspaces,
  decoupling review presentation from network fetch cycles.
  _Avoid_: review cache, pr store, gh cache.
- **Port** — reproduce Orca's behaviour and result using Herdr's primitives. Not *transcribe*
  (copy its markup literally, impossible here) and not *invent* (a control Orca has no
  counterpart for). See AGENTS.md rule 1.

- **Page** — a full view that replaces the middle column: Tasks, Automations, Mobile. A
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
- **Mutation target** — the directory path where an explorer creation action (`New File`, `New Folder`)
  takes effect: the selected folder itself when triggered on a directory, or the parent directory when
  triggered on a file row (`targetDir`).
  _Avoid_: creation path, parent folder, target folder.
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
- **Jump palette** — the modal dialog opened by the top-left Search button (`SidebarNav.tsx:90`) or `worktree.palette` (`ctrl-p` / `cmd-p`). It searches across open tabs, workspaces, quick actions, and offers inline workspace creation. Distinct from Herdr's stock `picker` (which is a dropdown of spaces) and `app.palette` (which lists raw commands).
  _Avoid_: search bar, omnibox, quick open, command bar.
- **Jump target** — any addressable result row inside the jump palette: a **Tab target**, **Worktree target**, **Action target**, or **Create target**.
  _Avoid_: palette item, search hit, result entry.
- **Tab target** — a jump target pointing to a specific tab within an open space, displaying the owning workspace name, tab title, and agent status or terminal icon.
  _Avoid_: open tab result, tab entry.
- **Worktree target** — a jump target pointing to a workspace card on disk, displaying its rollup status dot, repository badge, and branch name. Unopened checkouts open a new space upon selection.
  _Avoid_: workspace result, space target.
- **Action target** — a jump target representing an executable application command (such as split pane, open terminal, toggle layout) with its bound keyboard shortcut.
  _Avoid_: command result, quick action row.
- **Create target** — a fallback jump target offering to create a new workspace from the typed query when no exact workspace matches.
  _Avoid_: new workspace row, create action.
- **Usage cluster** — the status bar area displaying AI provider quota chips and refresh actions (`StatusBarUsageCluster`). Sits between space actions and system metrics.
  _Avoid_: quota bar, provider bar, usage bar, rate limit cluster.
- **Usage chip** — the compact status bar pill representing an AI provider's current quota consumption or error state. Displays the provider mark, percentage, and window label, or an error summary with a warning mark. A provider with no readable percentage has no chip; a mark with no number is not a chip.
  _Avoid_: quota badge, provider tag, usage pill, status chip.
- **Reading** — one probe result for one provider: its status (`ok` | `error` | `unavailable`), its
  buckets, and the error copy when it has one. The cluster draws from a flat list of readings, one
  per provider, which is Orca's `ProviderRateLimits` shape.
  _Avoid_: usage result, provider snapshot, quota state.
- **Unit label** — the leading indicator text in the usage cluster (`Used` or `Remaining`) designating whether displayed percentages represent consumed or remaining capacity.
  _Avoid_: metric label, mode indicator, quota prefix.
- **Quota pool** — a distinct rate limit bucket or model grouping allocated by an AI provider with its own reset window and capacity limit.
  _Avoid_: rate limit group, quota bucket, usage tier, model allowance.
- **Window label** — the short text naming a pool's reset period (`5h`, `wk`, `Monthly`, or a live
  countdown when the pool is nearly spent). A grouped pool is labelled `<group> <window>`; an
  ungrouped one is just the window, because the provider is already the chip's mark.
  _Avoid_: reset label, period text.
- **Tightest window** — the quota pool window within a provider that has the highest percentage consumed, selected for compact summary display on a usage chip.
  _Avoid_: bottleneck window, active window, primary limit.
- **Provider quota error** — a failure to probe or retrieve an AI provider's quota (such as an unauthenticated CLI or network timeout), displayed on a usage chip with a warning indicator. Distinct from an agent, space, or tab status.
  _Avoid_: agent error, provider status, blocked provider, rate limit failure.
- **Usage refresh trigger** — the icon button (`refresh-cw`) in the usage cluster that requests an immediate re-probe of all provider quotas. Displays a spinning animation while probing is active.
  _Avoid_: reload button, sync button, poll trigger.
