// Derived from Herdr App's defaults/mods/pane/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane" } } } }
// Shows the pane's title, and on hover buttons that split and close this pane.
// Multi-pane drag to tab area ported from Orca: TerminalPaneHeaderOverlay.tsx:188-196,
// terminal.css:275-306, terminal-tab-strip-drop-target.ts:12-16, and use-terminal-pane-tab-detach-actions.ts:16-36,61-73.
// Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, openOverlay, spaces, shared, setShared, settings } from "herdr";

export default class Pane extends View {
  init() {
    this.hovered = false;
    this.dragStart = null;
    this.isDragging = false;
    this.pollTimer = null;
    this.lastPos = null;
    this.still = 0;
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  // Orca: onBeginPaneDrag (TerminalPaneHeaderOverlay.tsx:188-196) & beginPaneDragFromPointerDown
  // (pane-drag-pointer.ts:12-100). Starts tracking the drag; if moved >= 8px towards the tab strip,
  // broadcasts drag state through shared store so orca-tabs shows the insertion indicator.
  startPaneDrag(pos, pane, terminal, cx) {
    this.dragStart = {
      x: pos.x,
      y: pos.y,
      pane,
      terminal,
      time: Date.now(),
    };
    this.isDragging = false;
    this.still = 0;
    this.lastPos = { x: pos.x, y: pos.y };

    if (this.pollTimer) {
      try { this.pollTimer.cancel(); } catch {}
      this.pollTimer = null;
    }

    this.pollTimer = cx.timer.every(16, (cx) => {
      if (!this.dragStart) {
        if (this.pollTimer) {
          try { this.pollTimer.cancel(); } catch {}
          this.pollTimer = null;
        }
        return;
      }

      const at = typeof window !== "undefined" ? window.mouse_position() : null;
      if (!at) return;

      const dx = at.x - this.dragStart.x;
      const dy = at.y - this.dragStart.y;
      const dist = Math.hypot(dx, dy);

      if (!this.isDragging && dist >= 8) {
        this.isDragging = true;
      }

      if (this.isDragging) {
        // Tab strip is at y <= 48 * zoom (terminal-tab-strip-drop-target.ts:12-16 & use-terminal-pane-tab-detach-actions.ts:16-36).
        const zoom = settings()?.zoom || 1;
        const inTabStrip = at.y <= 48 * zoom;
        setShared("orca-tabs.pane-drag", {
          active: true,
          pane: this.dragStart.pane,
          terminal: this.dragStart.terminal,
          x: at.x,
          y: at.y,
          inTabStrip,
        });

        const moved = !this.lastPos || this.lastPos.x !== at.x || this.lastPos.y !== at.y;
        this.lastPos = { x: at.x, y: at.y };
        this.still = moved ? 0 : (this.still ?? 0) + 1;

        // Pointer stopped moving (inferred release since host provides no global mouse-up).
        // 15 ticks at 16ms = ~240ms of stillness.
        if (this.still >= 15) {
          this.finishPaneDrag(at, cx);
        }
      }
    });
  }

  // Orca: detachTerminalPaneToTab (terminal-pane-tab-detach.ts:40-58) & handleExternalPaneDrop
  // (use-terminal-pane-tab-detach-actions.ts:61-73). When released in the tab strip area (y <= 48 * zoom),
  // unsplit the pane into a new tab via terminal.park -> terminal.keep.
  finishPaneDrag(at, cx) {
    const drag = this.dragStart;
    this.dragStart = null;
    this.isDragging = false;
    this.still = 0;
    this.lastPos = null;
    if (this.pollTimer) {
      try { this.pollTimer.cancel(); } catch {}
      this.pollTimer = null;
    }
    setShared("orca-tabs.pane-drag", null);

    if (!drag) return;

    const zoom = settings()?.zoom || 1;
    if (at.y <= 48 * zoom) {
      setShared("orca-tabs.action", {
        kind: "unsplit-to-tab",
        terminal: drag.terminal,
        pane: drag.pane,
        dropX: at.x,
      });
      cx.notify();
    }
  }

  endPaneDrag(pos, pane, terminal, cx) {
    if (!this.dragStart) return;
    const wasDragging = this.isDragging;
    const at = typeof window !== "undefined" ? window.mouse_position() : pos;
    this.finishPaneDrag(at, cx);

    // If mouse was released without dragging (< 8px), treat as a click to open orca-menu.
    if (!wasDragging) {
      openOverlay({
        mod: "orca-menu",
        kind: "popup",
        width: 240,
        props: { tab: "pane", target: { pane, terminal } }
      });
    }
  }

  button(id, icon, action, args) {
    return div()
      .id(id)
      .size(24)
      .flex()
      .items_center()
      .justify_center()
      .rounded(6)
      // terminal.css:398,464: button fg rgb(255 255 255 / 0.3) → hover /0.8.
      .text_color("#ffffff4d")
      .hover((s) => s.text_color("#ffffffcc"))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (typeof action === "function") action(cx);
        else run(action, args);
      })
      .child(svg(`mods/orca-pane/${icon}.svg`).size(12));
  }

  render(cx) {
    const p = this.me();
    if (!p) return div();
    const pane = p.pane;
    const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === p.tab);
    const tabTitle = tab && tab.named ? tab.name : p.title;
    const isFocused = Boolean(p.focused);
    const paneCount = panes().filter((x) => x.tab === p.tab).length;

    // TabGroupPanel.tsx:281-315: attached split tab strip is h-[32px] shrink-0 border-b border-border bg-tab-bar.
    // split-group-dim.ts:1 UNFOCUSED_SPLIT_GROUP_OPACITY = 0.95.
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .h(32)
      .px(6)
      .items_center()
      .relative()
      .bg("#141416")
      .border_b(1)
      .border_color(isFocused ? "#ffffff24" : "#ffffff0f")
      .when(!isFocused, (el) => el.opacity(0.95))
      .text_size(12)
      .font_family("JetBrains Mono")
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      // TerminalPaneHeaderOverlay.tsx:149 onContextMenuCapture={(e) => onPaneTitleContextMenu(e, pane.id)}
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        run("pane.focus", { pane });
        openOverlay({ mod: "orca-menu", kind: "popup", width: 240, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
      })
      // TabGroupPanel.tsx:288-301: Left side renders TabBar items (tab pill + add button)
      .child(
        h_flex()
          .items_center()
          .gap(4)
          .child(
            h_flex()
              .h(26)
              .px(8)
              .gap(6)
              .items_center()
              .rounded(4)
              .bg(isFocused ? "#222226" : "#19191c")
              .border_1()
              .border_color(isFocused ? "#ffffff24" : "#ffffff0d")
              .cursor_pointer()
              .child(div().text_size(11).text_color("#8a8a93").child(">"))
              .child(div().max_w(180).truncate().text_size(12).font_medium().text_color(isFocused ? "#ffffff" : "#a1a1aa").child(tabTitle || "terminal"))
              .child(
                div()
                  .size(16)
                  .flex()
                  .items_center()
                  .justify_center()
                  .rounded(3)
                  .text_color("#ffffff4d")
                  .hover((s) => s.text_color("#ef4444").bg("#ffffff14"))
                  // TerminalPaneHeaderOverlay.tsx:125-131: terminalPaneCloseLabel(paneCount)
                  .tooltip(paneCount > 1 ? "Close pane" : "Close tab")
                  .on_click((e, cx) => {
                    cx.stop_propagation();
                    run(paneCount > 1 ? "pane.close" : "tab.close", paneCount > 1 ? { pane } : { id: p.tab });
                  })
                  .child(svg("mods/orca-pane/x.svg").size(10))
              )
          )
          .child(
            div()
              .size(24)
              .flex()
              .items_center()
              .justify_center()
              .rounded(4)
              .text_color("#ffffff4d")
              .hover((s) => s.text_color("#ffffffcc").bg("#ffffff14"))
              .tooltip("Split terminal right")
              .on_click((e, cx) => {
                cx.stop_propagation();
                run("pane.split", { direction: "right", pane });
              })
              .child(svg("mods/orca-pane/plus.svg").size(12))
          )
      )
      // Center area: draggable handle for unsplitting to tab strip (terminal-tab-strip-drop-target.ts:12-16)
      .child(
        div()
          .flex_1()
          .h_full()
          .flex()
          .items_center()
          .justify_center()
          .cursor_grab()
          .active((s) => s.cursor_grabbing())
          .on_mouse_down("left", (e, cx) => {
            this.startPaneDrag(e.position, pane, p.terminal, cx);
          })
          .on_mouse_up("left", (e, cx) => {
            if (this.isDragging) {
              cx.stop_propagation();
              this.endPaneDrag(e.position, pane, p.terminal, cx);
            } else {
              this.dragStart = null;
              if (this.pollTimer) { try { this.pollTimer.cancel(); } catch {} this.pollTimer = null; }
            }
          })
          .on_mouse_down("right", (_e, cx) => {
            cx.stop_propagation();
            run("pane.focus", { pane });
            openOverlay({ mod: "orca-menu", kind: "popup", width: 240, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
          })
          .when(this.hovered && paneCount > 1, (el) =>
            el.child(
              div()
                .flex()
                .flex_col()
                .gap(3)
                .items_center()
                .children([0, 1].map(() =>
                  div()
                    .flex()
                    .gap(3)
                    .children([0, 1, 2].map(() =>
                      div().size(2).rounded_full().bg("#ffffff66")
                    ))
                ))
            )
          )
      )
      // TabGroupPanel.tsx:302-314: Right action chrome (TabBarQuickCommandsButton + TabGroupPaneActionsMenu + split controls)
      .child(
        h_flex()
          .items_center()
          .gap(2)
          .when(!isFocused, (el) => el.opacity(0.6).hover((s) => s.opacity(1.0)))
          // TabBarQuickCommandsButton.tsx:180-186: Play icon + "Command" pill
          .child(
            h_flex()
              .h(22)
              .px(6)
              .gap(4)
              .items_center()
              .rounded(4)
              .border_1()
              .border_color("#ffffff14")
              .text_color(isFocused ? "#ffffff" : "#a1a1aa")
              .hover((s) => s.bg("#ffffff14").text_color("#ffffff"))
              .tooltip("Open pane commands")
              .on_click((e, cx) => {
                cx.stop_propagation();
                run("pane.focus", { pane });
                openOverlay({ mod: "orca-menu", kind: "popup", width: 240, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
              })
              .child(div().text_size(9).text_color("#a1a1aa").child("▷"))
              .child(div().text_size(11).font_medium().child("Command"))
          )
          // TabGroupPaneActionsMenu.tsx:41-45: Ellipsis button
          .child(
            this.button(`ph-m-${pane}`, "ellipsis", () => {
              run("pane.focus", { pane });
              openOverlay({ mod: "orca-menu", kind: "popup", width: 240, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
            }).tooltip("Pane actions")
          )
          // Split right & split down buttons
          .child(
            this.button(`ph-r-${pane}`, "square-split-vertical", "pane.split", { direction: "right", pane }).tooltip("Split terminal right")
          )
          .child(
            this.button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }).tooltip("Split terminal down")
          )
          // TerminalPaneHeaderOverlay.tsx:125-131: Close split pane or tab when alone
          .child(
            div()
              .id(`ph-x-${pane}`)
              .size(24)
              .flex()
              .items_center()
              .justify_center()
              .rounded(6)
              .text_color("#ffffff4d")
              .hover((s) => s.text_color("#ef4444").bg("#ffffff14"))
              .tooltip(paneCount > 1 ? "Close pane" : "Close tab")
              .on_click((e, cx) => {
                cx.stop_propagation();
                run(paneCount > 1 ? "pane.close" : "tab.close", paneCount > 1 ? { pane } : { id: p.tab });
              })
              .child(svg("mods/orca-pane/x.svg").size(12))
          )
      );
  }
}
