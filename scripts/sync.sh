#!/bin/sh
# Copies this package into the running Herdr App.
# Real copies, not symlinks: Herdr doesn't load a mod's own SVGs through a symlink.
set -eu
src=$(cd "$(dirname "$0")/.." && pwd)
app=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
mkdir -p "$app/layouts" "$app/mods" "$app/themes"

cp "$src"/layouts/orca.json "$src"/layouts/orca.svg "$app/layouts/"
cp "$src"/extras/themes/*.json "$app/themes/"
for m in "$src"/mods/*/; do
  [ -d "$m" ] || continue
  n=$(basename "$m")
  rm -rf "$app/mods/$n"
  cp -r "$m" "$app/mods/$n"
done
echo "synced to $app"
