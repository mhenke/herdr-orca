import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, exec, run, openOverlay, theme, window, shared, layout, settings, setShared } from "herdr";

// `src/shared/agent-status/title/agent-title-decoration.ts`: the tab already shows the
// provider icon, so a known agent's own leading status glyph is dropped. Glyph-only titles
// keep the original rather than rendering a blank label.
const LEADING_AGENT_TITLE_DECORATION_RE =
  /^(?:[\u2733\u2726\u23F2\u25C7\u270B\u25B2\u2800-\u28FF\u25D0-\u25D3]+|[.*]\s)\s*/;
function stripLeadingAgentTitleDecoration(title) {
  const stripped = String(title ?? "").replace(LEADING_AGENT_TITLE_DECORATION_RE, "").trimStart();
  return stripped.length > 0 ? stripped : title;
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// Files always; Changes only in a git repo (Orca: gitOnly). The probe runs inside `cx.spawn`
// so it uses the continuation's `cx`, never render's — a `cx` is valid only for the call that
// made it, and `cx.notify()` after an `await` on render's `cx` throws.
let gitCache = { cwd: null, at: 0, ok: false };
function gitRepo(cwd, cx) {
  if (!cwd) return false;
  if (gitCache.cwd === cwd && Date.now() - gitCache.at < 5000) return gitCache.ok;
  const cached = gitCache.ok;
  gitCache = { cwd, at: Date.now(), ok: cached };
  cx.spawn(async (cx) => {
    const r = await exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => null);
    gitCache = { cwd, at: Date.now(), ok: r?.code === 0 };
    cx.notify();
  });
  return cached;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    try {
      const stored = JSON.parse(localStorage.getItem("panels") ?? "{}");
      this.panels = stored && typeof stored === "object" ? stored : {};
    } catch {
      this.panels = {};
    }
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  // `AppWorkspaceShell.tsx:106` decides when Orca's landing shows:
  //   activeView === 'terminal' && !hasActiveWorktree && !creationLayoutActive
  // In Herdr the equivalent of `!hasActiveWorktree` is "no space is active": with none open
  // there is no tab surface to draw, which is exactly the blank canvas Orca puts the page on.
  // The center is a stack (`main`) holding `main-terminals` and `main-landing`, so switching is
  // `layout.select` — the same call this mod already makes for `panel-body`.
  syncLanding(cx) {
    // Orca's `hasActiveWorktree` is about the SELECTED worktree, not about whether any exists:
    // a selected space with no tabs open is still "no active worktree", and that is the blank
    // canvas Landing sits on. So the test is "the active space has at least one tab".
    const active = (spaces() ?? []).find((s) => s.active);
    const want = (active?.tabs?.length ?? 0) > 0 ? "main-terminals" : "main-landing";
    // Seed from the layout rather than from `undefined`: on the first render there is nothing
    // to compare against, so a `this.landing` of undefined would either skip the switch when
    // it was needed or fire one that was not.
    if (this.landing === undefined) {
      const stack = find(layout(), "main");
      this.landing = stack && "active" in stack ? stack.active : null;
    }
    if (this.landing === want) return;
    this.landing = want;
    run("layout.select", { stack: "main", child: want });
  }

  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      this.space = space.id; this.pending = null;
      // Orca always shows the panel; restore the remembered tool but never hide it.
      const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
      if (want && want !== now) run("layout.select", { stack: "panel-body", child: want });
      if (panel.hidden) run("layout.show", { id: "panel" });
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render(cx) {
    const t = theme();
    const space = (spaces() ?? []).find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    // .sidebar-toggle (main.css:1213-1230) — padding 4px 8px around a 16px glyph = 32x24,
    // radius 4, muted, hover --accent. .window-controls-btn (main.css:1145-1168) — 46x36,
    // square, muted, hover --accent, close hover #c42b1c.
    // tab-bar-surface.tsx:220 — new tab is 28x28 rounded-md (8px), muted, hover accent/50.
    const sidebarToggle = (glyph, action) => div().id("sidebar-toggle").ml(6).w(32).h(24).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .role("button").accessibility_label("Toggle sidebar")
      .on_mouse_down("left", stop).on_click(action).child(glyph);
    const tabNew = (action) => div().id("tab-new").ml(8).size(28).flex_none().flex().items_center().justify_center().rounded(8)
      .text_color(t.muted).hover(s => s.bg("#40404080").text_color(t.foreground))
      .role("button").accessibility_label("New tab")
      .on_mouse_down("left", stop).on_click(action).child(div().text_size(14).child("+"));
    const winBtn = (id, label, glyph, action, close) => div().id(id).w(46).h_full().flex_none().flex().items_center().justify_center()
      .text_color(t.muted).hover(s => s.bg(close ? "#c42b1c" : t.hover).text_color(close ? "#ffffff" : t.foreground))
      .role("button").accessibility_label(label)
      .on_mouse_down("left", stop).on_click(action).child(glyph);
    const item = (c, i) => {
      const program = (panes() ?? []).find(p => p.tab === c.id && p.program?.agent)?.program ?? (panes() ?? []).find(p => p.tab === c.id)?.program;
      const raw = c.name ?? "Terminal";
      const name = /^tb\d+$/.test(raw) ? program?.name ?? "Terminal" : raw;
      // SortableTab.tsx:130 — displayTitle = customTitle ?? (tabAgent ? strip(title) : title).
      const label = program?.agent ? stripLeadingAgentTitleDecoration(name) : name;
      // Orca's tab: flat, full height, no pill. SortableTab.tsx:214 — h-full px-1.5 text-xs plus
      // getTabStripBorderClasses (border-t border-r border-border). Dark theme, main.css:428-429:
      // active is 6% foreground over #171717 (#242424), inactive is #171717; drop-indicator.ts:15-16
      // — the active bar is 2px, inset-x-0, bottom. `mr-1` on the leading icon and label
      // (TerminalTabLeadingIcon.tsx:63, SortableTab.tsx:291) is the 4px gap between children.
      return h_flex().id(`tab-${c.id}`).h_full().px(6).gap(4).relative().items_center().flex_none().text_size(12)
        .bg(c.active ? "#242424" : "#171717").text_color(c.active ? t.foreground : t.muted)
        .border_t(1).border_color(t.border)
        .when(!c.active, el => el.hover(s => s.text_color(t.foreground)))
        .when(i < shown.length - 1, el => el.border_r(1))
        .when(c.active, el => el.child(div().absolute().bottom(0).left(0).right(0).h(2).bg(t.foreground)))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          const source = from === null ? null : shown[from];
          if (source && from !== i) run("tab.move", { id: source.id, index: shown.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        // `orca-menu` owns the tab menu (it already has the "tab" case); pointing at Herdr's
        // shipped `menu` made this mod depend on a mod outside the package.
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "orca-menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        // ORDER — SortableTab.tsx:249-351. Left to right inside a tab:
        //   TerminalTabLeadingIcon (the agent/shell icon)  :249 — size={12} (TerminalTabLeadingIcon.tsx:42,100)
        //   Pin (size-3 = 12px, mr-1)                      :258-259  [pinned only]
        //   label (mr-1)                                   :289
        //   colour dot (size-2, mr-1.5)                    :291-296  [only when the tab has a colour]
        //   Minimize2 collapse (w-4 box, w-3 glyph)        :298-316  [expanded tabs]
        //   X close (w-4 box, w-3 glyph)                   :317-349
        // The status mark is NOT a separate leading element in Orca: it is part of
        // TerminalTabLeadingIcon, so it goes BEFORE the label, not after. We had it after.
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(12).text_color(t.muted) : image(program.icon).size(12)))
        // TerminalTabLeadingIcon -> AgentStateDot (`TerminalTabLeadingIcon.tsx:38`: the wrapper
        // is `inline-flex` and is `opacity-70` while the tab is inactive). working = the
        // agent-working spinner, done = CircleCheck in emerald-500, blocked — Herdr's word for
        // a waiting agent — = AgentQuestionIcon, a MessageCircleQuestion in --agent-question.
        // A bare dot is Orca's idle mark only.
        .when(c.status === "working", el => el.child(svg("mods/orca-tabs/spinner.svg").size(12).flex_none().text_color("#eab308").spin(1000)).when(!c.active, w => w.opacity(0.7)))
        .when(c.status === "done", el => el.child(svg("mods/orca-tabs/circle-check.svg").size(12).flex_none().text_color("#10b981")).when(!c.active, w => w.opacity(0.7)))
        .when(c.status === "blocked", el => el.child(svg("mods/orca-tabs/message-circle-question.svg").size(12).flex_none().text_color("#ea580c")).when(!c.active, w => w.opacity(0.7)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${label} Z` : label))
        // Close — SortableTab.tsx:317-349. It is ALWAYS rendered; it is `text-transparent` on an
        // inactive tab and becomes `text-muted-foreground` on `group-hover`, which is why it
        // looks hover-only. We hid it entirely unless the tab was active, so the active tab was
        // the only one that could be closed. The box is `w-4 h-4` (16px), the glyph `w-3 h-3`.
        .child(div().id(`close-${c.id}`).size(16).flex_none().flex().items_center().justify_center().rounded(2)
          .text_color(c.active ? t.muted : "#00000000")
          .hover(s => s.text_color(t.foreground).bg(t.raised))
          .on_mouse_down("left", stop)
          .on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); })
          .child(svg("mods/orca-tabs/close.svg").size(12)));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // .titlebar has no horizontal padding (main.css:1072-1084), so the strip is flush from the
    // left; only macOS traffic lights that land over this column reserve space. Old saved rails
    // and a dragged-narrow sidebar can be smaller than the window buttons.
    const lights = root?.traffic_lights;
    const leftPad = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && lights?.length
      ? Math.max(10, (lights[0] + 64) / (settings()?.zoom || 1) - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 0;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    this.syncLanding(cx);
    // Orca's right activity bar: 36px square buttons, 16px icons, one per activity.
    const cwd = (panes() ?? []).find(p => p.focused)?.cwd;
    const items = [{ id: "files", icon: "mods/orca-tabs/file.svg", title: "Explorer" }];
    if (gitRepo(cwd, cx)) items.push({ id: "changes", icon: "mods/orca-tabs/git-branch.svg", title: "Source Control" });
    // activity-bar-buttons.tsx:156,176 — 36x36 button, 16px icon, inactive
    // text-muted-foreground/60 with no background hover, active foreground plus a 2px bar
    // inset 25% a side (9px of 36) with a 4px top radius.
    const panelButton = ({ id, icon, title }) => {
      const on = panel && !panel.hidden && body?.active === id;
      return div().id(`panel-${id}`).size(36).flex_none().flex().items_center().justify_center().relative()
        .text_color(on ? t.foreground : "#acacac99")
        .when(!on, el => el.hover(s => s.text_color(t.muted)))
        .role("button").accessibility_label(title)
        .on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        })
        .child(svg(icon).size(16))
        .when(on, el => el.child(div().absolute().bottom(0).left(9).right(9).h(2).bg(t.foreground).rounded_t(4)));
    };
    // .titlebar: 36px, border-bottom var(--border), background var(--card) #171717
    // (main.css:1072-1084). Tabs sit flush to each edge of that bar.
    return h_flex().size_full().min_w(0).pl(leftPad).gap(0).items_center().bg(t.surface).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(0).overflow_x_scrollbar().children(shown.map(item)))
      // TitlebarLeftControls: the sidebar toggle sits outside the sidebar, so it survives hiding it.
      .child(sidebarToggle(svg("mods/orca-tabs/sidebar.svg").size(16), () => {
        const hidden = Boolean(find(layout(), "sidebar")?.hidden);
        setShared("sidebar.collapsed", !hidden);
        run(hidden ? "layout.show" : "layout.hide", { id: "sidebar" });
      }))
      .child(tabNew(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .children(items.filter(it => enabled.includes(it.id)).map(it => panelButton(it)))
      .when(w?.buttons, el => el.child(h_flex().h_full().items_center()
        .child(winBtn("minimize", "Minimize", w.platform === "windows" ? svg("mods/orca-tabs/win-min.svg").size(16) : div().text_size(14).child("−"), () => run("window.minimize"), false))
        .child(winBtn("maximize", "Maximize", w.platform === "windows" ? svg(`mods/orca-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : div().text_size(13).child("□"), () => run("window.maximize"), false))
        .child(winBtn("close-window", "Close window", w.platform === "windows" ? svg("mods/orca-tabs/win-close.svg").size(16) : svg("mods/orca-tabs/close.svg").size(13), () => run("window.close"), true))));
  }
}
