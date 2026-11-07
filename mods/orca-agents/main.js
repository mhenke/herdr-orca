// The vault panel: Orca's "Agents" activity entry, drawn from live Herdr agents.
//
// Orca's vault scans agent transcripts on disk, then offers search, group/sort, host scope,
// session details and resume (`AiVaultPanel.tsx`, `AiVaultPanelHeader.tsx`). Herdr has no
// transcript scanner, so this port lists the agents that are live now (`agents()`,
// herdr.d.ts:183) — a real list from the host model, not a stub. Named divergences: no
// history, search, sort menu, host scope, refresh control or resume; a row focuses its agent
// instead (`agent.focus`, herdr.d.ts:68).
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, run, theme } from "herdr";

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
    // `agents()` is live but a status change does not notify a mod; orca-spaces repaints from
    // a timer for exactly this reason (main.js:123-133). One second is enough for a label.
    this.seen = "";
    cx.timer.every(1000, (cx) => {
      const now = agents().map((a) => `${a.address}:${a.status}`).join(",");
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

  render() {
    const t = theme();
    const list = agents() ?? [];
    return v_flex().id("agents").size_full().min_h(0).overflow_hidden().text_color(t.foreground)
      // `AiVaultPanelHeader.tsx:97-119`: `border-b border-sidebar-border px-2.5 py-2` (10px/8px),
      // a 12px semibold title and an 11px muted subtitle. Orca's title is "Agent Session
      // History" and its subtitle "Resume past sessions"; this list has no history to resume.
      .child(h_flex().flex_none().px(10).py(8).gap(6).items_center().border_b(1).border_color(t.border)
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12).font_semibold().child("Agents"))
          .child(div().truncate().text_size(11).text_color(t.muted).child("Live agent sessions"))))
      // `AiVaultSessionListBar.tsx:59-62`: `flex h-8 shrink-0 items-center gap-2 border-y
      // border-sidebar-border bg-sidebar-accent/60 pl-3 pr-1.5`, 12px semibold count.
      // Orca's sort dropdown (`AiVaultPanelHeader.tsx:121-125`) has no Herdr equivalent:
      // agents() is in model order.
      .child(h_flex().h(32).flex_none().items_center().pl(12).pr(6).border_t(1).border_b(1)
        .border_color(t.border).bg(t.raised + "99")
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold()
          .child(`${list.length} agent${list.length === 1 ? "" : "s"}`)))
      .child(v_flex().id("agents-list").flex_1().min_h(0).overflow_y_scrollbar()
        .children(list.map((a) => this.row(a, t)))
        // `AiVaultSessionListStates.tsx:39-42`: centered, `px-4`, `text-muted-foreground`,
        // a 28px glyph at 50% opacity, then `text-sm font-medium`.
        .when(!list.length, (el) => el.child(v_flex().size_full().items_center().justify_center().px(16).text_color(t.muted)
          .child(div().mb(12).opacity(0.5).child(svg("mods/orca-agents/archive-restore.svg").size(28)))
          .child(div().text_size(14).font_medium().child("No live agents")))));
  }
}