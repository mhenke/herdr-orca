// Orca's left sidebar: Search, then Tasks / Automations / Orca Mobile nav,
// then the Projects header. The project tree below is orca-spaces.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, openOverlay, shared } from "herdr";

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
    // orca-spaces owns the fold set, so it publishes whether every project is closed;
    // ProjectsCollapseAllButton takes `allCollapsed` as a prop.
    const allCollapsed = Boolean(shared("projects.allCollapsed"));
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
      // Orca's SidebarNav renders Tasks, Automations and Orca Mobile by default
      // (`shouldShowTasksButton` etc. are `!== false`, SidebarNav.tsx:25-31), but each opens a
      // page Herdr has no equivalent for — `openTaskPage()`, `activeView = 'automations'`,
      // `activeView = 'mobile'`. Three rows that do nothing when clicked are worse than an
      // honest gap, so they are dropped and this note takes the same space. Orca's own escape
      // hatch is the same idea: `hideAutomationsButton` / `hideMobileButton` flip a setting and
      // the row stops rendering; we simply start there.
      .child(v_flex().mt(2).w_full().rounded(6).border_1().border_color("#f0f0f01a").px(8).py(8).gap(3)
        .child(div().text_size(11).font_semibold().text_color("#f0f0f099").child("Orca port"))
        .child(div().text_size(11).line_height("15px").text_color("#f0f0f066")
          .child("Tasks, Automations and Orca Mobile open pages Herdr has no equivalent for, so those rows are left out rather than shown dead.")))
      .child(div().h(4))
      // Projects header — SidebarHeader.tsx:61-66: mt-2 h-8 gap-1.5 px-2; title pl-2 pr-0.5
      // text-xs semibold muted/80; actions gap-1, icon-xs buttons (24px) with 14px icons, stroke 2.25.
      .child(h_flex().w_full().h(32).mt(8).px(8).gap(6).items_center().justify_between()
        .child(h_flex().min_w(0).items_center()
          .child(div().pl(8).pr(2).text_size(12).font_semibold().text_color("#969eaecc").child("Projects"))
          // ProjectsCollapseAllButton.tsx — ONE button, not two. `allCollapsed` decides both the
          // glyph and the label/handler: `Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp`
          // (:23) and clicking it always toggles (:51). The wrapper is `w-0 opacity-0` until the
          // header is hovered, then `w-6 opacity-100` (:35-37); Herdr has no header-hover group,
          // so the slot stays visible and only the reveal is dropped.
          // `allCollapsed` arrives over `setShared` from orca-spaces, which owns the fold state.
          .child(div().id("proj-collapse-all").size(24).flex_none().flex().items_center().justify_center().rounded(6)
            .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label(allCollapsed ? "Expand all projects" : "Collapse all projects")
            .on_click(() => run(allCollapsed ? "orca-spaces.expand-all" : "orca-spaces.collapse-all"))
            .child(svg(allCollapsed ? "mods/orca-nav/chevrons-up-down.svg" : "mods/orca-nav/chevrons-down-up.svg").size(14))))
        .child(h_flex().flex_none().items_center().gap(4)
          // sidebar-header-actions.tsx:89-91 — the first of three slots is
          // `flex size-6 shrink-0 items-center` (24x24), holding a `Button variant="ghost"
          // size="icon-xs"` which is `size-6 rounded-md` (button.tsx:41) with a `size-3.5`
          // SlidersHorizontal (SidebarWorkspaceOptionsMenu.tsx:66). The bell is the Agents-view
          // toggle in SidebarHeader.tsx and is `w-8`; this slot is not.
          // Drawn inert: Orca's menu filters/groups the worktree list, and Herdr has no filter
          // model to drive — same convention as Tasks/Automations/Orca Mobile (RECIPE.md:50).
          .child(div().id("proj-workspace-options").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("Workspace options")
            .on_click(noop)
            .child(svg("mods/orca-nav/sliders-horizontal.svg").size(14)))
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