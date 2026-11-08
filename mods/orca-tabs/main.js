// Derived from Herdr App's defaults/mods/tabs/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, closeOverlay, props, theme, window, shared, layout, settings, setShared } from "herdr";

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



export default class Tabs extends View {
  init(_props, cx) {
    const p = _props?.confirmClose ? _props : props();
    if (p?.confirmClose) {
      this.isDialog = true;
      this.dontAskAgain = false;
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    this.pressed = null;
    this.overTab = null;
    this.overSide = null;
    // Which tab is under the pointer. Orca's close/collapse reveal is `group-hover` on the
    // tab (SortableTab.tsx:317,323); gpui-kit has no group-hover, so the id is tracked here.
    this.hoveredTab = null;
    try {
      const stored = JSON.parse(localStorage.getItem("panels") ?? "{}");
      this.panels = stored && typeof stored === "object" ? stored : {};
    } catch {
      this.panels = {};
    }
    // `window()` is null until the window publishes it. Seed it here first; if it is still
    // null, read it again in the task phase, cache it, and repaint. Orca seeds the same flags
    // with useState(false) + useEffect (WindowControls.tsx:7-16).
    this.windowState = window();
    const seed = (cx, tries) => {
      const w = window();
      if (w) { this.windowState = w; cx.notify(); return; }
      if (tries > 0) cx.timer.after(50, (cx) => seed(cx, tries - 1));
    };
    if (!this.windowState) cx.timer.after(0, (cx) => seed(cx, 20));
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

  // Resolves tab display title matching SortableTab.tsx:130-131 & terminal-tab-actions.ts:111.
  getTabLabel(c) {
    const pane = (panes() ?? []).find(p => p.tab === c.id && p.program?.agent) ?? (panes() ?? []).find(p => p.tab === c.id);
    const program = pane?.program;
    const raw = c.name ?? "Terminal";
    const name = c.named ? raw : (pane?.title || program?.name || raw || "Terminal");
    return program?.agent ? stripLeadingAgentTitleDecoration(name) : name;
  }

  // Close confirmation logic ported from Orca:
  // - `src/renderer/src/components/terminal/terminal-tab-actions.ts:121-131` (shouldConfirmRunningTerminalClose)
  // - `src/renderer/src/components/terminal/running-terminal-close-guard.ts:22-34,56-97` (guardRunningTerminalClose)
  // - `src/renderer/src/components/terminal-pane/CloseTerminalDialog.tsx:15-184` (CloseTerminalDialog)
  // - `src/renderer/src/store/pinned-tab-close-guard.ts:27-57` (guardPinnedTabClose)
  // - `src/renderer/src/components/terminal-pane/PinnedTabCloseDialog.tsx:17-96` (PinnedTabCloseDialog)
  requestCloseTab(c) {
    if (!c) return;
    const label = this.getTabLabel(c);

    // 1. Pinned tab check: PinnedTabCloseDialog.tsx & pinned-tab-close-guard.ts:27-57.
    // In Herdr, `settled` represents pinned tabs. Orca confirms pinned tab closes unless confirmClosePinnedTab is disabled.
    if (c.settled) {
      let skipPinned = false;
      try { skipPinned = localStorage.getItem("orca.confirmClosePinnedTab") === "false"; } catch {}
      if (!skipPinned) {
        openOverlay({
          mod: "orca-tabs",
          kind: "dialog",
          modal: true,
          width: 384,
          height: 200,
          props: {
            confirmClose: {
              kind: "pinned",
              tabId: c.id,
              tabLabel: label,
            }
          }
        });
        return;
      }
      run("tab.close", { id: c.id });
      return;
    }

    // 2. Active agent or running command check: CloseTerminalDialog.tsx & running-terminal-close-guard.ts:56-97.
    // Orca's shouldConfirmRunningTerminalClose checks if an agent or child process is active.
    const tabPanes = (panes() ?? []).filter(p => p.tab === c.id);
    const isAgent = tabPanes.some(p => p.program?.agent || p.status === "working" || p.status === "blocked") ||
                    c.status === "working" || c.status === "blocked";
    const isRunningCommand = tabPanes.some(p => p.program && !p.program.shell && !p.program.agent);

    let skipRunning = false;
    try { skipRunning = localStorage.getItem("orca.skipCloseTerminalWithRunningProcessConfirm") === "true"; } catch {}

    if (!skipRunning && (isAgent || isRunningCommand)) {
      openOverlay({
        mod: "orca-tabs",
        kind: "dialog",
        modal: true,
        width: 384,
        height: isAgent ? 240 : 208,
        props: {
          confirmClose: {
            kind: isAgent ? "agent" : "command",
            tabId: c.id,
            tabLabel: label,
          }
        }
      });
      return;
    }

    // 3. Idle shell or opt-out -> close immediately.
    run("tab.close", { id: c.id });
  }

  // Close confirmation dialog ported from Orca:
  // - `src/renderer/src/components/terminal-pane/CloseTerminalDialog.tsx:101-184`
  // - `src/renderer/src/components/terminal-pane/PinnedTabCloseDialog.tsx:52-94`
  // - `src/shared/bulk-tab-close-confirmation.ts:5-15` (BULK_TAB_CLOSE_COPY)
  // Matches Orca's max-w-sm (384px) dialog-surface container, text-sm title, text-xs muted description,
  // checkbox with don't-ask-again persistence, outline cancel button and destructive confirm button.
  renderConfirmDialog(cx) {
    const t = theme();
    const p = props() ?? {};
    const cfg = p.confirmClose ?? {};
    const kind = cfg.kind ?? "command";
    const isAgent = kind === "agent";
    const isPinned = kind === "pinned";
    const isBulk = kind === "bulk";

    if (!this.handle) {
      this.handle = cx.focus_handle();
      this.handle.focus();
    }

    let title = "Stop running command?";
    let desc = "Closing this terminal will stop the command running inside it.";
    if (isAgent) {
      title = "Stop this agent?";
      desc = "Closing this terminal will stop the agent's current work.";
    } else if (isPinned) {
      title = "Close pinned tab?";
      desc = "This tab is pinned. Are you sure you want to close it?";
    } else if (isBulk) {
      if (cfg.scope === "others") title = "Close other tabs?";
      else if (cfg.scope === "right") title = "Close tabs to the right?";
      else if (cfg.scope === "left") title = "Close tabs to the left?";
      else title = "Close tabs?";
      desc = "The selected tabs will be closed. Pinned tabs will stay open.";
    }

    let confirmLabel = "Stop and Close";
    if (isAgent) confirmLabel = "Stop Agent";
    else if (isPinned) confirmLabel = "Close";
    else if (isBulk) confirmLabel = "Close tabs";

    const confirm = () => {
      if (this.dontAskAgain) {
        try {
          if (isPinned) {
            localStorage.setItem("orca.confirmClosePinnedTab", "false");
          } else if (isAgent || kind === "command") {
            localStorage.setItem("orca.skipCloseTerminalWithRunningProcessConfirm", "true");
          }
        } catch {}
      }
      closeOverlay(p.overlay);
      if (cfg.tabId) {
        run("tab.close", { id: cfg.tabId });
      } else if (cfg.tabIds) {
        for (const id of cfg.tabIds) run("tab.close", { id });
      }
    };

    const cancel = () => {
      closeOverlay(p.overlay);
    };

    const checkboxLabel = isPinned ? "Don't ask again for pinned tabs" : "Don't ask again for running terminals";

    return v_flex()
      .id("orca-close-dialog")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "enter") {
          cx.stop_propagation();
          confirm();
        } else if (e.key === "escape") {
          cx.stop_propagation();
          cancel();
        }
      })
      .size_full()
      .p(24)
      .gap(16)
      .rounded(8)
      .bg(t.popover)
      .border_1()
      .border_color(t.border)
      // Header: DialogHeader (dialog.tsx:139-147)
      .child(
        v_flex().gap(4)
          .child(div().text_size(14).font_semibold().text_color(t.foreground).child(title))
          .child(div().text_size(12).text_color(t.muted).child(desc))
      )
      // Warning for agent: CloseTerminalDialog.tsx:132-139
      .when(isAgent, el =>
        el.child(div().text_size(12).text_color(t.muted).child("This terminal will not resume automatically. Cancel and put the workspace to sleep to resume it later."))
      )
      // Tab label: CloseTerminalDialog.tsx:140-144
      .when(Boolean(cfg.tabLabel), el =>
        el.child(div().truncate().text_size(12).font_medium().text_color(t.foreground).child(cfg.tabLabel))
      )
      // Checkbox: CloseTerminalDialog.tsx:145-159 & PinnedTabCloseDialog.tsx:72-84
      .when(!isBulk, el =>
        el.child(
          h_flex().items_center().gap(8).cursor_pointer()
            .on_click((_e, cx) => {
              this.dontAskAgain = !this.dontAskAgain;
              cx.notify();
            })
            .child(
              div().size(16).flex_none().rounded(4).border_1()
                .border_color(this.dontAskAgain ? t.solid : t.input)
                .bg(this.dontAskAgain ? t.solid : "#00000000")
                .flex().items_center().justify_center()
                .when(this.dontAskAgain, checkEl =>
                  checkEl.child(svg("mods/orca-tabs/check.svg").size(12).text_color(t.solid_foreground))
                )
            )
            .child(div().text_size(12).text_color(t.muted).child(checkboxLabel))
        )
      )
      // Footer: DialogFooter (dialog.tsx:149-163)
      .child(
        h_flex().justify_end().gap(8)
          // Cancel button: Button variant="outline" size="sm"
          .child(
            h_flex().id("close-cancel").h(32).px(12).items_center().justify_center().rounded(6)
              .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground)
              .text_size(12).font_medium().cursor_pointer()
              .hover(s => s.bg(t.hover))
              .on_click((_e, _cx) => cancel())
              .child("Cancel")
          )
          // Confirm button: Button variant="destructive" size="sm" (red)
          .child(
            h_flex().id("close-confirm").h(32).px(12).items_center().justify_center().rounded(6)
              .bg("#dc2626").text_color("#ffffff")
              .text_size(12).font_medium().cursor_pointer()
              .hover(s => s.bg("#b91c1c"))
              .on_click((_e, _cx) => confirm())
              .child(confirmLabel)
          )
      );
  }

  render(cx) {
    const p = props();
    if (this.isDialog || p?.confirmClose) {
      return this.renderConfirmDialog(cx);
    }
    const t = theme();
    const space = (spaces() ?? []).find(p => p.active);
    const shown = space?.tabs ?? [];
    // Tab colour store, read once per render. orca-menu writes shared("tab.colors")
    // and mirrors to localStorage["tab.colors.v1"]. SortableTab.tsx:293-297 drives the dot below.
    const tabColorStore = (() => {
      const s = shared("tab.colors");
      if (s && typeof s === "object") return s;
      try {
        const v = localStorage.getItem("tab.colors.v1");
        return v ? JSON.parse(v) : {};
      } catch {
        return {};
      }
    })();
    const stop = (_e, cx) => cx.stop_propagation();
    // .sidebar-toggle (main.css:1213-1230) — padding 4px 8px around a 16px glyph = 32x24,
    // radius 4, muted, hover --accent. .window-controls-btn (main.css:1145-1168) — 46x36,
    // square, muted, hover --accent, close hover #c42b1c.
    // TitlebarLeftControls.tsx:74-88 — Orca has ONE sidebar toggle, at the LEFT of the
    // titlebar. `orca-chrome` draws it (inside the sidebar column); this copy only appears
    // while that column is hidden, because Herdr skips a hidden node's content
    // (layout.rs:551) and there would otherwise be no way back. Orca keeps the control
    // reachable by floating `titlebar-left` over the workspace
    // (AppWorkspaceShell.tsx:163-167).
    const sidebarToggle = (glyph, action) => div().id("sidebar-toggle").ml(6).w(32).h(24).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .role("button").accessibility_label("Toggle sidebar").tooltip("Toggle sidebar")
      .on_mouse_down("left", stop).on_click(action).child(glyph);
    // tab-bar-surface.tsx:221-227 — `ml-2 my-auto flex h-7 w-7 shrink-0 items-center
    // justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground`,
    // holding a Lucide `Plus` at `w-3.5 h-3.5` (14px). It is a DropdownMenuTrigger, not a bare
    // action: it opens the new-tab menu, which `new-menu` provides.
    // `rounded-md` resolves to 8px, not 6: --radius .625rem x .8 (main.css:175,195).
    const tabNew = (action) => div().id("tab-new").ml(8).size(28).flex_none().flex().items_center().justify_center().rounded(8)
      .text_color(t.muted).hover(s => s.bg("#40404080").text_color(t.foreground))
      .role("button").accessibility_label("New tab").tooltip("New tab")
      .on_mouse_down("left", stop).on_click(action)
      .child(svg("mods/orca-tabs/plus.svg").size(14).flex_none());
    const winBtn = (id, label, glyph, action, close) => div().id(id).w(46).h_full().flex_none().flex().items_center().justify_center()
      .text_color(t.muted).hover(s => s.bg(close ? "#c42b1c" : t.hover).text_color(close ? "#ffffff" : t.foreground))
      .role("button").accessibility_label(label).tooltip(label)
      .on_mouse_down("left", stop).on_click(action).child(glyph);
    // TitlebarMainStrip.tsx:12-33,76 — `RightSidebarToggle`: `.sidebar-toggle mr-2`
    // (main.css:1213-1230 = 4px/8px padding around the 16px `PanelRight`, so 32x24, radius 4,
    // muted, hover --accent + foreground). Herdr toggles it with `layout.toggle` (commands.rs:77).
    const panelToggle = (action) => div().id("panel-toggle").mr(8).w(32).h(24).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .role("button").accessibility_label("Toggle right sidebar").tooltip("Toggle right sidebar")
      .on_mouse_down("left", stop).on_click(action)
      .child(svg("mods/orca-tabs/panel-right.svg").size(16));
    const item = (c, i) => {
      const pane = (panes() ?? []).find(p => p.tab === c.id && p.program?.agent) ?? (panes() ?? []).find(p => p.tab === c.id);
      const program = pane?.program;
      // SortableTab.tsx:130 — displayTitle = customTitle ?? (tabAgent ? strip(title) : title).
      const label = this.getTabLabel(c);
      const tabColour = tabColorStore[c.id] ?? null;
      // TerminalTabLeadingIcon.tsx:100-108 — the agent's identity mark, `opacity-70` while the
      // tab is inactive. The program table names most agents; `omp` has no entry, and Orca draws
      // OmpIcon's gradient for it (`agent-icon-glyphs.tsx:30-62`), copied into this mod. A mark
      // in the agent's own colors is an image: `svg()` is a one-color mask
      // (gpui-kit.d.ts:20273-20281).
      const identity = pane?.app === "omp"
        ? image("mods/orca-tabs/omp.svg").size(12)
        : !program?.icon ? null
        : program.tint ? svg(program.icon).size(12).text_color(t.muted)
        : image(program.icon).size(12);
      // Orca's tab: flat, full height, no pill. SortableTab.tsx:214 — h-full px-1.5 text-xs plus
      // getTabStripBorderClasses (border-t border-r border-border). The slot clamps the tab to
      // `w-[300px] max-w-[300px] min-w-[144px] flex-1` (tab-width-rules.ts:2, applied at
      // use-tab-strip-slot-props.ts:16). Dark theme, main.css:428-429: active is 6% foreground
      // over #171717 (#242424), inactive is #171717; drop-indicator.ts:15-16 — the active bar is
      // 2px, inset-x-0, bottom. `mr-1` on the leading icon and label
      // (TerminalTabLeadingIcon.tsx:63, SortableTab.tsx:291) is the 4px gap between children.
      return h_flex().id(`tab-${c.id}`).h_full().px(6).gap(4).relative().items_center().flex_none().min_w(144).max_w(300).text_size(12)
        .bg(c.active ? "#242424" : "#171717").text_color(c.active ? t.foreground : t.muted)
        .border_t(1).border_color(t.border)
        .when(!c.active, el => el.hover(s => s.text_color(t.foreground)))
        .when(i < shown.length - 1, el => el.border_r(1))
        .when(c.active, el => el.child(div().absolute().bottom(0).left(0).right(0).h(2).bg(t.foreground)))
        .on_hover((hovered, cx) => {
          const next = hovered ? c.id : this.hoveredTab === c.id ? null : this.hoveredTab;
          if (next === this.hoveredTab) return;
          this.hoveredTab = next;
          cx.notify();
        })
        // SortableTab.tsx:214 — cursor-pointer: tab rest hover is a pointer hand, not grab.
        .cursor_pointer()
        .when(this.pressed === i, el => el.cursor_grabbing().opacity(0.8))
        // SortableTab.tsx:231-243 — onAuxClick button === 1 (middle-click) closes tab.
        .on_mouse_down("middle", (_e, cx) => {
          cx.stop_propagation();
          this.requestCloseTab(c);
        })
        // Blue drop insertion line — Orca drop-indicator.ts:4-12 (w-[2px] bg-blue-500).
        .when(this.pressed !== null && this.overTab === c.id && this.pressed !== i, el =>
          el.child(
            div().absolute().top(0).bottom(0).w(2).bg("#3b82f6")
              .when(this.overSide === "left", line => line.left(0))
              .when(this.overSide === "right", line => line.right(0))
          )
        )
        // Tab reordering — SortableTab.tsx:213 and tab-drag-drop-commit.ts:116-126.
        // Dragging along the strip reorders via `tab.move`.
        // Dropping tabs onto the terminal is not capturable across mod boundaries in GPUI
        // because layout blocks enforce overflow_hidden and quickjs does not expose pointer capture;
        // Orca's split actions in orca-menu and orca-split-menu provide the functional bridge.
        .on_mouse_down("left", (e, cx) => {
          cx.stop_propagation();
          this.pressed = i;
          this.overTab = c.id;
          this.overSide = null;
          if (e.click_count === 2) run("tab.rename", { id: c.id });
          cx.notify();
        })
        .on_mouse_move((e, cx) => {
          if (this.pressed !== null) {
            const width = e.bounds?.width ?? 144;
            const localX = e.local_position?.x ?? (width / 2);
            const side = localX < width / 2 ? "left" : "right";
            if (this.overTab !== c.id || this.overSide !== side) {
              this.overTab = c.id;
              this.overSide = side;
              cx.notify();
            }
          }
        })
        .on_mouse_up("left", (_e, cx) => {
          const from = this.pressed;
          const overSide = this.overSide;
          this.pressed = null;
          this.overTab = null;
          this.overSide = null;

          if (from !== null && from !== i) {
            // Orca tab-drag-drop-commit.ts:116-126 insertion algorithm
            const oldIndex = from;
            const rawInsertIndex = i + (overSide === "right" ? 1 : 0);
            const nextIndex = oldIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
            if (oldIndex !== nextIndex) {
              run("tab.move", { id: shown[from].id, index: nextIndex + 1 });
              cx.notify();
              return;
            }
          }

          // Plain click — select tab and restore main-terminals layout stack
          run("tab.select", { id: c.id });
          run("layout.select", { stack: "main", child: "main-terminals" });
          cx.notify();
        })
        // `orca-menu` owns the tab menu (it already has the "tab" case); pointing at Herdr's
        // shipped `menu` made this mod depend on a mod outside the package.
        // SortableTabContextMenu.tsx:155 — `min-w-[13rem]` (208).
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "orca-menu", kind: "popup", width: 208, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        // ORDER — SortableTab.tsx:249-351. Left to right inside a tab:
        //   TerminalTabLeadingIcon (the agent/shell icon)  :249 — size={12} (TerminalTabLeadingIcon.tsx:42,100)
        //   Pin (size-3 = 12px, mr-1)                      :258-259  [pinned only]
        //   label (mr-1)                                   :289
        //   colour dot (size-2, mr-1.5)                    :291-296  [only when the tab has a colour]
        //   Minimize2 collapse (w-4 box, w-3 glyph)        :298-316  [expanded tabs]
        //   X close (w-4 box, w-3 glyph)                   :317-349
        // TerminalTabLeadingIcon.tsx:55-115 — the activity mark (`AgentStateDot`) comes first,
        // then the agent's identity, and only the identity is `opacity-70` on an inactive tab
        // (:44-50). working = the agent-working spinner, done = CircleCheck in emerald-500,
        // blocked — Herdr's word for a waiting agent — = AgentQuestionIcon, a
        // MessageCircleQuestion in --agent-question. A bare dot is Orca's idle mark only.
        .when(c.status === "working", el => el.child(svg("mods/orca-tabs/spinner.svg").size(12).flex_none().text_color("#eab308").spin(1000)))
        .when(c.status === "done", el => el.child(svg("mods/orca-tabs/circle-check.svg").size(12).flex_none().text_color("#10b981")))
        .when(c.status === "blocked", el => el.child(svg("mods/orca-tabs/message-circle-question.svg").size(12).flex_none().text_color("#ea580c")))
        .when(Boolean(identity), el => el.child(c.active ? identity : identity.opacity(0.7)))
        // `TAB_LABEL_WIDTH_CLASSES` (tab-width-rules.ts:4) — `tab-label min-w-0 flex-1 truncate`.
        // Orca never marks an expanded pane in the title (SortableTab.tsx:130-131); the
        // Minimize2 button below is the only indicator.
        .child(div().flex_1().min_w(0).truncate().child(label))
        // Colour dot — SortableTab.tsx:293-297: size-2 rounded-full dot, shown only when tab has a colour. Orca reads tab.color; Herdr has no colour field, so the value comes from localStorage["tab.colors.v1"] written by orca-menu. No !isEditing guard exists in this port.
        .when(tabColour !== null, el => el.child(div().size(8).flex_none().rounded(4).mr(6).bg(tabColour)))
        // Collapse pane — SortableTab.tsx:298-316: shown while the pane is expanded, a 16px box
        // with a 12px `Minimize2`; active tabs always show it, inactive ones on TAB hover
        // (`text-transparent group-hover:text-muted-foreground`). `pane.zoom` collapses.
        .when(c.zoomed, el => el.child(div().id(`collapse-${c.id}`).size(16).flex_none().flex().items_center().justify_center().rounded(2)
          .text_color(c.active || this.hoveredTab === c.id ? t.muted : "#00000000")
          .hover(s => s.text_color(t.foreground).bg(t.raised))
          .role("button").accessibility_label("Collapse pane").tooltip("Collapse pane")
          .on_mouse_down("left", stop)
          .on_click((_e, cx) => {
            cx.stop_propagation();
            // The ZOOMED pane, not the focused one: a split tab can have another pane zoomed.
            const z = (panes() ?? []).find(p => p.tab === c.id && p.zoomed);
            if (z) run("pane.zoom", { pane: z.pane });
          })
          .child(svg("mods/orca-tabs/minimize-2.svg").size(12))))
        // Close — SortableTab.tsx:317-349: only when `!isPinned` (Orca's pinned tab has no close
        // button; Herdr's pin analogue is `settled`, TabInfo.settled). The box is `w-4 h-4`
        // (16px), the glyph `w-3` (12px); inactive is `text-transparent` and becomes muted on
        // TAB hover (`group-hover`), not on its own box.
        .when(!c.settled, el => el.child(div().id(`close-${c.id}`).size(16).flex_none().flex().items_center().justify_center().rounded(2)
          .text_color(c.active || this.hoveredTab === c.id ? t.muted : "#00000000")
          .hover(s => s.text_color(t.foreground).bg(t.raised))
          .on_mouse_down("left", stop).accessibility_label("Close").tooltip("Close")
          .on_click((_e, cx) => { cx.stop_propagation(); this.requestCloseTab(c); })
          .child(svg("mods/orca-tabs/close.svg").size(12))));
    };
    const root = layout();
    const sidebar = find(root, "sidebar");
    // Live read keeps maximize/restore current (Orca subscribes to onMaximizeChanged,
    // WindowControls.tsx:15); the cached seed covers the first paint, when `window()` is null.
    const live = window();
    if (live) this.windowState = live;
    const w = live ?? this.windowState ?? {};
    // .titlebar has no horizontal padding (main.css:1072-1084), so the strip is flush from the
    // left; only macOS traffic lights that land over this column reserve space. Old saved rails
    // and a dragged-narrow sidebar can be smaller than the window buttons.
    const lights = root?.traffic_lights;
    const leftPad = w.platform === "macos" && w.titlebar === "none" && !w.fullscreen && lights?.length
      ? Math.max(10, (lights[0] + 64) / (settings()?.zoom || 1) - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 0;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    this.syncLanding(cx);
    // `.titlebar`: 36px, border-bottom var(--border), background var(--card) #171717
    // (main.css:1072-1084). Tabs sit flush to each edge of that bar.
    // The Explorer / Source Control activity buttons are NOT here: Orca renders its activity
    // bar only inside the right sidebar (`right-sidebar-top-activity-bar.tsx:40`), which
    // `orca-panel-head` owns. Drawing them twice put two strip icons in the titlebar corner.
    return h_flex().size_full().min_w(0).pl(leftPad).gap(0).items_center().bg(t.surface).border_b(1).border_color(t.border)
      .on_mouse_up("left", (_e, cx) => {
        this.pressed = null;
        this.overTab = null;
        this.overSide = null;
        cx.notify();
      })
      // TitlebarLeftControls.tsx:74-88 — ONE sidebar toggle, at the LEFT; `orca-chrome` draws it
      // inside the sidebar column. This copy appears only while that column is hidden, since
      // Herdr skips a hidden node's content (layout.rs:551); Orca keeps the control at the same
      // left slot by floating `titlebar-left` over the workspace
      // (AppWorkspaceShell.tsx:163-167).
      .when(Boolean(sidebar?.hidden), el => el.child(sidebarToggle(svg("mods/orca-tabs/sidebar.svg").size(16), () => {
        setShared("sidebar.collapsed", false);
        run("layout.show", { id: "sidebar" });
      })))
      // Orca hides the strip's native scrollbar (`tab-bar-surface.tsx:164-175`) and paints only
      // its 3px hover thumb (`TabStripScrollIndicator.tsx:196-215`), which Herdr has no
      // primitive for — so no scrollbar is painted and no thumb is faked. The wheel scrolls the
      // strip: Orca does not switch tabs on wheel. Its overflow chevrons
      // (`tab-bar-surface.tsx:124-146`, `:189-211`) are omitted because gpui-kit exposes no
      // programmatic scroll for an overflow container (only VirtualListScrollHandle,
      // gpui-kit.d.ts:21305), so a chevron would be a dead control.
      // `tab-bar-surface.tsx:164-170` — the strip is `w-max … max-w-full shrink`: content-wide,
      // never stretched, so the `+` that follows it sits directly after the last tab.
      .child(h_flex().id("tab-scroll").flex_none().max_w("100%").min_w(0).h_full().items_center().gap(0).overflow_x_scroll().children(shown.map(item)))
      // tab-bar-surface.tsx:232 — the create menu is `w-72` (288).
      .child(tabNew(() => openOverlay({ mod: "new-menu", kind: "popup", width: 288, height: 512 })))
      .child(div().flex_1())
      // TitlebarMainStrip.tsx:58-69 — the single-tab case gets a `Minimize2`
      // (`showTitlebarExpandButton` = `!hasTabBar && effectiveActiveTabExpanded`,
      // use-app-chrome-layout.ts:129; hasTabBar is `tabCount >= 2`). `.titlebar-icon-button` is
      // 4px padding around a 14px glyph with `mr-2`, radius 4 (main.css:1288-1313).
      .when(shown.length === 1 && shown[0].zoomed, el => el.child(div().id("titlebar-collapse").mr(8).size(22).flex_none().flex().items_center().justify_center().rounded(4)
        .text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label("Collapse pane").tooltip("Collapse pane")
        .on_mouse_down("left", stop)
        .on_click(() => {
          const z = (panes() ?? []).find(p => p.tab === shown[0].id && p.zoomed);
          if (z) run("pane.zoom", { pane: z.pane });
        })
        .child(svg("mods/orca-tabs/minimize-2.svg").size(14))))
      // TitlebarMainStrip.tsx:76 — Orca's `RightSidebarToggle` moves into the panel header
      // while the panel is open (`right-sidebar/index.tsx:124-144` draws the same button as its
      // close control). Keeping one fixed slot is better here: the control never moves, and
      // `layout.toggle` (commands.rs:77) is the action either way.
      .child(panelToggle(() => run("layout.toggle", { id: "panel" })))
      // WindowControls.tsx:27-30,42-49,60-67 — Orca replaces native chrome on Linux and Windows
      // with the same 10x10 SVG paths; only macOS keeps its traffic lights. Herdr reports
      // `buttons: false` here (the compositor owns decorations) but draws none of its own, so
      // the strip is the only place these actions exist — draw them on every non-macOS window.
      .when(w.platform !== "macos", el => el.child(h_flex().h_full().items_center()
        .child(winBtn("minimize", "Minimize", svg("mods/orca-tabs/win-min.svg").size(10), () => run("window.minimize"), false))
        .child(winBtn("maximize", "Maximize", svg(`mods/orca-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(10), () => run("window.maximize"), false))
        .child(winBtn("close-window", "Close window", svg("mods/orca-tabs/win-close.svg").size(10), () => run("window.close"), true))));
  }
}
