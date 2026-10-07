use thiserror::Error;

#[derive(Debug, Error)]
pub enum CliError {
    #[error("invalid API URL '{0}'; expected an absolute http(s) URL")]
    InvalidApiUrl(String),
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API returned {status}: {message}")]
    Api { status: u16, message: String },
    #[error("failed to read file '{path}': {source}")]
    ReadFile {
        path: String,
        source: std::io::Error,
    },
    #[error("failed to write file '{path}': {source}")]
    WriteFile {
        path: String,
        source: std::io::Error,
    },
    #[error("failed to read directory '{path}': {source}")]
    ReadDirectory {
        path: String,
        source: std::io::Error,
    },
    #[error("HOME is unavailable; expected a user home directory")]
    MissingHomeDirectory,
    #[error("invalid Antigravity settings at '{path}': {message}")]
    InvalidSettings { path: String, message: String },
    #[error("invalid asset path '{0}'; expected assets/<asset-id>/<filename>")]
    InvalidAssetPath(String),
    #[error(
        "candidate body removed asset reference '{0}'; preserve existing attachments while normalizing stuff"
    )]
    RemovedAssetReference(String),
    #[error(
        "stuff '{0}' has no associated project; expected inbox stuff assigned to an active project"
    )]
    ProjectContextUnavailable(String),
}
