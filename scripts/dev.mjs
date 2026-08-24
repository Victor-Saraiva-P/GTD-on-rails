import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(repositoryRoot, "infra", "compose.yaml");
const dockerExecutable = process.env.GTD_DOCKER_EXECUTABLE ?? "/usr/bin/docker";
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";
const fixedExecutablePath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin";
const composeArgs = ["compose", "-f", composeFile];
const children = [];

/**
 * Builds the Docker command used for the development Compose file.
 *
 * @example composeCommand(["up", "-d", "postgres"])
 */
export function composeCommand(args) {
  return ["docker", ...composeArgs, ...args];
}

/**
 * Builds the environment used by native development processes.
 *
 * @example developmentEnvironment({ PATH: "/usr/bin" })
 */
export function developmentEnvironment(baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    PATH: fixedExecutablePath,
    GTD_DATA_ROOT_DIRECTORY: developmentRootDirectory(baseEnvironment),
    GTD_SYNC_RCLONE_ENABLED: "false",
  };
}

/**
 * Returns the directory that holds disposable development files.
 *
 * @example developmentRootDirectory()
 */
export function developmentRootDirectory(baseEnvironment = process.env) {
  return baseEnvironment.GTD_DEVELOPMENT_ROOT_DIRECTORY ?? path.join(repositoryRoot, "dev-gtd-on-rails");
}

/**
 * Runs a Compose command that must complete successfully.
 *
 * @example runCompose(["up", "-d", "postgres"])
 */
export function runCompose(args) {
  const result = spawnSync(dockerExecutable, [...composeArgs, ...args], { cwd: repositoryRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`development Compose command '${args.join(" ")}' failed; expected PostgreSQL to be available`);
}

/**
 * Returns standard output from a best-effort Compose command.
 *
 * @example composeOutput(["ps", "--format", "{{.Health}}", "postgres"])
 */
export function composeOutput(args) {
  const result = spawnSync(dockerExecutable, [...composeArgs, ...args], { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function postgresIsHealthy() {
  const result = spawnSync(dockerExecutable, [...composeArgs, "ps", "--status", "running", "--format", "{{.Health}}", "postgres"], { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0 && result.stdout.trim() === "healthy";
}

/**
 * Waits until the development PostgreSQL service is healthy.
 *
 * @example waitForPostgres()
 */
export function waitForPostgres() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (postgresIsHealthy()) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("development PostgreSQL health value 'timeout' is invalid; expected healthy within 30 seconds");
}

function startWorkspaceProcess(filter) {
  const child = spawn(pnpmExecutable, ["--filter", filter, "dev"], { cwd: repositoryRoot, env: developmentEnvironment(), stdio: "inherit" });
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
}

/**
 * Starts PostgreSQL and the native API and desktop development processes.
 *
 * @example startDevelopment()
 */
export function startDevelopment() {
  runCompose(["up", "-d", "postgres"]);
  waitForPostgres();
  const api = startWorkspaceProcess("@gtd-on-rails/api");
  startWorkspaceProcess("@gtd-on-rails/desktop");
  api.once("exit", (code) => { stopChildren(); process.exit(code ?? 1); });
}

process.once("SIGINT", () => { stopChildren(); process.exit(130); });
process.once("SIGTERM", () => { stopChildren(); process.exit(143); });

if (import.meta.url === `file://${process.argv[1]}`) startDevelopment();
