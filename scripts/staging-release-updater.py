#!/usr/bin/env python3
"""Promote CI-verified staging artifacts to isolated local installations.

Examples:
  python3 staging-release-updater.py --target server --apply
  python3 staging-release-updater.py --target desktop --rollback
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPOSITORY = "Victor-Saraiva-P/GTD-on-rails"
LATEST_API = f"https://api.github.com/repos/{REPOSITORY}/releases/tags/staging-latest"
SHA_PATTERN = re.compile(r"[0-9a-f]{40}")
VERSION_PATTERN = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
HOME = Path.home()


class StagingUpdateError(RuntimeError):
    """A fail-closed staging update preflight or deployment error."""


@dataclass(frozen=True)
class InstallTarget:
    name: str
    package_prefix: str
    install_dir: Path
    data_dir: Path
    updater_dir: Path
    required_files: tuple[str, ...]

    @property
    def is_server(self) -> bool:
        return self.name == "server"


def target_config(name: str, home: Path = HOME) -> InstallTarget:
    """Return only explicitly isolated staging paths for a known deployment target."""
    share = home / ".local/share"
    if name == "server":
        return InstallTarget(
            name, "GTD.on.Rails.Client_", share / "gtd-on-rails-client-staging",
            share / "gtd-on-rails-sync-server-staging",
            share / "gtd-on-rails-client-staging-updater",
            ("gtd-client", "runtime/bin/gtd-client-runtime", "REVISION", "VERSION"),
        )
    if name == "desktop":
        return InstallTarget(
            name, "GTD.on.Rails.Staging_", share / "gtd-on-rails-staging",
            home / "Documents/staging-gtd-on-rails",
            share / "gtd-on-rails-staging-updater",
            ("gtd-on-rails", "gtd-api", "binaries/gtd-api.jar",
             "gtd-on-rails-launcher", "icon.png", "REVISION", "VERSION"),
        )
    raise StagingUpdateError(f"Unknown target {name!r}; expected desktop or server")


def download_bytes(url: str) -> bytes:
    """Fetch one release API/manifest/checksum payload over HTTPS."""
    if not url.startswith("https://"):
        raise StagingUpdateError(f"Non-HTTPS release URL {url!r}")
    req = urllib.request.Request(url, headers={"User-Agent": "GTD-on-Rails-Staging-Updater"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read(1024 * 1024)


def read_json(url: str) -> dict[str, Any]:
    """Parse one small release API document."""
    parsed = json.loads(download_bytes(url).decode("utf-8"))
    if not isinstance(parsed, dict):
        raise StagingUpdateError(f"Invalid release JSON at {url}; expected object")
    return parsed


def revision_of(release: dict[str, Any]) -> str:
    """Reject unexpected GitHub targets rather than trusting mutable tag metadata."""
    revision = str(release.get("target_commitish", "")).lower()
    if not SHA_PATTERN.fullmatch(revision):
        raise StagingUpdateError(f"Invalid release target {revision!r}; expected a full Git SHA")
    return revision


def candidate_release() -> tuple[str, dict[str, Any], dict[str, Any]]:
    """Follow the rolling staging pointer to an immutable CI candidate release."""
    revision = revision_of(read_json(LATEST_API))
    tag = f"candidate-{revision}"
    url = f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{tag}"
    candidate = read_json(url)
    if candidate.get("tag_name") != tag or revision_of(candidate) != revision:
        raise StagingUpdateError(f"Candidate {tag!r} does not match the rolling staging commit")
    manifest = read_json(asset_url(candidate, "main-update.json", revision))
    if manifest.get("revision") != revision or not VERSION_PATTERN.fullmatch(str(manifest.get("version", ""))):
        raise StagingUpdateError(f"Invalid candidate manifest for revision {revision}")
    return revision, candidate, manifest


def asset_url(release: dict[str, Any], name: str, revision: str) -> str:
    """Require an exact asset name and GitHub repository download URL."""
    matching = [asset for asset in release.get("assets", []) if asset.get("name") == name]
    if len(matching) != 1:
        raise StagingUpdateError(f"Expected one CI asset {name!r}, got {len(matching)}")
    url = str(matching[0].get("browser_download_url", ""))
    prefix = f"https://github.com/{REPOSITORY}/releases/download/candidate-{revision}/"
    if url != prefix + name:
        raise StagingUpdateError(f"Unexpected asset location {url!r}; expected candidate URL")
    return url


def download_archive(url: str, path: Path) -> None:
    """Stream a large CI archive into the staging updater's private cache."""
    req = urllib.request.Request(url, headers={"User-Agent": "GTD-on-Rails-Staging-Updater"})
    with urllib.request.urlopen(req, timeout=90) as response, path.open("wb") as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)


