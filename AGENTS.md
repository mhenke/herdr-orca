# herdr-orca — agent notes

> **We have the Orca codebase at `~/Projects/orca`. Read it. Never guess.**
> Every behavior in this package is a port of a specific Orca file. Before
> editing a Herdr mod, open the Orca file that owns the behavior, quote its
> path and rule in the edit comment. A diff that cannot name its Orca source
> file does not ship. Screenshots show symptoms; `~/Projects/orca` shows causes.
> Related code lives in `~/Projects/herdr-app` (`src/model.rs`, `herdr.d.ts`)
> and the packaging example `~/Projects/herdr-t3`.

Read `GLOSSARY.md` for the domain: repo / space / main checkout / linked
worktree / project group / top branch mean exactly one thing each here. Read
`ETHOS.md` for the judgment behind the rules: user report is ground truth,
evidence over inference, fix the fault not the surface.
## Iron rules (paid for in full)

1. **Orca's code is the spec, not screenshots, not pixels.** Every geometry value,
   color, status rule and grouping rule in this package traces to a file and line
   in `~/Projects/orca`, quoted in the edit comment. Tailwind classes lie to the
   eye (`mr-1` is 4px); read the class, do the arithmetic from Orca's constants.
   Never measure pixels to derive a value — pixel evidence misled this project
   repeatedly (tool zoom, antialiasing, stale renders). Pixels may confirm a render
   happened, never what the value should be.

   **Port Orca, do not transcribe it — and never invent it.** These are three
   different things:

   | | Meaning | Allowed? |
   |---|---|---|
   | **Transcribe** | Copy Orca's JSX/TSX line-for-line into Herdr builders | **No.** |
   | **Port** | Reproduce the *behavior and result* using Herdr's primitives | **Yes — the job.** |
   | **Invent** | Write something Orca has no counterpart for, or name an Orca symbol that does not exist | **No** (rule 11). |

   Herdr is not React: no `div` trees with Tailwind, no Radix, no hooks, no
   DOM hover groups, no `localStorage`-backed store. So a literal transcription
   cannot work, and a behavior with no Herdr primitive gets the closest honest
   equivalent with the gap named in the comment. Two worked examples from this
   project:
   - `ProjectsCollapseAllButton` is a Radix `Tooltip` + `Button` whose wrapper
     is `w-0 opacity-0` until `group-hover/sidebar-header` or `focus-within`
     reveals it (`ProjectsCollapseAllButton.tsx:32-41`; `SidebarHeader.tsx:61`
     is the `group/sidebar-header`). Herdr has no CSS descendant selector, but
     an element-level `.on_hover` on the header row is an honest gate:
     `orca-nav` tracks that row's pointer and mounts the one 24px button only
     then, so the reveal is ported, not dropped. `focus-within` has no
     counterpart because the button is not mounted while hidden.
   - Orca reads a persisted `prCache` written by `src/main` IPC. Herdr mods
     cannot share a process like that, so the cache lives in `localStorage`,
     the *reader* stays pure, and the *writer* runs in the refresh cycle —
     Orca's layering kept, its transport replaced.

   The rule for a dropped detail: **state it in the edit comment, in one line,
   with the reason.** A silent omission reads as parity. A named omission is
   honest. And when a port needs a new name, it belongs to Herdr's vocabulary
   (`lookupPRByBranch`, `foldKey`, `setPr`) — never to a plausible-looking Orca
   name it is merely reminiscent of.

   **Query the Orca graph first.** `~/Projects/orca/graphify-out/graph.json` is
   built and usable (**237,654 nodes**, 332 MB), so the query form is
   `graphify query "<question>"` (or `graphify path` / `graphify explain`) to
   find the file that owns a behavior instead of grepping the tree; open the file
   it names and quote it in the edit comment. It is large enough that a broad
   question truncates — narrow it (`--budget N`, or `context_filter=['call']`)
   rather than reading a partial answer as the whole one.

   An earlier attempt on Orca's ~37,570 files died after AST extraction without
   writing `graph.json`; that is stale. The build that succeeded is what
   `graphify-out/` holds now. Still read the source file to confirm a value —
   the graph finds the owner, it does not prove the line.

   **`~/Projects/herdr-t3` has a graph too.** It is the reference Herdr layout this
   package is shaped like (`layouts/ mods/ keys.json extras/themes/ scripts/sync.sh
   README.md RECIPE.md preview.png`), so the same `graphify query` answers
   "how does herdr-t3 do this?" from its `graphify-out/graph.json`. Use it for
   packaging, sync, keys and mod-structure questions; use the Orca graph for what
   the UI looks like and how it behaves. Its graph is built, no need to rebuild.

   **Query from the project folder; check the graph line.** A bare `graphify query`
   answers from `./graphify-out/`, so `cd ~/Projects/herdr-t3` first when you want
   herdr-t3, and `cd ~/Projects/orca` for Orca. Confirm on the first output line:
   it prints the graph it used and its node count — if that is not the project you
   meant, the answer is about the wrong codebase.

   This used to be a trap, worth knowing how it broke: `~/.zshrc` exported
   `GRAPHIFY_OUT="$HOME/.graphify/oh-my-opencode-slim"`, which beats cwd, so a
   query in herdr-t3 answered from 7348 nodes of another project (its own has 874)
   and "how does sync.sh install layouts" returned `src/cli/install.ts`, never
   `sync.sh`, with no warning. The export is removed; `--graph <path>` also works
   and beats any variable. Related: `extract` has no `--graph` and writes wherever
   `GRAPHIFY_OUT` points (one run pruned 9097 nodes from a store it did not own),
   and an interrupted extract leaves only `.graphify_build.json`, so a missing
   `graph.json` means rebuild, not query.
