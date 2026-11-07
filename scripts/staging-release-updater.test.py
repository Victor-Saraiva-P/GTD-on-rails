"""Fast offline contract tests for the staging release updater."""
import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch

MODULE = pathlib.Path(__file__).with_name("staging-release-updater.py")
SPEC = importlib.util.spec_from_file_location("staging_release_updater", MODULE)
updater = importlib.util.module_from_spec(SPEC)
import sys
sys.modules[SPEC.name] = updater
SPEC.loader.exec_module(updater)


class StagingReleaseUpdaterTests(unittest.TestCase):
    """Validate guardrails without touching production or the network."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)

    def test_isolated_install_paths(self):
        desktop = updater.target_config("desktop", self.root)
        server = updater.target_config("server", self.root)
        self.assertNotEqual(desktop.install_dir, server.install_dir)
        self.assertNotEqual(desktop.data_dir, server.data_dir)
        self.assertNotIn("gtd-on-rails-client.env", str(server.updater_dir))
        self.assertEqual(server.install_dir.name, "gtd-on-rails-client-staging")
        self.assertEqual(desktop.data_dir.name, "staging-gtd-on-rails")

    def test_production_symlink_is_never_a_staging_installation(self):
        target = updater.target_config("desktop", self.root)
        production_dir = self.root / ".local/share/gtd-on-rails"
        production_dir.mkdir(parents=True)
        target.install_dir.symlink_to(production_dir)
        with self.assertRaises(updater.StagingUpdateError):
            updater.guard_staging_paths(target)

    def test_distinct_staging_paths_pass_isolation_guard(self):
        for name in ("desktop", "server"):
            updater.guard_staging_paths(updater.target_config(name, self.root))

    def test_update_mode_is_unambiguous(self):
        self.assertEqual(updater.update_mode(False, False), "check")
        self.assertEqual(updater.update_mode(True, False), "apply")
        self.assertEqual(updater.update_mode(False, True), "verify")

    def test_local_api_rejects_non_staging_endpoints(self):
        with self.assertRaises(updater.StagingUpdateError):
            updater.read_json_local("/not-staging")

    def test_local_api_requires_active_solanum_tailnet_ip(self):
        with patch.object(updater.subprocess, "check_output", return_value="100.64.1.2\n"):
            with self.assertRaises(updater.StagingUpdateError):
                updater.read_json_local("/v1/backups/environment", "private-token")

    def test_invalid_target_fails_closed(self):
        with self.assertRaises(updater.StagingUpdateError):
            updater.target_config("production", self.root)

    def test_revision_must_be_exact_commit(self):
        sha = "a" * 40
        self.assertEqual(updater.revision_of({"target_commitish": sha}), sha)
        with self.assertRaises(updater.StagingUpdateError):
            updater.revision_of({"target_commitish": "main"})

    def test_asset_url_requires_immutable_candidate(self):
        sha = "b" * 40
        name = "main-update.json"
        url = f"https://github.com/{updater.REPOSITORY}/releases/download/candidate-{sha}/{name}"
        release = {"assets": [{"name": name, "browser_download_url": url}]}
        self.assertEqual(updater.asset_url(release, name, sha), url)
        release["assets"][0]["browser_download_url"] = url.replace("candidate-", "staging-")
        with self.assertRaises(updater.StagingUpdateError):
            updater.asset_url(release, name, sha)

    def test_checksum_rejects_corrupt_payload(self):
        archive = self.root / "package.tar.gz"
        archive.write_bytes(b"archive")
        good = hashlib.sha256(b"archive").hexdigest() + "  package.tar.gz"
        updater.verify_checksum(archive, good)
        with self.assertRaises(updater.StagingUpdateError):
            updater.verify_checksum(archive, "f" * 64 + "  package.tar.gz")
        mismatched_name = good.replace("package.tar.gz", "other.tar.gz")
        with self.assertRaises(updater.StagingUpdateError):
            updater.verify_checksum(archive, mismatched_name)

    def test_package_revision_mismatch_aborts_before_swap(self):
        target = updater.target_config("desktop", self.root)
        package = self.root / "pkg"
        for relative in target.required_files:
            file_path = package / relative
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text("contents")
        (package / "VERSION").write_text("3.6.1")
        (package / "REVISION").write_text("a" * 40)
        updater.validate_package(target, package, "a" * 40, "3.6.1")
        with self.assertRaises(updater.StagingUpdateError):
            updater.validate_package(target, package, "b" * 40, "3.6.1")

    def test_tar_rejects_unrelated_top_level_members(self):
        archive = self.root / "pkg.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            payload = b"bad"
            item = tarfile.TarInfo("wrong/extra")
            item.size = len(payload)
            bundle.addfile(item, io.BytesIO(payload))
        with self.assertRaises(updater.StagingUpdateError):
            updater.extract_package(archive, self.root / "extract", "expected")

    def test_release_plan_does_not_modify_local_install(self):
        target = updater.target_config("desktop", self.root)
        target.install_dir.mkdir(parents=True)
        (target.install_dir / "REVISION").write_text("a" * 40)
        fake = ("b" * 40, {}, {"version": "3.6.1"})
        with patch.object(updater, "candidate_release", return_value=fake):
            updater.run_update(target, False)
        self.assertEqual(updater.installed_revision(target), "a" * 40)

    def test_desktop_update_defers_when_window_is_open(self):
        target = updater.target_config("desktop", self.root)
        target.install_dir.mkdir(parents=True)
        (target.install_dir / "REVISION").write_text("a" * 40)
        fake = ("b" * 40, {}, {"version": "3.6.1"})
        with patch.object(updater, "candidate_release", return_value=fake), \
             patch.object(updater, "active_desktop", return_value=True):
            updater.run_update(target, True)
        self.assertEqual(updater.installed_revision(target), "a" * 40)

    def test_failed_server_health_restores_binaries_and_data(self):
        target = updater.target_config("server", self.root)
        target.install_dir.mkdir(parents=True)
        (target.install_dir / "REVISION").write_text("a" * 40)
        target.data_dir.mkdir(parents=True)
        (target.data_dir / "canonical.db").write_text("original")
        target.updater_dir.mkdir(parents=True)
        package = self.root / "candidate"
        package.mkdir()
        (package / "REVISION").write_text("b" * 40)
        calls = []
        with patch.object(updater, "guard_server"), \
             patch.object(updater, "invoke_service", side_effect=calls.append), \
             patch.object(updater, "staging_healthy", side_effect=[False, True]):
            with self.assertRaises(updater.StagingUpdateError):
                updater.deploy(target, "b" * 40, package)
        self.assertEqual(updater.installed_revision(target), "a" * 40)
        self.assertEqual((target.data_dir / "canonical.db").read_text(), "original")
        self.assertEqual(calls, ["stop", "start", "stop", "start"])

    def test_desktop_candidate_refreshes_isolated_updater(self):
        target = updater.target_config("desktop", self.root)
        target.updater_dir.mkdir(parents=True)
        updater_path = target.updater_dir / "staging-release-updater.py"
        updater_path.write_text("old")
        package = self.root / "candidate"
        package.mkdir()
        (package / "staging-release-updater.py").write_text("new")
        updater.refresh_desktop_updater(target, package)
        self.assertEqual(updater_path.read_text(), "new")
        self.assertEqual((target.updater_dir / "previous-updater.py").read_text(), "old")

    def test_data_snapshot_is_private_and_recoverable(self):
        target = updater.target_config("desktop", self.root)
        target.updater_dir.mkdir(parents=True)
        target.data_dir.mkdir(parents=True)
        (target.data_dir / "gtd.db").write_text("old")
        updater.snapshot_data(target)
        (target.data_dir / "gtd.db").write_text("new")
        updater.restore_previous_data(target)
        self.assertEqual((target.data_dir / "gtd.db").read_text(), "old")


if __name__ == "__main__":
    unittest.main()
