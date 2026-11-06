// A lazy file browser for the focused pane's folder, with bounded read-only previews.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Input, InputState, Editor, EditorState } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, writeTextFile, watchFolder, theme, settings, window, props, run, openOverlay, closeOverlay, shared, setShared, nextCommand } from "herdr";
import { copyText, reveal } from "./clip.js";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;

async function directory(path, on) {
  const windowsDirectory = async () => {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Links keep directory attributes even when dangling; check their target.
    // Other reparse points (OneDrive's folders) have no LinkType and are folders.
    // PowerShell reads curly single quotes as quotes too, so they're doubled like '.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replace(/['‘’‚‛]/g, "$&$&") + "'"], { on });
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  };
  if (!on && window()?.platform === "windows") return windowsDirectory();
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  let r;
  try { r = await exec("sh", ["-c", script, "files", path], { on }); }
  catch (e) {
    if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectory();
    throw e;
  }
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.cx = cx;
    this.input = InputState.new({ placeholder: "Name" });
    this.input.on("change", (_e, cx) => cx.notify());
    this.input.on("submit", (_e, cx) => { void this.apply(this.input.value().trim()); cx.notify(); });
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
    cx.spawn(async cx => {
      for (;;) {
        const c = await nextCommand();
        if (c) await this.command(c).catch(() => {});
        cx.notify();
      }
    });
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
    });
  }

  current(context) {
    return this.context === context && key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const { cwd, on } = location(), next = key();
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.show(null); this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
      if (saved?.file) this.show(saved.file, cx);
    }
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${top.stdout.trim()}/${entry.slice(3)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
          }
        }
        if (!this.current(context)) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally { if (this.context === context) this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  show(path, cx) {
    this.code?.release(); this.code = null; this.file = path; this.fileError = null;
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.file !== path || !this.current(context)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const t = theme(), ext = path.includes(".") ? path.split(".").pop() : "txt";
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          font_family: settings().font_family, font_size: 12,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      } catch { if (this.file === path && this.current(context)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  // A row's menu. It opens as this mod's own popup: props() carries the target, and
  // the actions that need a typed name (New, Rename) park it in shared state because
  // run("<mod>.<cmd>") delivers only the command name to nextCommand().
  menu(path, entry) {
    openOverlay({ mod: "orca-files", kind: "popup", width: 230, height: 300,
      props: { tab: "file", target: { path, dir: entry.dir } } });
  }

  full(path) { return this.root ? `${this.root}/${path}` : path; }

  act(name) {
    const { path, dir } = props().target;
    const full = this.full(path);
    const close = () => closeOverlay(props().overlay);
    // Typed text cannot cross mods: run("<mod>.<cmd>") delivers only the command
    // string to nextCommand(). So New/Rename ask in this mod's own popup instead.
    // Stay in this popup: closing it first would take the prompt with it.
    const ask = (mode, title, value) => {
      this.prompt = { mode, title, full, overlay: props().overlay, value: value ?? "" };
      if (value) this.input.set_value(value), this.input.set_selected_range({ start: 0, end: value.length });
      else this.input.set_value("");
      this.input.focus();
      this.cx?.notify();
    };
    switch (name) {
      case "new-file": return ask("touch", "New File");
      case "new-folder": return ask("mkdir", "New Folder");
      case "copy-path": void copyText(full); return close();
      case "copy-rel": void copyText(path); return close();
      case "terminal": run("terminal.open", { folder: dir ? full : this.root }); return close();
      case "reveal": void reveal(full); return close();
      case "rename": return ask("mv", "Rename", path.replace(/^.*\//, ""));
      case "delete":
        close();
        setShared("orca-files.target", full);
        return openOverlay({ mod: "confirm", kind: "dialog", width: 420, height: 180,
          props: { title: "Delete?", detail: full, command: { name: "orca-files.remove" } } });
    }
  }

  // The pending New/Rename, applied here because typed text cannot cross mods.
  async apply(name) {
    const p = this.prompt;
    this.prompt = null;
    if (p?.overlay) closeOverlay(p.overlay);
    if (!p || !name) return;
    const parent = p.full.replace(/\/[^/]*$/, "");
    if (p.mode === "touch") await writeTextFile(`${p.full}/${name}`, "", null);
    if (p.mode === "mkdir") await exec("mkdir", ["-p", `${p.full}/${name}`]);
    if (p.mode === "mv") await exec("mv", [p.full, `${parent}/${name}`]);
    this.refresh(this.cx);
  }

  // Delete needs no typed text, so the shipped confirm mod can drive it.
  async remove() {
    const full = shared("orca-files.target");
    setShared("orca-files.target", null);
    if (full) await exec("rm", ["-rf", full]);
    this.refresh(this.cx);
  }

  command(c) { if (c === "remove") return this.remove(); }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.show(path, cx))
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu(path, entry); })
        .child(entry.dir ? svg(`mods/orca-files/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/orca-files/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  promptView(t) {
    const close = () => { this.prompt = null; this.cx.notify(); };
    return v_flex().id("orca-files-prompt").w_full().min_h(0).p(14).gap(10).bg(t.popover).text_size(12.8).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(14).font_semibold().child(this.prompt.title))
        .child(div().text_size(11).text_color(t.dim).child("Esc")).on_key_down((e, cx) => {
          if (e.key === "escape") { close(); cx.stop_propagation(); }
        }).track_focus(this.inputHandle ?? (this.inputHandle = this.cx.focus_handle())))
      .child(div().text_size(11).text_color(t.dim).child(this.prompt.full))
      .child(Input.new(this.input).h(34).px(10).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(12.8).text_color(t.foreground)
        .on_key_down((e, cx) => { if (e.key === "enter") { void this.apply(this.input.value().trim()); cx.stop_propagation(); } }))
      .child(h_flex().gap(8).justify_end()
        .child(h_flex().id("fx-cancel").h(30).px(12).items_center().rounded(7).border_1().border_color(t.input).text_size(12).cursor_pointer().hover(s => s.opacity(0.88)).on_click(close).child("Cancel"))
        .child(h_flex().id("fx-save").h(30).px(12).items_center().rounded(7).bg(t.solid).text_color(t.solid_foreground).text_size(12).font_medium().cursor_pointer()
          .hover(s => s.opacity(0.88)).on_click((_e, cx) => { void this.apply(this.input.value().trim()); cx.notify(); }).child("Save")));
  }

  menuView(t) {
    const item = (i, label, icon, act) => h_flex().id(`fx-${i}`).h(30).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer()
      .hover(s => s.bg(t.hover)).on_click(act)
      .child(svg(`mods/orca-files/${icon}.svg`).size(14).flex_none().text_color(t.muted))
      .child(div().child(label));
    return v_flex().id("orca-files-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8).text_color(t.foreground)
      .child(div().px(8).py(4).text_size(11).text_color(t.dim).child(props().target.path))
      .child(item(0, "New File", "plus", () => this.act("new-file")))
      .child(item(1, "New Folder", "folder", () => this.act("new-folder")))
      .child(item(2, "Copy Path", "copy", () => this.act("copy-path")))
      .child(item(3, "Copy Relative Path", "copy", () => this.act("copy-rel")))
      .child(item(4, "Open in Terminal", "terminal", () => this.act("terminal")))
      .child(item(5, "Reveal", "file", () => this.act("reveal")))
      .child(item(6, "Rename", "square-pen", () => this.act("rename")))
      .child(item(7, "Delete", "x", () => this.act("delete")));
  }

  render(cx) {
    if (key() !== this.context?.key) this.refresh(cx);
    const t = theme();
    if (this.prompt) return this.promptView(t);
    if (props()?.tab === "file") return this.menuView(t);
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.file ?? this.root?.split(/[\\/]/).pop() ?? "")))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}
