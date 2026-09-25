import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixedExecutablePath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin";

export const runtimePorts = Object.freeze({
  api: 8080,
  desktop: 1420,
  clientDev: 9473,
  clientStaging: 9474
});

export function normalizeRuntimeEnvironment(value = "dev") {
  if (value === "dev" || value === "staging") return value;
  throw new Error(`runtime environment '${value}' is invalid; expected 'dev' or 'staging'`);
}

export function gtdRuntimeEnvironment(name, baseEnvironment = process.env) {
  const environmentName = normalizeRuntimeEnvironment(name);
  return {
    ...baseEnvironment,
    PATH: fixedExecutablePath,
    GTD_DATA_ROOT_DIRECTORY: gtdDataRoot(environmentName, baseEnvironment),
    GTD_DATABASE_ENVIRONMENT: databaseEnvironment(environmentName),
    GTD_SYNC_SERVER_ENABLED: baseEnvironment.GTD_SYNC_SERVER_ENABLED ?? "true",
    GTD_SYNC_SERVER_BASE_URL: baseEnvironment.GTD_SYNC_SERVER_BASE_URL
      ?? `http://127.0.0.1:${clientPort(environmentName)}`,
    APP_CORS_ALLOWED_ORIGINS: "http://127.0.0.1:1420,http://localhost:1420",
    VITE_DATA_ROOT_DIRECTORY_NAME: dataRootName(environmentName)
  };
}

export function clientRuntimeEnvironment(name, baseEnvironment = process.env) {
  const environmentName = normalizeRuntimeEnvironment(name);
  return {
    ...baseEnvironment,
    PATH: fixedExecutablePath,
    GTD_SYNC_SERVER_DATA_ROOT: clientDataRoot(environmentName, baseEnvironment),
    GTD_SYNC_SERVER_BIND_ADDRESS: baseEnvironment.GTD_SYNC_SERVER_BIND_ADDRESS ?? "127.0.0.1",
    GTD_SYNC_SERVER_PORT: baseEnvironment.GTD_SYNC_SERVER_PORT ?? String(clientPort(environmentName)),
    GTD_SYNC_SERVER_PUBLIC_BASE_URL: baseEnvironment.GTD_SYNC_SERVER_PUBLIC_BASE_URL
      ?? `http://127.0.0.1:${clientPort(environmentName)}`
  };
}

export function gtdBuildSpec() {
  return gradleBuildSpec("api");
}

export function clientBuildSpec() {
  return gradleBuildSpec("sync-server");
}

export function gtdProcessSpecs(name) {
  const environmentName = normalizeRuntimeEnvironment(name);
  return [
    {
      label: "api",
      command: "/usr/bin/java",
      args: ["-jar", apiJarPath(), `--spring.profiles.active=${environmentName}`],
      cwd: path.join(repositoryRoot, "apps/api")
    },
    {
      label: "desktop",
      command: "/usr/bin/pnpm",
      args: ["--filter", "@gtd-on-rails/desktop", "run", desktopScript(environmentName)],
      cwd: repositoryRoot
    }
  ];
}

export function clientProcessSpec() {
  return {
    label: "client",
    command: "/usr/bin/java",
    args: ["-jar", path.join(repositoryRoot, "apps/sync-server/build/libs/gtd-sync-server.jar")],
    cwd: path.join(repositoryRoot, "apps/sync-server")
  };
}

export function gtdDataRoot(name, environment = process.env) {
  if (name === "staging") {
    return environment.GTD_STAGING_ROOT_DIRECTORY
      ?? path.join(repositoryRoot, "staging-gtd-on-rails");
  }
  return environment.GTD_DEVELOPMENT_ROOT_DIRECTORY
    ?? path.join(repositoryRoot, "dev-gtd-on-rails");
}

export function clientDataRoot(name, environment = process.env) {
  const override = environment.GTD_SYNC_SERVER_DATA_ROOT;
  if (override) return override;
  const directory = name === "staging" ? "staging-gtd-sync-server" : "dev-gtd-sync-server";
  return path.join(repositoryRoot, directory);
}

export function clientPort(name) {
  return name === "staging" ? runtimePorts.clientStaging : runtimePorts.clientDev;
}

function gradleBuildSpec(project) {
  return {
    label: `${project}-build`,
    command: "./gradlew",
    args: ["--no-daemon", "bootJar"],
    cwd: path.join(repositoryRoot, "apps", project)
  };
}

function apiJarPath() {
  const version = fs.readFileSync(path.join(repositoryRoot, "VERSION"), "utf8").trim();
  return path.join(repositoryRoot, `apps/api/build/libs/api-${version}.jar`);
}

function desktopScript(name) {
  return name === "staging" ? "dev:staging" : "dev";
}

function databaseEnvironment(name) {
  return name === "staging" ? "STAGING" : "DEVELOPMENT";
}

function dataRootName(name) {
  return name === "staging" ? "staging-gtd-on-rails" : "dev-gtd-on-rails";
}
