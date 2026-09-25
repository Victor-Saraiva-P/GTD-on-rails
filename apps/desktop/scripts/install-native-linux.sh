#!/usr/bin/env bash
set -euo pipefail

source_dir="$(dirname "$(readlink -f "$0")")"
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gtd-on-rails"
bin_dir="$HOME/.local/bin"
desktop_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_file="$desktop_dir/gtd-on-rails.desktop"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}"
env_file="$config_dir/gtd-on-rails.env"
production_base_url="${GTD_SYNC_SERVER_BASE_URL:-http://pc-omarchy.tail010544.ts.net:9475}"

read_env_value() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 1
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file
  tmp_file="${env_file}.tmp"
  if [ -f "$env_file" ]; then
    awk -F= -v key="$key" -v value="$value" '
      BEGIN { replaced = 0 }
      $1 == key { print key "=" value; replaced = 1; next }
      { print }
      END { if (!replaced) print key "=" value }
    ' "$env_file" > "$tmp_file"
  else
    printf '%s=%s\n' "$key" "$value" > "$tmp_file"
  fi
  mv "$tmp_file" "$env_file"
}

command -v java >/dev/null 2>&1 || { echo "java is invalid; expected Java 21 installed"; exit 127; }

mkdir -p "$install_dir/binaries" "$bin_dir" "$desktop_dir" "$config_dir"
cp "$source_dir/gtd-on-rails" "$install_dir/gtd-on-rails"
cp "$source_dir/gtd-api" "$install_dir/gtd-api"
cp "$source_dir/binaries/gtd-api.jar" "$install_dir/binaries/gtd-api.jar"
cp "$source_dir/icon.png" "$install_dir/icon.png"
cp "$source_dir/gtd-on-rails-launcher" "$install_dir/gtd-on-rails-launcher"
chmod +x "$install_dir/gtd-on-rails" "$install_dir/gtd-api" "$install_dir/gtd-on-rails-launcher"

existing_token="$(read_env_value GTD_SYNC_SERVER_AUTH_TOKEN "$env_file" || true)"
client_env_file="${XDG_CONFIG_HOME:-$HOME/.config}/gtd-on-rails-client.env"
client_token="$(read_env_value GTD_SYNC_SERVER_AUTH_TOKEN "$client_env_file" || true)"
auth_token="${GTD_SYNC_SERVER_AUTH_TOKEN:-${existing_token:-$client_token}}"

if [ -z "$auth_token" ] && [ -t 0 ]; then
  read -r -s -p "GTD Sync Server bearer token: " auth_token
  printf '\n'
fi
[ -n "$auth_token" ] || {
  echo "GTD_SYNC_SERVER_AUTH_TOKEN is missing; pass it in the environment or install the production client first on this machine"
  exit 1
}

[ -f "$env_file" ] || printf '%s\n' '# GTD on Rails production desktop configuration.' > "$env_file"
set_env_value GTD_SYNC_SERVER_BASE_URL "$production_base_url"
set_env_value GTD_SYNC_SERVER_AUTH_TOKEN "$auth_token"
chmod 600 "$env_file"

ln -sf "$install_dir/gtd-on-rails-launcher" "$bin_dir/gtd-on-rails"

printf '%s\n' \
  '[Desktop Entry]' \
  'Type=Application' \
  'Name=GTD on Rails' \
  "Exec=$bin_dir/gtd-on-rails" \
  "Icon=$install_dir/icon.png" \
  'Terminal=false' \
  'Categories=Utility;' > "$desktop_file"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$desktop_dir" || true
printf 'Installed GTD on Rails. Run it with: %s/gtd-on-rails\n' "$bin_dir"
printf 'Sync endpoint: %s\n' "$production_base_url"
printf 'Configuration: %s\n' "$env_file"
