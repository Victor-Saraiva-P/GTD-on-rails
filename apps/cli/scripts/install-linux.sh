#!/usr/bin/env bash
set -euo pipefail

source_dir="$(dirname "$(readlink -f "$0")")"
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gtd-on-rails-cli"
bin_dir="$HOME/.local/bin"

mkdir -p "$install_dir" "$bin_dir"
cp "$source_dir/gtd" "$install_dir/gtd"
chmod +x "$install_dir/gtd"
ln -sf "$install_dir/gtd" "$bin_dir/gtd"

if ! "$install_dir/gtd" agent configure-antigravity; then
  printf 'Warning: Antigravity GTD access setup did not complete; unrelated settings were left untouched.\n' >&2
fi
if ! "$install_dir/gtd" agent configure-codex; then
  printf 'Warning: Codex GTD access setup did not complete; unrelated settings were left untouched.\n' >&2
fi

printf 'Installed GTD agent CLI: %s/gtd\n' "$bin_dir"
printf 'Managed binary: %s/gtd\n' "$install_dir"
