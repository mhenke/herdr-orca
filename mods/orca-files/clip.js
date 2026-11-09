// Clipboard and reveal. Writing to the clipboard synchronizes both GPUI's
// in-app clipboard (__clipboard_write_text / cx.write_to_clipboard) and the host
// display server clipboard (wl-copy / xclip / pbcopy) via piped stdin without
// temporary disk files or pipe hangs, matching Orca's clipboard.writeText
// (clipboard-text-write-verify.ts:6).
// Copied into each mod that needs it — a mod cannot import outside its own folder (herdr-t3/scripts/sync.sh:10).
import { exec } from "herdr";

export function copyText(text, cx) {
  if (typeof text !== "string") text = String(text ?? "");
  if (!text) return;
  // 1. In-app GPUI internal clipboard (InputState, prompt modal, terminal.paste)
  if (typeof globalThis.__clipboard_write_text === "function") {
    try { globalThis.__clipboard_write_text(text); } catch {}
  }
  if (cx && typeof cx.write_to_clipboard === "function") {
    try { cx.write_to_clipboard(text); } catch {}
  }
  // 2. Host OS display server clipboard via piped stdin (Wayland / X11 / macOS / Windows).
  // Zero temp files, closed standard streams (>/dev/null 2>&1), non-blocking.
  // shortcut: the text travels as argv, so a copy beyond the kernel's per-argument
  // limit (~2 MiB) stays in GPUI only; move to stdin if that size ever matters.
  exec("sh", [
    "-c",
    'if command -v wl-copy >/dev/null 2>&1; then printf %s "$1" | wl-copy -n >/dev/null 2>&1; ' +
    'elif command -v xclip >/dev/null 2>&1; then printf %s "$1" | xclip -selection clipboard >/dev/null 2>&1; ' +
    'elif command -v pbcopy >/dev/null 2>&1; then printf %s "$1" | pbcopy >/dev/null 2>&1; ' +
    'elif command -v powershell.exe >/dev/null 2>&1; then printf %s "$1" | powershell.exe -NoProfile -Command "$input | Set-Clipboard" >/dev/null 2>&1; fi',
    "copy",
    text,
  ]).catch(() => {});
}

export function reveal(path, isDir = false) {
  const dir = isDir ? path : (path.replace(/\/[^/]*$/, "") || path);
  for (const cmd of ["xdg-open", "open", "explorer.exe"]) {
    try {
      exec("sh", ["-c", 'command -v "$1" >/dev/null 2>&1 && ("$1" "$2" >/dev/null 2>&1 &)', "reveal", cmd, dir]);
      return;
    } catch {}
  }
}
