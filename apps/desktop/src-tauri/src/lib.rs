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
        use base64::Engine;

        let display =
            gtk::gdk::Display::default().ok_or_else(|| "No GTK display available.".to_string())?;
        let clipboard = gtk::Clipboard::default(&display)
            .ok_or_else(|| "No GTK clipboard available.".to_string())?;

        if !clipboard.wait_is_image_available() {
            return Ok(None);
        }

        let image = clipboard
            .wait_for_image()
            .ok_or_else(|| "Clipboard image could not be read.".to_string())?;
        let bytes = image
            .save_to_bufferv("png", &[])
            .map_err(|error| error.to_string())?;

        return Ok(Some(ClipboardImagePayload {
            bytes_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            mime_type: "image/png".to_string(),
            file_name: "clipboard-icon.png".to_string(),
        }));
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_clipboard_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
