# 0013 — Clipboard writes reach both GPUI and the host display server

- **Status**: accepted (replaces the native-GPUI-only premise this record first carried)
- **Date**: 2026-11-09

## Context

Every mod that copies text (`orca-menu`, `orca-files`, `orca-changes`, `orca-handoff`) carries its own `clip.js`. There are two clipboards in play, and they are read by different consumers:

1. **GPUI's clipboard.** A mod's `cx.write_to_clipboard(text)` and `globalThis.__clipboard_write_text(text)` both land in `App::write_to_clipboard(ClipboardItem::new_string(...))` — `vendor/gpui-kit/crates/shell/src/engine/quickjs/host.rs:917-924`. Herdr's own paste paths read it: `terminal.paste` (`src/terminal.rs:600`, `terminal.rs:2331`), terminal copy (`terminal.rs:630`) and input paste.
2. **The host display server.** Wayland selection, X11 selection, macOS pasteboard, Win32 clipboard. This is what every program outside Herdr reads.

`mods/*/clip.js` previously wrote only to layer 1. Copying from a context menu then produced nothing when pasting into another application: the text existed inside Herdr and nowhere else. An earlier revision of this record claimed the GPUI call alone was sufficient, on the strength of GPUI's Wayland client calling `data_device.set_selection` (`vendor/gpui-pre-linux/src/linux/wayland/client.rs:1410-1425`). That claim did not survive use.

A revision before that shelled out to `wl-copy` through disk temp files and hung for the full `exec` timeout. The hang was never `wl-copy` being slow: measured directly, the same command finishes in 0.09 s. `wl-copy` daemonizes to keep selection ownership alive, and the daemon inherited `exec()`'s stdout/stderr pipes, so `run_blocking` (`src/mods.rs:430-482`) waited for EOF that never came. Disk temp files were a workaround for a stdio-inheritance bug, and they left in-app paste stale because nothing ever wrote layer 1.

## Decision

`copyText(text, cx)` writes both layers, in that order:

```javascript
// 1. In-app GPUI clipboard: synchronous, feeds terminal.paste and prompt inputs.
if (typeof globalThis.__clipboard_write_text === "function") { try { globalThis.__clipboard_write_text(text); } catch {} }
if (cx && typeof cx.write_to_clipboard === "function") { try { cx.write_to_clipboard(text); } catch {} }

// 2. Host display server: text on argv, both streams closed, no temp file.
exec("sh", ["-c",
  'if command -v wl-copy >/dev/null 2>&1; then printf %s "$1" | wl-copy -n >/dev/null 2>&1; ' +
  'elif command -v xclip >/dev/null 2>&1; then printf %s "$1" | xclip -selection clipboard >/dev/null 2>&1; ' +
  'elif command -v pbcopy >/dev/null 2>&1; then printf %s "$1" | pbcopy >/dev/null 2>&1; ' +
  'elif command -v powershell.exe >/dev/null 2>&1; then printf %s "$1" | powershell.exe -NoProfile -Command "$input | Set-Clipboard" >/dev/null 2>&1; fi',
  "copy", text]).catch(() => {});
```

- **Text travels as an argument**, not through a file and not through shell interpolation. Newlines, tabs, quotes and `$` survive unchanged; the text is `$1` to `printf`, never part of the script being parsed.
- **`>/dev/null 2>&1` is on the writer itself**, so the selection daemon it forks inherits `/dev/null` instead of `exec`'s pipes. This is the fix for the timeout, not a cosmetic redirect.
- **One probe shell** picks the first available writer (`wl-copy`, `xclip`, `pbcopy`, `powershell.exe`), and does nothing when none is installed. `exec` rejects are swallowed: a missing tool must not break a copy that already reached layer 1.
- **No temp files.** Nothing is staged under `appHome()`.
- **`reveal()` keeps its detached subshell.** Herdr exposes no `show_item_in_folder`, so `xdg-open` / `open` / `explorer.exe` still run backgrounded with streams closed.

### Key binding

`keys.json` sets `terminal.ctrl-v` → `terminal.paste`. Herdr's default is `terminal.paste_image` (`defaults/keys.json:70`), which on a local terminal with no image in the clipboard forwards `^V` to the program instead of pasting (`src/terminal.rs:600-620`, `1209-1216`). Orca's Ctrl+V pastes, so the layout overrides it. `ctrl-shift-v` still pastes text from Herdr's defaults, and the image-file path still fires for a terminal on another machine only when bound to `paste_image`.

## Consequences

- Copy from any context menu now reaches other applications, and paste inside Herdr works from the same action.
- Copy latency is one `exec` round trip: measured 0.09 s for the shell, well inside the 30 s default timeout; the GPUI write is synchronous and lands first.
- No disk writes, no stale in-app clipboard.
- Clipboard writes remain text-only; image copy is not part of `copyText`.
- `wl-copy`/`xclip`/`pbcopy`/`powershell.exe` are now listed as executed programs in `RECIPE.md`. A system with none of them still gets in-app copy.
