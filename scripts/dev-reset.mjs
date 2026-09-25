import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  developmentRootDirectory,
  startDevelopment,
  syncServerDevelopmentRootDirectory
} from "./dev.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resetDevelopmentData(environment = process.env) {
  const roots = [
    path.resolve(developmentRootDirectory(environment)),
    path.resolve(syncServerDevelopmentRootDirectory(environment))
  ];
  for (const root of roots) {
    assertDisposableDevelopmentRoot(root);
    await rm(root, { recursive: true, force: true });
  }
}

export function assertDisposableDevelopmentRoot(root) {
  const defaults = [
    path.join(repositoryRoot, "dev-gtd-on-rails"),
    path.join(repositoryRoot, "dev-gtd-sync-server")
  ];
  if (defaults.includes(root)) return;
  const allowedParent = path.join(repositoryRoot, ".dev-data");
  if (root.startsWith(allowedParent + path.sep)) return;
  throw new Error(
    "development reset root '" + root
      + "' is invalid; expected repository dev dataset or .dev-data child"
  );
}

async function main() {
  await resetDevelopmentData();
  await startDevelopment();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
