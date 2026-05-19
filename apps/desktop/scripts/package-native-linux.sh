#!/usr/bin/env bash
set -euo pipefail

version="${1:-$(node -p 'require("./package.json").version')}"
release_dir="src-tauri/target/release"
native_dir="$release_dir/native"
package_name="GTD.on.Rails_${version}_linux-x86_64"
package_dir="$native_dir/$package_name"
archive_path="$native_dir/$package_name.tar.gz"

test -x "$release_dir/desktop" || { echo "$release_dir/desktop is invalid; expected built Tauri binary"; exit 1; }
test -x "$release_dir/gtd-api" || { echo "$release_dir/gtd-api is invalid; expected built sidecar launcher"; exit 1; }
test -f "$release_dir/binaries/gtd-api.jar" || { echo "$release_dir/binaries/gtd-api.jar is invalid; expected backend jar"; exit 1; }

rm -rf "$native_dir"
mkdir -p "$package_dir/binaries"

cp "$release_dir/desktop" "$package_dir/gtd-on-rails"
cp "$release_dir/gtd-api" "$package_dir/gtd-api"
cp "$release_dir/binaries/gtd-api.jar" "$package_dir/binaries/gtd-api.jar"
cp "src-tauri/icons/icon.png" "$package_dir/icon.png"
cp "scripts/install-native-linux.sh" "$package_dir/install.sh"
chmod +x "$package_dir/gtd-on-rails" "$package_dir/gtd-api" "$package_dir/install.sh"

tar -C "$native_dir" -czf "$archive_path" "$package_name"
sha256sum "$archive_path" > "$archive_path.sha256"
printf 'Created %s\n' "$archive_path"