def verify_checksum(archive: Path, checksum_text: str) -> None:
    """Verify GitHub's staged SHA-256 file and the archive bytes."""
    checksum_line = checksum_text.strip().splitlines()
    if len(checksum_line) != 1:
        raise StagingUpdateError("Expected a single SHA-256 checksum line")
    expected = re.fullmatch(r"([0-9a-f]{64})\s+\*?(.+)", checksum_line[0])
    if not expected or expected.group(2) != archive.name:
        raise StagingUpdateError(f"Invalid checksum metadata for {archive.name!r}")
    with archive.open("rb") as payload:
        digest = hashlib.file_digest(payload, "sha256").hexdigest()
    if digest != expected.group(1):
        raise StagingUpdateError(f"SHA-256 mismatch for candidate archive {archive.name!r}")


def extract_package(archive: Path, destination: Path, package_name: str) -> Path:
    """Reject unsafe tar entries before extracting a single package directory."""
    with tarfile.open(archive, mode="r:gz") as bundle:
        members = bundle.getmembers()
        prefix = package_name + "/"
        for member in members:
            if not (member.name == package_name or member.name.startswith(prefix)):
                raise StagingUpdateError(f"Unexpected tar member {member.name!r}")
        bundle.extractall(destination, filter="data")
    return destination / package_name


def prepare_candidate(target: InstallTarget, revision: str, release: dict[str, Any],
                      manifest: dict[str, Any], scratch: Path) -> Path:
    """Download and validate the exact native package before stopping anything."""
    version = str(manifest["version"])
    package_name = f"{target.package_prefix}{version}_linux-x86_64"
    archive_name = package_name + ".tar.gz"
    archive = scratch / archive_name
    download_archive(asset_url(release, archive_name, revision), archive)
    checksum_name = archive_name + ".sha256"
    checksum = download_bytes(asset_url(release, checksum_name, revision)).decode("utf-8")
    verify_checksum(archive, checksum)
    package = extract_package(archive, scratch, package_name)
    validate_package(target, package, revision, version)
    return package


def validate_package(target: InstallTarget, package: Path, revision: str, version: str) -> None:
    """Validate expected files and revision before accepting staged code."""
    if any(not (package / relative).is_file() for relative in target.required_files):
        raise StagingUpdateError(f"Incomplete {target.name} staging package at {package}")
    if (package / "REVISION").read_text().strip() != revision:
        raise StagingUpdateError(f"Revision mismatch in extracted {target.name} package")
    if (package / "VERSION").read_text().strip() != version:
        raise StagingUpdateError(f"Version mismatch in extracted {target.name} package")


def installed_revision(target: InstallTarget) -> str:
    """Return the current staging revision without inspecting production."""
    revision_file = target.install_dir / "REVISION"
    return revision_file.read_text().strip() if revision_file.is_file() else "missing"


def guard_staging_paths(target: InstallTarget) -> None:
    """Reject symlink redirection or any overlap with production persistence."""
    for path in (target.install_dir, target.data_dir, target.updater_dir):
        if path.is_symlink():
            raise StagingUpdateError(f"Unsafe staging symlink at {path}")
    share = target.install_dir.parent
    production_install = share / ("gtd-on-rails-client" if target.is_server else "gtd-on-rails")
    production_data = (share / "gtd-on-rails-sync-server" if target.is_server
                       else target.data_dir.parent / "gtd-on-rails")
    for staging_path in (target.install_dir, target.data_dir, target.updater_dir):
        actual = staging_path.resolve()
        for production_path in (production_install.resolve(), production_data.resolve()):
            if (actual == production_path or actual in production_path.parents
                    or production_path in actual.parents):
                raise StagingUpdateError(f"Staging path {actual} overlaps production")


def read_private_environment(env_path: Path) -> dict[str, str]:
    """Read a mode-0600 environment file without printing its secrets."""
    if env_path.is_symlink() or not env_path.is_file() or env_path.stat().st_mode & 0o077:
        raise StagingUpdateError(f"Unsafe private environment file {env_path}")
    settings = {}
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            settings[key] = value
    return settings


def server_settings(home: Path = HOME) -> dict[str, str]:
    """Read only the stage-owned server configuration."""
    return read_private_environment(home / ".config/gtd-on-rails-client-staging.env")


