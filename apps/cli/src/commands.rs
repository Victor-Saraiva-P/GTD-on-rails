use std::fs;
use std::path::{Path, PathBuf};

use crate::api::ApiClient;
use crate::args::{Command, ContextCommand, InboxCommand, ProcessCommand, StuffCommand};
use crate::error::CliError;
use crate::models::{CalendarRequest, EstimatedTime, ItemBody, NextActionRequest, ProjectRequest, UpdateBodyRequest, UpdateTitleRequest};

/// Executes one parsed GTD CLI command against the configured API.
///
/// Example: `run(client, command)`.
pub fn run(client: ApiClient, command: Command) -> Result<(), CliError> {
    match command {
        Command::Inbox(args) => run_inbox(&client, args.command),
        Command::Contexts(args) => run_contexts(&client, args.command),
        Command::Stuff(args) => run_stuff(&client, args.command),
        Command::Agent(_) => unreachable!("agent setup commands do not require the GTD API"),
    }
}

fn run_inbox(client: &ApiClient, command: InboxCommand) -> Result<(), CliError> {
    match command {
        InboxCommand::List => list_inbox(client),
    }
}

fn list_inbox(client: &ApiClient) -> Result<(), CliError> {
    for stuff in client.list_stuff()? {
        println!("{}\t{}\t{}", stuff.id, stuff.status, stuff.title);
    }
    Ok(())
}

fn run_contexts(client: &ApiClient, command: ContextCommand) -> Result<(), CliError> {
    match command {
        ContextCommand::List => list_contexts(client),
    }
}

fn list_contexts(client: &ApiClient) -> Result<(), CliError> {
    for context in client.list_contexts()? {
        println!("{}\t{}", context.id, context.name);
    }
    Ok(())
}

fn run_stuff(client: &ApiClient, command: StuffCommand) -> Result<(), CliError> {
    match command {
        StuffCommand::Show { id } => show_stuff(client, &id),
        StuffCommand::Export { id, output } => export_stuff(client, &id, &output),
        StuffCommand::Title { id, title } => update_title(client, &id, &title),
        StuffCommand::Body { id, file } => update_body(client, &id, &file),
        StuffCommand::Process(args) => process_stuff(client, args.command),
    }
}

fn show_stuff(client: &ApiClient, id: &str) -> Result<(), CliError> {
    let stuff = client.get_stuff(id)?;
    println!("id: {}", stuff.id);
    println!("title: {}", stuff.title);
    println!("status: {}", stuff.status);
    println!("created: {}", stuff.created_at);
    if let (Some(project_id), Some(project_title)) = (stuff.project_id, stuff.project_title) {
        println!("project: {project_title} ({project_id})");
    }
    println!("\n{}", stuff.body.text);
    Ok(())
}

fn update_title(client: &ApiClient, id: &str, title: &str) -> Result<(), CliError> {
    client.get_stuff(id)?;
    client.update_stuff_title(id, &UpdateTitleRequest { title })?;
    println!("updated stuff {id} title");
    Ok(())
}

fn update_body(client: &ApiClient, id: &str, file: &Path) -> Result<(), CliError> {
    let current = client.get_stuff(id)?;
    let text = fs::read_to_string(file).map_err(|source| CliError::ReadFile {
        path: file.display().to_string(), source,
    })?;
    require_existing_assets_preserved(&current.body.text, &text)?;
    let request = UpdateBodyRequest { body: ItemBody::markdown(text) };
    client.update_stuff_body(id, &request)?;
    println!("updated stuff {id} body");
    Ok(())
}

fn require_existing_assets_preserved(current: &str, candidate: &str) -> Result<(), CliError> {
    let candidate_assets = asset_paths(candidate);
    for asset in asset_paths(current) {
        if !candidate_assets.contains(&asset) {
            return Err(CliError::RemovedAssetReference(asset));
        }
    }
    Ok(())
}

