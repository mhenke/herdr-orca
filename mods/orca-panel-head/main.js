import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, layout, panes, spaces, focused, exec } from "herdr";

const find = (n, id) => {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
};

// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];

// Orca scopes the panel to the project, not to whatever folder the focused
// terminal happens to sit in: a terminal in /tmp must not empty the tree.
function location() {
  const space = (spaces() ?? []).find(s => s.active), f = focused();
  const pane = f?.pane ? (panes() ?? []).find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  const live = pane?.cwd || f?.cwd;
  const project = space?.folder || live;
  const cwd = live && project && !(live.startsWith(project + "/") || live === project) ? project : live || project;
  return { cwd, on, space: space?.id };
}

let gitCache = { cwd: null, on: null, at: 0, ok: false, resolved: false, pending: false };

// `use-right-sidebar-activity-items.ts:74-128`, in order. `gating` is Orca's own flag:
//   gitOnly hides the item for a folder repo; folderOnly shows it only for a folder
//   workspace; sshOnly shows it only for a workspace on an SSH host.
// `id` is this panel's stack child; `title` is Orca's translated label.
const ITEMS = [
  { id: "files", icon: "files", title: "Explorer" },
  { id: "vault", icon: "agent-session-history", title: "Agents" },
  { id: "workspaces", icon: "workflow", title: "Attached worktrees", gating: "folderOnly" },
  { id: "pr-checks", icon: "list-checks", title: "PR Checks", gating: "folderOnly" },
  { id: "changes", icon: "git-branch", title: "Source Control", gating: "gitOnly" },
  { id: "checks", icon: "list-checks", title: "Checks", gating: "gitOnly" },
  { id: "ports", icon: "plug", title: "Ports", gating: "sshOnly" }
];

export default class PanelHead extends View {
  render(cx) {
    const t = theme();
    const stack = find(layout(), "panel-body");
    const active = stack?.active ?? "files";
    // The probe runs inside `cx.spawn`: a `cx` is valid only for the call that made it, so
    // `cx.notify()` after an `await` on render's `cx` throws and Herdr draws its render banner.
    const { cwd, on } = location();
    if (!cwd) {
      gitCache = { cwd: null, on: null, at: 0, ok: false, resolved: true, pending: false };
    } else {
      const isSameTarget = gitCache.cwd === cwd && gitCache.on === on;
      const isExpired = Date.now() - gitCache.at > 5000;
      if (!isSameTarget || (isExpired && !gitCache.pending)) {
        const prevOk = isSameTarget ? gitCache.ok : false;
        const prevResolved = isSameTarget ? gitCache.resolved : false;
        gitCache = { cwd, on, at: Date.now(), ok: prevOk, resolved: prevResolved, pending: true };
        cx.spawn(async (cx) => {
          const r = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
          if (gitCache.cwd === cwd && gitCache.on === on) {
            gitCache.pending = false;
            const ok = r?.code === 0;
            const changed = !gitCache.resolved || gitCache.ok !== ok;
            gitCache.ok = ok;
            gitCache.resolved = true;
            if (changed) cx.notify();
          }
        });
      }
    }
    // Gating (`right-sidebar/right-sidebar-activity-visibility.ts:14-20`): gitOnly is hidden
    // when the project is a folder (no repo); folderOnly only appears in a folder workspace;
    // sshOnly only on an SSH host. Herdr has no separate folder-workspace record, so a non-git
    // folder is that case; a workspace on a machine (`space.machine`) is the SSH case.
    const isFolder = gitCache.resolved ? !gitCache.ok : false;
    const onSshHost = Boolean(on || (spaces() ?? []).find(s => s.active)?.machine);
    const tools = ITEMS.filter(({ gating }) =>
      gating === "gitOnly" ? !isFolder
        : gating === "folderOnly" ? isFolder
        : gating === "sshOnly" ? onSshHost
        : true);
    // Orca falls back to the first visible item when the active tab is gated out
    // (`right-sidebar-effective-tab.ts:28-32`). Deferred: selecting a stack child mutates
    // state, which render itself may not do.
    if (!tools.some(tool => tool.id === active)) {
      cx.spawn(() => { run("layout.select", { stack: "panel-body", child: tools[0].id }); });
    }
    // `right-sidebar-top-activity-bar.tsx:40` is a bare `h-[36px] border-b border-border`
    // wrapper with NO background; it shows the panel surface #171717
    // (`right-sidebar/index.tsx:158` -> `--sidebar`, main.css:392). The strip starts at pl-2 = 8
    // (`right-sidebar-titlebar-drag-regions.ts:5`). Each button is 32px wide here with a
    // 16px glyph; inactive is text-muted-foreground/60 and hover text-muted-foreground
    // (`activity-bar-buttons.tsx:156-157`) — a colour change, not element opacity.
    return h_flex().w_full().h_full().items_center().pl(8).pr(4).border_b(1).border_color(t.border)
      .children(tools.map(({ id, icon, title }) => {
        const on = active === id;
        return div().id(`panel-${id}`).w(32).h_full().flex_none().flex().items_center().justify_center().relative()
          .text_color(on ? t.foreground : "#acacac99")
          .when(!on, el => el.hover(s => s.text_color(t.muted)))
          .role("button").accessibility_label(title)
          .on_click(() => run("layout.select", { stack: "panel-body", child: id }))
          .child(svg(`mods/orca-panel-head/${icon}.svg`).size(16))
          // `activity-bar-buttons.tsx:175-177`: bottom-0, left/right 25%, h-2px,
          // bg-foreground, rounded-t. 25% of 32px is 8px.
          .when(on, el => el.child(div().absolute().bottom(0).left(8).right(8).h(2).bg(t.foreground).rounded_t(4)));
      }))
      .child(div().flex_1())
      // Orca's right-sidebar toggle: .sidebar-toggle mr-1, PanelRight size 16, inside
      // a pr-1 wrapper (right-sidebar/index.tsx:122-136, main.css:1213-1225).
      .child(div().w(32).h(24).mr(4).flex_none().flex().items_center().justify_center().rounded(4)
        .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .role("button").accessibility_label("Toggle right sidebar").on_click(() => run("layout.hide", { id: "panel" }))
        .child(svg("mods/orca-panel-head/panel-right.svg").size(16)));
  }
}