// Orca's left sidebar: history arrows, Search, the Tasks / Automations / Orca Mobile rows, then
// the Projects header. The project tree under the header is orca-spaces; the three rows open
// pages in the middle column (`page-tasks` …), which the `orca` layout puts in the `main`
// stack. Bare rows rather than an omission: each page states its own gap (ADR 0004).
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, openOverlay, closeOverlay, shared, window, layout, pickFolder, props, spaces, machines } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// Orca walks page history with the titlebar arrows (`TitlebarLeftControls.tsx:106-145`,
// `worktree-nav-history`: back/forward, disabled at either end). Here the history is the `main`
// stack's page selections, kept module-level so it survives re-renders.
const HISTORY = { pages: ["main-terminals"], at: 0 };
function pushHistory(page) {
  if (HISTORY.pages[HISTORY.at] === page) return;
  HISTORY.pages = [...HISTORY.pages.slice(0, HISTORY.at + 1), page];
  HISTORY.at = HISTORY.pages.length - 1;
}

// Orca keeps the Workspace options in PersistedUIState (`persisted-ui-state-types.ts:39-89`):
// groupBy, sortBy, projectOrderBy, filterRepoIds, visibleWorkspaceHostIds, the hide* filters and
// worktreeCardProperties. Herdr mods have no shared store, so the menu writes this versioned
// object and orca-spaces reads it in its row projection — the same one-way handoff as
// `projects.saved.v1`. Defaults are Orca's NO_WORKSPACE_ROW_FILTERS
// (`workspace-row-filters.ts:45-56`) plus repo grouping and manual sort.
const OPTIONS_KEY = "workspace.options.v1";
const OPTIONS_DEFAULTS = {
  groupBy: "repo",              // none | workspace-status | repo
  sortBy: "manual",             // name | smart | recent | repo | manual
  projectOrderBy: "manual",     // manual | recent
  filterRepoIds: [],
  visibleWorkspaceHostIds: null,
  hideSleepingWorkspaces: false,
  alwaysShowDefaultBranchWorkspace: true,
  hideDefaultBranchWorkspace: false,
  hideAutomationGeneratedWorkspaces: false,
  hideCliCreatedWorkspaces: false,
  hideWorkspacesFromOtherDevices: false,
  hideDetachedHeadWorkspaces: false,
};

function readOptions() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "null"); } catch { saved = null; }
  return saved && typeof saved === "object" && !Array.isArray(saved)
    ? { ...OPTIONS_DEFAULTS, ...saved }
    : { ...OPTIONS_DEFAULTS };
}

function writeOptions(patch) {
  const next = { ...readOptions(), ...patch };
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
  // orca-spaces re-reads the key inside ordered(), so nothing has to be sent to it. An
  // invented cross-mod command is not a notification: an unregistered name is a warn and an
  // error (`window.rs:2763`), and `setShared` does not notify (AGENTS.md rule 10). The sidebar
  // repaints when this popup closes, because removing an overlay notifies the window
  // (`window.rs:3642-3664`), and the reopened popup always re-reads the stored options.
  return next;
}

// CountActiveWorkspaceFilters (workspace-row-filters.ts:182-194): each narrowing boolean, plus
// one per selected project and the host scope when narrowed. The default-branch exemption
// counts only while the sleeping sweep is on.
function activeFilterCount(o) {
  let n = 0;
  if (o.hideSleepingWorkspaces) n++;
  if (o.hideSleepingWorkspaces && o.alwaysShowDefaultBranchWorkspace === false) n++;
  if (o.hideDefaultBranchWorkspace) n++;
  if (o.hideAutomationGeneratedWorkspaces) n++;
  if (o.hideCliCreatedWorkspaces) n++;
  if (o.hideWorkspacesFromOtherDevices) n++;
  if (o.hideDetachedHeadWorkspaces) n++;
  if (o.visibleWorkspaceHostIds !== null) n++;
  n += o.filterRepoIds.length;
  return n;
}

// Host sections: every machine a space lives on, plus this computer. Orca's picker hides a host
// with no rows (`host-section-rows.ts:236-246`), so spaces() is the source, not machines().
function hostChoices() {
  const seen = new Map();
  for (const s of spaces()) seen.set(s.machine ?? null, s.machine ?? "This computer");
  for (const m of machines()) if (!seen.has(m.name)) seen.set(m.name, m.name ?? "This computer");
  return [...seen].map(([id, label]) => ({ id, label }));
}

