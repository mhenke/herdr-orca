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
    // The probe runs inside `cx.spawn`: a `cx` is valid only for the call that made it, so
    // `cx.notify()` after an `await` on render's `cx` throws and Herdr draws its render banner.
    const cwd = (panes() ?? []).find(p => p.focused)?.cwd;
    if (!cwd) {
      gitCache = { cwd: null, at: 0, ok: false };
    } else if (cwd !== gitCache.cwd || Date.now() - gitCache.at > 5000) {
      gitCache = { cwd, at: Date.now(), ok: gitCache.ok };
      cx.spawn(async (cx) => {
        const r = await exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => null);
        gitCache = { cwd, at: Date.now(), ok: r?.code === 0 };
        cx.notify();
      });
    }
    const tools = [{ id: "files", icon: "files", label: "Files" }];
    if (gitCache.ok) tools.push({ id: "changes", icon: "git-branch", label: "Changes" });
    // Orca right-sidebar-top-activity-bar.tsx:40 + activity-bar-buttons.tsx:151-176:
    // the strip paints no background, so it shows the panel surface #171717
    // (right-sidebar/index.tsx:158 -> --sidebar, main.css:392) and starts after
    // pl-2 = 8 (right-sidebar-titlebar-drag-regions.ts:5). The source button is 36px
    // (activity-bar-buttons.tsx:156 `w-9`) with a 25% inset bar; this row keeps the
    // 32px width the port settled on, so the same 25% is 8px a side. Inactive is
    // text-muted-foreground/60 and hover text-muted-foreground (:171-173) — a colour,
    // not element opacity, so the active bar is never dimmed.
    // `right-sidebar-top-activity-bar.tsx:40` is a bare `h-[36px] border-b border-border`
    // wrapper with NO background: it inherits the panel's `bg-sidebar` #171717
    // (`index.tsx:158`). We painted `t.canvas` #0a0a0a, so this band was 13 shades
    // darker than the panel under it — the header looked detached from its own body.
    return h_flex().w_full().h_full().items_center().pl(8).pr(4).border_b(1).border_color(t.border)
      .children(tools.map(({ id, icon, label }) => {
        const on = active === id;
        return div().id(`panel-${id}`).w(32).h_full().flex_none().flex().items_center().justify_center().relative()
          .text_color(on ? t.foreground : "#acacac99")
          .when(!on, el => el.hover(s => s.text_color(t.muted)))
          .role("button").accessibility_label(label)
          .on_click(() => run("layout.select", { stack: "panel-body", child: id }))
          .child(svg(`mods/orca-panel-head/${icon}.svg`).size(16))
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
