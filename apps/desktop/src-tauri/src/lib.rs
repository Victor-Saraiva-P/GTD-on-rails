use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardImagePayload {
    bytes_base64: String,
    mime_type: String,
    file_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PdfFirstPagePreviewPayload {
    bytes_base64: String,
    mime_type: String,
}

#[tauri::command]
fn read_clipboard_image() -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_image();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn read_clipboard_file_asset() -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_file_asset();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn read_asset_file_path(file_path: String) -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return file_asset_payload_from_path(&PathBuf::from(file_path)).map(Some);
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn read_clipboard_text() -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_text();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
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
    let path = temporary_asset_path(&file_name);
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
) -> Result<PdfFirstPagePreviewPayload, String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(bytes_base64)
        .map_err(|error| format!("pdf bytes value is invalid; expected base64 bytes: {error}"))?;
    let input_path = temporary_asset_path("preview.pdf");
    std::fs::write(&input_path, bytes)
        .map_err(|error| pdf_preview_write_error(&input_path, error))?;
    let output_path = render_pdf_first_page_png(&input_path)?;
    pdf_first_page_preview_payload(&input_path, &output_path)
}

fn render_pdf_first_page_png(input_path: &Path) -> Result<PathBuf, String> {
    let output_prefix = temporary_asset_path("preview-page");
    let output_path = output_prefix.with_extension("png");
    run_pdftoppm_first_page(input_path, &output_prefix)?;
    Ok(output_path)
}

fn run_pdftoppm_first_page(input_path: &Path, output_prefix: &Path) -> Result<(), String> {
    let status = Command::new("pdftoppm")
        .args(["-f", "1", "-singlefile", "-png", "-scale-to", "900"])
        .arg(input_path)
        .arg(output_prefix)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| {
            format!("pdftoppm command is invalid; expected installed renderer: {error}")
        })?;
    status
        .success()
        .then_some(())
        .ok_or_else(|| pdf_preview_render_error(input_path))
}

fn pdf_first_page_preview_payload(
    input_path: &Path,
    output_path: &Path,
) -> Result<PdfFirstPagePreviewPayload, String> {
    use base64::Engine;

    let bytes =
        std::fs::read(output_path).map_err(|error| pdf_preview_read_error(output_path, error))?;
    remove_temporary_pdf_preview_files(input_path, output_path);
    Ok(PdfFirstPagePreviewPayload {
        bytes_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime_type: "image/png".to_string(),
    })
}

fn remove_temporary_pdf_preview_files(input_path: &Path, output_path: &Path) {
    let _ = std::fs::remove_file(input_path);
    let _ = std::fs::remove_file(output_path);
}

fn pdf_preview_write_error(path: &Path, error: std::io::Error) -> String {
    format!(
        "pdf preview path value '{}' is invalid; expected writable temp file: {error}",
        path.display()
    )
}

fn pdf_preview_read_error(path: &Path, error: std::io::Error) -> String {
    format!(
        "pdf preview path value '{}' is invalid; expected rendered PNG file: {error}",
        path.display()
    )
}

fn pdf_preview_render_error(path: &Path) -> String {
    format!(
        "pdf preview path value '{}' is invalid; expected renderable first PDF page",
        path.display()
    )
}

fn temporary_asset_path(file_name: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    std::env::temp_dir().join(format!(
        "gtd-open-asset-{millis}-{}",
        safe_temp_file_name(file_name)
    ))
}

fn safe_temp_file_name(file_name: &str) -> String {
    let safe: String = file_name.chars().map(safe_temp_file_character).collect();
    if safe.trim_matches('-').is_empty() {
        "asset".to_string()
    } else {
        safe
    }
}

fn safe_temp_file_character(character: char) -> char {
    if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
        character
    } else {
        '-'
    }
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

#[cfg(target_os = "linux")]
fn read_linux_clipboard_text() -> Result<Option<String>, String> {
    Ok(linux_clipboard()?
        .wait_for_text()
        .map(|text| text.to_string()))
}

