use serde_json::Value;

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
        .filter_map(|value| value.pointer("/result/response").and_then(Value::as_str).map(str::trim).map(str::to_string))
        .filter(|value| !value.is_empty()).last();
    json_response.or_else(|| plain_agent_response(log))
}

fn plain_agent_response(log: &str) -> Option<String> {
    log.lines().rev().map(str::trim).find(|line| !line.is_empty() && !line.starts_with('{'))
        .filter(|line| line.len() <= 2000).map(str::to_string)
}
