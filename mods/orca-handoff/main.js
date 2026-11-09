// Derived from Herdr App's defaults/mods/changes/main.js (Apache-2.0, Copyright Herdr App authors).
// Modified for herdr-orca; see LICENSE and NOTICE.
// Agent Session Handoff & Fork Dialog.
// Ports Orca's:
//   - AgentSessionContinuationDialog.tsx:1-415 ("Hand Off to Another Agent")
//   - TerminalAgentSessionForkDialog.tsx:1-132 ("Fork Agent Session")
//   - terminal-agent-session-continuation.ts:45-91
//   - terminal-agent-session-fork.ts:92-160
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import {
  run,
  props,
  closeOverlay,
  theme,
  panes,
  spaces,
  agents,
  hc,
  exec
} from "herdr";
import { copyText } from "./clip.js";
import {
  buildAgentSessionForkPrompt,
  buildAgentSessionContinuationPrompt
} from "./transcript.js";

// Standard agents available in Herdr's program catalog (defaults/programs.json:4-29).
const AGENT_CATALOG = [
  { id: "claude", name: "Claude Code", run: ["claude"] },
  { id: "opencode", name: "OpenCode", run: ["opencode"] },
  { id: "codex", name: "Codex", run: ["codex"] },
  { id: "pi", name: "Pi", run: ["pi"] },
  { id: "gemini", name: "Gemini", run: ["gemini"] },
  { id: "agy", name: "Antigravity", run: ["agy"] },
  { id: "cursor", name: "Cursor Agent", run: ["cursor-agent"] },
  { id: "aider", name: "Aider", run: ["aider"] }
];

