use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfFirstPagePreviewPayload {
    pub bytes_base64: String,
    pub mime_type: String,
}

pub fn render_pdf_first_page_preview(
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

pub fn temporary_asset_path(file_name: &str) -> PathBuf {
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
