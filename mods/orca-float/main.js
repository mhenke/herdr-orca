// Orca's Floating Workspace: `floatingTerminal.toggle`, Ctrl+Alt+A on Linux
// (`Mod+Alt+A`: keybindings/definitions-core-1.ts:280-286). It opens a bottom-right
// panel anchored right/bottom 24/84 px at 920x560
// (`floating-terminal-panel-bounds.ts:1-2,74-83,85-97`), holding a tabbed workspace
// of terminals, browsers and markdown (FloatingTerminalPanelSurface.tsx).
//
// Herdr cannot put a toggleable terminal inside a float: a terminal float's
// visibility is layout `hidden`, and `layout.toggle` only finds Nodes, not Floats
// (window.rs:3239-3247; `find_float_mut` exists but the command doesn't use it).
// So this port floats the live agent sessions Herdr does expose (`agents()`,
// herdr.d.ts:183) at the same corner. Named divergence: no terminal grid.
//
// The float is a layout block (edge bottom, align end = bottom-right, AGENTS.md
// "Floating blocks"), so Herdr places it 12 px in from the edge (window/floats.rs:14).
// The mod draws only content; Herdr draws the frame. An empty div hides both
// (window/floats.rs:187,198).
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, run, theme, nextCommand } from "herdr";

// Orca's DEFAULT_PANEL_WIDTH/HEIGHT, MIN_PANEL_WIDTH/HEIGHT and viewport clamp
// (`floating-terminal-panel-bounds.ts:1-4,89-90`).
const DEFAULT_WIDTH = 920;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 280;

// `AgentStateDot` (`src/renderer/src/components/AgentStateDot.tsx:186-193`): working/blocked coloured,
// idle dim. Orca hides `done` on these rows, so only these three reach here.
function stateDot(status, t) {
  const box = div().size(10).flex_none().flex().items_center().justify_center();
  const dot = div().size(6).rounded_full().flex_none();
  if (status === "blocked") return box.child(dot.bg(t.blocked));
  if (status === "working") return box.child(dot.bg(t.working));
  return box.child(dot.bg(t.idle + "66"));
}

// Orca's row title falls back through title -> app -> program name
// (orca-agents/main.js:22; `program.agent` is a boolean).
const title = (a) => a.title?.trim() || a.app || a.program?.name || "Agent";

export default class FloatWorkspace extends View {
  init(_props, cx) {
    // Orca starts the panel hidden; the hotkey toggles it (`floatingTerminal.toggle`).
    this.open = false;
    cx.spawn(async (cx) => {
      for (;;) {
        const cmd = await nextCommand();
        if (cmd === "toggle") this.open = !this.open;
        cx.notify();
      }
    });
    // agents() is live but does not notify a mod; orca-agents repaints from a
    // timer for the same reason (main.js:36-43).
    this.seen = "";
    cx.timer.every(1000, (cx) => {
      const now = agents().map((a) => `${a.address}:${a.status}`).join(",");
      if (now === this.seen) return;
      this.seen = now;
      cx.notify();
    });
  }

  row(a, t) {
    return h_flex().id(`float-agent-${a.address}`).w_full().min_w(0).flex_none().px(12).py(8).gap(6).items_start()
      .border_b(1).border_color(t.border).cursor_pointer().hover((s) => s.bg(t.hover))
      .role("button").accessibility_label(`${title(a)} — ${a.status}`)
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .child(stateDot(a.status, t))
      .child(v_flex().flex_1().min_w(0)
        .child(div().min_w(0).truncate().text_size(13).font_medium().line_height("20px").text_color(t.foreground).child(title(a)))
        .child(h_flex().mt(2).gap(4).items_center().text_size(11).line_height("16px").text_color(t.muted)
          .child(div().min_w(0).truncate().child(a.app || a.program?.name || "agent"))
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().min_w(0).truncate().child(a.space_name || a.space || "space"))
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().min_w(0).truncate().child(a.tab_name || `tab ${a.tab_index}`))));
  }

  render() {
    // Empty content hides the float and its frame (window/floats.rs:187,198).
    if (!this.open) return div();
    const t = theme();
    // Orca's clamp to the viewport (`floating-terminal-panel-bounds.ts:89-90`).
    const vp = window.viewport_size();
    const w = Math.min(DEFAULT_WIDTH, Math.max(MIN_WIDTH, vp.width - 48));
    const h = Math.min(DEFAULT_HEIGHT, Math.max(MIN_HEIGHT, vp.height - 96));
    const list = agents() ?? [];
    return v_flex().id("orca-float").w(w).h(h).min_h(0).overflow_hidden().text_color(t.foreground)
      .child(h_flex().flex_none().px(12).py(8).gap(6).items_center().border_b(1).border_color(t.border)
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12).font_semibold().child("Floating Workspace"))
          .child(div().truncate().text_size(11).text_color(t.muted).child("Live agent sessions")))
        .child(div().id("orca-float-close").size(20).flex_none().flex().items_center().justify_center().rounded(4)
          .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .role("button").accessibility_label("Hide floating workspace")
          .on_click((_e, cx) => { this.open = false; cx.notify(); })
          .child("×")))
      // Orca's list bar (`AiVaultSessionListBar.tsx:59-62`, via orca-agents/main.js:94-99).
      .child(h_flex().h(32).flex_none().items_center().pl(12).pr(6).border_b(1).border_color(t.border).bg(t.raised + "99")
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold()
          .child(`${list.length} agent${list.length === 1 ? "" : "s"}`)))
      .child(v_flex().id("orca-float-list").flex_1().min_h(0).overflow_y_scrollbar()
        .children(list.map((a) => this.row(a, t)))
        .when(!list.length, (el) => el.child(v_flex().size_full().items_center().justify_center().px(16).text_color(t.muted)
          .child(div().text_size(14).font_medium().child("No live agents")))));
  }
}
