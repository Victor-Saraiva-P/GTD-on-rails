#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
cli_dir="$repo_root/apps/cli"
version="${1:-$(cat "$repo_root/VERSION")}"
release_dir="$cli_dir/target/release"
package_root="$cli_dir/target/release-package"
package_name="GTD.on.Rails.CLI_${version}_linux-x86_64"
package_dir="$package_root/$package_name"
archive_path="$package_root/$package_name.tar.gz"

cargo build --locked --release --manifest-path "$cli_dir/Cargo.toml"
test -x "$release_dir/gtd" || { echo "$release_dir/gtd is invalid; expected built GTD CLI"; exit 1; }

rm -rf "$package_root"
mkdir -p "$package_dir"
cp "$release_dir/gtd" "$package_dir/gtd"
cp "$cli_dir/scripts/install-linux.sh" "$package_dir/install.sh"
printf '%s\n' "$version" > "$package_dir/VERSION"
chmod +x "$package_dir/gtd" "$package_dir/install.sh"

tar -C "$package_root" -czf "$archive_path" "$package_name"
(cd "$package_root" && sha256sum "$package_name.tar.gz" > "$package_name.tar.gz.sha256")
printf 'Created %s\n' "$archive_path"
