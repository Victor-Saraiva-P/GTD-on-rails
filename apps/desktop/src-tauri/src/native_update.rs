use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::native_update_release::{
    build_update_status, fetch_latest_release, is_newer_version, no_update_status,
    release_tag_version,
};

const UPDATE_SCRIPT_TEMPLATE: &str = r#"#!/usr/bin/env bash
set -euo pipefail
cache_dir={cache_dir}
current_pid={current_pid}
install_dir="$HOME/.local/share/gtd-on-rails"
next_dir="$HOME/.local/share/gtd-on-rails.next"
previous_dir="$HOME/.local/share/gtd-on-rails.previous"
while kill -0 "$current_pid" >/dev/null 2>&1; do sleep 0.2; done
test -x "$next_dir/gtd-on-rails"
test -x "$next_dir/gtd-api"
test -f "$next_dir/binaries/gtd-api.jar"
rm -rf "$previous_dir"
if [ -d "$install_dir" ]; then cp -a "$install_dir" "$previous_dir"; fi
mkdir -p "$install_dir/binaries" "$HOME/.local/bin" "$HOME/.local/share/applications"
cp "$next_dir/binaries/gtd-api.jar" "$install_dir/binaries/gtd-api.jar.tmp"
mv "$install_dir/binaries/gtd-api.jar.tmp" "$install_dir/binaries/gtd-api.jar"
cp "$next_dir/gtd-api" "$install_dir/gtd-api.tmp"
mv "$install_dir/gtd-api.tmp" "$install_dir/gtd-api"
if [ -f "$next_dir/gtd-cutover" ]; then
  cp "$next_dir/gtd-cutover" "$install_dir/gtd-cutover.tmp"
  mv "$install_dir/gtd-cutover.tmp" "$install_dir/gtd-cutover"
  chmod +x "$install_dir/gtd-cutover"
  ln -sf "$install_dir/gtd-cutover" "$HOME/.local/bin/gtd-cutover"
fi
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
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub archive_name: Option<String>,
    pub archive_url: Option<String>,
    pub checksum_name: Option<String>,
    pub checksum_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUpdateRequest {
    pub latest_version: String,
    pub archive_name: String,
    pub archive_url: String,
    pub checksum_name: String,
    pub checksum_url: String,
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
    let update_dir = native_update_dir(&request.latest_version)?;
    prepare_native_update(&request, &update_dir)?;
    let script_path = write_update_script(&update_dir)?;
    Command::new("bash")
        .arg(script_path)
        .spawn()
        .map_err(|error| format!("bash command failed for native update script; expected spawned updater process: {error}"))?;
    app.exit(0);
    Ok(())
}

fn prepare_native_update(request: &NativeUpdateRequest, update_dir: &Path) -> Result<(), String> {
    let install_root = update_dir.join("extracted");
    let next_dir = local_share_dir("gtd-on-rails.next")?;
    reset_update_dirs(update_dir, &install_root, &next_dir)?;
    download_update_asset(
        &request.archive_url,
        &update_dir.join(&request.archive_name),
    )?;
    download_update_asset(
        &request.checksum_url,
        &update_dir.join(&request.checksum_name),
    )?;
    verify_update_checksum(update_dir, &request.checksum_name)?;
    extract_update_archive(update_dir, &request.archive_name, &install_root)?;
    stage_native_update(&native_update_package_dir(&install_root)?, &next_dir)
}

fn reset_update_dirs(
    update_dir: &Path,
    install_root: &Path,
    next_dir: &Path,
) -> Result<(), String> {
    remove_dir_if_exists(install_root)?;
    remove_dir_if_exists(next_dir)?;
    fs::create_dir_all(update_dir)
        .map_err(|error| dir_error(update_dir, "writable cache", error))?;
    fs::create_dir_all(install_root)
        .map_err(|error| dir_error(install_root, "writable extract", error))?;
    fs::create_dir_all(next_dir.join("binaries"))
        .map_err(|error| dir_error(next_dir, "writable staging", error))
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    fs::remove_dir_all(path).map_err(|error| dir_error(path, "removable directory", error))
}

fn download_update_asset(url: &str, output_path: &Path) -> Result<(), String> {
    let status = Command::new("curl")
        .args(["-fL", url, "-o", &output_path.display().to_string()])
        .status()
        .map_err(|error| format!("curl command failed for '{url}'; expected download: {error}"))?;
    command_status(status, "curl", output_path)
}

fn verify_update_checksum(update_dir: &Path, checksum_name: &str) -> Result<(), String> {
    let status = Command::new("sha256sum")
        .args(["-c", checksum_name])
        .current_dir(update_dir)
        .status()
        .map_err(|error| format!("sha256sum command failed for '{checksum_name}': {error}"))?;
    command_status(status, "sha256sum", &update_dir.join(checksum_name))
}

fn extract_update_archive(
    update_dir: &Path,
    archive_name: &str,
    install_root: &Path,
) -> Result<(), String> {
    let status = Command::new("tar")
        .args([
            "-xzf",
            archive_name,
            "-C",
            &install_root.display().to_string(),
        ])
        .current_dir(update_dir)
        .status()
        .map_err(|error| format!("tar command failed for '{archive_name}': {error}"))?;
    command_status(status, "tar", &update_dir.join(archive_name))
}

