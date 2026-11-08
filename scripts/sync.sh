#!/bin/sh
# Copies this package into the running Herdr App.
# Real copies, not symlinks: Herdr doesn't load a mod's own SVGs through a symlink.
set -eu
src=$(cd "$(dirname "$0")/.." && pwd)
app=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
mkdir -p "$app/layouts" "$app/mods" "$app/themes" "$app/icons"

cp "$src"/layouts/orca.json "$src"/layouts/orca.svg "$app/layouts/"
cp "$src"/extras/themes/*.json "$app/themes/"
# The mark `extras/programs.json` names. The person's program table is settings, so it is
# documented there and never written here.
cp "$src"/extras/icons/*.svg "$app/icons/"

for m in "$src"/mods/*/; do
  [ -d "$m" ] || continue
  n=$(basename "$m")
  rm -rf "$app/mods/$n"
  cp -r "$m" "$app/mods/$n"
done

# Merge this layout's key section into the person's keys.json; every other
# section is left exactly as it was.
if [ -f "$app/keys.json" ]; then
  merged=$(python3 - "$src/keys.json" "$app/keys.json" <<'PY'
import json, sys
mine = json.load(open(sys.argv[1]))
theirs = json.load(open(sys.argv[2]))
for section, binds in mine.items():
    theirs.setdefault(section, {}).update(binds)
json.dump(theirs, open(sys.argv[2], "w"), indent=2)
PY
)
else
  cp "$src/keys.json" "$app/keys.json"
fi

echo "synced to $app"
