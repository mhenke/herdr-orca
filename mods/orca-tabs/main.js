// Derived from Herdr App's defaults/mods/tabs/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, closeOverlay, props, theme, window as appWindow, shared, layout, settings, setShared, writeTextFile } from "herdr";

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

// --- Tab drop-to-split ------------------------------------------------------
// Orca paints `TabGroupDropOverlay` over half the panel while a tab is dragged
// (`TabPaneColumnSplitDragOverlay.tsx:11-54`) and picks the zone with
// `resolvePaneColumnEdgeZone` (`tab-drop-zone.ts:38-88`).
// Orca does not learn the pointer from the dragged tab either: its sensor listens on `document`
// for `pointermove`/`pointerup`/`pointercancel` (`tab-drag-pointer-sensor.ts:174-176`) and
// records the point globally (`tab-drag-pointer.ts:18`). This host also keeps the pointer itself:
// `window.mouse_position()` (`gpui-kit.d.ts:20498`, `window_api.rs:278`), readable from any view,
// terminal or not. So the drag is polled by a timer and carried by a frame-less overlay window
// that paints the quadrant and takes the release.
const STATUS_BAR_HEIGHT = 24; // `orca-status` draws this (`layouts/orca.json` node `status`).
const TAB_STRIP_FALLBACK = 32; // `TAB_GROUP_TAB_STRIP_HEIGHT_PX` (tab-drop-zone.ts:4), the fallback.
const DROP_STILL_TICKS = 8; // ~130ms of a motionless pointer is the release, since the host has no button state.
const TAB_DRAG_DISTANCE = 12; // `useTabDragSplit.ts:42` — dnd-kit activation distance, and how far down a press must travel before it is a split.
const DROP_REV = 9; // bumped every time the instrumentation changes
let dropSeq = 0;
function dropTrace(event, detail) {
  const path = `/tmp/drop-${String(Date.now())}-${dropSeq++}-${event}.json`;
  writeTextFile(path, JSON.stringify({ event, detail }, null, 1), null).catch(() => {});
}

// The tab column's rect, measured rather than assumed: the layout (this package's `orca` layout) sets `sidebar` to
// 280px and `status` to 24px, the strip reports its own top and height, and the rest is the
// viewport. A hidden rail contributes nothing (its node is skipped, `layout.rs:551`).
function panelRect(top, stripHeight) {
  const vp = typeof window !== "undefined" ? window.viewport_size() : null;
  if (!vp) return null;
  const root = layout();
  const sidebar = find(root, "sidebar"), panel = find(root, "panel");
  const zoom = settings()?.zoom || 1;
  const left = sidebar?.hidden ? 0 : (sidebar?.size?.px ?? 280) / zoom;
  const right = panel?.hidden ? 0 : (panel?.size?.px ?? 350) / zoom;
  // the layout's `status` node, so a resized or hidden bar stays right.
  const status = find(root, "status");
  const bottom = (status?.hidden ? 0 : (status?.size?.px ?? STATUS_BAR_HEIGHT)) / zoom;
  return {
    left,
    top,
    width: Math.max(0, vp.width - left - right),
    height: Math.max(0, vp.height - top - bottom),
    stripHeight,
  };
}


let dropDrag = null;
// `mods.rs:432` — `shared()` is the host's per-key store, one value every mod instance reads,
// and `set_shared` refreshes the views. Module memory is NOT shared: an overlay copy of this mod
// runs in its own realm, which is why the record lives here.
const DROP_KEY = "orca-tabs.drop";
function dragRecord() {
  return dropDrag ?? shared(DROP_KEY) ?? null;
}
function setDragRecord(value) {
  dropDrag = value;
  // `null` is a value too: it would leave the key in the host's shared store and block the next drag's
  // `!dragRecord()` guard after a restart. Clearing it with `undefined` drops the key.
  setShared(DROP_KEY, value ?? undefined);
}

