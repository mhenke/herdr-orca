# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

