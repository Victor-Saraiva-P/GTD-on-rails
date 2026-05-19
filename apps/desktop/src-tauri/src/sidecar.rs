use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const SIDECAR_PROGRAM: &str = "gtd-api";
const DEFAULT_SIDECAR_PROFILES: &str = "prod,sidecar";
const READY_TIMEOUT: Duration = Duration::from_secs(60);
const READY_POLL_INTERVAL: Duration = Duration::from_millis(100);

pub struct SidecarBackendState {
    enabled: bool,
    base_url: Mutex<Option<String>>,
    error: Mutex<Option<String>>,
    child: Mutex<Option<CommandChild>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarBackendStatus {
    enabled: bool,
    base_url: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyPayload {
    host: String,
    port: u16,
    base_url: String,
}

impl SidecarBackendState {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled,
            base_url: Mutex::new(None),
            error: Mutex::new(None),
            child: Mutex::new(None),
        }
    }

    pub fn status(&self) -> SidecarBackendStatus {
        SidecarBackendStatus {
            enabled: self.enabled,
            base_url: self.base_url.lock().unwrap().clone(),
            error: self.error.lock().unwrap().clone(),
        }
    }

    fn set_base_url(&self, base_url: String) {
        self.base_url.lock().unwrap().replace(base_url);
    }

    fn set_error(&self, error: String) {
        self.error.lock().unwrap().replace(error);
    }

    fn set_child(&self, child: CommandChild) {
        self.child.lock().unwrap().replace(child);
    }
}

impl Drop for SidecarBackendState {
    fn drop(&mut self) {
        if let Ok(child_slot) = self.child.get_mut() {
            if let Some(child) = child_slot.take() {
                let _ = child.kill();
            }
        }
    }
}

pub fn sidecar_enabled() -> bool {
    !cfg!(debug_assertions)
}

pub fn start_sidecar(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    if !sidecar_enabled() {
        return Ok(());
    }

    let ready_file = ready_file_path();
    remove_stale_ready_file(&ready_file);
    let (rx, child) = spawn_backend(app, &ready_file)?;
    app.state::<SidecarBackendState>().set_child(child);
    monitor_sidecar_events(app.handle().clone(), rx);
    wait_for_ready_file(app.handle().clone(), ready_file);
    Ok(())
}

fn spawn_backend(
    app: &App,
    ready_file: &Path,
) -> Result<(tauri::async_runtime::Receiver<CommandEvent>, CommandChild), Box<dyn std::error::Error>>
{
    let jar_path = app.path().resource_dir()?.join("binaries/gtd-api.jar");
    let child = app
        .shell()
        .sidecar(SIDECAR_PROGRAM)?
        .arg(format!("--spring.profiles.active={}", sidecar_profiles()))
        .env("GTD_API_JAR_PATH", jar_path.as_os_str())
        .env("GTD_SIDECAR_READY_FILE", ready_file.as_os_str())
        .spawn()?;
    Ok(child)
}

fn sidecar_profiles() -> String {
    std::env::var("GTD_SIDECAR_PROFILES")
        .ok()
        .filter(|profiles| !profiles.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_SIDECAR_PROFILES.to_string())
}

fn ready_file_path() -> PathBuf {
    std::env::temp_dir().join(format!(
        "gtd-on-rails-sidecar-{}-ready.json",
        std::process::id()
    ))
}

fn remove_stale_ready_file(ready_file: &Path) {
    let _ = std::fs::remove_file(ready_file);
    let _ = std::fs::remove_file(ready_file.with_extension("json.tmp"));
}

fn monitor_sidecar_events(
    app_handle: AppHandle,
    mut rx: tauri::async_runtime::Receiver<CommandEvent>,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                record_sidecar_error(
                    &app_handle,
                    format!("backend exited with code {:?}", payload.code),
                );
            }
        }
    });
}

fn wait_for_ready_file(app_handle: AppHandle, ready_file: PathBuf) {
    std::thread::spawn(move || {
        let deadline = Instant::now() + READY_TIMEOUT;
        while Instant::now() < deadline {
            if let Some(payload) = read_ready_payload(&ready_file) {
                return record_ready_payload(&app_handle, payload);
            }
            std::thread::sleep(READY_POLL_INTERVAL);
        }
        record_sidecar_error(&app_handle, "backend readiness file timed out".to_string());
    });
}

fn read_ready_payload(ready_file: &Path) -> Option<ReadyPayload> {
    let text = std::fs::read_to_string(ready_file).ok()?;
    serde_json::from_str(&text).ok()
}

fn record_ready_payload(app_handle: &AppHandle, payload: ReadyPayload) {
    match validate_ready_payload(payload) {
        Ok(base_url) => record_sidecar_base_url(app_handle, base_url),
        Err(error) => record_sidecar_error(app_handle, error),
    }
}

fn validate_ready_payload(payload: ReadyPayload) -> Result<String, String> {
    let expected_base_url = format!("http://127.0.0.1:{}", payload.port);
    if payload.host != "127.0.0.1" || payload.base_url != expected_base_url {
        return Err(format!(
            "sidecar ready payload value '{}' is invalid; expected {}",
            payload.base_url, expected_base_url
        ));
    }
    Ok(payload.base_url)
}

fn record_sidecar_base_url(app_handle: &AppHandle, base_url: String) {
    app_handle
        .state::<SidecarBackendState>()
        .set_base_url(base_url.clone());
    let _ = app_handle.emit("backend-ready", base_url);
}

fn record_sidecar_error(app_handle: &AppHandle, error: String) {
    app_handle
        .state::<SidecarBackendState>()
        .set_error(error.clone());
    let _ = app_handle.emit("backend-error", error);
}
