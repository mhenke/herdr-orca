// The honest body for an Orca activity panel Herdr has no backend for.
//
// Orca's activity bar renders these entries only when their own data exists: "Attached
// worktrees" and "PR Checks" need a folder workspace (`use-right-sidebar-activity-items.ts:96,103`),
// "Checks" needs a hosted review (`right-sidebar/checks-panel/ChecksPanel.tsx`), "Ports" needs
// its port/forward backends (`right-sidebar/PortsPanel.tsx:17-57`). Herdr has none of them, so
// rather than a dead button the tab states the gap. Geometry follows Orca's own unavailable
// state, `right-sidebar/PortsPanel.tsx:51-55`: centered column, px-4,
// `text-center text-muted-foreground`, a 32px glyph at 50% opacity and `text-sm` copy.
import { View, div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, props } from "herdr";

const GAPS = {
  workspaces: {
    icon: "workflow",
    title: "Attached worktrees",
    body: "Herdr has no folder-workspace model, so there are no attached worktrees to list. Spaces and their checkouts are in the left sidebar."
  },
  "pr-checks": {
    icon: "list-checks",
    title: "PR Checks",
    body: "PR Checks read Orca's hosted-review cache. Herdr has no GitHub or GitLab integration."
  },
  checks: {
    icon: "list-checks",
    title: "Checks",
    body: "Checks read Orca's hosted-review data. Herdr has no GitHub or GitLab integration."
  },
  ports: {
    icon: "plug",
    title: "Ports",
    body: "Ports need Orca's port detection and SSH forwarding. Herdr exposes no port API."
  },
  tasks: {
    icon: "list",
    title: "Tasks",
    body: "Orca's Tasks page reads GitHub/GitLab/Linear/Jira issue sources (task-page/components), and Herdr exposes no issue integration — the nearest real thing is an agent started with a task (commands.rs:32-33)."
  },
  automations: {
    icon: "calendar-clock",
    title: "Automations",
    body: "Orca's Automations run scheduled work (AutomationsPageSurface.tsx), and Herdr has no scheduler."
  },
  mobile: {
    icon: "smartphone",
    title: "Mobile",
    body: "Orca pairs a phone to the desktop app (MobileHero.tsx pairing flow), while Herdr's remote surface is hc machine over SSH (machines.rs) and there is no web/pairing client."
  }
};

export default class PanelGap extends View {
  render() {
    const t = theme();
    const gap = GAPS[props()?.tab] ?? GAPS.checks;
    return v_flex().id(`gap-${props()?.tab ?? "checks"}`).size_full().items_center().justify_center().px(16)
      .text_color(t.muted)
      .child(div().mb(12).opacity(0.5).child(svg(`mods/orca-panel-gap/${gap.icon}.svg`).size(32)))
      .child(div().text_size(14).font_medium().text_color(t.foreground).child(gap.title))
      .child(div().mt(4).max_w(260).text_size(14).text_center().child(gap.body));
  }
}