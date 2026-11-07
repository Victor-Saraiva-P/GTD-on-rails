#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

version="$(node -p 'require("./package.json").version')"
release_dir="src-tauri/target/release"
native_dir="$release_dir/staging-native"
package_name="GTD.on.Rails.Staging_$version""_linux-x86_64"
package_dir="$native_dir/$package_name"
archive="$native_dir/$package_name.tar.gz"
revision="${GTD_BUILD_REVISION:-local-$(git rev-parse HEAD)}"
logo="../../docs/assets/logo.svg"

[[ -x "$release_dir/desktop" ]] || { echo "Staging desktop binary missing" >&2; exit 1; }
[[ -x "$release_dir/gtd-api" ]] || { echo "Staging sidecar launcher missing" >&2; exit 1; }
[[ -f "$release_dir/binaries/gtd-api.jar" ]] || { echo "Staging backend JAR missing" >&2; exit 1; }
[[ -f "$logo" ]] || { echo "App icon missing" >&2; exit 1; }

if [[ -d "$native_dir" ]]; then
  echo "An existing staging native package must be reviewed before replacement" >&2
  exit 1
fi
mkdir -p "$package_dir/binaries"
install -m 0755 "$release_dir/desktop" "$package_dir/gtd-on-rails"
install -m 0755 "$release_dir/gtd-api" "$package_dir/gtd-api"
install -m 0600 "$release_dir/binaries/gtd-api.jar" "$package_dir/binaries/gtd-api.jar"
install -m 0755 scripts/gtd-on-rails-staging-launcher "$package_dir/gtd-on-rails-launcher"
install -m 0755 scripts/install-staging-native-linux.sh "$package_dir/install.sh"
sed -n 's/.*base64,\([^"]*\).*/\1/p' "$logo" | base64 -d > "$package_dir/icon.png"
[[ -s "$package_dir/icon.png" ]] || { echo "App icon not decoded" >&2; exit 1; }
printf '%s\n' "$version" > "$package_dir/VERSION"

printf '%s\n' "$revision" > "$package_dir/REVISION"

tar -C "$native_dir" -czf "$archive" "$package_name"
(cd "$native_dir" && sha256sum "$package_name.tar.gz" > "$package_name.tar.gz.sha256")
echo "Staging native package: $archive"
