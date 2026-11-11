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
  const syncUrl = baseEnvironment.GTD_SYNC_SERVER_BASE_URL
    ?? `http://127.0.0.1:${clientPort(environmentName)}`;
  if (environmentName === "staging") assertStagingSyncUrl(syncUrl, baseEnvironment);
  return {
    ...baseEnvironment,
    // Keep executable resolution restricted while allowing package-manager shims
    // that invoke "node" through /usr/bin/env to launch under mise/Omarchy.
    PATH: [path.dirname(process.execPath), path.dirname(resolvePnpmExecutable(baseEnvironment)), fixedExecutablePath].join(path.delimiter),
    GTD_DATA_ROOT_DIRECTORY: gtdDataRoot(environmentName, baseEnvironment),
    GTD_DATABASE_ENVIRONMENT: databaseEnvironment(environmentName),
    GTD_SYNC_SERVER_ENABLED: baseEnvironment.GTD_SYNC_SERVER_ENABLED ?? "true",
    GTD_SYNC_SERVER_BASE_URL: syncUrl,
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
      ?? `http://127.0.0.1:${clientPort(environmentName)}`,
    GTD_SYNC_SERVER_DEPLOYMENT_ENVIRONMENT: environmentName,
    GTD_GOOGLE_CALENDAR_PROJECTION_ENABLED: environmentName === "staging" ? "false" : "true",
    GTD_SYNC_SERVER_GOOGLE_CALLBACK_LISTENER_ENABLED: environmentName === "staging"
      ? "false" : (baseEnvironment.GTD_SYNC_SERVER_GOOGLE_CALLBACK_LISTENER_ENABLED ?? "false"),
    GTD_CLIENT_AUTO_UPDATE_ENABLED: environmentName === "staging"
      ? "false" : (baseEnvironment.GTD_CLIENT_AUTO_UPDATE_ENABLED ?? "true")
  };
}

export function gtdBuildSpec() {
  return gradleBuildSpec("api");
}

export function clientBuildSpec() {
  return gradleBuildSpec("sync-server");
}

/**
 * Resolve the actual pnpm executable from the invoking terminal. The runtime
 * intentionally uses a restricted PATH, so a bare "pnpm" cannot be relied on.
 * @example resolvePnpmExecutable({ PATH: "/usr/local/bin:/usr/bin" })
 */
export function resolvePnpmExecutable(environment = process.env) {
  const directories = (environment.PATH ?? "").split(path.delimiter).filter(path.isAbsolute);
  for (const directory of directories) {
    const executable = path.join(directory, "pnpm");
    try {
      fs.accessSync(executable, fs.constants.X_OK);
      return executable;
    } catch {
      // Check the next PATH entry.
    }
  }
  return "/usr/bin/pnpm";
}

export function gtdProcessSpecs(name, environment = process.env) {
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
      command: resolvePnpmExecutable(environment),
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

/**
 * Rejects staging endpoints that resolve to the configured production sync service.
 *
 * @example assertStagingSyncUrl("http://127.0.0.1:9474", {})
 */
export function assertStagingSyncUrl(value, environment = process.env) {
  const production = environment.GTD_PRODUCTION_SYNC_SERVER_BASE_URL
    ?? "http://solanum.tail010544.ts.net:9475";
  let stagingOrigin;
  let productionOrigin;
  try {
    stagingOrigin = new URL(value).origin;
    productionOrigin = new URL(production).origin;
  } catch {
    throw new Error(`staging sync URL '${value}' is invalid; expected a fully qualified HTTP(S) URL`);
  }
  if (stagingOrigin === productionOrigin || stagingOrigin === "http://127.0.0.1:9475") {
    throw new Error(`staging sync URL '${value}' is invalid; expected an isolated non-production endpoint`);
  }
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`staging sync URL '${value}' is invalid; expected an HTTP(S) endpoint`);
  }
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
