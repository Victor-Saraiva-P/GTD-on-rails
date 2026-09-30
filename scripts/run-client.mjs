import {
  clientBuildSpec,
  clientProcessSpec,
  clientRuntimeEnvironment,
  normalizeRuntimeEnvironment
} from "./runtime-config.mjs";
import {
  assertPortAvailable,
  runBuild,
  spawnManagedProcess,
  stopProcessGroup,
  superviseProcesses
} from "./process-runner.mjs";

export async function startClient(environmentName = "dev", hooks = {}) {
  const normalized = normalizeRuntimeEnvironment(environmentName);
  const environment = clientRuntimeEnvironment(normalized);
  const port = Number(environment.GTD_SYNC_SERVER_PORT);
  await assertPortAvailable(port, environment.GTD_SYNC_SERVER_BIND_ADDRESS);
  runBuild(clientBuildSpec(), environment);
  const child = spawnManagedProcess(clientProcessSpec(), environment);
  printClientRuntime(normalized, environment);
  try {
    if (hooks.afterStart) await hooks.afterStart(environment);
  } catch (error) {
    stopProcessGroup(child);
    throw error;
  }
  superviseProcesses([child]);
}

function printClientRuntime(environmentName, environment) {
  console.log(`GTD sync client environment: ${environmentName}`);
  console.log(`Sync dashboard: http://127.0.0.1:${environment.GTD_SYNC_SERVER_PORT}/`);
}

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startClient(argumentValue("env", "dev")).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
