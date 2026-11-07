# 0004 — Match Orca's layout; where Herdr has no backend, render the gap

- **Status**: accepted
- **Date**: 2026-11-07

## Context

The package's job is to look and behave like Orca (`~/Projects/orca`) on top of Herdr. Some of
Orca's surfaces rest on backends Herdr does not have: a project catalog, hosted reviews, a task
list, schedules, a phone client, port forwarding, a folder-workspace model.

Two tempting answers are both wrong:

1. **Omit the control.** This is what the sidebar did with Tasks, Automations and Orca Mobile:
   the rows were left out because the pages behind them did not exist. The result reads as a
   layout bug — Orca's sidebar has four entries above `Projects` and ours had one, so the
   `Projects` header and everything below it sat too high and the search strip looked empty.
2. **Fake the control.** A button that opens an empty panel, or a row that draws invented counts,
   is a dead control. It teaches the person that the port lies.

The precedent is already in the package: `mods/orca-panel-gap/main.js` renders Orca's own
"unavailable" state — `right-sidebar/PortsPanel.tsx:51-55`: a centred column, `px-4`,
`text-center text-muted-foreground`, a 32px glyph at 50% opacity, `text-sm` copy — for Attached
worktrees, PR Checks, Checks and Ports. The entry keeps Orca's place in the activity bar; the
body states what Herdr lacks.

## Decision

1. **Geometry and placement are always Orca's.** A surface is drawn where Orca draws it, at
   Orca's size, whether or not its backend exists. Layout parity is not conditional.
2. **A backend Herdr lacks becomes a gap body, not an omission.** The control renders, is
   reachable, and opens a body that names, in one sentence, what Herdr does not have and where
   the nearest real thing lives. `orca-panel-gap` is that body for sidebar panels.
3. **A gap opens in the region Orca opens it.** Orca's Tasks, Automations and Orca Mobile are
   pages in the workspace column, not sidebar panels, so each is a child of the `main` stack in
   `layouts/orca.json` (`page-tasks`, `page-automations`, `page-mobile`) selected with
   `layout.select {stack:"main", child:"page-tasks"}` (`commands.rs:81`). Anything that returns
   to the terminals — clicking a workspace or a tab — selects `main-terminals` again.
4. **Never invent the data.** A gap body has no counts, no rows, no spinners that never resolve.
   If it would have to invent state to look finished, it is a gap.

## Consequences

- The sidebar keeps Orca's four-entry strip: Search, Tasks, Automations, Orca Mobile.
  `mods/orca-nav/main.js` draws them with Orca's row geometry
  (`SidebarNav.tsx:120,179,213` — `flex w-full items-center gap-2 rounded-md px-2 py-1.5
  text-[13px] font-medium tracking-tight`, icon `size-4` at `/30` when inactive, active
  `bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground`).
- The gap bodies are one file (`GAPS` in `orca-panel-gap/main.js`), so removing a gap is
  implementing its backend and deleting one entry.
- A gap body is a promise about the port: it may only be added when the backend is genuinely
  absent. "Not built yet" is not a gap — that is unfinished work.

**Current gaps** — Attached worktrees, PR Checks, Checks, Ports (sidebar panels); Tasks,
Automations, Orca Mobile (workspace pages).

## Alternatives rejected

- **Omit the control** — broke the layout and read as a bug; this ADR exists because it was
  tried for three sidebar entries.
- **Draw a disabled control with a tooltip** — indistinguishable from broken at a glance, and
  a tooltip cannot say what Herdr would need in the space of Orca's row.
- **Fake the data** — a task list with invented rows, or a Mobile page showing a code that
  pairs nothing, is worse than the gap: it makes every other number in the port suspect.
