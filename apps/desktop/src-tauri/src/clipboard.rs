use std::path::{Path, PathBuf};
#[cfg(target_os = "linux")]
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImagePayload {
    pub bytes_base64: String,
    pub mime_type: String,
    pub file_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAssetPayload {
    pub source_path: String,
    pub mime_type: String,
    pub file_name: String,
}

pub fn read_clipboard_image() -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_image();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

pub fn read_clipboard_file_asset() -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_file_asset();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

pub fn read_clipboard_local_file_asset() -> Result<Option<LocalAssetPayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_local_file_asset();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

pub fn read_asset_file_path(file_path: String) -> Result<Option<ClipboardImagePayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return file_asset_payload_from_path(&PathBuf::from(file_path)).map(Some);
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

pub fn read_local_asset_path(file_path: String) -> Result<Option<LocalAssetPayload>, String> {
    #[cfg(target_os = "linux")]
    {
        return local_asset_payload_from_path(&PathBuf::from(file_path)).map(Some);
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

pub fn read_clipboard_text() -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        return read_linux_clipboard_text();
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
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
fn read_linux_clipboard_local_file_asset() -> Result<Option<LocalAssetPayload>, String> {
    if let Some(payload) = wl_clipboard_local_file_asset()? {
        return Ok(Some(payload));
    }

    let clipboard = linux_clipboard()?;
    gtk_clipboard_local_file_asset(&clipboard)
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
fn gtk_clipboard_local_file_asset(
    clipboard: &gtk::Clipboard,
) -> Result<Option<LocalAssetPayload>, String> {
    gtk_clipboard_uri_list(clipboard)
        .map(|uri_list| clipboard_local_file_payload_from_uri_list(&uri_list))
        .transpose()
        .map(Option::flatten)
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
fn wl_clipboard_local_file_asset() -> Result<Option<LocalAssetPayload>, String> {
    wl_clipboard_uri_list()
        .map(|uri_list| clipboard_local_file_payload_from_uri_list(&uri_list))
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
fn clipboard_local_file_payload_from_uri_list(
    uri_list: &str,
) -> Result<Option<LocalAssetPayload>, String> {
    first_supported_file_path(uri_list)
        .map(|path| local_asset_payload_from_path(&path))
        .transpose()
}

#[cfg(target_os = "linux")]
fn first_supported_file_path(uri_list: &str) -> Option<PathBuf> {
    uri_list
        .lines()
        .map(str::trim)
        .find_map(supported_file_path_line)
}

#[cfg(target_os = "linux")]
fn supported_file_path_line(line: &str) -> Option<PathBuf> {
    if matches!(line, "" | "copy" | "cut") || line.starts_with('#') {
        return None;
    }
    let path = path_from_file_line(line).ok()?;
    mime_from_path(&path).ok()?;
    Some(path)
}

#[cfg(target_os = "linux")]
fn path_from_file_line(line: &str) -> Result<PathBuf, String> {
    if line.starts_with("file://") {
        return path_from_file_uri(line);
    }
    Ok(PathBuf::from(line))
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
fn local_asset_payload_from_path(path: &Path) -> Result<LocalAssetPayload, String> {
    validate_readable_local_asset_path(path)?;
    Ok(LocalAssetPayload {
        source_path: path.to_string_lossy().to_string(),
        mime_type: mime_from_path(path)?,
        file_name: file_name_from_path(path)?,
    })
}

#[cfg(target_os = "linux")]
fn validate_readable_local_asset_path(path: &Path) -> Result<(), String> {
    if path.is_file() {
        return Ok(());
    }
    Err(format!(
        "asset file path value '{}' is invalid; expected readable local asset file",
        path.display()
    ))
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

    #[test]
    fn clipboard_local_file_payload_from_uri_list_reads_plain_path() {
        let file_path = temporary_pdf_path();
        std::fs::write(&file_path, b"%PDF-1.7").unwrap();

        let payload = clipboard_local_file_payload_from_uri_list(&file_path.to_string_lossy())
            .unwrap()
            .unwrap();
        std::fs::remove_file(&file_path).unwrap();

        assert_eq!(payload.source_path, file_path.to_string_lossy());
        assert_eq!(payload.mime_type, "application/pdf");
    }

    fn temporary_pdf_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();

        std::env::temp_dir().join(format!(
            "gtd-clipboard-asset-{}-{nanos}.pdf",
            std::process::id()
        ))
    }
}
