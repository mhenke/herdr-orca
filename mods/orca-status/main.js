// Orca's bottom bar: three zones over real state only.
// Left: palette hint. Middle: provider quota (Herdr has none -> shown as
// unavailable), update state, machine warnings. Right: machine, agents.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, machines, updates, theme, run, window, keys } from "herdr";

export default class OrcaStatus extends View {
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const key = b && b.keys.split("-").map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const working = list.filter(a => a.status === "working").length;
    const blocked = list.filter(a => a.status === "blocked").length;
    const down = machines().filter(m => m.layout !== "ready").length;
    const up = updates();
    const icon = (id, name, tip) => div().id(id).size(20).flex_none().flex().items_center().justify_center().rounded(3)
      .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .child(svg(`mods/orca-status/${name}.svg`).size(12));
    const sep = () => div().w(1).h(12).bg(t.border);
    const dot = (color) => div().size(6).rounded(3).bg(color);
    const item = (iconName, text, on) => h_flex().gap(5).items_center().text_color(t.muted)
      .when(Boolean(on), el => el.id(`st-${text}`).cursor_pointer().hover(s => s.text_color(t.foreground)).on_click(on))
      .child(svg(`mods/orca-status/${iconName}.svg`).size(12).text_color(t.dim)).child(text);

    return h_flex().size_full().px(12).gap(16).items_center().bg("#171717").border_t(1).border_color(t.border).text_size(12).text_color(t.muted)
      // Left: app-level actions.
      .child(icon("st-palette", "settings", "Command palette")).on_click(() => run("app.palette"))
      .child(sep())
      // Middle: provider quota — Herdr has no quota integration, so it is
      // shown as unavailable, never as 0.
      .child(item("layers", "quota —"))
      .child(up?.checking ? item("clock", "checking updates")
        : up?.app?.ready ? h_flex().gap(5).items_center().text_color(t.done).cursor_pointer().hover(s => s.opacity(0.85)).on_click(() => run("app.settings")).child(svg("mods/orca-status/circle-check.svg").size(12).text_color(t.done)).child(`update ${up.app.ready} — restart`)
        : up?.app?.version ? item("circle-check", `v${up.app.version}`) : null)
      .when(down > 0, el => el.child(h_flex().gap(5).items_center().text_color(t.blocked).child(svg("mods/orca-status/unlink.svg").size(12)).child(`${down} machine${down === 1 ? "" : "s"} away`)))
      .child(div().flex_1())
      // Right: machine and agents — Herdr's own, kept.
      .child(item(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .child(sep())
      .child(h_flex().gap(5).items_center().cursor_pointer().hover(s => s.text_color(t.foreground))
        .on_click(() => run(working || blocked ? "agent.next" : "mod.open", working || blocked ? {} : { name: "agents" }))
        .child(dot(blocked ? t.blocked : working ? t.working : t.idle))
        .child(`${list.length} agent${list.length === 1 ? "" : "s"}`)
        .when(working > 0, el2 => el2.child(div().text_color(t.working).child(`${working} working`)))
        .when(blocked > 0, el2 => el2.child(div().text_color(t.blocked).child(`${blocked} blocked`))));
  }
}