fn process_stuff(client: &ApiClient, command: ProcessCommand) -> Result<(), CliError> {
    match command {
        ProcessCommand::NextAction { id, energy, minutes, contexts, deadline } => {
            process_next_action(client, &id, energy, minutes, &contexts, deadline.as_deref())
        }
        ProcessCommand::Project { id, deadline } => process_project(client, &id, deadline.as_deref()),
        ProcessCommand::SomedayMaybe { id } => process_someday(client, &id),
        ProcessCommand::Calendar { id, date, time } => process_calendar(client, &id, &date, time.as_deref()),
    }
}

fn process_next_action(client: &ApiClient, id: &str, energy: f64, minutes: u32, contexts: &[String], deadline: Option<&str>) -> Result<(), CliError> {
    let estimated_time = EstimatedTime { hours: minutes / 60, minutes: minutes % 60 };
    let request = NextActionRequest { energy, estimated_time, context_ids: contexts, deadline };
    client.process_next_action(id, &request)?;
    println!("processed stuff {id} as next action");
    Ok(())
}

fn process_project(client: &ApiClient, id: &str, deadline: Option<&str>) -> Result<(), CliError> {
    client.process_project(id, &ProjectRequest { deadline })?;
    println!("processed stuff {id} as project");
    Ok(())
}

fn process_someday(client: &ApiClient, id: &str) -> Result<(), CliError> {
    client.process_someday_maybe(id)?;
    println!("processed stuff {id} as someday/maybe");
    Ok(())
}

fn process_calendar(client: &ApiClient, id: &str, date: &str, time: Option<&str>) -> Result<(), CliError> {
    let request = CalendarRequest { scheduled_date: date, scheduled_time: time };
    client.process_calendar(id, &request)?;
    println!("processed stuff {id} as calendar item");
    Ok(())
}

fn export_stuff(client: &ApiClient, id: &str, output: &Path) -> Result<(), CliError> {
    let stuff = client.get_stuff(id)?;
    create_directory(output)?;
    write_file(&output.join("body.md"), stuff.body.text.as_bytes())?;
    for asset in asset_paths(&stuff.body.text) { export_asset(client, id, output, &asset)?; }
    println!("exported stuff {id} to {}", output.display());
    Ok(())
}

fn export_asset(client: &ApiClient, id: &str, output: &Path, asset: &str) -> Result<(), CliError> {
    validate_asset_path(asset)?;
    let bytes = client.download_stuff_asset(id, asset)?;
    let destination = output.join(asset);
    if let Some(parent) = destination.parent() { create_directory(parent)?; }
    write_file(&destination, &bytes)
}

fn create_directory(path: &Path) -> Result<(), CliError> {
    fs::create_dir_all(path).map_err(|source| CliError::WriteFile {
        path: path.display().to_string(), source,
    })
}

fn write_file(path: &Path, content: &[u8]) -> Result<(), CliError> {
    fs::write(path, content).map_err(|source| CliError::WriteFile {
        path: path.display().to_string(), source,
    })
}

fn validate_asset_path(path: &str) -> Result<(), CliError> {
    let candidate = PathBuf::from(path);
    let unsafe_component = candidate.components().any(|part| matches!(part, std::path::Component::ParentDir | std::path::Component::RootDir));
    if !path.starts_with("assets/") || unsafe_component { return Err(CliError::InvalidAssetPath(path.to_string())); }
    Ok(())
}

fn asset_paths(markdown: &str) -> Vec<String> {
    markdown.lines().flat_map(asset_paths_on_line).collect()
}

fn asset_paths_on_line(line: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut remaining = line;
    while let Some(start) = remaining.find("](assets/") {
        let path_start = start + 2;
        let tail = &remaining[path_start..];
        let Some(end) = tail.find(')') else { break; };
        paths.push(tail[..end].to_string());
        remaining = &tail[end + 1..];
    }
    paths
}

#[cfg(test)]
mod tests {
    use super::{asset_paths, validate_asset_path};

    #[test]
    fn finds_image_and_file_assets() {
        let markdown = "![shot](assets/a/image.png)\n[spec](assets/b/spec.pdf)";
        assert_eq!(asset_paths(markdown), vec!["assets/a/image.png", "assets/b/spec.pdf"]);
    }

    #[test]
    fn rejects_parent_directory_asset_path() {
        assert!(validate_asset_path("assets/../secret").is_err());
    }
}
