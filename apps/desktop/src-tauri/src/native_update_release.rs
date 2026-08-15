use std::process::Command;

use serde::Deserialize;

use crate::native_update::NativeUpdateStatus;

pub const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/latest";
pub const ARCHIVE_SUFFIX: &str = "linux-x86_64.tar.gz";
pub const CHECKSUM_SUFFIX: &str = "linux-x86_64.tar.gz.sha256";

#[derive(Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

pub fn fetch_latest_release() -> Result<GitHubRelease, String> {
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

pub fn no_update_status(current_version: String, latest_version: String) -> NativeUpdateStatus {
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

pub fn build_update_status(
    current_version: String,
    latest_version: String,
    assets: &[GitHubAsset],
) -> Result<NativeUpdateStatus, String> {
    let archive = find_versioned_asset(assets, &latest_version, ARCHIVE_SUFFIX)?;
    let checksum = find_versioned_asset(assets, &latest_version, CHECKSUM_SUFFIX)?;
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

pub fn find_versioned_asset<'a>(
    assets: &'a [GitHubAsset],
    version: &str,
    suffix: &str,
) -> Result<&'a GitHubAsset, String> {
    let version_token = format!("_{version}_");
    assets
        .iter()
        .find(|asset| asset.name.contains(&version_token) && asset.name.ends_with(suffix))
        .ok_or_else(|| {
            format!(
                "GitHub release assets value '{suffix}' is invalid; expected asset containing version '{version}'"
            )
        })
}

pub fn release_tag_version(tag_name: &str) -> Result<String, String> {
    let version = tag_name
        .strip_prefix("app-v")
        .or_else(|| tag_name.strip_prefix('v'))
        .unwrap_or(tag_name);
    version_parts(version)?;
    Ok(version.to_string())
}

pub fn is_newer_version(latest: &str, current: &str) -> Result<bool, String> {
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
        assert!(is_newer_version("1.1.2", "1.1.1").unwrap());
        assert!(!is_newer_version("1.1.1", "1.1.1").unwrap());
    }

    #[test]
    fn release_tag_prefixes_are_supported() {
        assert_eq!(release_tag_version("v1.1.2").unwrap(), "1.1.2");
        assert_eq!(release_tag_version("app-v1.1.2").unwrap(), "1.1.2");
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
            asset("GTD.on.Rails_1.1.2_linux-x86_64.tar.gz"),
        ];
        assert_eq!(
            find_versioned_asset(&assets, "1.1.2", ARCHIVE_SUFFIX)
                .unwrap()
                .name,
            assets[1].name
        );
    }

    #[test]
    fn mismatched_release_assets_are_rejected() {
        let assets = vec![
            asset("GTD.on.Rails_1.1.0_linux-x86_64.tar.gz"),
            asset("GTD.on.Rails_1.1.0_linux-x86_64.tar.gz.sha256"),
        ];
        assert!(find_versioned_asset(&assets, "1.1.2", ARCHIVE_SUFFIX).is_err());
        assert!(find_versioned_asset(&assets, "1.1.2", CHECKSUM_SUFFIX).is_err());
    }

    fn asset(name: &str) -> GitHubAsset {
        GitHubAsset {
            name: name.to_string(),
            browser_download_url: format!("https://example.test/{name}"),
        }
    }
}
