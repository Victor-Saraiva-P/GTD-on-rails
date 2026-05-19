#!/usr/bin/env bash
set -euo pipefail

source_dir="$(dirname "$(readlink -f "$0")")"
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gtd-on-rails"
bin_dir="$HOME/.local/bin"
desktop_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_file="$desktop_dir/gtd-on-rails.desktop"

command -v java >/dev/null 2>&1 || { echo "java is invalid; expected Java 21 installed"; exit 127; }

mkdir -p "$install_dir/binaries" "$bin_dir" "$desktop_dir"
cp "$source_dir/gtd-on-rails" "$install_dir/gtd-on-rails"
cp "$source_dir/gtd-api" "$install_dir/gtd-api"
cp "$source_dir/binaries/gtd-api.jar" "$install_dir/binaries/gtd-api.jar"
cp "$source_dir/icon.png" "$install_dir/icon.png"
chmod +x "$install_dir/gtd-on-rails" "$install_dir/gtd-api"
ln -sf "$install_dir/gtd-on-rails" "$bin_dir/gtd-on-rails"

printf '%s\n' \
  '[Desktop Entry]' \
  'Type=Application' \
  'Name=GTD on Rails' \
  "Exec=$install_dir/gtd-on-rails" \
  "Icon=$install_dir/icon.png" \
  'Terminal=false' \
  'Categories=Utility;' > "$desktop_file"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$desktop_dir" || true
printf 'Installed GTD on Rails. Run it with: %s/gtd-on-rails\n' "$bin_dir"
