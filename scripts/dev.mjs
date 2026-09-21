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
    GTD_SYNC_SERVER_ENABLED: baseEnvironment.GTD_SYNC_SERVER_ENABLED ?? "false"
  };
}

export function developmentRootDirectory(baseEnvironment = process.env) {
  return baseEnvironment.GTD_DEVELOPMENT_ROOT_DIRECTORY
    ?? path.join(repositoryRoot, "dev-gtd-on-rails");
}

function startWorkspaceProcess(filter) {
  const child = spawn(
    pnpmExecutable,
    ["--filter", filter, "dev"],
    { cwd: repositoryRoot, env: developmentEnvironment(), stdio: "inherit" }
  );
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

export function startDevelopment() {
  const api = startWorkspaceProcess("@gtd-on-rails/api");
  startWorkspaceProcess("@gtd-on-rails/desktop");
  api.once("exit", (code) => {
    stopChildren();
    process.exit(code ?? 1);
  });
}

process.once("SIGINT", () => { stopChildren(); process.exit(130); });
process.once("SIGTERM", () => { stopChildren(); process.exit(143); });

if (import.meta.url === `file://${process.argv[1]}`) startDevelopment();
