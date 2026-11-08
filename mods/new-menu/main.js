// Derived from Herdr App's defaults/mods/new-menu/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Orca's tab-bar `+` menu: a 288px dropdown (tab-bar-surface.tsx:224-240) with an omnibox
// (TabBarCreateEntry.tsx:317-350) and static create rows (tab-bar-static-create-menu.tsx).
// Opened by orca-tabs, orca-landing and orca-nav.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme, spaces, panes, knownAgents, run, props, closeOverlay, openOverlay, pickFolder, keys, window } from "herdr";
import { MODELS } from "./models.js";

// The agents this machine can start, kept across opens so the menu paints at once while
// `knownAgents()` checks again. Module memory, not `shared()`: a `setShared` write only shows
// after an unrelated re-render, and this popup is the only reader (AGENTS.md rule 10).
let agentsCache = null;
let agentsFailed = false;
let agentsLoading = false;
// Models an agent reported, by program key: `omp models --json` takes seconds, so one ask
// serves every open.
const modelCache = new Map();

// Rows fit, not rows shown: the popup is 288x512 (orca-tabs/main.js:343), a row is 32, the
// content pads 4 a side, and a divider adds 11. The rest of the height goes to one heading
// (30) plus, in the model list, the filter row (36) and the Back row (43).
const FIT = { list: 13, models: 11 };

// Herdr keys are dash-joined (herdr's own keys.json ships "ctrl-shift-t"); Orca's menu shows
// the combo in caps (ShortcutKeyCombo.tsx:6-18).
function shortcut(name) {
  const k = keys().find((b) => b.section === "global" && b.action === name);
  if (!k?.keys.trim()) return "";
  const mac = window()?.platform === "macos";
  const names = mac ? { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘", fn: "fn" } : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", cmd: "Super", fn: "Fn" };
  const alias = { secondary: mac ? "cmd" : "ctrl", super: "cmd", win: "cmd" };
  return k.keys.trim().split(/\s+/).map((stroke) => {
    const parts = stroke.split("-");
    let key = parts.pop();
    if (key === "") { key = "-"; parts.pop(); }
    const held = new Set(parts.map((m) => alias[m.toLowerCase()] ?? m.toLowerCase()));
    if (/^[A-Z]$/.test(key)) held.add("shift");
    const label = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1).toLowerCase();
    return [...Object.keys(names).filter((m) => held.has(m)).map((m) => names[m]), label].join(mac ? "" : "+");
  }).join(" ");
}

