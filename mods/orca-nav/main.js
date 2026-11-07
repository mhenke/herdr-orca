// Orca's left sidebar: Search, then Tasks / Automations / Orca Mobile nav,
// then the Projects header. The project tree below is orca-spaces.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, openOverlay } from "herdr";

export default class Nav extends View {
  row(t, id, icon, label, action) {
    // SidebarNav.tsx buttons: gap 8, px 8, py 6, rounded 6, 13px medium;
    // inactive text foreground/60, icon foreground/30, hover bg foreground/8.
    return h_flex().id(id).w_full().h(28).px(8).gap(8).items_center().rounded(6)
      .text_size(13).font_medium().text_color("#f0f0f099").cursor_pointer()
      .role("button").accessibility_label(label)
      .hover(s => s.bg("#f0f0f014"))
      .on_click(action)
      .child(svg(`mods/orca-nav/${icon}.svg`).size(16).flex_none().text_color("#f0f0f04d"))
      .child(div().child(label));
  }
  render() {
    const t = theme();
    const noop = () => {}; // no destination in Herdr: inert, not hidden
    // SidebarNav.tsx:99-116 — container gap-0.5 px-2; Search is a button, not an input: full width, gap 8,
    // rounded 6, bg foreground/5, px 8, text 13 medium foreground/60, icon 16 at /30.
    const search = h_flex().id("nav-search").w_full().h(28).px(8).gap(8).items_center().rounded(6)
      .bg("#f0f0f00d").text_size(13).font_medium().text_color("#f0f0f099").cursor_pointer()
      .role("button").accessibility_label("Search worktrees")
      .hover(s => s.bg("#f0f0f014"))
      .on_click(() => run("app.palette"))
      .child(svg("mods/orca-nav/search.svg").size(16).flex_none().text_color("#f0f0f04d"))
      .child(div().flex_1().child("Search"));
    return v_flex().w_full().flex_none().px(8).pt(8).pb(4).gap(2).bg(t.chrome)
      .child(search)
      .child(div().h(2))
      // Navigation rows.
      .child(this.row(t, "nav-tasks", "list-checks", "Tasks", noop))
      .child(this.row(t, "nav-automations", "calendar-clock", "Automations", noop))
      .child(this.row(t, "nav-mobile", "smartphone", "Orca Mobile", noop))
      .child(div().h(4))
      // Projects header — SidebarHeader.tsx:61-66: mt-2 h-8 gap-1.5 px-2; title pl-2 pr-0.5
      // text-xs semibold muted/80; actions gap-1, icon-xs buttons (24px) with 14px icons, stroke 2.25.
      .child(h_flex().w_full().h(32).mt(8).px(8).gap(6).items_center().justify_between()
        .child(h_flex().min_w(0).items_center()
          .child(div().pl(8).pr(2).text_size(12).font_semibold().text_color("#969eaecc").child("Projects")))
        .child(h_flex().flex_none().items_center().gap(4)
          // Bell = activity view toggle, w-8 in Orca; no Herdr equivalent, so inert and honest.
          .child(div().id("proj-activity").w(32).h(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("View activity")
            .on_click(noop)
            .child(svg("mods/orca-nav/bell.svg").size(14)))
          .child(div().id("proj-add-repo").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("Add project")
            .on_click(() => run("space.new"))
            .child(svg("mods/orca-nav/folder-plus.svg").size(14)))
          .child(div().id("proj-new").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("New workspace")
            .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))
            .child(svg("mods/orca-nav/plus.svg").size(14)))));
  }
}
