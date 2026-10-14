use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AgentActivity {
    pub kind: &'static str,
    pub message: String,
}

pub fn agent_activity(line: &str) -> Option<AgentActivity> {
    if let Some(message) = processing_progress_message(line) {
        return Some(activity("tool", message));
    }
    let value = serde_json::from_str::<Value>(line).ok()?;
    antigravity_activity(&value).or_else(|| codex_activity(&value))
}

pub fn processing_progress_message(line: &str) -> Option<&'static str> {
    if line.contains("gtd stuff show ") { return Some("Inspecting captured stuff"); }
    if line.contains("gtd contexts list") { return Some("Loading GTD contexts"); }
    if line.contains("gtd stuff export ") { return Some("Inspecting attachments"); }
    if line.contains("gtd stuff title ") || line.contains("gtd stuff body ") { return Some("Normalizing captured stuff"); }
    if line.contains("gtd stuff process next-action") { return Some("Processing as Next Action"); }
    if line.contains("gtd stuff process project") { return Some("Processing as Project"); }
    if line.contains("gtd stuff process calendar") { return Some("Processing as Calendar"); }
    if line.contains("gtd stuff process someday-maybe") { return Some("Processing as Someday/Maybe"); }
    None
}

pub fn has_denied_action(log: &str) -> bool {
    log.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok()).any(|value| {
        value.pointer("/result/denied_actions").and_then(Value::as_array).is_some_and(|actions| !actions.is_empty())
    })
}

pub fn agent_response(log: &str) -> Option<String> {
    let json_response = log.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter_map(agent_message_text).filter(|value| !value.is_empty()).last();
    json_response.or_else(|| plain_agent_response(log))
}

fn antigravity_activity(value: &Value) -> Option<AgentActivity> {
    match value.get("event")?.as_str()? {
        "init" => antigravity_init_activity(value),
        "step_update" => antigravity_step_activity(value),
        "result" => Some(activity("status", "Agent finished")),
        _ => None,
    }
}

fn antigravity_init_activity(value: &Value) -> Option<AgentActivity> {
    let model = value.pointer("/init/model").and_then(Value::as_str)?;
    Some(activity("status", format!("Agent initialized · {model}")))
}

fn antigravity_step_activity(value: &Value) -> Option<AgentActivity> {
    let step = value.get("step_update")?;
    match step.get("step_type")?.as_str()? {
        "tool" => antigravity_tool_activity(step),
        "agent_response" => antigravity_response_activity(step),
        _ => None,
    }
}

fn antigravity_tool_activity(step: &Value) -> Option<AgentActivity> {
    if step.get("state").and_then(Value::as_str)? != "ACTIVE" { return None; }
    let command = step.pointer("/tool_info/parameters/CommandLine").and_then(Value::as_str);
    if let Some(command) = command { return Some(activity("tool", summarize_command(command))); }
    let name = step.get("tool_name").and_then(Value::as_str).unwrap_or("tool");
    Some(activity("tool", format!("Using {name}")))
}

fn antigravity_response_activity(step: &Value) -> Option<AgentActivity> {
    let state = step.get("state").and_then(Value::as_str)?;
    let delta = step.get("text_delta").and_then(Value::as_str).unwrap_or("");
    if state == "ACTIVE" && !delta.is_empty() { return Some(activity("response", "Writing response")); }
    if state != "DONE" || !delta.is_empty() { return None; }
    Some(activity("reasoning", reasoning_complete_message(step)))
}

fn reasoning_complete_message(step: &Value) -> String {
    let seconds = step.get("duration_seconds").and_then(Value::as_f64);
    match seconds {
        Some(value) => format!("Reasoning step complete · {value:.1}s"),
        None => "Reasoning step complete".to_string(),
    }
}

fn codex_activity(value: &Value) -> Option<AgentActivity> {
    match value.get("type")?.as_str()? {
        "thread.started" => Some(activity("status", "Codex session started")),
        "turn.started" => Some(activity("reasoning", "Reasoning about the request")),
        "item.started" => codex_item_activity(value, true),
        "item.completed" => codex_item_activity(value, false),
        "turn.completed" => Some(activity("status", "Agent turn complete")),
        "error" => codex_error_activity(value),
        _ => None,
    }
}

