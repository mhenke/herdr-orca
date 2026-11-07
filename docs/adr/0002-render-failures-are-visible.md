# 0002 — A mod's `cx` dies with the call that handed it over

- **Status**: accepted
- **Date**: 2026-11-07

## Context

Every mod callback is given a `cx`. It is not a general-purpose handle: it names one
host call. `with_context` compares the generation captured by the context against the
innermost live frame (`scope.rs:398`); when the call that produced it has returned, the
comparison fails and the result is `StaleContext` (`scope.rs:409`). The error it
displays says exactly what went wrong:

> cx is no longer valid: it was captured during an earlier call and used later. Use
> cx.spawn or take cx from the callback arguments instead.

(`scope.rs:419-422`)

The failure is loud because it happens where the view is built, not in a background
thread. `ScriptView::draw` builds a snapshot (`view.rs:243`); an `Err` is stored as
`self.error` (`view.rs:263`) and cleared by the next successful build (`view.rs:261`).
While an error is stored, `draw` keeps the last good snapshot and paints the banner over
it (`view.rs:319-325`); with no snapshot it falls back to `error_overlay`
(`view.rs:326`).

That banner (`runtime.rs:514-574`) is deliberately not subtle. It draws a 2px full-width
strip in the theme's `destructive` token (`runtime.rs:520`, `runtime.rs:537`) above the
text "This view could not be re-rendered; showing the last version that worked"
(`runtime.rs:557-559`) and the first line of the thrown message (`runtime.rs:566`). The
theme supplies `destructive` from its `blocked` entry (`src/mods.rs:1120`), which is
`#f97316` in this package's dark theme (`extras/themes/orca-dark.json:43`): orange.

This was not hypothetical. The file search in `mods/orca-files/main.js` debounced with
`setTimeout` and called `cx.notify()` from the timer callback and from a promise's
`.then`. The context captured when the change handler ran was stale 200ms later, so the
sidebar flashed the orange bar while the user typed. The fix is the one the message
names: `cx.timer.after(200, (cx) => …)` hands the callback a fresh context and returns a
`Task`, `timer?.cancel()` drops the superseded one, and the async search runs inside
`cx.spawn`.

## Decision

A mod treats a `cx` as valid only inside the call that passed it in. Work that outlives
that call is started from a sanctioned API, and each callback takes the `cx` it is
given.

- **Timers** — `cx.timer.after` and `cx.timer.every` (`typings.rs:3914-3922`). Each
  returns a `Task` and calls its handler with a fresh `cx`.
- **Async work** — `cx.spawn` (`typings.rs:1061`). Its handler receives an
  `AsyncContext`, which stays valid across `await` (`typings.rs:1070-1088`).
- **Cancellation** — `Task.cancel()` and `Task.is_done()` (`typings.rs:3909-3912`). A
  superseded timer or search is cancelled, not left to fire.
- **Setup** — `init` may keep values derived from its `cx` (a focus handle, a listener),
  never the `cx` itself.
- **Never** `setTimeout` / `setInterval`, and **never** `this.cx = cx`. Both store a
  context whose call is over.

`TaskOptions.owner` (`typings.rs:2031-2035`) names the view a task belongs to. Its weak
owner stops callbacks writing into a view that has gone away; it does not extend a
`cx`'s life.

## How to recognise it

- A solid orange 2px line across the top of exactly one pane, directly under its edge.
- Under it, the sentence *"This view could not be re-rendered; showing the last version
  that worked"*, and below that usually `cx is no longer valid: it was captured during
  an earlier call and used later`.
- It comes and goes: one failed build paints it, the next successful build clears it
  (`view.rs:261`).
- It often appears while the window is unfocused, because a timer is what wakes the
  view; nothing about focus causes it.
- **It is never a theme or styling problem.** The orange comes from the `destructive`
  token by design. A magenta element is a missing theme key; an orange 2px bar is a mod
  that threw.

## Consequences

- A stale `cx` cannot ship silently. The failure is visible in the UI and reproducible
  in a screenshot, so "the sidebar flashes orange while I type" is a bug report with its
  stack line already attached.
- Reviewers get a rule with no judgement in it: an orange 2px bar in a screenshot means
  a mod threw during render, never that a colour is wrong. Look at the second line, find
  the API that outlived its call, convert it.
- The banner covers the top of the pane it belongs to and keeps the rest of the last
  good render, so a broken mod does not blank the workspace. The cost is that the stale
  content underneath still looks interactive; the banner is the only signal.
- Cancelling superseded timers is now part of the pattern, not an optimisation. An
  uncancelled `Task` from `every` keeps ticking until `cancel()` or the script's
  application is unloaded.

## Alternatives rejected

- **Store `cx` on `this` and reuse it later.** This is the defect itself. The runtime
  rejects it at the next use with `StaleContext`, so the work either throws or is lost.
- **`setTimeout` with a module-level `cx` refreshed on every render.** Works until two
  calls overlap or no render happens; then the captured generation is stale and the
  banner appears.
- **Catch the rejection and drop it.** The error is raised while building the snapshot,
  so it becomes the view's `error` and the banner is drawn regardless of what the mod
  does with its own promise.
- **Log instead of showing the banner.** A logged render error is exactly how earlier
  failures in this project went unnoticed; the pane looked fine while the region was
  blank.
