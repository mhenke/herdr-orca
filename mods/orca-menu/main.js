// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";
import { copyText } from "./clip.js";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(p, git) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const term = all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      // Orca's close row names the tab when this is its last pane
      // (terminal-pane-close-affordance.ts:16).
      const own = panes().find((x) => x.pane === tg.pane);
      const alone = own && panes().filter((x) => x.tab === own.tab).length < 2;
      return [
        // Orca's order (TerminalContextMenu.tsx:265-302): splits, then expand/collapse.
        ["Split Terminal Right", "pane.split", { direction: "right", pane: tg.pane }],
        ["Split Terminal Down", "pane.split", { direction: "down", pane: tg.pane }],
        [own?.zoomed ? "Collapse Pane" : "Expand Pane", "pane.zoom", { pane: tg.pane }],
        // Herdr-only: Orca has no right-click routing or park command; kept between the
        // layout block and Close, where Orca's title/ID block sits.
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        [alone ? "Close tab" : "Close Pane", "pane.close", { pane: tg.pane }],
      ];
    }
    case "tab":
      // Orca's order (SortableTabContextMenu.tsx:206-222): Copy Tab ID, Close, Change Title.
      // New tab is the tab strip's + button (orca-tabs/main.js), not a menu row in Orca.
      return [
        ["Copy Tab ID", "orca-menu.copy-tab-id", { id: tg.id }],
        ["Close", "tab.close", { id: tg.id }],
        ["Change Title", "tab.rename", { id: tg.id }],
      ];
    // `RepoHeaderProjectActionsMenu` (repo-header-project-actions.tsx:121-186): the ellipsis on a
    // project group header. Its rows are project settings/icon/visibility/groups/remove, none of
    // which Herdr has (there is no project entity), so the rows below are Herdr's own.
    case "group":
      return [
        ["New worktree", "worktree", { space: tg.id, action: "new" }],
        ["Open worktree", "worktree", { space: tg.id, action: "open" }],
        ["Copy Path", "orca-menu.copy-path", { path: tg.path ?? null, id: tg.id }],
        ["Rename workspace", "space.rename", { id: tg.id }],
        ["Close workspace", "space.close", { id: tg.id }],
      ];
    case "space":
      // Orca's order (WorktreeContextMenuView.tsx:165-205): Update, then Open in / Copy Path /
      // Copy Worktree Name, then worktree work, then the destructive row.
      return [
        ["Update", "space.rename", { id: tg.id }],
        ["Open in Terminal", "orca-menu.open-terminal", { id: tg.id }],
        ["Copy Path", "orca-menu.copy-path", { path: tg.path ?? null, id: tg.id }],
        ["Copy Worktree Name", "orca-menu.copy-name", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    default:
      return [
        ["New space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: graphite", "app.theme", { name: "graphite" }],
        ["Theme: ink", "app.theme", { name: "ink" }],
        ["Theme: moss", "app.theme", { name: "moss" }],
        ["Theme: atom one dark", "app.theme", { name: "atom-one-dark" }],
      ];
  }
}

// Orca's lucide glyph for each row, taken from the component named in the citation.
function menuIcon(it, zoomed) {
  const [, command, args] = it;
  if (command === "pane.split") return `mods/orca-menu/${args?.direction === "down" ? "panel-bottom-close" : "panel-right-close"}.svg`;
  if (command === "pane.zoom") return `mods/orca-menu/${zoomed ? "minimize-2" : "maximize-2"}.svg`;
  if (command === "worktree") return `mods/orca-menu/${args?.action === "new" ? "git-branch-plus" : args?.action === "open" ? "workflow" : "unlink"}.svg`;
  const name = command === "orca-menu.copy-path" || command === "orca-menu.copy-name" ? "copy"
    : command === "orca-menu.open-terminal" ? "folder-open"
    : command.endsWith(".close") ? "x"
    : command.endsWith(".rename") ? "pencil"
    : command.endsWith(".new") ? "plus"
    : command === "app.help" ? "terminal" : command === "app.theme" ? "settings" : "terminal";
  return `mods/orca-menu/${name}.svg`;
}

