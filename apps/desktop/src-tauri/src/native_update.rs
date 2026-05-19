use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/latest";
const ARCHIVE_SUFFIX: &str = "linux-x86_64.tar.gz";
const CHECKSUM_SUFFIX: &str = "linux-x86_64.tar.gz.sha256";
const UPDATE_SCRIPT_TEMPLATE: &str = r#"#!/usr/bin/env bash
set -euo pipefail
cache_dir={cache_dir}
archive_name={archive_name}
checksum_name={checksum_name}
archive_url={archive_url}
checksum_url={checksum_url}
current_pid={current_pid}
install_root="$cache_dir/extracted"
install_dir="$HOME/.local/share/gtd-on-rails"
next_dir="$HOME/.local/share/gtd-on-rails.next"
previous_dir="$HOME/.local/share/gtd-on-rails.previous"
while kill -0 "$current_pid" >/dev/null 2>&1; do sleep 0.2; done
rm -rf "$install_root" "$next_dir"
mkdir -p "$cache_dir" "$install_root" "$next_dir/binaries"
curl -fL "$archive_url" -o "$cache_dir/$archive_name"
curl -fL "$checksum_url" -o "$cache_dir/$checksum_name"
(cd "$cache_dir" && sha256sum -c "$checksum_name")
tar -xzf "$cache_dir/$archive_name" -C "$install_root"
package_dir="$(find "$install_root" -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)"
test -x "$package_dir/gtd-on-rails"
test -x "$package_dir/gtd-api"
test -f "$package_dir/binaries/gtd-api.jar"
cp "$package_dir/gtd-on-rails" "$next_dir/gtd-on-rails"
cp "$package_dir/gtd-api" "$next_dir/gtd-api"
cp "$package_dir/binaries/gtd-api.jar" "$next_dir/binaries/gtd-api.jar"
cp "$package_dir/icon.png" "$next_dir/icon.png"
chmod +x "$next_dir/gtd-on-rails" "$next_dir/gtd-api"
rm -rf "$previous_dir"
if [ -d "$install_dir" ]; then cp -a "$install_dir" "$previous_dir"; fi
mkdir -p "$install_dir/binaries" "$HOME/.local/bin" "$HOME/.local/share/applications"
cp "$next_dir/binaries/gtd-api.jar" "$install_dir/binaries/gtd-api.jar.tmp"
mv "$install_dir/binaries/gtd-api.jar.tmp" "$install_dir/binaries/gtd-api.jar"
cp "$next_dir/gtd-api" "$install_dir/gtd-api.tmp"
mv "$install_dir/gtd-api.tmp" "$install_dir/gtd-api"
cp "$next_dir/icon.png" "$install_dir/icon.png.tmp"
mv "$install_dir/icon.png.tmp" "$install_dir/icon.png"
cp "$next_dir/gtd-on-rails" "$install_dir/gtd-on-rails.tmp"
mv "$install_dir/gtd-on-rails.tmp" "$install_dir/gtd-on-rails"
chmod +x "$install_dir/gtd-on-rails" "$install_dir/gtd-api"
ln -sf "$install_dir/gtd-on-rails" "$HOME/.local/bin/gtd-on-rails"
printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=GTD on Rails' "Exec=$install_dir/gtd-on-rails" "Icon=$install_dir/icon.png" 'Terminal=false' 'Categories=Utility;' > "$HOME/.local/share/applications/gtd-on-rails.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" || true
rm -rf "$next_dir"
nohup "$HOME/.local/bin/gtd-on-rails" >/dev/null 2>&1 &
"#;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUpdateStatus {
    available: bool,
    current_version: String,
    latest_version: String,
    archive_name: Option<String>,
    archive_url: Option<String>,
    checksum_name: Option<String>,
    checksum_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUpdateRequest {
    latest_version: String,
    archive_name: String,
    archive_url: String,
    checksum_name: String,
    checksum_url: String,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[tauri::command]
pub fn native_update_check() -> Result<NativeUpdateStatus, String> {
    recover_native_installation()?;
    let release = fetch_latest_release()?;
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let latest_version = release_tag_version(&release.tag_name)?;
    if !is_newer_version(&latest_version, &current_version)? {
        return Ok(no_update_status(current_version, latest_version));
    }
    build_update_status(current_version, latest_version, &release.assets)
}

fn recover_native_installation() -> Result<(), String> {
    let install_dir = local_share_dir("gtd-on-rails")?;
    let next_dir = local_share_dir("gtd-on-rails.next")?;
    let previous_dir = local_share_dir("gtd-on-rails.previous")?;
    remove_abandoned_next_dir(&next_dir)?;
    if native_installation_is_valid(&install_dir) || !native_installation_is_valid(&previous_dir) {
        return Ok(());
    }
    restore_previous_installation(&install_dir, &previous_dir)
}

fn remove_abandoned_next_dir(next_dir: &std::path::Path) -> Result<(), String> {
    if !next_dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(next_dir).map_err(|error| {
        format!(
            "native update staging value '{}' is invalid; expected removable directory: {error}",
            next_dir.display()
        )
    })
}

fn restore_previous_installation(
    install_dir: &std::path::Path,
    previous_dir: &std::path::Path,
) -> Result<(), String> {
    if install_dir.exists() {
        fs::remove_dir_all(install_dir).map_err(|error| {
            format!("native install directory value '{}' is invalid; expected removable partial install: {error}", install_dir.display())
        })?;
    }
    fs::rename(previous_dir, install_dir).map_err(|error| {
        format!("native backup directory value '{}' is invalid; expected restorable install backup: {error}", previous_dir.display())
    })
}

fn native_installation_is_valid(path: &std::path::Path) -> bool {
    path.join("gtd-on-rails").is_file()
        && path.join("gtd-api").is_file()
        && path.join("binaries/gtd-api.jar").is_file()
}

fn local_share_dir(name: &str) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|error| format!("HOME value is invalid; expected home directory: {error}"))?;
    Ok(PathBuf::from(home).join(".local/share").join(name))
}

