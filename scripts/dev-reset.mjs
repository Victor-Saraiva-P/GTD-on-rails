import { rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { composeOutput, developmentRootDirectory, runCompose, startDevelopment, waitForPostgres } from "./dev.mjs";

const expectedDatabaseIdentity = "DEVELOPMENT";

/**
 * Recreates the guarded development database and its asset directory.
 *
 * @example await resetDevelopmentData()
 */
export async function resetDevelopmentData() {
  const postgresWasRunning = startExistingPostgresForIdentityCheck();
  assertDevelopmentIdentityOrRestoreState(postgresWasRunning);
  const stagedAssets = await stageDevelopmentAssets();
  await recreateDatabaseAndDiscardAssets(stagedAssets);
}

function startExistingPostgresForIdentityCheck() {
  assertPostgresContainerExists();
  const postgresWasRunning = postgresIsRunning();
  if (!postgresWasRunning) runCompose(["start", "postgres"]);
  return waitForHealthyPostgresOrRestoreState(postgresWasRunning);
}

function waitForHealthyPostgresOrRestoreState(postgresWasRunning) {
  try {
    waitForPostgres();
    return postgresWasRunning;
  } catch (error) {
    restorePostgresState(postgresWasRunning);
    throw error;
  }
}

function assertPostgresContainerExists() {
  const containerId = composeOutput(["ps", "-aq", "postgres"]);
  if (containerId) return;
  throw new Error("development reset PostgreSQL container identity 'unavailable' is invalid; expected existing DEVELOPMENT database");
}

function postgresIsRunning() {
  return Boolean(composeOutput(["ps", "-q", "postgres"]));
}

function databaseIdentity() {
  return composeOutput(["exec", "-T", "postgres", "psql", "-U", "gtd", "-d", "gtd_on_rails", "-Atc", "select environment from gtd.database_identity where id = true;"]);
}

function assertDevelopmentIdentityOrRestoreState(postgresWasRunning) {
  try {
    assertDevelopmentIdentity(databaseIdentity());
  } catch (error) {
    restorePostgresState(postgresWasRunning);
    throw error;
  }
}

function assertDevelopmentIdentity(actualIdentity) {
  if (actualIdentity === expectedDatabaseIdentity) return;
  throw new Error(`development reset database identity '${actualIdentity || "unavailable"}' is invalid; expected ${expectedDatabaseIdentity}`);
}

function restorePostgresState(postgresWasRunning) {
  if (postgresWasRunning) return;
  runCompose(["stop", "postgres"]);
}

async function stageDevelopmentAssets() {
  const activePath = path.join(developmentRootDirectory(), "assets");
  const stagedPath = `${activePath}.reset-${randomUUID()}`;
  try {
    await rename(activePath, stagedPath);
    return new StagedDevelopmentAssets(activePath, stagedPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`development asset directory value '${activePath}' is invalid; expected movable directory`, { cause: error });
  }
}

async function recreateDatabaseAndDiscardAssets(stagedAssets) {
  try {
    runCompose(["down", "-v"]);
  } catch (error) {
    await restoreStagedAssets(stagedAssets);
    throw error;
  }
  await discardStagedAssets(stagedAssets);
}

async function restoreStagedAssets(stagedAssets) {
  if (!stagedAssets) return;
  await rename(stagedAssets.stagedPath, stagedAssets.activePath);
}

async function discardStagedAssets(stagedAssets) {
  if (!stagedAssets) return;
  try {
    await rm(stagedAssets.stagedPath, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Development reset left staged assets at '${stagedAssets.stagedPath}'; expected removable directory, received '${message}'`);
  }
}

class StagedDevelopmentAssets {
  constructor(activePath, stagedPath) {
    this.activePath = activePath;
    this.stagedPath = stagedPath;
  }
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
