// Clipboard and reveal. Writing to the clipboard uses GPUI's native display server
// integration (Wayland wl_data_device / X11 selection / macOS pasteboard / Win32)
// via cx.write_to_clipboard or __clipboard_write_text, exactly matching Orca's
// clipboard.writeText (clipboard-text-write-verify.ts:6). No CLI daemons, no disk I/O,
// no subshells.
// Copied into each mod that needs it — a mod cannot import outside its own folder (herdr-t3/scripts/sync.sh:10).
import { exec } from "herdr";

export function copyText(text, cx) {
  if (typeof text !== "string") text = String(text ?? "");
  if (!text) return;
  if (cx && typeof cx.write_to_clipboard === "function") {
    try { cx.write_to_clipboard(text); return; } catch {}
  }
  if (typeof globalThis.__clipboard_write_text === "function") {
    try { globalThis.__clipboard_write_text(text); } catch {}
  }
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

