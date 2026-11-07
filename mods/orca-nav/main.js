// Orca's left sidebar: Search, then the Projects header (Tasks / Automations / Orca Mobile are
// omitted, see below). The project tree under the header is orca-spaces.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, openOverlay, shared, window } from "herdr";

export default class Nav extends View {
  render() {
    const t = theme();
    // orca-spaces owns the fold set, so it publishes whether every project is closed;
    // ProjectsCollapseAllButton takes `allCollapsed` as a prop.
    const allCollapsed = Boolean(shared("projects.allCollapsed"));
    // `WorktreeList.tsx:290` — the collapse-all button is mounted only when there is at least
    // one collapsible project (`projectCollapseKeys.length > 0`). orca-spaces publishes that
    // count because the header has no view of the row plan. Zero projects means no button,
    // not a disabled one.
    const projectCount = Number(shared("projects.count") ?? 0);
    // SidebarNav.tsx:90-118 — container gap-0.5 px-2; Search is a button, not an input: full width,
    // gap 8, rounded 6, bg foreground/5, px 8, py-1.5, text 13 medium foreground/60, icon 16 at /30.
    // py-1.5 (6+6) + 13px text at preflight's inherited line-height 1.5 (19.5) = Orca's 31.5px row.
    // :92 opens `worktree-palette`; Herdr's counterpart is the picker mod, not the command palette.
    const search = h_flex().id("nav-search").w_full().h(31.5).px(8).gap(8).items_center().rounded(6)
      .bg("#f0f0f00d").text_size(13).font_medium().text_color("#f0f0f099").cursor_pointer()
      .role("button").accessibility_label("Search worktrees")
      .hover(s => s.bg("#f0f0f014"))
      .on_click(() => run("mod.open", { name: "picker" }))
      .child(svg("mods/orca-nav/search.svg").size(16).flex_none().text_color("#f0f0f04d"))
      .child(div().flex_1().child("Search"));
    return v_flex().w_full().flex_none().px(8).pt(8).pb(4).gap(2).bg(t.chrome)
      .child(search)
      .child(div().h(2))
      // SidebarNav.tsx:120 (Tasks), :179 (Automations) and :213 (Orca Mobile) open pages Herdr has
      // no backend for, so the rows are omitted rather than rendered dead.
      .child(div().h(4))
      // Projects header — SidebarHeader.tsx:60-63: `group/sidebar-header mt-2 flex h-8 min-w-0
      // shrink-0 items-center justify-between gap-1.5 px-2`; title `pl-2 pr-0.5 text-xs
      // font-semibold text-muted-foreground/80`; actions group `flex shrink-0 items-center gap-1`.
      // Icons are plain Lucide at their default stroke-width 2 — there is no global override in
      // Orca's CSS (main.css:3090 is a feature-wall decoration, not icons).
      .child(h_flex().w_full().h(32).mt(8).gap(6).items_center().justify_between()
        // `SidebarHeader.tsx:70` is `group/sidebar-header`; the collapse-all wrapper is
        // `can-hover:w-0 can-hover:opacity-0` and only becomes `w-6 opacity-100` on
        // `group-hover/sidebar-header` or `focus-within` (ProjectsCollapseAllButton.tsx:35-37).
        // Herdr has no descendant-selector hover, so the row tracks the pointer and the button
        // renders only then — same result, script instead of CSS.
        .on_hover((on, cx) => {
          // Hover is only ever cleared by a pointer transition. A window that goes
          // inactive (pointer on another window, no move events delivered here) keeps
          // the last value, so the button stays mounted after the pointer left.
          // `window().active` reports that state; clearing here is where the stale
          // value originates, not a guard applied downstream.
          const live = on && window().active;
          if (live !== this.headerHover) { this.headerHover = live; cx.notify(); }
        })
        .child(h_flex().min_w(0).items_center()
          // `text-muted-foreground/80`: main.css:365 #acacac at 80% = #8a8a8a.
          .child(div().pl(8).pr(2).text_size(12).font_semibold().text_color("#8a8a8a").child("Projects"))
          // ProjectsCollapseAllButton.tsx — ONE button, not two. `allCollapsed` decides both the
          // glyph and the label/handler: `Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp`
          // (:23) and clicking it always toggles (:51). The wrapper is `w-0 opacity-0` until the
          // header is hovered, then `w-6 opacity-100` (:35-37); Herdr has no header-hover group,
          // so the slot stays visible and only the reveal is dropped.
          // `allCollapsed` arrives over `setShared` from orca-spaces, which owns the fold state.
          // Only with projects to collapse. The wrapper is `w-0 opacity-0` until the header is
          // hovered (`ProjectsCollapseAllButton.tsx:35-37`); Herdr has no `group/sidebar-header`
          // descendant rule, so `on_hover` on the row drives a `.when` — the same technique the
          // project group headers use for their action cluster.
          .when(projectCount > 0 && this.headerHover, el => el.child(div().id("proj-collapse-all").size(24).flex_none().flex().items_center().justify_center().rounded(6)
            .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label(allCollapsed ? "Expand all projects" : "Collapse all projects")
            .on_click(() => run(allCollapsed ? "orca-spaces.expand-all" : "orca-spaces.collapse-all"))
            // ProjectsCollapseAllButton.tsx:51 renders a bare `<Icon />`, so the icon-xs
            // `[&_svg:not([class*='size-'])]:size-3` rule (button.tsx:59) applies: 12px.
            .child(svg(allCollapsed ? "mods/orca-nav/chevrons-up-down.svg" : "mods/orca-nav/chevrons-down-up.svg").size(12)))))
        .child(h_flex().flex_none().items_center().gap(4)
          // ORDER, from SidebarHeader.tsx:76-100 — `SidebarHeaderActions` runs
          // options -> AddProject -> NewWorkspace.
          // SidebarHeader.tsx:101 — the bell swaps the sidebar body to agents; orca-agents is a right-sidebar panel, so there is no second body.
          // sidebar-header-actions.tsx:92 / SidebarWorkspaceOptionsMenu.tsx:66 — filter, host-scope, group-by and sort menu; orca-spaces has no filter model.
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
            // tab-bar-surface.tsx:232 — the create menu is `w-72` (288).
            .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 288, height: 512 }))
            .child(svg("mods/orca-nav/plus.svg").size(14)))));;
  }
}