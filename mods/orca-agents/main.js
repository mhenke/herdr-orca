// The vault panel: Orca's "Agents" activity entry, drawn from live Herdr agents.
//
// Orca's vault scans agent transcripts on disk, then offers search, group/sort, host scope,
// session details and resume (AiVaultPanel.tsx, AiVaultPanelHeader.tsx). Herdr has no
// transcript scanner, so this port lists the agents that are live now (`agents()`,
// herdr.d.ts:183) — a real list from the host model, not a stub.
// Scope switch (Workspace / Project / All) ports `VaultScopeSwitch` (AiVaultPanelControls.tsx:87-160),
// search filter ports `AiVaultPanelHeader.tsx:161-202`, and session count bar ports `AiVaultSessionListBar.tsx:50-54`.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Input, InputState } from "gpui-base";
import { agents, spaces, run, theme } from "herdr";

function fade(color, factor) {
  if (!color || typeof color !== "string") return "#00000000";
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) : 255;
  return color.slice(0, 7) + Math.round(alpha * factor).toString(16).padStart(2, "0");
}

// The identity glyph comes from the app's program table (`Program.icon`, herdr.d.ts:150):
// tinted glyphs are SVGs, others are pictures — the same pair the shipped agents mod uses.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// Orca's row title falls back through title -> app -> program name; `program.agent` is a
// boolean, never a name (orca-spaces/main.js:759-763).
const title = (a) => a.title?.trim() || a.app || a.program?.name || "Agent";

// `AgentStateDot` at its default `sm` size (`src/renderer/src/components/AgentStateDot.tsx:105-197`):
// a 10px box (`h-2.5 w-2.5`), a 6px inner dot (`size-1.5`), a 10px glyph (`size-2.5`). Statuses map
// to Herdr's 4-state rollup: working (AgentWorkingSpinner turning 1000ms in t.working),
// blocked (AgentQuestionIcon message-circle-question in t.blocked), done (CircleCheck in
// t.done), and idle (6px dot in t.idle + "66").
function stateDot(status, t) {
  const box = div().size(10).flex_none().flex().items_center().justify_center();
  if (status === "working") {
    return box.child(svg("mods/orca-agents/agent-working-spinner.svg").size(10).flex_none().text_color(t.working).spin(1000));
  }
  if (status === "blocked") {
    return box.child(svg("mods/orca-agents/message-circle-question.svg").size(10).flex_none().text_color(t.blocked));
  }
  if (status === "done") {
    return box.child(svg("mods/orca-agents/circle-check.svg").size(10).flex_none().text_color(t.done));
  }
  return box.child(div().size(6).rounded_full().flex_none().bg(t.idle + "66"));
}

export default class AgentsPanel extends View {
  init(_props, cx) {
    this.seen = "";
    this.scope = "workspace"; // "workspace" | "project" | "all" (AiVaultPanelControls.tsx:87-160)
    this.search = InputState.new({ placeholder: "Search agents…" });
    this.search.on("change", (_e, cx) => cx.notify());

    // `agents()` is live but a status change does not notify a mod; orca-spaces repaints from
    // a timer for exactly this reason (main.js:123-133). One second is enough for a label.
    cx.timer.every(1000, (cx) => {
      const now = (agents() ?? []).map((a) => `${a.address}:${a.status}`).join(",");
      if (now === this.seen) return;
      this.seen = now;
      cx.notify();
    });
  }