def guard_server(target: InstallTarget) -> None:
    """Refuse to manage an endpoint unless it has the staging isolation flags."""
    settings = server_settings(target.install_dir.parents[2])
    expected = {"GTD_SYNC_SERVER_DEPLOYMENT_ENVIRONMENT": "staging",
                "GTD_SYNC_SERVER_PORT": "9476",
                "GTD_GOOGLE_CALENDAR_PROJECTION_ENABLED": "false",
                "GTD_SYNC_SERVER_GOOGLE_CALLBACK_LISTENER_ENABLED": "false",
                "GTD_SYNC_SERVER_RCLONE_ENABLED": "false",
                "GTD_CLIENT_AUTO_UPDATE_ENABLED": "false",
                "GTD_SYNC_SERVER_DATA_ROOT": str(target.data_dir)}
    for key, value in expected.items():
        if settings.get(key) != value:
            raise StagingUpdateError(f"Unsafe Solanum staging setting {key}; expected {value!r}")
    prod = read_private_environment(target.install_dir.parents[2] / ".config/gtd-on-rails-client.env")
    if (not settings.get("GTD_SYNC_SERVER_AUTH_TOKEN") or
            settings["GTD_SYNC_SERVER_AUTH_TOKEN"] == prod.get("GTD_SYNC_SERVER_AUTH_TOKEN")):
        raise StagingUpdateError("Staging bearer token must differ from production")
    subprocess.run(["systemctl", "--user", "is-active", "--quiet",
                    "gtd-on-rails-client.service"], check=True)


def active_desktop(target: InstallTarget) -> bool:
    """Detect existing staging GUI processes without matching production."""
    binary = str(target.install_dir / "gtd-on-rails")
    for process in Path("/proc").iterdir():
        if not process.name.isdecimal():
            continue
        try:
            executable = os.readlink(process / "exe")
        except (OSError, PermissionError):
            continue
        if executable == binary or executable == binary + " (deleted)":
            return True
        try:
            arguments = (process / "cmdline").read_bytes()
        except (OSError, PermissionError):
            continue
        if str(target.install_dir / "binaries/gtd-api.jar").encode() in arguments:
            return True
    return False


def check_running(target: InstallTarget) -> None:
    """Never swap desktop files while a live staging GUI owns its sidecar."""
    if not target.is_server and active_desktop(target):
        raise StagingUpdateError("Staging desktop is open; update deferred until it closes")


def invoke_service(action: str) -> None:
    """Operate solely on the dedicated staging sync server systemd unit."""
    subprocess.run(["systemctl", "--user", action,
                    "gtd-on-rails-client-staging.service"], check=True)


def staging_healthy(revision: str | None, retries: int = 35) -> bool:
    """Verify the running staging API's health and guarded identity."""
    settings = server_settings()
    url = f"http://{settings['GTD_SYNC_SERVER_BIND_ADDRESS']}:9476"
    for _ in range(retries):
        try:
            result = read_json_local(url + "/health")
            identity = read_json_local(url + "/v1/backups/environment",
                                       settings["GTD_SYNC_SERVER_AUTH_TOKEN"])
            if (result.get("status") == "UP" and identity.get("environment") == "staging"
                    and (revision is None or result.get("revision") == revision)):
                return True
        except (OSError, ValueError, KeyError, TimeoutError):
            pass
        time.sleep(1)
    return False


