import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";
const stagingExecutable = path.join(repositoryRoot, "apps/desktop/src-tauri/target/release/desktop");

export function stagingResetEnvironment(environment = process.env) {
  return {
    ...environment,
    GTD_DATA_ROOT_DIRECTORY: environment.GTD_STAGING_ROOT_DIRECTORY ?? path.join(repositoryRoot, "staging-gtd-on-rails"),
    GTD_SIDECAR_PROFILES: "staging,sidecar,staging-reset",
    GTD_DATABASE_ENVIRONMENT: "STAGING",
    GTD_STAGING_RESET: "true",
    GTD_SYNC_RCLONE_ENABLED: "true",
    GTD_SYNC_RCLONE_REMOTE: environment.GTD_SYNC_RCLONE_REMOTE ?? "gdrive:staging-gtd-on-rails",
  };
}

export function stagingResetCommand() {
  return ["--filter", "@gtd-on-rails/desktop", "desktop:build:staging-reset"];
}

export function buildStagingReset(environment, runBuild = spawnSync) {
  const result = runBuild(pnpmExecutable, stagingResetCommand(), { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`staging reset build exit value '${result.status ?? "unknown"}' is invalid; expected successful desktop build`);
}

export function launchStagingReset(environment, runProcess = spawn) {
  const child = runProcess(stagingExecutable, [], { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  return child;
}

export function startStagingReset() {
  const environment = stagingResetEnvironment();
  buildStagingReset(environment);
  return launchStagingReset(environment);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startStagingReset();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
