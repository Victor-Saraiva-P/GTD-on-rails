use std::fs;
use std::path::{Path, PathBuf};

use crate::api::ApiClient;
use crate::args::{Command, ContextCommand, InboxCommand, ProcessCommand, StuffCommand};
use crate::error::CliError;
use crate::models::{
    CalendarRequest, EstimatedTime, ItemBody, NextActionRequest, ProjectRequest, UpdateBodyRequest,
    UpdateTitleRequest,
};

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
        StuffCommand::ProjectContext { id, output } => export_project_context(client, &id, &output),
        StuffCommand::Title { id, title } => update_title(client, &id, &title),
        StuffCommand::Body { id, file } => update_body(client, &id, &file),
        StuffCommand::Process(args) => process_stuff(client, args.command),
    }
}

fn show_stuff(client: &ApiClient, id: &str) -> Result<(), CliError> {
    let stuff = client.get_stuff(id)?;
    let project_body = project_context_body(client, &stuff)?;
    let project_text = project_body.as_ref().map(|body| body.text.as_str());
    println!("{}", format_stuff_show(&stuff, project_text));
    Ok(())
}

fn project_context_body(
    client: &ApiClient,
    stuff: &crate::models::Stuff,
) -> Result<Option<ItemBody>, CliError> {
    let Some(project) = project_reference(stuff)? else {
        return Ok(None);
    };
    Ok(Some(client.get_item_body(project.id)?))
}

fn project_reference(
    stuff: &crate::models::Stuff,
) -> Result<Option<ProjectReference<'_>>, CliError> {
    match (&stuff.project_id, &stuff.project_title) {
        (None, None) => Ok(None),
        (Some(id), Some(title)) => Ok(Some(ProjectReference { id, title })),
        _ => Err(CliError::ProjectContextUnavailable(stuff.id.clone())),
    }
}

fn required_project_reference(
    stuff: &crate::models::Stuff,
) -> Result<ProjectReference<'_>, CliError> {
    project_reference(stuff)?.ok_or_else(|| CliError::ProjectContextUnavailable(stuff.id.clone()))
}

struct ProjectReference<'a> {
    id: &'a str,
    title: &'a str,
}

fn format_stuff_show(stuff: &crate::models::Stuff, project_body: Option<&str>) -> String {
    let mut output = format!(
        "id: {}\ntitle: {}\nstatus: {}\ncreated: {}",
        stuff.id, stuff.title, stuff.status, stuff.created_at
    );
    if let Some(project) = project_reference(stuff).ok().flatten() {
        output.push_str(&format!("\nproject: {} ({})", project.title, project.id));
    }
    output.push_str(&format!("\n\n{}", stuff.body.text));
    if let Some(body) = project_body {
        output.push_str(&project_context_block(stuff, body));
    }
    output
}

fn project_context_block(stuff: &crate::models::Stuff, body: &str) -> String {
    let title = stuff.project_title.as_deref().unwrap_or("Unknown project");
    format!(
        "\n\n--- PROJECT CONTEXT (READ-ONLY) ---\nproject title: {title}\n\n{body}\n--- END PROJECT CONTEXT ---"
    )
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
        path: file.display().to_string(),
        source,
    })?;
    require_existing_assets_preserved(&current.body.text, &text)?;
    let request = UpdateBodyRequest {
        body: ItemBody::markdown(text),
    };
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
        ProcessCommand::NextAction {
            id,
            energy,
            minutes,
            contexts,
            deadline,
        } => process_next_action(client, &id, energy, minutes, &contexts, deadline.as_deref()),
        ProcessCommand::Project { id, deadline } => {
            process_project(client, &id, deadline.as_deref())
        }
        ProcessCommand::SomedayMaybe { id } => process_someday(client, &id),
        ProcessCommand::Calendar { id, date, time } => {
            process_calendar(client, &id, &date, time.as_deref())
        }
    }
}

