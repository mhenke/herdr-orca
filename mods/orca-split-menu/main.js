// Derived from Herdr App's defaults/mods/menu/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Orca Split Menu (`TerminalTabSplitMenuSection.tsx:47-77`, `TerminalContextMenu.tsx:265-306`,
// and `SortableTabContextMenu.tsx:157-216`).
// Exposes `mod.open:orca-split-menu`. Provides directional splits for terminal,
// file browser (`orca-files`), git changes (`orca-changes`), folder picker,
// and split pane management (zoom expand/collapse and close split pane).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { panes, run, closeOverlay, theme, props, pickFolder } from "herdr";

function destructiveColor() {
  const t = theme();
  // Orca destructive color token (`main.css:474,437`): #ff6568 dark, #e40014 light.
  return t.appearance === "dark" ? "#ff6568" : "#e40014";
}

function resolveFocusedPane() {
  const p = props();
  const allPanes = panes() ?? [];
  if (p?.target?.pane) {
    const target = allPanes.find((x) => x.pane === p.target.pane);
    if (target) return target;
  }
  return allPanes.find((p) => p.focused) ?? allPanes[0];
}

export default class SplitMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  items() {
    const focusedPane = resolveFocusedPane();
    const allPanes = panes() ?? [];
    const tabPanes = focusedPane ? allPanes.filter((p) => p.tab === focusedPane.tab) : [];
    const hasMultiple = tabPanes.length > 1;
    const isZoomed = Boolean(focusedPane?.zoomed);

