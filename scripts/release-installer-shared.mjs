import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const defaultLatestReleaseUrl =
  "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/latest";

const systemCommands = Object.freeze({
  bash: "/usr/bin/bash",
  curl: "/usr/bin/curl",
  sha256sum: "/usr/bin/sha256sum",
  tar: "/usr/bin/tar"
});

/**
 * Normalizes a git release tag name into a semantic version number.
 *
 * <p>Example: {@code normalizeReleaseVersion("v3.0.1")} returns {@code "3.0.1"}.</p>
 */
export function normalizeReleaseVersion(tagName) {
  const version = tagName.startsWith("app-v")
    ? tagName.slice(5)
    : tagName.startsWith("v") ? tagName.slice(1) : tagName;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`release tag '${tagName}' is invalid; expected semantic version`);
  }
  return version;
}

/**
 * Resolves the GitHub API endpoint for a release by tag, URL, or defaults to latest.
 *
 * <p>Example: {@code resolveReleaseEndpoint("v3.0.1")}.</p>
 */
export function resolveReleaseEndpoint(tagOrUrl, fallbackUrl = defaultLatestReleaseUrl) {
  if (!tagOrUrl) return fallbackUrl;
  if (tagOrUrl.startsWith("https://") || tagOrUrl.startsWith("http://")) {
    return tagOrUrl;
  }
  const tag = tagOrUrl.startsWith("v") || tagOrUrl.startsWith("app-v")
    ? tagOrUrl
    : `v${tagOrUrl}`;
  return `https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/tags/${tag}`;
}

/**
 * Extracts a release tag argument from CLI flags or positional parameters.
 *
 * <p>Example: {@code parseReleaseTagArgument(["--tag=v3.0.1"])} returns {@code "v3.0.1"}.</p>
 */
