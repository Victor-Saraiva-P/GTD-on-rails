use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardImagePayload {
    bytes_base64: String,
    mime_type: String,
    file_name: String,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_clipboard_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
