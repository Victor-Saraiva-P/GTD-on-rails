#!/usr/bin/env bash
set -euo pipefail

source_dir="$(dirname "$(readlink -f "$0")")"
install_dir="$HOME/.local/share/gtd-on-rails-client"
bin_dir="$HOME/.local/bin"
config_dir="$HOME/.config"
systemd_dir="$config_dir/systemd/user"
env_file="$config_dir/gtd-on-rails-client.env"
service_file="$systemd_dir/gtd-on-rails-client.service"
production_port="${GTD_SYNC_SERVER_PORT:-9475}"

read_env_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file
  tmp_file="${env_file}.tmp"
  if [[ -f "$env_file" ]]; then
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

[[ -x "$source_dir/runtime/bin/gtd-client-runtime" ]] || {
  echo "$source_dir/runtime/bin/gtd-client-runtime is invalid; expected bundled client runtime"
  exit 1
}

command -v tailscale >/dev/null 2>&1 || {
  echo "tailscale command is invalid; expected Tailscale installed for the production client"
  exit 127
}

tailscale_ip="$(tailscale ip -4 2>/dev/null | head -n 1)"
[[ -n "$tailscale_ip" ]] || {
  echo "Tailscale IPv4 address is unavailable; expected this machine to be connected to the tailnet"
  exit 1
}

tailscale_dns=""
if command -v jq >/dev/null 2>&1; then
  tailscale_dns="$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' | sed 's/\.$//')"
fi
public_host="${tailscale_dns:-$tailscale_ip}"
bind_address="${GTD_SYNC_SERVER_BIND_ADDRESS:-$tailscale_ip}"
public_base_url="${GTD_SYNC_SERVER_PUBLIC_BASE_URL:-http://$public_host:$production_port}"
health_url="${GTD_CLIENT_HEALTH_URL:-http://$bind_address:$production_port/health}"

mkdir -p "$install_dir" "$bin_dir" "$systemd_dir"
rm -rf "$install_dir/runtime"
cp -a "$source_dir/runtime" "$install_dir/runtime"
cp "$source_dir/gtd-client" "$install_dir/gtd-client"
cp "$source_dir/VERSION" "$install_dir/VERSION"
chmod +x "$install_dir/gtd-client"
ln -sf "$install_dir/gtd-client" "$bin_dir/gtd-client"

existing_token="$(read_env_value GTD_SYNC_SERVER_AUTH_TOKEN "$env_file" || true)"
auth_token="${GTD_SYNC_SERVER_AUTH_TOKEN:-$existing_token}"
if [[ -z "$auth_token" ]]; then
  auth_token="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

[[ -f "$env_file" ]] || printf '%s\n' '# GTD on Rails production sync client configuration.' > "$env_file"
set_env_value GTD_SYNC_SERVER_AUTH_TOKEN "$auth_token"
set_env_value GTD_SYNC_SERVER_BIND_ADDRESS "$bind_address"
set_env_value GTD_SYNC_SERVER_PORT "$production_port"
set_env_value GTD_SYNC_SERVER_PUBLIC_BASE_URL "$public_base_url"
set_env_value GTD_SYNC_SERVER_RCLONE_ENABLED "false"
set_env_value GTD_CLIENT_AUTO_UPDATE_ENABLED "true"
set_env_value GTD_CLIENT_HEALTH_URL "$health_url"
chmod 600 "$env_file"

cat > "$service_file" <<'EOF'
[Unit]
Description=GTD on Rails Sync Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-%h/.config/gtd-on-rails-client.env
Environment=GTD_CLIENT_INSTALL_DIR=%h/.local/share/gtd-on-rails-client
ExecStart=%h/.local/share/gtd-on-rails-client/gtd-client
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user enable --now gtd-on-rails-client.service
  printf 'Installed and started GTD on Rails production client service.\n'
  printf 'Endpoint: %s\n' "$public_base_url"
  printf 'Configuration: %s\n' "$env_file"
  printf 'Status: systemctl --user status gtd-on-rails-client.service\n'
else
  printf 'Installed GTD on Rails client. Run it with: %s/gtd-client\n' "$bin_dir"
fi
