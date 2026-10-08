use std::process::Command;

use serde::Deserialize;

use crate::native_update::NativeUpdateStatus;

pub const MAIN_RELEASE_URL: &str =
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/tags/main-latest";
pub const MAIN_MANIFEST_NAME: &str = "main-update.json";

#[derive(Deserialize)]
pub struct GitHubRelease {
    pub assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MainUpdateManifest {
    pub version: String,
    pub revision: String,
    pub archive_name: String,
    pub checksum_name: String,
}

pub fn fetch_main_release() -> Result<GitHubRelease, String> {
    let body = curl_text(MAIN_RELEASE_URL)?;
    serde_json::from_str(&body).map_err(|error| {
        format!("GitHub main release payload is invalid; expected release JSON: {error}")
    })
}

pub fn fetch_main_manifest(assets: &[GitHubAsset]) -> Result<MainUpdateManifest, String> {
    let manifest_asset = find_asset(assets, MAIN_MANIFEST_NAME)?;
    let body = curl_text(&manifest_asset.browser_download_url)?;
    parse_main_manifest(&body)
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

fn parse_main_manifest(body: &str) -> Result<MainUpdateManifest, String> {
    let manifest = serde_json::from_str::<MainUpdateManifest>(body).map_err(|error| {
        format!("main update manifest value is invalid; expected manifest JSON: {error}")
    })?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn validate_manifest(manifest: &MainUpdateManifest) -> Result<(), String> {
    validate_version(&manifest.version)?;
    validate_revision(&manifest.revision)?;
    validate_asset_name(&manifest.archive_name)?;
    validate_asset_name(&manifest.checksum_name)
}

fn validate_version(version: &str) -> Result<(), String> {
    let numeric_parts = version
        .split('.')
        .map(str::parse::<u32>)
        .collect::<Result<Vec<_>, _>>();
    if matches!(numeric_parts, Ok(ref parts) if parts.len() == 3) {
        return Ok(());
    }
    Err(format!(
        "main update version value '{version}' is invalid; expected semantic version like 1.2.3"
    ))
}

fn validate_revision(revision: &str) -> Result<(), String> {
    if revision.len() == 40
        && revision
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Ok(());
    }
    Err(format!(
        "main update revision value '{revision}' is invalid; expected 40-character Git SHA"
    ))
}

fn validate_asset_name(name: &str) -> Result<(), String> {
    if !name.is_empty() && !name.contains('/') && !name.contains('\\') {
        return Ok(());
    }
    Err(format!(
        "main update asset name value '{name}' is invalid; expected plain release asset filename"
    ))
}

pub fn find_asset<'a>(assets: &'a [GitHubAsset], name: &str) -> Result<&'a GitHubAsset, String> {
    assets
        .iter()
        .find(|asset| asset.name == name)
        .ok_or_else(|| {
            format!("GitHub release asset value '{name}' is invalid; expected named asset")
        })
}

pub fn no_update_status(
    current_version: String,
    current_revision: String,
    manifest: &MainUpdateManifest,
) -> NativeUpdateStatus {
    NativeUpdateStatus {
        available: false,
        current_version,
        current_revision,
        latest_version: manifest.version.clone(),
        latest_revision: manifest.revision.clone(),
        archive_name: None,
        archive_url: None,
        checksum_name: None,
        checksum_url: None,
    }
}

pub fn build_update_status(
    current_version: String,
    current_revision: String,
    manifest: &MainUpdateManifest,
    assets: &[GitHubAsset],
) -> Result<NativeUpdateStatus, String> {
    let archive = find_asset(assets, &manifest.archive_name)?;
    let checksum = find_asset(assets, &manifest.checksum_name)?;
    Ok(NativeUpdateStatus {
        available: true,
        current_version,
        current_revision,
        latest_version: manifest.version.clone(),
        latest_revision: manifest.revision.clone(),
        archive_name: Some(archive.name.clone()),
        archive_url: Some(archive.browser_download_url.clone()),
        checksum_name: Some(checksum.name.clone()),
        checksum_url: Some(checksum.browser_download_url.clone()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const REVISION: &str = "0123456789abcdef0123456789abcdef01234567";

    #[test]
    fn main_manifest_parses_revision_and_assets() {
        let body = format!(
            r#"{{"version":"3.6.0","revision":"{REVISION}","archiveName":"GTD.on.Rails_3.6.0_linux-x86_64.tar.gz","checksumName":"GTD.on.Rails_3.6.0_linux-x86_64.tar.gz.sha256"}}"#
        );
        let manifest = parse_main_manifest(&body).unwrap();
        assert_eq!(manifest.version, "3.6.0");
        assert_eq!(manifest.revision, REVISION);
    }

    #[test]
    fn malformed_revision_is_rejected() {
        let body = r#"{"version":"3.6.0","revision":"main","archiveName":"app.tar.gz","checksumName":"app.tar.gz.sha256"}"#;
        assert!(parse_main_manifest(body).is_err());
    }

    #[test]
    fn nested_asset_name_is_rejected() {
        let body = format!(
            r#"{{"version":"3.6.0","revision":"{REVISION}","archiveName":"../app.tar.gz","checksumName":"app.tar.gz.sha256"}}"#
        );
        assert!(parse_main_manifest(&body).is_err());
    }

    #[test]
    fn exact_release_asset_is_selected() {
        let assets = vec![asset("old.tar.gz"), asset("current.tar.gz")];
        assert_eq!(
            find_asset(&assets, "current.tar.gz").unwrap().name,
            "current.tar.gz"
        );
    }

    #[test]
    fn update_status_uses_manifest_revision_and_named_assets() {
        let manifest = manifest();
        let assets = vec![
            asset(&manifest.archive_name),
            asset(&manifest.checksum_name),
        ];
        let status = build_update_status(
            "3.6.0".to_string(),
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string(),
            &manifest,
            &assets,
        )
        .unwrap();
        assert!(status.available);
        assert_eq!(status.latest_revision, REVISION);
        assert_eq!(
            status.archive_name.as_deref(),
            Some(manifest.archive_name.as_str())
        );
    }

    #[test]
    fn no_update_status_keeps_revision_metadata_without_assets() {
        let manifest = manifest();
        let status = no_update_status("3.6.0".to_string(), REVISION.to_string(), &manifest);
        assert!(!status.available);
        assert_eq!(status.current_revision, REVISION);
        assert!(status.archive_name.is_none());
    }

    fn manifest() -> MainUpdateManifest {
        MainUpdateManifest {
            version: "3.6.0".to_string(),
            revision: REVISION.to_string(),
            archive_name: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz".to_string(),
            checksum_name: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz.sha256".to_string(),
        }
    }

    fn asset(name: &str) -> GitHubAsset {
        GitHubAsset {
            name: name.to_string(),
            browser_download_url: format!("https://example.test/{name}"),
        }
    }
}
