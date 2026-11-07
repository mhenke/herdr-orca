// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "group", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, hc } from "herdr";
import { copyText } from "./clip.js";

// Orca's palette (`SortableTabContextMenu.tsx:15-80`), in its order; `null` is "None".
const TAB_COLORS = [["None", null], ["Blue", "#3b82f6"], ["Purple", "#a855f7"], ["Pink", "#ec4899"],
  ["Red", "#ef4444"], ["Orange", "#f97316"], ["Yellow", "#eab308"], ["Green", "#22c55e"],
  ["Teal", "#14b8a6"], ["Gray", "#9ca3af"]];

// Herdr has no tab colour field, so the menu writes the store orca-tabs reads.
function stored(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && typeof v === "object" ? v : fallback;
  } catch { return fallback; }
}

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
        // Orca's order (TerminalContextMenu.tsx:204-370): Copy, Add to chat, Select All, Paste,
        // Quick Commands, agent rows, split section, title/ID block, close, clear, reset.
        // Add to chat (:209) and the agent rows (:236-262) stay out: Herdr has no chat.
        ["Copy", "terminal.copy", {}],
        // Orca selects the whole buffer (:217); Herdr cannot select, so the closest thing is
        // the buffer in the clipboard (`hc read` prints the screen and scrollback).
        ["Select All", "orca-menu.select-all", { terminal: term?.address ?? null }],
        ["Paste", "terminal.paste", {}],
        // Orca's Quick Commands menu (:227) is its command surface; Herdr's is the palette.
        ["Quick Commands", "app.palette", {}],
        // Orca's split section (TerminalContextMenu.tsx:265-302). Equalize Pane Sizes (:281)
        // has no equivalent: panes are content inside one layout node, not nodes themselves,
        // and `layout.resize` only sizes layout nodes (`commands.rs:80`, window.rs:3248).
        ["Split Terminal Right", "pane.split", { direction: "right", pane: tg.pane }],
        ["Split Terminal Down", "pane.split", { direction: "down", pane: tg.pane }],
        [own?.zoomed ? "Collapse Pane" : "Expand Pane", "pane.zoom", { pane: tg.pane }],
        // Orca's title/ID block (:307-347). Orca's pane title is the tab's custom title
        // (`ClaudeAccountSwitchSessionTree.tsx:276` = `customTitle || title`), so `tab.rename`
        // names it, and an empty name drops it (`commands.rs:40`).
        ...(own?.tab
          ? [["Set Title…", "tab.rename", { id: own.tab }], ["Clear Pane Title", "tab.rename", { id: own.tab, name: "" }]]
          : []),
        // Herdr-only: Orca has no right-click routing or park command; kept where the
        // title/ID block sits.
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        // Copy Session/Terminal/Pane ID (:329-347): Herdr ids go to the clipboard through
        // `clip.js`. The session id has no counterpart.
        ...(term ? [["Copy Terminal ID", "orca-menu.copy-terminal", { id: term.address }]] : []),
        ["Copy Pane ID", "orca-menu.copy-pane-id", { id: tg.pane ?? "" }],
        [alone ? "Close tab" : "Close Pane", "pane.close", { pane: tg.pane }],
        // Clear Screen (:359) and Reset Terminal (:363): no command sends input, so the
        // terminal is driven through `hc` — Ctrl+L for a clear, `reset` for a full one.
        ...(term
          ? [
              ["Clear Screen", "orca-menu.clear-screen", { terminal: term.address }],
              ["Reset Terminal", "orca-menu.reset-terminal", { terminal: term.address }],
            ]
          : []),
      ];
    }
    case "tab": {
      // Orca's order (SortableTabContextMenu.tsx:152-251): split section (:157-166), then
      // "Continue with Terminal Agent" (:167-178, chat view only) and the
      // TabSessionSurfaceSwitchMenuItems rows (:179-185), separator (:186), Pin/Unpin
      // (:187-196), Allow Auto-Close (:197-205), Copy Tab ID (:206), separator (:207),
      // Close (:208-212), Close Others (:213-215), Close Split Pane (:216), separator (:217),
      // Change Title (:218-222), Tab Color (:223-250). The chat-view and session-switch rows
      // stay out: Herdr has no chat. Allow Auto-Close has no counterpart either: Herdr keeps a
      // tab until `tab.close`, and `hc keep --off` ends a lost terminal but closes no tab.
      const own = spaces().find((s) => (s.tabs ?? []).some((x) => x.id === tg.id));
      const list = own?.tabs ?? [];
      const tab = list.find((x) => x.id === tg.id);
      const mine = panes().filter((x) => x.tab === tg.id);
      const pane = (mine.find((x) => x.focused) ?? mine[0])?.pane;
      return [
        ...(pane
          ? [
              ["Split Terminal Right", "pane.split", { direction: "right", pane }],
              ["Split Terminal Down", "pane.split", { direction: "down", pane }],
            ]
          : []),
        // Herdr-only, in Orca's first slot: Orca reorders tabs by drag (SortableTab.tsx:213) and
        // has no move rows; `tab.move` backs these.
        ...(tab?.index > 1 ? [["Move Left", "tab.move", { id: tg.id, index: tab.index - 1 }]] : []),
        ...(tab && tab.index < list.length ? [["Move Right", "tab.move", { id: tg.id, index: tab.index + 1 }]] : []),
        // SortableTabContextMenu.tsx:187-196 — Orca's Pin/Unpin. Herdr's only pin-like state is
        // `settled` (TabInfo.settled): `tab.settle` puts the tab away rather than making it
        // unclosable, so the row keeps Herdr's words.
        [tab?.settled ? "Bring Tab Back" : "Put Tab Away", tab?.settled ? "tab.unsettle" : "tab.settle", { id: tg.id }],
        ["Copy Tab ID", "orca-menu.copy-tab-id", { id: tg.id }],
        ["Close", "tab.close", { id: tg.id }],
        // SortableTabContextMenu.tsx:213 — inset, disabled when `tabCount <= 1`; with one tab
        // the loop in choose() would close nothing, so leave the row out.
        ...(list.length > 1 ? [["Close Others", "orca-menu.close-others", { id: tg.id }]] : []),
        // Close Split Pane (:216) closes the tab's split group; the closest Herdr action is
        // closing every other pane of the tab, leaving the focused one.
        ...(mine.length > 1 ? [["Close Split Pane", "orca-menu.close-split-panes", { id: tg.id }]] : []),
        ["Change Title", "tab.rename", { id: tg.id }],
        // Tab Color (:223-250): Orca draws the palette as one swatch block; a row menu shows
        // the same choices as rows, the current one marked. Herdr has no tab colour field, so
        // orca-tabs draws the dot from the store this writes.
        ...TAB_COLORS.map(([label, value]) => [
          // `||` not `??`: clearing a colour stores "", which `??` passes through, so the
          // None row stayed unmarked after a colour was removed (`value` is null for None).
          `${(stored("tab.colors.v1", {})[tg.id] || null) === value ? "●" : "○"} Tab Color: ${label}`,
          "orca-menu.tab-color",
          { id: tg.id, color: value ?? "" },
        ]),
      ];
    }
    // `RepoHeaderProjectActionsMenu` (repo-header-project-actions.tsx:121-186): the ellipsis on a
    // project group header. Its rows are project settings/icon/visibility/groups/remove, none of
    // which Herdr has (there is no project entity), so the rows below are Herdr's own.
    case "group":
      return [
        ["New worktree", "worktree", { space: tg.id, action: "new", ...(tg.path ? { folder: tg.path } : {}) }],
        ["Open worktree", "worktree", { space: tg.id, action: "open", ...(tg.path ? { folder: tg.path } : {}) }],
        ["Copy Path", "orca-menu.copy-path", { path: tg.path ?? null, id: tg.id }],
        ["Rename workspace", "space.rename", { id: tg.id }],
        ["Close workspace", "space.close", { id: tg.id }],
      ];
    case "space":
      // Orca's order (WorktreeContextMenuView.tsx:165-205): Update, then Open in / Copy Path /
      // Copy Worktree Name, then worktree work, then the destructive row.
      return [
        ["Update", "space.rename", { id: tg.id }],
        // Orca's "Open in" is a submenu of external editors (WorktreeOpenInMenu.tsx:295-325);
        // Herdr has no external-open command, so this opens a Herdr terminal in the
        // worktree's folder instead (terminal.open, commands.md:277).
        ["Open in Terminal", "terminal.open", tg.path ? { folder: tg.path } : {}],
        ["Copy Path", "orca-menu.copy-path", { path: tg.path ?? null, id: tg.id }],
        ["Copy Worktree Name", "orca-menu.copy-name", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new", ...(tg.path ? { folder: tg.path } : {}) }], ["Open worktree", "worktree", { space: tg.id, action: "open", ...(tg.path ? { folder: tg.path } : {}) }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove", ...(tg.path ? { folder: tg.path } : {}) }]] : []),
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
  if (command === "tab.move") return `mods/orca-menu/${it[0] === "Move Left" ? "arrow-left" : "arrow-right"}.svg`;
  if (command === "orca-menu.close-others") return "mods/orca-menu/x.svg";
  if (command === "tab.settle" || command === "tab.unsettle") return `mods/orca-menu/${command === "tab.unsettle" ? "pin-off" : "pin"}.svg`;
  const name = command === "orca-menu.copy-path" || command === "orca-menu.copy-name" || command === "terminal.copy" ? "copy"
    : command === "terminal.paste" ? "clipboard"
    : command === "terminal.open" ? "folder-open"
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
  // Close starts its own group in every menu (dropdown-menu.tsx:208): pane
  // (TerminalContextMenu.tsx:355), tab (SortableTabContextMenu.tsx:207), space (:196).
  if (it[1].endsWith(".close")) return true;
  // Orca's pane menu separates the Copy/Paste block from the split section
  // (TerminalContextMenu.tsx:263).
  if (p?.tab === "pane" && it[1] === "pane.split" && prev[1] !== "pane.split") return true;
  if (p?.tab === "tab") {
    // After the split section (SortableTabContextMenu.tsx:178) and before Change Title (:217).
    if (prev[1] === "pane.split") return true;
    if (it[0] === "Change Title") return true;
  }
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
// (TerminalContextMenu.tsx:351, WorktreeContextMenuView.tsx:353, SortableTabContextMenu.tsx:208).
function isDestructive(p, it) {
  return it[1] === "pane.close" || ((p?.tab === "space" || p?.tab === "group") && it[1] === "space.close");
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = (keys() ?? []).find((b) => b.action === name || b.action === `${name}:${value}`);
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
    // `terminal.copy`/`terminal.paste` act on the focused terminal (commands.md:285-287), so
    // focus the pane that was right-clicked before the overlay gives focus back.
    if (it[1] === "terminal.copy" || it[1] === "terminal.paste") {
      const tg = props()?.target ?? {};
      if (tg.terminal || tg.pane) run("pane.focus", tg.terminal ? { terminal: tg.terminal } : { pane: tg.pane });
      run(it[1], it[2]);
      closeOverlay(props()?.overlay);
      return;
    }
    closeOverlay(props()?.overlay);
    if (it[1].startsWith("orca-menu.")) {
      const space = spaces().find((s) => s.id === (props()?.target?.id ?? ""));
      const folder = space ? place(space) : "";
      if (it[1] === "orca-menu.copy-tab-id") void copyText(it[2].id ?? "");
      if (it[1] === "orca-menu.copy-path") void copyText(it[2].path || folder);
      if (it[1] === "orca-menu.copy-name") void copyText(space?.name ?? "");
      // Close Others — the tab's own space only (SortableTabContextMenu.tsx:213).
      if (it[1] === "orca-menu.close-others") {
        const owner = spaces().find((s) => (s.tabs ?? []).some((x) => x.id === it[2].id));
        for (const x of owner?.tabs ?? []) if (x.id !== it[2].id) run("tab.close", { id: x.id });
      }
      if (it[1] === "orca-menu.close-split-panes") {
        const mine = panes().filter((x) => x.tab === it[2].id);
        const keep = mine.find((x) => x.focused) ?? mine[0];
        for (const x of mine) if (x !== keep) run("pane.close", { pane: x.pane });
      }
      // Tab colour: the store orca-tabs reads; closing the overlay repaints the strip.
      if (it[1] === "orca-menu.tab-color") {
        const all = stored("tab.colors.v1", {});
        if (it[2].color) all[it[2].id] = it[2].color; else delete all[it[2].id];
        localStorage.setItem("tab.colors.v1", JSON.stringify(all));
      }
      if (it[1] === "orca-menu.copy-terminal" || it[1] === "orca-menu.copy-pane-id") void copyText(it[2].id ?? "");
      // Select All: Herdr cannot select, so the whole buffer goes to the clipboard.
      if (it[1] === "orca-menu.select-all" && it[2].terminal) void (async () => {
        const r = await hc(["read", it[2].terminal]).catch(() => null);
        if (r?.code === 0 && r.stdout.trim()) await copyText(r.stdout);
      })();
      // Clear Screen / Reset Terminal: `hc` writes to the terminal; Ctrl+L clears the screen,
      // `reset` restores the terminal modes.
      if (it[1] === "orca-menu.clear-screen" && it[2].terminal) void hc(["keys", it[2].terminal, "ctrl+l"]);
      if (it[1] === "orca-menu.reset-terminal" && it[2].terminal) void hc(["send", it[2].terminal, "reset"]);
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
        else if (e.key === "home") this.at = 0;
        else if (e.key === "end") this.at = list.length - 1;
        // Radix activates with Enter or Space (context-menu.tsx:31-62). Type-ahead and
        // ChevronRight submenus have no flat-list equivalent here.
        else if (e.key === "enter" || e.key === "space") this.choose(this.at, cx);
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
          // Orca's Copy Tab ID and Close Others are `inset`: no icon, 32px left pad
          // (CopyTabIdMenuItem.tsx:24, SortableTabContextMenu.tsx:208).
          const inset = it[1] === "orca-menu.copy-tab-id" || it[1] === "orca-menu.close-others";
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
            // Orca's rows are whitespace-nowrap (TerminalContextMenu.tsx:265,273); the label
            // gives way with an ellipsis rather than wrapping inside the fixed popup.
            .whitespace_nowrap()
            .text_color(red ? bad : t.foreground)
            // One current row: pointer hover moves `this.at`, so hover, keyboard and Enter
            // agree (dropdown-menu.tsx:115 data-[current=true]).
            .when(i === this.at, (el) => el.bg(red ? `${bad}1a` : t.selected))
            .on_hover((hovered, cx) => { if (hovered && this.at !== i) { this.at = i; cx.notify(); } })
            .on_click((_e, cx) => this.choose(i, cx))
            .when(!inset, (el) => el.child(svg(menuIcon(it, zoomed)).size(14).flex_none().text_color(red ? bad : t.muted)))
            .child(div().flex_1().min_w(0).truncate().child(it[0]))
            // Shortcut: ml-auto shrink-0 whitespace-nowrap pl-4 text-muted-foreground
            // (dropdown-menu.tsx:219).
            .child(div().pl(16).flex_none().whitespace_nowrap().text_color(t.muted).child(shortcut(it[1], it[2]))));
        }),
      ]);
  }
}
