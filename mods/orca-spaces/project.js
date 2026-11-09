// Project header marks. Orca uses the repo's icon image when set, otherwise Folder
// (`SectionHeader.tsx:327-342`, `repo-icon.tsx:145-186`).
import { svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { appHome, exec } from "herdr";

// T3's project colors in its order, each as Tailwind's 400 (dark themes) and 600 (light).
const PALETTE = [
  ["#9ca3af", "#4b5563"], ["#f87171", "#dc2626"], ["#fb923c", "#ea580c"], ["#fbbf24", "#d97706"],
  ["#facc15", "#ca8a04"], ["#a3e635", "#65a30d"], ["#4ade80", "#16a34a"], ["#34d399", "#059669"],
  ["#2dd4bf", "#0d9488"], ["#22d3ee", "#0891b2"], ["#38bdf8", "#0284c7"], ["#60a5fa", "#2563eb"],
  ["#818cf8", "#4f46e5"], ["#a78bfa", "#7c3aed"], ["#c084fc", "#9333ea"], ["#e879f9", "#c026d3"],
  ["#f472b6", "#db2777"], ["#fb7185", "#e11d48"],
];

// As T3: the name, folded, hashed into the palette, so a name has one color everywhere.
export function tint(name, dark) {
  const seed = name.normalize("NFKC").trim().toLocaleLowerCase("en-US") || "project";
  let i = 0;
  for (const g of seed) i = (i * 31 + g.codePointAt(0)) % PALETTE.length;
  return PALETTE[i][dark ? 0 : 1];
}

// RepoIconGlyph's fallback branch: lucide `Folder` at the tile's size, in the header's foreground.
// SectionHeader.tsx:328-338: a `size-4` (16px) slot holding RepoIconGlyph with
// `iconClassName="size-3.5"` (14px), colored by resolveProjectGroupHeaderColor ->
// resolveRepoHeaderColor, which returns DEFAULT_REPO_BADGE_COLOR (#737373) when the repo
// sets no badge color. That inline color wins over the wrapper's text-muted-foreground.
const REPO_BADGE_COLOR = "#737373";

// Remote URL parser: ports Orca's `parseRemoteRepo` and `cleanPath`
// (`remote-repo.ts:38-48`, `remote-repo.ts:138-192`).
// Handles protocol URLs (ssh://git@github.com:22/owner/repo.git, https://) without
// confusing ports with owners, and SCP-like syntax (git@github.com:owner/repo.git).
export function parseRemote(remoteUrl) {
  const trimmed = String(remoteUrl ?? "").trim().replace(/^git\+/, "");
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      const parts = url.pathname
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .replace(/\.git$/i, "")
        .split("/")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2 && /^[A-Za-z0-9_.-]+$/.test(parts[0]) && parts[1]) {
        return { host, owner: parts[0], repo: parts[1] };
      }
    } catch {
      return null;
    }
    return null;
  }

  const scp = trimmed.match(/^(?:[^@/:]+@)?([^:\s/]+):([^\s/]+)\/([^\s/]+?)(?:\.git)?\/?$/);
  if (scp && /^[A-Za-z0-9_.-]+$/.test(scp[2]) && scp[3]) {
    return { host: scp[1].toLowerCase(), owner: scp[2], repo: scp[3] };
  }
  return null;
}

export function avatarUrlFor({ host, owner }) {
  return /^[A-Za-z0-9-]+$/.test(owner) ? `https://${host}/${owner}.png?size=64` : null;
}

const avatarPath = (url) => `avatars/${url.replace(/[^A-Za-z0-9.-]+/g, "_")}.png`;
const avatarTried = new Set();
const avatarWritten = new Set();

// RepoIconGlyph prefers the repo's image; Herdr has no per-repo icon, so a repo whose origin
// names a GitHub owner gets Orca's owner avatar (`githubAvatarIcon`, `repo-icon.ts:46-54`).
// `image()` takes a path under the app folder, so the first sight downloads once to
// `avatars/<host>_<owner>.png`; a failed download leaves the lucide Folder, which is what
// `repo-icon.tsx:149-162` falls back to. QuickJS lacks Node's `fs/promises`, so filesystem
// checks and curl/convert run through `exec`. Herdr-app compiles `image` with `features = ["png"]`,
// so non-PNG avatar bytes from GitHub must convert to PNG.
export function ensureAvatar(url, cx) {
  if (!url || avatarTried.has(url)) return;
  avatarTried.add(url);
  const rel = avatarPath(url);
  const path = `${appHome()}/${rel}`;
  // `cx` here is the render's own handle, and the download outlives it: notifying through it
  // throws "cx is no longer valid: it was captured during an earlier call and used later".
  // Spawn so the notify belongs to a live callback, which is what that error asks for.
  cx.spawn(async (cx) => {
    try {
      const dir = `${appHome()}/avatars`;
      await exec("mkdir", ["-p", dir]);
      const check = await exec("test", ["-s", path]);
      if (check.code !== 0) {
        const tmp = `${path}.tmp`;
        const r = await exec("curl", ["-sfL", "--max-time", "10", url, "-o", tmp]);
        if (r.code !== 0) return;
        const conv = await exec("convert", [tmp, `png:${path}`]);
        if (conv.code !== 0) await exec("mv", [tmp, path]);
        else await exec("rm", ["-f", tmp]);
      }
      avatarWritten.add(url);
      cx.notify();
    } catch {}
  });
}

export function avatarFile(url) {
  return url && avatarWritten.has(url) ? avatarPath(url) : null;
}

// Orca's RepoIconGlyph uses the repo's own image or Folder (`SectionHeader.tsx:327-342`,
// `repo-icon.tsx:145-186`).
export function repoMark(size, avatarUrl) {
  const file = avatarFile(avatarUrl);
  return h_flex().size(size).flex_none().items_center().justify_center().rounded(4).overflow_hidden()
    .child(file
      ? image(file).size(size)
      : svg("mods/orca-spaces/folder.svg").size(14).text_color(REPO_BADGE_COLOR));
}