#[tauri::command]
pub fn native_update_install(app: AppHandle, request: NativeUpdateRequest) -> Result<(), String> {
    let script_path = write_update_script(&request)?;
    Command::new("bash")
        .arg(script_path)
        .spawn()
        .map_err(|error| format!("bash command failed for native update script; expected spawned updater process: {error}"))?;
    app.exit(0);
    Ok(())
}

fn fetch_latest_release() -> Result<GitHubRelease, String> {
    let body = curl_text(LATEST_RELEASE_URL)?;
    serde_json::from_str(&body).map_err(|error| {
        format!("GitHub latest release payload is invalid; expected release JSON: {error}")
    })
}

fn curl_text(url: &str) -> Result<String, String> {
    let output = Command::new("curl")
        .args(["-fsSL", "-H", "User-Agent: GTD-on-Rails", url])
        .output()
        .map_err(|error| {
            format!("curl command failed for '{url}'; expected HTTP response: {error}")
        })?;
    if output.status.success() {
        return String::from_utf8(output.stdout)
            .map_err(|error| format!("curl output for '{url}' is invalid UTF-8: {error}"));
    }
    Err(curl_error(url, output.stderr))
}

fn curl_error(url: &str, stderr: Vec<u8>) -> String {
    let message = String::from_utf8_lossy(&stderr);
    format!("curl command failed for '{url}'; expected successful HTTP response: {message}")
}

fn no_update_status(current_version: String, latest_version: String) -> NativeUpdateStatus {
    NativeUpdateStatus {
        available: false,
        current_version,
        latest_version,
        archive_name: None,
        archive_url: None,
        checksum_name: None,
        checksum_url: None,
    }
}

fn build_update_status(
    current_version: String,
    latest_version: String,
    assets: &[GitHubAsset],
) -> Result<NativeUpdateStatus, String> {
    let archive = find_asset(assets, ARCHIVE_SUFFIX)?;
    let checksum = find_asset(assets, CHECKSUM_SUFFIX)?;
    Ok(update_status(
        current_version,
        latest_version,
        archive,
        checksum,
    ))
}

fn update_status(
    current_version: String,
    latest_version: String,
    archive: &GitHubAsset,
    checksum: &GitHubAsset,
) -> NativeUpdateStatus {
    NativeUpdateStatus {
        available: true,
        current_version,
        latest_version,
        archive_name: Some(archive.name.clone()),
        archive_url: Some(archive.browser_download_url.clone()),
        checksum_name: Some(checksum.name.clone()),
        checksum_url: Some(checksum.browser_download_url.clone()),
    }
}

