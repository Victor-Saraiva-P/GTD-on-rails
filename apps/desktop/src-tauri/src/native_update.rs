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
while kill -0 "$current_pid" >/dev/null 2>&1; do sleep 0.2; done
rm -rf "$install_root"
mkdir -p "$cache_dir" "$install_root"
curl -fL "$archive_url" -o "$cache_dir/$archive_name"
curl -fL "$checksum_url" -o "$cache_dir/$checksum_name"
(cd "$cache_dir" && sha256sum -c "$checksum_name")
tar -xzf "$cache_dir/$archive_name" -C "$install_root"
package_dir="$(find "$install_root" -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)"
"$package_dir/install.sh"
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
    let release = fetch_latest_release()?;
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    if !is_newer_version(&latest_version, &current_version) {
        return Ok(no_update_status(current_version, latest_version));
    }
    build_update_status(current_version, latest_version, &release.assets)
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

fn is_newer_version(latest: &str, current: &str) -> bool {
    version_parts(latest) > version_parts(current)
}

fn version_parts(version: &str) -> Vec<u32> {
    version
        .split('.')
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_version_wins() {
        assert!(is_newer_version("1.0.5", "1.0.4"));
        assert!(!is_newer_version("1.0.4", "1.0.4"));
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
