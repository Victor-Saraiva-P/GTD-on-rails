mod agent;
mod api;
mod args;
mod commands;
mod endpoint;
mod error;
mod models;

use args::{AgentCommand, Cli, Command};
use clap::Parser;
use error::CliError;

fn main() {
    if let Err(error) = run() {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), CliError> {
    let cli = Cli::parse();
    match cli.command {
        Command::Agent(args) => run_agent(args.command),
        command => run_api_command(cli.api_url, command),
    }
}

fn run_agent(command: AgentCommand) -> Result<(), CliError> {
    match command {
        AgentCommand::ConfigureAntigravity => {
            let result = agent::configure_antigravity_permissions()?;
            let state = if result.changed { "configured" } else { "already configured" };
            println!("Antigravity GTD access {state}: {}", result.path.display());
            println!("Antigravity GTD skill: {}", result.skill_path.display());
            Ok(())
        }
        AgentCommand::ConfigureCodex => {
            let result = agent::configure_codex()?;
            let state = if result.changed { "configured" } else { "already configured" };
            println!("Codex GTD access {state}: {}", result.rules_path.display());
            println!("Codex GTD skill: {}", result.skill_path.display());
            Ok(())
        }
    }
}

fn run_api_command(api_url: Option<String>, command: Command) -> Result<(), CliError> {
    let api_url = endpoint::resolve_api_url(api_url)?;
    let client = api::ApiClient::new(api_url)?;
    commands::run(client, command)
}
