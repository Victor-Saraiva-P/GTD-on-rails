use std::process::{Command, Stdio};

use tauri::Manager;

mod clipboard;
mod native_update;
mod native_update_release;
mod pdf_preview;
mod postgres_tools;
mod sidecar;

#[tauri::command]
fn read_clipboard_image() -> Result<Option<clipboard::ClipboardImagePayload>, String> {
    clipboard::read_clipboard_image()
}

#[tauri::command]
fn read_clipboard_file_asset() -> Result<Option<clipboard::ClipboardImagePayload>, String> {
    clipboard::read_clipboard_file_asset()
}

#[tauri::command]
fn read_clipboard_local_file_asset() -> Result<Option<clipboard::LocalAssetPayload>, String> {
    clipboard::read_clipboard_local_file_asset()
}

#[tauri::command]
fn read_asset_file_path(
    file_path: String,
) -> Result<Option<clipboard::ClipboardImagePayload>, String> {
    clipboard::read_asset_file_path(file_path)
}

#[tauri::command]
fn read_local_asset_path(file_path: String) -> Result<Option<clipboard::LocalAssetPayload>, String> {
    clipboard::read_local_asset_path(file_path)
}

#[tauri::command]
fn read_clipboard_text() -> Result<Option<String>, String> {
    clipboard::read_clipboard_text()
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    open_with_default_app(&url)
}

#[tauri::command]
fn open_temp_asset(bytes_base64: String, file_name: String) -> Result<(), String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(bytes_base64)
        .map_err(|error| format!("asset bytes value is invalid; expected base64 bytes: {error}"))?;
    let path = pdf_preview::temporary_asset_path(&file_name);
    std::fs::write(&path, bytes).map_err(|error| {
        format!(
            "asset file path value '{}' is invalid; expected writable temp file: {error}",
            path.display()
        )
    })?;
    open_with_default_app(path.to_string_lossy().as_ref())
}

#[tauri::command]
fn render_pdf_first_page_preview(
    bytes_base64: String,
) -> Result<pdf_preview::PdfFirstPagePreviewPayload, String> {
    pdf_preview::render_pdf_first_page_preview(bytes_base64)
}

#[tauri::command]
fn sidecar_backend_status(
    state: tauri::State<sidecar::SidecarBackendState>,
) -> sidecar::SidecarBackendStatus {
    state.status()
}

fn open_with_default_app(target: &str) -> Result<(), String> {
    default_open_command(target)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!(
                "open target value '{target}' is invalid; expected OS-openable path or URL: {error}"
            )
        })?;
    Ok(())
}

fn default_open_command(target: &str) -> Command {
    #[cfg(target_os = "linux")]
    {
        let mut command = Command::new("xdg-open");
        command.arg(target);
        command
    }
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(target);
        command
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", target]);
        command
    }
}

/// Starts the Tauri desktop shell and registers native commands.
///
/// # Example
///
/// ```ignore
/// desktop_lib::run();
/// ```
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(sidecar::SidecarBackendState::new(sidecar::sidecar_enabled()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_clipboard_image,
            read_clipboard_text,
            read_clipboard_file_asset,
            read_clipboard_local_file_asset,
            read_asset_file_path,
            read_local_asset_path,
            open_external_url,
            open_temp_asset,
            render_pdf_first_page_preview,
            native_update::native_update_check,
            native_update::native_update_install,
            postgres_tools::postgres_tools_status,
            postgres_tools::install_postgres_tools,
            sidecar::start_sidecar_command,
            sidecar_backend_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
