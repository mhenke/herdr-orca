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
      // Projects header — SidebarHeader.tsx:60-63: `group/sidebar-header mt-2 flex h-8 min-w-0
      // shrink-0 items-center justify-between gap-1.5 px-2`; title `pl-2 pr-0.5 text-xs
      // font-semibold text-muted-foreground/80`; actions group `flex shrink-0 items-center gap-1`.
      // Icons are plain Lucide at their default stroke-width 2 — there is no global override in
      // Orca's CSS (main.css:3090 is a feature-wall decoration, not icons).
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
          // ORDER, from SidebarHeader.tsx: bottom of the header is the bell popover (its own
          // Button, `w-8`, SidebarHeader.tsx:89-97), and only THEN `SidebarHeaderActions`
          // (sidebar-header-actions.tsx:88-100) which is options -> AddProject -> NewWorkspace.
          // So left to right: bell, options, add-project, new-workspace. We had the options
          // slot before the bell.
          // The bell is `w-8` with a Bell `size-3` and a status badge in its top-right
          // (`:108-127`); the badge shows a question glyph when anything needs attention, a
          // small dot while working, and the count below. Herdr has no attention count for the
          // sidebar, so the badge stays off rather than inventing a number.
          .child(div().id("proj-activity").w(32).h(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("View activity")
            .on_click(noop)
            .child(svg("mods/orca-nav/bell.svg").size(12).flex_none()))
          // sidebar-header-actions.tsx:90-97 — first slot is `flex size-6 shrink-0 items-center`
          // (24x24) holding a `Button size="icon-xs"` (`size-6 rounded-md`) with a `size-3.5`
          // SlidersHorizontal (SidebarWorkspaceOptionsMenu.tsx:66). Inert: Orca's menu filters
          // and groups the worktree list, and Herdr has no filter model to drive.
          .child(div().id("proj-workspace-options").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("Workspace options")
            .on_click(noop)
            .child(svg("mods/orca-nav/sliders-horizontal.svg").size(14)))
          // AddProjectButton (:27-31) — FolderPlus `size-3.5` at the explicit `strokeWidth={2.25}`.
          .child(div().id("proj-add-repo").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("Add project")
            .on_click(() => run("space.new"))
            .child(svg("mods/orca-nav/folder-plus.svg").size(14)))
          // NewWorkspaceButton (:60-64) — Plus `size-3.5`, same 2.25 stroke. Orca's header
          // actions are `size="icon-xs"` buttons, which are 24x24, so this is not wider than
          // the options slot.
          .child(div().id("proj-new").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("New workspace")
            .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))
            .child(svg("mods/orca-nav/plus.svg").size(14)))));;
  }
}