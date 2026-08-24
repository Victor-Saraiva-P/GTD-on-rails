use std::process::Command;

use serde::Serialize;

const REQUIRED_TOOLS: [&str; 2] = ["pg_dump", "pg_restore"];
const INSTALL_PROGRAM: &str = "pkexec";
const INSTALL_ARGUMENTS: [&str; 4] = ["pacman", "-S", "--needed", "--noconfirm"];
const PACKAGE_NAME: &str = "postgresql-libs";
const MANUAL_INSTALL_COMMAND: &str = "sudo pacman -S --needed postgresql-libs";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresToolsStatus {
    pub available: bool,
    pub missing_tools: Vec<String>,
    pub manual_install_command: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresToolsInstallResult {
    pub available: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    pub manual_install_command: String,
}

#[tauri::command]
pub fn postgres_tools_status() -> PostgresToolsStatus {
    let missing_tools = REQUIRED_TOOLS
        .iter()
        .filter(|tool| !tool_available(tool))
        .map(|tool| (*tool).to_string())
        .collect::<Vec<_>>();
    PostgresToolsStatus {
        available: missing_tools.is_empty(),
        missing_tools,
        manual_install_command: MANUAL_INSTALL_COMMAND.to_string(),
    }
}

#[tauri::command]
pub fn install_postgres_tools() -> PostgresToolsInstallResult {
    let status = Command::new(INSTALL_PROGRAM)
        .args(install_arguments())
        .status();
    match status {
        Ok(status) if status.success() => installation_status(None, false),
        Ok(status) => installation_status(
            Some(install_failure(status.code())),
            status.code() == Some(126),
        ),
        Err(error) => installation_status(
            Some(format!(
                "PostgreSQL client installation failed; expected Polkit authorization: {error}"
            )),
            false,
        ),
    }
}

fn installation_status(error: Option<String>, cancelled: bool) -> PostgresToolsInstallResult {
    let status = postgres_tools_status();
    PostgresToolsInstallResult {
        available: status.available,
        cancelled,
        error: error
            .or_else(|| (!status.available).then(|| missing_tools_error(&status.missing_tools))),
        manual_install_command: status.manual_install_command,
    }
}

fn tool_available(tool: &str) -> bool {
    Command::new(tool)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn install_arguments() -> Vec<&'static str> {
    let mut arguments = INSTALL_ARGUMENTS.to_vec();
    arguments.push(PACKAGE_NAME);
    arguments
}

fn install_failure(code: Option<i32>) -> String {
    format!("PostgreSQL client installation exited with status {:?}; expected completed Polkit authorization", code)
}

fn missing_tools_error(tools: &[String]) -> String {
    format!(
        "PostgreSQL client tools value '{}' is incomplete; expected pg_dump and pg_restore",
        tools.join(", ")
    )
}

#[cfg(test)]
mod tests {
    use super::{install_arguments, missing_tools_error, MANUAL_INSTALL_COMMAND, PACKAGE_NAME};

    #[test]
    fn installation_uses_fixed_polkit_arguments() {
        assert_eq!(
            install_arguments(),
            vec!["pacman", "-S", "--needed", "--noconfirm", PACKAGE_NAME]
        );
    }

    #[test]
    fn manual_install_command_is_safe_and_complete() {
        assert_eq!(
            MANUAL_INSTALL_COMMAND,
            "sudo pacman -S --needed postgresql-libs"
        );
    }

    #[test]
    fn missing_tool_message_names_the_expected_shape() {
        assert!(missing_tools_error(&["pg_dump".to_string()]).contains("pg_dump and pg_restore"));
    }
}
