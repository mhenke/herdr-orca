# herdr-orca — agent notes

> **Orca's code is the spec. Read `~/Projects/orca` before editing a mod, and cite the Orca file and rule in the edit comment.** A diff that cannot name its Orca source does not ship. Screenshots show symptoms; Orca's source shows causes.

Related code: `~/Projects/herdr-app` (`src/model.rs`, `defaults/herdr.d.ts`) and the packaging example `~/Projects/herdr-t3`. Terms: `GLOSSARY.md` (one meaning each). Judgment: `ETHOS.md` (user report is ground truth; evidence over inference; fix the fault, not the surface).

## Iron rules

1. **Port behavior. Do not transcribe it, and do not invent it.** Every geometry value, color, status and grouping rule traces to an Orca file and line. Reproduce the behavior with Herdr primitives. If a detail is dropped, say so in the edit comment in one line, with the reason. Read the class and do the arithmetic from Orca's constants; pixels confirm a render happened, never a value. Worked examples: `docs/agents/rule-examples.md`.
2. **Ask the graph before you open files.** `cd <repo> && graphify query "<question>"`. Confirm the first output line names the repo you meant. Then open the file it names and read the body. Graphs: Orca, herdr-t3, herdr-app (`vendor/gpui-kit`), herdr-core. Details: `docs/agents/graphs.md`. A `.d.ts`, a comment, this file, or an agent's report is unverified until the code confirms it. Use `grep` to confirm a line the graph named, not to choose the file.
3. **Copy the owning function, not its outputs.** If Orca computes a value in a module, port that module (`mods/orca-spaces/indentation.js`). Do not hand-tune literals.
4. **Herdr owns status.** Read `space.status`, `agent.status`, `tab.status`. The vocabulary is `working | blocked | done | idle` (`Model::rollup`, `model.rs:554`; `Status` in `herdr.d.ts`). Do not invent states.
5. **Main checkout is positional.** Orca sets `isMainWorktree` on the first row `git worktree list` emits. Here it is `!linked`. There is exactly one primary badge per repo.
6. **Cards are keyed by worktree, not by session.** Merge spaces on the same worktree top before emitting. Draw unopened worktrees as cards that open on click (`space.new {folder}`).
7. **Lineage decides nesting.** `nestLineage: true` nests only rows with a `WorktreeLineage` record. Without lineage data every row is flat: no tree indent, no wrapper, no glyphs.
8. **Legacy card style.** With `experimentalNewWorktreeCardStyle: false`, the status lane is `shrink-0 flex justify-center items-start pt-[2px]` with no fixed width. The `w-5` lane belongs to the other style. Never mix the halves of two styles.
9. **A mod must work alone.** `svg()` and `image()` resolve against the application root, not the calling mod's folder (`gpui-kit.d.ts:20273-20289`), so a path may name a sibling mod's file and still draw. Copy every mark the mod draws into its own folder anyway: the package is published as standalone mods, and one installed by itself has no sibling. Prove it with a clean install (`HERDR_APP_HOME=/tmp/freshN bash scripts/sync.sh`); `herdr-app check` alone is not proof.
10. **`setShared` does not notify.** Async results cached via `shared()` appear only after an unrelated re-render. Use module-memory caches with `cx.notify()`, or state the delay in writing.
11. **Verify interaction before calling it blocked.** Try `hyprctl` (Lua dispatch form on 0.56+), `wlrctl`, `ydotool`, or a mod-side `.on_hover` probe that logs. Any claim that a capability is blocked names every command tried. Unverified hover or click is fine to admit.
12. **Name only real symbols.** Before writing a name, `grep -rn "<name>" ~/Projects/orca/src`. If nothing matches, the name is yours: say so, and say which Orca behavior it stands in for. A comment citing a path that does not exist reads as verified. Re-read any comment claim not checked this session. Examples: `docs/agents/rule-examples.md`.
13. **A mod's `cx` lives for one call.** Use `cx.timer.after`, `cx.timer.every`, or `cx.spawn`, with `cx` taken from the callback arguments. Never use `setTimeout`, `setInterval`, or `this.cx = cx`. A stored `cx` fails with "cx is no longer valid" and the pane paints an error bar. See `docs/adr/0002-render-failures-are-visible.md`.

## Porting code: licenses

Orca is MIT. Herdr App's shipped mods are Apache-2.0. Decision and reasoning: `docs/adr/0010-per-file-provenance-and-mixed-licensing.md`.

- Copied or near-copied Orca expression: add `// Portions ported from Orca (MIT, Copyright (c) 2026 Lovecast Inc.); see NOTICE.` and list the file in `NOTICE`.
- Derived from a file in Herdr App's `defaults/mods/`: add `// Derived from Herdr App's defaults/mods/<name> (Apache-2.0); modified for herdr-orca.` and list the file in `NOTICE`.
- Behavior-only ports carry no header.
- Before committing a port, compare its 5-grams against the cited file. Add the Orca header above about 30% containment. The score is a heuristic, not a legal test.

## Redesign from first principles

Run the `principle-redesign-from-first-principles` skill on every edit, not only large ones. Ask: **if this requirement had been there from the start, what would I have built?** If the answer differs from the patch, build the answer.

On each edit:

1. Read every file the change reaches: the mod, the layout node that sizes it, any sibling reading the same `shared()` key, and the Orca owner file.
2. Most answers are a constant, a table, or a move of ownership, not another special case.
3. Fix the shape, not the instance. If a value is derived, derive it. Reused numbers belong in `mods/orca-spaces/indentation.js`.
4. Question the instruction you were given, including this file's. A removal request is a claim about where something belongs, not proof it is unwanted.
5. Propagate to types, docs, comments and every other caller of anything you redefine.
6. Deliver incrementally, after deciding the whole design.

Four examples where a symptom patch failed: `docs/agents/rule-examples.md`.

## Verification loop

`node --check` and `herdr-app check <mod>` → `herdr-app shot` → PIL band scan (`mods` read the nested `colors` map; theme edits that bypass it silently do nothing, see `mods.rs:1109-1126`). Geometry changes need an app restart for new files; edits to existing mod files hot-reload. Cap: 2 failed cycles per issue, then attack the premise, not the patch.

## Package shape (herdr-t3 parity)

`layouts/ mods/ keys.json extras/themes/ scripts/sync.sh README.md RECIPE.md preview.png`. No `bin/`, no test scripts, no sound installs. Sync uses real copies, never symlinks. Settings (fonts, sounds) are documented, never written.
