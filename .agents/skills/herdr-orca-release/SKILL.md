---
name: herdr-orca-release
description: Use when cutting a release, publishing herdr-orca to Herdr Community, or generating CHANGELOG.md.
---

# Herdr Orca Release

Process, automation, and gates for cutting releases, generating changelogs, and publishing `herdr-orca` updates.

## Information Hierarchy & Roles

Distribution combines two independent mechanisms:
1. **Continuous Community Discovery**: `herdr.dev/layouts` crawls the `master` branch of public repositories carrying the `herdr-layout` topic within 60 minutes of push.
2. **SemVer Milestones & Archives**: Git tags (`vX.Y.Z`) and GitHub Releases provide stable checkpoints, upgrade guidance in `CHANGELOG.md`, and distribution archives (`.tar.gz`/`.zip`) without requiring downstream git clones.

---

## Quick Reference

| Task | Command | Completion Check |
|---|---|---|
| **Dry Run** | `./scripts/release.sh --dry-run <version>` | Exit code 0, preview prints valid categories |
| **Cut Local Release** | `./scripts/release.sh <version>` | Tag `v<version>` created, `CHANGELOG.md` committed |
| **Publish Release** | `./scripts/release.sh <version> --push --github-release` | GitHub release live, assets attached |
| **Mod Check** | `for m in mods/*; do [ -d "$m" ] && herdr-app check "$m"; done` | All mods output `check passed` |
| **Syntax Check** | `for f in mods/*/main.js; do node --check "$f"; done` | Exit code 0 across all files |
| **Direct Changelog** | `uvx git-cliff --tag v<version> -o CHANGELOG.md` | `CHANGELOG.md` updated |

---

## Release Procedure

Follow these five steps in exact order. Do not skip or reorder steps.

### Step 1: Pre-Flight Verification

Run the full verification suite against all mod entrypoints and repository state:

```sh
# 1. Validate JavaScript syntax
for f in mods/*/main.js; do
  node --check "$f"
done

# 2. Validate Herdr mod manifests and exports
for m in mods/*; do
  [ -d "$m" ] && herdr-app check "$m"
done

# 3. Check for uncommitted changes
git status --porcelain
```

**Completion criterion:** `node --check` and `herdr-app check` exit 0 on all mod entrypoints; `git status --porcelain` is clean (or contains only dirty `CHANGELOG.md`/`cliff.toml` to be committed by the release runner).

---

### Step 2: Version Determination

Select the target SemVer version (`X.Y.Z`) based on commits since the latest git tag:
- **PATCH** (`0.1.0` → `0.1.1`): Bug fixes, layout tweaks, comment trims, docs.
- **MINOR** (`0.1.0` → `0.2.0`): New features, new mod additions, parity expansions, new non-breaking keybindings.
- **MAJOR** (`0.1.0` → `1.0.0`): Breaking changes to layout schema, mod removals, breaking key changes.

Inspect the automatic bump recommendation from commit history:
```sh
uvx git-cliff --bumped-version
```

Verify that the target tag does not already exist:
```sh
git rev-parse "v<version>" 2>/dev/null && echo "Tag exists!" || echo "Tag available"
```

**Completion criterion:** A unique SemVer string `X.Y.Z` is selected whose git tag `v<version>` does not exist in `git tag -l`.

---

### Step 3: Changelog Preview (Dry Run)

Run the release script in dry-run mode:

```sh
./scripts/release.sh --dry-run <version>
```

Inspect the generated changelog preview:
1. Verify commit entries fall into standard categories: `Features`, `Bug Fixes`, `Documentation`, `Styling`, `Refactoring`.
2. Verify commit scopes match affected components (e.g. `orca-spaces`, `orca-tabs`, `orca-files`).
3. Confirm unparsed multi-line bodies do not leak into bullet points.

**Completion criterion:** Dry-run exits 0, and changelog preview adheres to Keep a Changelog formatting without orphaned or unparsed text.