fn codex_item_activity(value: &Value, started: bool) -> Option<AgentActivity> {
    let item = value.get("item")?;
    match item.get("type")?.as_str()? {
        "command_execution" => codex_command_activity(item, started),
        "reasoning" if !started => codex_reasoning_activity(item),
        "agent_message" if !started => Some(activity("response", "Response updated")),
        _ => None,
    }
}

fn codex_command_activity(item: &Value, started: bool) -> Option<AgentActivity> {
    let command = item.get("command").and_then(Value::as_str)?;
    let prefix = if started { "Running" } else { "Completed" };
    Some(activity("tool", format!("{prefix}: {}", summarize_command(command))))
}

fn codex_reasoning_activity(item: &Value) -> Option<AgentActivity> {
    let summary = item.get("text").and_then(Value::as_str).map(summarize_text);
    Some(activity("reasoning", summary.unwrap_or_else(|| "Reasoning step complete".to_string())))
}

fn codex_error_activity(value: &Value) -> Option<AgentActivity> {
    let message = value.get("message").and_then(Value::as_str).map(summarize_text)?;
    Some(activity("status", format!("Agent error: {message}")))
}

fn activity(kind: &'static str, message: impl Into<String>) -> AgentActivity {
    AgentActivity { kind, message: message.into() }
}

fn summarize_command(command: &str) -> String {
    summarize_text(command.trim_start_matches("/usr/bin/bash -lc ").trim_matches('\''))
}

fn summarize_text(value: &str) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= 180 { return normalized; }
    normalized.chars().take(177).collect::<String>() + "..."
}

fn agent_message_text(value: Value) -> Option<String> {
    let antigravity = value.pointer("/result/response").and_then(Value::as_str);
    let codex = codex_agent_message(&value);
    antigravity.or(codex).map(str::trim).map(str::to_string)
}

fn codex_agent_message(value: &Value) -> Option<&str> {
    if value.get("type").and_then(Value::as_str)? != "item.completed" { return None; }
    let item = value.get("item")?;
    if item.get("type").and_then(Value::as_str)? != "agent_message" { return None; }
    item.get("text").and_then(Value::as_str)
}

fn plain_agent_response(log: &str) -> Option<String> {
    log.lines().rev().map(str::trim).find(|line| !line.is_empty() && !line.starts_with('{'))
        .filter(|line| line.len() <= 2000).map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{agent_activity, agent_response};

    #[test]
    fn parses_antigravity_reasoning_and_tool_activity() {
        let reasoning_line = serde_json::json!({
            "event": "step_update",
            "step_update": { "state": "DONE", "step_type": "agent_response", "duration_seconds": 2.2786 }
        }).to_string();
        let tool_line = serde_json::json!({
            "event": "step_update",
            "step_update": { "state": "ACTIVE", "step_type": "tool", "tool_name": "run_command", "tool_info": { "parameters": { "CommandLine": "gtd contexts list" } } }
        }).to_string();
        let reasoning = agent_activity(&reasoning_line).expect("reasoning activity should parse");
        let tool = agent_activity(&tool_line).expect("tool activity should parse");
        assert_eq!(reasoning.kind, "reasoning");
        assert_eq!(reasoning.message, "Reasoning step complete · 2.3s");
        assert_eq!(tool.message, "Loading GTD contexts");
    }

    #[test]
    fn parses_codex_activity_and_final_response() {
        let started_line = serde_json::json!({
            "type": "item.started",
            "item": { "type": "command_execution", "command": "/usr/bin/bash -lc gtd contexts list" }
        }).to_string();
        let final_line = serde_json::json!({
            "type": "item.completed",
            "item": { "type": "agent_message", "text": "OK" }
        }).to_string();
        let started = agent_activity(&started_line).expect("codex command activity should parse");
        assert_eq!(started.message, "Loading GTD contexts");
        assert_eq!(agent_response(&final_line).as_deref(), Some("OK"));
    }
}
