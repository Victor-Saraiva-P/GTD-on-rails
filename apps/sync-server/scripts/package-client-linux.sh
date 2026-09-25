#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
version="${1:-$(tr -d '[:space:]' < "$repo_root/VERSION")}"
build_dir="$repo_root/apps/sync-server/build"
release_dir="$build_dir/client-release"
jpackage_dir="$build_dir/client-jpackage"
runtime_name="gtd-client-runtime"
package_name="GTD.on.Rails.Client_${version}_linux-x86_64"
package_dir="$release_dir/$package_name"
archive_path="$release_dir/$package_name.tar.gz"
jar_path="$build_dir/libs/gtd-sync-server.jar"

[[ -f "$jar_path" ]] || { echo "$jar_path is invalid; expected built sync client jar"; exit 1; }
command -v jpackage >/dev/null 2>&1 || { echo "jpackage is invalid; expected JDK 21 build tooling"; exit 127; }

rm -rf "$release_dir" "$jpackage_dir"
mkdir -p "$release_dir" "$jpackage_dir"

jpackage   --type app-image   --input "$build_dir/libs"   --main-jar gtd-sync-server.jar   --name "$runtime_name"   --app-version "$version"   --dest "$jpackage_dir"

mkdir -p "$package_dir"
cp -a "$jpackage_dir/$runtime_name" "$package_dir/runtime"
cp "$repo_root/apps/sync-server/scripts/gtd-client" "$package_dir/gtd-client"
cp "$repo_root/apps/sync-server/scripts/install-client-linux.sh" "$package_dir/install.sh"
printf '%s\n' "$version" > "$package_dir/VERSION"
chmod +x "$package_dir/gtd-client" "$package_dir/install.sh"

tar -C "$release_dir" -czf "$archive_path" "$package_name"
(cd "$release_dir" && sha256sum "$package_name.tar.gz" > "$package_name.tar.gz.sha256")
printf 'Created %s\n' "$archive_path"