// The poll writes here; the overlay's view reads it on its own tick and repaints. Two views of
// one module share `dropDrag`, and neither needs the other's `cx`.
function pollDrop(cx) {
  let last = null;
  cx.timer.every(16, (cx) => {
    if (!dropDrag) return;
    const at = typeof window !== "undefined" ? window.mouse_position() : null;
    if (!at) return;
    const s = dropDrag.strip;
    const panel = { left: s.x, top: s.y, width: s.width, height: s.height };
    // Inside the panel first, as Orca requires before asking for a zone
    // (`tab-group-panel-split-target.ts:210-218`).
    const inside = at.x >= panel.left && at.x <= panel.left + panel.width
      && at.y >= panel.top && at.y <= panel.top + panel.height;
    const zone = inside ? edgeZone(panel, at, s.stripHeight) : null;
    if (dropSeq < 6) dropTrace("poll", { at, zone });
    const moved = !last || last.x !== at.x || last.y !== at.y;
    // The overlay takes no pointer events for a press that started elsewhere (measured: no
    // `drop-move`, no `drop-up` for a real drag) and the host exposes no button state, so the
    // release is inferred: a pointer that stops moving, below the strip, is where it was let go.
    dropDrag.still = moved ? 0 : (dropDrag.still ?? 0) + 1;
    if (moved) {
      last = { x: at.x, y: at.y, zone };
      dropDrag.zone = zone;
      setShared(DROP_KEY, { ...dropDrag, pointer: { x: at.x, y: at.y } });
    }
    if (dropDrag.still >= DROP_STILL_TICKS && at.y > panel.top + s.stripHeight) {
      dropDrag.still = 0;
      dropResolve(zone);
    }
  });
}

// The drop, resolved by the view that saw the gesture (`tab-group-panel-split-target.ts:212-246`).
function dropResolve(zone) {
  dropTrace("resolve", { zone });
  const drag = dropDrag;
  if (!drag) return;
  const overlay = drag.overlay;
  setDragRecord(null);
  if (overlay) closeOverlay(overlay);
  if (!zone || !drag.pane) return;
  const before = new Set((panes() ?? []).map((p) => p.pane));
  run("pane.split", { direction: zone === "left" || zone === "right" ? "right" : "down", pane: drag.pane });
  if (zone === "left" || zone === "up") run("pane.swap", { direction: zone });
  const made = (panes() ?? []).find((p) => !before.has(p.pane));
  if (made && drag.terminal) run("terminal.show", { terminal: drag.terminal, pane: made.pane });
}

// The drag in flight: the tab it started from and the panel it aims at. Written through
// `DROP_KEY` above, because the overlay's copy of this mod is a separate realm.

// `tab-drop-zone.ts:38-88`, ported: a zone only in the outer bands, the strip left to
// reordering, and the middle of the panel meaning "no split".
function edgeZone(panel, point, stripHeight) {
  const localX = point.x - panel.left;
  const horizontalEdge = panel.width * 0.2;
  if (localX < horizontalEdge) return "left";
  if (localX > panel.width - horizontalEdge) return "right";
  const stripBottom = panel.top + stripHeight;
  if (point.y < stripBottom) return null;
  const bodyHeight = Math.max(0, panel.height - stripHeight);
  if (bodyHeight <= 0) return null;
  const bodyLocalY = point.y - stripBottom;
  const verticalEdge = bodyHeight * 0.2;
  if (bodyLocalY < verticalEdge) return "up";
  if (bodyLocalY > bodyHeight - verticalEdge) return "down";
  // Orca's bands leave the middle of the panel unclaimed because there the drop MERGES the tab
  // into that pane group (`resolveDropZone`'s 'center', `tab-drop-zone.ts:19-36`). Herdr has no
  // tab-group merge — a tab *is* its panes — so the centre has no action, and keeping it dead
  // makes most of the panel a no-op. The nearest edge wins instead; horizontal on a tie, which
  // is the preference Orca states in that same function.
  const toLeft = localX, toRight = panel.width - localX;
  const toUp = bodyLocalY, toDown = bodyHeight - bodyLocalY;
  const horizontal = Math.min(toLeft, toRight), vertical = Math.min(toUp, toDown);
  if (horizontal <= vertical) return toLeft <= toRight ? "left" : "right";
  return toUp <= toDown ? "up" : "down";
}

