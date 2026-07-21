import { rm } from "node:fs/promises";
import path from "node:path";
import { composeOutput, developmentRootDirectory, runCompose, startDevelopment, waitForPostgres } from "./dev.mjs";

const expectedDatabaseIdentity = "DEVELOPMENT";

/**
 * Recreates the guarded development database and its asset directory.
 *
 * @example await resetDevelopmentData()
 */
export async function resetDevelopmentData() {
  startPostgresForIdentityCheck();
  assertDevelopmentIdentity(databaseIdentity());
  runCompose(["down", "-v"]);
  await removeDevelopmentAssets();
}

function startPostgresForIdentityCheck() {
  runCompose(["up", "-d", "postgres"]);
  waitForPostgres();
}

function databaseIdentity() {
  return composeOutput(["exec", "-T", "postgres", "psql", "-U", "gtd", "-d", "gtd_on_rails", "-Atc", "select environment from gtd.database_identity where id = true;"]);
}

function assertDevelopmentIdentity(actualIdentity) {
  if (actualIdentity === expectedDatabaseIdentity) return;
  throw new Error(`development reset database identity '${actualIdentity || "unavailable"}' is invalid; expected ${expectedDatabaseIdentity}`);
}

async function removeDevelopmentAssets() {
  await rm(path.join(developmentRootDirectory(), "assets"), { recursive: true, force: true });
}

async function main() {
  await resetDevelopmentData();
  startDevelopment();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