// Orca's separators, by menu: DropdownMenuSeparator at mx-10 my-5
// (dropdown-menu.tsx:208).
function section(p, list, i) {
  const it = list[i], prev = list[i - 1];
  if (!prev) return false;
  if (it[1].endsWith(".close")) return true;
  if (p?.tab === "tab" && it[0] === "Change Title") return true;
  if (p?.tab === "space" && (it[0] === "Open in Terminal" || (it[1] === "worktree" && prev[1] !== "worktree"))) return true;
  // The global list is Herdr's own; keep its rows apart as before.
  if (!p?.tab || p.tab === "global") return it[1] === "app.help" || (it[1] === "app.theme" && prev[1] !== "app.theme");
  return false;
}

// Orca's destructive row is --destructive: #ff6568 dark, #e40014 light (main.css:474,437);
// Herdr has no such token.
function destructive() {
  return window.appearance() === "dark" ? "#ff6568" : "#e40014";
}

// Orca marks only the pane and workspace close rows destructive; the tab's Close is plain
// (TerminalContextMenu.tsx:351, WorktreeContextMenuView.tsx:353, SortableTabContextMenu.tsx:206).
function isDestructive(p, it) {
  return it[1] === "pane.close" || ((p?.tab === "space" || p?.tab === "group") && it[1] === "space.close");
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = (keys() ?? []).find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

export default class Menu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    const p = props();
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  choose(i, cx) {
    const it = items(props(), this.git)[i];
    if (!it) return;
    closeOverlay(props()?.overlay);
    if (it[1].startsWith("orca-menu.")) {
      const space = spaces().find((s) => s.id === (props()?.target?.id ?? ""));
      const folder = space ? place(space) : "";
      if (it[1] === "orca-menu.copy-tab-id") void copyText(it[2].id ?? "");
      if (it[1] === "orca-menu.copy-path") void copyText(it[2].path || folder);
      if (it[1] === "orca-menu.copy-name") void copyText(space?.name ?? "");
      return;
    }
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const p = props();
    const list = items(p, this.git);
    const zoomed = panes().find((x) => x.pane === p?.target?.pane)?.zoomed;
    const bad = destructive();
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      // Content: rounded-[11px] border p-[4px] min-w-[11rem] (dropdown-menu.tsx:80). The
      // overlay frame owns radius, border and shadow; a mod cannot set them.
      .p(4)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .children([
        // Orca's workspace menu starts with a label (WorktreeContextMenuView.tsx:160-162).
        ...(p?.tab === "space"
          ? [div().px(10).pt(5).pb(3).text_size(11).font_semibold().text_color(t.muted).child("Workspace")]
          : []),
        ...list.map((it, i) => {
          const red = isDestructive(p, it);
          // Orca's Copy Tab ID is `inset`: no icon, 32px left pad (CopyTabIdMenuItem.tsx:24).
          const inset = it[1] === "orca-menu.copy-tab-id";
          return v_flex()
            // Separator: mx-2.5 my-[5px] h-px (dropdown-menu.tsx:208).
            .when(section(p, list, i), (el) => el.child(div().mx(10).my(5).h(1).bg(t.border)))
            .child(h_flex()
            .id(`mi-${i}`)
            // Item: gap-2 rounded-md px-2.5 py-1 text-[13px] leading-4 = 24px row
            // (dropdown-menu.tsx:115); icon 3.5 = 14.
            .h(24)
            .px(10)
            .when(inset, (el) => el.pl(32))
            .gap(8)
            .rounded(6)
            .items_center()
            .justify_between()
            .line_height("16px")
            .text_color(red ? bad : t.foreground)
            .when(i === this.at, (el) => el.bg(red ? `${bad}1a` : t.selected))
            .hover((s) => s.bg(red ? `${bad}1a` : t.hover))
            .on_click((_e, cx) => this.choose(i, cx))
            .when(!inset, (el) => el.child(svg(menuIcon(it, zoomed)).size(14).flex_none().text_color(red ? bad : t.muted)))
            .child(div().flex_1().child(it[0]))
            // Shortcut: ml-auto pl-4 text-muted-foreground, same 13px as the label
            // (dropdown-menu.tsx:219).
            .child(div().pl(16).flex_none().text_color(t.muted).child(shortcut(it[1], it[2]))));
        }),
      ]);
  }
}
