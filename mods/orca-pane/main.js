// Derived from Herdr App's defaults/mods/pane/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane" } } } }
// Shows the pane's title, and on hover buttons that split and close this pane.
// Pane drag/move is owned by herdr-app's native pane_grip (`pane_drag.rs`).
// Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, openOverlay, spaces } from "herdr";

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
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
    // TerminalPaneHeaderOverlay.tsx:263-276 draws the pane's title from `.pane-title-text`;
    // Orca's pane title is the tab's custom title (`ClaudeAccountSwitchSessionTree.tsx:276`
    // renders `tab?.customTitle || tab?.title`). Herdr has no per-pane title, so the closest
    // mechanism is `tab.rename` (`commands.rs:40`), and TabInfo.named tells us whether the
    // person named it. When named, show the tab's name; otherwise the terminal's own title
    // (`PaneInfo.title`, herdr.d.ts:193 — "what the program set, or the mod's name").
    const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === p.tab);
    const tabTitle = tab && tab.named ? tab.name : p.title;
    const siblingPanes = panes().filter((x) => x.tab === p.tab);
    const paneCount = siblingPanes.length;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(8)
      .gap(8)
      .items_center()
      .relative()
      // `terminal.css:266-271` — the bar is `font-size: 13px`, `font-family: var(--font-mono)`,
      // `color: rgb(255 255 255 / 0.52)`, `background: #000`, `border-bottom: 1px solid
      // rgb(255 255 255 / 0.06)`. Geometry (px-8, height) comes from the layout; the rest is
      // the literal the CSS states, because the theme's `border` is not this separator.
      .bg("#000000")
      .border_b(1)
      .border_color("#ffffff0f")
      .text_size(13)
      .font_family("JetBrains Mono")
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      // TerminalPaneHeaderOverlay.tsx:149 `onContextMenuCapture={(e) => onPaneTitleContextMenu(e, pane.id)}`
      // — the pane title bar opens the pane menu on right-click. `orca-menu` already implements
      // the `pane` case (split right/down, zoom, right-click routing, close), so this is the
      // missing caller, not a missing menu.
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        // TerminalContextMenu.tsx:113 — the pane menu content is `min-w-60` (240).
        openOverlay({ mod: "orca-menu", kind: "popup", width: 240, height: 260, props: { tab: "pane", target: { pane, terminal: p.terminal } } });
      })
      // TerminalPaneHeaderOverlay.tsx:263-276 — the bar's only text is `.pane-title-text`
      // (`font: inherit` → the bar's 13px mono, `color: inherit` → /0.52 white, flex 1,
      // truncated; terminal.css:330-347). No program icon, folder or status mark: the
      // header draws title (:263) then `.pane-title-actions` (:277-342) and nothing else.
      // TerminalPaneHeaderOverlay.tsx:197-210,218-236 make the title a button that starts an
      // inline rename (Enter/Tab submit, Escape cancels), and :293-320 add an X to remove the
      // title. Herdr has no `pane.rename` — only `space.rename` and `tab.rename`
      // (`herdr-app commands`) — and the title shown here is derived (tab name or terminal
      // title), so both actions are omitted, not faked.
      .when(Boolean(tabTitle), el => el.child(div().flex_1().min_w(0).truncate().text_color("#ffffff85").child(tabTitle)))
      // TerminalPaneHeaderOverlay.tsx:188-196, terminal.css:275-306:
      // `.pane-title-drag-handle`: rendered when `paneCount > 1`. Centered at `left: 50%`,
      // `width: 32px`, `height: 100%`, cursor: grab. Displays the 6-dot grip affordance.
      // Click: opens the pane layout & split/swap popup menu.
      .when(paneCount > 1 && this.hovered, (el) =>
        el.child(
          div()
            .id(`pane-drag-handle-${pane}`)
            .absolute()
            .top(0)
            .left_1_2()
            .ml(-16)
            .w(32)
            .h_full()
            .flex()
            .items_center()
            .justify_center()
            .rounded(4)
            .cursor_grab()
            .active((s) => s.cursor_grabbing())
            .hover((s) => s.bg("#ffffff1a"))
            .accessibility_label("Move or split pane")
            .tooltip("Move or split pane")
            .on_click((_e, cx) => {
              cx.stop_propagation();
              openOverlay({
                mod: "orca-menu",
                kind: "popup",
                width: 240,
                height: 320,
                props: { tab: "pane", target: { pane, terminal: p.terminal } }
              });
            })
            .child(
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
      // Orca's TerminalPaneHeaderOverlay header actions (TerminalPaneHeaderOverlay.tsx:285,334):
      // SquareSplitVertical (split right), split-down (split down), then X (close), size-3 glyphs in size-6 icon-xs boxes.
      // Orca has no zoom button in the header; those live in the right-click
      // menu (TerminalContextMenu.tsx:269,277,294), which `orca-menu` already provides.
      // The trigger buttons sit at opacity 0 until the bar is hovered (terminal.css:401,414),
      // matching this `.when(this.hovered)` gate.
      // Orca's `.pane-title-actions` is `flex shrink-0 items-center gap-0 ml-auto`
      // (TerminalPaneHeaderOverlay.tsx:211), so the glyphs sit flush and hard right; the
      // parent h_flex gap(8) would space them otherwise.
      .when(this.hovered, el => el
        .child(div().ml_auto().flex().flex_shrink_0().items_center().gap(0)
          // TerminalPaneHeaderOverlay.tsx:212-238,277-330 — `.pane-title-actions`, left to right:
          // Hand Off to Another Agent (MessageSquarePlus, `isTuiAgent` / active terminal agent),
          // Split Terminal Right (SquareSplitVertical), Split Terminal Down (split-down), and Close Pane (X).
          .when(Boolean(p.terminal), h => h
            .child(this.button(`ph-h-${pane}`, "message-square-plus", () => {
              openOverlay({
                mod: "orca-handoff",
                kind: "dialog",
                width: 480,
                height: 380,
                props: { action: "handoff", terminal: p.terminal, pane }
              });
            }).accessibility_label("Hand off to another agent").tooltip("Hand off to another agent")))
          .child(this.button(`ph-r-${pane}`, "square-split-vertical", "pane.split", { direction: "right", pane }).accessibility_label("Split terminal right").tooltip("Split terminal right"))
          .child(this.button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }).accessibility_label("Split terminal down").tooltip("Split terminal down"))
          .child(this.button(`ph-x-${pane}`, "x", "pane.close", { pane }).accessibility_label("Close pane").tooltip("Close pane"))));
  }
}
