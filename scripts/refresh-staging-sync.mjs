import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Validates the on-host production/staging backup locations and API endpoints.
 *
 * @example stagingRefreshConfig(process.env)
 */
export function stagingRefreshConfig(environment) {
  const productionUrl = serviceUrl(required(environment, "GTD_PRODUCTION_SYNC_SERVER_BASE_URL"));
  const stagingUrl = serviceUrl(required(environment, "GTD_STAGING_SYNC_SERVER_BASE_URL"));
  const productionBackups = absoluteDirectory(environment, "GTD_PRODUCTION_SYNC_SERVER_BACKUP_DIRECTORY");
  const stagingBackups = absoluteDirectory(environment, "GTD_STAGING_SYNC_SERVER_BACKUP_DIRECTORY");
  if (productionUrl.origin === stagingUrl.origin) {
    throw new Error("staging sync endpoint is invalid; expected a different origin from production");
  }
  if (overlapping(productionBackups, stagingBackups)) {
    throw new Error("staging backup directory is invalid; expected a separate location from production");
  }
  return { productionUrl, stagingUrl, productionBackups, stagingBackups,
    productionToken: required(environment, "GTD_PRODUCTION_SYNC_SERVER_AUTH_TOKEN"),
    stagingToken: required(environment, "GTD_STAGING_SYNC_SERVER_AUTH_TOKEN") };
}

function required(environment, key) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`environment variable '${key}' is missing; expected a nonempty value`);
  return value;
}

function absoluteDirectory(environment, key) {
  const value = required(environment, key);
  if (!path.isAbsolute(value)) {
    throw new Error(`backup directory '${value}' is invalid; expected an absolute path for '${key}'`);
  }
  return path.resolve(value);
}

function serviceUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`sync server URL '${value}' is invalid; expected an HTTP(S) origin without a path`);
  }
  return url;
}

function overlapping(first, second) {
  return first === second || first.startsWith(second + path.sep) || second.startsWith(first + path.sep);
}

function endpoint(base, suffix) {
  return new URL(`/v1/backups${suffix}`, base).toString();
}

async function requestJson(fetchImpl, url, token, method = "GET", body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetchImpl(url, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(`sync API request '${method} ${url}' failed with HTTP ${response.status}`);
  }
  return response.json();
}

function snapshotFileName(value) {
  if (typeof value !== "string" || !/^gtd-snapshot-[a-zA-Z0-9._-]+\.zip$/.test(value)) {
    throw new Error(`snapshot name '${value}' is invalid; expected a gtd-snapshot-*.zip file name`);
  }
  return value;
}

async function copySnapshot(config, name, fileSystem) {
  const source = path.join(config.productionBackups, name);
  const destination = path.join(config.stagingBackups, name);
  const temporary = path.join(config.stagingBackups, `.${name}.${process.pid}.tmp`);
  await fileSystem.mkdir(config.stagingBackups, { recursive: true });
  try {
    await fileSystem.copyFile(source, temporary);
    await fileSystem.rename(temporary, destination);
  } finally {
    await fileSystem.rm(temporary, { force: true });
  }
}

/**
 * Clones one immutable production snapshot into a running, verified staging server.
 * The staging desktop must rebootstrap after this operation rotates datasetEpoch.
 *
 * @example await refreshStagingSnapshot(stagingRefreshConfig(process.env))
 */
export async function refreshStagingSnapshot(config, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const fileSystem = dependencies.fileSystem ?? fs;
  const stagingEndpoint = endpoint(config.stagingUrl, "");
  const staging = await requestJson(fetchImpl, endpoint(config.stagingUrl, "/environment"),
    config.stagingToken);
  if (staging.environment !== "staging") {
    throw new Error(`restore target environment '${staging.environment}' is invalid; expected 'staging'`);
  }
  const productionSnapshot = await requestJson(fetchImpl,
    endpoint(config.productionUrl, ""), config.productionToken, "POST");
  const name = snapshotFileName(productionSnapshot.fileName);
  await copySnapshot(config, name, fileSystem);
  const previous = await requestJson(fetchImpl, stagingEndpoint, config.stagingToken, "POST");
  const restored = await requestJson(fetchImpl, endpoint(config.stagingUrl, "/restore"),
    config.stagingToken, "POST", { fileName: name });
  return { sourceSnapshot: name, stagingRecoverySnapshot: previous.fileName,
    datasetEpoch: restored.datasetEpoch, cursor: restored.cursor };
}

function publicPlan(config) {
  return { productionUrl: config.productionUrl.origin, stagingUrl: config.stagingUrl.origin,
    productionBackups: config.productionBackups, stagingBackups: config.stagingBackups };
}

async function main(argv, environment) {
  const config = stagingRefreshConfig(environment);
  if (!argv.includes("--apply")) {
    console.log(JSON.stringify({ mode: "dry-run", ...publicPlan(config) }, null, 2));
    return;
  }
  if (!argv.includes("--confirm=REFRESH_STAGING")) {
    throw new Error("restore confirmation is missing; expected --confirm=REFRESH_STAGING");
  }
  const outcome = await refreshStagingSnapshot(config);
  console.log(JSON.stringify({ mode: "applied", ...outcome }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
