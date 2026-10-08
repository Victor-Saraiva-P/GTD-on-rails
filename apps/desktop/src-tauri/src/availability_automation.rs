use std::fs;
use std::process::Command;

use serde::Serialize;

const ACTIVE_CONNECTION_ARGS: [&str; 8] = [
    "--terse",
    "--escape",
    "yes",
    "--fields",
    "TYPE,UUID,NAME",
    "connection",
    "show",
    "--active",
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityDeviceSignal {
    pub label: String,
    pub device_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityLocationSignal {
    pub id: String,
    pub label: String,
    pub connection_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityEnvironmentSignals {
    pub device: AvailabilityDeviceSignal,
    pub locations: Vec<AvailabilityLocationSignal>,
    pub location_error: Option<String>,
}

trait AvailabilityEnvironmentReader {
    fn hostname(&self) -> Option<String>;
    fn chassis_type(&self) -> Option<String>;
    fn active_connections(&self) -> Result<String, String>;
}

struct LinuxAvailabilityEnvironmentReader;

impl AvailabilityEnvironmentReader for LinuxAvailabilityEnvironmentReader {
    fn hostname(&self) -> Option<String> {
        command_stdout("hostnamectl", &["--static"]).or_else(read_hostname_file)
    }

    fn chassis_type(&self) -> Option<String> {
        read_trimmed_file("/sys/class/dmi/id/chassis_type")
    }

    fn active_connections(&self) -> Result<String, String> {
        active_connections_stdout()
    }
}

/// Detects this Arch desktop's device and physical NetworkManager signals for Current Availability.
///
/// # Example
///
/// ```ignore
/// let signals = availability_environment_signals();
/// ```
#[tauri::command]
pub fn availability_environment_signals() -> AvailabilityEnvironmentSignals {
    detect_environment_signals(&LinuxAvailabilityEnvironmentReader)
}

fn detect_environment_signals(
    reader: &impl AvailabilityEnvironmentReader,
) -> AvailabilityEnvironmentSignals {
    let (locations, location_error) = detected_locations(reader);
    AvailabilityEnvironmentSignals {
        device: detect_device_signal(reader),
        locations,
        location_error,
    }
}

fn detect_device_signal(reader: &impl AvailabilityEnvironmentReader) -> AvailabilityDeviceSignal {
    let label = reader
        .hostname()
        .unwrap_or_else(|| "This device".to_string());
    AvailabilityDeviceSignal {
        label,
        device_type: chassis_device_type(reader.chassis_type().as_deref()).to_string(),
    }
}

fn detected_locations(
    reader: &impl AvailabilityEnvironmentReader,
) -> (Vec<AvailabilityLocationSignal>, Option<String>) {
    let result = reader
        .active_connections()
        .and_then(|output| parse_active_connections(&output));
    match result {
        Ok(locations) => (locations, None),
        Err(error) => (Vec::new(), Some(error)),
    }
}

fn chassis_device_type(chassis_type: Option<&str>) -> &'static str {
    match chassis_type.and_then(|value| value.parse::<u16>().ok()) {
        Some(8 | 9 | 10 | 11 | 14 | 30 | 31 | 32) => "notebook",
        Some(3 | 4 | 5 | 6 | 7 | 15 | 16 | 17 | 23 | 24 | 35 | 36) => "desktop",
        _ => "computer",
    }
}

fn active_connections_stdout() -> Result<String, String> {
    let output = Command::new("nmcli")
        .args(ACTIVE_CONNECTION_ARGS)
        .output()
        .map_err(|error| {
            format!(
                "nmcli command value 'nmcli' is unavailable; expected NetworkManager CLI: {error}"
            )
        })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("nmcli status value '{stderr}' is invalid; expected readable active NetworkManager connections"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_active_connections(output: &str) -> Result<Vec<AvailabilityLocationSignal>, String> {
    output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(parse_active_connection)
        .filter_map(physical_connection_result)
        .collect()
}

fn physical_connection_result(
    result: Result<Option<AvailabilityLocationSignal>, String>,
) -> Option<Result<AvailabilityLocationSignal, String>> {
    match result {
        Ok(Some(signal)) => Some(Ok(signal)),
        Ok(None) => None,
        Err(error) => Some(Err(error)),
    }
}

fn parse_active_connection(line: &str) -> Result<Option<AvailabilityLocationSignal>, String> {
    let fields = connection_fields(line)?;
    let connection_type = fields[0].as_str();
    if !is_physical_location_connection(connection_type) {
        return Ok(None);
    }
    validate_location_identity(line, &fields)?;
    Ok(Some(AvailabilityLocationSignal {
        id: fields[1].clone(),
        label: fields[2].clone(),
        connection_type: connection_type.to_string(),
    }))
}

fn connection_fields(line: &str) -> Result<Vec<String>, String> {
    let fields = split_nmcli_fields(line);
    if fields.len() != 3 {
        return Err(format!(
            "nmcli connection value '{line}' is invalid; expected TYPE,UUID,NAME"
        ));
    }
    Ok(fields)
}

fn validate_location_identity(line: &str, fields: &[String]) -> Result<(), String> {
    if fields[1].trim().is_empty() || fields[2].trim().is_empty() {
        return Err(format!(
            "nmcli connection value '{line}' is invalid; expected non-empty UUID and NAME"
        ));
    }
    Ok(())
}

fn is_physical_location_connection(connection_type: &str) -> bool {
    matches!(
        connection_type,
        "802-11-wireless" | "wifi" | "802-3-ethernet" | "ethernet"
    )
}

fn split_nmcli_fields(line: &str) -> Vec<String> {
    let mut fields = vec![String::new()];
    let mut escaped = false;
    for character in line.chars() {
        if escaped {
            push_last_field(&mut fields, character);
            escaped = false;
            continue;
        }
        escaped = consume_nmcli_character(&mut fields, character);
    }
    if escaped {
        push_last_field(&mut fields, '\\');
    }
    fields
}

fn consume_nmcli_character(fields: &mut Vec<String>, character: char) -> bool {
    match character {
        '\\' => true,
        ':' => {
            fields.push(String::new());
            false
        }
        value => {
            push_last_field(fields, value);
            false
        }
    }
}

fn push_last_field(fields: &mut [String], character: char) {
    fields.last_mut().expect("field exists").push(character);
}

fn read_hostname_file() -> Option<String> {
    read_trimmed_file("/etc/hostname")
}

fn read_trimmed_file(path: &str) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn command_stdout(binary: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(binary).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeAvailabilityEnvironmentReader {
        hostname: Option<String>,
        chassis_type: Option<String>,
        active_connections: Result<String, String>,
    }

    impl AvailabilityEnvironmentReader for FakeAvailabilityEnvironmentReader {
        fn hostname(&self) -> Option<String> {
            self.hostname.clone()
        }

        fn chassis_type(&self) -> Option<String> {
            self.chassis_type.clone()
        }

        fn active_connections(&self) -> Result<String, String> {
            self.active_connections.clone()
        }
    }

    #[test]
    fn detects_device_and_physical_location_through_injected_reader() {
        let reader = fake_reader(Ok("802-11-wireless:home-uuid:Home Wi-Fi\n".to_string()));
        let signals = detect_environment_signals(&reader);
        assert_eq!(signals.device.label, "nitro");
        assert_eq!(signals.device.device_type, "notebook");
        assert_eq!(signals.locations[0].id, "home-uuid");
        assert_eq!(signals.location_error, None);
    }

    #[test]
    fn location_failure_clears_locations_without_losing_device_signal() {
        let reader = fake_reader(Err("nmcli unavailable".to_string()));
        let signals = detect_environment_signals(&reader);
        assert_eq!(signals.device.device_type, "notebook");
        assert!(signals.locations.is_empty());
        assert_eq!(signals.location_error.as_deref(), Some("nmcli unavailable"));
    }

    #[test]
    fn classifies_tower_chassis_as_desktop() {
        assert_eq!(chassis_device_type(Some("3")), "desktop");
        assert_eq!(chassis_device_type(Some("23")), "desktop");
    }

    #[test]
    fn parses_physical_connections_and_ignores_vpn() {
        let output = "802-11-wireless:home-uuid:Casa\\: 5G\nvpn:vpn-uuid:Work VPN\n802-3-ethernet:desk-uuid:Wired connection 1\n";
        let signals = parse_active_connections(output).expect("valid nmcli output");
        assert_eq!(signals.len(), 2);
        assert_eq!(signals[0].label, "Casa: 5G");
        assert_eq!(signals[1].id, "desk-uuid");
    }

    #[test]
    fn rejects_malformed_physical_connection() {
        let error =
            parse_active_connections("wifi:missing-name\n").expect_err("malformed value must fail");
        assert!(error.contains("expected TYPE,UUID,NAME"));
    }

    #[test]
    fn keeps_escaped_backslashes_in_nmcli_fields() {
        assert_eq!(
            split_nmcli_fields(r"wifi:id:Office\\Lab"),
            vec!["wifi", "id", r"Office\Lab"]
        );
    }

    fn fake_reader(
        active_connections: Result<String, String>,
    ) -> FakeAvailabilityEnvironmentReader {
        FakeAvailabilityEnvironmentReader {
            hostname: Some("nitro".to_string()),
            chassis_type: Some("10".to_string()),
            active_connections,
        }
    }
}