export default class NewMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.backAt = 0;
    // The agent whose models are showing, or null for the create list.
    this.picking = null;
    // That agent's models once they arrive; null while loading or when the probe failed.
    this.models = null;
    this.modelsFailed = false;
    this.filter = "";
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.input = InputState.new({ placeholder: "Search models…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; cx.notify(); });
    // The filter owns Enter while it is focused, so a model is chosen through submit.
    this.input.on("submit", (_e, cx) => this.choose(this.at, cx));
    if (agentsCache || agentsLoading) return;
    const machine = spaces().find((s) => s.active)?.machine;
    agentsLoading = true;
    cx.spawn(async (cx) => {
      try {
        agentsCache = await knownAgents({ on: machine });
      } catch {
        agentsFailed = true;
      }
      agentsLoading = false;
      cx.notify();
    });
  }

  createRows() {
    const space = spaces().find((s) => s.active);
    const pane = panes().find((p) => p.focused);
    const folder = pane?.cwd;
    return [
      // tab-bar-static-create-menu.tsx:213-225 — New Terminal (TerminalSquare).
      { label: "New Terminal", icon: "square-terminal", hint: shortcut("tab.new"),
        run: () => run("tab.new", space ? { space: space.id } : {}) },
      // Omitted for lack of a Herdr backend: the omnibox (TabBarCreateEntry.tsx:317-350 — no
      // unified tab/history/file search command and no text input in this popup), New Browser
      // Tab (:227), New Markdown (:239), plugin new files, Open Markdown... (:283) and New
      // Mobile Emulator (:266) — Herdr has no browser, editor or emulator. Of Orca's
      // non-terminal tabs, the file browser is Herdr's one real mod pane, so it opens beside
      // the terminal through pane.split (commands.md).
      ...(pane ? [{ label: "New File Browser", icon: "folder-open",
        run: () => run("pane.split", { direction: "right", pane: pane.pane, mod: "orca-files" }) }] : []),
      // Orca's "Open Markdown..." (:283) opens a file; Herdr opens folders as terminals.
      { label: "New Terminal in Folder…", icon: "folder-open", pick: true },
      // Orca has no worktree rows here; the stock Herdr menu did, and orca-landing's
      // "Create workspace" button opens this menu for them.
      { label: "New worktree…", icon: "git-branch-plus", sep: true,
        run: () => openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: space?.id, folder, action: "new" } }) },
      { label: "Open worktree…", icon: "workflow",
        run: () => openOverlay({ mod: "worktree", kind: "dialog", width: 560, height: 480, props: { space: space?.id, folder, action: "open" } }) },
    ];
  }

  // Orca's `+` lists its picker entries above the static create rows
  // (`TabBarAgentPickerEntry.tsx:19-25`); Herdr's one agent list is the program table's
  // `knownAgents()` (herdr.d.ts), the same table that draws an agent's icon and runs it.
  agentRows() {
    if (!agentsCache) {
      return [{ label: agentsFailed ? "Could not load agents" : "Checking installed agents…", disabled: true }];
    }
    // Every installed agent, then the first two it could install — the stock menu's split,
    // so an agent whose binary detection misses it is still one row away.
    const installed = agentsCache.filter((a) => a.installed);
    return [...installed, ...agentsCache.filter((a) => !a.installed).slice(0, 2)].map((a) => ({
      label: a.name,
      program: a,
      disabled: !a.installed,
      hint: a.installed ? "" : "not installed",
      // Orca hangs a setup button off the agent row that opens its model list
      // (`AgentLaunchSetupButton.tsx:27-84`, `AgentLaunchSetupPanel.tsx:180-283`). A popup here
      // has no submenu (`orca-menu/main.js:418`), so the model list takes the menu's place and
      // Esc comes back.
      ...(MODELS[a.key] ? { stay: (cx) => this.pickModel(a, cx) } : { run: () => this.launch(a) }),
    }));
  }

  // One seed per agent, or what the agent reported. The default row comes first with no model
  // flag at all: Orca only adds `--model` once a model is picked
  // (`AgentLaunchTextModelDefault.tsx:23-33`, `agent-session-option-launch.ts:194-203`).
  modelRows() {
    const agent = this.picking;
    const seed = MODELS[agent.key];
    const all = seed.models ?? this.models;
    if (!all) {
      return [{ label: this.modelsFailed ? "Could not list models" : "Asking the agent…", disabled: true }];
    }
    const q = this.filter.trim().toLowerCase();
    const matching = q ? all.filter((m) => `${m.label} ${m.id}`.toLowerCase().includes(q)) : all;
    return [
      { label: "Default", hint: "its own", run: () => this.launch(agent) },
      ...(all.length
        ? matching.map((m) => ({ label: m.label, hint: m.id, run: () => this.launch(agent, m.id) }))
        : [{ label: "No models listed", disabled: true }]),
      ...(all.length && q && !matching.length ? [{ label: "No models match", disabled: true }] : []),
    ];
  }

  list() {
    return this.picking ? this.modelRows() : [...this.createRows(), ...this.agentRows()];
  }

  // Only the window around the selection is built, so a 511-model list costs eleven rows and
  // the popup keeps its size. The wheel moves the selection rather than a separate scroll
  // offset, so nothing can drift out of step with `at`.
  wheel(rows) {
    const list = this.list();
    const start = Math.max(0, Math.min(this.at - rows + 1, list.length - rows));
    return { start, rows: list.slice(start, start + rows) };
  }

  move(dir) {
    const list = this.list();
    for (let n = 0, i = this.at; n < list.length; n++) {
      i = (i + dir + list.length) % list.length;
      if (!list[i].disabled) { this.at = i; return; }
    }
  }

  edge(toEnd) {
    const list = this.list();
    const i = toEnd ? list.map((r) => !r.disabled).lastIndexOf(true) : list.findIndex((r) => !r.disabled);
    if (i >= 0) this.at = i;
  }

  pickModel(agent, cx) {
    this.backAt = this.at;
    this.picking = agent;
    this.at = 0;
    this.filter = "";
    this.input.set_value("");
    this.models = modelCache.get(agent.key) ?? null;
    this.modelsFailed = false;
    this.input.focus();
    // The filter is mounted by the next frame; focusing a handle that isn't in the tree can be
    // dropped, so ask again once it paints (the stock picker's own retry,
    // defaults/mods/picker/main.js:44).
    cx.timer.after(0, () => this.input.focus());
    const seed = MODELS[agent.key];
    if (this.models || !seed.probe) return;
    cx.spawn(async (cx) => {
      try {
        modelCache.set(agent.key, await seed.probe());
      } catch {
        this.modelsFailed = true;
      }
      if (this.picking === agent) this.models = modelCache.get(agent.key) ?? null;
      cx.notify();
    });
  }

  back() {
    this.picking = null;
    this.at = this.backAt;
    this.handle.focus();
  }

  launch(agent, model) {
    const space = spaces().find((s) => s.active);
    const seed = MODELS[agent.key];
    run("tab.new", {
      name: agent.name,
      space: space?.id,
      argv: seed && model ? [...agent.run, seed.flag, model] : agent.run,
    });
  }

  choose(i, cx) {
    const row = this.list()[i];
    if (!row || row.disabled) return;
    if (row.stay) {
      // A step inside this menu: change the rows, keep the popup open.
      row.stay(cx);
      cx.notify();
      return;
    }
    const overlay = props()?.overlay;
    if (row.pick) {
      cx.spawn(async () => {
        const folder = await pickFolder({ prompt: "Choose a folder for the terminal" });
        if (!folder) return;
        closeOverlay(overlay);
        run("terminal.open", { folder });
      });
      return;
    }
    closeOverlay(overlay);
    row.run();
  }

  // Program icons are the program table's `icon` (an appHome path; a tinted one is a one-color
  // glyph); a mod's own rows use `mods/new-menu/<icon>.svg`.
  icon(row, size, t) {
    const p = row.program;
    if (p?.icon) return p.tint
      ? svg(p.icon).size(size).flex_none().text_color(t.muted)
      : image(p.icon).size(size).flex_none();
    if (row.icon) return svg(`mods/new-menu/${row.icon}.svg`).size(size).flex_none().text_color(t.muted);
    return div().w(size).flex_none();
  }

  heading(label, t) {
    return div().px(8).pt(8).pb(4).text_size(11).text_color(t.dim).child(label);
  }

  // SearchQueryRow.tsx:47 — `h-8 rounded-md` with the border in the ring color on focus; the
  // model panel carries the same box above its list (`AgentLaunchSetupPanel.tsx:198-208`).
  filterRow(t) {
    return h_flex().w_full().h(32).min_h(0).px(8).gap(6).items_center().rounded(8).mb(4)
      .border_1().border_color(t.ring).bg(t.input)
      .child(svg("mods/new-menu/search.svg").size(14).flex_none().text_color(t.muted))
      .child(Input.new(this.input).flex_1().min_w(0).text_size(12).text_color(t.foreground).bg("#00000000"));
  }

  row(row, i, t, onClick) {
    return v_flex()
      .when(row.sep, (el) => el.child(div().mx(6).my(5).h(1).bg(t.border)))
      .child(h_flex()
        .id(`new-${i}`)
        // tab-bar-static-create-menu.tsx:222 — gap-2 rounded-[7px] px-2 py-1.5 text-[12px]
        // leading-5 font-medium; icon size-4 (16).
        .h(32)
        .px(8)
        .gap(8)
        .rounded(7)
        .items_center()
        .whitespace_nowrap()
        .font_medium()
        .text_color(row.disabled ? t.dim : t.foreground)
        .when(i === this.at && !row.disabled, (el) => el.bg(t.selected))
        .when(!row.disabled, (el) => el
          .on_hover((hovered, cx) => {
            if (!hovered || i < 0 || this.at === i) return;
            this.at = i;
            cx.notify();
          })
          .on_click((_e, cx) => (onClick ? onClick(cx) : this.choose(i, cx))))
        .child(this.icon(row, 16, t))
        .child(div().flex_1().min_w(0).truncate().child(row.label))
        // Shortcut: ml-auto pl-4 text-muted-foreground (dropdown-menu.tsx:219). A model id can
        // be longer than the row, so the hint keeps a ceiling instead of crushing the label.
        .child(div().flex_none().pl(16).max_w(110).truncate().text_color(t.muted).child(row.hint ?? "")));
  }

  render(cx) {
    const t = theme();
    const picking = this.picking;
    // The section label, which is not a row: navigation and clicks count rows only.
    const headingAt = this.createRows().length;
    const page = this.wheel(picking ? FIT.models : FIT.list);
    return v_flex()
      .id("new-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      // Content: w-72 p-1 rounded-[11px] border-border/80 shadow-[0_16px_36px_rgba(0,0,0,0.24)]
      // (tab-bar-surface.tsx:232). The overlay frame owns radius, border and shadow.
      .p(4)
      .bg(t.popover)
      .text_size(12)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.move(1);
        else if (e.key === "up") this.move(-1);
        else if (e.key === "home") this.edge(false);
        else if (e.key === "end") this.edge(true);
        else if (e.key === "enter" || e.key === "space") this.choose(this.at, cx);
        else if (e.key === "escape") {
          // Esc leaves the model list first, then the menu.
          if (!picking) return closeOverlay(props()?.overlay);
          this.back();
        } else return;
        cx.notify();
      })
      .on_scroll_wheel((e, cx) => {
        if (!e.delta.y) return;
        this.move(e.delta.y > 0 ? 1 : -1);
        cx.notify();
      })
      .when(picking, (el) => el.child(this.heading(picking.name, t)).child(this.filterRow(t)))
      .children(page.rows.flatMap((row, j) => {
        const i = page.start + j;
        const node = this.row(row, i, t);
        return !picking && i === headingAt
          ? [this.heading("Start an agent", t), node]
          : [node];
      }))
      // A back row stays put below the window, under the list it returns from.
      .when(picking, (el) => el.child(this.row({ label: "Back", icon: "chevron-left", sep: true }, -1, t,
        (cx) => { this.back(); cx.notify(); })));
  }
}