---

### Step 4: Execute Release & Tagging

Execute the release runner to update `CHANGELOG.md`, create the release commit, and tag the commit:

```sh
# Local commit and tag:
./scripts/release.sh <version>

# Or with immediate push and GitHub Release creation:
./scripts/release.sh <version> --push --github-release
```

**Completion criterion:**
- `CHANGELOG.md` contains the new `## [<version>] - YYYY-MM-DD` header.
- `git log -1 --oneline` shows commit `chore(release): v<version>`.
- `git tag -l "v<version>"` confirms the annotated tag exists locally.

---

### Step 5: Publishing & Upstream Verification

If `--push` and `--github-release` were omitted in Step 4, push and publish manually:

```sh
# Push branch and tags
git push origin master
git push origin "v<version>"

# Create GitHub Release
NOTES_FILE=$(mktemp)
uvx git-cliff --tag "v<version>" --latest --strip header > "$NOTES_FILE"
gh release create "v<version>" --title "v<version>" --notes-file "$NOTES_FILE"
rm -f "$NOTES_FILE"
```

Verify published artifacts:
```sh
# 1. Verify GitHub Release and attached archives (.tar.gz and .zip)
gh release view "v<version>"

# 2. Verify Herdr Community topic
gh repo view mhenke/herdr-orca --json repositoryTopics
```

**Completion criterion:** `gh release view "v<version>"` shows the release with release notes and workflow-attached archives; repository topics include `herdr-layout`.

---

## Conventional Commits & Changelog Rules

`cliff.toml` parses Conventional Commits into structured sections:

```
<type>(<scope>): <short imperative description>
```

### Types & Changelog Mapping

| Commit Type | Scope Required? | Changelog Section |
|---|---|---|
| `feat` | Recommended | `Features` |
| `fix` | Recommended | `Bug Fixes` |
| `perf` | Recommended | `Performance` |
| `refactor` | Recommended | `Refactoring` |
| `style` | Optional | `Styling` |
| `docs` | Optional | `Documentation` |
| `chore` | `release` only | Excluded (except release notes) |

### Canonical Scopes

Use the affected mod or component folder:
- `orca-spaces` (sidebar projects, worktree tree, avatars)
- `orca-tabs` (tab strip, active indicators, titles, controls)
- `orca-files` (right-panel file tree, name filter, rg search)
- `orca-chrome` (window borders, titlebar left controls, footer)
- `orca-float` (floating workspace panel)
- `orca-landing` (welcome landing view)
- `orca-menu` (context menus, clipboard integration)
- `orca-nav` (sidebar search, navigation rows, projects header)
- `orca-pane` (terminal pane header, split controls)
- `orca-changes` (git staging, diffs, commits)
- `orca-status` (bottom status bar)
- `sync` (`scripts/sync.sh` installer)
- `layout` (`layouts/orca.json`)
- `theme` (`extras/themes/`)

---

## Invariants & Guardrails

1. **Package Shape Invariant (`herdr-t3` parity)**:
   - Permitted files: `layouts/`, `mods/`, `keys.json`, `extras/themes/`, `scripts/`, `README.md`, `RECIPE.md`, `CHANGELOG.md`, `preview.png`.
   - Never add `package.json`, `package-lock.json`, or `node_modules` to the repository. All tooling runs via `uvx`, `gh`, `node`, or `herdr-app`.
2. **Clean Working Tree**:
   - Never run release tagging with uncommitted code modifications.
3. **Automated Changelog Integrity**:
   - Maintain `CHANGELOG.md` exclusively through `git-cliff` (`cliff.toml`). Do not manually fabricate release sections or version links.
4. **Herdr Layout Topic**:
   - Ensure `mhenke/herdr-orca` carries the `herdr-layout` GitHub topic so `herdr.dev/layouts` crawler includes the layout.
