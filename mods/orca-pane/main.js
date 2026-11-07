// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, openOverlay } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .size(24)
      .flex()
      .items_center()
      .justify_center()
      .rounded(6)
      .text_color(t.dim)
      .hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/orca-pane/${icon}.svg`).size(12));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(8)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(13)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      // TerminalPaneHeaderOverlay.tsx:149 `onContextMenuCapture={(e) => onPaneTitleContextMenu(e, pane.id)}`
      // — the pane title bar opens the pane menu on right-click. `orca-menu` already implements
      // the `pane` case (split right/down, zoom, right-click routing, close), so this is the
      // missing caller, not a missing menu.
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "orca-menu", kind: "popup", width: 220, height: 260, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
      })
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/orca-pane/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      // Orca's TerminalPaneHeaderOverlay header actions (TerminalPaneHeaderOverlay.tsx:285,334):
      // SquareSplitVertical (split) then X (close), size-3 glyphs in size-6 icon-xs boxes.
      // Orca has no split-down or zoom button in the header; those live in the right-click
      // menu (TerminalContextMenu.tsx:269,277,294), which `orca-menu` already provides.
      // The trigger buttons sit at opacity 0 until the bar is hovered (terminal.css:401,414),
      // matching this `.when(this.hovered)` gate.
      // Orca's `.pane-title-actions` is `flex shrink-0 items-center gap-0` (TerminalPaneHeaderOverlay.tsx:211),
      // so the split and close glyphs sit flush; the parent h_flex gap(8) would space them otherwise.
      .when(this.hovered, el => el
        .child(div().flex().shrink_0().items_center().gap(0)
          .child(this.button(t, `ph-r-${pane}`, "square-split-vertical", "pane.split", { direction: "right", pane }))
          .child(this.button(t, `ph-x-${pane}`, "x", "pane.close", { pane }))))
  }
}
