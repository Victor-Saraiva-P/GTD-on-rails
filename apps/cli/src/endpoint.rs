use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Deserialize;

use crate::error::CliError;

const DEVELOPMENT_API_URL: &str = "http://127.0.0.1:8080";
const READY_FILE_PREFIX: &str = "gtd-on-rails-sidecar-";
const READY_FILE_SUFFIX: &str = "-ready.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarReadyPayload {
    host: String,
    port: u16,
    base_url: String,
}

struct SidecarCandidate {
    modified_at: SystemTime,
    base_url: String,
}

/// Resolves the local GTD API endpoint for CLI commands.
///
/// Example: `resolve_api_url(None)` discovers a running production sidecar or falls back to the development endpoint.
pub fn resolve_api_url(explicit_url: Option<String>) -> Result<String, CliError> {
    if let Some(url) = explicit_url {
        return Ok(url);
    }
    Ok(discover_live_sidecar()?.unwrap_or_else(|| DEVELOPMENT_API_URL.to_string()))
}

fn discover_live_sidecar() -> Result<Option<String>, CliError> {
    let temp_directory = std::env::temp_dir();
    let entries = fs::read_dir(&temp_directory).map_err(|source| CliError::ReadDirectory {
        path: temp_directory.display().to_string(),
        source,
    })?;
    let mut candidates = entries
        .filter_map(Result::ok)
        .filter_map(sidecar_candidate)
        .collect::<Vec<_>>();
    candidates.sort_by_key(|candidate| candidate.modified_at);
    Ok(candidates.pop().map(|candidate| candidate.base_url))
}

fn sidecar_candidate(entry: fs::DirEntry) -> Option<SidecarCandidate> {
    let path = entry.path();
    let process_id = process_id_from_ready_file(&path)?;
    if !process_is_alive(process_id) {
        return None;
    }
    let payload = read_ready_payload(&path)?;
    let base_url = validated_base_url(payload)?;
    let modified_at = entry.metadata().ok()?.modified().ok()?;
    Some(SidecarCandidate { modified_at, base_url })
}

fn process_id_from_ready_file(path: &Path) -> Option<u32> {
    let file_name = path.file_name()?.to_str()?;
    let process_id = file_name
        .strip_prefix(READY_FILE_PREFIX)?
        .strip_suffix(READY_FILE_SUFFIX)?;
    process_id.parse().ok()
}

fn process_is_alive(process_id: u32) -> bool {
    PathBuf::from(format!("/proc/{process_id}")).is_dir()
}

fn read_ready_payload(path: &Path) -> Option<SidecarReadyPayload> {
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn validated_base_url(payload: SidecarReadyPayload) -> Option<String> {
    let expected = format!("http://127.0.0.1:{}", payload.port);
    if payload.host != "127.0.0.1" || payload.base_url != expected {
        return None;
    }
    Some(payload.base_url)
}
