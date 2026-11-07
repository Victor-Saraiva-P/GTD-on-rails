#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Install a staging-only release updater and periodic systemd --user timer.
target="$1"
source_script="$2"
home="$HOME"
systemd_dir="$home/.config/systemd/user"

fail() { printf 'Staging timer installation refused: %s\n' "$*" >&2; exit 1; }
[[ "$EUID" -ne 0 ]] || fail "Use the unprivileged desktop/server account"
[[ -f "$source_script" && ! -L "$source_script" ]] || fail "Expected a regular updater source file"

case "$target" in
  desktop)
    destination="$home/.local/share/gtd-on-rails-staging-updater/staging-release-updater.py"
    unit_name=gtd-on-rails-staging-update
    [[ -x "$home/.local/share/gtd-on-rails-staging/gtd-on-rails" ]] ||
      fail "Staging desktop is not installed"
    interval=20min
    ;;
  server)
    destination="$home/.local/share/gtd-on-rails-client-staging-updater/staging-release-updater.py"
    unit_name=gtd-on-rails-client-staging-update
    [[ "$(hostname -s)" == solanum ]] || fail "Server updater only supports Solanum"
    systemctl --user is-active --quiet gtd-on-rails-client.service ||
      fail "Production must already be healthy"
    [[ -x "$home/.local/share/gtd-on-rails-client-staging/gtd-client" ]] ||
      fail "Staging sync server is not installed"
    interval=15min
    ;;
  *)
    fail "Unknown target '$target'; expected desktop or server"
    ;;
esac

unit="$systemd_dir/$unit_name.service"
timer="$systemd_dir/$unit_name.timer"
[[ ! -L "$unit" && ! -L "$timer" && ! -L "$destination" ]] ||
  fail "Refusing symlinked updater paths"
install -d -m 0700 "$systemd_dir" "$(dirname "$destination")"
install -m 0600 "$source_script" "$destination"

cat > "$unit" <<UNIT
# Managed by GTD on Rails isolated staging updater
[Unit]
Description=Check GTD on Rails $target staging candidate
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 %h/.local/share/$(basename "$(dirname "$destination")")/staging-release-updater.py --target $target --apply
Environment=PYTHONDONTWRITEBYTECODE=1
UMask=0077
NoNewPrivileges=true
TimeoutStartSec=600
UNIT
cat > "$timer" <<UNIT
# Managed by GTD on Rails isolated staging updater
[Unit]
Description=Periodic GTD on Rails $target staging candidate checks

[Timer]
OnBootSec=3min
OnUnitActiveSec=$interval
RandomizedDelaySec=60sec
AccuracySec=1min
Unit=$unit_name.service

[Install]
WantedBy=timers.target
UNIT
chmod 0600 "$unit" "$timer"
systemctl --user daemon-reload
systemctl --user enable --now "$unit_name.timer"
echo "Staging $target update timer enabled: $unit_name.timer"
