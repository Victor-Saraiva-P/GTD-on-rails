import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";
const fixedExecutablePath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin";
const developmentPorts = [1420, 8080, 9473];
const children = [];
let shuttingDown = false;

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

export async function assertPortAvailable(port, host = "127.0.0.1") {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => reject(portError(port, error)));
    server.listen({ host, port, exclusive: true }, () => server.close(resolve));
  });
}

export async function assertDevelopmentPortsAvailable() {
  for (const port of developmentPorts) await assertPortAvailable(port);
}

function portError(port, error) {
  if (error?.code === "EADDRINUSE") {
    return new Error(
      "development port " + port + " is already in use; stop the previous dev process and run pnpm dev again"
    );
  }
  return error;
}

function startWorkspaceProcess(filter, environment) {
  const child = spawn(
    pnpmExecutable,
    ["--filter", filter, "dev"],
    { cwd: repositoryRoot, env: environment, stdio: "inherit", detached: true }
  );
  children.push(child);
  return child;
}

function stopChildren(signal = "SIGTERM") {
  for (const child of children) stopProcessGroup(child, signal);
}

function stopProcessGroup(child, signal) {
  if (!child.pid || child.killed) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function stopWhenProcessExits(child) {
  child.once("exit", (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopChildren();
    process.exit(code ?? 1);
  });
}

export async function waitForSyncServer(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await syncServerResponds(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("sync server did not become ready at " + baseUrl);
}

async function syncServerResponds(baseUrl) {
  try {
    const response = await fetch(baseUrl + "/");
    return response.ok;
  } catch {
    return false;
  }
}

export async function startDevelopment() {
  await assertDevelopmentPortsAvailable();
  const environment = developmentEnvironment();
  const syncServer = startWorkspaceProcess("@gtd-on-rails/sync-server", environment);
  stopWhenProcessExits(syncServer);
  await waitForSyncServer(environment.GTD_SYNC_SERVER_BASE_URL);
  startClientProcesses(environment);
}

function startClientProcesses(environment) {
  const api = startWorkspaceProcess("@gtd-on-rails/api", environment);
  const desktop = startWorkspaceProcess("@gtd-on-rails/desktop", environment);
  stopWhenProcessExits(api);
  stopWhenProcessExits(desktop);
  console.log("Sync server dashboard: " + environment.GTD_SYNC_SERVER_BASE_URL + "/");
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren();
  process.exit(code);
}

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));

if (import.meta.url === `file://${process.argv[1]}`) {
  startDevelopment().catch((error) => {
    console.error(error.message);
    shutdown(1);
  });
}
