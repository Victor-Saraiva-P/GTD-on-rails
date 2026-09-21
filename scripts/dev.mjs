import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";
const fixedExecutablePath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin";
const children = [];

export function developmentEnvironment(baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    PATH: fixedExecutablePath,
    GTD_DATA_ROOT_DIRECTORY: developmentRootDirectory(baseEnvironment),
    GTD_SYNC_SERVER_ENABLED: baseEnvironment.GTD_SYNC_SERVER_ENABLED ?? "true",
    GTD_SYNC_SERVER_BASE_URL: baseEnvironment.GTD_SYNC_SERVER_BASE_URL ?? "http://127.0.0.1:9473",
    GTD_SYNC_SERVER_DATA_ROOT: syncServerDevelopmentRootDirectory(baseEnvironment),
    GTD_SYNC_SERVER_BIND_ADDRESS: baseEnvironment.GTD_SYNC_SERVER_BIND_ADDRESS ?? "127.0.0.1"
  };
}

export function developmentRootDirectory(baseEnvironment = process.env) {
  return baseEnvironment.GTD_DEVELOPMENT_ROOT_DIRECTORY
    ?? path.join(repositoryRoot, "dev-gtd-on-rails");
}

export function syncServerDevelopmentRootDirectory(baseEnvironment = process.env) {
  return baseEnvironment.GTD_SYNC_SERVER_DATA_ROOT
    ?? path.join(repositoryRoot, "dev-gtd-sync-server");
}

function startWorkspaceProcess(filter, environment) {
  const child = spawn(
    pnpmExecutable,
    ["--filter", filter, "dev"],
    { cwd: repositoryRoot, env: environment, stdio: "inherit" }
  );
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

function stopWhenProcessExits(child) {
  child.once("exit", (code) => {
    stopChildren();
    process.exit(code ?? 1);
  });
}

export async function waitForSyncServer(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + "/");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("sync server did not become ready at " + baseUrl);
}

export async function startDevelopment() {
  const environment = developmentEnvironment();
  const syncServer = startWorkspaceProcess("@gtd-on-rails/sync-server", environment);
  stopWhenProcessExits(syncServer);
  await waitForSyncServer(environment.GTD_SYNC_SERVER_BASE_URL);

  const api = startWorkspaceProcess("@gtd-on-rails/api", environment);
  const desktop = startWorkspaceProcess("@gtd-on-rails/desktop", environment);
  stopWhenProcessExits(api);
  stopWhenProcessExits(desktop);
  console.log("Sync server dashboard: " + environment.GTD_SYNC_SERVER_BASE_URL + "/");
}

process.once("SIGINT", () => { stopChildren(); process.exit(130); });
process.once("SIGTERM", () => { stopChildren(); process.exit(143); });

if (import.meta.url === `file://${process.argv[1]}`) {
  startDevelopment().catch((error) => {
    console.error(error.message);
    stopChildren();
    process.exit(1);
  });
}