#[cfg(target_os = "linux")]
fn read_linux_clipboard_image() -> Result<Option<ClipboardImagePayload>, String> {
    let clipboard = linux_clipboard()?;
    if !clipboard.wait_is_image_available() {
        return Ok(None);
    }

    let bytes = linux_clipboard_image_bytes(&clipboard)?;
    Ok(Some(clipboard_image_payload(bytes)))
}

#[cfg(target_os = "linux")]
fn read_linux_clipboard_file_asset() -> Result<Option<ClipboardImagePayload>, String> {
    if let Some(payload) = wl_clipboard_file_asset()? {
        return Ok(Some(payload));
    }

    let clipboard = linux_clipboard()?;
    gtk_clipboard_file_asset(&clipboard)
}

#[cfg(target_os = "linux")]
fn gtk_clipboard_file_asset(
    clipboard: &gtk::Clipboard,
) -> Result<Option<ClipboardImagePayload>, String> {
    if let Some(uri_list) = gtk_clipboard_uri_list(clipboard) {
        return clipboard_file_payload_from_uri_list(&uri_list);
    }

    Ok(None)
}

#[cfg(target_os = "linux")]
fn gtk_clipboard_uri_list(clipboard: &gtk::Clipboard) -> Option<String> {
    let uris = clipboard.wait_for_uris();
    if !uris.is_empty() {
        return Some(uris.join("\n"));
    }

    gtk_clipboard_target_text(clipboard, "x-special/gnome-copied-files")
        .or_else(|| gtk_clipboard_target_text(clipboard, "text/uri-list"))
}

#[cfg(target_os = "linux")]
fn gtk_clipboard_target_text(clipboard: &gtk::Clipboard, target: &str) -> Option<String> {
    let atom = gtk::gdk::Atom::intern(target);
    let contents = clipboard.wait_for_contents(&atom)?;

    Some(String::from_utf8_lossy(&contents.data()).replace('\0', ""))
}

#[cfg(target_os = "linux")]
fn linux_clipboard() -> Result<gtk::Clipboard, String> {
    let display = gtk::gdk::Display::default().ok_or_else(|| {
        "GTK display value 'None' is invalid; expected an active GTK display.".to_string()
    })?;
    gtk::Clipboard::default(&display).ok_or_else(|| {
        "GTK clipboard value 'None' is invalid; expected a default clipboard for the active display."
            .to_string()
    })
}

#[cfg(target_os = "linux")]
fn linux_clipboard_image_bytes(clipboard: &gtk::Clipboard) -> Result<Vec<u8>, String> {
    let image = clipboard.wait_for_image().ok_or_else(|| {
        "Clipboard image value 'None' is invalid; expected a readable clipboard image.".to_string()
    })?;
    image
        .save_to_bufferv("png", &[])
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "linux")]
fn clipboard_image_payload(bytes: Vec<u8>) -> ClipboardImagePayload {
    use base64::Engine;

    ClipboardImagePayload {
        bytes_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime_type: "image/png".to_string(),
        file_name: "clipboard-icon.png".to_string(),
    }
}

#[cfg(target_os = "linux")]
fn wl_clipboard_uri_list() -> Option<String> {
    let targets = wl_paste_text(["--list-types"])?;
    targets.lines().find_map(wl_clipboard_target_uri_list)
}

#[cfg(target_os = "linux")]
fn wl_clipboard_file_asset() -> Result<Option<ClipboardImagePayload>, String> {
    wl_clipboard_uri_list()
        .map(|uri_list| clipboard_file_payload_from_uri_list(&uri_list))
        .transpose()
        .map(Option::flatten)
}

#[cfg(target_os = "linux")]
fn wl_clipboard_target_uri_list(target: &str) -> Option<String> {
    let target = target.trim();
    if !clipboard_uri_target(target) {
        return None;
    }

    wl_paste_text(["--type", target, "--no-newline"])
}

#[cfg(target_os = "linux")]
fn clipboard_uri_target(target: &str) -> bool {
    target.starts_with("x-special/gnome-copied-files")
        || target.starts_with("text/uri-list")
        || target.starts_with("text/plain")
}

#[cfg(target_os = "linux")]
fn wl_paste_text<const N: usize>(args: [&str; N]) -> Option<String> {
    let output = Command::new("wl-paste").args(args).output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).replace('\0', ""))
}