def read_json_local(url: str, token: str | None = None) -> dict[str, Any]:
    """Read an authenticated stage-only API response through the private interface."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=3) as response:
        return json.load(response)


def snapshot_data(target: InstallTarget) -> None:
    """Keep last consistent pre-upgrade staging data for rollback."""
    snapshot = target.updater_dir / "previous-data"
    staging = target.updater_dir / "next-data"
    if staging.exists():
        shutil.rmtree(staging)
    if not target.data_dir.is_dir():
        raise StagingUpdateError(f"Missing staging data directory {target.data_dir}")
    shutil.copytree(target.data_dir, staging, symlinks=False)
    if snapshot.exists():
        shutil.rmtree(snapshot)
    os.replace(staging, snapshot)


def swap_binary(target: InstallTarget, staged: Path) -> None:
    """Atomically swap only staging install directory within the same filesystem."""
    previous = target.updater_dir / "previous-install"
    if previous.exists():
        shutil.rmtree(previous)
    os.replace(target.install_dir, previous)
    os.replace(staged, target.install_dir)


def rollback(target: InstallTarget) -> None:
    """Restore the previous staging executable and data snapshot."""
    previous = target.updater_dir / "previous-install"
    if not previous.is_dir():
        raise StagingUpdateError(f"No rollback installation exists at {previous}")
    if not (target.updater_dir / "previous-data").is_dir():
        raise StagingUpdateError("Cannot roll back without a staging data recovery snapshot")
    if target.is_server:
        invoke_service("stop")
    broken = target.updater_dir / "replaced-install"
    if broken.exists():
        shutil.rmtree(broken)
    if target.install_dir.exists():
        os.replace(target.install_dir, broken)
    os.replace(previous, target.install_dir)
    restore_previous_data(target)
    previous_updater = target.updater_dir / "previous-updater.py"
    if not target.is_server and previous_updater.is_file():
        os.replace(previous_updater, target.updater_dir / "staging-release-updater.py")
    if target.is_server:
        invoke_service("start")
        if not staging_healthy(installed_revision(target)):
            raise StagingUpdateError("Rollback did not restore healthy staging service")


def restore_previous_data(target: InstallTarget) -> None:
    """Replace staging-only canonical data with its pre-upgrade backup."""
    snapshot = target.updater_dir / "previous-data"
    if not snapshot.is_dir():
        raise StagingUpdateError("Pre-upgrade staging data snapshot was not found")
    broken = target.updater_dir / "replaced-data"
    if broken.exists():
        shutil.rmtree(broken)
    if target.data_dir.exists():
        os.replace(target.data_dir, broken)
    os.replace(snapshot, target.data_dir)


def refresh_desktop_updater(target: InstallTarget, package: Path) -> None:
    """Replace the staging-only updater when a newer signed package includes it."""
    if target.is_server:
        return
    source = package / "staging-release-updater.py"
    if not source.is_file():
        return  # First published staging package predates updater distribution.
    installed = target.updater_dir / "staging-release-updater.py"
    previous = target.updater_dir / "previous-updater.py"
    temporary = target.updater_dir / "next-updater.py"
    if installed.is_file():
        shutil.copy2(installed, previous)
    shutil.copy2(source, temporary)
    os.chmod(temporary, 0o600)
    os.replace(temporary, installed)


def deploy(target: InstallTarget, revision: str, package: Path) -> None:
    """Stage new binaries, preserve data, and rollback a failed server restart."""
    check_running(target)
    if target.is_server:
        guard_server(target)
        invoke_service("stop")
    swap_attempted = False
    try:
        snapshot_data(target)
        destination = target.updater_dir / "next-install"
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(package, destination, symlinks=True)
        swap_attempted = True
        swap_binary(target, destination)
        if target.is_server:
            invoke_service("start")
            if not staging_healthy(revision):
                raise StagingUpdateError(f"Staging sync server failed health verification at {revision}")
        refresh_desktop_updater(target, package)
    except Exception:
        if swap_attempted and (target.updater_dir / "previous-install").exists():
            rollback(target)
        elif target.is_server:
            invoke_service("start")
        raise


def run_update(target: InstallTarget, apply: bool, verify: bool = False) -> None:
    """Plan or apply a pinned candidate revision from the staging-only channel."""
    revision, release, manifest = candidate_release()
    current = installed_revision(target)
    print(json.dumps({"target": target.name, "current": current, "candidate": revision,
                      "updateAvailable": current != revision,
                      "mode": "verify" if verify else ("apply" if apply else "check")}))
    if not verify and (current == revision or not apply):
        return
    if current == "missing":
        raise StagingUpdateError("Staging runtime has not been installed yet")
    if not target.is_server and active_desktop(target):
        print(json.dumps({"target": target.name, "deferred": "staging-desktop-running"}))
        return
    with tempfile.TemporaryDirectory(prefix="candidate-", dir=target.updater_dir) as temporary:
        package = prepare_candidate(target, revision, release, manifest, Path(temporary))
        if verify:
            print(json.dumps({"target": target.name, "verified": revision}))
            return
        deploy(target, revision, package)
    print(json.dumps({"target": target.name, "installed": installed_revision(target)}))


def main(argv: list[str] | None = None) -> int:
    """Check, deploy or roll back an isolated staging install from CLI flags."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=("desktop", "server"), required=True)
    operation = parser.add_mutually_exclusive_group()
    operation.add_argument("--apply", action="store_true")
    operation.add_argument("--verify", action="store_true")
    operation.add_argument("--rollback", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args(argv)
    target = target_config(args.target)
    guard_staging_paths(target)
    target.updater_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (target.updater_dir / "update.lock").open("a+b") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Staging update already running; skipped")
            return 0
        if args.rollback:
            if args.confirm != "ROLLBACK_STAGING":
                raise StagingUpdateError("Manual rollback requires --confirm ROLLBACK_STAGING")
            check_running(target)
            rollback(target)
            print(json.dumps({"target": target.name, "rolledBackTo": installed_revision(target)}))
        else:
            run_update(target, args.apply, args.verify)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (StagingUpdateError, OSError, subprocess.CalledProcessError) as error:
        print(f"Staging updater: {error}", file=sys.stderr)
        raise SystemExit(1)
