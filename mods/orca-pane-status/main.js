// A pane's agent status, for layouts that frame their panes at the bottom edge:
//   { "pane": { "header": { "position": "bottom", "height": 16, "content": { "mod": "pane-status" } } } }
// Draws only the state mark of the pane's agent, hard right — the same glyph
// `AgentStateDot` draws in Orca (src/renderer/src/components/AgentStateDot.tsx:105-197).
// Props from the app: { pane, terminal }.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, theme } from "herdr";

export default class PaneStatus extends View {
  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  render(cx) {
    const p = this.me();
    if (!p || !p.status) return div();
    const t = theme();
    const dot = (color) => div().size(6).flex_none().rounded_full().bg(color);
    return h_flex().size_full().px(6).items_center()
      // src/renderer/src/components/AgentStateDot.tsx:114-116 — the compact box is `h-2.5 w-2.5` (10px), the inner dot
      // `size-1.5` (6px), the glyph `size-2.5` (10px). `size="sm"` is what the tab and
      // sidebar rows use, so the same mark is drawn at the same size here.
      .child(div().ml_auto().size(10).flex_none().flex().items_center().justify_center()
        // working → `AgentWorkingSpinner`, `border-agent-working` = the yellow-500 token
        // (main.css:256,1836); done → CircleCheck in emerald-500 (src/renderer/src/components/AgentStateDot.tsx:148-157);
        // blocked → `AgentQuestionIcon` (`message-circle-question.svg`) in orange-600 / t.blocked (src/renderer/src/components/AgentStateDot.tsx:168-176).
        .when(p.status === "working", el => el.child(svg("mods/orca-pane-status/agent-working-spinner.svg").size(10).flex_none().text_color(t.working || "#eab308").spin(1000)))
        .when(p.status === "done", el => el.child(svg("mods/orca-pane-status/circle-check.svg").size(10).flex_none().text_color(t.done || "#10b981")))
        .when(p.status === "blocked", el => el.child(svg("mods/orca-pane-status/message-circle-question.svg").size(10).flex_none().text_color(t.blocked || "#ea580c")))
        // idle → `bg-neutral-500/40` (src/renderer/src/components/AgentStateDot.tsx:192); Orca's bare dot is idle only.
        .when(p.status === "idle", el => el.child(dot((t.idle || "#737373") + "66"))));
  }
}