    const list = [
      // Direct terminal splits across 4 quadrants (TerminalContextMenu.tsx:265-279, TabWorkspaceLayoutMenuSection.tsx:14-41)
      {
        id: "split-right",
        label: "Split Terminal Right",
        icon: "panel-right-close.svg",
        shortcut: "1",
        keys: ["1", "r"],
        section: "terminal",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "right", pane: focusedPane?.pane });
        },
      },
      {
        id: "split-left",
        label: "Split Terminal Left",
        icon: "arrow-left.svg",
        shortcut: "2",
        keys: ["2", "l"],
        section: "terminal",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "right", pane: focusedPane?.pane });
          run("pane.swap", { direction: "left" });
        },
      },
      {
        id: "split-down",
        label: "Split Terminal Down",
        icon: "panel-bottom-close.svg",
        shortcut: "3",
        keys: ["3", "d"],
        section: "terminal",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "down", pane: focusedPane?.pane });
        },
      },
      {
        id: "split-up",
        label: "Split Terminal Up",
        icon: "arrow-up.svg",
        shortcut: "4",
        keys: ["4", "u"],
        section: "terminal",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "down", pane: focusedPane?.pane });
          run("pane.swap", { direction: "up" });
        },
      },
      // Mod splits: File Browser and Git Changes (tab-bar-static-create-menu.tsx:213-225)
      {
        id: "split-right-files",
        label: "Split Right with File Browser",
        icon: "file-text.svg",
        shortcut: "F",
        keys: ["f"],
        section: "mods",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "right", pane: focusedPane?.pane, mod: "orca-files" });
        },
      },
      {
        id: "split-down-files",
        label: "Split Down with File Browser",
        icon: "file-text.svg",
        shortcut: "⇧F",
        keys: ["shift+f"],
        section: "mods",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "down", pane: focusedPane?.pane, mod: "orca-files" });
        },
      },
      {
        id: "split-right-changes",
        label: "Split Right with Git Changes",
        icon: "git-branch.svg",
        shortcut: "C",
        keys: ["c"],
        section: "mods",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "right", pane: focusedPane?.pane, mod: "orca-changes" });
        },
      },
      {
        id: "split-down-changes",
        label: "Split Down with Git Changes",
        icon: "git-branch.svg",
        shortcut: "⇧C",
        keys: ["shift+c"],
        section: "mods",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.split", { direction: "down", pane: focusedPane?.pane, mod: "orca-changes" });
        },
      },
      // Split in Folder picker (defaults/mods/new-menu/main.js:60-67)
      {
        id: "split-folder-right",
        label: "Split in Folder… (Right)",
        icon: "folder.svg",
        shortcut: "O",
        keys: ["7", "o"],
        section: "folder",
        action: (cx, overlay) => {
          const pane = focusedPane?.pane;
          closeOverlay(overlay);
          cx.spawn(async (_cx) => {
            const picked = await pickFolder({ prompt: "Choose folder for split terminal (right)" });
            if (picked) {
              run("pane.split", { direction: "right", pane, folder: picked });
            }
          });
        },
      },
      {
        id: "split-folder-down",
        label: "Split in Folder… (Down)",
        icon: "folder.svg",
        shortcut: "⇧O",
        keys: ["8", "shift+o"],
        section: "folder",
        action: (cx, overlay) => {
          const pane = focusedPane?.pane;
          closeOverlay(overlay);
          cx.spawn(async (_cx) => {
            const picked = await pickFolder({ prompt: "Choose folder for split terminal (down)" });
            if (picked) {
              run("pane.split", { direction: "down", pane, folder: picked });
            }
          });
        },
      },
    ];

    // Split pane management (TerminalContextMenu.tsx:293-306, SortableTabContextMenu.tsx:216)
    if (hasMultiple) {
      list.push({
        id: "zoom-pane",
        label: "Toggle Expand / Collapse Pane",
        icon: isZoomed ? "minimize-2.svg" : "maximize-2.svg",
        shortcut: "Z",
        keys: ["9", "z"],
        section: "panes",
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          run("pane.zoom", { pane: focusedPane?.pane });
        },
      });
      list.push({
        id: "close-split",
        label: "Close Split Pane",
        icon: "x.svg",
        shortcut: "X",
        keys: ["0", "x"],
        section: "panes",
        destructive: true,
        action: (_cx, overlay) => {
          closeOverlay(overlay);
          for (const p of tabPanes) {
            if (p.pane !== focusedPane?.pane) {
              run("pane.close", { pane: p.pane });
            }
          }
        },
      });
    }

    return list;
  }

  choose(i, cx) {
    const list = this.items();
    const it = list[i];
    if (!it) return;
    const overlay = props()?.overlay;
    it.action(cx, overlay);
  }

  render(cx) {
    const t = theme();
    const list = this.items();
    if (this.at >= list.length) {
      this.at = Math.max(0, list.length - 1);
    }
    const bad = destructiveColor();

    return v_flex()
      .id("orca-split-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      // Dropdown surface: rounded-[11px] border p-1.5 min-w-[12rem] (dropdown-menu.tsx:80)
      .p(6)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (list.length === 0) return;
        const key = e.key.toLowerCase();
        const isShift = Boolean(e.modifiers?.shift);

        if (e.key === "down") {
          this.at = (this.at + 1) % list.length;
          cx.notify();
        } else if (e.key === "up") {
          this.at = (this.at + list.length - 1) % list.length;
          cx.notify();
        } else if (e.key === "home") {
          this.at = 0;
          cx.notify();
        } else if (e.key === "end") {
          this.at = list.length - 1;
          cx.notify();
        } else if (e.key === "enter" || e.key === "space") {
          this.choose(this.at, cx);
        } else if (e.key === "escape") {
          closeOverlay(props()?.overlay);
        } else {
          // Direct key shortcuts: 1..9, 0, or letter shortcuts (F, C, O, Z, X)
          const targetIdx = list.findIndex((it) => {
            if (!it.keys) return false;
            return it.keys.some((k) => {
              if (k.startsWith("shift+")) {
                const base = k.slice(6);
                return (isShift && key === base) || e.key === base.toUpperCase();
              }
              return !isShift && key === k;
            });
          });

          if (targetIdx !== -1) {
            this.at = targetIdx;
            cx.notify();
            this.choose(targetIdx, cx);
          }
        }
      })
      .children([
        // Header title & shortcuts guide (WorktreeContextMenuView.tsx:160-162)
        h_flex()
          .px(10)
          .pt(4)
          .pb(6)
          .items_center()
          .justify_between()
          .child(
            div()
              .text_size(11)
              .font_semibold()
              .text_color(t.muted)
              .child("SPLIT TERMINAL")
          )
          .child(
            div()
              .text_size(10)
              .text_color(t.muted)
              .child("↑↓ Navigate • ↵ Select • Esc")
          ),
        // Menu item rows with section separators
        ...list.map((it, i) => {
          const prev = list[i - 1];
          const hasSeparator = prev && prev.section !== it.section;
          const isSelected = i === this.at;
          const isRed = Boolean(it.destructive);

          return v_flex()
            .when(hasSeparator, (el) =>
              el.child(div().mx(8).my(4).h(1).bg(t.border))
            )
            .child(
              h_flex()
                .id(`split-item-${i}`)
                // Item geometry: h-7 px-2.5 gap-2 rounded-md (dropdown-menu.tsx:115)
                .h(28)
                .px(10)
                .gap(10)
                .rounded(6)
                .items_center()
                .justify_between()
                .line_height("16px")
                .whitespace_nowrap()
                .text_color(isRed ? bad : t.foreground)
                .when(isSelected, (el) =>
                  el.bg(isRed ? `${bad}1a` : t.selected)
                )
                .on_hover((hovered, cx) => {
                  if (hovered && this.at !== i) {
                    this.at = i;
                    cx.notify();
                  }
                })
                .on_click((_e, cx) => this.choose(i, cx))
                .child(
                  svg(`mods/orca-split-menu/${it.icon}`)
                    .size(14)
                    .flex_none()
                    .text_color(isRed ? bad : t.muted)
                )
                .child(div().flex_1().min_w(0).truncate().child(it.label))
                .child(
                  div()
                    .pl(14)
                    .flex_none()
                    .whitespace_nowrap()
                    .text_color(t.muted)
                    .text_size(11)
                    .child(it.shortcut)
                )
            );
        }),
      ]);
  }
}
