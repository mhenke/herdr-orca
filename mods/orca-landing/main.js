// Orca's empty-canvas landing page: the screen behind the sidebar when no workspace is open.
//
// Ported from `Landing.tsx` — component at :216, JSX at :255-323, and the condition that shows
// it is `AppWorkspaceShell.tsx:106` (`activeView === 'terminal' && !hasActiveWorktree &&
// !creationLayoutActive`). `orca-tabs` owns that switch; this mod only draws the page.
//
// Named divergences, each because Herdr has no equivalent:
//  - Orca's tile holds `resources/logo.svg`, copied verbatim into this folder as `logo.svg`.
//  - The GitHub star footer (:317-321) is Orca's own repo link, not part of the workspace UI.
//  - Key caps come from Herdr's binding table, so they show what THIS app does.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, run, openOverlay, spaces, keys } from "herdr";

// `KeyCap` (ShortcutKeyCombo.tsx:6-18): `inline-flex min-w-6 items-center justify-center
// rounded border border-border/80 bg-secondary/70 px-1.5 py-0.5 text-xs font-medium
// text-muted-foreground shadow-sm`. min-w-6 = 24px, px-1.5 = 6, py-0.5 = 2, rounded = 4.
function keyCap(label, t) {
  return div().flex_none().h(20).min_w(24).px(6).py(2).flex().items_center().justify_center()
    .rounded(4).border_1().border_color(t.border).bg("#f0f0f00f")
    .text_size(12).font_medium().text_color(t.muted)
    .child(label);
}

// `ShortcutKeyCombo` (:52-66): caps joined by `+` on Linux (`mx-0.5 text-xs`); macOS joins
// them with no separator. Herdr exposes no platform to a mod, so the `+` form is used.
function combo(keysFor, t) {
  const row = h_flex().items_center().gap(4);
  keysFor.forEach((k, i) => {
    if (i) row.child(div().text_size(12).text_color(t.muted).child("+"));
    row.child(keyCap(k, t));
  });
  return row;
}

// The command equivalents of Orca's three shortcuts. Orca labels them `workspace.create`,
// `worktree.navigateUp`, `worktree.navigateDown`; these are Herdr's names for the same three.
function keysFor(action) {
  const found = (keys() ?? []).find((b) => b.action === action);
  return found ? String(found.keys).replace(/\s*\+\s*/g, "+").split("+") : [];
}

export default class Landing extends View {
  render() {
    const t = theme();
    // `Landing.tsx:229,276-281` — the copy line depends on whether any project exists.
    const hasProjects = (spaces() ?? []).length > 0;

    // The two buttons (:284-300): `inline-flex items-center gap-1.5 bg-secondary/70
    // border border-border/80 text-sm px-4 py-2 rounded-md`, glyph `size-3.5` = 14px.
    const button = (id, icon, label, onClick) =>
      h_flex().id(id).flex_none().h(36).px(16).gap(6).items_center().rounded(6)
        .border_1().border_color(t.border).bg("#f0f0f012")
        .text_size(14).font_medium().text_color(t.foreground)
        .cursor_pointer().role("button").accessibility_label(label)
        .hover(s => s.bg("#f0f0f01f"))
        .on_click(onClick)
        .child(svg(`mods/orca-landing/${icon}.svg`).size(14).flex_none())
        .child(label);

    // A shortcut row (:302-312): `grid grid-cols-[1fr_auto] items-center gap-3`, label
    // `text-sm text-muted-foreground`, combo at the end; the list is `max-w-xs` = 320px.
    const shortcutRow = (label, action) => {
      const ks = keysFor(action);
      return h_flex().w(320).items_center().justify_between().gap(12)
        .child(div().text_size(14).text_color(t.muted).child(label))
        .child(ks.length ? combo(ks, t) : div());
    };

    return v_flex().size_full().min_h(0).items_center().justify_center().bg(t.canvas)
      // `w-full max-w-lg px-6` (:257): max-w-lg = 512px, px-6 = 24px.
      .child(v_flex().w(512).px(24).items_center()
        // `flex flex-col items-center gap-4 py-8` (:258): gap-4 = 16px, py-8 = 32px.
        .child(v_flex().items_center().gap(16).py(32)
          // The logo tile (:259-268): `size-20 rounded-2xl border border-border/80 shadow-lg`,
          // `style={{ backgroundColor: '#12181e' }}`, logo `size-12` = 48px. size-20 = 80px,
          // rounded-2xl = 16px. The logo SVG is copied into this folder; a mod cannot read
          // outside it.
          .child(div().size(80).flex_none().flex().items_center().justify_center()
            .rounded(16).border_1().border_color("#f0f0f033").bg("#12181e")
            .child(svg("mods/orca-landing/logo.svg").size(48)))
          // `text-4xl font-bold tracking-tight` (:269-271): text-4xl = 36px.
          .child(div().text_size(36).font_bold().text_color(t.foreground).child("ORCA"))
          // `text-sm text-muted-foreground text-center` (:275-282).
          .child(div().text_size(14).text_center().text_color(t.muted)
            .child(hasProjects
              ? "Select a workspace from the sidebar to begin."
              : "Add a project to get started."))
          // The button pair: `flex items-center justify-center gap-2.5 flex-wrap` (:284),
          // gap-2.5 = 10px.
          .child(h_flex().items_center().justify_center().gap(10)
            .child(button("landing-add", "folder-plus", "Add project", () => run("space.new")))
            .child(button("landing-create", "git-branch-plus", "Create workspace",
              () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))))
          // The shortcut list: `mt-6 w-full max-w-xs space-y-2` (:302) — mt-6 = 24px,
          // space-y-2 = 8px between rows.
          .child(v_flex().mt(24).gap(8).items_center()
            .child(shortcutRow("Create workspace", "space.new"))
            .child(shortcutRow("Move up workspace", "space.prev"))
            .child(shortcutRow("Move down workspace", "space.next")))));
  }
}