fn process_next_action(
    client: &ApiClient,
    id: &str,
    energy: f64,
    minutes: u32,
    contexts: &[String],
    deadline: Option<&str>,
) -> Result<(), CliError> {
    let estimated_time = EstimatedTime {
        hours: minutes / 60,
        minutes: minutes % 60,
    };
    let request = NextActionRequest {
        energy,
        estimated_time,
        context_ids: contexts,
        deadline,
    };
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

fn process_calendar(
    client: &ApiClient,
    id: &str,
    date: &str,
    time: Option<&str>,
) -> Result<(), CliError> {
    let request = CalendarRequest {
        scheduled_date: date,
        scheduled_time: time,
    };
    client.process_calendar(id, &request)?;
    println!("processed stuff {id} as calendar item");
    Ok(())
}

fn export_stuff(client: &ApiClient, id: &str, output: &Path) -> Result<(), CliError> {
    let stuff = client.get_stuff(id)?;
    export_body_assets(output, &stuff.body.text, |asset| {
        client.download_item_asset(id, asset)
    })?;
    println!("exported stuff {id} to {}", output.display());
    Ok(())
}

fn export_project_context(client: &ApiClient, id: &str, output: &Path) -> Result<(), CliError> {
    let stuff = client.get_stuff(id)?;
    let project = required_project_reference(&stuff)?;
    let body = client.get_item_body(project.id)?;
    export_body_assets(output, &body.text, |asset| {
        client.download_item_asset(project.id, asset)
    })?;
    println!(
        "exported project context for stuff {id} to {}",
        output.display()
    );
    Ok(())
}

fn export_body_assets<F>(output: &Path, body: &str, download_asset: F) -> Result<(), CliError>
where
    F: Fn(&str) -> Result<Vec<u8>, CliError>,
{
    create_directory(output)?;
    write_file(&output.join("body.md"), body.as_bytes())?;
    for asset in asset_paths(body) {
        write_downloaded_asset(output, &asset, &download_asset(&asset)?)?;
    }
    Ok(())
}

fn write_downloaded_asset(output: &Path, asset: &str, bytes: &[u8]) -> Result<(), CliError> {
    validate_asset_path(asset)?;
    let destination = output.join(asset);
    if let Some(parent) = destination.parent() {
        create_directory(parent)?;
    }
    write_file(&destination, bytes)
}

fn create_directory(path: &Path) -> Result<(), CliError> {
    fs::create_dir_all(path).map_err(|source| CliError::WriteFile {
        path: path.display().to_string(),
        source,
    })
}

fn write_file(path: &Path, content: &[u8]) -> Result<(), CliError> {
    fs::write(path, content).map_err(|source| CliError::WriteFile {
        path: path.display().to_string(),
        source,
    })
}

fn validate_asset_path(path: &str) -> Result<(), CliError> {
    let candidate = PathBuf::from(path);
    let unsafe_component = candidate.components().any(|part| {
        matches!(
            part,
            std::path::Component::ParentDir | std::path::Component::RootDir
        )
    });
    if !path.starts_with("assets/") || unsafe_component {
        return Err(CliError::InvalidAssetPath(path.to_string()));
    }
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
        let Some(end) = tail.find(')') else {
            break;
        };
        paths.push(tail[..end].to_string());
        remaining = &tail[end + 1..];
    }
    paths
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use tempfile::tempdir;

    use super::{
        asset_paths, export_body_assets, format_stuff_show, required_project_reference,
        validate_asset_path,
    };
    use crate::models::{ItemBody, Stuff};

    #[test]
    fn finds_image_and_file_assets() {
        let markdown = "![shot](assets/a/image.png)\n[spec](assets/b/spec.pdf)";
        assert_eq!(
            asset_paths(markdown),
            vec!["assets/a/image.png", "assets/b/spec.pdf"]
        );
    }

    #[test]
    fn rejects_parent_directory_asset_path() {
        assert!(validate_asset_path("assets/../secret").is_err());
    }

    #[test]
    fn shows_delimited_read_only_project_context() {
        let stuff = stuff_with_project();

        let output = format_stuff_show(&stuff, Some("# Outcomes\n\nShip it"));

        assert!(output.contains("--- PROJECT CONTEXT (READ-ONLY) ---"));
        assert!(output.contains("project title: Launch public beta"));
        assert!(output.contains("# Outcomes\n\nShip it"));
        assert!(output.contains("--- END PROJECT CONTEXT ---"));
    }

    #[test]
    fn preserves_show_output_for_stuff_without_a_project() {
        let stuff = Stuff {
            id: "018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2".to_string(),
            title: "Inbox note".to_string(),
            body: ItemBody::markdown("Clarify this".to_string()),
            status: "INBOX".to_string(),
            created_at: "2026-10-06T12:00:00Z".to_string(),
            project_id: None,
            project_title: None,
        };

        assert_eq!(
            format_stuff_show(&stuff, None),
            "id: 018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2\ntitle: Inbox note\nstatus: INBOX\ncreated: 2026-10-06T12:00:00Z\n\nClarify this"
        );
    }

    #[test]
    fn exports_only_project_body_and_its_referenced_assets() {
        let output = tempdir().expect("temporary directory");
        let requested_assets = RefCell::new(Vec::new());
        let body = "![diagram](assets/diagram/design.png)";

        export_body_assets(output.path(), body, |asset| {
            requested_assets.borrow_mut().push(asset.to_string());
            Ok(b"project asset".to_vec())
        })
        .expect("project context export");

        assert_eq!(
            std::fs::read_to_string(output.path().join("body.md")).unwrap(),
            body
        );
        assert_eq!(
            std::fs::read(output.path().join("assets/diagram/design.png")).unwrap(),
            b"project asset"
        );
        assert_eq!(
            requested_assets.into_inner(),
            vec!["assets/diagram/design.png"]
        );
    }

    #[test]
    fn rejects_project_context_export_without_an_association() {
        let stuff = Stuff {
            id: "018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2".to_string(),
            title: "Inbox note".to_string(),
            body: ItemBody::markdown(String::new()),
            status: "INBOX".to_string(),
            created_at: "2026-10-06T12:00:00Z".to_string(),
            project_id: None,
            project_title: None,
        };

        assert!(required_project_reference(&stuff).is_err());
    }

    fn stuff_with_project() -> Stuff {
        Stuff {
            id: "018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2".to_string(),
            title: "Draft release checklist".to_string(),
            body: ItemBody::markdown("Original capture".to_string()),
            status: "INBOX".to_string(),
            created_at: "2026-10-06T12:00:00Z".to_string(),
            project_id: Some("018f13b2-a7f3-7c44-8f1a-9f31f65a7fd3".to_string()),
            project_title: Some("Launch public beta".to_string()),
        }
    }
}
