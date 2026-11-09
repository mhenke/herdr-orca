// Derived from Herdr App's defaults/mods/agents/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Portions ported from Orca (MIT, Copyright (c) 2026 Lovecast Inc.); see NOTICE.
// Orca's StatusIndicator and AgentStateDot, copied from mods/orca-spaces/status.js because a mod
// draws alone and needs its own asset paths (AGENTS.md rule 9).
import { div, svg, image } from "gpui-kit";

// Orca's tokens (`main.css:254-258`): --agent-question orange-600, --agent-working yellow-500,
// done emerald-500, idle neutral-500 at 40%.
export const STATUS_COLORS = {
  blocked: "#ea580c",
  working: "#eab308",
  done: "#10b981",
  idle: "#73737366",
};

const box = (size) => div().size(size).flex_none().flex().items_center().justify_center();
const dot = (size, inner, color) => box(size).child(div().size(inner).rounded_full().flex_none().bg(color));

// `StatusIndicator.tsx`: a 12px box holding an 8px mark. `blocked` is Orca's permission glyph;
// `working` is the 8px ring (`AgentWorkingSpinner.tsx:38-41`), never a filled dot; `done` and
// `idle` are 8px dots, idle at 40% alpha.
export function statusMark(status, size = 12, colors = STATUS_COLORS) {
  const c = colors ?? STATUS_COLORS;
  if (status === "blocked") {
    return box(size).child(svg("mods/orca-pane/message-circle-question.svg").size(size).flex_none().text_color(c.blocked));
  }
  if (status === "working") {
    return box(size).child(svg("mods/orca-pane/agent-working-spinner.svg").size(8).flex_none().text_color(c.working).spin(1000));
  }
  return dot(size, 8, status === "done" ? c.done : c.idle);
}

// Orca's catalog marks (`agent-catalog.tsx:50-122`); same table as `orca-spaces`, `orca-tabs` and
// `orca-float`. `svg()` is a one-color mask, so marks that bring their own fills are images.
const OWN_FILLS = new Set(["omp", "droid", "kilo"]);
const AGENT_MARKS = {
  codex: "mono",
  omp: "mods/orca-pane/agent-icons/omp.svg",
  gemini: "mods/orca-pane/agent-icons/gemini.png",
  cursor: "mods/orca-pane/agent-icons/cursor.png",
  grok: "mods/orca-pane/agent-icons/grok.png",
  qoder: "mods/orca-pane/agent-icons/qoder.png",
  hermes: "mods/orca-pane/agent-icons/hermes.png",
  "dsh-tui": "mods/orca-pane/agent-icons/dsh.png",
  droid: "mods/orca-pane/agent-icons/droid.svg",
  kilo: "mods/orca-pane/agent-icons/kilo.svg",
  aider: "mods/orca-pane/agent-icons/aider.svg",
};

// `terminals()` names the agent's app in `report.app`, not `app`.
export function agentMark(term, size = 13, theme) {
  const over = AGENT_MARKS[term?.report?.app];
  const p = term?.program;
  if (over === "mono") return p?.icon ? svg(p.icon).size(size).flex_none().text_color(theme.muted) : null;
  if (over) return OWN_FILLS.has(term.report?.app) || !over.endsWith(".svg")
    ? image(over).w(size).h(size).flex_none()
    : svg(over).size(size).flex_none().text_color(theme.muted);
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(theme.muted) : image(p.icon).w(size).h(size).flex_none();
}
