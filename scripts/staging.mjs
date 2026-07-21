import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";
const stagingExecutable = path.join(repositoryRoot, "apps/desktop/src-tauri/target/release/desktop");

/**
 * Returns the repository-local staging data root.
 *
 * @example stagingRootDirectory({ GTD_STAGING_ROOT_DIRECTORY: "/tmp/staging" })
 */
export function stagingRootDirectory(environment = process.env) {
  return environment.GTD_STAGING_ROOT_DIRECTORY ?? path.join(repositoryRoot, "staging-gtd-on-rails");
}

/**
 * Builds the isolated environment passed to the staging build and executable.
 *
 * @example stagingEnvironment({ GTD_STAGING_ROOT_DIRECTORY: "/tmp/staging" })
 */
export function stagingEnvironment(environment = process.env) {
  return {
    ...environment,
    GTD_DATA_ROOT_DIRECTORY: stagingRootDirectory(environment),
    GTD_SIDECAR_PROFILES: "staging,sidecar",
    GTD_DATABASE_ENVIRONMENT: "STAGING",
    GTD_SYNC_RCLONE_ENABLED: "true",
    GTD_SYNC_RCLONE_REMOTE: environment.GTD_SYNC_RCLONE_REMOTE ?? "gdrive:staging-gtd-on-rails",
  };
}

/**
 * Builds the staging desktop command.
 *
 * @example stagingCommand()
 */
export function stagingCommand() {
  return ["--filter", "@gtd-on-rails/desktop", "desktop:build:staging"];
}

export function buildStaging(environment, runBuild = spawnSync) {
  const result = runBuild(pnpmExecutable, stagingCommand(), { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`staging build exit value '${result.status ?? "unknown"}' is invalid; expected successful desktop build`);
}

export function launchStaging(environment, runProcess = spawn) {
  const child = runProcess(stagingExecutable, [], { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  return child;
}

/**
 * Builds and launches the persistent staging desktop.
 *
 * @example startStaging()
 */
export function startStaging() {
  const environment = stagingEnvironment();
  buildStaging(environment);
  return launchStaging(environment);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startStaging();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
