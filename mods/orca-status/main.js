// Derived from Herdr App's defaults/mods/spaces/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Portions ported from Orca (MIT, Copyright (c) 2026 Lovecast Inc.); see NOTICE.
// Orca's bottom bar (StatusBarSurface.tsx:121,136,308-370): provider usage on the
// left (flex-1), maintenance segments right-aligned with 12px gaps, an invisible
// visibility-menu trigger last.
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { machines, updates, theme, run, exec, readTextFile, shared, keys } from "herdr";
import { probeAllProviders } from "./usage.js";

export default class OrcaStatus extends View {

  init(_props, cx) {
    this.usage = null;
    this.isRefreshing = false;
    this.refreshUsage(cx);
    // Orca's 120s polling interval (service-polling.ts:24-32, DEFAULT_POLL_MS)
    cx.timer.every(120000, (cx) => this.refreshUsage(cx));
  }

  refreshUsage(cx) {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    cx.notify();

    cx.spawn(async (cx) => {
      try {
        const results = await probeAllProviders({ exec, readTextFile });
        this.usage = results;
      } catch {
        // Retain prior state on failure
      } finally {
        this.isRefreshing = false;
        cx.notify();
      }
    });
  }

  render(cx) {
    const t = theme();
    const up = updates();
    const openSettings = (section) => () => run("app.settings", { section });

    // Orca's SSH segment hides when no host is configured and otherwise shows the
    // connected count in muted 11px text (SshStatusSegment.tsx:170,177,209-221).
    const hosts = (machines() ?? []).filter(m => m.name !== null);
    const connected = hosts.filter(m => m.layout === "ready").length;
    // machines() stays "loading" until its first read (herdr.d.ts:22323); counting
    // before that would flash "0 hosts" on every start.
    const hostsKnown = hosts.length > 0 && !hosts.some(m => m.layout === "loading");

    // StatusBarSurface.tsx:330-366 — the floating-workspace toggle at the maintenance row's
    // end: a 20px (`size-5`) outlined button around the 14px (`size-3.5`) PanelsTopLeft glyph,
    // with a 6px amber dot (`size-1.5 bg-amber-500 ring-1 ring-secondary`) while the panel is
    // closed with activity the person has not seen (`use-status-bar-controller.ts:216`).
    // Orca reads both flags from its store; Herdr mods share none, so orca-float publishes them
    // and the bar reads them back (AGENTS.md rule 10).
    const floatOpen = shared("orca-float.open") === true;
    const floatAttention = !floatOpen && shared("orca-float.attention") === true;
    const floatLabel = floatOpen ? "Minimize Floating Workspace" : "Show Floating Workspace";
    const floatChord = (keys() ?? []).find(k => k.action === "orca-float.toggle")?.keys ?? "";

    // Orca segment shape: gap-1.5 px-1 py-0.5 rounded, 12px glyph, 11px label,
    // hover:bg-accent/70 (UpdateStatusSegment.tsx:115-122); the label keeps #f0f0f0.
    const segment = (id, iconName, label, opts = {}) => h_flex()
      .id(id).gap(6).px(4).py(2).rounded(4).items_center().text_size(11)
      .text_color(opts.muted ? t.muted : t.foreground)
      .when(Boolean(opts.on), el => el.role("button").accessibility_label(label).tooltip(label)
        .cursor_pointer().hover(s => s.bg("#404040b3").text_color(t.foreground)).on_click(opts.on))
      .child(svg(`mods/orca-status/${iconName}.svg`).size(12).flex_none()
        .text_color(opts.iconColor ?? t.muted)
        .when(Boolean(opts.spin), el => el.spin(1000)))
      .child(label);

    const usage = this.usage;
    const agy = usage?.antigravity;
    const claude = usage?.claude;
    const codex = usage?.codex;
    const cursor = usage?.cursor;

    // StatusBarSurface.tsx:121 — h-6 min-h-[24px] px-3 gap-4 border-t, text-xs,
    // bg-[var(--bg-titlebar,var(--card))] = t.surface (#171717).
    return h_flex().w_full().h(24).min_h(24).flex_none().px(12).gap(16).items_center()
      .bg(t.surface).border_t(1).border_color(t.border).text_size(12).text_color(t.foreground)
      // StatusBarSurface.tsx:136 — left usage cluster: flex min-w-0 flex-1 items-center
      .child(
        h_flex().flex_1().min_w(0).items_center().gap(12)
          .child(
            h_flex().gap(12).items_center().px(4).py(2).rounded(4).text_size(11)
              .role("button").cursor_pointer().hover(s => s.bg("#404040b3"))
              // usage-unit-label.tsx:32-50: "Used" in muted text
              .child(div().text_color(t.muted).child("Used"))
              // Pending initial loading state: ProviderIcon + ··· (StatusBarProviderSegment.tsx:267-274)
              .when(!usage, el => el
                .child(
                  h_flex().gap(6).items_center().text_color(t.muted)
                    .child(image("mods/orca-status/antigravity.png").w(13).h(13).flex_none().rounded(2))
                    .child(div().child("···"))
                )
                .child(
                  h_flex().gap(4).items_center().text_color(t.muted)
                    .child(svg("mods/orca-status/claude.svg").size(13).flex_none())
                    .child(div().child("···"))
                )
              )
              // Antigravity active chip (StatusBarProviderSegment.tsx:315-339)
              .when(Boolean(agy && agy.status === "ok"), el => el.child(
                h_flex().gap(6).items_center()
                  .child(image("mods/orca-status/antigravity.png").w(13).h(13).flex_none().rounded(2))
                  .child(div().text_color(t.foreground).child(`${agy.usedPercent}% ${agy.label}`))
              ))
              // Antigravity error chip (StatusBarProviderSegment.tsx:297-305)
              .when(Boolean(agy && agy.status === "error"), el => el.child(
                h_flex().gap(4).items_center().text_color(t.muted)
                  .child(image("mods/orca-status/antigravity.png").w(13).h(13).flex_none().rounded(2))
                  .child(svg("mods/orca-status/triangle-alert.svg").size(11).flex_none().text_color(t.muted))
                  .child(div().text_size(11).child(agy.label))
              ))
              // Claude error chip (StatusBarProviderSegment.tsx:297-305, usage-error-copy.ts:131)
              .when(Boolean(claude && claude.status === "error"), el => el.child(
                h_flex().gap(4).items_center().text_color(t.muted)
                  .child(svg("mods/orca-status/claude.svg").size(13).flex_none())
                  .child(svg("mods/orca-status/triangle-alert.svg").size(11).flex_none().text_color(t.muted))
                  .child(div().text_size(11).child(claude.label))
              ))
              // Claude ok chip
              .when(Boolean(claude && claude.status === "ok"), el => el.child(
                h_flex().gap(6).items_center()
                  .child(svg("mods/orca-status/claude.svg").size(13).flex_none())
                  .child(div().text_color(t.foreground).child(claude.label || "Claude"))
              ))
              // Codex chip (when active)
              .when(Boolean(codex && codex.status === "ok"), el => el.child(
                h_flex().gap(6).items_center()
                  .child(svg("mods/orca-status/codex.svg").size(13).flex_none())
                  .child(div().text_color(t.foreground).child(codex.label || "Codex"))
              ))
              // Cursor chip (when active)
              .when(Boolean(cursor && cursor.status === "ok"), el => el.child(
                h_flex().gap(6).items_center()
                  .child(image("mods/orca-status/cursor.png").w(13).h(13).flex_none().rounded(2))
                  .child(div().text_color(t.foreground).child(cursor.label || "Cursor"))
              ))
          )
          // StatusBarSurface.tsx:280-298 — Refresh button
          .child(
            h_flex().px(3).py(3).rounded(4).items_center().justify_center()
              .role("button").accessibility_label("Refresh rate limits").tooltip("Refresh usage data")
              .cursor_pointer().hover(s => s.bg("#404040b3"))
              .on_click((_e, cx) => this.refreshUsage(cx))
              .child(
                svg("mods/orca-status/refresh-cw.svg").size(11).flex_none()
                  .text_color(t.muted)
                  .when(this.isRefreshing, el => el.spin(1000).text_color(t.foreground))
              )
          )
      )
      // StatusBarSurface.tsx:308 — middle maintenance group: flex w-max gap-3
      .child(h_flex().gap(12).items_center()
        // Remote-server update (RemoteServerUpdateStatusSegment.tsx:19-70)
        .when(up.core.updating, el => el.child(segment("st-core-updating", "refresh-cw", "Updating", { spin: true, on: openSettings("updates") })))
        .when(!up.core.updating && Boolean(up.core.error), el => el.child(segment("st-core-failed", "alert-circle", "1 server update failed", { iconColor: t.blocked, on: openSettings("updates") })))
        // App update (UpdateStatusSegment.tsx:70-88)
        .when(Boolean(up.app.ready), el => el.child(segment("st-app-ready", "circle-check", "Update ready", { iconColor: t.done, on: openSettings("updates") })))
        // Remote hosts (SshStatusSegment.tsx:177)
        .when(hostsKnown, el => el.child(segment("st-hosts", "server", `${connected} host${connected === 1 ? "" : "s"}`, { muted: true, on: openSettings("machines") })))
        // StatusBarSurface.tsx:330-366 — `border-border bg-secondary shadow-xs`, hover
        // `bg-accent`; the dot sits `right-0.5 top-0.5` and its ring is the button's fill.
        .child(div().id("st-float").relative().size(20).flex_none().flex().items_center().justify_center().rounded(4)
          .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground)
          .cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
          .role("button")
          .accessibility_label(floatAttention ? `${floatLabel}, new activity` : floatLabel)
          .tooltip(floatChord ? `${floatLabel} (${floatChord})` : floatLabel)
          .on_click(() => run("orca-float.toggle"))
          .child(svg("mods/orca-status/panels-top-left.svg").size(14).flex_none())
          .when(floatAttention, el => el.child(div().absolute().top(2).right(2).size(6).rounded_full().flex_none()
            .bg("#f59e0b").border_1().border_color(t.raised))))
      );
  }
}