2. **Copy the owning function, not its outputs.** Hand-tuned literals drift;
   the port of `indentation.ts` (`mods/orca-spaces/indentation.js`) ended five
   rounds of indent patches. If Orca computes it somewhere, port that module.
3. **Herdr's model already rolls status up.** `Model::rollup` (`model.rs:554`)
   reduces an agent set to `working | blocked | done | idle`, and `herdr.d.ts`
   confirms the `Status` type. Never re-derive priority or invent states
   (`permission`, `monitoring`, `error` do not exist here) — read
   `space.status` / `agent.status` / `tab.status`.
4. **`isMainWorktree` is positional, not nominal.** Orca's parser sets it on
   the first row git emits (`parseWorktreeList`), never by branch name. Our
   equivalent is `!linked` (top differs from the common dir's owner). There is
   exactly one primary badge per repo.
5. **Cards are keyed by worktree, not by session.**
   `host-qualified-identity.ts`: two tabs on one checkout are one card; merge
   Herdr spaces on the same worktree top before emitting. Rows are worktrees:
   list `git worktree list --porcelain` and draw unopened worktrees as cards
   that open on click (`space.new {folder}`).
6. **Nested vs flat is a data question.** `nestLineage: true` only nests rows
   with an explicit `WorktreeLineage` record; sibling worktrees are flat
   (`depth 0`). Without lineage data, every row is flat — no tree indent,
   no wrapper, no `├─` glyphs.
7. **Default card style is legacy.** `experimentalNewWorktreeCardStyle: false`,
   so the status lane is `shrink-0 flex justify-center items-start pt-[2px]`
   with no fixed width — the `w-5` lane belongs to the other style. Do not mix
   halves of two styles.
8. **A mod is self-contained.** `svg()`/`image()` resolve under appHome and
   cannot read outside the mod's own folder. Copy every icon into the mod;
   `herdr-app check <abs mod path>` passes but only a clean install
   (`HERDR_APP_HOME=/tmp/freshN bash scripts/sync.sh`) proves it.
9. **`setShared` does not notify.** Async probe results cached via `shared()`
   only appear after an unrelated re-render. Prefer module-memory caches with
   `cx.notify()`, or accept the delay explicitly.
10. **Pointer verification is not blocked — do not claim it is.** An earlier
    version of this rule said Wayland blocked pointer injection. That was wrong:
    the session runs Hyprland (`HYPRLAND_INSTANCE_SIGNATURE` is set, `hyprctl`
    is present) and `hyprctl clients` sees the window, so a pointer *can* be
    driven. What actually failed was `xdotool` (X11) and an assumed
    `/dev/uinput` path — the wrong tools, not a blocked system. Before writing
    "cannot verify interaction", exhaust: `hyprctl` dispatch for this build
    (0.56+ uses the Lua dispatch form, not `hyprctl dispatch movecursor X Y`),
    `wlrctl`, `ydotool`, or a mod-side `.on_hover` probe that logs. **Never
    report a capability as blocked without naming the exact commands tried.**
    Unverified hover/click is fine to admit; calling it impossible is not.
11. **Do not guess — open the file.** A name in this repo must denote a real
    Orca symbol or an honest Herdr equivalent, never a plausible invention.
    This project shipped three guesses that each looked right and were wrong:
    - `askPr()` — no such function in Orca. The real pair is
      `lookupPRByBranchName` (`src/main/github/client/lookup/pr-branch-lookup.ts`)
      **writes** the cache and `readWorkspaceReviewPR`
      (`src/shared/sidebar-list/workspace-review-facts.ts`) **only reads** it.
      Fetching from render was the bug; the invented name hid it.
    - A two-button collapse/expand pair — Orca has **one** toggle,
      `ProjectsCollapseAllButton.tsx`, whose glyph is
      `allCollapsed ? ChevronsUpDown : ChevronsDownUp` (`:23`) and whose click
      always toggles (`:51`).
    - `gh pr list --head <branch>` — Orca's **primary** path is REST,
      `repos/<owner>/<repo>/pulls?head=<owner>:<branch>&state=all&per_page=10`
      (`getRestPRForBranch`), with `pullRequestMatchesHeadRepository` rejecting a
      mismatched head. `gh pr list --head owner:branch` silently returns `[]`,
      and the unscoped form matches a fork's same-named branch.

    The check is cheap: `grep -rn "<name>" ~/Projects/orca/src` before writing
    the comment. If it returns nothing, the name is yours and the comment must
    say so — with the Orca behavior it is standing in for. A comment that cites
    a path which does not exist is worse than no comment: it reads as verified.
    **When a claim in a comment has not been re-read this session, re-read it.**
12. **A mod's `cx` lives only as long as the call that handed it over.** Use
    `cx.timer.after` / `cx.timer.every` / `cx.spawn`, and take `cx` from the
    callback's arguments; never `setTimeout` / `setInterval`, never
    `this.cx = cx`. A stored context is rejected on its next use with
    `cx is no longer valid: it was captured during an earlier call and used
    later` (`scope.rs:419-422`), and because that happens while the view is
    built, the pane paints a 2px orange bar across its top reading *"This view
    could not be re-rendered; showing the last version that worked"*. The bar
    is the error, not the styling — the message names the fix. See
    `docs/adr/0002-render-failures-are-visible.md`.
13. **The code is the truth — ask its graph before you assert.** Every behavior
    starts with one question, asked in Orca's graph before any edit — including
    a one-line fix: `cd ~/Projects/orca && graphify query "how does Orca <do
    the thing>"`, then open the file the answer names and read the body. Only
    then ask Herdr the Herdr half of the same question. `grep` and `find` are
    not a substitute: they answer "where does this string appear", not "what
    owns this behavior", and they miss the owning file whenever its name is not
    the text you guessed. Use them to confirm a line the graph named, never to
    choose the file. Three repos own every
    fact this package ports, and each has a built graph:
    - `~/Projects/orca` — what the UI looks like and how it behaves
      (`graphify-out/graph.json`, 237,654 nodes).
    - `~/Projects/herdr-app` — the host, its mods API, and the vendored kit at
      `vendor/gpui-kit` (`gpui-base` elements, `gpui-kit`, `herdr`); it is the
      only authority for what a builder method actually does.
    - `~/Projects/herdr-core` — `hc`, files, processes, the core protocol.

    `cd <repo> && graphify query "<question>"`, confirm the first output line
    names the repo you meant, then open the file it names and read the body. A
    `.d.ts` signature, a comment, this file, and an agent's report are all
    *unverified*. Worked example from this package's own bug hunt: the typings
    say `Input.new(state)` takes a state, but only
    `vendor/gpui-kit/crates/base/src/input/input/mod.rs` — `Input` is a
    `RenderOnce` holding `Entity<InputState>`, taken from the element value on
    every render — settles whether swapping that state across renders rebinds.
    Never fix a bug on a mechanism you have not read there; and never report a
    capability blocked when the code says otherwise.

## Redesign from first principles — apply it constantly

**Run the `principle-redesign-from-first-principles` skill on every change, not
just large ones.** This is a standing instruction, not a stage gate. The
previous wording ("before a medium or large change") let the small ones skip it,
and the small ones are where the shape errors hide: two closed bugs in one
session were each fixed at the symptom, because "one line" did not feel like it
needed a redesign.

The trigger is not scope. **Any time you are about to edit, ask the question.**
It costs one breath:

> **If this requirement had been there from the start, what would I have built?**

Then check the answer against what you are about to do. If they differ, build
the answer, not the patch. Four things this has caught here, each after a
small-looking fix failed:

- **Wrong place.** Agent status was moved out of Orca's pane *title* and into a
  **bottom-right overlay**. Deleting it from the header "fixed" the extra
  element and silently lost the status. The requirement was never "remove the
  status" — it was "put it where Orca puts it".
- **Wrong region.** The explorer's toolbar was missing because the band was
  never in the tree at all; patching the filter row could not have added it.
- **Wrong owner.** Two mods drew the same activity bar (titlebar and right
  panel). Restyling one left two of them on screen.
- **Wrong layer.** A scrollbar painted *over* the rows because the scrolling
  container owned the bar. No inset value fixes that; the bar has to be a
  sibling in its own gutter.

Concretely, on every edit:

1. **Read every file the change reaches** — the mod, the layout node that sizes
   it, any sibling that reads the same `shared()` key, and the Orca owner file.
2. **Ask the question above.** Most answers are a constant, a table, or a move
   of ownership — not another special case.
3. **Find the shape, not the instance.** The recurring failure here is fixing
   one visible symptom of a rule that applies everywhere: one chevron's order,
   one gap's units, one icon's stroke. If a value is derived, derive it.
4. **Question the instruction you were given**, including this file's. The
   overlay case arrived as "delete what Orca lacks"; the correct reading was
   "relocate what Orca relocates". A removal instruction is a claim about where
   the thing belongs, not proof that it is unwanted.
5. **Propagate** — types, docs, comments, and every other caller of the thing
   you just redefined. A rule that lives in one file and is violated in four is
   not a rule.
6. **Deliver incrementally**, but decide the whole design first.

Redesigning is cheap here because the geometry module already exists
(`mods/orca-spaces/indentation.js`): when a number is reused, it belongs there,
not inline.

## Verification loop

`node --check` + `herdr-app check <mod>` → `herdr-app shot` → PIL band scan
(`mods` read the nested `colors` map; theme edits that bypass it silently do
nothing — see `mods.rs:1109-1126`). Geometry changes need an app restart to
take effect for new files; edits to existing mod files hot-reload.
Cap: 2 failed cycles per issue, then attack the premise, not the patch.

## Package shape (herdr-t3 parity)

`layouts/ mods/ keys.json extras/themes/ scripts/sync.sh README.md RECIPE.md
preview.png`. No `bin/`, no test scripts, no sound installs. Sync uses real
copies, never symlinks. Settings (fonts, sounds) are documented, never written.
