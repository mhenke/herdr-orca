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
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, run, theme, nextCommand, keys } from "herdr";

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
    // `FloatingTerminalEmptyState.tsx:37-43`: `absolute inset-0 flex items-center
    // justify-center`, inner `flex w-[360px] flex-col items-center gap-1.5`, a stack of ghost
    // rows (`h-8 gap-2.5 rounded-md px-3 text-sm`, glyph `size-3.5 opacity-90`, keycap
    // `justify-self-end` in the button's `text-foreground`). New Terminal / New Markdown / Open
    // Markdown / New Browser create float content, which a mod cannot instantiate (ADR 0003).
    // Its fifth row, Minimize (`:120-129`, `onClose`), is the header ×'s hide, so it is kept.
    // The first row is the empty message: Orca has no such row, but a list with nothing in it
    // has to say so.
    const chord = (keys() ?? []).find((k) => k.action === "orca-float.toggle")?.keys ?? "";
    const empty = v_flex().size_full().items_center().justify_center()
      .child(v_flex().w(360).items_center().gap(6)
        .child(h_flex().h(32).w_full().px(12).gap(10).rounded(6).items_center()
          .child(div().flex_none().opacity(0.9).text_color(t.foreground).child(svg("mods/orca-float/terminal-square.svg").size(14)))
          .child(div().min_w(0).truncate().text_size(14).line_height("14px").text_color(t.foreground).child("No live agent sessions")))
        // `ShortcutKeyCombo` (`:135-152`) draws the chord as keycaps; the chord text alone
        // carries the same hint without a second chrome component.
        .child(h_flex().id("orca-float-minimize").h(32).w_full().px(12).gap(10).rounded(6).items_center()
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .role("button").accessibility_label("Minimize floating workspace")
          .on_click((_e, cx) => { this.open = false; cx.notify(); })
          .child(div().flex_none().opacity(0.9).text_color(t.foreground).child(svg("mods/orca-float/minus.svg").size(14)))
          .child(div().flex_1().min_w(0).truncate().text_size(14).line_height("14px").text_color(t.foreground).child("Minimize"))
          .when(Boolean(chord), (el) => el.child(div().flex_none().text_size(10).line_height("12px").opacity(0.9).text_color(t.foreground).child(chord)))));
    return v_flex().id("orca-float").w(w).h(h).min_h(0).overflow_hidden().text_color(t.foreground)
      // Orca's floating title bar (`FloatingTerminalPanelSurface.tsx:116-117`): `h-9`
      // (36px), `border-b border-border`, over the float frame's card colour. Of its
      // window controls (`FloatingTerminalWindowControls.tsx:91-188`) only Minimize —
      // `×`, `onOpenChange(false)` — has a Herdr backend; maximize and the
      // default-agent launch are dropped.
      .child(h_flex().h(36).flex_none().px(12).gap(6).items_center().border_b(1).border_color(t.border)
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12).font_semibold().child("Floating Workspace"))
          .child(div().truncate().text_size(11).text_color(t.muted).child("Live agent sessions")))
        // Minimize's `icon-xs` outline button: `size-6 rounded-md` (`button.tsx:41`),
        // `border-border bg-secondary hover:bg-accent` (`FloatingTerminalWindowControls.tsx:25-26`).
        .child(div().id("orca-float-close").size(24).flex_none().flex().items_center().justify_center().rounded(6)
          .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground).text_size(14)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .role("button").accessibility_label("Hide floating workspace")
          .on_click((_e, cx) => { this.open = false; cx.notify(); })
          .child("×")))
      .child(v_flex().flex_1().min_h(0)
        .when(list.length > 0, (el) => el
          // Orca's list bar (`AiVaultSessionListBar.tsx:59-62`, via orca-agents/main.js:94-99).
          .child(h_flex().h(32).flex_none().items_center().pl(12).pr(6).border_b(1).border_color(t.border).bg(t.raised + "99")
            .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold()
              .child(`${list.length} agent${list.length === 1 ? "" : "s"}`)))
          .child(v_flex().id("orca-float-list").flex_1().min_h(0).overflow_y_scrollbar()
            .children(list.map((a) => this.row(a, t)))))
        .when(list.length === 0, (el) => el.child(empty)));
  }
}
