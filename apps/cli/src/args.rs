use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "gtd", version, about = "Controlled CLI for GTD on Rails agents")]
pub struct Cli {
    #[arg(long, env = "GTD_API_URL")]
    pub api_url: Option<String>,
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Agent(AgentArgs),
    Inbox(InboxArgs),
    Contexts(ContextArgs),
    Stuff(StuffArgs),
}

#[derive(Debug, Args)]
pub struct AgentArgs {
    #[command(subcommand)]
    pub command: AgentCommand,
}

#[derive(Debug, Subcommand)]
pub enum AgentCommand {
    ConfigureAntigravity,
    ConfigureCodex,
}

#[derive(Debug, Args)]
pub struct InboxArgs {
    #[command(subcommand)]
    pub command: InboxCommand,
}

#[derive(Debug, Subcommand)]
pub enum InboxCommand {
    List,
}

#[derive(Debug, Args)]
pub struct ContextArgs {
    #[command(subcommand)]
    pub command: ContextCommand,
}

#[derive(Debug, Subcommand)]
pub enum ContextCommand {
    List,
}

#[derive(Debug, Args)]
pub struct StuffArgs {
    #[command(subcommand)]
    pub command: StuffCommand,
}

#[derive(Debug, Subcommand)]
pub enum StuffCommand {
    Show {
        #[arg(value_parser = parse_uuid)]
        id: String,
    },
    Export {
        #[arg(value_parser = parse_uuid)]
        id: String,
        #[arg(long)]
        output: PathBuf,
    },
    Title {
        #[arg(value_parser = parse_uuid)]
        id: String,
        title: String,
    },
    Body {
        #[arg(value_parser = parse_uuid)]
        id: String,
        #[arg(long)]
        file: PathBuf,
    },
    Process(ProcessArgs),
}

#[derive(Debug, Args)]
pub struct ProcessArgs {
    #[command(subcommand)]
    pub command: ProcessCommand,
}

#[derive(Debug, Subcommand)]
pub enum ProcessCommand {
    NextAction {
        #[arg(value_parser = parse_uuid)]
        id: String,
        #[arg(long, value_parser = parse_energy)]
        energy: f64,
        #[arg(long)]
        minutes: u32,
        #[arg(long = "context", value_parser = parse_uuid)]
        contexts: Vec<String>,
        #[arg(long, value_parser = parse_date)]
        deadline: Option<String>,
    },
    Project {
        #[arg(value_parser = parse_uuid)]
        id: String,
        #[arg(long, value_parser = parse_date)]
        deadline: Option<String>,
    },
    SomedayMaybe {
        #[arg(value_parser = parse_uuid)]
        id: String,
    },
    Calendar {
        #[arg(value_parser = parse_uuid)]
        id: String,
        #[arg(long, value_parser = parse_date)]
        date: String,
        #[arg(long, value_parser = parse_time)]
        time: Option<String>,
    },
}

fn parse_uuid(value: &str) -> Result<String, String> {
    if value.len() != 36 {
        return Err(format!("'{value}' is invalid; expected UUID"));
    }
    for (index, byte) in value.bytes().enumerate() {
        let hyphen = matches!(index, 8 | 13 | 18 | 23);
        if (hyphen && byte != b'-') || (!hyphen && !byte.is_ascii_hexdigit()) {
            return Err(format!("'{value}' is invalid; expected UUID"));
        }
    }
    Ok(value.to_string())
}

fn parse_energy(value: &str) -> Result<f64, String> {
    let parts: Vec<&str> = value.split('.').collect();
    let valid_shape = parts.len() <= 2
        && !parts[0].is_empty()
        && parts.iter().all(|part| part.bytes().all(|byte| byte.is_ascii_digit()))
        && parts.get(1).is_none_or(|fraction| fraction.len() == 1);
    if !valid_shape {
        return Err(format!("'{value}' is invalid; expected energy from 0.0 to 10.0 with at most 1 decimal place"));
    }
    let parsed = value.parse::<f64>().unwrap_or(-1.0);
    if !(0.0..=10.0).contains(&parsed) {
        return Err(format!("'{value}' is invalid; expected energy from 0.0 to 10.0 with at most 1 decimal place"));
    }
    Ok(parsed)
}

fn parse_date(value: &str) -> Result<String, String> {
    let parts: Vec<&str> = value.split('-').collect();
    let valid_shape = parts.len() == 3 && parts[0].len() == 4 && parts[1].len() == 2 && parts[2].len() == 2;
    if !valid_shape || !parts.iter().all(|part| part.bytes().all(|byte| byte.is_ascii_digit())) {
        return Err(format!("'{value}' is invalid; expected YYYY-MM-DD"));
    }
    let month = parts[1].parse::<u8>().unwrap_or(0);
    let day = parts[2].parse::<u8>().unwrap_or(0);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(format!("'{value}' is invalid; expected YYYY-MM-DD"));
    }
    Ok(value.to_string())
}

fn parse_time(value: &str) -> Result<String, String> {
    let Some((hour, minute)) = value.split_once(':') else {
        return Err(format!("'{value}' is invalid; expected HH:MM"));
    };
    if hour.len() != 2 || minute.len() != 2 {
        return Err(format!("'{value}' is invalid; expected HH:MM"));
    }
    let hour = hour.parse::<u8>().unwrap_or(24);
    let minute = minute.parse::<u8>().unwrap_or(60);
    if hour > 23 || minute > 59 {
        return Err(format!("'{value}' is invalid; expected HH:MM"));
    }
    Ok(value.to_string())
}
