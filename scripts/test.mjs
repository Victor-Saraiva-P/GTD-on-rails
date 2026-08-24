import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "infra", "compose.test.yaml");
const compose = ["compose", "-f", composeFile, "-p", "gtd-on-rails-test"];
const pnpm = process.env.GTD_PNPM_EXECUTABLE ?? "pnpm";
const docker = process.env.GTD_DOCKER_EXECUTABLE ?? "docker";

function run(executable, args, env = process.env) {
  const result = spawnSync(executable, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${executable} ${args.join(" ")} failed with status ${result.status}`);
}

function waitForDatabases() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(docker, [...compose, "ps", "--status", "running", "--format", "{{.Health}}"], { cwd: root, encoding: "utf8" });
    const health = result.stdout.trim().split("\n");
    if (result.status === 0 && health.length === 2 && health.every((value) => value === "healthy")) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error("test PostgreSQL health check timed out; expected both disposable databases to be healthy");
}

function testEnvironment() {
  return { ...process.env, GTD_TEST_DB_URL: "jdbc:postgresql://127.0.0.1:55432/gtd_integration?currentSchema=gtd", GTD_TEST_DB_USERNAME: "gtd_test", GTD_TEST_DB_PASSWORD: "gtd_test", GTD_E2E_DB_URL: "jdbc:postgresql://127.0.0.1:55433/gtd_e2e?currentSchema=gtd" };
}

function main() {
  run(pnpm, ["run", "unitTest"]);
  try {
    run(docker, [...compose, "up", "-d", "--force-recreate"]);
    waitForDatabases();
    const env = testEnvironment();
    run(pnpm, ["run", "integrationTest"], env);
    run(pnpm, ["run", "e2e"], env);
  } finally {
    run(docker, [...compose, "down", "--volumes", "--remove-orphans"]);
  }
}

main();
