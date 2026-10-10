use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;

use crate::agent_processing_runtime::{agent_response, has_denied_action, processing_progress_message};

const SETTINGS_FILE: &str = "agent-processing.json";
const MODEL_CACHE_FILE: &str = "agent-processing-models.json";
const DEVELOPMENT_API_URL: &str = "http://127.0.0.1:8080";
const DEFAULT_THINKING: &[&str] = &["low", "medium", "high", "xhigh", "max"];
const GTD_PROCESSING_SKILL: &str = include_str!("../../../../.agents/skills/gtd-processing/SKILL.md");

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProviderSettings {
    pub model: Option<String>,
    pub thinking: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProcessingSettings {
    pub processor: String,
    pub antigravity: AgentProviderSettings,
    pub codex: AgentProviderSettings,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModelOption {
    pub id: String,
    pub label: String,
    pub thinking: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProviderOptions {
    pub available: bool,
    pub models: Vec<AgentModelOption>,
    pub thinking: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProcessingOptions {
    pub antigravity: AgentProviderOptions,
    pub codex: AgentProviderOptions,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProcessingRun {
    pub run_id: String,
    pub stuff_id: String,
    pub provider: String,
    pub model: Option<String>,
    pub thinking: Option<String>,
    pub process_id: u32,
    pub log_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentProcessingFinished {
    run_id: String,
    stuff_id: String,
    provider: String,
    success: bool,
    processed: bool,
    denied: bool,
    response: Option<String>,
    log_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentProcessingProgress {
    run_id: String,
    stuff_id: String,
    provider: String,
    message: String,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentModelCache {
    antigravity: Vec<AgentModelOption>,
}

impl Default for AgentProviderSettings {
    fn default() -> Self {
        Self { model: None, thinking: None }
    }
}

impl Default for AgentProcessingSettings {
    fn default() -> Self {
        Self {
            processor: "antigravity".to_string(),
            antigravity: AgentProviderSettings::default(),
            codex: AgentProviderSettings::default(),
        }
    }
}

/// Loads the machine-local configuration used when GTD delegates inbox processing to an agent.
///
/// Example: `agent_processing_settings()` returns the saved processor, model, and thinking choices.
#[tauri::command]
pub fn agent_processing_settings() -> Result<AgentProcessingSettings, String> {
    let path = settings_path()?;
    if !path.is_file() {
        return Ok(AgentProcessingSettings::default());
    }
    let text = fs::read_to_string(&path).map_err(|error| file_error(&path, "readable settings", error))?;
    serde_json::from_str(&text).map_err(|error| format!("agent processing settings value '{}' is invalid JSON: {error}", path.display()))
}

/// Saves the machine-local configuration used by future headless GTD processing runs.
///
/// Example: `save_agent_processing_settings(settings)` persists provider-specific model choices.
#[tauri::command]
pub fn save_agent_processing_settings(settings: AgentProcessingSettings) -> Result<(), String> {
    validate_settings(&settings)?;
    let path = settings_path()?;
    let parent = path.parent().ok_or_else(|| "agent processing settings path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| file_error(parent, "writable config directory", error))?;
    let contents = serde_json::to_string_pretty(&settings).map_err(|error| format!("agent processing settings could not be encoded: {error}"))?;
    write_atomically(&path, format!("{contents}\n").as_bytes())
}

/// Loads locally available model and thinking choices without starting agent CLIs unless requested.
///
/// Example: `agent_processing_options(false)` uses cached Antigravity models and the Codex model cache.
#[tauri::command]
pub fn agent_processing_options(refresh: bool) -> Result<AgentProcessingOptions, String> {
    Ok(AgentProcessingOptions {
        antigravity: antigravity_options(refresh)?,
        codex: codex_options(),
    })
}

/// Starts one configured headless agent run for a specific active inbox stuff item.
///
/// Example: `start_agent_processing(app, id, title)` launches the selected harness and returns immediately.
#[tauri::command]
pub fn start_agent_processing(app: tauri::AppHandle, stuff_id: String, stuff_title: String) -> Result<AgentProcessingRun, String> {
    validate_stuff_identity(&stuff_id, &stuff_title)?;
    let settings = agent_processing_settings()?;
    validate_settings(&settings)?;
    let provider_settings = provider_settings(&settings).clone();
    let run_id = new_run_id(&stuff_id)?;
    let log_path = prepare_run_log(&run_id)?;
    let prompt = processing_prompt(&settings.processor, &stuff_id, &stuff_title);
    let api_url = processing_api_url(&app)?;
    let mut command = processing_command(&settings.processor, &provider_settings, &prompt)?;
    configure_processing_command(&mut command, &api_url);
    let child = command.spawn().map_err(|error| format!("{} processing failed to start: {error}", settings.processor))?;
    let run = processing_run(&settings.processor, &provider_settings, &stuff_id, &run_id, &log_path, child.id());
    monitor_processing_run(app, child, run.clone());
    Ok(run)
}

fn validate_stuff_identity(stuff_id: &str, stuff_title: &str) -> Result<(), String> {
    let valid_id = stuff_id.len() == 36 && stuff_id.chars().all(|value| value.is_ascii_hexdigit() || value == '-');
    if !valid_id { return Err("stuff id is invalid; expected UUID text".to_string()); }
    if stuff_title.trim().is_empty() || stuff_title.len() > 500 { return Err("stuff title is invalid; expected 1..500 characters".to_string()); }
    Ok(())
}

fn provider_settings(settings: &AgentProcessingSettings) -> &AgentProviderSettings {
    if settings.processor == "codex" { &settings.codex } else { &settings.antigravity }
}

fn processing_prompt(_provider: &str, stuff_id: &str, stuff_title: &str) -> String {
    let task = format!(
        "Process the inbox stuff with id {stuff_id} (\"{stuff_title}\"). Inspect the selected stuff and its read-only project context only as the skill directs. If clarification is required, ask the minimum clarification question and stop. Otherwise process the selected stuff into the appropriate GTD destination."
    );
    format!("Follow this GTD processing skill exactly:\n\n{GTD_PROCESSING_SKILL}\n\nTask:\n{task}")
}

fn processing_command(provider: &str, settings: &AgentProviderSettings, prompt: &str) -> Result<Command, String> {
    if provider == "antigravity" { return antigravity_command(settings, prompt); }
    if provider == "codex" { return codex_command(settings, prompt); }
    Err(format!("processing agent '{provider}' is unsupported"))
}

fn antigravity_command(settings: &AgentProviderSettings, prompt: &str) -> Result<Command, String> {
    let binary = resolve_binary("agy", &[".local/bin/agy"]).ok_or_else(|| "Antigravity CLI is not installed or discoverable".to_string())?;
    Ok(build_antigravity_command(binary, settings, prompt))
}

fn build_antigravity_command(binary: PathBuf, settings: &AgentProviderSettings, prompt: &str) -> Command {
    let mut command = Command::new(binary);
    command.args(["-p", prompt, "--output-format", "stream-json", "--print-timeout", "10m"]);
    if let Some(model) = &settings.model { command.arg("--model").arg(model); }
    if let Some(thinking) = &settings.thinking { command.arg("--effort").arg(thinking); }
    command
}

fn codex_command(settings: &AgentProviderSettings, prompt: &str) -> Result<Command, String> {
    let binary = resolve_codex_binary().ok_or_else(|| "Codex CLI is not installed or discoverable".to_string())?;
    let mut command = Command::new(binary);
    command.args(["exec", "--sandbox", "workspace-write", "--ask-for-approval", "never", "--color", "never", "--skip-git-repo-check"]);
    command.args(["-c", "sandbox_workspace_write.network_access=true"]);
    if let Some(model) = &settings.model { command.arg("--model").arg(model); }
    if let Some(thinking) = &settings.thinking { command.arg("-c").arg(format!("model_reasoning_effort=\"{thinking}\"")); }
    command.arg(prompt);
    Ok(command)
}

fn new_run_id(stuff_id: &str) -> Result<String, String> {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock is invalid; expected time after UNIX epoch: {error}"))?.as_millis();
    let suffix = stuff_id.chars().filter(|value| value.is_ascii_hexdigit()).take(8).collect::<String>();
    Ok(format!("{millis}-{suffix}"))
}

fn prepare_run_log(run_id: &str) -> Result<PathBuf, String> {
    let directory = config_root()?.join("agent-runs");
    fs::create_dir_all(&directory).map_err(|error| file_error(&directory, "writable agent run directory", error))?;
    let path = directory.join(format!("{run_id}.log"));
    File::create(&path).map_err(|error| file_error(&path, "writable agent run log", error))?;
    Ok(path)
}

fn configure_processing_command(command: &mut Command, api_url: &str) {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    command.env("GTD_API_URL", api_url);
    if let Some(path) = processing_path() { command.env("PATH", path); }
    if let Some(home) = std::env::var_os("HOME") { command.current_dir(home); }
}

fn processing_api_url(app: &tauri::AppHandle) -> Result<String, String> {
    if !crate::sidecar::sidecar_enabled() {
        return Ok(DEVELOPMENT_API_URL.to_string());
    }
    crate::sidecar::sidecar_base_url(app)
        .ok_or_else(|| "desktop API is not ready; wait for the local backend before starting agent processing".to_string())
}

fn processing_path() -> Option<OsString> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let mut entries = vec![home.join(".local/bin")];
    if let Some(current) = std::env::var_os("PATH") { entries.extend(std::env::split_paths(&current)); }
    std::env::join_paths(entries).ok()
}

fn processing_run(provider: &str, settings: &AgentProviderSettings, stuff_id: &str, run_id: &str, log_path: &Path, process_id: u32) -> AgentProcessingRun {
    AgentProcessingRun { run_id: run_id.to_string(), stuff_id: stuff_id.to_string(), provider: provider.to_string(), model: settings.model.clone(), thinking: settings.thinking.clone(), process_id, log_path: log_path.display().to_string() }
}

fn monitor_processing_run(app: tauri::AppHandle, mut child: std::process::Child, run: AgentProcessingRun) {
    tauri::async_runtime::spawn_blocking(move || {
        let log = shared_run_log(&run.log_path);
        let stdout = child.stdout.take().and_then(|stream| monitor_stream(app.clone(), run.clone(), stream, log.clone()));
        let stderr = child.stderr.take().and_then(|stream| monitor_stream(app.clone(), run.clone(), stream, log.clone()));
        let process_success = child.wait().map(|status| status.success()).unwrap_or(false);
        if let Some(handle) = stdout { let _ = handle.join(); }
        if let Some(handle) = stderr { let _ = handle.join(); }
        emit_processing_finished(&app, run, process_success);
    });
}

fn shared_run_log(path: &str) -> Arc<Mutex<Option<File>>> {
    let file = OpenOptions::new().create(true).append(true).open(path).ok();
    Arc::new(Mutex::new(file))
}

fn monitor_stream<R: Read + Send + 'static>(
    app: tauri::AppHandle,
    run: AgentProcessingRun,
    stream: R,
    log: Arc<Mutex<Option<File>>>,
) -> Option<std::thread::JoinHandle<()>> {
    Some(std::thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            write_run_log_line(&log, &line);
            if let Some(message) = processing_progress_message(&line) {
                emit_processing_progress(&app, &run, message);
            }
        }
    }))
}

fn write_run_log_line(log: &Arc<Mutex<Option<File>>>, line: &str) {
    let Ok(mut guard) = log.lock() else { return; };
    let Some(file) = guard.as_mut() else { return; };
    let _ = writeln!(file, "{line}");
}

fn emit_processing_progress(app: &tauri::AppHandle, run: &AgentProcessingRun, message: &str) {
    let progress = AgentProcessingProgress {
        run_id: run.run_id.clone(),
        stuff_id: run.stuff_id.clone(),
        provider: run.provider.clone(),
        message: message.to_string(),
    };
    let _ = app.emit("agent-processing-progress", progress);
}

fn emit_processing_finished(app: &tauri::AppHandle, run: AgentProcessingRun, process_success: bool) {
    let log = fs::read_to_string(&run.log_path).unwrap_or_default();
    let denied = has_denied_action(&log);
    let processed = log.contains(&format!("processed stuff {} as ", run.stuff_id));
    let response = agent_response(&log);
    let finished = AgentProcessingFinished {
        run_id: run.run_id,
        stuff_id: run.stuff_id,
        provider: run.provider,
        success: process_success && !denied,
        processed,
        denied,
        response,
        log_path: run.log_path,
    };
    let _ = app.emit("agent-processing-finished", finished);
}

fn validate_settings(settings: &AgentProcessingSettings) -> Result<(), String> {
    if !matches!(settings.processor.as_str(), "antigravity" | "codex") {
        return Err("processor is invalid; expected antigravity or codex".to_string());
    }
    validate_provider("antigravity", &settings.antigravity)?;
    validate_provider("codex", &settings.codex)
}

fn validate_provider(name: &str, settings: &AgentProviderSettings) -> Result<(), String> {
    validate_optional_value(name, "model", settings.model.as_deref(), 120)?;
    validate_optional_value(name, "thinking", settings.thinking.as_deref(), 32)
}

fn validate_optional_value(provider: &str, field: &str, value: Option<&str>, max: usize) -> Result<(), String> {
    let Some(value) = value else { return Ok(()); };
    if value.trim().is_empty() || value.len() > max {
        return Err(format!("{provider} {field} value is invalid; expected 1..{max} characters"));
    }
    Ok(())
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(config_root()?.join(SETTINGS_FILE))
}

fn config_root() -> Result<PathBuf, String> {
    if let Some(config) = std::env::var_os("XDG_CONFIG_HOME") { return Ok(PathBuf::from(config).join("gtd-on-rails")); }
    let home = std::env::var_os("HOME").ok_or_else(|| "HOME is missing; expected user config directory".to_string())?;
    Ok(PathBuf::from(home).join(".config/gtd-on-rails"))
}

fn write_atomically(path: &Path, contents: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents).map_err(|error| file_error(&temporary, "writable temporary settings", error))?;
    fs::rename(&temporary, path).map_err(|error| file_error(path, "replaceable settings", error))
}

fn antigravity_options(refresh: bool) -> Result<AgentProviderOptions, String> {
    let Some(binary) = resolve_binary("agy", &[".local/bin/agy"]) else {
        return Ok(AgentProviderOptions { available: false, models: Vec::new(), thinking: default_thinking() });
    };
    let models = if refresh { refresh_antigravity_models(&binary)? } else { cached_antigravity_models()? };
    Ok(AgentProviderOptions { available: true, models, thinking: default_thinking() })
}

fn refresh_antigravity_models(binary: &Path) -> Result<Vec<AgentModelOption>, String> {
    let output = Command::new(binary).arg("models").output()
        .map_err(|error| format!("Antigravity model refresh failed to start '{}': {error}", binary.display()))?;
    if !output.status.success() {
        return Err("Antigravity model refresh failed; keep the existing cached model list and try again later.".to_string());
    }
    let models = parse_antigravity_models(&output.stdout);
    write_model_cache(&models)?;
    Ok(models)
}

fn cached_antigravity_models() -> Result<Vec<AgentModelOption>, String> {
    let path = model_cache_path()?;
    if !path.is_file() { return Ok(Vec::new()); }
    let text = fs::read_to_string(&path).map_err(|error| file_error(&path, "readable model cache", error))?;
    let cache: AgentModelCache = serde_json::from_str(&text)
        .map_err(|error| format!("agent model cache value '{}' is invalid JSON: {error}", path.display()))?;
    Ok(cache.antigravity)
}

fn write_model_cache(models: &[AgentModelOption]) -> Result<(), String> {
    let path = model_cache_path()?;
    let parent = path.parent().ok_or_else(|| "agent model cache path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| file_error(parent, "writable config directory", error))?;
    let cache = AgentModelCache { antigravity: models.to_vec() };
    let contents = serde_json::to_string_pretty(&cache).map_err(|error| format!("agent model cache could not be encoded: {error}"))?;
    write_atomically(&path, format!("{contents}\n").as_bytes())
}

fn parse_antigravity_models(stdout: &[u8]) -> Vec<AgentModelOption> {
    String::from_utf8_lossy(stdout)
        .lines()
        .filter_map(parse_antigravity_model)
        .collect()
}

fn parse_antigravity_model(line: &str) -> Option<AgentModelOption> {
    let (id, label) = line.split_once('\t')?;
    if id.trim().is_empty() { return None; }
    Some(AgentModelOption { id: id.trim().to_string(), label: label.trim().to_string(), thinking: default_thinking() })
}

fn codex_options() -> AgentProviderOptions {
    let available = resolve_codex_binary().is_some();
    let models = codex_models().unwrap_or_default();
    let thinking = codex_thinking(&models);
    AgentProviderOptions { available, models, thinking }
}

fn codex_models() -> Result<Vec<AgentModelOption>, String> {
    let path = codex_home()?.join("models_cache.json");
    if !path.is_file() { return Ok(Vec::new()); }
    let text = fs::read_to_string(&path).map_err(|error| file_error(&path, "readable Codex model cache", error))?;
    let root: Value = serde_json::from_str(&text).map_err(|error| format!("Codex model cache value '{}' is invalid JSON: {error}", path.display()))?;
    Ok(root.get("models").and_then(Value::as_array).into_iter().flatten().filter_map(parse_codex_model).collect())
}

fn parse_codex_model(value: &Value) -> Option<AgentModelOption> {
    let id = value.get("slug")?.as_str()?.to_string();
    let label = value.get("display_name").and_then(Value::as_str).unwrap_or(&id).to_string();
    let thinking = value.get("supported_reasoning_levels").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|entry| entry.get("effort").and_then(Value::as_str).map(str::to_string)).collect();
    Some(AgentModelOption { id, label, thinking })
}

fn codex_thinking(models: &[AgentModelOption]) -> Vec<String> {
    let available = models.iter().flat_map(|model| model.thinking.iter()).collect::<Vec<_>>();
    let order = ["low", "medium", "high", "xhigh", "max", "ultra"];
    let thinking = order.into_iter().filter(|effort| available.iter().any(|value| value.as_str() == *effort))
        .map(str::to_string).collect::<Vec<_>>();
    if thinking.is_empty() { default_thinking() } else { thinking }
}

fn resolve_codex_binary() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("CODEX_CLI_PATH") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() { return Some(candidate); }
    }
    resolve_binary("codex", &[".local/bin/codex", ".cargo/bin/codex", "/usr/local/bin/codex", "/usr/bin/codex", "/usr/lib/chatgpt/resources/codex"])
}

fn resolve_binary(name: &str, candidates: &[&str]) -> Option<PathBuf> {
    if let Some(path) = find_in_path(name) { return Some(path); }
    let home = std::env::var_os("HOME").map(PathBuf::from);
    candidates.iter().map(|candidate| resolve_candidate(candidate, home.as_deref())).find(|path| path.is_file())
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).map(|directory| directory.join(name)).find(|candidate| candidate.is_file())
}

