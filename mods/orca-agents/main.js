// The vault panel: Orca's "Agents" activity entry — the live Herdr agents above the session
// history Orca lists from disk, with resume.
//
// Orca's panel scans agent transcripts on disk and offers scope, search, details and resume
// (AiVaultPanel.tsx:196-363, AiVaultPanelHeader.tsx:94-172, AiVaultSessionRow.tsx:155-245).
// The reader primitive here is `exec` (defaults/herdr.d.ts:14): it runs a program in the
// user's real environment, which is what can see `$HOME`. `readTextFile`
// (defaults/herdr.d.ts:26) rejects anything over 1 MiB (src/mods.rs:872) and transcripts run
// to 32 MB, so it cannot read them; that is the only read primitive Herdr exposes for mods.
// The bounded `head`/`tail` window below is the sampling strategy, not a second primitive.
//
// One store is ported: OMP's jsonl sessions. Orca has one adapter per CLI
// (AI_VAULT_AGENT_SOURCES, session-scanner-agent-sources.ts:88); a second CLI is a second
// adapter (root + parser), not a rewrite of this panel.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Input, InputState } from "gpui-base";
import { agents, spaces, run, theme, exec } from "herdr";

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

// Scope folders: a session belongs to a scope when its cwd is under the scope folder or above
// it (Orca matches by worktree paths and cwd aliases,
// src/renderer/src/components/right-sidebar/ai-vault/session-list/ai-vault-session-filters.ts:20).
function inFolder(root, path) {
  return Boolean(root && path && (path === root || path.startsWith(root + "/") || root.startsWith(path + "/")));
}