  // `AiVaultSessionRow.tsx:155-159`: `flex w-full min-w-0 cursor-pointer flex-col border-b
  // border-sidebar-border px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/55`.
  // Orca's `min-h-[98px]` covers the conversation preview, message counts, time and model;
  // agents() carries none of those, so this row is only its two real lines.
  row(a, t) {
    return h_flex().id(`agent-${a.address}`).w_full().min_w(0).flex_none().px(12).py(8).gap(6).items_start()
      .border_b(1).border_color(t.border).cursor_pointer().hover((s) => s.bg(t.hover))
      .role("button").accessibility_label(`${title(a)} — ${a.status}`)
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .child(v_flex().flex_1().min_w(0)
        // `AiVaultSessionRow.tsx:163-172`: `text-[13px] font-medium leading-5 text-foreground`,
        // clamped to one line while details are collapsed.
        .child(div().min_w(0).truncate().text_size(13).font_medium().line_height("20px").text_color(t.foreground).child(title(a)))
        // `ai-vault-session-row-display.tsx:55-65`: `mt-1 grid grid-cols-[auto_minmax(0,1fr)]
        // gap-x-1.5 text-[11px] leading-4 text-muted-foreground`, the identity glyph in a
        // `size-4` slot at `size={14}`, then the state dot and the agent label.
        .child(h_flex().mt(4).gap(6).items_center().text_size(11).line_height("16px").text_color(t.muted)
          .child(h_flex().size(16).flex_none().items_center().justify_center().child(icon(a.program, 14, t.muted)))
          .child(stateDot(a.status, t))
          .child(div().min_w(0).truncate().child(a.app || a.program?.name || "agent"))
          // Herdr's real metadata where Orca shows message count, subagent count, time and
          // model: the space and tab the live agent belongs to.
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().min_w(0).truncate().child(a.space_name || a.space))
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().min_w(0).truncate().child(a.tab_name || `tab ${a.tab_index}`))));
  }

  // Ports Orca's `VaultScopeSwitch` (AiVaultPanelControls.tsx:87-160): ToggleGroup outline variant,
  // h-7 rounded-md border border-sidebar-border bg-sidebar-accent/35 shadow-xs (VAULT_SCOPE_TOGGLE_ITEM_CLASS:55).
  scopeSwitch(scope, workspaceAvailable, projectAvailable, t, cx) {
    const seg = (key, label, available) => {
      const active = scope === key;
      return div().id(`vault-scope-${key}`).flex_1().min_w(0).h(24).flex().items_center().justify_center()
        .rounded(4).px(6).text_size(11).font_medium()
        .when(active, (e) => e.bg(fade(t.foreground, 0.1)).text_color(t.foreground).border_1().border_color(t.border))
        .when(!active && available, (e) => e.text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .when(!available, (e) => e.text_color(t.dim).opacity(0.4))
        .on_click((_e, cx) => {
          if (!available || this.scope === key) return;
          this.scope = key;
          cx.notify();
        })
        .child(label);
    };

    return h_flex().w_full().p(2).gap(2).rounded(6).border_1().border_color(t.border).bg(fade(t.raised, 0.4))
      .child(seg("workspace", "Workspace", workspaceAvailable))
      .child(seg("project", "Project", projectAvailable))
      .child(seg("all", "All", true));
  }

  // Ports Orca's search bar in `AiVaultPanelHeader.tsx:161-202`: h-8 rounded-md border border-sidebar-border
  // bg-input/50 px-2 with Search glyph and clear button.
  searchBar(t, cx) {
    const q = this.search.value();
    return h_flex().w_full().h(30).px(8).gap(6).items_center().rounded(6)
      .border_1().border_color(t.border).bg(fade(t.input, 0.4))
      .child(svg("mods/orca-agents/search.svg").size(13).flex_none().text_color(t.muted))
      .child(Input.new(this.search).flex_1().min_w(0).text_size(12).text_color(t.foreground).bg("#00000000"))
      .when(Boolean(q), (e) => e.child(
        div().id("agents-search-clear").size(18).flex_none().flex().items_center().justify_center()
          .rounded(4).cursor_pointer().text_color(t.muted).hover((s) => s.text_color(t.foreground).bg(t.hover))
          .on_click((_e, cx) => {
            this.search.set_value("");
            cx.notify();
          })
          .child(svg("mods/orca-agents/x.svg").size(12))
      ));
  }

  render(cx) {
    const t = theme();
    const rawList = agents() ?? [];
    const sp = spaces() ?? [];
    const activeSpace = sp.find((s) => s.active);
    const workspaceAvailable = Boolean(activeSpace);
    const projectFolder = activeSpace?.folder;
    const projectAvailable = Boolean(projectFolder);

    let effectiveScope = this.scope;
    if (effectiveScope === "workspace" && !workspaceAvailable) {
      effectiveScope = projectAvailable ? "project" : "all";
    } else if (effectiveScope === "project" && !projectAvailable) {
      effectiveScope = "all";
    }

    // Filter by scope (AiVaultPanel.tsx:140-148)
    let filtered = rawList;
    if (effectiveScope === "workspace" && activeSpace) {
      filtered = filtered.filter((a) => a.space === activeSpace.id);
    } else if (effectiveScope === "project" && projectFolder) {
      filtered = filtered.filter((a) => {
        const s = sp.find((x) => x.id === a.space);
        const folder = s?.folder;
        return folder && (folder === projectFolder || folder.startsWith(projectFolder + "/") || projectFolder.startsWith(folder + "/"));
      });
    }

    // Filter by search query (AiVaultPanel.tsx:168-170, AiVaultPanelSearch.tsx:75-140)
    const q = this.search.value().trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((a) => {
        const name = title(a).toLowerCase();
        const app = (a.app || a.program?.name || "").toLowerCase();
        const spName = (a.space_name || a.space || "").toLowerCase();
        const tabName = (a.tab_name || "").toLowerCase();
        return name.includes(q) || app.includes(q) || spName.includes(q) || tabName.includes(q);
      });
    }

    return v_flex().id("agents").size_full().min_h(0).overflow_hidden().text_color(t.foreground)
      // `AiVaultPanelHeader.tsx:97-119`: Header with title, subtitle, scope switch, and search
      .child(v_flex().flex_none().px(10).py(8).gap(8).border_b(1).border_color(t.border)
        .child(v_flex().w_full().min_w(0)
          .child(div().truncate().text_size(12).font_semibold().child("Agents"))
          .child(div().truncate().text_size(11).text_color(t.muted).child("Live agent sessions")))
        .child(this.scopeSwitch(effectiveScope, workspaceAvailable, projectAvailable, t, cx))
        .child(this.searchBar(t, cx)))
      // `AiVaultSessionListBar.tsx:50-54`: `flex h-8 shrink-0 items-center gap-2 border-y
      // border-sidebar-border bg-sidebar-accent/60 pl-3 pr-1.5`, 12px semibold count.
      .child(h_flex().h(32).flex_none().items_center().pl(12).pr(6).border_b(1)
        .border_color(t.border).bg(fade(t.raised, 0.6))
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold()
          .child(`${filtered.length} agent${filtered.length === 1 ? "" : "s"}`)))
      .child(v_flex().id("agents-list").flex_1().min_h(0).overflow_y_scrollbar()
        .children(filtered.map((a) => this.row(a, t)))
        // `AiVaultSessionListStates.tsx:39-42`: centered empty state with icon and contextual copy
        .when(!filtered.length, (el) => {
          let msg = "No live agents";
          if (q) msg = `No agents match "${this.search.value().trim()}"`;
          else if (effectiveScope === "workspace") msg = "No live agents in current workspace";
          else if (effectiveScope === "project") msg = "No live agents in current project";
          return el.child(v_flex().size_full().items_center().justify_center().px(16).text_color(t.muted)
            .child(div().mb(12).opacity(0.5).child(svg("mods/orca-agents/archive-restore.svg").size(28)))
            .child(div().text_size(14).font_medium().text_center().child(msg)));
        }));
  }
}