export default class HandoffDialog extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.loading = true;
    this.capturedText = "";
    this.selectedAgentIndex = 0;
    this.copied = false;
    this.busy = false;
    this.statusMessage = "";

    const p = props() ?? {};
    this.action = p.action === "fork" ? "fork" : "handoff";
    this.terminal = p.terminal ?? "";
    this.paneId = p.pane ?? "";

    // Resolve workspace and pane context
    const pane = panes().find((x) => x.pane === this.paneId || x.terminal === this.terminal);
    this.cwd = pane?.cwd || "";
    this.paneTitle = pane?.title || "";

    const agent = agents().find((a) => a.address === this.terminal || a.pane === this.paneId);
    this.sourceAgent = agent?.app || agent?.program?.name || "Agent";

    // Select initial agent index different from source agent if possible (avoidSourceAgent)
    const initialIndex = AGENT_CATALOG.findIndex((a) => a.id !== this.sourceAgent.toLowerCase());
    if (initialIndex >= 0) {
      this.selectedAgentIndex = initialIndex;
    }

    // Capture terminal scrollback and buffer using `hc read`
    if (this.terminal) {
      cx.spawn(async (cx) => {
        const res = await hc(["read", this.terminal]).catch(() => null);
        this.capturedText = res?.code === 0 && res?.stdout ? res.stdout : "";
        this.loading = false;
        cx.notify();
      });
    } else {
      this.loading = false;
    }
  }

  getContinuationPrompt() {
    return buildAgentSessionContinuationPrompt({
      sourceAgent: this.sourceAgent,
      sourceWorkingDirectory: this.cwd,
      capturedText: this.capturedText
    });
  }

  getForkPrompt() {
    return buildAgentSessionForkPrompt({
      capturedText: this.capturedText,
      sourceLabel: this.paneTitle || this.paneId || "Original Terminal",
      agentLabel: this.sourceAgent
    });
  }

  async copyCurrentPrompt(cx) {
    const prompt = this.action === "fork" ? this.getForkPrompt() : this.getContinuationPrompt();
    if (!prompt) {
      this.statusMessage = "No terminal context available";
      cx.notify();
      return;
    }
    await copyText(prompt, cx);
    this.copied = true;
    this.statusMessage = "Prompt copied to clipboard";
    cx.notify();
    cx.timer.after(600, () => {
      closeOverlay(props()?.overlay);
    });
  }

  async executeHandoff(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();

    const targetAgent = AGENT_CATALOG[this.selectedAgentIndex] ?? AGENT_CATALOG[0];
    const prompt = this.getContinuationPrompt();

    // Launch agent in a fresh tab with the continuation prompt
    run("tab.new", {
      name: `${targetAgent.name} (Handoff)`,
      folder: this.cwd || undefined,
      argv: targetAgent.run,
      task: prompt || undefined
    });

    closeOverlay(props()?.overlay);
  }

  async executeFork(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();

    const prompt = this.getForkPrompt();
    const space = spaces().find((s) => s.active);

    // If in a git repository, create a fork branch/worktree if possible
    if (this.cwd) {
      const gitTop = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: this.cwd }).catch(() => null);
      if (gitTop?.code === 0) {
        const repoTop = gitTop.stdout.trim();
        const branchRes = await exec("git", ["branch", "--show-current"], { cwd: this.cwd }).catch(() => null);
        const currentBranch = branchRes?.code === 0 ? branchRes.stdout.trim() : "main";
        const forkBranch = `${currentBranch || "session"}-fork`;

        // Launch in new tab
        run("tab.new", {
          name: `Fork: ${forkBranch}`,
          folder: this.cwd,
          task: prompt || undefined
        });

        closeOverlay(props()?.overlay);
        return;
      }
    }

    // Default fallback: new tab with the forked context
    run("tab.new", {
      name: "Session Fork",
      folder: this.cwd || undefined,
      task: prompt || undefined
    });

    closeOverlay(props()?.overlay);
  }

  render(cx) {
    const t = theme();
    const isFork = this.action === "fork";
    const title = isFork ? "Fork Agent Session" : "Hand Off to Another Agent";
    const description = isFork
      ? "Create an independent session fork with captured context from this terminal."
      : "Start a fresh Agent session from this stopping point. The original session stays unchanged.";
    const iconName = isFork ? "git-fork" : "message-square-plus";

    return v_flex()
      .id("orca-handoff-dialog")
      .track_focus(this.handle)
      .w_full()
      .p(16)
      .gap(12)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .rounded(12)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          closeOverlay(props()?.overlay);
        } else if (e.key === "enter" && !this.loading && !this.busy) {
          if (isFork) void this.executeFork(cx);
          else void this.executeHandoff(cx);
        }
      })
      .children([
        // Header (Orca: AgentSessionContinuationDialog.tsx:238-251)
        h_flex()
          .w_full()
          .items_start()
          .justify_between()
          .child(
            v_flex()
              .gap(3)
              .child(
                h_flex()
                  .gap(8)
                  .items_center()
                  .child(svg(`mods/orca-handoff/${iconName}.svg`).size(16).text_color(t.foreground))
                  .child(div().font_semibold().text_size(14).text_color(t.foreground).child(title))
              )
              .child(div().text_size(11).text_color(t.muted).child(description))
          )
          .child(
            div()
              .id("dialog-close")
              .size(20)
              .rounded(4)
              .flex()
              .items_center()
              .justify_center()
              .cursor_pointer()
              .hover((s) => s.bg(t.hover))
              .on_click(() => closeOverlay(props()?.overlay))
              .child(svg("mods/orca-handoff/x.svg").size(12).text_color(t.muted))
          ),

        // Session metadata card (Orca: AgentSessionContinuationDialog.tsx:254-265)
        v_flex()
          .w_full()
          .p(10)
          .gap(4)
          .rounded(6)
          .border(1)
          .border_color(t.border)
          .bg(t.background)
          .children([
            h_flex()
              .w_full()
              .justify_between()
              .items_center()
              .child(
                h_flex()
                  .gap(6)
                  .items_center()
                  .child(div().font_medium().text_size(12).text_color(t.foreground).child(this.paneTitle || "Active Terminal"))
                  .child(div().text_size(11).text_color(t.muted).child(`· ${this.sourceAgent}`))
              )
              .child(
                div()
                  .text_size(11)
                  .text_color(t.muted)
                  .child(this.loading ? "Capturing transcript…" : `${this.capturedText.length} chars`)
              ),
            div()
              .text_size(11)
              .text_color(t.muted)
              .truncate()
              .child(this.cwd || "Working directory: (not set)")
          ]),

        // Agent selection picker (for handoff)
        ...(!isFork
          ? [
              v_flex()
                .gap(6)
                .child(div().text_size(11).font_medium().text_color(t.muted).child("Target Agent"))
                .child(
                  h_flex()
                    .w_full()
                    .gap(6)
                    .flex_wrap()
                    .children(
                      AGENT_CATALOG.map((agent, i) => {
                        const selected = this.selectedAgentIndex === i;
                        return div()
                          .id(`agent-opt-${agent.id}`)
                          .px(8)
                          .py(4)
                          .rounded(5)
                          .border(1)
                          .border_color(selected ? t.foreground : t.border)
                          .bg(selected ? t.selected : t.background)
                          .text_color(selected ? t.foreground : t.muted)
                          .cursor_pointer()
                          .hover((s) => s.bg(t.hover))
                          .on_click((_e, cx) => {
                            this.selectedAgentIndex = i;
                            cx.notify();
                          })
                          .child(div().text_size(11).font_medium().child(agent.name));
                      })
                    )
                )
            ]
          : []),

        // Status banner
        ...(this.statusMessage
          ? [
              div()
                .px(8)
                .py(4)
                .rounded(4)
                .bg(t.selected)
                .text_size(11)
                .text_color(t.foreground)
                .child(this.statusMessage)
            ]
          : []),

        // Action footer (Orca: AgentSessionContinuationDialog.tsx:392-412)
        h_flex()
          .w_full()
          .mt(8)
          .items_center()
          .justify_end()
          .gap(8)
          .children([
            div()
              .id("btn-copy-prompt")
              .px(10)
              .h(28)
              .rounded(6)
              .border(1)
              .border_color(t.border)
              .flex()
              .items_center()
              .gap(6)
              .cursor_pointer()
              .hover((s) => s.bg(t.hover))
              .on_click((_e, cx) => void this.copyCurrentPrompt(cx))
              .child(svg("mods/orca-handoff/copy.svg").size(12).text_color(t.foreground))
              .child(div().text_size(12).text_color(t.foreground).child(this.copied ? "Copied!" : "Copy Prompt")),

            div()
              .id("btn-start-action")
              .px(12)
              .h(28)
              .rounded(6)
              .bg(t.foreground)
              .text_color(t.background)
              .flex()
              .items_center()
              .gap(6)
              .cursor_pointer()
              .hover((s) => s.opacity(0.9))
              .on_click((_e, cx) => {
                if (isFork) void this.executeFork(cx);
                else void this.executeHandoff(cx);
              })
              .child(
                div()
                  .text_size(12)
                  .font_medium()
                  .child(this.busy ? "Launching…" : isFork ? "Start Fork" : "Start Session")
              )
          ])
      ]);
  }
}