// Projects are repo identities: `git.cache.v2` keys rows by `[machine, common dir]` and its value
// carries the display name (`main.js` hydrateGit). A folder workspace is not a project filter
// target (workspace-row-filters.ts:119-121 exempts folder rows), so only g.repo entries appear.
function projectChoices() {
  try {
    const cache = JSON.parse(localStorage.getItem("git.cache.v2") ?? "{}") ?? {};
    const seen = new Map();
    for (const g of Object.values(cache)) if (g?.repo) seen.set(g.repo, g.name ?? g.repo);
    return [...seen].map(([id, label]) => ({ id, label }));
  } catch {
    return [];
  }
}

const SORT_CHOICES = [
  ["name", "Name"],
  ["smart", "Agent Activity"],
  ["recent", "Recent"],
  ["repo", "Project"],
  ["manual", "Manual"],
];
const PROJECT_ORDER_CHOICES = [
  ["manual", "Manual"],
  ["recent", "Recent"],
];
const GROUP_BY_CHOICES = [
  ["none", "None"],
  ["workspace-status", "Status"],
  ["repo", "Project"],
];

function labelOf(choices, value) {
  return choices.find(([id]) => id === value)?.[1] ?? choices[0][1];
}

export default class Nav extends View {
  // The placed nav is not focusable; the popup copy is. Its keyboard list starts at the first row
  // (dropdown-menu.tsx:115 data-[current=true]), and Esc closes it (SidebarWorkspaceOptionsMenu
  // closes its Radix DropdownMenu).
  init(_props, cx) {
    if (!props()?.navMenu) return;
    this.at = -1;
    this.page = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  render(cx) {
    if (props()?.navMenu === "workspace-options") return this.optionsView(cx);
    const t = theme();
    // orca-spaces owns the fold set, so it publishes whether every project is closed;
    // ProjectsCollapseAllButton takes `allCollapsed` as a prop.
    const allCollapsed = Boolean(shared("projects.allCollapsed"));
    // `WorktreeList.tsx:290` — the collapse-all button is mounted only when there is at least
    // one collapsible project (`projectCollapseKeys.length > 0`). orca-spaces publishes that
    // count because the header has no view of the row plan. Zero projects means no button,
    // not a disabled one.
    const projectCount = Number(shared("projects.count") ?? 0);
    // `OptionsFilterCountBadge` (options-filter-count-badge.tsx): a corner badge on the trigger,
    // 12px tall, 9px text, primary fill; 9+ past nine.
    const filters = activeFilterCount(readOptions());
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
    // SidebarNav.tsx:120/179/213 — Tasks, Automations, Orca Mobile: the same row shape
    // (`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium
    // tracking-tight`), icon `size-4` at 30% while the page is not shown, active row on the
    // accent pair. Each opens a page in the middle column (`layout.select`, `commands.rs:81`).
    const main = find(layout(), "main");
    const shown = main?.active ?? "main-terminals";
    const pageRow = (id, icon, label, page) => h_flex().id(id).w_full().h(31.5).px(8).gap(8).items_center().rounded(6)
      .text_size(13).font_medium().cursor_pointer().role("button").accessibility_label(label).tooltip(label)
      .when(shown === page, el => el.bg(t.accent).text_color(t.accent_foreground))
      .when(shown !== page, el => el.text_color("#f0f0f099").hover(s => s.bg("#f0f0f014").text_color(t.foreground)))
      .on_click(() => { pushHistory(page); run("layout.select", { stack: "main", child: page }); })
      .child(svg(`mods/orca-nav/${icon}.svg`).size(16).flex_none().text_color(shown === page ? t.accent_foreground : "#f0f0f04d"))
      .child(div().flex_1().truncate().child(label));
    // `.sidebar-toggle-compact` (`main.css:1233-1251`): 4/5 padding around a 16px glyph, radius 4,
    // muted, hover accent + foreground, disabled muted; no history in that direction disables it.
    const arrow = (id, icon, label, step, enabled) => div().id(id).size(24).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(enabled ? t.muted : "#f0f0f033")
      .role("button").accessibility_label(label).tooltip(label)
      .when(enabled, el => el.cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => { HISTORY.at = step(HISTORY.at); run("layout.select", { stack: "main", child: HISTORY.pages[HISTORY.at] }); }))
      .child(svg(`mods/orca-nav/${icon}.svg`).size(16));
    return v_flex().w_full().flex_none().px(8).pt(8).pb(4).gap(2).bg(t.chrome)
      .child(h_flex().w_full().gap(6).items_center().flex_none()
        .child(arrow("nav-back", "arrow-left", "Back", at => Math.max(0, at - 1), HISTORY.at > 0))
        .child(arrow("nav-forward", "arrow-right", "Forward", at => Math.min(HISTORY.pages.length - 1, at + 1), HISTORY.at < HISTORY.pages.length - 1)))
      .child(search)
      .child(pageRow("nav-tasks", "list", "Tasks", "page-tasks"))
      .child(pageRow("nav-automations", "calendar-clock", "Automations", "page-automations"))
      .child(pageRow("nav-mobile", "smartphone", "Mobile", "page-mobile"))
      // Projects header — SidebarHeader.tsx:60-63: `group/sidebar-header mt-2 flex h-8 min-w-0
      // shrink-0 items-center justify-between gap-1.5 px-2`; title `pl-2 pr-0.5 text-xs
      // font-semibold text-muted-foreground/80`; actions group `flex shrink-0 items-center gap-1`.
      // Icons are plain Lucide at their default stroke-width 2 — there is no global override in
      // Orca's CSS (main.css:3090 is a feature-wall decoration, not icons).
      .child(h_flex().w_full().h(32).mt(8).gap(6).items_center().justify_between()
        // `SidebarHeader.tsx:61` is `group/sidebar-header`; the collapse-all wrapper is
        // `can-hover:w-0 can-hover:opacity-0`, becoming `w-6 opacity-100` on that hover or on
        // `focus-within` (ProjectsCollapseAllButton.tsx:35-38). Herdr has no descendant selector,
        // so the row's `.on_hover` is the gate and the button mounts only then. Dropped:
        // `focus-within`, since the button is not mounted while hidden.
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
          // `allCollapsed` arrives over `setShared` from orca-spaces, which owns the fold state.
          .when(projectCount > 0 && this.headerHover, el => el.child(div().id("proj-collapse-all").size(24).flex_none().flex().items_center().justify_center().rounded(6)
            .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label(allCollapsed ? "Expand all projects" : "Collapse all projects")
            .on_click(() => run(allCollapsed ? "orca-spaces.expand-all" : "orca-spaces.collapse-all"))
            // ProjectsCollapseAllButton.tsx:51 renders a bare `<Icon />`, so the icon-xs
            // `[&_svg:not([class*='size-'])]:size-3` rule (button.tsx:59) applies: 12px.
            .child(svg(allCollapsed ? "mods/orca-nav/chevrons-up-down.svg" : "mods/orca-nav/chevrons-down-up.svg").size(12)))))
        // ORDER, from SidebarHeader.tsx:76-100 — `SidebarHeaderActions` runs
        // options -> AddProject -> NewWorkspace.
        // SidebarHeader.tsx:101 — the bell swaps the sidebar body to agents; orca-agents is a right-sidebar panel, so there is no second body.
        // SidebarWorkspaceOptionsMenu.tsx:43-68 — a ghost icon-xs button (24x24) holding
        // SlidersHorizontal `size-3.5` with the explicit `strokeWidth={2.25}` (:66), plus the
        // corner filter badge. `sidebar-header-actions.tsx:92` places it before AddProject.
        // Herdr has no Radix DropdownMenu, so the menu is this mod's own popup overlay, opened
        // with the same openOverlay({kind:"popup"}) call orca-menu and new-menu use; the props
        // select optionsView in render(). Choices persist in "workspace.options.v1" and
        // orca-spaces reads that key in ordered().
        // AddProjectButton (:27-31) — FolderPlus `size-3.5` at the explicit `strokeWidth={2.25}`.
        .child(h_flex().flex_none().items_center().gap(4)
          .child(div().id("proj-options").relative().size(24).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted)
            .hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").tooltip(filters ? `Workspace options (${filters} filter${filters === 1 ? "" : "s"})` : "Workspace options")
            .accessibility_label(filters ? `Workspace options (${filters} filter${filters === 1 ? "" : "s"} active)` : "Workspace options")
            .on_click(() => openOverlay({ mod: "orca-nav", kind: "popup", width: 288, height: 560, props: { navMenu: "workspace-options" } }))
            .child(svg("mods/orca-nav/sliders-horizontal.svg").size(14).flex_none())
            .when(filters > 0, el => el.child(div().absolute().top(-2).right(-2).h(12).min_w(12).px(2).rounded_full().bg(t.accent).flex().items_center().justify_center()
              .text_size(9).line_height("9px").text_color(t.accent_foreground).child(filters > 9 ? "9+" : String(filters)))))
          .child(div().id("proj-add-repo").size(24).flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
            .role("button").accessibility_label("Add project")
            .on_click(() => {
              // herdr.d.ts:39 — the folder picker is async: `Promise<string | null>`.
              // Taking the promise as a value stored "[object Promise]" as the folder.
              void pickFolder().then((folder) => {
                if (!folder) return;
                // Append to persisted project list
                const existing = JSON.parse(localStorage.getItem("projects.saved.v1") || "[]");
                // Avoid duplicates
                if (!existing.includes(folder)) {
                  existing.push(folder);
                  localStorage.setItem("projects.saved.v1", JSON.stringify(existing));
                }
                run("space.new", { folder });
              });
            })
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

  // ---- Workspace options overlay (SidebarWorkspaceOptionsMenu.tsx + workspace-options-menu-items.tsx) ----
  // One popup page at a time stands in for Radix's DropdownMenuSub (Herdr has no submenu
  // primitive); a back row returns to the root. Row geometry follows dropdown-menu.tsx:
  // items h-24 px-2.5 rounded-md text-13; separators mx-2.5 my-[5px] h-px; labels 11px semibold.
  optionsView(cx) {
    const t = theme();
    const rows = this.page ? this.pageRows(this.page) : this.rootRows();
    // The group-by row is the segmented control itself, so keyboard activation skips it.
    const nav = rows.filter((r) => r.kind !== "separator" && r.kind !== "label" && r.kind !== "heading" && r.kind !== "gap" && r.kind !== "groupby");
    if (!nav.includes(rows[this.at])) this.at = rows.indexOf(nav[0] ?? rows[0]);
    return v_flex().id("workspace-options").track_focus(this.handle).w_full().min_h(0).p(4).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        // Radix menu keyboard: up/down move the current row, Home/End jump, Enter/Space activate
        // (dropdown-menu.tsx:115 data-[current=true]; context-menu.tsx:31-62).
        if (e.key === "down" || e.key === "up") {
          const i = Math.max(0, nav.indexOf(rows[this.at]));
          const next = e.key === "down" ? (i + 1) % nav.length : (i + nav.length - 1) % nav.length;
          this.at = rows.indexOf(nav[next]);
        } else if (e.key === "home") this.at = rows.indexOf(nav[0]);
        else if (e.key === "end") this.at = rows.indexOf(nav[nav.length - 1]);
        else if (e.key === "enter" || e.key === "space") { const row = rows[this.at]; if (row) this.act(row, cx); }
        else if (e.key === "escape") closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .children(rows.map((row, i) => this.menuRow(row, i, t, cx)));
  }

  rootRows() {
    const o = readOptions();
    const hosts = hostChoices();
    const projects = projectChoices();
    const rows = [];
    const push = (row) => rows.push(row);
    // WorkspaceOptionsMenuItems (:299-307): the title label, then sections separated by rules.
    push({ kind: "label", text: "Workspace options" });
    // Show — getShownWorkspaceViewSections SHOWN (workspace-view-options.ts:120-141):
    // hosts only with another host, projects only with more than one project.
    if (hosts.length > 1 || o.visibleWorkspaceHostIds !== null) {
      if (!rows.some((r) => r.kind === "heading")) push({ kind: "heading", text: "Show" });
      push({ kind: "page", page: "hosts", label: "Hosts", value: o.visibleWorkspaceHostIds === null ? "All hosts" : `${o.visibleWorkspaceHostIds.length} hosts` });
    }
    if (projects.length > 1) {
      if (!rows.some((r) => r.kind === "heading")) push({ kind: "heading", text: "Show" });
      push({ kind: "page", page: "projects", label: "Projects", value: o.filterRepoIds.length ? `${o.filterRepoIds.length} projects` : "All projects" });
    }
    // Group by — SidebarGroupByToggle.tsx is an inline segmented control, not a submenu.
    push({ kind: "separator" });
    push({ kind: "heading", text: "Group by" });
    push({ kind: "groupby" });
    // Arrange — no heading in WORKSPACE_VIEW_SECTION_LABELS (:89-94).
    push({ kind: "separator" });
    push({ kind: "page", page: "sort", label: "Sort by", value: labelOf(SORT_CHOICES, o.sortBy) });
    // projectOrderBy is shown only under repo grouping (workspace-view-options.ts:133).
    if (o.groupBy === "repo") push({ kind: "page", page: "projectOrder", label: "Project order", value: labelOf(PROJECT_ORDER_CHOICES, o.projectOrderBy) });
    // Card layout and Show properties exist in Orca's legacy card surface; Herdr's
    // worktree-card-surface port has one fixed shape, so these keep Orca's disabled-row
    // geometry (`data-[disabled]:opacity-40`, dropdown-menu.tsx:115) and name the gap.
    push({ kind: "gap", label: "Card layout", note: "Herdr draws one card style; worktree-card-surface.tsx has no compact layout." });
    push({ kind: "gap", label: "Show properties", note: "Herdr's card has no per-property model; branch and review badge are fixed." });
    // Filters — workspace-filter-option-row.tsx FILTER_ROWS ordering.
    push({ kind: "separator" });
    push({ kind: "heading", text: "Filters" });
    push({ kind: "gap", label: "Hide sleeping", note: "Herdr has no sleep state; Model::status is working, blocked, done or idle." });
    push({ kind: "toggle", key: "hideDefaultBranchWorkspace", label: "Hide default branch" });
    push({ kind: "gap", label: "Hide automation-created", note: "Herdr records no automation provenance for a space." });
    push({ kind: "gap", label: "Hide CLI-created", note: "Herdr records no CLI provenance for a space." });
    if (machines().length > 1) push({ kind: "gap", label: "Hide other-client workspaces", note: "Herdr records no other-client provenance for a space." });
    push({ kind: "toggle", key: "hideDetachedHeadWorkspaces", label: "Hide detached HEAD" });
    return rows;
  }

  pageRows(page) {
    const o = readOptions();
    const rows = [{ kind: "back", label: "Back" }];
    if (page === "hosts") {
      const all = o.visibleWorkspaceHostIds === null;
      rows.push({ kind: "hostAll", label: "All hosts", checked: all });
      for (const h of hostChoices()) rows.push({ kind: "host", host: h.id, label: h.label, checked: all || o.visibleWorkspaceHostIds.includes(h.id) });
    } else if (page === "projects") {
      rows.push({ kind: "projectClear", label: "Clear", disabled: o.filterRepoIds.length === 0 });
      for (const p of projectChoices()) rows.push({ kind: "project", project: p.id, label: p.label, checked: o.filterRepoIds.includes(p.id) });
    } else {
      const choices = page === "sort" ? SORT_CHOICES : PROJECT_ORDER_CHOICES;
      const key = page === "sort" ? "sortBy" : "projectOrderBy";
      for (const [value, label] of choices) rows.push({ kind: "radio", key, value, label, checked: o[key] === value });
    }
    return rows;
  }

  act(row, cx) {
    const o = readOptions();
    if (row.kind === "gap") return;
    if (row.kind === "back") { this.page = null; this.at = -1; cx.notify(); return; }
    if (row.kind === "page") { this.page = row.page; this.at = -1; cx.notify(); return; }
    if (row.kind === "toggle") { writeOptions({ [row.key]: !o[row.key] }); cx.notify(); return; }
    if (row.kind === "radio") { writeOptions({ [row.key]: row.value }); cx.notify(); return; }
    if (row.kind === "groupby") { writeOptions({ groupBy: row.value }); cx.notify(); return; }
    if (row.kind === "hostAll") { writeOptions({ visibleWorkspaceHostIds: null }); cx.notify(); return; }
    if (row.kind === "host") {
      const all = hostChoices().map((h) => h.id);
      const current = o.visibleWorkspaceHostIds === null ? all : o.visibleWorkspaceHostIds;
      const next = current.includes(row.host) ? current.filter((id) => id !== row.host) : [...current, row.host];
      // Orca disables the last checked host row so the sidebar cannot show none.
      if (next.length === 0) return;
      writeOptions({ visibleWorkspaceHostIds: next.length === all.length ? null : next });
      cx.notify();
      return;
    }
    if (row.kind === "projectClear") { writeOptions({ filterRepoIds: [] }); cx.notify(); return; }
    if (row.kind === "project") {
      const next = o.filterRepoIds.includes(row.project)
        ? o.filterRepoIds.filter((id) => id !== row.project)
        : [...o.filterRepoIds, row.project];
      writeOptions({ filterRepoIds: next });
      cx.notify();
    }
  }

  menuRow(row, i, t, cx) {
    // `cx` is only for the inline group-by control, which writes and must redraw its own selection.
    if (row.kind === "separator") return div().mx(10).my(5).h(1).bg(t.border);
    if (row.kind === "label") return div().px(10).pt(5).text_size(14).text_color(t.foreground).child(row.text);
    if (row.kind === "heading") return div().px(10).pt(5).pb(3).text_size(11).font_semibold().text_color(t.muted).child(row.text);
    if (row.kind === "groupby") return this.groupToggle(readOptions(), t);
    const current = this.at === i;
    const disabled = row.kind === "gap" || Boolean(row.disabled);
    // Row shape: `rounded-md px-2.5 py-1 text-[13px] leading-4` = 24px; disabled is
    // `pointer-events-none opacity-40` (dropdown-menu.tsx:115).
    return h_flex().id(`opt-${i}`).h(24).px(10).gap(8).items_center().justify_between().rounded(6)
      .text_size(13).line_height("16px").text_color(disabled ? t.muted : t.foreground)
      .when(disabled, (el) => el.opacity(0.4).tooltip(row.note))
      .when(current && !disabled, (el) => el.bg(t.selected))
      .when(!disabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => { if (on && this.at !== i) { this.at = i; cx.notify(); } })
        .on_click((_e, cx) => this.act(row, cx)))
      .when(row.kind === "radio" || row.kind === "host" || row.kind === "hostAll" || row.kind === "project" || row.kind === "toggle",
        (el) => el.child(div().w(14).flex_none().text_size(12).child(row.kind === "radio" ? (row.checked ? "●" : "") : (row.checked ? "✓" : ""))))
      .child(div().flex_1().min_w(0).truncate().child(row.label))
      // Right value: `ml-auto text-[11px] font-medium text-muted-foreground` (:93-147).
      .child(div().flex_none().max_w(150).truncate().text_size(11).font_medium().text_color(t.muted)
        .child(row.kind === "page" ? `${row.value} ›` : row.kind === "gap" ? "Unavailable" : row.kind === "projectClear" ? "" : ""));
  }

  // SidebarGroupByToggle.tsx: `h-6 w-full`, each item `h-6 grow basis-0 px-1 text-[10px]`,
  // selected `bg-foreground/10 font-semibold text-foreground`.
  groupToggle(o, t) {
    return h_flex().mx(8).mt(2).mb(4).h(24).rounded(6).border_1().border_color(t.border)
      .children(GROUP_BY_CHOICES.map(([value, label]) => div().id(`opt-group-${value}`)
        .flex_1().h(24).flex().items_center().justify_center().px(4).text_size(10).cursor_pointer()
        .when(o.groupBy === value, (el) => el.bg("#f0f0f01a").font_semibold().text_color(t.foreground))
        .when(o.groupBy !== value, (el) => el.text_color(t.muted).hover((s) => s.text_color(t.foreground)))
        .on_click((_e, cx) => { writeOptions({ groupBy: value }); cx.notify(); })
        .child(label)));
  }
}