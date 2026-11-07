import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, props, window, setShared, layout } from "herdr";

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
  // `.titlebar-icon-button` is padding 4 + a 14px glyph = 22 (main.css:1288);
  // `.sidebar-toggle` is padding 4px 8px + a 16px glyph = 32x24 (main.css:1219).
  button(id, label, action, w = 22, h = 22) {
    const t = theme();
    return div().id(id).w(w).h(h).mr(4).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = sidebarHidden();
    if (props()?.footer) {
      // Orca's sidebar footer: two 4px-gap clusters either side of the row
      // (SidebarToolbar.tsx:69-73). Each control is icon-xs 24px, rounded-md 8px,
      // with a 14px glyph (button.tsx:41, SidebarSettingsHelpMenu.tsx:203).
      const row = (id, icon, label, action) => div().id(id).size(24).flex_none().flex().items_center().justify_center().rounded(8)
        .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .role("button").accessibility_label(label).on_click(action).child(svg(`mods/orca-chrome/${icon}.svg`).size(14));
      return h_flex().size_full().items_center().justify_between().bg(t.chrome).border_t(1).border_color(t.border).px(8).text_size(12)
        .child(h_flex().items_center().gap(4)
          .child(row("settings", "settings", "Settings", () => run("app.settings")))
          // Herdr has no dropdown menu; Help opens the command surface. CircleHelp,
          // not CircleCheck (SidebarSettingsHelpMenu.tsx:233).
          .child(row("help", "circle-help", "Help", () => run("app.palette"))));
        // Orca's right cluster holds Reveal active workspace and Workspace board
        // (SidebarToolbar.tsx:76-112); neither has a Herdr command, so nothing is drawn.
        // The Herdr-only `+` (Add machine) that sat here is gone: Orca's footer has no plus.
    }
    // TitlebarLeftControls.tsx: with a custom titlebar (Linux/Windows) the row is the logo,
    // then the application-menu button; macOS instead reserves `.titlebar-traffic-light-pad`
    // (80px, main.css:1109-1113) or `pl-2` in full screen (line 62), and never shows the
    // app-name label or a logo. `···` opens the same command surface the sidebar's search
    // row does, since Herdr has no native app menu. Herdr's own logo replaces Orca's.
    const mac = window()?.platform === "macos";
    const leftPad = collapsed ? 6 : mac ? (window()?.fullscreen ? 8 : 80) : 10;
    return h_flex().size_full().bg(t.chrome).pl(leftPad).pr(10).gap(4).items_center().border_b(1).border_color(t.border).text_size(13.5)
      .when(!collapsed && !mac, el => el.child(h_flex().gap(0).items_center()
        .child(image("frame/welcome/herdr.png").size(16).opacity(0.75))
        .child(this.button("menu", svg("mods/orca-chrome/menu.svg").size(14), () => run("mod.open", { name: "picker" })))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && mac), el => el.child(this.button("sidebar-toggle", svg("mods/orca-chrome/panel-left.svg").size(16), toggleSidebar, 32, 24)));
  }
}
