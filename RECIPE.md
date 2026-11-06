# Recipe — Orca, by hand

What this package builds, left to right, and why each number is what it is. Every figure below was read from Orca's renderer source, not estimated from a screenshot.

## The window

Three columns, 1px dividers, no title bar of its own.

| Column | Width | Notes |
| --- | --- | --- |
| Left | 280, min 220, max 500 | Drag to resize inside those bounds |
| Center | the rest | 14px terminal padding, 2px pane radius |
| Right | 280, min 220, max 900 | Hidden until an activity is pressed |

`titlebar: "none"` and `traffic_lights: [12, 16]` put the window buttons in the tab strip, as Orca's do. Pane corners drop from Herdr's 10 to Orca's 2 so the center reads flat.

## Left column

Orca's left sidebar is navigation plus projects. Herdr's model is spaces, so this column is spaces.

- `orca-spaces`, a clone of `spaces`, so linked worktrees still group under their checkout with `├─`/`└─`, branch and ahead/behind.
- Right-clicking a space opens `orca-menu`: Rename, Copy Path, Copy Worktree Name, Open in Terminal, New/Open worktree, Close.
- `agents` sits under the spaces list, unchanged.

Not built: Search, Tasks, Automations, Orca Mobile, Dashboard. Each needs a backing feature Herdr does not have; a row that opens nothing is worse than a missing row.

## Center

`orca-tabs` (clone of `tabs`) draws the tab strip; `pane` draws the terminals.

The activity rail sits at the right end of the tab strip: 36×36 buttons with 16px icons, matching Orca's activity bar. Files is always present; Changes appears only when the focused pane's folder is inside a git work tree, which is Orca's `gitOnly` rule.

`orca-tabs` is the **only** writer of the `panel` and `panel-body` nodes. That is why this is a fork of `tabs` rather than a second rail mod: two writers over one node fight, and the loser's state is overwritten on every space switch.

## Right column

`panel` is a 280px column holding a stack: `orca-files` and `changes`.

`orca-files` clones `files` — same lazy directory reads, same 500-per-folder and 5,000-total caps, same 10-second refresh and folder watch — and adds:

- **Row context menu** on right-click: New File, New Folder, Copy Path, Copy Relative Path, Open in Terminal, Reveal, Rename, Delete.
- **Search view**: a query field above the tree running `rg --vimgrep --smart-case --max-count 20`, capped at 200 hits. Clicking a hit opens the file.

The 200-hit cap is not arbitrary: `exec` caps at 8 MiB and 30 seconds, so a large tree must bound its own output instead of failing.

## Why the mods are clones

Herdr replaces shipped mods on every start. A clone is a snapshot, so its diff is kept to the minimum that produces the Orca behaviour. After a Herdr upgrade that changes `spaces`, `files` or `tabs` internals, re-clone and re-apply — do not hand-merge.

The cost of forking is real and is stated in the README: upstream fixes to those three mods stop arriving here.

## What is deliberately not ported

| Orca | Why not |
| --- | --- |
| Checks panel | No Herdr mod for it; would be a new mod over `gh`, a separate decision |
| Worktree Pin / Unpin | `terminal.pin` pins a terminal, not a worktree |
| Child worktrees, project groups | Git and Herdr cannot express them |
| Settings UI | Herdr has `app.settings` |
| Native chat, browser pane, Design Mode | No equivalent surface in Herdr |
| Orca Mobile, remote servers, cloud VMs | Different product |
| Sleep | No Herdr equivalent |

## Applying it

```sh
sh scripts/sync.sh
herdr-app do layout.switch '{"name":"orca"}'
```

Restart the app after the first sync: a running window keeps the layout set it loaded at start. Settings that belong to the person — font family, sounds — are documented in the README and are not written by this package.
