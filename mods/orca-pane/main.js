// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane" } } } }
// Shows the pane's title, and on hover buttons that split and close this pane.
// Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, openOverlay, spaces } from "herdr";

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(id, icon, command, args) {
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
        run(command, args);
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
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(8)
      .gap(8)
      .items_center()
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
      .when(Boolean(tabTitle), el => el.child(div().flex_1().min_w(0).truncate().text_color("#ffffff85").child(tabTitle)))
      // Orca's TerminalPaneHeaderOverlay header actions (TerminalPaneHeaderOverlay.tsx:285,334):
      // SquareSplitVertical (split) then X (close), size-3 glyphs in size-6 icon-xs boxes.
      // Orca has no split-down or zoom button in the header; those live in the right-click
      // menu (TerminalContextMenu.tsx:269,277,294), which `orca-menu` already provides.
      // The trigger buttons sit at opacity 0 until the bar is hovered (terminal.css:401,414),
      // matching this `.when(this.hovered)` gate.
      // Orca's `.pane-title-actions` is `flex shrink-0 items-center gap-0 ml-auto`
      // (TerminalPaneHeaderOverlay.tsx:211), so the glyphs sit flush and hard right; the
      // parent h_flex gap(8) would space them otherwise.
      .when(this.hovered, el => el
        .child(div().ml_auto().flex().flex_shrink_0().items_center().gap(0)
          // TerminalPaneHeaderOverlay.tsx:277-330 — `.pane-title-actions`, left to right:
          // Hand Off to Another Agent (MessageSquarePlus, `isTuiAgent` of the pane's agent),
          // Show terminal (SquareTerminal, chat view only), Split Terminal Right, X.
          // `canShowTerminal` is `activePaneIsChatLeaf` (TerminalPaneSurface.tsx:373) and
          // `activePaneCanContinueInNewSession` is `isTuiAgent` (terminal-agent-session-continuation.ts:23-27);
          // both also require `isActivePane`, which the layout supplies by mounting one header
          // per pane in a focused tab. Herdr has no chat-view leaf and no session handoff
          // command (`herdr-app commands`), so only the split and close rows have a backend.
          .child(this.button(`ph-r-${pane}`, "square-split-vertical", "pane.split", { direction: "right", pane }).accessibility_label("Split terminal").tooltip("Split terminal"))
          .child(this.button(`ph-x-${pane}`, "x", "pane.close", { pane }).accessibility_label("Close pane").tooltip("Close pane"))))
  }
}
