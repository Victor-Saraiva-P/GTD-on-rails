import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const defaultReleaseUrl =
  "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/latest";

export function normalizeReleaseVersion(tagName) {
  const version = tagName.startsWith("app-v")
    ? tagName.slice(5)
    : tagName.startsWith("v") ? tagName.slice(1) : tagName;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`release tag '${tagName}' is invalid; expected semantic version`);
  }
  return version;
}

export function clientReleaseAssets(release) {
  const version = normalizeReleaseVersion(release.tag_name ?? "");
  const archiveName = `GTD.on.Rails.Client_${version}_linux-x86_64.tar.gz`;
  const checksumName = `${archiveName}.sha256`;
  return {
    version,
    archiveName,
    checksumName,
    archiveUrl: requireAsset(release, archiveName),
    checksumUrl: requireAsset(release, checksumName)
  };
}

function requireAsset(release, name) {
  const asset = (release.assets ?? []).find((candidate) => candidate.name === name);
  if (!asset?.browser_download_url) {
    throw new Error(`latest release is missing required client asset '${name}'`);
  }
  return asset.browser_download_url;
}

const systemCommands = Object.freeze({
  bash: "/usr/bin/bash",
  curl: "/usr/bin/curl",
  sha256sum: "/usr/bin/sha256sum",
  tar: "/usr/bin/tar"
});

function run(command, args, options = {}) {
  const executable = systemCommands[command];
  if (!executable) throw new Error(`unsupported installer command '${command}'`);
  const result = spawnSync(executable, args, { stdio: "inherit", ...options });
  if (result.status === 0) return;
  throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}`);
}

function fetchRelease(url) {
  const result = spawnSync(systemCommands.curl, ["-fsSL", "-H", "User-Agent: GTD-on-Rails", url], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "failed to fetch latest GTD on Rails release");
  }
  return JSON.parse(result.stdout);
}

export async function installLatestClient(environment = process.env) {
  const release = fetchRelease(environment.GTD_CLIENT_RELEASE_URL ?? defaultReleaseUrl);
  const assets = clientReleaseAssets(release);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gtd-client-install-"));

  try {
    const archivePath = path.join(tempDir, assets.archiveName);
    const checksumPath = path.join(tempDir, assets.checksumName);
    run("curl", ["-fL", assets.archiveUrl, "-o", archivePath]);
    run("curl", ["-fL", assets.checksumUrl, "-o", checksumPath]);
    run("sha256sum", ["-c", assets.checksumName], { cwd: tempDir });
    run("tar", ["-xzf", assets.archiveName, "-C", tempDir]);

    const packageDir = path.join(
      tempDir,
      `GTD.on.Rails.Client_${assets.version}_linux-x86_64`
    );
    const packagedVersion = (await readFile(path.join(packageDir, "VERSION"), "utf8")).trim();
    if (packagedVersion !== assets.version) {
      throw new Error(
        `client package version '${packagedVersion}' does not match release '${assets.version}'`
      );
    }

    run("bash", [path.join(packageDir, "install.sh")], { env: environment });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installLatestClient().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