export default class Tabs extends View {
  init(_props, cx) {
    const p = _props?.confirmClose ? _props : props();
    // TEMPORARY: which copy of this mod is actually running. A drag that leaves no trace at all
    // then means "stale copy", not "handler never fired".
    dropTrace("load", {
      rev: DROP_REV,
      drop: Boolean(p?.drop),
      stale: Boolean(shared(DROP_KEY)),
      // The epoch the strip's copy loaded at, so a trace can be matched to a sync instead of
      // "some copy once loaded rev 8".
      from: "strip",
    });
    if (!p?.drop && shared(DROP_KEY)) setDragRecord(null);
    if (p?.confirmClose) {
      this.isDialog = true;
      this.dontAskAgain = false;
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    if (p?.drop) {
      // The drop overlay's copy: a frame-less window over the whole app, painting the panel
      // quadrant Orca paints (`TabPaneColumnSplitDragOverlay.tsx:11-54`).
      this.isDropOverlay = true;
      this.zone = null;
      this.handle = cx.focus_handle();
      this.handle.focus();
      // The strip's poll writes the pointer and the zone into module memory; this copy repaints
      // when either moves. Its own handlers also resolve the drop, so a release that arrives
      // here is never lost.
      cx.timer.after(300, (cx) => {
        const seen = dragRecord();
        dropTrace("overlay-alive", {
          seesRecord: Boolean(seen),
          key: shared(DROP_KEY) ? "set" : "unset",
          zone: seen?.zone ?? null,
        });
        cx.notify();
      });
      cx.timer.every(16, (cx) => {
        const drag = dragRecord();
        if (!drag) {
          if (this.zone !== null) { this.zone = null; cx.notify(); }
          return;
        }
        if (drag.zone === this.zone) return;
        this.zone = drag.zone;
        cx.notify();
      });
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
    this.windowState = appWindow();
    const seed = (cx, tries) => {
      const w = appWindow();
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
    const label = this.getTabLabel(c);

    // Pinned-tab guard: PinnedTabCloseDialog.tsx & pinned-tab-close-guard.ts:27-57.
    // Herdr's `settled` represents Orca's pinned tabs.
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

    // Running-agent/command guard: CloseTerminalDialog.tsx & running-terminal-close-guard.ts:56-97.
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

    run("tab.close", { id: c.id });
  }

  // Dialog ported from Orca: CloseTerminalDialog.tsx:101-184, PinnedTabCloseDialog.tsx:52-94,
  // and BULK_TAB_CLOSE_COPY (bulk-tab-close-confirmation.ts:5-15); layout follows dialog.tsx:139-163.
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
      // DialogHeader (dialog.tsx:139-147).
      .child(
        v_flex().gap(4)
          .child(div().text_size(14).font_semibold().text_color(t.foreground).child(title))
          .child(div().text_size(12).text_color(t.muted).child(desc))
      )
      // CloseTerminalDialog.tsx:132-139.
      .when(isAgent, el =>
        el.child(div().text_size(12).text_color(t.muted).child("This terminal will not resume automatically. Cancel and put the workspace to sleep to resume it later."))
      )
      // CloseTerminalDialog.tsx:140-144.
      .when(Boolean(cfg.tabLabel), el =>
        el.child(div().truncate().text_size(12).font_medium().text_color(t.foreground).child(cfg.tabLabel))
      )
      // CloseTerminalDialog.tsx:145-159 & PinnedTabCloseDialog.tsx:72-84.
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
      // DialogFooter (dialog.tsx:149-163).
      .child(
        h_flex().justify_end().gap(8)
          // Outline, size-sm.
          .child(
            h_flex().id("close-cancel").h(32).px(12).items_center().justify_center().rounded(6)
              .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground)
              .text_size(12).font_medium().cursor_pointer()
              .hover(s => s.bg(t.hover))
              .on_click((_e, _cx) => cancel())
              .child("Cancel")
          )
          // Destructive, size-sm.
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

  // `TabPaneColumnSplitDragOverlay.tsx:11-38` paints half the panel — a column half for
  // left/right, a row half for up/down — with `.tab-drop-overlay` (`terminal.css:205-213`):
  // an rgba(59,130,246,0.2) fill, a 2px rgba(59,130,246,0.5) border, 4px radius, no
  // transition. This window spans the whole app, so the half is drawn inside the panel column
  // the strip reported when the drag began.
  renderDrop(cx) {
    const t = theme();
    const drag = dragRecord() ?? this.drag;
    if (drag && this.zone !== drag.zone) this.zone = drag.zone;
    const box = drag?.strip;
    if (!box) return div().size_full();
    // The rect the strip measured: its top and height, the rails from the layout tree. The
    // overlay's own box is the whole window, so it is not asked for a size.
    const panel = { left: box.x, top: box.y, width: box.width, height: box.height };
    const zone = this.zone;
    // `TabPaneColumnSplitDragOverlay.tsx:11-38`, in the panel's own coordinates: the overlay is
    // the whole window here, so the half starts at the panel's origin instead of 0.
    const half = !zone ? null
      : zone === "up" ? { left: 0, top: 0, width: panel.width, height: panel.height / 2 }
      : zone === "down" ? { left: 0, top: panel.height / 2, width: panel.width, height: panel.height / 2 }
      : zone === "left" ? { left: 0, top: 0, width: panel.width / 2, height: panel.height }
      : { left: panel.width / 2, top: 0, width: panel.width / 2, height: panel.height };
    const at = half && { left: panel.left + half.left, top: panel.top + half.top };
    return div()
      .id("tab-drop")
      .track_focus(this.handle)
      .size_full()
      // A window would follow any press it isn't told to stop (herdr.d.ts OverlaySpec).
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_move((e, cx) => {
        const next = edgeZone(panel, e.position, box.stripHeight || TAB_STRIP_FALLBACK);
        dropTrace("drop-move", { panel, at: e.position, zone: next });
        if (next === this.zone) return;
        this.zone = next;
        cx.notify();
      })
      .on_mouse_up("left", (e) => { dropTrace("drop-up", { panel, at: e.position, zone: this.zone }); this.drop(); })
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        setDragRecord(null);
        closeOverlay(props()?.overlay);
        cx.notify();
      })
      .when(Boolean(half), (el) => el.child(div()
        .absolute().left(at.left).top(at.top).w(half.width).h(half.height)
        .bg("#3b82f633").border_2().border_color("#3b82f680").rounded(4)
        // `TabGroupDropOverlay.tsx:31-39` — the "New split" label, bottom-left.
        .child(div().absolute().bottom(8).left(8).px(6).py(2).rounded(2)
          .text_size(11).font_medium().text_color(t.solid_foreground).bg("#5b8def33")
          .child("New split"))));
  }

  // Herdr splits right and down only, so a left or up drop splits the other way and swaps the
  // new pane into place — the same pair `orca-split-menu` uses for its four directions
  // (`mods/orca-split-menu/main.js:52-70`). The dragged tab's terminal then fills that pane:
  // Herdr cannot move a tab into a tab (a tab *is* its panes), so `terminal.show` puts it
  // there while the source tab keeps running (commands.rs).
  // A release that reaches this layer resolves it directly; otherwise the strip's timer does
  // (`dropResolve`), because a press that began outside a window does not deliver here.
  drop() {
    const zone = this.zone;
    if (zone) dropResolve(zone);
    else { setDragRecord(null); closeOverlay(props()?.overlay); }
  }

  render(cx) {
    const p = props();
    if (this.isDialog || p?.confirmClose) {
      return this.renderConfirmDialog(cx);
    }
    if (this.isDropOverlay || p?.drop) {
      return this.renderDrop(cx);
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
      // TerminalTabLeadingIcon.tsx:31-45 — the agent's identity mark, `opacity-70` while the
      // tab is inactive. Orca's `AgentIcon` (`agent-catalog.tsx:50-122`) decides which mark an
      // agent has; what decides the drawing is whether it brings its own fills. omp's gradient
      // (`agent-icon-glyphs.tsx:30-62`), Droid's white-on-black (`status-bar/icons.tsx:343-366`),
      // Kilo's yellow/black and the bundled favicons keep theirs, so they are images — `svg()` is
      // a one-color mask (gpui-kit.d.ts:20273-20281) and greys them. A currentColor glyph (Codex,
      // Pi, Aider, OpenCode, Copilot) takes the text color instead. An agent Orca names no mark
      // for falls back to the program table's own icon. `mods/orca-spaces` draws the same table:
      // a mod cannot reach another's files, so each carries its own copies.
      const ownFills = new Set(["omp", "droid", "kilo"]);
      const agentMarks = {
        codex: "mono",
        omp: "mods/orca-tabs/agent-icons/omp.svg",
        gemini: "mods/orca-tabs/agent-icons/gemini.png",
        cursor: "mods/orca-tabs/agent-icons/cursor.png",
        grok: "mods/orca-tabs/agent-icons/grok.png",
        qoder: "mods/orca-tabs/agent-icons/qoder.png",
        hermes: "mods/orca-tabs/agent-icons/hermes.png",
        "dsh-tui": "mods/orca-tabs/agent-icons/dsh.png",
        droid: "mods/orca-tabs/agent-icons/droid.svg",
        kilo: "mods/orca-tabs/agent-icons/kilo.svg",
        aider: "mods/orca-tabs/agent-icons/aider.svg",
      };
      const mark = agentMarks[pane?.app];
      let identity = null;
      if (mark === "mono") identity = program?.icon ? svg(program.icon).size(12).text_color(t.muted) : null;
      else if (mark) identity = ownFills.has(pane?.app) || !mark.endsWith(".svg")
        ? image(mark).size(12)
        : svg(mark).size(12).text_color(t.muted);
      else if (program?.icon) identity = program.tint ? svg(program.icon).size(12).text_color(t.muted) : image(program.icon).size(12);
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
        // Tab reordering — SortableTab.tsx:213 and tab-drag-drop-commit.ts:116-126. Dragging along
        // the strip reorders via `tab.move`. A press that travels 12px or more hands the drag to
        // the drop overlay instead (`edgeZone`, `renderDrop`), because these handlers stop at the
        // tab rail — see ADR 0007 "Tab Drop-To-Split".
        .on_mouse_down("left", (e, cx) => {
          cx.stop_propagation();
          this.pressed = i;
          this.overTab = c.id;
          this.overSide = null;
          // What a drop past the strip would carry, and where the press began.
          this.pressAt = e.position;
          this.dragTab = c.id;
          this.dragTerminal = pane?.terminal ?? null;
          this.dragPane = pane?.pane ?? null;
          if (e.click_count === 2) run("tab.rename", { id: c.id });
          cx.notify();
        })
        .on_mouse_move((e, cx) => {
          // TEMPORARY: which guard stops the hand-off.
          if (this.pressed !== null && this.pressAt) {
            dropTrace("move", {
              i, pressed: this.pressed, dy: e.position.y - this.pressAt.y,
              busy: Boolean(dropDrag), hasBounds: Boolean(e.bounds?.width),
            });
          }
          // A press on this tab that travels down past Orca's activation distance becomes a
          // panel drop. The pointer is about to leave this block, so a frame-less overlay over
          // the whole app takes over: it paints the quadrant and receives the release.
          if (this.pressed === i && !dragRecord() && this.pressAt) {
            const box = e.bounds;
            const rect = box?.width ? panelRect(box.y, box.height) : null;
            if (box && rect && e.position.y - this.pressAt.y >= TAB_DRAG_DISTANCE) {
              setDragRecord({
                tab: c.id,
                terminal: this.dragTerminal,
                pane: this.dragPane,
                strip: { x: rect.left, y: rect.top, width: rect.width, height: rect.stripHeight },
              });
              this.pressed = null;
              this.overTab = null;
              this.overSide = null;
              dropTrace("handoff", { press: this.pressAt, at: e.position, rect });
              dropDrag.overlay = openOverlay({
                mod: "orca-tabs",
                // `popup`, not `window`: a popup accepts Esc and `overlay.close`
                // (OverlayKind::modal_keys), so a release this layer misses can never leave a
                // full-window sheet over the app.
                kind: "popup",
                frame: "none",
                at: { x: 0, y: 0 },
                width: 1,
                height: 1,
                props: { drop: true },
              });
              setShared(DROP_KEY, { ...dropDrag });
              // The pointer, not the element: this view's own timer keeps running after the
              // pointer leaves the strip (measured), and `window.mouse_position()` keeps
              // reporting. That is this host's stand-in for Orca's `document` listener
              // (`tab-drag-pointer-sensor.ts:174-176`).
              pollDrop(cx);
              cx.notify();
              return;
            }
          }
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
        // TerminalTabLeadingIcon.tsx:72-103 — the activity mark (`AgentStateDot`) comes first,
        // then the agent's identity, and only the identity is `opacity-70` on an inactive tab
        // (:44-50). working = the agent-working spinner, done = CircleCheck in emerald-500,
        // blocked — Herdr's word for a waiting agent — = AgentQuestionIcon, a
        // MessageCircleQuestion in --agent-question. A bare dot is Orca's idle mark only.
        .when(c.status === "working", el => el.child(svg("mods/orca-tabs/spinner.svg").size(12).flex_none().text_color("#eab308").spin(1000)))
        .when(c.status === "done", el => el.child(svg("mods/orca-tabs/circle-check.svg").size(12).flex_none().text_color("#10b981")))
        .when(c.status === "blocked", el => el.child(svg("mods/orca-tabs/message-circle-question.svg").size(12).flex_none().text_color("#ea580c")))
        // `src/renderer/src/components/AgentStateDot.tsx:186-195` — idle is a plain dot, not a glyph: `size-2` (8px)
        // `rounded-full` in `bg-neutral-500/40` inside the md `h-3 w-3` (12px) box.
        .when(c.status === "idle", el => el.child(div().size(12).flex_none().flex().items_center().justify_center()
          .child(div().size(8).rounded(4).bg("#73737366"))))
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
    const live = appWindow();
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
        // A release back over the strip cancels a drop the overlay never took.
        const live = dragRecord();
        if (live?.overlay) closeOverlay(live.overlay);
        setDragRecord(null);
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
