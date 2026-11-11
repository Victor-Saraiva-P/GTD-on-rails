import { mkdir } from "node:fs/promises";
import {
  gtdBuildSpec,
  gtdProcessSpecs,
  gtdRuntimeEnvironment,
  normalizeRuntimeEnvironment,
  runtimePorts
} from "./runtime-config.mjs";
import {
  assertPortAvailable,
  runBuild,
  spawnManagedProcess,
  stopProcessGroup,
  superviseProcesses,
  waitForHttpReady
} from "./process-runner.mjs";

/** Create the local SQLite parent directory before Spring/Hikari opens gtd.db.
 * @example await ensureGtdDataRoot("/tmp/my-gtd-development-data")
 */
export async function ensureGtdDataRoot(directory) {
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new Error(`Cannot prepare GTD data directory '${directory}': ${error.message}`, { cause: error });
  }
}

export async function startGtd(environmentName = "dev") {
  const normalized = normalizeRuntimeEnvironment(environmentName);
  await assertPortAvailable(runtimePorts.api);
  await assertPortAvailable(runtimePorts.desktop);

  const environment = gtdRuntimeEnvironment(normalized);
  await ensureGtdDataRoot(environment.GTD_DATA_ROOT_DIRECTORY);
  runBuild(gtdBuildSpec(), environment);
  const [apiSpec, desktopSpec] = gtdProcessSpecs(normalized);
  const api = spawnManagedProcess(apiSpec, environment);

  console.log(`GTD on Rails environment: ${normalized}`);
  console.log(`Sync server: ${environment.GTD_SYNC_SERVER_BASE_URL}`);
  console.log("Waiting for local API readiness...");

  try {
    await waitForHttpReady(`http://127.0.0.1:${runtimePorts.api}/readiness`);
  } catch (error) {
    stopProcessGroup(api);
    throw error;
  }

  console.log("Local API ready; starting desktop.");
  const desktop = spawnManagedProcess(desktopSpec, environment);
  superviseProcesses([api, desktop]);
}

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGtd(argumentValue("env", "dev")).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
