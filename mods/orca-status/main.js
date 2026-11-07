// Orca's bottom bar: three zones over real state only.
// Left: command palette. Middle: provider quota (Herdr has none -> shown as
// unavailable), update state, machine warnings. Right: machine, agents.
// The 1px separators are Herdr's own grouping: Orca's bar has none.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, machines, updates, theme, run } from "herdr";

export default class OrcaStatus extends View {

  render() {
    const t = theme();
    const space = (spaces() ?? []).find(s => s.active);
    const list = agents() ?? [];
    const working = list.filter(a => a.status === "working").length;
    const blocked = list.filter(a => a.status === "blocked").length;
    const down = (machines() ?? []).filter(m => m.layout !== "ready").length;
    const up = updates();
    // Herdr-only: Orca's bar has no left action; this one opens the palette.
    // Orca's segment icons are `size-3 text-muted-foreground` (UpdateStatusSegment.tsx:31,47,58,74,91).
    const icon = (id, name, tip, on) => div().id(id).size(20).flex_none().flex().items_center().justify_center().rounded(4)
      .text_color(t.muted).hover(s => s.bg("#404040b3").text_color(t.foreground))
      .role("button").accessibility_label(tip).cursor_pointer().on_click(on)
      .child(svg(`mods/orca-status/${name}.svg`).size(12));
    const sep = () => div().w(1).h(12).bg(t.border);
    const dot = (color) => div().size(6).rounded(3).bg(color);
    // Orca status segments share one shape: gap-1.5 px-1 py-0.5 rounded, a 12px
    // glyph and an 11px label, hover:bg-accent/70 (UpdateStatusSegment.tsx:115-122).
    // The label carries no colour class, so it inherits the bar's #f0f0f0.
    const item = (iconName, text, on) => h_flex().gap(6).px(4).py(2).rounded(4).items_center().text_size(11).text_color(t.foreground)
      .when(Boolean(on), el => el.id(`st-${text}`).cursor_pointer().hover(s => s.bg("#404040b3")).on_click(on))
      .child(svg(`mods/orca-status/${iconName}.svg`).size(12).text_color(t.muted)).child(text);

    // StatusBarSurface.tsx:120-121 — `h-6 px-3 gap-4 border-t bg-[var(--bg-titlebar,var(--card))]`
    // with no root text colour, so text inherits #f0f0f0 (main.css:338). #171717 = t.surface.
    return h_flex().size_full().px(12).gap(16).items_center().bg(t.surface).border_t(1).border_color(t.border).text_size(12).text_color(t.foreground)
      // Left: app-level actions.
      .child(icon("st-palette", "settings", "Command palette", () => run("app.palette")))
      .child(sep())
      // Middle: provider quota — Herdr has no quota integration, so it is
      // shown as unavailable, never as 0.
      .child(item("layers", "quota —"))
      .child(up?.checking ? item("clock", "checking updates")
        : up?.app?.ready ? h_flex().gap(6).px(4).py(2).rounded(4).items_center().text_size(11).text_color(t.done).cursor_pointer().hover(s => s.bg("#404040b3")).on_click(() => run("app.settings")).child(svg("mods/orca-status/circle-check.svg").size(12).text_color(t.done)).child(`update ${up.app.ready} — restart`)
        : up?.app?.version ? item("circle-check", `v${up.app.version}`) : null)
      // Orca marks this warning with text-yellow-500 (UpdateStatusSegment.tsx:91);
      // t.blocked is the red-orange destructive colour and is wrong here.
      .when(down > 0, el => el.child(h_flex().gap(6).px(4).py(2).rounded(4).items_center().text_size(11).text_color("#eab308").child(svg("mods/orca-status/unlink.svg").size(12)).child(`${down} machine${down === 1 ? "" : "s"} away`)))
      .child(div().flex_1())
      // Right: machine and agents — Herdr's own, kept.
      .child(item(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .child(sep())
      .child(h_flex().gap(6).px(4).py(2).rounded(4).items_center().text_size(11).cursor_pointer().hover(s => s.bg("#404040b3").text_color(t.foreground))
        .on_click(() => run(working || blocked ? "agent.next" : "mod.open", working || blocked ? {} : { name: "agents" }))
        .child(dot(blocked ? t.blocked : working ? t.working : t.idle))
        .child(`${list.length} agent${list.length === 1 ? "" : "s"}`)
        .when(working > 0, el2 => el2.child(div().text_color(t.working).child(`${working} working`)))
        .when(blocked > 0, el2 => el2.child(div().text_color(t.blocked).child(`${blocked} blocked`))));
  }
}