fn native_update_package_dir(install_root: &Path) -> Result<PathBuf, String> {
    fs::read_dir(install_root)
        .map_err(|error| dir_error(install_root, "readable extract", error))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| path.is_dir())
        .ok_or_else(|| {
            format!(
                "native update extract value '{}' is invalid; expected package directory",
                install_root.display()
            )
        })
}

fn stage_native_update(package_dir: &Path, next_dir: &Path) -> Result<(), String> {
    validate_package_dir(package_dir)?;
    stage_core_files(package_dir, next_dir)?;
    stage_optional_cutover(package_dir, next_dir)
}

fn stage_core_files(package_dir: &Path, next_dir: &Path) -> Result<(), String> {
    copy_update_file(
        &package_dir.join("gtd-on-rails"),
        &next_dir.join("gtd-on-rails"),
    )?;
    copy_update_file(&package_dir.join("gtd-api"), &next_dir.join("gtd-api"))?;
    copy_update_file(
        &package_dir.join("binaries/gtd-api.jar"),
        &next_dir.join("binaries/gtd-api.jar"),
    )?;
    copy_update_file(&package_dir.join("icon.png"), &next_dir.join("icon.png"))?;
    make_executable(&next_dir.join("gtd-on-rails"))?;
    make_executable(&next_dir.join("gtd-api"))
}

fn stage_optional_cutover(package_dir: &Path, next_dir: &Path) -> Result<(), String> {
    if !package_dir.join("gtd-cutover").is_file() {
        return Ok(());
    }
    copy_update_file(
        &package_dir.join("gtd-cutover"),
        &next_dir.join("gtd-cutover"),
    )?;
    make_executable(&next_dir.join("gtd-cutover"))
}

fn validate_package_dir(package_dir: &Path) -> Result<(), String> {
    require_file(&package_dir.join("gtd-on-rails"))?;
    require_file(&package_dir.join("gtd-api"))?;
    require_file(&package_dir.join("binaries/gtd-api.jar"))?;
    require_file(&package_dir.join("icon.png"))
}

fn require_file(path: &Path) -> Result<(), String> {
    if path.is_file() {
        return Ok(());
    }
    Err(format!(
        "native update file value '{}' is invalid; expected readable file",
        path.display()
    ))
}

fn copy_update_file(source: &Path, target: &Path) -> Result<(), String> {
    fs::copy(source, target).map(|_| ()).map_err(|error| {
        format!(
            "native update file value '{}' is invalid; expected copy to '{}': {error}",
            source.display(),
            target.display()
        )
    })
}

fn make_executable(path: &Path) -> Result<(), String> {
    let mut permissions = fs::metadata(path)
        .map_err(|error| file_error(path, "metadata", error))?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)
        .map_err(|error| file_error(path, "executable permissions", error))
}

fn write_update_script(update_dir: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(&update_dir).map_err(|error| {
        format!(
            "native update directory value '{}' is invalid; expected writable directory: {error}",
            update_dir.display()
        )
    })?;
    let script_path = update_dir.join("install-native-update.sh");
    fs::write(&script_path, update_script(update_dir)).map_err(|error| {
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

fn update_script(update_dir: &Path) -> String {
    UPDATE_SCRIPT_TEMPLATE
        .replace(
            "{cache_dir}",
            &shell_quote(&update_dir.display().to_string()),
        )
        .replace("{current_pid}", &std::process::id().to_string())
}

fn command_status(
    status: std::process::ExitStatus,
    command: &str,
    path: &Path,
) -> Result<(), String> {
    if status.success() {
        return Ok(());
    }
    Err(format!(
        "{command} command failed for '{}' with status {status}; expected success",
        path.display()
    ))
}

fn dir_error(path: &Path, expected: &str, error: std::io::Error) -> String {
    format!(
        "directory value '{}' is invalid; expected {expected}: {error}",
        path.display()
    )
}

fn file_error(path: &Path, expected: &str, error: std::io::Error) -> String {
    format!(
        "file value '{}' is invalid; expected {expected}: {error}",
        path.display()
    )
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_script_contains_cutover_symlinking() {
        assert!(UPDATE_SCRIPT_TEMPLATE.contains("gtd-cutover"));
        assert!(UPDATE_SCRIPT_TEMPLATE.contains("ln -sf \"$install_dir/gtd-cutover\""));
    }

    #[test]
    fn stage_native_update_copies_gtd_cutover_when_present() {
        let temp = std::env::temp_dir().join(format!("gtd-update-stage-test-{}", std::process::id()));
        let pkg = temp.join("pkg");
        let next = temp.join("next");
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(pkg.join("binaries")).unwrap();
        fs::create_dir_all(next.join("binaries")).unwrap();

        fs::write(pkg.join("gtd-on-rails"), b"app").unwrap();
        fs::write(pkg.join("gtd-api"), b"api").unwrap();
        fs::write(pkg.join("binaries/gtd-api.jar"), b"jar").unwrap();
        fs::write(pkg.join("icon.png"), b"icon").unwrap();
        fs::write(pkg.join("gtd-cutover"), b"cutover").unwrap();

        stage_native_update(&pkg, &next).unwrap();

        assert!(next.join("gtd-cutover").is_file());
        let _ = fs::remove_dir_all(&temp);
    }
}
