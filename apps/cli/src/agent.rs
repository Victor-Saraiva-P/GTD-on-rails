use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::error::CliError;

const COMMAND_PERMISSION: &str = "command(gtd)";
const LEGACY_UNSANDBOXED_PERMISSION: &str = "unsandboxed(gtd)";
const CODEX_RULES: &str = r#"prefix_rule(
    pattern = ["gtd"],
    decision = "allow",
    justification = "Allows the controlled GTD on Rails CLI in headless agent workflows.",
)
"#;
const GTD_PROCESSING_SKILL: &str = include_str!("../../../.agents/skills/gtd-processing/SKILL.md");

pub struct AntigravityConfigResult {
    pub path: PathBuf,
    pub skill_path: PathBuf,
    pub changed: bool,
}

pub struct CodexConfigResult {
    pub rules_path: PathBuf,
    pub skill_path: PathBuf,
    pub changed: bool,
}

/// Adds the scoped GTD CLI permissions required by Antigravity headless mode.
///
/// Example: `configure_antigravity_permissions()` preserves existing settings and adds only GTD rules.
pub fn configure_antigravity_permissions() -> Result<AntigravityConfigResult, CliError> {
    let path = antigravity_settings_path()?;
    let skill_path = antigravity_skill_path()?;
    let mut settings = read_settings(&path)?;
    let permissions_changed = add_permission_rules(&path, &mut settings)?;
    if permissions_changed { write_settings(&path, &settings)?; }
    let skill_changed = write_managed_file(&skill_path, GTD_PROCESSING_SKILL.as_bytes())?;
    Ok(AntigravityConfigResult { path, skill_path, changed: permissions_changed || skill_changed })
}

/// Configures Codex to run the controlled GTD CLI headlessly and discover its processing skill.
///
/// Example: `configure_codex()` installs one scoped command rule and the shared GTD processing skill.
pub fn configure_codex() -> Result<CodexConfigResult, CliError> {
    let home = codex_home()?;
    let rules_path = home.join("rules/gtd-on-rails.rules");
    let skill_path = home.join("skills/gtd-processing/SKILL.md");
    let rules_changed = write_managed_file(&rules_path, CODEX_RULES.as_bytes())?;
    let skill_changed = write_managed_file(&skill_path, GTD_PROCESSING_SKILL.as_bytes())?;
    Ok(CodexConfigResult {
        rules_path,
        skill_path,
        changed: rules_changed || skill_changed,
    })
}

fn antigravity_settings_path() -> Result<PathBuf, CliError> {
    Ok(home_directory()?.join(".gemini/antigravity-cli/settings.json"))
}

fn antigravity_skill_path() -> Result<PathBuf, CliError> {
    Ok(home_directory()?.join(".gemini/config/skills/gtd-processing/SKILL.md"))
}

fn codex_home() -> Result<PathBuf, CliError> {
    if let Some(path) = non_empty_env_path("CODEX_HOME") {
        return Ok(path);
    }
    Ok(home_directory()?.join(".codex"))
}

fn home_directory() -> Result<PathBuf, CliError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or(CliError::MissingHomeDirectory)
}

fn non_empty_env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn read_settings(path: &Path) -> Result<Value, CliError> {
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let text = fs::read_to_string(path).map_err(|source| CliError::ReadFile {
        path: path.display().to_string(),
        source,
    })?;
    serde_json::from_str(&text).map_err(|source| CliError::InvalidSettings {
        path: path.display().to_string(),
        message: source.to_string(),
    })
}

fn add_permission_rules(path: &Path, settings: &mut Value) -> Result<bool, CliError> {
    let root = object_at(path, settings, "root settings")?;
    let permissions = root
        .entry("permissions")
        .or_insert_with(|| Value::Object(Map::new()));
    let permissions = object_at(path, permissions, "permissions")?;
    let allow = permissions.entry("allow").or_insert_with(|| Value::Array(Vec::new()));
    let allow = allow
        .as_array_mut()
        .ok_or_else(|| invalid_shape(path, "permissions.allow must be an array"))?;
    Ok(reconcile_permission_rules(allow))
}

