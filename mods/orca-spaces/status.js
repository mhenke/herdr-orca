// The status mark for a card or an agent row.
//
// Herdr's model already rolls status up: `Model::rollup` (model.rs:554) reduces an agent set to
// the most urgent of `working | blocked | done | idle`, and `Model::status` (model.rs:528) maps
// the raw word there — `blocked` and `error` both land on "blocked". `space.status` and
// `tab.status` are that rollup; an agent's own `status` is the same vocabulary. So neither the
// ranking nor the `error` mapping belongs here; re-deriving them is how the card and its rows
// came to disagree with the app.
//
// Orca's StatusIndicator colors: `failed` is a red-500 dot, `working` is the agent-working
// spinner (yellow-500), `done` is emerald-500, `interrupted` is muted-foreground, and
// `permission` — which is what Herdr's `blocked` means, an agent waiting on the person — is the
// AgentQuestionIcon in `--agent-question` (orange-600 in dark: main.css:254), NOT yellow.
import { div, svg } from "gpui-kit";

export const STATUS_COLORS = {
  blocked: "#ea580c",
  working: "#eab308",
  done: "#10b981",
  idle: "#73737366",
};

// `size`: the mark's box. The mark itself is 8px, as StatusIndicator's `size-2` dot —
// except `permission`, which is a full `size-3` MessageCircleQuestion (AgentQuestionIcon).
export function statusMark(status, size = 12) {
  if (status === "blocked") {
    return div().size(size).flex_none().flex().items_center().justify_center()
      .child(svg("mods/orca-spaces/message-circle-question.svg").size(size).flex_none().text_color(STATUS_COLORS.blocked));
  }
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  return div().size(size).flex_none().flex().items_center().justify_center()
    .child(div().size(8).rounded_full().flex_none().bg(color));
}