#[cfg(target_os = "linux")]
fn clipboard_file_payload_from_uri_list(
    uri_list: &str,
) -> Result<Option<ClipboardImagePayload>, String> {
    first_supported_file_uri(uri_list)
        .map(|uri| file_asset_payload_from_uri(&uri))
        .transpose()
}

#[cfg(target_os = "linux")]
fn first_supported_file_uri(uri_list: &str) -> Option<String> {
    uri_list
        .lines()
        .map(str::trim)
        .find(|line| supported_file_uri_line(line))
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn supported_file_uri_line(line: &str) -> bool {
    !matches!(line, "" | "copy" | "cut")
        && !line.starts_with('#')
        && file_asset_mime_from_uri(line).is_some()
}

#[cfg(target_os = "linux")]
fn file_asset_payload_from_uri(uri: &str) -> Result<ClipboardImagePayload, String> {
    let path = path_from_file_uri(uri)?;
    file_asset_payload_from_path(&path).map_err(|error| {
        format!(
            "Clipboard URI value '{uri}' is invalid; expected readable local asset file: {error}"
        )
    })
}

#[cfg(target_os = "linux")]
fn file_asset_payload_from_path(path: &Path) -> Result<ClipboardImagePayload, String> {
    use base64::Engine;

    let bytes = std::fs::read(&path).map_err(|error| {
        format!(
            "asset file path value '{}' is invalid; expected readable local asset file: {error}",
            path.display()
        )
    })?;
    Ok(ClipboardImagePayload {
        bytes_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime_type: mime_from_path(path)?,
        file_name: file_name_from_path(path)?,
    })
}

#[cfg(target_os = "linux")]
fn path_from_file_uri(uri: &str) -> Result<PathBuf, String> {
    gtk::glib::filename_from_uri(uri)
        .map(|(path, _)| path)
        .map_err(|error| {
            format!("Clipboard URI value '{uri}' is invalid; expected local file:// URI: {error}")
        })
}

#[cfg(target_os = "linux")]
fn file_asset_mime_from_uri(uri: &str) -> Option<&'static str> {
    path_from_file_uri(uri)
        .ok()
        .and_then(|path| mime_from_extension(path.extension()?.to_str()?))
}

#[cfg(target_os = "linux")]
fn mime_from_path(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    mime_from_extension(extension).map(str::to_string).ok_or_else(|| {
        format!(
            "Clipboard file path value '{}' is invalid; expected PDF, Word, Excel, or image extension.",
            path.display()
        )
    })
}

#[cfg(target_os = "linux")]
fn file_name_from_path(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .ok_or_else(|| {
            format!(
                "Clipboard file path value '{}' is invalid; expected UTF-8 file name.",
                path.display()
            )
        })
}

#[cfg(target_os = "linux")]
fn mime_from_extension(extension: &str) -> Option<&'static str> {
    match extension.to_ascii_lowercase().as_str() {
        "pdf" => Some("application/pdf"),
        "doc" => Some("application/msword"),
        "docx" => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "xls" => Some("application/vnd.ms-excel"),
        "xlsx" => Some("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn clipboard_file_payload_from_uri_list_reads_pdf() {
        let file_path = temporary_pdf_path();
        std::fs::write(&file_path, b"%PDF-1.7").unwrap();

        let uri_list = format!("copy\nfile://{}", file_path.display());
        let payload = clipboard_file_payload_from_uri_list(&uri_list)
            .unwrap()
            .unwrap();
        std::fs::remove_file(&file_path).unwrap();

        assert_eq!(
            payload.file_name,
            file_path.file_name().unwrap().to_str().unwrap()
        );
        assert_eq!(payload.mime_type, "application/pdf");
        assert_eq!(payload.bytes_base64, "JVBERi0xLjc=");
    }

    fn temporary_pdf_path() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();

        std::env::temp_dir().join(format!("gtd-clipboard-asset-{millis}.pdf"))
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
        .invoke_handler(tauri::generate_handler![
            read_clipboard_image,
            read_clipboard_text,
            read_clipboard_file_asset,
            read_asset_file_path,
            open_external_url,
            open_temp_asset,
            render_pdf_first_page_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