fn find_asset<'a>(assets: &'a [GitHubAsset], suffix: &str) -> Result<&'a GitHubAsset, String> {
    assets
        .iter()
        .find(|asset| asset.name.ends_with(suffix))
        .ok_or_else(|| {
            format!(
                "GitHub release assets value '{suffix}' is invalid; expected native tarball asset"
            )
        })
}

fn write_update_script(request: &NativeUpdateRequest) -> Result<PathBuf, String> {
    let update_dir = native_update_dir(&request.latest_version)?;
    fs::create_dir_all(&update_dir).map_err(|error| {
        format!(
            "native update directory value '{}' is invalid; expected writable directory: {error}",
            update_dir.display()
        )
    })?;
    let script_path = update_dir.join("install-native-update.sh");
    fs::write(&script_path, update_script(request, &update_dir)).map_err(|error| {
        format!(
            "native update script value '{}' is invalid; expected writable file: {error}",
            script_path.display()
        )
    })?;
    Ok(script_path)
}

fn native_update_dir(version: &str) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|error| format!("HOME value is invalid; expected home directory: {error}"))?;
    Ok(PathBuf::from(home)
        .join(".cache/gtd-on-rails/update")
        .join(version))
}

fn update_script(request: &NativeUpdateRequest, update_dir: &std::path::Path) -> String {
    UPDATE_SCRIPT_TEMPLATE
        .replace(
            "{cache_dir}",
            &shell_quote(&update_dir.display().to_string()),
        )
        .replace("{archive_name}", &shell_quote(&request.archive_name))
        .replace("{checksum_name}", &shell_quote(&request.checksum_name))
        .replace("{archive_url}", &shell_quote(&request.archive_url))
        .replace("{checksum_url}", &shell_quote(&request.checksum_url))
        .replace("{current_pid}", &std::process::id().to_string())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn release_tag_version(tag_name: &str) -> Result<String, String> {
    let version = tag_name
        .strip_prefix("app-v")
        .or_else(|| tag_name.strip_prefix('v'))
        .unwrap_or(tag_name);
    version_parts(version)?;
    Ok(version.to_string())
}

fn is_newer_version(latest: &str, current: &str) -> Result<bool, String> {
    Ok(version_parts(latest)? > version_parts(current)?)
}

fn version_parts(version: &str) -> Result<Vec<u32>, String> {
    let parts = version
        .split('.')
        .map(parse_version_part)
        .collect::<Result<Vec<_>, _>>()?;
    if parts.len() == 3 {
        return Ok(parts);
    }
    Err(format!(
        "version value '{version}' is invalid; expected semantic version like 1.2.3"
    ))
}

fn parse_version_part(part: &str) -> Result<u32, String> {
    if !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()) {
        return part.parse::<u32>().map_err(|error| {
            format!("version part value '{part}' is invalid; expected u32: {error}")
        });
    }
    Err(format!(
        "version part value '{part}' is invalid; expected numeric segment"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_version_wins() {
        assert!(is_newer_version("1.0.5", "1.0.4").unwrap());
        assert!(!is_newer_version("1.0.4", "1.0.4").unwrap());
    }

    #[test]
    fn release_tag_prefixes_are_supported() {
        assert_eq!(release_tag_version("v1.0.5").unwrap(), "1.0.5");
        assert_eq!(release_tag_version("app-v1.0.5").unwrap(), "1.0.5");
    }

    #[test]
    fn non_semver_tags_are_rejected() {
        assert!(release_tag_version("app-vnext").is_err());
        assert!(release_tag_version("release").is_err());
    }

    #[test]
    fn native_archive_asset_is_selected() {
        let assets = vec![
            asset("unrelated.txt"),
            asset("GTD.on.Rails_1.0.5_linux-x86_64.tar.gz"),
        ];
        assert_eq!(
            find_asset(&assets, ARCHIVE_SUFFIX).unwrap().name,
            assets[1].name
        );
    }

    fn asset(name: &str) -> GitHubAsset {
        GitHubAsset {
            name: name.to_string(),
            browser_download_url: format!("https://example.test/{name}"),
        }
    }
}
