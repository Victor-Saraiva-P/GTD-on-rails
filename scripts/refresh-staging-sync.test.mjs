import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { refreshStagingSnapshot, stagingRefreshConfig } from "./refresh-staging-sync.mjs";

function environment(productionBackups, stagingBackups) {
  return {
    GTD_PRODUCTION_SYNC_SERVER_BASE_URL: "http://127.0.0.1:9475",
    GTD_STAGING_SYNC_SERVER_BASE_URL: "http://127.0.0.1:9476",
    GTD_PRODUCTION_SYNC_SERVER_BACKUP_DIRECTORY: productionBackups,
    GTD_STAGING_SYNC_SERVER_BACKUP_DIRECTORY: stagingBackups,
    GTD_PRODUCTION_SYNC_SERVER_AUTH_TOKEN: "production-token",
    GTD_STAGING_SYNC_SERVER_AUTH_TOKEN: "staging-token"
  };
}

class FakeSyncApi {
  constructor(environmentName = "staging", fileName = "gtd-snapshot-1-20261107.zip") {
    this.environmentName = environmentName;
    this.fileName = fileName;
    this.requests = [];
  }

  async request(url, options) {
    const route = new URL(url).pathname;
    const method = options.method;
    this.requests.push({ route, method, body: options.body, origin: new URL(url).origin });
    if (route === "/v1/backups/environment") return this.response({ environment: this.environmentName });
    if (route === "/v1/backups/restore") return this.response({ datasetEpoch: "new-epoch", cursor: 31 });
    if (new URL(url).port === "9475") return this.response({ fileName: this.fileName });
    return this.response({ fileName: "staging-recovery.zip" });
  }

  response(value) {
    return { ok: true, json: async () => value };
  }
}

async function withBackupDirectories(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gtd-staging-refresh-"));
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const production = path.join(directory, "production");
  const staging = path.join(directory, "staging");
  await fs.mkdir(production);
  return { production, staging };
}

test("refresh configuration requires isolated endpoints and backup directories", () => {
  const current = environment("/tmp/production", "/tmp/staging");
  assert.equal(stagingRefreshConfig(current).stagingUrl.port, "9476");
  assert.throws(() => stagingRefreshConfig({ ...current,
    GTD_STAGING_SYNC_SERVER_BASE_URL: current.GTD_PRODUCTION_SYNC_SERVER_BASE_URL
  }), /different origin/);
  assert.throws(() => stagingRefreshConfig({ ...current,
    GTD_STAGING_SYNC_SERVER_BACKUP_DIRECTORY: "/tmp/production/nested"
  }), /separate location/);
  assert.throws(() => stagingRefreshConfig({ ...current,
    GTD_STAGING_SYNC_SERVER_AUTH_TOKEN: ""
  }), /nonempty value/);
  assert.throws(() => stagingRefreshConfig({ ...current,
    GTD_STAGING_SYNC_SERVER_BACKUP_DIRECTORY: "relative/staging"
  }), /expected an absolute path/);
});

test("refresh rejects a target not explicitly marked staging before creating snapshots", async t => {
  const directories = await withBackupDirectories(t);
  const config = stagingRefreshConfig(environment(directories.production, directories.staging));
  const api = new FakeSyncApi("production");
  await assert.rejects(refreshStagingSnapshot(config, {
    fetchImpl: api.request.bind(api)
  }), /expected 'staging'/);
  assert.deepEqual(api.requests.map(request => request.route), ["/v1/backups/environment"]);
});

test("refresh copies the immutable snapshot and preserves previous staging state", async t => {
  const directories = await withBackupDirectories(t);
  const api = new FakeSyncApi();
  await fs.writeFile(path.join(directories.production, api.fileName), "sample snapshot");
  const config = stagingRefreshConfig(environment(directories.production, directories.staging));
  const restored = await refreshStagingSnapshot(config, { fetchImpl: api.request.bind(api) });

  assert.equal(restored.sourceSnapshot, api.fileName);
  assert.equal(restored.stagingRecoverySnapshot, "staging-recovery.zip");
  assert.equal(restored.datasetEpoch, "new-epoch");
  assert.equal(await fs.readFile(path.join(directories.staging, api.fileName), "utf8"), "sample snapshot");
  assert.deepEqual(api.requests.map(request => request.route), [
    "/v1/backups/environment", "/v1/backups", "/v1/backups", "/v1/backups/restore"
  ]);
  assert.deepEqual(JSON.parse(api.requests.at(-1).body), { fileName: api.fileName });
});

test("refresh rejects an untrusted production backup name", async t => {
  const directories = await withBackupDirectories(t);
  const config = stagingRefreshConfig(environment(directories.production, directories.staging));
  const api = new FakeSyncApi("staging", "../bad.zip");
  await assert.rejects(refreshStagingSnapshot(config, {
    fetchImpl: api.request.bind(api)
  }), /invalid; expected a gtd-snapshot/);
  assert.equal(api.requests.length, 2);
});
