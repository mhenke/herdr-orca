// Marks for the Projects list. Orca's RepoIconGlyph draws a lucide icon, `Folder` by default,
// and only uses an image when the user set one on the repo. Herdr stores no per-space icon, so
// every repo draws the folder; scraping favicons off disk (T3's ProjectFavicon) put site logos
// in the header, which Orca never shows.
import { svg } from "gpui-kit";
import { h_flex } from "gpui-base";

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

export function repoMark(s, size, t, ps) {
  return h_flex().size(size).flex_none().items_center().justify_center()
    .child(svg("mods/orca-spaces/folder.svg").size(14).text_color(REPO_BADGE_COLOR));
}