fn resolve_candidate(candidate: &str, home: Option<&Path>) -> PathBuf {
    let path = PathBuf::from(candidate);
    if path.is_absolute() { return path; }
    home.map(|directory| directory.join(&path)).unwrap_or(path)
}

fn model_cache_path() -> Result<PathBuf, String> {
    Ok(settings_path()?.with_file_name(MODEL_CACHE_FILE))
}

fn codex_home() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("CODEX_HOME") { return Ok(PathBuf::from(path)); }
    let home = std::env::var_os("HOME").ok_or_else(|| "HOME is missing; expected Codex home directory".to_string())?;
    Ok(PathBuf::from(home).join(".codex"))
}

fn default_thinking() -> Vec<String> {
    DEFAULT_THINKING.iter().map(|value| (*value).to_string()).collect()
}

fn file_error(path: &Path, expected: &str, error: std::io::Error) -> String {
    format!("file path value '{}' is invalid; expected {expected}: {error}", path.display())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{build_antigravity_command, processing_prompt, AgentProviderSettings};

    #[test]
    fn instructs_the_agent_to_use_read_only_project_context() {
        let prompt = processing_prompt(
            "codex",
            "018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2",
            "Draft release checklist",
        );

        assert!(prompt.contains("--- PROJECT CONTEXT (READ-ONLY) ---"));
        assert!(prompt.contains("gtd stuff project-context <id> --output <directory>"));
        assert!(prompt.contains("Never mutate the project context"));
    }

    #[test]
    fn antigravity_runs_gtd_outside_the_terminal_sandbox() {
        let settings = AgentProviderSettings { model: None, thinking: None };
        let command = build_antigravity_command(PathBuf::from("agy"), &settings, "process stuff");
        let arguments = command
            .get_args()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert!(!arguments.iter().any(|argument| argument == "--sandbox"));
    }

    #[test]
    fn keeps_the_selected_stuff_as_the_only_mutation_target() {
        let prompt = processing_prompt(
            "antigravity",
            "018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2",
            "Draft release checklist",
        );

        assert!(prompt.contains("Mutate only the selected stuff"));
        assert!(prompt.contains("If no project context block is present, continue the normal workflow"));
    }
}
