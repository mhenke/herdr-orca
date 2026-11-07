// The status mark for a card or an agent row.
//
// Herdr's model already rolls status up: `Model::rollup` (model.rs:554) reduces an agent set to
// the most urgent of `working | blocked | done | idle`, and `Model::status` (model.rs:528) maps
// the raw word there — `blocked` and `error` both land on "blocked". `space.status` and
// `tab.status` are that rollup; an agent's own `status` is the same vocabulary. So neither the
// ranking nor the `error` mapping belongs here; re-deriving them is how the card and its rows
// came to disagree with the app.
//
// Ported from `StatusIndicator.tsx`, which is a box plus a different mark per state — not a dot
// per state. Every branch is `inline-flex h-3 w-3 shrink-0 items-center justify-center` (a 12px
// box) holding something smaller:
//
//   working  <AgentWorkingSpinner className="size-2" />  — 8px ring, `border-2
//            border-agent-working border-t-transparent` (AgentWorkingSpinner.tsx:38-41), so a
//            yellow ring with a gap, NOT a filled dot. The gap is what the rotation reads as.
//   done     <span className="block size-2 rounded-full bg-emerald-500" />         (8px dot)
//   idle     <span className="block size-2 rounded-full bg-neutral-500/40" />     (8px, 40% alpha)
//   permission  <AgentQuestionIcon className="size-3" /> — a full 12px glyph, the only branch
//            that fills the box. Herdr's `blocked` is Orca's `permission`.
//   failed     size-1.5 (6px) red-500 dot.  `interrupted` 6px muted-foreground dot.
//
// `working` is the case an 8px filled dot gets wrong: at a glance it reads as `done`.
import { div, svg } from "gpui-kit";

// Tailwind v4 defaults, resolved from the token vars (`main.css:254-258`):
//   --agent-question: var(--color-orange-600)   --agent-working: var(--color-yellow-500)
export const STATUS_COLORS = {
  blocked: "#ea580c", // orange-600
  working: "#eab308", // yellow-500
  done: "#10b981", // emerald-500
  idle: "#73737366", // neutral-500 at 40%
  failed: "#ef4444", // red-500
  interrupted: "#acacac", // muted-foreground
};

// The 12px box every branch shares (`h-3 w-3`).
const box = (size) => div().size(size).flex_none().flex().items_center().justify_center();

// An 8px dot inside the box, or 6px for the two smaller branches (`size-1.5`).
const dot = (size, color) => box(size).child(div().size(8).rounded_full().flex_none().bg(color));

/**
 * `size` is the box, defaulting to Orca's 12 (`h-3 w-3`). Inner marks do not scale with it:
 * `size-2`/`size-1.5`/`size-3` are fixed in `StatusIndicator.tsx`, which is why this takes only
 * the box and keeps every mark at its own literal.
 */
export function statusMark(status, size = 12) {
  if (status === "blocked") {
    // `permission`: the one branch that fills the box (`size-3`).
    return box(size).child(
      svg("mods/orca-spaces/message-circle-question.svg").size(size).flex_none().text_color(STATUS_COLORS.blocked),
    );
  }
  if (status === "working") {
    // `AgentWorkingSpinner`: `size-2` ring, `border-2` in agent-working with a transparent top
    // (`AgentWorkingSpinner.tsx:38-41`) — an 8px circle with a gap, turning forever.
    // Herdr's `border_color` colours all four sides and has no per-side colour, so the ring is
    // an SVG arc with a real gap; and `spin(ms)` turns an svg natively at ~30fps, only while
    // drawn (`gpui-kit.d.ts:1215-1220`, "Turns an `svg` once every `ms`, forever ... draw an
    // arc"). Orca runs `rotate(86400turn)` over `86400s` (main.css:1830-1837) — exactly 1
    // revolution per second, so 1000ms here.
    return box(size).child(
      svg("mods/orca-spaces/agent-working-spinner.svg").size(12).flex_none()
        .text_color(STATUS_COLORS.working).spin(1000),
    );
  }
  if (status === "failed") return box(size).child(div().size(6).rounded_full().flex_none().bg(STATUS_COLORS.failed));
  if (status === "interrupted") return box(size).child(div().size(6).rounded_full().flex_none().bg(STATUS_COLORS.interrupted));
  // `done`/`active` share emerald; everything else falls to the quiet idle dot.
  return dot(size, STATUS_COLORS[status] ?? STATUS_COLORS.idle);
}
