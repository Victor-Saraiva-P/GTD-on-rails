import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.env.GTD_PNPM_EXECUTABLE ?? "pnpm";

function run(args) {
  const result = spawnSync(pnpm, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${pnpm} ${args.join(" ")} failed with status ${result.status}`);
  }
}

run(["run", "unitTest"]);
run(["run", "integrationTest"]);
run(["run", "e2e"]);
