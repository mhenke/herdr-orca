// The status mark for a card or an agent row.
//
// Herdr's model already rolls status up: `Model::rollup` (model.rs:554) reduces an agent set to
// the most urgent of `working | blocked | done | idle`, and `Model::status` (model.rs:528) maps
// the raw word there — `blocked` and `error` both land on "blocked". `space.status` and
// `tab.status` are that rollup; an agent's own `status` is the same vocabulary. So neither the
// ranking nor the `error` mapping belongs here; re-deriving them is how the card and its rows
// came to disagree with the app.
//
// Orca's StatusIndicator colors: red-500 fails, agent-working (yellow-500) works or waits,
// emerald-500 finishes, neutral-500/40 is quiet.
import { div } from "gpui-kit";

export const STATUS_COLORS = {
  blocked: "#eab308",
  working: "#eab308",
  done: "#10b981",
  idle: "#73737366",
};

// `size`: the mark's box. The mark itself is 8px, as StatusIndicator's `size-2` dot.
export function statusMark(status, size = 12) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  return div().size(size).flex_none().flex().items_center().justify_center()
    .child(div().size(8).rounded_full().flex_none().bg(color));
}
