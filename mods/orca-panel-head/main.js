// Orca's right-panel tool switcher: compact horizontal icons, one active tool.
// Content below owns the full panel width; this row owns the only header.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, layout, panes, exec } from "herdr";

const find = (n, id) => {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
};

let gitCache = { cwd: null, at: 0, ok: false };

export default class PanelHead extends View {
  render(cx) {
    const t = theme();
    const stack = find(layout(), "panel-body");
    const active = stack?.active ?? "files";
    const cwd = panes().find(p => p.focused)?.cwd;
    if (cwd !== gitCache.cwd || Date.now() - gitCache.at > 5000) {
      gitCache = { cwd, at: Date.now(), ok: gitCache.ok };
      exec("git", ["rev-parse", "--show-toplevel"], { cwd }).then(r => {
        gitCache = { cwd, at: Date.now(), ok: r?.code === 0 }; cx.notify();
      }).catch(() => {});
    }
    const tools = [{ id: "files", icon: "files", label: "Files" }];
    if (gitCache.ok) tools.push({ id: "changes", icon: "git-branch", label: "Changes" });
    // Orca right-sidebar-top-activity-bar.tsx + activity-bar-buttons.tsx: strip is
    // h-[36px] border-b; each button h-[36px] w-9, flat (no radius, no fill), icon 16,
    // inactive muted-foreground/60 -> hover muted-foreground, active foreground + 2px underline.
    return h_flex().w_full().h_full().items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .children(tools.map(({ id, icon, label }) => {
        const on = active === id;
        return div().id(`panel-${id}`).w(36).h_full().flex_none().flex().items_center().justify_center().relative()
          .text_color(on ? t.foreground : t.dim).opacity(on ? 1 : 0.6)
          .role("button").accessibility_label(label)
          .hover(s => s.opacity(1))
          .on_click(() => run("layout.select", { stack: "panel-body", child: id }))
          .child(svg(`mods/workspace-chrome/${icon}.svg`).size(16))
          .when(on, el => el.child(div().absolute().bottom(0).left(9).right(9).h(2).bg(t.foreground).rounded_t(2)));
      }))
      .child(div().flex_1());
  }
}