export function parseReleaseTagArgument(argv = process.argv.slice(2)) {
  for (let index = 0; index < argv.length; index += 1) {
    const candidate = argv[index];
    if (candidate.startsWith("--tag=")) {
      return candidate.slice(6);
    }
    if (candidate === "--tag" && index + 1 < argv.length) {
      return argv[index + 1];
    }
    if (!candidate.startsWith("-")) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Finds and returns the browser download URL for an asset in a GitHub release.
 *
 * <p>Example: {@code requireReleaseAsset(release, "GTD.on.Rails_3.0.1_linux-x86_64.tar.gz")}.</p>
 */
export function requireReleaseAsset(release, name, assetType = "asset") {
  const asset = (release.assets ?? []).find((candidate) => candidate.name === name);
  if (!asset?.browser_download_url) {
    throw new Error(`release is missing required ${assetType} '${name}'`);
  }
  return asset.browser_download_url;
}

/**
 * Resolves the asset download URLs and metadata for the standalone sync client.
 *
 * <p>Example: {@code clientReleaseAssets(release)}.</p>
 */
export function clientReleaseAssets(release) {
  const version = normalizeReleaseVersion(release.tag_name ?? "");
  const archiveName = `GTD.on.Rails.Client_${version}_linux-x86_64.tar.gz`;
  const checksumName = `${archiveName}.sha256`;
  return {
    version,
    archiveName,
    checksumName,
    archiveUrl: requireReleaseAsset(release, archiveName, "client asset"),
    checksumUrl: requireReleaseAsset(release, checksumName, "client asset")
  };
}

/**
 * Resolves the asset download URLs and metadata for the desktop application.
 *
 * <p>Example: {@code desktopReleaseAssets(release)}.</p>
 */
export function desktopReleaseAssets(release) {
  const version = normalizeReleaseVersion(release.tag_name ?? "");
  const archiveName = `GTD.on.Rails_${version}_linux-x86_64.tar.gz`;
  const checksumName = `${archiveName}.sha256`;
  return {
    version,
    archiveName,
    checksumName,
    archiveUrl: requireReleaseAsset(release, archiveName, "desktop asset"),
    checksumUrl: requireReleaseAsset(release, checksumName, "desktop asset")
  };
}

/**
 * Executes a system command synchronously, throwing an error if it exits non-zero.
 *
 * <p>Example: {@code runCommand("tar", ["-xzf", "file.tar.gz"])}.</p>
 */
export function runCommand(command, args, options = {}) {
  const executable = systemCommands[command];
  if (!executable) throw new Error(`unsupported installer command '${command}'`);
  const result = spawnSync(executable, args, { stdio: "inherit", ...options });
  if (result.status === 0) return;
  throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}`);
}

/**
 * Fetches JSON payload from a release URL with required User-Agent headers.
 *
 * <p>Example: {@code fetchReleaseJson("https://api.github.com/repos/.../releases/latest")}.</p>
 */
export function fetchReleaseJson(url) {
  const result = spawnSync(
    systemCommands.curl,
    ["-fsSL", "-g", "-H", "User-Agent: GTD-on-Rails", url],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `failed to fetch release from ${url}`);
  }
  return JSON.parse(result.stdout);
}

/**
 * Downloads archive and checksum files, verifies integrity, and extracts archive.
 *
 * <p>Example: {@code downloadAndExtractReleaseArchive(assets, tempDir)}.</p>
 */
export function downloadAndExtractReleaseArchive(assets, tempDir) {
  const archivePath = path.join(tempDir, assets.archiveName);
  const checksumPath = path.join(tempDir, assets.checksumName);
  runCommand("curl", ["-fL", assets.archiveUrl, "-o", archivePath]);
  runCommand("curl", ["-fL", assets.checksumUrl, "-o", checksumPath]);
  runCommand("sha256sum", ["-c", assets.checksumName], { cwd: tempDir });
  runCommand("tar", ["-xzf", archivePath, "-C", tempDir]);
}

/**
 * Verifies that the package VERSION file matches the expected release version if present.
 *
 * <p>Example: {@code await verifyPackageVersionIfPresent(packageDir, "3.0.1")}.</p>
 */
export async function verifyPackageVersionIfPresent(packageDir, expectedVersion) {
  const versionFile = path.join(packageDir, "VERSION");
  try {
    const packagedVersion = (await readFile(versionFile, "utf8")).trim();
    if (packagedVersion !== expectedVersion) {
      throw new Error(
        `package version '${packagedVersion}' does not match expected release '${expectedVersion}'`
      );
    }
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}

/**
 * Executes the package installation shell script with the given environment.
 *
 * <p>Example: {@code executePackageInstaller(packageDir, process.env)}.</p>
 */
export function executePackageInstaller(packageDir, environment = process.env) {
  runCommand("bash", [path.join(packageDir, "install.sh")], { env: environment });
}

/**
 * Installs the desktop release for the specified tag or latest published release.
 *
 * <p>Example: {@code await installDesktopRelease("v3.0.1", process.env)}.</p>
 */
export async function installDesktopRelease(tagOrUrl, environment = process.env) {
  const releaseUrl = resolveReleaseEndpoint(
    tagOrUrl ?? environment.GTD_RELEASE_TAG ?? environment.GTD_DESKTOP_RELEASE_URL
  );
  const release = fetchReleaseJson(releaseUrl);
  const assets = desktopReleaseAssets(release);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gtd-desktop-install-"));

  try {
    downloadAndExtractReleaseArchive(assets, tempDir);
    const packageDir = path.join(tempDir, `GTD.on.Rails_${assets.version}_linux-x86_64`);
    await verifyPackageVersionIfPresent(packageDir, assets.version);
    executePackageInstaller(packageDir, environment);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Installs the sync client release for the specified tag or latest published release.
 *
 * <p>Example: {@code await installClientRelease("v3.0.1", process.env)}.</p>
 */
export async function installClientRelease(tagOrUrl, environment = process.env) {
  const releaseUrl = resolveReleaseEndpoint(
    tagOrUrl ?? environment.GTD_RELEASE_TAG ?? environment.GTD_CLIENT_RELEASE_URL
  );
  const release = fetchReleaseJson(releaseUrl);
  const assets = clientReleaseAssets(release);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gtd-client-install-"));

  try {
    downloadAndExtractReleaseArchive(assets, tempDir);
    const packageDir = path.join(tempDir, `GTD.on.Rails.Client_${assets.version}_linux-x86_64`);
    await verifyPackageVersionIfPresent(packageDir, assets.version);
    executePackageInstaller(packageDir, environment);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
