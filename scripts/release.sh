#!/usr/bin/env bash
# Release workflow script for herdr-orca.
# Runs pre-flight verification, generates/updates CHANGELOG.md via git-cliff,
# commits, tags the release, and optionally creates a GitHub Release.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<EOF
Usage: $(basename "$0") <version> [options]

Arguments:
  <version>         SemVer version string (e.g. 0.1.0 or v0.1.0)

Options:
  --dry-run         Run checks and show changelog diff without committing or tagging
  --skip-checks     Skip herdr-app check and node --check
  --push            Push commit and tag to origin after tagging
  --github-release  Create GitHub release via gh CLI
  -h, --help        Show this help message
EOF
  exit 1
}

VERSION=""
DRY_RUN=false
SKIP_CHECKS=false
PUSH=false
GH_RELEASE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --push) PUSH=true; shift ;;
    --github-release) GH_RELEASE=true; shift ;;
    -h|--help) usage ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage
      fi
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Error: Version argument required (e.g. 0.1.0)." >&2
  usage
fi

# Normalize version to strip leading 'v' for standard formatting, but tag with 'v'
VERSION="${VERSION#v}"
TAG="v${VERSION}"

echo "==> Preparing release ${TAG}..."

# 1. Pre-flight verification
if [[ "$SKIP_CHECKS" = false ]]; then
  echo "==> Running syntax checks (node --check)..."
  for f in mods/*/main.js; do
    [[ -f "$f" ]] && node --check "$f"
  done
  echo "    Syntax ok."

  if command -v herdr-app >/dev/null 2>&1; then
    echo "==> Running mod validation (herdr-app check)..."
    for m in mods/*; do
      [[ -d "$m" ]] && herdr-app check "$m" >/dev/null
    done
    echo "    All mods passed herdr-app check."
  else
    echo "    herdr-app not found in PATH, skipping mod check."
  fi
fi

# 2. Check git status
if [[ "$DRY_RUN" = false ]]; then
  # Allow CHANGELOG.md and cliff.toml to be dirty, but other files should be clean
  DIRTY_FILES=$(git status --porcelain | grep -v "CHANGELOG.md" | grep -v "cliff.toml" || true)
  if [[ -n "$DIRTY_FILES" ]]; then
    echo "Warning: You have uncommitted changes in your working tree:" >&2
    echo "$DIRTY_FILES" >&2
    read -r -p "Continue anyway? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Aborted." >&2
      exit 1
    fi
  fi
fi

# 3. Check tag existence
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Git tag $TAG already exists!" >&2
  exit 1
fi

# 4. Generate CHANGELOG.md
echo "==> Generating changelog for ${TAG}..."
if [[ "$DRY_RUN" = true ]]; then
  uvx git-cliff --tag "$TAG" --unreleased
  echo "==> [Dry run] Completed without making commits or tags."
  exit 0
fi

uvx git-cliff --tag "$TAG" -o CHANGELOG.md
echo "    CHANGELOG.md updated."

# 5. Commit and tag
echo "==> Creating release commit and tag..."
git add CHANGELOG.md cliff.toml
git commit -m "chore(release): ${TAG}"
git tag -a "$TAG" -m "Release ${TAG}"
echo "    Created tag ${TAG}."

# 6. Push if requested
if [[ "$PUSH" = true ]]; then
  echo "==> Pushing commit and tag to origin..."
  git push origin HEAD
  git push origin "$TAG"
fi

# 7. GitHub Release if requested
if [[ "$GH_RELEASE" = true ]]; then
  if command -v gh >/dev/null 2>&1; then
    echo "==> Creating GitHub Release for ${TAG}..."
    NOTES_FILE=$(mktemp)
    uvx git-cliff --tag "$TAG" --latest --strip header > "$NOTES_FILE"
    gh release create "$TAG" \
      --title "${TAG}" \
      --notes-file "$NOTES_FILE"
    rm -f "$NOTES_FILE"
    echo "    GitHub Release created: https://github.com/mhenke/herdr-orca/releases/tag/${TAG}"
  else
    echo "Warning: gh CLI not found. Skipping GitHub Release creation." >&2
  fi
fi

echo "==> Release ${TAG} completed successfully!"
EOF