fn reconcile_permission_rules(allow: &mut Vec<Value>) -> bool {
    let original_len = allow.len();
    allow.retain(|entry| entry.as_str() != Some(LEGACY_UNSANDBOXED_PERMISSION));
    let removed_legacy_rule = allow.len() != original_len;
    if allow.iter().any(|entry| entry.as_str() == Some(COMMAND_PERMISSION)) {
        return removed_legacy_rule;
    }
    allow.push(Value::String(COMMAND_PERMISSION.to_string()));
    true
}

fn object_at<'a>(
    path: &Path,
    value: &'a mut Value,
    name: &str,
) -> Result<&'a mut Map<String, Value>, CliError> {
    value
        .as_object_mut()
        .ok_or_else(|| invalid_shape(path, &format!("{name} must be a JSON object")))
}

fn invalid_shape(path: &Path, message: &str) -> CliError {
    CliError::InvalidSettings {
        path: path.display().to_string(),
        message: message.to_string(),
    }
}

fn write_settings(path: &Path, settings: &Value) -> Result<(), CliError> {
    let contents = serde_json::to_string_pretty(settings).map_err(|source| CliError::InvalidSettings {
        path: path.display().to_string(),
        message: source.to_string(),
    })?;
    write_managed_file(path, format!("{contents}\n").as_bytes()).map(|_| ())
}

fn write_managed_file(path: &Path, contents: &[u8]) -> Result<bool, CliError> {
    if fs::read(path).ok().as_deref() == Some(contents) {
        return Ok(false);
    }
    let parent = path.parent().ok_or_else(|| invalid_shape(path, "managed path has no parent directory"))?;
    fs::create_dir_all(parent).map_err(|source| CliError::WriteFile {
        path: parent.display().to_string(),
        source,
    })?;
    write_atomically(path, contents)?;
    Ok(true)
}

fn write_atomically(path: &Path, contents: &[u8]) -> Result<(), CliError> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| invalid_shape(path, "managed path has no file name"))?;
    let temporary = path.with_file_name(format!("{file_name}.tmp"));
    fs::write(&temporary, contents).map_err(|source| CliError::WriteFile {
        path: temporary.display().to_string(),
        source,
    })?;
    preserve_existing_permissions(path, &temporary)?;
    fs::rename(&temporary, path).map_err(|source| CliError::WriteFile {
        path: path.display().to_string(),
        source,
    })
}

fn preserve_existing_permissions(source: &Path, target: &Path) -> Result<(), CliError> {
    if !source.exists() {
        return Ok(());
    }
    let permissions = fs::metadata(source)
        .map_err(|source_error| CliError::ReadFile {
            path: source.display().to_string(),
            source: source_error,
        })?
        .permissions();
    fs::set_permissions(target, permissions).map_err(|source_error| CliError::WriteFile {
        path: target.display().to_string(),
        source: source_error,
    })
}

#[cfg(test)]
mod tests {
    use super::{reconcile_permission_rules, COMMAND_PERMISSION, LEGACY_UNSANDBOXED_PERMISSION};
    use serde_json::Value;

    #[test]
    fn removes_legacy_unsandboxed_permission_and_keeps_command_permission() {
        let mut allow = vec![
            Value::String("mcp(ai-memory/memory_explore)".to_string()),
            Value::String(COMMAND_PERMISSION.to_string()),
            Value::String(LEGACY_UNSANDBOXED_PERMISSION.to_string()),
        ];

        assert!(reconcile_permission_rules(&mut allow));
        assert!(allow.iter().any(|entry| entry.as_str() == Some(COMMAND_PERMISSION)));
        assert!(!allow.iter().any(|entry| entry.as_str() == Some(LEGACY_UNSANDBOXED_PERMISSION)));
    }
}
