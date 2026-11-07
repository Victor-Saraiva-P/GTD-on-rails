#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Install a separately compiled staging desktop, never the production installer.
home="$HOME"
install_dir="$home/.local/share/gtd-on-rails-staging"
launcher="$home/.local/bin/gtd-on-rails-staging"
entry="$home/.local/share/applications/gtd-on-rails-staging.desktop"
config="$home/.config/gtd-on-rails-staging.env"
stage_url="http://solanum.tail010544.ts.net:9476"
prod_url="http://solanum.tail010544.ts.net:9475"
data_dir="$home/Documents/staging-gtd-on-rails"
package_dir="$(cd "$(dirname "$0")" && pwd)"
revision="$(cat "$package_dir/REVISION")"

fail() { printf 'Staging desktop installation refused: %s\n' "$*" >&2; exit 1; }

preflight() {
  [[ -n "$home" && "$home" != / ]] || fail "HOME is invalid"
  [[ "$install_dir" != "$home/.local/share/gtd-on-rails" ]] || fail "Production install path"
  [[ ! -L "$config" && ! -L "$install_dir" && ! -L "$data_dir" ]] || fail "Staging symlink"
  for file in gtd-on-rails gtd-api binaries/gtd-api.jar REVISION VERSION icon.png; do
    [[ -f "$package_dir/$file" ]] || fail "Missing package file $file"
  done
  command -v ssh >/dev/null || fail "OpenSSH is required for staging credential transfer"
  command -v jq >/dev/null || fail "jq is required for remote identity verification"
  # Solanum endpoint is tailnet-only: WireGuard encrypts this HTTP hop.
  curl -fsS --connect-timeout 5 --max-time 15 "$stage_url/health" | jq -e '.status == "UP"' >/dev/null || fail "Solanum staging health check failed" # NOSONAR - encrypted Tailscale tunnel
}

credential() {
  local line
  line="$(ssh -o BatchMode=yes -o ConnectTimeout=10 victor@solanum \
    "grep -m1 '^GTD_SYNC_SERVER_AUTH_TOKEN=' /home/victor/.config/gtd-on-rails-client-staging.env")"
  [[ "$line" == GTD_SYNC_SERVER_AUTH_TOKEN=* ]] || fail "Missing Solanum staging token"
  local token
  token="$(printf '%s' "$line" | cut -d= -f2-)"
  [[ "$token" =~ ^[a-f0-9]{64}$ ]] || fail "Invalid Solanum staging token"
  # Bearer authorization traverses the encrypted private Tailnet, not public HTTP.
  curl -fsS --connect-timeout 5 --max-time 15 -H "Authorization: Bearer $token" "$stage_url/v1/backups/environment" | jq -e '.environment == "staging"' >/dev/null || fail "Remote API is not staging" # NOSONAR - encrypted Tailscale tunnel
  printf '%s' "$token"
}

write_config() {
  if [[ -e "$config" ]]; then
    [[ "$(stat -c '%a' "$config")" == 600 ]] || fail "Existing config lacks 0600 permissions"
    if ! grep -Fxq "GTD_SYNC_SERVER_BASE_URL=$stage_url" "$config"; then # NOSONAR - tailnet-only HTTP URL
      fail "Existing config does not point to Solanum staging"
    fi
    return
  fi
  local token="$1" temporary
  mkdir -p "$home/.config"
  temporary="$(mktemp "$home/.config/gtd-on-rails-staging.env.XXXXXXXX")"
  {
    printf 'GTD_SYNC_SERVER_AUTH_TOKEN=%s\n' "$token"
    printf 'GTD_SYNC_SERVER_BASE_URL=%s\n' "$stage_url" # NOSONAR - Tailscale encrypts the configured HTTP transport
    printf 'GTD_PRODUCTION_SYNC_SERVER_BASE_URL=%s\n' "$prod_url" # NOSONAR - production reference over the encrypted Tailnet
    printf 'GTD_DATA_ROOT_DIRECTORY=%s\n' "$data_dir"
    printf '%s\n' 'GTD_DATABASE_ENVIRONMENT=STAGING' 'GTD_SIDECAR_PROFILES=staging,sidecar'
    printf '%s\n' 'GTD_SYNC_SERVER_ENABLED=true' 'GTD_SYNC_RCLONE_ENABLED=false'
    printf '%s\n' 'GTD_CLIENT_AUTO_UPDATE_ENABLED=false'
  } > "$temporary"
  chmod 0600 "$temporary"
  mv "$temporary" "$config"
}

install_files() {
  if [[ -e "$install_dir" ]]; then
    [[ -f "$install_dir/REVISION" ]] || fail "Existing staging install not recognized"
    [[ "$(cat "$install_dir/REVISION")" == "$revision" ]] ||
      fail "Staging installation uses another revision; upgrade requires explicit review"
    return
  fi
  mkdir -p "$install_dir/binaries"
  install -m 0755 "$package_dir/gtd-on-rails" "$install_dir/gtd-on-rails"
  install -m 0755 "$package_dir/gtd-api" "$install_dir/gtd-api"
  install -m 0600 "$package_dir/binaries/gtd-api.jar" "$install_dir/binaries/gtd-api.jar"
  install -m 0644 "$package_dir/icon.png" "$install_dir/icon.png"
  install -m 0600 "$package_dir/REVISION" "$package_dir/VERSION" "$install_dir/"
}

desktop_integration() {
  mkdir -p "$home/.local/bin" "$home/.local/share/applications" "$data_dir"
  chmod 0700 "$data_dir"
  ln -sfn "$install_dir/gtd-on-rails-launcher" "$launcher"
  {
    echo '[Desktop Entry]'
    echo 'Type=Application'
    echo 'Name=GTD on Rails (Staging)'
    printf 'Exec=%s\n' "$launcher"
    printf 'Icon=%s/icon.png\n' "$install_dir"
    echo 'Terminal=false'
    echo 'Categories=Utility;'
    echo 'StartupNotify=true'
  } > "$entry"
  command -v update-desktop-database >/dev/null &&
    update-desktop-database "$home/.local/share/applications" || true
}

main() {
  preflight
  local token
  token="$(credential)"
  install_files
  install -m 0755 "$package_dir/gtd-on-rails-launcher" "$install_dir/gtd-on-rails-launcher"
  write_config "$token"
  unset token
  desktop_integration
  echo "Staging desktop installed at $install_dir (revision $revision)"
  echo "Launcher: $launcher"
  echo "Server: Solanum via Tailscale (port 9476)"
}
main "$@"
