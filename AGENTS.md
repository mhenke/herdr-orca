# herdr-orca — agent notes

> **We have the Orca codebase at `~/Projects/orca`. Read it. Never guess.**
> Every behavior in this package is a port of a specific Orca file. Before
> editing a Herdr mod, open the Orca file that owns the behavior, quote its
> path and rule in the edit comment. A diff that cannot name its Orca source
> file does not ship. Screenshots show symptoms; `~/Projects/orca` shows causes.
> Related code lives in `~/Projects/herdr-app` (`src/model.rs`, `herdr.d.ts`)
> and the packaging example `~/Projects/herdr-t3`.

Read `GLOSSARY.md` for the domain: repo / space / main checkout / linked
worktree / project group / top branch mean exactly one thing each here.
## Iron rules (paid for in full)

1. **Orca's code is the spec, not screenshots.** Every geometry value, color,
   status rule and grouping rule in this package traces to a file and line in
   `~/Projects/orca`, quoted in the edit comment. Tailwind classes lie to the eye
   (`mr-1` is 4px in a `w-5` lane); read the class, compute the pixel, verify by
   pixel sampling with `herdr-app shot` + PIL. Vision models misread 8px marks
   repeatedly — pixel evidence beats a vision read every time.
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
10. **Wayland blocks pointer injection.** Hover/click states are code-verified
    only (`xdotool` fails, `/dev/uinput` is root-only). Say so when reporting;
    never claim a hover was seen.

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
