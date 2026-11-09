# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.2] - 2026-11-09

### Bug Fixes

- **orca-files:** Gate Collapse All and Refresh to the files view

### Documentation

- **scan:** Delta for the orca-files toolbar gating
## [0.10.1] - 2026-11-09

### Bug Fixes

- **orca-nav:** Name the mobile page Mobile

### Documentation

- **plan:** Crew chip implementation plan, five tasks
- Follow the Mobile label and the crew chip plan
## [0.10.0] - 2026-11-09

### Bug Fixes

- **clipboard:** Also write the host display server
- **orca-menu:** Close the context menu after every action
- **orca-float:** One 24px agent row, Orca's density

### Documentation

- **spec:** Crew chip in the pane header, ported from Orca's orchestration pill
- **spec:** Record the live parent-link check in the crew chip spec
- Record the two real quota sources and the chip rule
- **spec:** Filter crew children by Herdr's live state, as its own agents mod does

### Features

- **orca-float:** Port the workspace toggle, identity marks and header launcher
- **orca-status:** Draw one chip per reading from agy and omp usage
- **new-menu:** Persist the model catalog and resolve CLIs like a login shell
## [0.9.0] - 2026-11-09

### Bug Fixes

- **clip:** Write the clipboard through GPUI instead of CLI daemons
- **orca-handoff:** Use the callback timer and await the clipboard write

### Documentation

- Record NOTICE provenance for ported status bar usage cluster
- Formalize usage cluster domain terms and record ADR-0014
- Sync README, RECIPE, glossary and ADR index with the shipped mods

### Features

- **orca-status:** Add standalone provider icon assets
- **orca-status:** Port quota parsing, bucket selection, and pool label formatting
- **orca-status:** Add provider probing for antigravity, claude, codex, cursor
- **orca-status:** Render orca status bar usage cluster with live refresh
- **orca-pane:** Attach Orca's 32px split-group header with drag-to-new-tab
- **orca-tabs:** Resolve tab drops from the shared record
- **orca-changes:** Add the uncommitted-entry context menu
- **orca-files:** Port Orca's file row context menu
- **orca-menu:** Gate agent rows and add Move to New Tab
- **orca-spaces:** Group rows by project section and draw owner avatars

### Miscellaneous

- **verify:** Allow usage.js as a mod-owned module
## [0.8.0] - 2026-11-08

### Bug Fixes

- **keys:** Drop a shortcut bound to a mod that is not shipped

### Documentation

- Add Agent mark glossary definition and list orca-tabs omp.svg in NOTICE
- Correct README, RECIPE and rules for 18 mods and the program table

### Features

- **orca-tabs:** Bundle agent tab marks and draw the idle state dot
- **extras:** Ship the omp program entry and install its icon

### Refactoring

- **mods:** Trim comments and dead locals in new-menu, orca-pane and orca-spaces
## [0.7.0] - 2026-11-08

### Documentation

- Update ADRs 0006-0007, glossary terms, license notice, and project doc

### Features

- **new-menu:** Add dynamic agent discovery, model list drilldown, and filter search
- **orca-tabs:** Add drag reordering indicator, middle-click close, and process close guards
- **orca-pane,orca-menu:** Add centered 6-dot grip affordance, pane swaps, and directional split actions
- **orca-spaces:** Add bundled agent icons and align idle status mark with completed sessions
## [0.6.0] - 2026-11-08

### Documentation

- Add ADRs 0009-0010, agent guides, glossary sharpening, and project doc update

### Features

- **orca-spaces,orca-changes:** Add decoupled review store with TTL and invariant space scoping
- **orca-tabs,orca-split-menu,orca-menu:** Add 4-quadrant drag split drops and circular tab colors
- **orca-agents:** Resolve project scope across linked worktrees in git cache

### Miscellaneous

- Add license headers, Apache-2.0 LICENSE, and NOTICE per ADR 0010

### Refactoring

- **orca-pane:** Rely on native pane_grip for pane drag and swap

### Styling

- **theme:** Set accent color in orca-dark theme
## [0.5.0] - 2026-11-08

### Documentation

- Add ADRs 0006-0008, domain glossary definitions, and project doc update

### Features

