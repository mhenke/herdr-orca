// Derived from Herdr App's defaults/mods/menu/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "group", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, hc, home, shared, setShared } from "herdr";
import { copyText } from "./clip.js";
import { buildBoundedSessionTranscript } from "./transcript.js";

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

// Where a space is: its designated workspace folder (GLOSSARY.md:
// "The space is the scope; the terminal is only where keystrokes go").
function place(s) {
  return s?.folder ?? null;
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
      const curTab = spaces().flatMap((s) => s.tabs ?? []).find((t) => t.id === own?.tab);
      const isAgent = Boolean(own?.program?.agent || own?.status === "working" || own?.status === "blocked" || term?.agent);
      return [
        // Orca's order (TerminalContextMenu.tsx:204-370): Copy, Add to chat, Select All, Paste,
        // Quick Commands, agent rows, split section, title/ID block, close, clear, reset.
        // Add to chat (:209) stays out: Herdr has no chat.
        ["Copy", "terminal.copy", {}],
        // Orca selects the whole buffer (:217); Herdr cannot select, so the closest thing is
        // the buffer in the clipboard (`hc read --lines 10000` prints the screen and scrollback).
        ["Select All", "orca-menu.select-all", { terminal: term?.address ?? null, pane: tg.pane }],
        ["Paste", "terminal.paste", {}],
        // Orca's Quick Commands menu (:227) is its command surface; Herdr's is the palette.
        ["Quick Commands", "app.palette", {}],
        // Orca's agent rows (TerminalContextMenu.tsx:236-246):
        // Hand Off to Another Agent (:236, canContinueAgentSessionInNewSession / isTuiAgent),
        // Fork Agent Session… (:239), Copy Context (:246).
        ...(term
          ? [
              ...(isAgent ? [["Hand Off to Another Agent…", "orca-menu.handoff", { terminal: term.address, pane: tg.pane }]] : []),
              ["Fork Agent Session…", "orca-menu.fork", { terminal: term.address, pane: tg.pane }],
              ["Copy Context", "orca-menu.copy-context", { terminal: term.address, pane: tg.pane }],
            ]
          : []),
        // Orca's split section (TerminalContextMenu.tsx:265-302, TabWorkspaceLayoutMenuSection.tsx:14-41).
        // Equalize Pane Sizes (:281) has no equivalent: panes are content inside one layout node.
        ["Split Terminal Right", "pane.split", { direction: "right", pane: tg.pane }],
        ["Split Terminal Left", "orca-menu.split-left", { pane: tg.pane }],
        ["Split Terminal Down", "pane.split", { direction: "down", pane: tg.pane }],
        ["Split Terminal Up", "orca-menu.split-up", { pane: tg.pane }],
        ...(own && panes().filter((x) => x.tab === own.tab).length > 1
          ? [
              ["Move to New Tab", "orca-menu.unsplit-to-tab", { pane: tg.pane, terminal: term?.address }],
              ["Swap with Left", "pane.swap", { pane: tg.pane, direction: "left" }],
              ["Swap with Right", "pane.swap", { pane: tg.pane, direction: "right" }],
              ["Swap with Above", "pane.swap", { pane: tg.pane, direction: "up" }],
              ["Swap with Below", "pane.swap", { pane: tg.pane, direction: "down" }],
            ]
          : []),
        [own?.zoomed ? "Collapse Pane" : "Expand Pane", "pane.zoom", { pane: tg.pane }],
        // Orca's title/ID block (:307-347). Orca's pane title is the tab's custom title
        // (`ClaudeAccountSwitchSessionTree.tsx:276` = `customTitle || title`), so `tab.rename`
        // names it, and an empty name drops it (`commands.rs:40`). Clear Pane Title is gated
        // on menuPaneHasCustomTitle (TerminalPaneSurface.tsx:317).
        ...(own?.tab
          ? [
              ["Set Title…", "tab.rename", { id: own.tab }],
              ...(curTab?.named ? [["Clear Pane Title", "tab.rename", { id: own.tab, name: "" }]] : []),
            ]
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
        // TerminalContextMenu.tsx:348-357: Close Pane / Close tab. Gated on canCloseTerminalPane
        // (terminal-pane-close-affordance.ts:6-14: true if paneCount > 1, or !isTabPinned).
        ...(!(alone && curTab?.settled)
          ? [[alone ? "Close tab" : "Close Pane", alone ? "tab.close" : "pane.close", alone ? { id: own?.tab } : { pane: tg.pane }]]
          : []),
        // Clear Screen (:359) and Reset Terminal (:363): no command sends input, so the
        // terminal is driven through `hc` — Ctrl+L for a clear, `reset` for a full one.
        ...(term
          ? [
              ["Clear Screen", "orca-menu.clear-screen", { terminal: term.address, pane: tg.pane }],
              ["Reset Terminal", "orca-menu.reset-terminal", { terminal: term.address, pane: tg.pane }],
            ]
          : []),
      ];
    }
    case "tab": {
      // Orca's order (SortableTabContextMenu.tsx:152-251): split section (:157-166,
      // TabWorkspaceLayoutMenuSection.tsx:42-93 and TerminalTabSplitMenuSection.tsx:46-77), then
      // "Continue with Terminal Agent" (:167-178, chat view only) and the
      // TabSessionSurfaceSwitchMenuItems rows (:179-185), separator (:186), Pin/Unpin
      // (:187-196), Allow Auto-Close (:197-205), Copy Tab ID (:206), separator (:207),
      // Close (:208-212), Close Others (:213-215), Close split pane (:216, CloseSplitPaneMenuItem.tsx:21-24), separator (:217),
      // Change Title (:218-222), Tab Color (:223-250). The chat-view and session-switch rows
      // stay out: Herdr has no chat. Allow Auto-Close has no counterpart either: Herdr keeps a
      // tab until `tab.close`, and `hc keep --off` ends a lost terminal but closes no tab.
      const own = spaces().find((s) => (s.tabs ?? []).some((x) => x.id === tg.id));
      const list = own?.tabs ?? [];
      const tab = list.find((x) => x.id === tg.id);
      const mine = panes().filter((x) => x.tab === tg.id);
      const pane = (mine.find((x) => x.focused) ?? mine[0])?.pane;
      return [
        ...(list.length > 1
          ? [
              // TabWorkspaceLayoutMenuSection.tsx:42-93 — Move Tab to Split across 4 directions
              ["Move Tab to Split Right", "orca-menu.move-tab-split", { id: tg.id, direction: "right" }],
              ["Move Tab to Split Left", "orca-menu.move-tab-split", { id: tg.id, direction: "left" }],
              ["Move Tab to Split Down", "orca-menu.move-tab-split", { id: tg.id, direction: "down" }],
              ["Move Tab to Split Up", "orca-menu.move-tab-split", { id: tg.id, direction: "up" }],
            ]
          : []),
        ...(pane
          ? [
              // TerminalTabSplitMenuSection.tsx:46-77 — Split terminal right and down
              ["Split terminal right", "pane.split", { direction: "right", pane }],
              ["Split terminal down", "pane.split", { direction: "down", pane }],
            ]
          : []),
        // SortableTabContextMenu.tsx:187-196 — Orca's Pin/Unpin.
        [tab?.settled ? "Unpin Tab" : "Pin Tab", tab?.settled ? "tab.unsettle" : "tab.settle", { id: tg.id }],
        // SortableTabContextMenu.tsx:206 & CopyTabIdMenuItem.tsx:16 — Copy Tab ID.
        ["Copy Tab ID", "orca-menu.copy-tab-id", { id: tg.id }],
        // SortableTabContextMenu.tsx:208-212 — Close.
        ["Close", "tab.close", { id: tg.id }],
        // SortableTabContextMenu.tsx:213 — inset, disabled when `tabCount <= 1`; with one tab
        // the loop in choose() would close nothing, so leave the row out.
        ...(list.length > 1 ? [["Close Others", "orca-menu.close-others", { id: tg.id }]] : []),
        // Close split pane (CloseSplitPaneMenuItem.tsx:21-24) closes other panes in the split group
        ...(mine.length > 1 ? [["Close split pane", "orca-menu.close-split-panes", { id: tg.id }]] : []),
        // SortableTabContextMenu.tsx:218-222 — Change Title.
        ["Change Title", "tab.rename", { id: tg.id }],
      ];
    }
    // `RepoHeaderProjectActionsMenu` (repo-header-project-actions.tsx:121-186) &
    // `ProjectGroupHeaderMenu` (project-group-header-actions.tsx:25-95):
    // the ellipsis or right-click on a project group header. Its rows are project
    // actions. In Herdr, open spaces belonging to the group can be renamed or closed.
    case "group": {
      const open = spaces().some((s) => s.id === tg.id);
      const groupSpaces = spaces().filter((s) => s.id === tg.id || (tg.path && (s.folder === tg.path || s.folder?.startsWith(tg.path + "/"))));
      const openSpace = groupSpaces[0];
      const folder = tg.path ?? (openSpace ? place(openSpace) : null);
      const args = { ...(open ? { space: tg.id } : openSpace ? { space: openSpace.id } : {}), ...(folder ? { folder } : {}), ...(tg.machine ? { machine: tg.machine } : {}) };
      return [
        ["New worktree", "worktree", { ...args, action: "new" }],
        ["Open worktree", "worktree", { ...args, action: "open" }],
        ["Copy Path", "orca-menu.copy-path", { path: folder, id: tg.id }],
        ...(openSpace ? [["Rename workspace", "space.rename", { id: openSpace.id }]] : []),
        ...(groupSpaces.length === 1
          ? [["Close workspace", "space.close", { id: groupSpaces[0].id }]]
          : groupSpaces.length > 1
            ? [["Close workspace", "orca-menu.close-group", { ids: groupSpaces.map((s) => s.id) }]]
            : []),
      ];
    }
    case "space": {
      // Orca keys the menu on the worktree, not a tab (`worktree-card-surface.tsx:139-146`):
      // Update and Close belong to a tab, while Open in / Copy Path / Copy Worktree Name and
      // the worktree work are unconditional (`WorktreeContextMenuView.tsx:165-298`). A card
      // with no open space still shows the latter, from the facts its opener passes.
      const open = spaces().some((s) => s.id === tg.id);
      // The opener carries `linked`; `git` is the probe's fallback for a row whose git state
      // had not loaded, or for a caller that sends only { id, path }.
      const linked = typeof tg.linked === "boolean" ? tg.linked : git === "linked";
      const repo = typeof tg.linked === "boolean" || git !== null;
      const folder = tg.top || tg.folder || tg.path || null;
      // The worktree dialog takes a space when one is open, `{ folder, machine }` otherwise
      // (defaults/mods/worktree/main.js:158).
      const args = { ...(open ? { space: tg.id } : {}), ...(folder ? { folder } : {}), ...(tg.machine ? { machine: tg.machine } : {}) };
      return [
        ...(open ? [["Update", "space.rename", { id: tg.id }]] : []),
        // Orca's "Open in" is a submenu of external editors (WorktreeOpenInMenu.tsx:295-325);
        // Herdr has no external-open command, so this opens a Herdr terminal in the
        // worktree's folder instead (terminal.open, commands.md:277).
        ["Open in Terminal", "terminal.open", folder ? { folder } : {}],
        ["Copy Path", "orca-menu.copy-path", { path: folder, id: tg.id }],
        // The display name is custom, else the branch, else the folder's last segment
        // (`worktree-default-display-name.ts:13-25`).
        ["Copy Worktree Name", "orca-menu.copy-name", { id: tg.id, name: tg.branch ?? null, folder }],
        // WorktreeContextMenuView.tsx:203-214 — Mark Read / Mark Unread
        ["Mark " + (tg.unread ? "Read" : "Unread"), "orca-menu.toggle-unread", { id: tg.id }],
        ...(repo ? [["New worktree", "worktree", { ...args, action: "new" }], ["Open worktree", "worktree", { ...args, action: "open" }]] : []),
        ...(linked ? [["Remove worktree", "worktree", { ...args, action: "remove" }]] : []),
        ...(open ? [["Close", "space.close", { id: tg.id }]] : []),
      ];
    }
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
  if (it[0] === "Clear Pane Title") return "mods/orca-menu/x.svg";
  if (command === "mod.open" && args?.name === "orca-split-menu") return "mods/orca-menu/panel-right-close.svg";
  if (command === "pane.split") return `mods/orca-menu/${args?.direction === "down" ? "panel-bottom-close" : "panel-right-close"}.svg`;
  if (command === "orca-menu.split-left") return "mods/orca-menu/arrow-left.svg";
  if (command === "orca-menu.split-up") return "mods/orca-menu/arrow-up.svg";
  if (command === "orca-menu.move-tab-split") return `mods/orca-menu/arrow-${args?.direction ?? "right"}.svg`;
  if (command === "orca-menu.unsplit-to-tab") return "mods/orca-menu/plus.svg";
  if (command === "pane.swap") return `mods/orca-menu/arrow-${args?.direction ?? "right"}.svg`;
  if (command === "pane.zoom") return `mods/orca-menu/${zoomed ? "minimize-2" : "maximize-2"}.svg`;
  if (command === "worktree") return `mods/orca-menu/${args?.action === "new" ? "git-branch-plus" : args?.action === "open" ? "workflow" : "unlink"}.svg`;
  if (command === "tab.move") return `mods/orca-menu/${it[0] === "Move Left" ? "arrow-left" : "arrow-right"}.svg`;
  if (command === "orca-menu.close-others" || command === "orca-menu.close-split-panes") return "mods/orca-menu/x.svg";
  if (command === "tab.settle" || command === "tab.unsettle") return `mods/orca-menu/${command === "tab.unsettle" ? "pin-off" : "pin"}.svg`;
  if (command === "orca-menu.handoff") return "mods/orca-menu/message-square-plus.svg";
  if (command === "orca-menu.fork") return "mods/orca-menu/git-fork.svg";
  if (command === "orca-menu.copy-context") return "mods/orca-menu/copy.svg";
  // TerminalContextMenu.tsx:218, 360, 364
  if (command === "orca-menu.select-all") return "mods/orca-menu/text-select.svg";
  if (command === "orca-menu.clear-screen") return "mods/orca-menu/eraser.svg";
  if (command === "orca-menu.reset-terminal") return "mods/orca-menu/rotate-ccw.svg";
  // WorktreeContextMenuView.tsx:204-208 — BellOff when isUnread, Bell otherwise
  if (command === "orca-menu.toggle-unread") return it[0] === "Mark Read" ? "mods/orca-menu/bell-off.svg" : "mods/orca-menu/bell.svg";
  const name = command === "orca-menu.copy-path" || command === "orca-menu.copy-name" || command === "orca-menu.copy-terminal" || command === "orca-menu.copy-pane-id" || command === "terminal.copy" ? "copy"
    : command === "terminal.paste" ? "clipboard"
    : command === "terminal.open" ? "folder-open"
    : (command.endsWith(".close") || command === "orca-menu.close-group") ? "x"
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
  if (it[1].endsWith(".close") || it[1] === "orca-menu.close-group") return true;
  // Orca's pane menu separates the Copy/Paste block from the split section
  // (TerminalContextMenu.tsx:263), and separates swap/move and zoom blocks.
  if (p?.tab === "pane") {
    const isSplit = (x) => x && (x[1] === "pane.split" || x[1] === "orca-menu.split-left" || x[1] === "orca-menu.split-up" || x[1] === "orca-menu.unsplit-to-tab");
    if (isSplit(it) && !isSplit(prev)) return true;
    if (it[1] === "pane.swap" && prev[1] !== "pane.swap") return true;
    if (it[1] === "pane.zoom" && prev[1] !== "pane.zoom") return true;
    // TerminalContextMenu.tsx:308 — separator before title/id block
    const isTitleId = (x) => x && (x[0] === "Set Title…" || x[1] === "tab.rename" || x[1] === "terminal.right_click" || x[1] === "terminal.park" || x[1] === "orca-menu.copy-terminal" || x[1] === "orca-menu.copy-pane-id");
    if (isTitleId(it) && !isTitleId(prev)) return true;
    // TerminalContextMenu.tsx:358 — separator before clear screen
    if (it[1] === "orca-menu.clear-screen") return true;
  }
  if (p?.tab === "tab") {
    // SortableTabContextMenu.tsx:186 — separator before Pin/Unpin Tab
    if (it[1] === "tab.settle" || it[1] === "tab.unsettle") return true;
    // CloseSplitPaneMenuItem.tsx:20 — separator before Close split pane
    if (it[1] === "orca-menu.close-split-panes") return true;
    // SortableTabContextMenu.tsx:217 — separator before Change Title
    if (it[0] === "Change Title") return true;
  }
  if (p?.tab === "space") {
    // WorktreeContextMenuView.tsx:177, 196, 218, 350
    if (it[1] === "terminal.open") return true;
    if (it[1] === "orca-menu.toggle-unread") return true;
    if (it[1] === "worktree" && prev[1] !== "worktree") return true;
  }
  if (p?.tab === "group") {
    if (it[1] === "orca-menu.copy-path") return true;
    if (it[1] === "space.rename") return true;
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

// Orca marks pane close, close split pane (CloseSplitPaneMenuItem.tsx:21-24), and workspace close rows destructive;
// the tab's Close is plain (TerminalContextMenu.tsx:351, WorktreeContextMenuView.tsx:353, SortableTabContextMenu.tsx:208, repo-header-project-actions.tsx:181).
function isDestructive(p, it) {
  return it[1] === "pane.close" || (p?.tab === "pane" && it[1] === "tab.close") || it[1] === "orca-menu.close-split-panes" || ((p?.tab === "space" || p?.tab === "group") && (it[1] === "space.close" || it[1] === "orca-menu.close-group"));
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
    const tg = p?.target ?? {};
    const space = p?.tab === "space" && spaces().find((s) => s.id === tg.id);
    // A card hands over the worktree's own `linked`, so only a space whose git state has not
    // loaded needs the checkout probe.
    const folder = space ? place(space) : tg.folder ?? tg.top ?? null;
    if (p?.tab === "space" && folder && typeof tg.linked !== "boolean")
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, tg.machine ?? space?.machine ?? null).catch(() => null);
        cx.notify();
      });
  }

  choose(i, cx) {
    const pProps = props();
    const it = items(pProps, this.git)[i];
    if (!it) return;
    const overlayId = pProps?.overlay;
    // `terminal.copy`/`terminal.paste` act on the focused terminal (commands.md:285-287), so
    // focus the pane that was right-clicked before the overlay gives focus back.
    if (it[1] === "terminal.copy" || it[1] === "terminal.paste") {
      const tg = pProps?.target ?? {};
      if (tg.pane || tg.terminal) run("pane.focus", tg.pane ? { pane: tg.pane } : { terminal: tg.terminal });
      run(it[1], it[2]);
      closeOverlay(overlayId);
      return;
    }
    if (it[1].startsWith("orca-menu.")) {
      const target = pProps?.target ?? {};
      const space = spaces().find((s) => s.id === (target.id ?? ""));
      const folder = space ? place(space) : "";
      // CopyTabIdMenuItem.tsx:16 — writeClipboardText(`orcaTabId: ${unifiedTabId}`)
      if (it[1] === "orca-menu.copy-tab-id") copyText(`orcaTabId: ${it[2].id ?? ""}`, cx);
      if (it[1] === "orca-menu.copy-path") {
        const p = it[2]?.path || target.path || target.folder || target.top || folder || (space ? home() : "");
        copyText(p, cx);
      }
      // Display name: explicit custom name (space.named), else branch name, else folder basename
      // (Orca spec: worktree-default-display-name.ts:13-25 resolveWorktreeDisplayName).
      if (it[1] === "orca-menu.copy-name") {
        const customName = (space?.named || target.named) ? (space?.name || target.name) : null;
        const branchName = it[2]?.name || target.branch || null;
        const folderPath = String(it[2]?.folder ?? target.folder ?? target.path ?? folder ?? "");
        const fallback = folderPath.replace(/\/+$/, "").split("/").pop() || space?.name || "";
        const name = customName || branchName || fallback;
        copyText(name, cx);
      }
      if (it[1] === "orca-menu.close-group") {
        for (const id of (it[2]?.ids ?? [])) {
          run("space.close", { id, confirmed: true });
        }
        closeOverlay(overlayId);
        return;
      }
      // WorktreeContextMenuView.tsx:203-214 — toggle read / unread
      if (it[1] === "orca-menu.toggle-unread") {
        try {
          const list = JSON.parse(localStorage.getItem("spaces.unread.v1") ?? "[]");
          const set = new Set(Array.isArray(list) ? list : []);
          set.has(it[2].id) ? set.delete(it[2].id) : set.add(it[2].id);
          const updated = [...set];
          localStorage.setItem("spaces.unread.v1", JSON.stringify(updated));
          setShared("spaces.unread.v1", updated);
        } catch {}
        closeOverlay(overlayId);
        return;
      }
      // Close Others — SortableTabContextMenu.tsx:213 & useBulkTabCloseConfirmation (bulk-tab-close-confirmation.ts:5-15)
      if (it[1] === "orca-menu.close-others") {
        const owner = spaces().find((s) => (s.tabs ?? []).some((x) => x.id === it[2].id));
        const targetIds = (owner?.tabs ?? []).filter((x) => x.id !== it[2].id && !x.settled).map((x) => x.id);
        if (targetIds.length > 0) {
          openOverlay({
            mod: "orca-tabs",
            kind: "dialog",
            modal: true,
            width: 384,
            height: 180,
            props: {
              confirmClose: {
                kind: "bulk",
                scope: "others",
                tabIds: targetIds,
              }
            }
          });
        }
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.move-tab-split") {
        setShared("orca-tabs.action", {
          kind: "move-tab-split",
          tab: it[2].id,
          direction: it[2].direction,
        });
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.unsplit-to-tab") {
        setShared("orca-tabs.action", {
          kind: "unsplit-to-tab",
          terminal: it[2].terminal,
          pane: it[2].pane,
        });
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.close-split-panes") {
        const mine = panes().filter((x) => x.tab === it[2].id);
        const keep = mine.find((x) => x.focused) ?? mine[0];
        for (const x of mine) if (x !== keep) run("pane.close", { pane: x.pane });
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.split-left") {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        run("pane.split", { direction: "right", ...(it[2]?.pane ? { pane: it[2].pane } : {}) });
        run("pane.swap", { direction: "left" });
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.split-up") {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        run("pane.split", { direction: "down", ...(it[2]?.pane ? { pane: it[2].pane } : {}) });
        run("pane.swap", { direction: "up" });
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.copy-terminal" || it[1] === "orca-menu.copy-pane-id") {
        copyText(it[2].id ?? "", cx);
        closeOverlay(overlayId);
        return;
      }
      // Copy Context (terminal-pane-menu-agent-session-actions.ts:58-65 & terminal-agent-session-fork.ts:139):
      // Extracts up to 1000 lines scrollback, cleans and bounds transcript to clipboard.
      if (it[1] === "orca-menu.copy-context" && it[2].terminal) {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        hc(["read", "--lines", "1000", it[2].terminal]).then((r) => {
          if (!r?.stdout) return;
          const clean = buildBoundedSessionTranscript(r.stdout);
          if (clean) copyText(clean, cx);
        }).catch(() => {});
        closeOverlay(overlayId);
        return;
      }
      // Hand Off to Another Agent (AgentSessionContinuationDialog.tsx:59)
      if (it[1] === "orca-menu.handoff") {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        openOverlay({
          mod: "orca-handoff",
          kind: "dialog",
          width: 480,
          height: 380,
          props: { action: "handoff", terminal: it[2].terminal, pane: it[2].pane }
        });
        closeOverlay(overlayId);
        return;
      }
      // Fork Agent Session (TerminalAgentSessionForkDialog.tsx:25)
      if (it[1] === "orca-menu.fork") {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        openOverlay({
          mod: "orca-handoff",
          kind: "dialog",
          width: 480,
          height: 320,
          props: { action: "fork", terminal: it[2].terminal, pane: it[2].pane }
        });
        closeOverlay(overlayId);
        return;
      }
      // Select All: Herdr cannot select, so the screen and scrollback buffer go to the clipboard (TerminalContextMenu.tsx:217).
      if (it[1] === "orca-menu.select-all" && it[2].terminal) {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        hc(["read", "--lines", "10000", it[2].terminal]).then((r) => {
          if (r?.code === 0 && r.stdout.trim()) copyText(r.stdout, cx);
        }).catch(() => {});
        closeOverlay(overlayId);
        return;
      }
      // Clear Screen / Reset Terminal: `hc` writes to the terminal; Ctrl+L clears the screen,
      // `reset` restores the terminal modes (TerminalContextMenu.tsx:359-369).
      if (it[1] === "orca-menu.clear-screen" && it[2].terminal) {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        void hc(["keys", it[2].terminal, "ctrl+l"]);
        closeOverlay(overlayId);
        return;
      }
      if (it[1] === "orca-menu.reset-terminal" && it[2].terminal) {
        if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
        void hc(["send", it[2].terminal, "reset"]);
        closeOverlay(overlayId);
        return;
      }
      closeOverlay(overlayId);
      return;
    }
    if (it[1] === "pane.swap") {
      if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
      run("pane.swap", { direction: it[2].direction, ...(it[2]?.pane ? { pane: it[2].pane } : {}) });
      closeOverlay(overlayId);
      return;
    }
    if (it[1] === "pane.zoom") {
      if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
      run("pane.zoom", it[2]);
      closeOverlay(overlayId);
      return;
    }
    if (it[1] === "pane.split") {
      // TerminalTabSplitMenuSection.tsx:37-39: activate inactive tab before splitting
      if (props()?.tab === "tab" && props()?.target?.id) {
        run("tab.select", { id: props().target.id });
      }
      if (it[2]?.pane) run("pane.focus", { pane: it[2].pane });
      run("pane.split", it[2]);
      closeOverlay(overlayId);
      return;
    }
    if (it[1] === "terminal.open" && props()?.tab === "space") {
      const tg = props()?.target ?? {};
      const isOpen = spaces().some((s) => s.id === tg.id);
      if (isOpen) {
        // Activate target space, then open the terminal tab in it (WorktreeRowOpenInSubMenu.tsx:11-28)
        run("space.select", { id: tg.id });
        run("terminal.open", it[2]);
        run("layout.select", { stack: "main", child: "main-terminals" });
      } else {
        // Unopened worktree card: create a space for it and switch to terminals layout
        // (matching orca-spaces/main.js:1062 & 1153)
        const targetFolder = it[2]?.folder || tg.folder || tg.top || tg.path;
        run("space.new", { ...(targetFolder ? { folder: targetFolder } : {}), ...(tg.machine ? { machine: tg.machine } : {}) });
        run("layout.select", { stack: "main", child: "main-terminals" });
      }
      closeOverlay(overlayId);
      return;
    }
    if (it[1] === "worktree") {
      openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
      closeOverlay(overlayId);
    } else if (it[1] === "tab.close") {
      // Close tab confirmation — terminal-tab-actions.ts:121-131 & running-terminal-close-guard.ts:56-97
      const owner = spaces().find((s) => (s.tabs ?? []).some((x) => x.id === it[2].id));
      const tab = (owner?.tabs ?? []).find((x) => x.id === it[2].id);
      if (tab) {
        if (tab.settled) {
          let skipPinned = false;
          try { skipPinned = localStorage.getItem("orca.confirmClosePinnedTab") === "false"; } catch {}
          if (!skipPinned) {
            const tabPanes = panes().filter((p) => p.tab === tab.id);
            const pane = tabPanes.find((p) => p.program?.agent) ?? tabPanes[0];
            const program = pane?.program;
            const name = tab.named ? (tab.name ?? "Terminal") : (pane?.title || program?.name || tab.name || "Terminal");
            openOverlay({
              mod: "orca-tabs",
              kind: "dialog",
              modal: true,
              width: 384,
              height: 200,
              props: { confirmClose: { kind: "pinned", tabId: tab.id, tabLabel: name } }
            });
            closeOverlay(overlayId);
            return;
          }
        }
        const tabPanes = panes().filter((p) => p.tab === tab.id);
        const isAgent = tabPanes.some((p) => p.program?.agent || p.status === "working" || p.status === "blocked") ||
                        tab.status === "working" || tab.status === "blocked";
        const isRunningCommand = tabPanes.some((p) => p.program && !p.program.shell && !p.program.agent);
        let skipRunning = false;
        try { skipRunning = localStorage.getItem("orca.skipCloseTerminalWithRunningProcessConfirm") === "true"; } catch {}
        if (!skipRunning && (isAgent || isRunningCommand)) {
          const pane = tabPanes.find((p) => p.program?.agent) ?? tabPanes[0];
          const program = pane?.program;
          const name = tab.named ? (tab.name ?? "Terminal") : (pane?.title || program?.name || tab.name || "Terminal");
          openOverlay({
            mod: "orca-tabs",
            kind: "dialog",
            modal: true,
            width: 384,
            height: isAgent ? 240 : 208,
            props: { confirmClose: { kind: isAgent ? "agent" : "command", tabId: tab.id, tabLabel: name } }
          });
          closeOverlay(overlayId);
          return;
        }
      }
      run("tab.close", it[2]);
      closeOverlay(overlayId);
    } else {
      run(it[1], it[2]);
      closeOverlay(overlayId);
    }
  }

  setTabColor(tabId, color) {
    if (!tabId) return;
    const cur = shared("tab.colors");
    const all = cur && typeof cur === "object" ? { ...cur } : stored("tab.colors.v1", {});
    if (color) all[tabId] = color;
    else delete all[tabId];
    try { localStorage.setItem("tab.colors.v1", JSON.stringify(all)); } catch {}
    setShared("tab.colors", all);
    closeOverlay(props()?.overlay);
  }

  render(cx) {
    const t = theme();
    const p = props();
    const tabId = p?.tab === "tab" ? (p.target?.id ?? null) : null;
    const tabColors = tabId ? (shared("tab.colors") ?? stored("tab.colors.v1", {})) : {};
    const activeTabColor = tabColors[tabId] ?? null;
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
        ...(p?.tab === "tab"
          ? [
              // SortableTabContextMenu.tsx:223-250: compact Tab Color palette (16px circular swatches).
              v_flex()
                .pt(6)
                .pr(10)
                .pb(6)
                .pl(32)
                .child(div().text_size(10).font_semibold().text_color(t.muted).mb(6).child("Tab Color"))
                .child(
                  h_flex()
                    .flex_wrap()
                    .gap(8)
                    .children(
                      TAB_COLORS.map(([name, val]) => {
                        const isSelected = activeTabColor === val;
                        return div()
                          .id(`tab-color-${name.toLowerCase()}`)
                          .size(16)
                          .rounded(8)
                          .cursor_pointer()
                          .tooltip(name)
                          .hover((s) => s.opacity(0.8))
                          .when(Boolean(val), (el) =>
                            el
                              .bg(val)
                              .border(isSelected ? 2 : 1)
                              .border_color(isSelected ? t.foreground : "#00000000")
                          )
                          .when(!val, (el) =>
                            el
                              .border(isSelected ? 2 : 1)
                              .border_color(isSelected ? t.foreground : t.muted)
                              .flex()
                              .items_center()
                              .justify_center()
                              .child(div().w(8).h(1).bg(t.muted))
                          )
                          .on_click((_e, _cx) => this.setTabColor(tabId, val));
                      })
                    )
                ),
            ]
          : []),
      ]);
  }
}
