import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const versionPattern = /^\d+\.\d+\.\d+$/;

/**
 * Validates the single manually edited app version.
 *
 * @example validateAppVersion("1.2.3\n")
 */
export function validateAppVersion(rawVersion) {
  const version = rawVersion.trim();
  if (!versionPattern.test(version)) {
    throw new Error(`VERSION value '${rawVersion}' is invalid; expected semantic version like 1.2.3`);
  }
  return version;
}

/**
 * Reads the root VERSION file for sync/check commands.
 *
 * @example await readAppVersion("/repo")
 */
export async function readAppVersion(repoRoot) {
  const rawVersion = await readFile(path.join(repoRoot, "VERSION"), "utf8");
  return validateAppVersion(rawVersion);
}

/**
 * Synchronizes or checks every app-version manifest target.
 *
 * @example await syncAppVersion("/repo", "check")
 */
export async function syncAppVersion(repoRoot, mode) {
  const version = await readAppVersion(repoRoot);
  const changes = await collectVersionChanges(repoRoot, version);
  if (mode === "check") {
    assertNoVersionDrift(changes);
    return changes;
  }
  await writeVersionChanges(changes);
  return changes;
}

async function collectVersionChanges(repoRoot, version) {
  const targets = versionTargets(version);
  const changes = [];
  for (const target of targets) {
    const filePath = path.join(repoRoot, target.relativePath);
    const currentContent = await readFile(filePath, "utf8");
    const nextContent = target.update(currentContent);
    changes.push({ ...target, filePath, currentContent, nextContent });
  }
  return changes;
}

function versionTargets(version) {
  return [
    desktopPackageTarget(version),
    jsonPackageTarget("apps/api/package.json", version),
    replaceTarget("apps/api/build.gradle", /^version = ['"].*['"]$/m, `version = '${version}'`),
    replaceTarget("apps/desktop/src-tauri/tauri.conf.json", /("version":\s*)"[^"]+"/, `$1"${version}"`),
    replaceTarget("apps/desktop/src-tauri/Cargo.toml", /^version = ".*"$/m, `version = "${version}"`),
    replaceTarget("apps/desktop/src-tauri/Cargo.lock", /(name = "desktop"\nversion = )"[^"]+"/, `$1"${version}"`),
    replaceTarget("apps/desktop/src/config/appMetadata.ts", /version: ".*"/, `version: "${version}"`),
  ];
}

function desktopPackageTarget(version) {
  return {
    relativePath: "apps/desktop/package.json",
    update: (content) => updateDesktopPackageJson(content, version),
  };
}

function updateDesktopPackageJson(content, version) {
  const parsed = JSON.parse(content);
  const buildSidecarScript = parsed.scripts["build:sidecar"];
  parsed.version = version;
  parsed.scripts["build:sidecar"] = replaceRequiredPattern(
    "apps/desktop/package.json scripts.build:sidecar",
    buildSidecarScript,
    /api-\d+\.\d+\.\d+\.jar/,
    `api-${version}.jar`
  );
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function jsonPackageTarget(relativePath, version) {
  return {
    relativePath,
    update: (content) => {
      const parsed = JSON.parse(content);
      parsed.version = version;
      return `${JSON.stringify(parsed, null, 2)}\n`;
    },
  };
}

function replaceTarget(relativePath, pattern, replacement) {
  return {
    relativePath,
    update: (content) => replaceRequiredPattern(relativePath, content, pattern, replacement),
  };
}

function replaceRequiredPattern(relativePath, content, pattern, replacement) {
  if (!pattern.test(content)) {
    const inspectedContent = String(content).slice(0, 120);
    throw new Error(`${relativePath} content  is invalid; expected pattern ${pattern}`);
  }
  return content.replace(pattern, replacement);
}

function assertNoVersionDrift(changes) {
  const driftedPaths = changes.filter(isChanged).map((change) => change.relativePath);
  if (driftedPaths.length === 0) {
    return;
  }
  throw new Error(`version targets are out of sync; expected updates in ${driftedPaths.join(", ")}`);
}

async function writeVersionChanges(changes) {
  for (const change of changes.filter(isChanged)) {
    await writeFile(change.filePath, change.nextContent);
  }
}

function isChanged(change) {
  return change.currentContent !== change.nextContent;
}

function parseMode(rawMode) {
  const mode = rawMode ?? "sync";
  if (mode !== "sync" && mode !== "check") {
    throw new Error(`mode value '${mode}' is invalid; expected sync or check`);
  }
  return mode;
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const mode = parseMode(process.argv[2]);
  const changes = await syncAppVersion(repoRoot, mode);
  const changedPaths = changes.filter(isChanged).map((change) => change.relativePath);
  const message = changedPaths.length ? changedPaths.join(", ") : "all version targets";
  console.log(mode === "check" ? `Version check passed for ${message}.` : `Version sync updated ${message}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
