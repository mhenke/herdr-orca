import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// Orca hides the sidebar (w-0, AppWorkspaceShell.tsx:159) and the toggle lives in the
// titlebar, outside it (TitlebarLeftControls.tsx). Same here: show/hide the column, and
// the toggle exists in both states, so a hidden sidebar is always recoverable.
const sidebarHidden = () => Boolean(find(layout(), "sidebar")?.hidden);

function toggleSidebar() {
  setShared("sidebar.collapsed", !sidebarHidden());
  run(sidebarHidden() ? "layout.show" : "layout.hide", { id: "sidebar" });
}

export default class WorkspaceChrome extends View {
  button(id, label, action) {
    const t = theme();
    return div().id(id).size(22).mr(4).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = sidebarHidden();
    if (props()?.footer) {
      // Orca's sidebar footer: compact icon controls, not full-width text rows.
      const row = (id, icon, label, action) => div().id(id).size(22).flex_none().flex().items_center().justify_center().rounded(4)
        .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .role("button").accessibility_label(label).on_click(action).child(svg(`mods/orca-chrome/${icon}.svg`).size(14));
      return h_flex().size_full().items_center().gap(2).bg(t.chrome).border_t(1).border_color(t.border).px(8).text_size(12)
        .child(row("settings", "settings", "Settings", () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(div().absolute().top(4).right(4).size(5).rounded_full().bg(t.accent))))
        .child(row("help", "circle-check", "Help", () => run("app.palette")))
        .child(row("machine", "plus", "Add machine", () => run("mod.open", { name: "machine-add" })));
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      // TitlebarLeftControls: logo h-16px, margin 0 4px 0 10px, opacity .75; icon buttons 14px, p-4, r-4.
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(0).items_center().child(image("frame/welcome/herdr.png").size(16).opacity(0.75).mr(4)).child(div().ml(6).font_semibold().text_color(t.foreground).child("Herdr"))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/orca-chrome/search.svg").size(14), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/orca-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