- **release:** Add scan, domain-modeling, and graphify preflight checks to release skill and script
- **orca-files:** Support opening file directly from props
- **orca-handoff,orca-split-menu:** Add agent handoff dialog and pane split menu mods
- **orca-agents:** Add transcript session history and resume support
- **orca-changes:** Add conflict resolution, batch discard, and sync actions
- **orca-nav,orca-spaces:** Add workspace options menu and unread bell toggle
- **orca-pane,orca-menu:** Add header drag grip, transcript capture, and terminal menu integration
## [0.4.0] - 2026-11-08

### Bug Fixes

- **orca-files:** Share 200ms debounce across filter inputs and query rerun
- **orca-files:** Remove max-count cap in text search and adjust result geometry

### Documentation

- Replace preview.png with wide desktop application screenshot
- Humanize layout intro with exact column geometry; sync search and mod fixes
- Add ADR 0005, glossary domain terms, and project doc update

### Features

- **orca-agents:** Add vault scope switch, search filter, and session count bar
- **orca-changes:** Add split commit action menu and PR creation dialog
- **orca-spaces,orca-menu:** Key context menu on worktree and activate agent panes on click
## [0.3.0] - 2026-11-07

### Bug Fixes

- **orca-nav:** Await async pickFolder promise when adding projects

### Documentation

- **readme:** The sidebar header and the gap rule
- Add rule 13 to AGENTS.md, glossary terms, and project doc update

### Features

- **orca-panel-head:** Add tooltip to activity rail icons
- **chrome,tabs:** Add tooltips to chrome rows and tab buttons
- **orca-files:** Virtualize file rows and preserve partial rg listings
- **tooltips:** Add accessibility tooltips to interactive buttons
## [0.2.0] - 2026-11-07

### Bug Fixes

- **ci:** Disable setup-uv lockfile cache and add orca-menu parity rows
- **release:** Use offline git-cliff mode across scripts and workflows
- **spaces:** Show main checkout when repo is opened only on linked worktrees
- **orca-spaces:** Anchor each repo at its main worktree, and stop the list jumping
- **orca-tabs:** Keep the sidebar toggle in one slot and draw Orca's window controls
- **orca-panel-head:** One right-sidebar toggle, in the titlebar slot

### Documentation

- **readme:** Document main checkout auto-discovery and update release skill path
- **adr:** Match Orca's layout, and render the gap where Herdr has no backend
- **glossary:** Page, gap and saved project; correct the title-only card
- **pipeline:** Delta the project doc onto today's architecture

### Features

- **layout:** Give the middle column the Tasks, Automations and Orca Mobile pages
- **orca-panel-gap:** Name the Tasks, Automations and Orca Mobile gaps
- **orca-tabs,orca-spaces:** Choosing a workspace shows the terminals again
- **orca-nav:** Add history arrow icons and update nav svg stroke geometry
- **orca-nav:** Add history arrows and Tasks, Automations, Orca Mobile nav rows
- **orca-tabs:** Add tooltip to sidebar toggle button

### Styling

- **orca-nav:** Update arrow icons to standard Lucide path vectors
## [0.1.0] - 2026-11-07

### Bug Fixes

- **sync:** Merge keys.json; docs: README from the herdr-t3 template
- The orange banner was a render throw; the key section never matched
- **orca-spaces:** Settle row order in task phase instead of render
- **orca-spaces:** Restore Orca's meta row, and a scrollbar that paints
- **orca-tabs:** Seed window flags for the first paint and restore the right-sidebar toggle
- **orca-files:** Key git marks to the tree root, and add Orca's Names/Contents switch
- **orca-spaces:** Place the sidebar scrollbar in Orca's gutter, and hold the card pitch
- **orca-chrome:** Drop the Herdr-only add-machine plus from Orca's footer

### Documentation