// `formatTimeAgo` (ai-vault-session-time.tsx:32-74).
function ago(ms) {
  if (!Number.isFinite(ms)) return "Unknown time";
  const diff = Date.now() - ms;
  if (diff < 60000) return "Just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// AiVaultSessionListBar.tsx:23-33.
function countLabel(shown, loaded) {
  if (shown !== loaded) return `${shown} of ${loaded} sessions`;
  return `${shown} session${shown === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------------------
// OMP transcript adapter. Root resolution ports `resolveOmpSessionsDir`
// (scanners/omp/omp-session-root.ts:31-79): an explicit OMP_CODING_AGENT_DIR (or the
// inherited PI_ one) may name the agent root or the sessions root, else ~/.omp/agent.
// It runs through POSIX `sh`, the same assumption orca-files/clip.js:11-29 makes; on a
// machine without one the scan rejects and its message is shown as the error row.
// ---------------------------------------------------------------------------------------
const OMP_LIST =
  'root="${OMP_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}}"; ' +
  'case "$root" in */sessions) ;; *) root="$root/sessions" ;; esac; ' +
  // One level under the store is one conversation; `<session>.jsonl/` subagent transcripts
  // are one level deeper and are not rows (isOmpConversationDirectory,
  // session-scanner-omp-subagent-transcripts.ts:13).
  'ls -1t "$root"/*/*.jsonl 2>/dev/null | head -n 12';

// The bounded window: a transcript's first record carries id/cwd/title, the tail carries the
// last activity, and `readTextFile` cannot stretch past 1 MiB. A cut line fails JSON.parse
// and is skipped.
const OMP_READ = 'head -c 65536 "$1"; printf "\\n"; tail -c 16384 "$1" | tail -n 2';

// `sessionIdFromFileName` (session-scanner-accumulator.ts:209-213): the trailing UUID.
function sessionIdFromFileName(fileName) {
  const name = fileName.replace(/\.jsonl$/, "");
  const match = name.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : name;
}

// `extractMessageText` (session-scanner-text-normalization.ts): text parts only.
function messageText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
    .join(" ")
    .trim();
}

// `foldOmpTranscriptTitle` (scanners/omp/session-scanner-omp-title.ts:10-42): a user name
// outranks an automatic one, and the current title slot outranks older rename entries.
function foldTitle(current, record) {
  const legacy = record.type === "session_info";
  if (!legacy && record.type !== "session" && record.type !== "title" && record.type !== "title_change") return current;
  if (record.type === "title" && record.v !== 1) return current;
  const value = String((legacy ? record.name : record.title) ?? "").trim();
  if (!value) return current;
  const raw = legacy ? "user" : (record.source ?? record.titleSource);
  if (raw !== undefined && raw !== "user" && raw !== "auto") return current;
  const source = raw === "user" ? "user" : "auto";
  if (current?.source === "user" && source !== "user") return current;
  const parsed = Date.parse(record.type === "title" ? record.updatedAt : record.timestamp);
  const at = Number.isFinite(parsed) ? parsed : null;
  if (current?.source === source && current.at !== null && at !== null && at < current.at) return current;
  return { title: value, source, at };
}

// `consumeMessageGraphRecordLine` (scanners/session-scanner-graph-parsers.ts:222-271) for
// agent 'omp'. Dropped: Orca filters harness-injected user turns out of the title
// (`isKnownHarnessInjectedUserTurnText`, shared/harness-injected-user-turns), so a title can
// occasionally be the injected prompt; and messageCount needs the whole file.
function parseOmpSession(path, content) {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  let sessionId = sessionIdFromFileName(fileName);
  let cwd = null;
  let named = null;
  let model = null;
  let createdAt = null;
  let updatedAt = null;
  let fallback = null;
  let preview = null;
  for (const line of content.split("\n")) {
    if (line.charAt(0) !== "{") continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!record || typeof record !== "object") continue;
    // `updateTimeline` (session-scanner-accumulator.ts:161-176).
    const parsed = Date.parse(record.timestamp);
    if (Number.isFinite(parsed)) {
      if (createdAt === null || parsed < createdAt) createdAt = parsed;
      if (updatedAt === null || parsed > updatedAt) updatedAt = parsed;
    }
    named = foldTitle(named, record);
    if (record.type === "session") {
      if (typeof record.id === "string" && record.id.trim()) sessionId = record.id.trim();
      if (cwd === null && typeof record.cwd === "string" && record.cwd.trim()) cwd = record.cwd.trim();
      continue;
    }
    if (record.type === "model_change") {
      model = record.modelId || record.model || model;
      continue;
    }
    if (record.type !== "message" || !record.message) continue;
    const role = record.message.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = messageText(record.message.content);
    if (role === "user") fallback ??= text;
    else model = record.message.model || model;
    if (text) preview = { role, text };
  }
  if (updatedAt === null) updatedAt = createdAt;
  return {
    id: sessionId,
    path,
    cwd,
    // `generatedSessionTitle` (session-scanner-accumulator.ts:157-159): "OMP <id8>".
    title: named?.title || fallback || `OMP ${sessionId.slice(0, 8)}`,
    model: typeof model === "string" ? model : null,
    updatedAt,
    preview,
  };
}

async function scanOmpSessions() {
  const listing = await exec("sh", ["-c", OMP_LIST], { timeout: 15000 });
  const paths = listing.stdout.split("\n").filter(Boolean).slice(0, 12);
  const contents = await Promise.all(
    paths.map(async (path) => {
      try {
        const read = await exec("sh", ["-c", OMP_READ, "read", path], { timeout: 15000 });
        return [path, read.stdout];
      } catch {
        return [path, ""];
      }
    })
  );
  return contents
    .map(([path, content]) => parseOmpSession(path, content))
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
}

export default class AgentsPanel extends View {
  init(_props, cx) {
    this.seen = "";
    this.scope = "workspace"; // "workspace" | "project" | "all" (AiVaultPanelControls.tsx:87-160)
    this.search = InputState.new({ placeholder: "Search sessions" });
    this.search.on("change", (_e, cx) => cx.notify());
    this.history = [];
    this.historyLoading = false;
    this.historyError = null;

    // `agents()` is live but a status change does not notify a mod; orca-spaces repaints from
    // a timer for exactly this reason (main.js:123-133). One second is enough for a label.
    cx.timer.every(1000, (cx) => {
      const now = (agents() ?? []).map((a) => `${a.address}:${a.status}`).join(",");
      if (now === this.seen) return;
      this.seen = now;
      cx.notify();
    });

    this.refreshHistory(cx);
    // Orca re-scans on demand and when the panel opens (useAiVaultSessionRefresh); a mounted
    // Herdr mod never "opens", so a slow timer stands in for the open event.
    cx.timer.every(60000, (cx) => this.refreshHistory(cx));
  }

  refreshHistory(cx) {
    if (this.historyLoading) return;
    this.historyLoading = true;
    cx.spawn(async (cx) => {
      try {
        this.history = await scanOmpSessions();
        this.historyError = null;
      } catch (e) {
        this.historyError = String(e?.message ?? e);
      }
      this.historyLoading = false;
      cx.notify();
    });
  }

  // Resume for a past session. Orca's omp line is `omp --resume <absolute transcript path>`
  // (src/shared/ai-vault/resume/ai-vault-resume-command.ts:33-48 takes the transcript path as the target, :163-175 the
  // base command from TUI_AGENT_CONFIG.omp.detectCmd = "omp", :216-218 the --resume form),
  // run in the folder the session recorded. Herdr's `terminal.open {argv, folder}` starts it
  // in a new tab (src/commands.rs:44) — the "Resume in new tab" action the row offers
  // (AiVaultSessionRow.tsx:83-95). Dropped with no Herdr equivalent: drag-to-resume,
  // resume-in-chat, resume-in-new-CLI, copy id/path, reveal log, delete (all Orca-only).
  // The flag keeps the CLI's documented `--resume=<value>` form (`omp --help`: "Resume a
  // session (by ID prefix, path, or picker if omitted)"), because argv has no shell to glue
  // the value to an optional-value flag.
  resume(session) {
    const args = { argv: ["omp", "--resume=" + session.path] };
    // Recorded cwd, never the focused terminal's folder; Herdr falls back on its own when absent.
    if (session.cwd) args.folder = session.cwd;
    run("terminal.open", args);
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

  // A past-session row, ported from `AiVaultSessionRow.tsx:155-245` + `SessionMetadata`
  // (ai-vault-session-row-display.tsx:55-130). The identity glyph comes from a live
  // `program`; a transcript has none and a mod cannot read another folder's icons, so the
  // agent label alone is drawn (`OMP`, AI_VAULT_AGENT_LABELS). The preview is one truncated
  // line: GPUI has no 2-line clamp (`line-clamp-2`). A click resumes, standing in for the
  // row's resume button (the details toggle has no Herdr equivalent).
  // Orca's row id carries the file path (`finalizeSession`,
  // session-scanner-accumulator.ts:116), so one session copied into two project folders still
  // gets distinct rows; keying on the path keeps that identity here.
  historyRow(s, t) {
    return h_flex().id(`session-${s.path}`).w_full().min_w(0).flex_none().px(12).py(8).gap(6).items_start()
      .border_b(1).border_color(t.border).cursor_pointer().hover((st) => st.bg(t.hover))
      .role("button").accessibility_label(`Resume ${s.title}`)
      .on_click(() => this.resume(s))
      .child(v_flex().flex_1().min_w(0)
        .child(div().min_w(0).truncate().text_size(13).font_medium().line_height("20px").text_color(t.foreground).child(s.title))
        // `AiVaultSessionRow.tsx:233-243`: `mt-0.5 ... text-[12px] leading-4 text-muted-foreground`,
        // the role at `font-medium text-foreground/80`, then ": text".
        .child(h_flex().mt(2).w_full().min_w(0).text_size(12).line_height("16px").text_color(t.muted)
          .when(Boolean(s.preview), (e) => e
            .child(div().flex_none().font_medium().text_color(fade(t.foreground, 0.8))
              .child(s.preview.role === "user" ? "You" : "Agent"))
            .child(div().flex_1().min_w(0).truncate().child(`: ${s.preview.text}`)))
          .when(!s.preview, (e) => e.child(div().min_w(0).truncate().child("No conversation preview available"))))
        .child(h_flex().mt(4).gap(6).items_center().text_size(11).line_height("16px").text_color(t.muted)
          .child(div().flex_none().child("OMP"))
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().flex_none().child(ago(s.updatedAt)))
          .when(Boolean(s.model), (e) => e
            .child(div().flex_none().text_color(t.dim).child("·"))
            .child(div().min_w(0).truncate().child(s.model)))
          .child(div().flex_none().text_color(t.dim).child("·"))
          .child(div().min_w(0).truncate().child(s.cwd || "unknown folder"))));
  }

  // `VaultGroupHeader` (AiVaultPanelControls.tsx:57-85): `flex h-8 w-full items-center gap-2
  // border-y border-sidebar-border bg-sidebar-accent/60 px-3 text-xs font-semibold` plus a
  // count badge. The chevron/collapse toggle is dropped: it would need an icon asset this
  // mod does not ship, and the lists are short.
  groupHeader(label, count, t) {
    return h_flex().w_full().h(32).flex_none().items_center().gap(6).px(12)
      .border_t(1).border_b(1).border_color(t.border).bg(fade(t.raised, 0.6))
      .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(label))
      .child(div().flex_none().px(6).py(2).rounded(4).border_1().border_color(t.border)
        .bg(t.background).text_size(11).font_semibold().child(String(count)));
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
      filtered = filtered.filter((a) => inFolder(projectFolder, sp.find((x) => x.id === a.space)?.folder));
    }

    // The same scope filter for history rows, by their recorded cwd
    // (useAiVaultPanelSessions, src/renderer/src/components/right-sidebar/ai-vault/session-list/ai-vault-session-filters.ts:20).
    const scopeFolder =
      effectiveScope === "workspace" ? activeSpace?.folder : effectiveScope === "project" ? projectFolder : null;
    let history = this.history;
    if (scopeFolder) history = history.filter((s) => inFolder(scopeFolder, s.cwd));

    // Search over the loaded fields. Orca searches a full-text index built in the main
    // process (src/main/ai-vault-search/session-search-engine.ts); Herdr has no index, so
    // this filters the rows the adapter loaded.
    const q = this.search.value().trim().toLowerCase();
    if (q) {
      history = history.filter((s) =>
        [s.title, s.cwd || "", s.model || "", "omp"].some((value) => value.toLowerCase().includes(q))
      );
    }

    return v_flex().id("agents").size_full().min_h(0).overflow_hidden().text_color(t.foreground)
      // `AiVaultPanelHeader.tsx:94-108`: title "Agent Session History", subtitle
      // "Resume past sessions" (the <300px compact copy is a container-query variant with
      // no Herdr counterpart and is not ported).
      .child(v_flex().flex_none().px(10).py(8).gap(8).border_b(1).border_color(t.border)
        .child(v_flex().w_full().min_w(0)
          .child(div().truncate().text_size(12).font_semibold().child("Agent Session History"))
          .child(div().truncate().text_size(11).text_color(t.muted).child("Resume past sessions")))
        .child(this.scopeSwitch(effectiveScope, workspaceAvailable, projectAvailable, t, cx))
        .child(this.searchBar(t, cx)))
      // `AiVaultSessionListBar.tsx:50-54`: `flex h-8 shrink-0 items-center gap-2 border-y
      // border-sidebar-border bg-sidebar-accent/60 pl-3 pr-1.5`, 12px semibold count. The
      // sort dropdown (:56-87) is not ported; rows stay in Orca's default "updated" order.
      .child(h_flex().h(32).flex_none().items_center().pl(12).pr(6).border_b(1)
        .border_color(t.border).bg(fade(t.raised, 0.6))
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold()
          .child(countLabel(history.length, this.history.length))))
      .child(v_flex().id("agents-list").flex_1().min_h(0).overflow_y_scrollbar()
        // Orca's vault has no live section: a live agent is a dot on its history row
        // (AiVaultSessionRow.tsx:82-91). Herdr's live list is kept above the history under
        // its own header — this grouping is ours, not Orca's.
        .child(this.groupHeader("Live agents", filtered.length, t))
        .children(filtered.map((a) => this.row(a, t)))
        .when(!filtered.length, (el) =>
          el.child(h_flex().px(12).py(6).text_size(11).text_color(t.muted).child("No live agents"))
        )
        .child(this.groupHeader("Past sessions", history.length, t))
        .when(this.historyError, (el) =>
          el.child(v_flex().px(12).py(8).text_size(11).text_color(t.blocked).child(this.historyError))
        )
        // `SessionLoadingState` (AiVaultSessionListStates.tsx:4-30) label; the six skeleton
        // rows are pure decoration and are not drawn.
        .when(this.historyLoading && !this.history.length, (el) =>
          el.child(h_flex().px(12).py(12).gap(6).items_center().text_size(11).text_color(t.muted)
            .child(svg("mods/orca-agents/agent-working-spinner.svg").size(14).flex_none().text_color(t.working).spin(1000))
            .child("Scanning sessions"))
        )
        .children(history.map((s) => this.historyRow(s, t)))
        // `AiVaultSessionVirtualList.tsx:260-286`: the empty titles.
        .when(!this.historyLoading && !history.length, (el) =>
          el.child(v_flex().size_full().items_center().justify_center().px(16).text_color(t.muted)
            .child(div().mb(12).opacity(0.5).child(svg("mods/orca-agents/archive-restore.svg").size(28)))
            .child(div().text_size(14).font_medium().text_center()
              .child(this.history.length ? "No sessions match the current filters" : "No agent sessions found")))
        ));
  }
}
