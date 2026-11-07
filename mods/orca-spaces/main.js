// Workspace spaces: worktrees under their checkout, grouped by machine when more than
// one is known. Cards follow Orca's classic card: folder/repo header, a status lane, a
// title and a meta row (branch, then the review badge at its end). Agent state lives in
// the agents list, not here. Click to switch, right-click for its menu, drag to reorder.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, agents, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, props, nextCommand } from "herdr";
import { repoMark, tint, parseRemote, avatarUrlFor, ensureAvatar } from "./project.js";
import { statusMark } from "./status.js";
import { getWorktreeCardContentIndent, getFlushWorktreeCardPaddingLeft, getWorktreeCardSurfaceInset, getFolderWorkspaceCardContentIndent, getFolderWorkspaceCardSurfaceInset, getProjectGroupHeaderPaddingLeft, WORKTREE_CARD_SURFACE_MARGIN } from "./indentation.js";
import { tip, tipMark } from "./tip.js";
import { stopsInit, stop, focusRoot, enter } from "./focus.js";

// `git worktree list --porcelain`, as Orca parses it
// (`git-worktree-porcelain-parser.ts`): the first row emitted is the main checkout.
function parseWorktreeList(output) {
  const out = [];
  for (const block of output.trim().split(/\r?\n\r?\n/)) {
    let path = "", branch = "", bare = false;
    for (const line of block.trim().split(/\r?\n/)) {
      if (line.startsWith("worktree ")) path = line.slice(9);
      else if (line.startsWith("branch ")) branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "bare") bare = true;
    }
    if (path && !bare) out.push({ path, branch });
  }
  return out;
}

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
    this.cx = cx;
    // pane.go onto this list (mod.json's "focusable"): the keyboard starts at the heading's button.
    cx.spawn(async (cx) => {
      for (;;) if (await nextCommand() === "focus") enter(this, cx, "space-new");
    });
    this.git = {}; // where() -> { name, branch, owner, repo, linked, pr }, null: not a repo
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

  // `key` and the other places in its repo (a commit there moves their branch).
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

  // One place's git: branch, its repo, and the review on that branch.
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
      const topDir = top.stdout.trim();
      const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
      const repo = common.stdout.trim();
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      // Orca's RepoIconGlyph shows the fork's PARENT avatar, not the fork's own
      // (`repo-slug-upstream.ts` getRepoUpstream, then `githubAvatarSlug` keeps origin only for
      // a renamed fork). Both reads are local/no-op-safe: `git remote get-url` reads no lock,
      // and `gh` is skipped entirely when the repo has no upstream and isn't a fork.
      let owner = null;
      try {
        const origin = await exec("git", ["remote", "get-url", "origin"], { cwd, on });
        const o = origin.code === 0 ? parseRemote(origin.stdout) : null;
        if (o) {
          const up = await exec("git", ["remote", "get-url", "upstream"], { cwd, on }).catch(() => null);
          const u = up?.code === 0 ? parseRemote(up.stdout) : null;
          let slug = u && !(u.owner === o.owner && u.repo === o.repo) ? u : null;
          // No `upstream` remote: ask GitHub whether origin is a fork. `exec` has its own 30s
          // cap (`gpui-kit.d.ts:22202`), so there is no per-call timeout to pass; off-machine
          // reads are skipped because `gh` there may not be authenticated.
          if (!slug && !on) {
            const q = await exec("gh", ["repo", "view", `${o.owner}/${o.repo}`, "--json", "isFork,parent"], { cwd }).catch(() => null);
            if (q?.code === 0) {
              const d = JSON.parse(q.stdout);
              const po = d?.parent?.owner?.login;
              const pr = d?.parent?.name;
              if (d?.isFork && po && pr) slug = { host: o.host, owner: po, repo: pr };
            }
          }
          // A renamed fork keeps its own identity; a same-name fork shows the parent's.
          owner = avatarUrlFor(slug && slug.repo !== o.repo ? o : (slug ?? o));
        }
      } catch {}
      const info = { name, top: topDir, branch: null, owner, repo: JSON.stringify([on, repo]), linked: repo !== `${topDir}/.git` };
      // Only the branch name is read. `# branch.ab` (ahead/behind) fed the removed gitTail,
      // and Orca's card has no such element; the flag still prints the header we parse.
      for (const line of r.stdout.split("\n")) {
        if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
      }
      this.git[key] = info;
      // Orca's right-aligned meta badge cluster (`WorktreeCardMetaBadges.tsx:86` `ml-auto ...
      // pr-1.5`) draws the linked review: `ReviewIcon` (worktree-review-presentation.tsx:105)
      // picks GitPullRequestClosed / GitPullRequestDraft / GitMerge or the plain PR glyph by
      // state, toned by `getStateTone` (merged purple, open emerald, closed/neutral muted).
      // Herdr carries no PR, so it comes from `gh pr list --head <branch>`, which is also what
      // Orca's review link resolves through. Only the current branch is asked, once per probe;
      // no gh, no auth or no PR simply leaves the slot empty, as Orca's `review == null` does.
      if (info.branch && !on) {
        try {
          const pr = await exec("gh", ["pr", "list", "--head", info.branch, "--json", "number,state,isDraft", "--limit", "1"], { cwd });
          if (pr.code === 0) {
            const [first] = JSON.parse(pr.stdout || "[]");
            if (first?.number) info.pr = { number: first.number, state: first.isDraft ? "draft" : String(first.state ?? "").toLowerCase() };
          }
        } catch {}
      }
      // Orca's rows are the repo's worktrees (`listRepoWorktrees`), not its open sessions, so an
      // unopened worktree still draws a card. Record each one; rows without a space open in it on click.
      if (!info.linked) {
        const wt = await exec("git", ["worktree", "list", "--porcelain"], { cwd, on });
        info.worktrees = wt.code === 0 ? parseWorktreeList(wt.stdout) : [];
      }
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

  // Orca's rows are worktrees, keyed by host+path (host-qualified-identity.ts), not by open
  // session: two tabs on one checkout are one card. Merge Herdr spaces on the same worktree
  // before emitting, so the card and its agents span them.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const rows = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    // A repo worktree is one card: `linked` worktrees and second same-checkout spaces fold
    // into the first space on that top-level folder. Folder spaces merge only with themselves.
    const seen = new Set(), list = [];
    for (const r of rows) {
      const key = r.g ? JSON.stringify([r.w.machine ?? null, r.g.top]) : `space:${r.w.id}`;
      if (seen.has(key)) { (list.find(l => l.key === key).also ??= []).push(r); continue; }
      seen.add(key); list.push({ ...r, key, also: [] });
    }
    // Sibling worktrees are flat cards under the group header, main first
    // (`orderMainWorktreeFirst`). Orca nests only explicit lineage (created-from records),
    // which Herdr doesn't track, so every row here is depth 0 — no tree indent, no wrapper.
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    const headed = new Set(); // repos whose header is already drawn
    for (const r of list) {
      // Orca's `groupBy: 'repo'` plan emits ONE header per repo group
      // (sidebar-row-plan.ts -> buildOrderedGroups), with every worktree of that repo as a
      // card beneath it. A second space in the same repo is another card, not a new group.
      const head = !r.g || !headed.has(r.g.repo);
      if (r.g) headed.add(r.g.repo);
      const top = { ...r, kids: 0, head };
      out.push(top);
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      top.kids = kids.length;
      // Orca lists every worktree of the repo, opened or not. A worktree with no space is a
      // card that opens it on click (`space.new {folder}`), so the group's rows match git.
      const opened = new Set(list.filter((k) => k.g?.repo === r.g.repo).map((k) => k.g.top));
      for (const wt of (r.g.worktrees ?? []).slice(1)) {
        if (opened.has(wt.path)) continue;
        opened.add(wt.path);
        const w = { id: `wt:${r.g.repo}:${wt.path}`, name: wt.branch || wt.path.split("/").pop(), named: false, tabs: [], active: false, status: null, machine: r.w.machine, folder: wt.path };
        const g = { ...r.g, top: wt.path, branch: wt.branch || r.g.branch, linked: true };
        kids.push({ w, i: -1, g, key: `wt:${wt.path}`, also: [], unopened: true });
      }
      top.kids = kids.length;
      // Not filtered here: `row()` hides a folded repo's cards so its header stays, which is
      // what a fold means. Filtering here too made the whole group disappear.
      kids.forEach((k) => out.push({ ...k, head: false }));
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
        // Synthetic worktree rows are not spaces: nothing may move or select them by id.
        if (out[i].unopened) continue;
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => r.unopened || this.shown.has(r.w.id));
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

  // `ReviewIcon` (worktree-review-presentation.tsx:105-120): the glyph is state-specific —
  // merged GitMerge, closed GitPullRequestClosed, draft GitPullRequestDraft, else the plain
  // PullRequestIcon — and the tone is `getStateTone` (:54-70): merged purple-400/70, open
  // emerald-500/80, closed muted-foreground/60, draft muted-foreground/50. `size-3` is the
  // MetaIconBadge glyph size.
  prBadge(pr, t, id) {
    const icon = pr.state === "merged" ? "git-merge" : pr.state === "closed" ? "git-pull-request-closed" : pr.state === "draft" ? "git-pull-request-draft" : "git-pull-request";
    const tone = pr.state === "merged" ? "#c084fcb3" : pr.state === "open" ? "#10b981cc" : pr.state === "draft" ? "#acacac80" : pr.state === "closed" ? "#acacac99" : "#acacacb3";
    return div().flex_none().flex().items_center().justify_center().pr(6)
      .child(tip(this.hot, t, `pr-${id}`, `PR #${pr.number}`, stop(this, t, `pr-${id}`, div().id(`pr-${id}`)
        .child(svg(`mods/orca-spaces/${icon}.svg`).size(12).flex_none().text_color(tone)))));
  }

  // `gitTail` used to draw `↑N`/`↓N` at the end of the title row. That was ours, not
  // Orca's: `default-workspace-card.json` has no ahead/behind var (its 32 vars are
  // classic/compact/folder/branch/conflict/details/ports/indicators and friends), and a
  // search for `ahead` across `components/sidebar/` returns only unrelated prose. Orca's
  // only right-side element on a classic card is the review badge in the meta row.

  // Orca's project header (SectionHeader.tsx): h-7, gap-1.5, pr-2, a 16px icon slot, a 13px
  // semibold label, and a 20px collapse button. The header owns the fold; its cards hide under it.
  header({ w, g }, t, ps) {
    // A folder workspace folds by its own id: there is no repo to key it on.
    const key = g?.repo ?? `space:${w.id}`;
    const folded = this.foldedRepos.has(key);
    const id = `space-head-${w.id}`;
    return stop(this, t, id, h_flex()
      .id(id)
      .h(28).flex_none().w_full().pl(getProjectGroupHeaderPaddingLeft(0)).pr(8).gap(6).items_center().mt(4)
      .role("button").accessibility_label(g?.name ?? w.name)
      .on_mouse_down("right", () => this.menu(w))
      .on_click((_e, cx) => this.toggleRepo(key, cx))
      // Orca's RepoIconGlyph: the repo's own image when it has one, else a lucide Folder
      // (repo-icon.tsx:145). Herdr has no per-repo icon, so the origin remote's GitHub owner
      // avatar is the image source; the first render kicks off a one-time fetch and writes it
      // under the app folder, and `image()` reads that cached file from then on.
      .child(repoMark(w, 16, t, ps, g?.owner ?? null))
      .child(div().min_w(0).flex_1().truncate().text_size(13).font_semibold().line_height("16px").text_color(t.foreground).child(g?.name ?? w.name))
      // SectionHeader.tsx:358: size-5 rounded-md text-muted-foreground, hover:bg-accent/70
      // and hover:text-foreground — a 70% accent wash, not a 70% white one.
      .child(div().id(`space-fold-${w.id}`).size(20).flex_none().flex().items_center().justify_center().rounded(6)
        .text_color(t.dim).hover((s) => s.bg("#404040b3").text_color(t.foreground))
        .child(svg(`mods/orca-spaces/chevron-${folded ? "right" : "down"}.svg`).size(14).flex_none())), 6,
      { enter: () => this.toggleRepo(key) });
  }

  // Orca's worktree card (worktree-card-surface.tsx): ml-1, py-2 (36px single line), rounded-lg,
  // a status lane, a 13px/20px title, the primary pill on the main checkout.
  card({ w, i, g, also, unopened }, t, ps) {
    // A merged card lights with any of its spaces and rolls all of their tabs up, as one
    // worktree with two open sessions is still one worktree.
    const group = [w, ...(also ?? []).map(a => a.w)];
    const on = group.some(s => s.active);
    // Orca titles a card by its worktree's branch when the header above already says the
    // repo/folder (`herdr-file-viewer` -> `main`), else the space's own name
    // (`default-workspace-card.json`: `title: trim(ws.title)`). The branch meta shows whenever
    // there is a branch (`branch: !folder && len(branch) > 0 && !newStyle && (!compact || ...)`):
    // classic non-compact cards print it even when it equals the title — hence master/master.
    const branch = g?.branch ?? w.branch ?? null;
    // Orca's worktree title is the branch for an unnamed worktree; a name the user gave wins.
    const title = !w.named && branch ? branch : w.name;
    // `default-workspace-card.json`: folder cards print the folder's own last segment
    // (`folderInMeta`, `WorktreeCardFolderPath` = `getDirectoryName`), branch cards the branch.
    const meta = g ? branch : base(place(w, ps));
    const metaMono = !g;
    // Orca's card lists its own agents (inlineAgents) with a 6px status dot each, from
    // agents(): the same rows the agents view reads, so a collapsed card shows the count
    // of real rows and never invents one.
    const tabIds = new Set(group.flatMap(s => (s.tabs ?? []).map(c => c.id)));
    const mine = agents().filter(a => tabIds.has(a.tab));
    // The host already rolled each space's agents up (model.rs `rollup`); the worktree's rollup
    // is the most urgent of its sessions (STATUS order: blocked > done > working > idle).
    const rank = { blocked: 4, done: 3, working: 2, idle: 1 };
    const dot = group.map(s => s.status).reduce((b, s) => ((rank[s] ?? -1) > (rank[b] ?? -1) ? s : b), null);
    // `primary` marks the worktree git itself lists first — its own checkout, not a linked
    // one (`worktree-card-header.tsx:115`: `!compactCards && worktree.isMainWorktree && !isFolder`).
    // Orca's parser sets `isMainWorktree: worktrees.length === 0`; ours marks `linked` when the
    // top differs from the common dir's owner, so the check is simply `!linked`.
    const isPrimary = Boolean(g && !g.linked);
    const folded = this.foldedAgents.has(w.id);
    const toggleId = `space-agents-${w.id}`;
    // An agent row shows the agent, not the folder it shares with the space.
    const agentTitle = (a) => {
      const label = a.title || a.app || a.program?.agent || "agent";
      return label === w.name || label === `π: ${w.name}` ? (a.app || a.program?.agent || "agent") : label;
    };
    const agentRow = (a) => h_flex().min_w(0).h(16).px(4).gap(4).items_center()
      .text_size(11).line_height("11px").text_color(t.dim)
      .child(statusMark(a.status, 12))
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
    // Orca's frame geometry: every row here is lineage depth 0 (no tree indent, no wrapper).
    // `default-workspace-card.json:38`: statusLane = vars.newStyle && options.show.status.
    // `experimentalNewWorktreeCardStyle` is false, so the lane is the LEGACY one and the
    // 8px new-style pullback must not apply (it pulled titles 8px too far left).
    // A folder workspace is a folder-group child (`folder-row.tsx:89`), so it uses the folder
    // path at groupDepth 1 — otherwise `isGrouped: false` gave it indent 0 and its title sat
    // 7px left of the repo cards'. Both paths land on the same 13px anchor.
    const folder = !g;
    const contentIndent = folder
      ? getFolderWorkspaceCardContentIndent({ groupDepth: 1 })
      : getWorktreeCardContentIndent({ isGrouped: Boolean(g), groupDepth: 0, lineageDepth: 0 });
    const surfaceInset = folder
      ? getFolderWorkspaceCardSurfaceInset({ isGrouped: true, groupDepth: 1 })
      : getWorktreeCardSurfaceInset({ isGrouped: Boolean(g), groupDepth: 0 });
    const geometry = { cardPaddingLeft: getFlushWorktreeCardPaddingLeft(Math.max(0, contentIndent - surfaceInset), false), surfaceInset };
    return stop(this, t, `space-${w.id}`, v_flex()
      .relative()
      .id(`space-${w.id}`)
      .ml(WORKTREE_CARD_SURFACE_MARGIN + geometry.surfaceInset).pr(6).py(8)
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
        if (unopened) return;
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
      .on_mouse_up("left", (e, cx) => {
        if (unopened) { run("space.new", { folder: g.top, machine: w.machine ?? undefined }); cx.notify(); return; }
        // Orca's card double-click opens the rename editor: `worktree-card-surface.tsx:98`
        // `onDoubleClick={...handleDoubleClick}` -> `use-worktree-card-activation-actions.ts`
        // `openModal('edit-meta', ...)` with `currentDisplayName`. Herdr's equivalent is
        // `space.rename`, and `MouseButtonEvent.click_count` is `2` on a double-click
        // (`gpui-kit.d.ts`, "How many presses in the current sequence") — the same field the
        // tab strip uses. Rename replaces select, as Orca's double-click replaces its click.
        if (e.click_count === 2) {
          this.pressed = null;
          this.over = null;
          run("space.rename", { id: w.id });
          cx.notify();
          return;
        }
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
      // Card root (worktree-card-surface.tsx): ml-1, py-2 for a title-only card, rounded-lg, and a
      // padding-left that the geometry module derives from the group depth. The content row is
      // `flex gap-0.5 items-start`, so the status lane sits at the top and never drives the title.
      .child(h_flex().w_full().min_w(0).items_start().gap(2).pl(geometry.cardPaddingLeft)
        // WorktreeCardStatusLane, legacy style (the default: experimentalNewWorktreeCardStyle
        // is false): `shrink-0 flex justify-center items-start pt-[2px]`, and no width — the
        // new-style `w-5` lane belongs to the other card style. StatusIndicator's own box is
        // h-3 w-3 holding an 8px dot.
        .child(div().flex_none().flex().items_start().justify_center().pt(2)
          .child(statusMark(dot, 12)))
        .child(v_flex().flex_1().min_w(0).gap(6)
          // Title row: title, then Orca's primary pill (h-16, px-1.5, 10px). `ws.isMain` only
          // marks a repo's own checkout: a plain folder workspace is no one's primary branch,
          // and a linked worktree is secondary to its checkout.
          .child(h_flex().w_full().min_w(0).gap(6).items_center()
            .child(div().min_w(0).max_w(150).truncate().text_size(13).line_height("20px").text_color(t.foreground).child(title))
            .when(isPrimary, el => el.child(div().flex_none().h(16).px(6).rounded(4).border_1().border_color("#f0f0f033").bg("#f0f0f00f")
              .text_size(10).font_medium().line_height("14px").text_color("#f0f0f0b3").child("primary")))
            // No trailing element: Orca's title row ends at the title (and the primary pill);
            // its right-hand cluster lives in the meta row below.
            .child(div().flex_1()))
          // Meta row: the branch, or the folder's own last segment — 11px muted, mono for paths
          // (`WorktreeCardFolderPath`: `font-mono text-[11px] leading-none`). The review badge
          // sits at the row's end, which is Orca's `ml-auto ... pr-1.5` cluster
          // (WorktreeCardMetaBadges.tsx:86) and the only thing it holds for a classic card.
          .when(Boolean(meta), el => el.child(h_flex().w_full().min_w(0).items_center()
            .child(div().min_w(0).truncate().text_size(11).line_height("11px").text_color(t.dim).when(metaMono, m => m.font_family("JetBrains Mono")).child(meta))
            .child(div().flex_1())
            .when(Boolean(g?.pr), row => row.child(this.prBadge(g.pr, t, w.id)))))
          // Orca's compact agent summary (worktree-card-compact-agents.tsx): h-6, px-1,
          // 11px muted, a chevron that folds the rows, which carry a 6px status dot each.
          .when(mine.length > 0, el => el.child(agentBlock))),
      ),
      // A worktree with no space opens one in its folder; anything else selects the space.
      8, { enter: () => unopened ? run("space.new", { folder: g.top, machine: w.machine ?? undefined }) : run("space.select", { id: w.id }) });
  }

  // A repo is a project group: a SectionHeader, then its worktree cards. A bare folder
  // workspace renders its folder row (folder glyph + name, `folder-row.tsx`) above its
  // session card — hence tmp three times: folder row, card title, card path meta.
  row(r, t, ps) {
    if (r.g?.linked) return [this.card(r, t, ps)];
    if (!r.g) {
      const key = `space:${r.w.id}`;
      if (this.foldedRepos.has(key)) return [this.header(r, t, ps)];
      return [this.header(r, t, ps), this.card(r, t, ps)];
    }
    // Orca folds the whole repo group, so every card of it hides, not only the head's.
    if (this.foldedRepos.has(r.g.repo)) return r.head ? [this.header(r, t, ps)] : [];
    // Only the repo's first space heads the group; its later spaces are further cards.
    if (!r.head) return [this.card(r, t, ps)];
    return [this.header(r, t, ps), this.card(r, t, ps)];
  }

  render() {
    const t = theme();
    const sp = spaces();
    // The shipped mods (the Terminals picker) still color spaces from "space.colors": the same color, from the name.
    const colors = Object.fromEntries(sp.filter(p => p.name !== "~").map(p => [p.id, tint(p.name, false)]));
    if (JSON.stringify(colors) !== JSON.stringify(shared("space.colors") ?? {})) setShared("space.colors", colors);
    const asks = props()?.newMenu && machines().length > 1;
    // One fetch per repo per session; `ensureAvatar` writes the file and notifies once, so the
    // next render draws the avatar instead of the Folder.
    for (const g of Object.values(this.git)) if (g?.owner) ensureAvatar(g.owner, this.cx);
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
          // EmptyState.tsx:23-27 — with no filters in Herdr only the first branch applies:
          // `flex flex-col items-center gap-2 px-4 py-6 text-center text-[11px] text-muted-foreground`
          // holding "No workspaces found". Orca gates it on `startupWorktreeRefreshCompleted`;
          // Herdr reports no equivalent, and a zero-space list is already settled.
          .when(sp.length === 0, el => el.child(div().flex().flex_col().items_center().gap(2).px(16).py(24).w_full()
            .text_size(11).text_center().text_color(t.muted)
            .child(div().child("No workspaces found"))))
          .children(sp.length ? this.grouped(t) : []))));
  }
}
