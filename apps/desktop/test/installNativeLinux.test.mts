import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");
const installerPath = resolve(repositoryRoot, "apps/desktop/scripts/install-native-linux.sh");

function makeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
}

function createInstallerFixture(tempRoot: string): string {
  const fixture = resolve(tempRoot, "fixture");
  mkdirSync(resolve(fixture, "binaries"), { recursive: true });
  writeFileSync(resolve(fixture, "gtd-on-rails"), "", "utf8");
  writeFileSync(resolve(fixture, "gtd-api"), "", "utf8");
  writeFileSync(resolve(fixture, "gtd"), "#!/usr/bin/env bash\nexit 0\n", "utf8");
  chmodSync(resolve(fixture, "gtd"), 0o755);
  writeFileSync(resolve(fixture, "gtd-on-rails-launcher"), "#!/usr/bin/env bash\nexit 0\n", "utf8");
  chmodSync(resolve(fixture, "gtd-on-rails-launcher"), 0o755);
  writeFileSync(resolve(fixture, "icon.png"), "png", "utf8");
  writeFileSync(resolve(fixture, "binaries/gtd-api.jar"), "jar", "utf8");
  writeFileSync(resolve(fixture, "install.sh"), readFileSync(installerPath, "utf8"), "utf8");
  chmodSync(resolve(fixture, "install.sh"), 0o755);
  return fixture;
}

type InstallerRunOptions = {
  baseUrl?: string;
  savedEnvLines?: string[];
  tokenFromEnv?: string | null;
};

function runInstaller(options: InstallerRunOptions = {}): string {
  const tempRoot = mkdtempSync(resolve(os.tmpdir(), "desktop-installer-test-"));
  try {
    const fixture = createInstallerFixture(tempRoot);
    const home = resolve(tempRoot, "home");
    const xdgDataHome = resolve(tempRoot, "data");
    const xdgConfigHome = resolve(tempRoot, "config");
    mkdirSync(home, { recursive: true });
    mkdirSync(xdgDataHome, { recursive: true });
    mkdirSync(xdgConfigHome, { recursive: true });
    if (options.savedEnvLines) {
      writeFileSync(resolve(xdgConfigHome, "gtd-on-rails.env"), `${options.savedEnvLines.join("\n")}\n`, "utf8");
    }
    const fakeBin = resolve(tempRoot, "bin");
    mkdirSync(fakeBin, { recursive: true });
    makeExecutable(resolve(fakeBin, "java"), "#!/usr/bin/env bash\nexit 0\n");

    const env = {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: xdgDataHome,
      XDG_CONFIG_HOME: xdgConfigHome,
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    };
    const tokenFromEnv = options.tokenFromEnv === undefined ? "test-token" : options.tokenFromEnv;
    if (tokenFromEnv !== null) env.GTD_SYNC_SERVER_AUTH_TOKEN = tokenFromEnv;
    if (options.baseUrl) env.GTD_SYNC_SERVER_BASE_URL = options.baseUrl;

    const result = spawnSync("bash", [resolve(fixture, "install.sh")], { cwd: fixture, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return readFileSync(resolve(xdgConfigHome, "gtd-on-rails.env"), "utf8");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("desktop native installer defaults to the solanum sync server endpoint", () => {
  const environmentFile = runInstaller();
  assert.match(environmentFile, /^GTD_SYNC_SERVER_BASE_URL=http:\/\/solanum\.tail010544\.ts\.net:9475$/m);
  assert.match(environmentFile, /^GTD_SYNC_SERVER_AUTH_TOKEN=test-token$/m);
});

test("desktop native installer keeps saved URL and token on reinstall", () => {
  const environmentFile = runInstaller({
    savedEnvLines: [
      "GTD_SYNC_SERVER_BASE_URL=http://saved.tailnet:9475",
      "GTD_SYNC_SERVER_AUTH_TOKEN=saved-token"
    ],
    tokenFromEnv: null
  });
  assert.match(environmentFile, /^GTD_SYNC_SERVER_BASE_URL=http:\/\/saved\.tailnet:9475$/m);
  assert.match(environmentFile, /^GTD_SYNC_SERVER_AUTH_TOKEN=saved-token$/m);
});

test("desktop native installer keeps explicit URL override precedence over saved URL", () => {
  const environmentFile = runInstaller({
    baseUrl: "http://override.tailnet:9475",
    savedEnvLines: [
      "GTD_SYNC_SERVER_BASE_URL=http://saved.tailnet:9475",
      "GTD_SYNC_SERVER_AUTH_TOKEN=saved-token"
    ],
    tokenFromEnv: null
  });
  assert.match(environmentFile, /^GTD_SYNC_SERVER_BASE_URL=http:\/\/override\.tailnet:9475$/m);
  assert.match(environmentFile, /^GTD_SYNC_SERVER_AUTH_TOKEN=saved-token$/m);
  assert.doesNotMatch(environmentFile, /pc-omarchy/);
});
