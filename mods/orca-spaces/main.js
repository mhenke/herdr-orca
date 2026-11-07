// Workspace spaces: stable colored avatars, worktrees under their checkout,
// grouped by machine when more than one is known. After a space's name, the repo
// its first terminal is in now, only where unusual: branch, ahead/behind. Agent state lives in the agents list, not here. Click to
// switch, right-click for its menu, drag to reorder.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, agents, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, props, nextCommand } from "herdr";
import { projectMark, repoMark, tint } from "./project.js";
import { tip, tipMark } from "./tip.js";
import { stopsInit, stop, focusRoot, enter } from "./focus.js";

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();

// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;

export default class Spaces extends View {
  init(_props, cx) {
    stopsInit(this, cx, "entry");
    // pane.go onto this list (mod.json's "focusable"): the keyboard starts at the heading's button.
    cx.spawn(async (cx) => {
      for (;;) if (await nextCommand() === "focus") enter(this, cx, "space-new");
    });
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
    for (const state of Object.values(this.reconnecting)) state.busy = false;
    this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    this.foldedRepos = new Set(JSON.parse(localStorage.getItem("repos.folded") ?? "[]"));
    this.foldedAgents = new Set(JSON.parse(localStorage.getItem("agents.folded") ?? "[]"));
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // `git status` walks the whole tree, on another machine a process there:
    // only when its answer could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        for (const key of keys) await this.check(key, cx);
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // No optional locks: a status that touched the index would wake the watch again.
      // Writes nothing under .git (index lock, fsmonitor cookie): watch() would wake on it.
      const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--branch"], { cwd, on });
      if (r.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
      const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
      const repo = common.stdout.trim();
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const info = { name, branch: null, ahead: 0, behind: 0, repo: JSON.stringify([on, repo]), linked: repo !== `${top.stdout.trim()}/.git` };
      for (const line of r.stdout.split("\n")) {
        if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
        else if (line.startsWith("# branch.ab ")) {
          const [a, b] = line.slice(12).split(" ");
          info.ahead = Math.abs(parseInt(a, 10)) || 0;
          info.behind = Math.abs(parseInt(b, 10)) || 0;
        }
      }
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    const s = spaces().find((x) => x.id === w.id);
    const path = s ? place(s, panes()) : null;
    openOverlay({ mod: "orca-menu", kind: "popup", width: 220, height: 300, props: { tab: "space", target: { id: w.id, path } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      const top = { ...r, tree: null, kids: 0 };
      out.push(top);
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      top.kids = kids.length;
      // Not filtered here: `row()` hides a folded repo's cards so its header stays, which is
      // what a fold means. Filtering here too made the whole group disappear.
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    // space.next/prev and ctrl-N follow the model, so it keeps the rows' order, folded rows included: folding moves nothing.
    // Simulate the batch so later indexes include earlier moves. An attempted write can lose a sync conflict: let its echo settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < out.length; i++) {
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // Orca keeps each card's agent list open or folded on its own, remembered across runs.
  toggleAgents(id, cx) {
    this.foldedAgents.has(id) ? this.foldedAgents.delete(id) : this.foldedAgents.add(id);
    localStorage.setItem("agents.folded", JSON.stringify([...this.foldedAgents]));
    cx.notify();
  }

  toggleRepo(repo, cx) {
    this.foldedRepos.has(repo) ? this.foldedRepos.delete(repo) : this.foldedRepos.add(repo);
    localStorage.setItem("repos.folded", JSON.stringify([...this.foldedRepos]));
    cx.notify();
  }

  // The rows, under a header per machine once one isn't this computer.
  // A button's icon and text brighten together: a hover style reaches the text but not the svg, so it's state, as in the inbox.
  glow(id) {
    return (on, cx) => {
      if (on) this.hot = id;
      else if (this.hot === id) this.hot = null;
      cx.notify();
    };
  }

  grouped(t) {
    const rows = this.ordered(), ps = panes();
    const draw = (r) => this.row(r, t, ps);
    const flat = (r) => draw(r);
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => div().id(`machine-loading-${m ?? "local"}`).h(30).flex_none().px(8).text_size(13).text_color(t.dim).child("Loading…");
    if (!remote.length) return loading(null) && !rows.length ? [loadingRow(null)] : rows.flatMap(flat);
    const machineNames = [null, ...remote];
    return machineNames.flatMap((m, i) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const folded = this.folded.has(m);
      // Drawn as the agents list's group headers, each 8px below what's above it, the heading included: right under it,
      // its + and chevron crowded the heading's buttons, a column of icons unevenly spaced.
      // Its + and chevron stand under the heading's two buttons, in slots built as those are (26px, 2px apart, 10px from the edge), so any zoom rounds them alike.
      const head = h_flex().id(`machine-${m ?? "local"}`).pt(8).h(30).flex_none().pl(8).pr(2).gap(4).items_center()
        .text_size(12).font_medium().text_color(t.dim)
        .role("button").accessibility_label(`${folded ? "Expand" : "Collapse"} ${m ?? "This computer"}`)
        .on_hover((on, cx) => {
          // By the row's id: this computer's m is null, which a cleared field would equal.
          if (on) this.overMachine = `machine-${m ?? "local"}`;
          else if (this.overMachine === `machine-${m ?? "local"}`) this.overMachine = null;
          cx.notify();
        })
        .on_click((_e, cx) => {
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        // -1: the glyph's own inset, so its edge meets the heading and the spaces' marks.
        .child(svg(`mods/t3-inbox/${m ? "server" : "monitor"}.svg`).size(14).ml(-1).flex_none())
        // The dot describes the machine, so it follows its name, however short.
        .child(h_flex().flex_1().min_w(0).gap(6).items_center()
          .child(div().min_w(0).truncate().child(m ?? "This computer"))
          .child(tipMark(this, t, `machine-state-${m ?? "local"}`, connected ? "Connected" : (machine?.state ?? "asleep").replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), div().size(6).rounded_full().flex_none().bg(connected ? t.ansi2 : t.dim))))
        .when(!connected && !rebuilt, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
        .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
          .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
          .child(tip(this.hot, t, `machine-connect-${m}`, `Connect ${m}`, stop(this, t, `machine-connect-${m}`, div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
            .hover(s => s.text_color(t.foreground)).on_hover(this.glow(`machine-connect-${m}`))
            .role("button").accessibility_label(`Connect ${m}`)
            .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
            .child(repair?.busy ? "Connecting…" : "Connect"), 4)))))
        .child(h_flex().flex_none().gap(2).items_center()
          .when(connected, el => el.child(tip(this.hot, t, `machine-add-${m ?? "local"}`, "New space here", stop(this, t, `machine-add-${m ?? "local"}`, div().id(`machine-add-${m ?? "local"}`).w(26).h(20).flex_none().flex().items_center().justify_center().rounded(4)
            .text_color(this.hot === `machine-add-${m ?? "local"}` ? t.foreground : t.dim).on_hover(this.glow(`machine-add-${m ?? "local"}`))
            .role("button").accessibility_label("New space here")
            .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child(svg("mods/orca-spaces/plus.svg").size(12)), 4),
            // The key makes a space on the current space's machine: it names this + only on that one.
            { action: (spaces().find(s => s.active)?.machine ?? null) === m ? "space.new" : null })))
          // An indicator, not a button: the whole row folds, so it lights with the row and has no label of its own.
          .child(div().id(`machine-fold-${m ?? "local"}`).w(26).flex_none().flex().items_center().justify_center()
            .text_color(this.overMachine === `machine-${m ?? "local"}` ? t.foreground : t.dim)
            .child(svg(`mods/orca-spaces/chevron-${folded ? "right" : "down"}.svg`).size(12).flex_none())));
      const empty = stop(this, t, `machine-new-${m ?? "local"}`, h_flex().id(`machine-new-${m ?? "local"}`).h(30).flex_none().px(8).gap(8).items_center().rounded(8)
        .text_size(13).text_color(this.hot === `machine-new-${m ?? "local"}` ? t.foreground : t.dim).hover(s => s.bg(t.hover)).on_hover(this.glow(`machine-new-${m ?? "local"}`))
        .role("button").accessibility_label("New space here")
        .on_click(() => run("space.new", { machine: m ?? "" }))
        // Laid out as a space's row: the + in the mark's 18px, the words where a name starts.
        .child(div().size(18).flex_none().flex().items_center().justify_center().child(svg("mods/orca-spaces/plus.svg").size(12))).child("New space here"), 8);
      const heading = stop(this, t, `machine-${m ?? "local"}`, head, 8);
      if (rebuilt) return [heading];
      return [heading, ...(folded ? [] : mine.length ? mine.flatMap(flat) : [loading(m) ? loadingRow(m) : empty])];
    });
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one.
  // Only the counts that can't be seen elsewhere, after the title: ahead/behind. The branch
  // and repo are the meta row and the header now, so repeating them here drew them twice.
  gitTail(g, t, id) {
    const n = (count, what) => `${count} commit${count === 1 ? "" : "s"} to ${what}`;
    return h_flex()
      .flex_1()
      .min_w(0)
      .gap(4)
      .justify_end()
      .items_center()
      .text_size(11)
      .text_color(t.dim)
      .when(g.ahead > 0, (el) => el.child(tipMark(this, t, `ahead-${id}`, n(g.ahead, "push"), div().text_color(t.ansi2).child(`\u2191${g.ahead}`))))
      .when(g.behind > 0, (el) => el.child(tipMark(this, t, `behind-${id}`, n(g.behind, "pull"), div().text_color(t.ansi1).child(`\u2193${g.behind}`))));
  }

  // Orca's project header (SectionHeader.tsx): h-7, gap-1.5, pr-2, a 16px icon slot, a 13px
  // semibold label, and a 20px collapse button. The header owns the fold; its cards hide under it.
  header({ w, g }, t, ps) {
    // A folder workspace folds by its own id: there is no repo to key it on.
    const key = g?.repo ?? `space:${w.id}`;
    const folded = this.foldedRepos.has(key);
    const id = `space-head-${w.id}`;
    return stop(this, t, id, h_flex()
      .id(id)
      .h(28).flex_none().w_full().pl(10).pr(8).gap(6).items_center().mt(4)
      .role("button").accessibility_label(g?.name ?? w.name)
      .on_mouse_down("right", () => this.menu(w))
      .on_click((_e, cx) => this.toggleRepo(key, cx))
      // Orca's RepoIconGlyph: a lucide icon (Folder by default) in a 16px rounded square,
      // not a letter monogram. A project's own favicon still wins when it has one.
      .child(repoMark(w, 16, t, ps))
      .child(div().min_w(0).flex_1().truncate().text_size(13).font_semibold().line_height("16px").text_color(t.foreground).child(g?.name ?? w.name))
      // As Orca's: aria-hidden, the whole header folds, so it lights with the header and has no label.
      .child(div().id(`space-fold-${w.id}`).size(20).flex_none().flex().items_center().justify_center().rounded(6)
        .text_color(t.dim).hover((s) => s.bg("#f0f0f0b3"))
        .child(svg(`mods/orca-spaces/chevron-${folded ? "right" : "down"}.svg`).size(14).flex_none())), 6,
      { enter: () => this.toggleRepo(key) });
  }

  // Orca's worktree card (worktree-card-surface.tsx): ml-1, py-2 (36px single line), rounded-lg,
  // a w-5 status lane, a 13px/20px title, the primary pill on the main checkout.
  card({ w, i, g, tree }, t, ps) {
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const on = w.active;
    // Orca titles a card by its worktree's branch when the header above already says the
    // repo/folder (`herdr-file-viewer` -> `main`), else the space's own name. The branch
    // follows as the meta row only when it adds to the title (default-workspace-card.json
    // -> IdentityBlock -> Branch, 11px muted).
    const branch = g?.branch ?? w.branch ?? null;
    // Orca's worktree title is the branch for an unnamed worktree; a name the user gave wins.
    const title = !w.named && branch ? branch : w.name;
    const meta = branch && branch !== title ? branch : null;
    // Orca's card lists its own agents (inlineAgents) with a 6px status dot each, from
    // agents(): the same rows the agents view reads, so a collapsed card shows the count
    // of real rows and never invents one.
    const tabIds = new Set((w.tabs ?? []).map(c => c.id));
    const mine = agents().filter(a => tabIds.has(a.tab));
    // Orca's StatusIndicator: the most urgent state (blocked > working > done), from the
    // agents' own status rather than a rollup that also counts plain terminals.
    const rank = { blocked: 3, failed: 3, permission: 3, working: 2, monitoring: 2, done: 1 };
    const top = mine.reduce((best, a) => ((rank[a.status] ?? 0) > (rank[best] ?? 0) ? a.status : best), null);
    // Orca's StatusIndicator.tsx: red-500 for a failure, the emerald status dot for a
    // finished or idle terminal, neutral/40 for a quiet one. No invented working spinner.
    const rowDot = (st) => st === "failed" || st === "blocked" ? "#ef4444"
      : st === "done" || st === "active" || st === "working" || st === "monitoring" ? "#10b981"
      : st === "permission" || st === "unconfirmed" ? "#eab308"
      : "#73737366";
    const dot = rowDot(top);
    // `primary` marks the repo's top branch only: a folder workspace has no branch, and a
    // linked worktree is secondary to its checkout.
    // shortcut: main/master by name; a repo whose default branch is named otherwise shows
    // none. Upgrade to `git symbolic-ref refs/remotes/origin/HEAD` if that ever matters.
    const isPrimary = Boolean(g && !g.linked && (branch === "main" || branch === "master"));
    const folded = this.foldedAgents.has(w.id);
    const toggleId = `space-agents-${w.id}`;
    // An agent row shows the agent, not the folder it shares with the space.
    const agentTitle = (a) => {
      const label = a.title || a.app || a.program?.agent || "agent";
      return label === w.name || label === `π: ${w.name}` ? (a.app || a.program?.agent || "agent") : label;
    };
    const agentRow = (a) => h_flex().min_w(0).h(16).px(4).gap(4).items_center()
      .text_size(11).line_height("11px").text_color(t.dim)
      .child(div().size(8).rounded_full().flex_none().bg(rowDot(a.status)))
      .child(div().min_w(0).flex_1().truncate().child(agentTitle(a)));
    const agentBlock = v_flex().min_w(0).gap(0)
      .child(h_flex().id(toggleId).h(24).w_full().min_w(0).px(4).gap(4).items_center().rounded(2)
        .text_size(11).line_height("11px").text_color(t.dim).cursor_pointer()
        .role("button")
        .accessibility_label(folded ? `Expand ${mine.length} agents` : `Collapse ${mine.length} agents`)
        .hover(s => s.text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); this.toggleAgents(w.id, cx); })
        .child(svg(`mods/orca-spaces/chevron-${folded ? "right" : "down"}.svg`).size(10).flex_none())
        .child(div().min_w(0).truncate().child(`${mine.length} agent${mine.length === 1 ? "" : "s"}`)))
      .when(!folded, el => el.child(v_flex().min_w(0).gap(2).pt(2).children(mine.map(agentRow))));
    return stop(this, t, `space-${w.id}`, v_flex()
      .relative()
      .id(`space-${w.id}`)
      // A nested card steps in with its surface, as Orca's lineage wrapper (14 = 18 indent - 4 ml - 2 + 2).
      .ml(4 + (tree ? 14 : 0)).pr(6).py(8)
      .flex_none()
      .rounded(8)
      .role("button")
      .accessibility_label(w.name)
      // Orca active card: bg foreground/10 over sidebar, border foreground/18.
      .when(on, (el) => el.bg("#3e3e3e").border_1().border_color("#f0f0f02e"))
      .when(!on, (el) => el.hover((s) => s.bg("#f0f0f014")))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, line => line.bottom(0))
          .when(fromIndex > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      // Card root: Row gap xs (2), status lane then a Stack gap md (6) — Orca's default template.
      .child(h_flex().w_full().min_w(0).pl(2 + (tree ? 18 : 0)).gap(2).items_center()
        .child(div().w(20).mr(4).flex_none().flex().items_center().justify_center()
          .child(div().size(8).rounded_full().flex_none().bg(dot)))
        .child(v_flex().flex_1().min_w(0).gap(6)
          // Title row: title, then Orca's primary pill (h-16, px-1.5, 10px). `ws.isMain` only
          // marks a repo's own checkout: a plain folder workspace is no one's primary branch,
          // and a linked worktree is secondary to its checkout.
          .child(h_flex().w_full().min_w(0).gap(6).items_center()
            .child(div().min_w(0).max_w(150).truncate().text_size(13).line_height("20px").text_color(t.foreground).child(title))
            .when(isPrimary, el => el.child(div().flex_none().h(16).px(6).rounded(4).border_1().border_color("#f0f0f033").bg("#f0f0f00f")
              .text_size(10).font_medium().line_height("14px").text_color("#f0f0f0b3").child("primary")))
            .child(g ? this.gitTail(g, t, w.id) : div().flex_1()))
          // Meta row: the branch, 11px muted, as Orca's Branch part.
          .when(Boolean(meta), el => el.child(div().min_w(0).truncate().text_size(11).line_height("11px").text_color(t.dim).child(meta)))
          // Orca's compact agent summary (worktree-card-compact-agents.tsx): h-6, px-1,
          // 11px muted, a chevron that folds the rows, which carry a 6px status dot each.
          .when(mine.length > 0, el => el.child(agentBlock))),
      ),
      // A space goes by its mouse-up, which a key isn't.
      8, { enter: () => run("space.select", { id: w.id }) });
  }

  // A repo is a project group: a SectionHeader, then its worktree cards. A bare folder
  // workspace has no repo to head it, so it is one top-level card (Orca's folder row) —
  // heading it would print its folder name twice. A linked worktree hangs under the card
  // its main checkout leads, so it draws no second header.
  row(r, t, ps) {
    if (r.g?.linked) return [this.card(r, t, ps)];
    if (!r.g) return [this.card(r, t, ps)];
    // Orca folds a whole repo (SectionHeader's toggle hides every row of the group),
    // so the header hides its own card too and the chevron is never a dead control.
    const folded = this.foldedRepos.has(r.g.repo);
    return [this.header(r, t, ps), ...(folded ? [] : [this.card(r, t, ps)])];
  }

  render() {
    const t = theme();
    const sp = spaces();
    // The shipped mods (the Terminals picker) still color spaces from "space.colors": the same color, from the name.
    const colors = Object.fromEntries(sp.filter(p => p.name !== "~").map(p => [p.id, tint(p.name, false)]));
    if (JSON.stringify(colors) !== JSON.stringify(shared("space.colors") ?? {})) setShared("space.colors", colors);
    const asks = props()?.newMenu && machines().length > 1;
    const tool = (id, label, icon, fn, more) => tip(this.hot, t, id, label, stop(this, t, id, div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(this.hot === id ? t.foreground : t.dim).on_hover(this.glow(id)).role("button").accessibility_label(label).hover(s => s.bg(t.hover))
      .on_click(fn).child(svg(`mods/orca-spaces/${icon}.svg`).size(14))), more);
    return focusRoot(this, v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(v_flex().id("space-list").flex_1().min_h(0).overflow_y_scroll()
        .on_mouse_up("left", (_e, cx) => { this.pressed = this.over = null; cx.notify(); })
        // Herdr reports no release outside the sidebar, so leaving ends a drag, as in the inbox.
        .on_hover((on, cx) => {
          if (on || this.pressed === null) return;
          this.pressed = this.over = null;
          cx.notify();
        })
        .child(v_flex().id("space-content").w_full().flex_none().px(0).pb(8)
          .children(this.grouped(t)))));
  }
}