- Orca parity phases for herdr-app
- Orca parity tasks, with clipboard/relative-path fixes
- Settings and sounds to apply by hand
- Fix Orca repo link to stablyai/orca
- README mods/limits, RECIPE, preview
- Replace the superseded monogram and status-lane descriptions
- Never measure pixels; query the Orca graph first
- Herdr-t3's graph is a second query source
- Pass --graph on every query, the env selects the wrong graph
- README and AGENTS.md match what the code now does
- Scan, glossary drift, ADR 0001; nav drops the three dead rows
- Write RECIPE.md for distribution following Herdr specification
- **readme:** Update README with complete feature set, distribution details, and discovery parity
- **adr:** Record why the float lists agents, not terminals
- **orca-menu:** Cite the tab rows that have no Herdr command
- State the collapse-all reveal rule once, and correct its citations

### Features

- **layout:** Flat 2px pane corners
- **orca-menu:** Mod-local clipboard and reveal helper
- **orca-menu:** Copy Path, Copy Worktree Name, Open in Terminal
- **spaces,files:** Orca space menu, file row context menu
- **orca-tabs:** 36px activity rail; fix(orca-files): inline New/Rename input
- **orca-files:** Bounded rg search view (200 hits)
- Orca look and behaviour for Herdr App
- Match Orca's project rows
- Orca's titlebar order (logo, menu, sidebar toggle)
- Port Orca's card geometry and status model
- Flat sibling worktree rows, worktree merge, unopened rows
- Folder cards print the folder basename meta, branch meta unconditional
- Folder header row above folder session cards
- Derive card indent from Orca's frame geometry, not a fixed flag
- Strip an agent's leading title glyph like SortableTab
- Draw the repo's GitHub owner avatar in group headers
- Show the fork's parent avatar, as Orca resolves it
- Draw the review badge at the end of the branch row
- Remove the ahead/behind counters from the card title row
- Collapse-all, and the pane menu caller
- Reviews, collapse, scroll, status — and the citations fixed
- Group header actions hide until hover
- Agent chevron, and the repo header's real action order
- Header icon order and the explicit 2.25 stroke
- **orca-spaces:** Seed the row plan from the persisted catalog
- **orca-float:** Compose the empty state and title bar as one panel shell
- **orca-float:** Keep Orca's Minimize row in the empty state
- **orca-files:** Filter by name over the flat worktree listing
- **orca-pane:** Show the tab's given name as the pane title
- **orca-spaces:** Keep saved project folders in the sidebar
- **orca-tabs:** Show the tab colour dot from the menu's store
- **orca-float:** Give Orca's New Terminal row a working action
- **skills:** Add herdr-orca-release skill and update verify.py local citations

### Miscellaneous

- Ignore SDD workspace
- Dedupe gitignore

### Other

- Orca-shaped Herdr layout, reverse-engineered from Orca's renderer
- Spec rev 2: fix five blockers found in review
- Realign plan and spec to herdr-t3 package shape
- Real Orca themes in extras/themes, sync script, extras shape
- Resolve three pre-flight conflicts
- Package as a self-contained layout: orca-pane, local icons, corrected docs
- Projects section: Orca's two-tier header + worktree cards
- Projects cards: branch as the meta line, inline agent count, real status dot
- Fix fold ownership and duplicate branch in project cards
- Align Projects header indent and card text brightness with Orca
- Make orca-panel-head and orca-menu self-contained
- Refresh preview.png after the sidebar, chrome and panel-head changes
- Install graphify project-scoped for this layout port
- Orca status marks: the glyphs Orca draws, and the colours its tokens have
- Landing page, collapse-all gating, pane header, hover fixes
- Add release automation, workflows, and changelog

### Refactoring

- **orca-spaces:** Rebase onto t3-spaces for project avatars
- **comments:** Trim redundant commentary in the spaces mod and README
- **mods:** Deepen worktree plan, status mark, and git inspection modules

### Styling

- Current render (avatars, derived indent, Orca status glyphs)
- Stroke width, and the group header's missing plus
- The palette was invented; the drop indicator was the wrong shape
- Refresh the raster after the row-order fix
[0.10.2]: https://github.com/mhenke/herdr-orca/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/mhenke/herdr-orca/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/mhenke/herdr-orca/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/mhenke/herdr-orca/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/mhenke/herdr-orca/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/mhenke/herdr-orca/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/mhenke/herdr-orca/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/mhenke/herdr-orca/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mhenke/herdr-orca/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mhenke/herdr-orca/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mhenke/herdr-orca/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mhenke/herdr-orca/releases/tag/v0.1.0

