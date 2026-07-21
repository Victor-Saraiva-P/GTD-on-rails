import { spawn } from "node:child_process";

/**
 * Runs a Node script and optionally terminates it after a test interval.
 *
 * @example await runScriptUntilStopped("scripts/dev.mjs", process.env, 1000)
 */
export function runScriptUntilStopped(scriptPath, environment, stopAfter = 0) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), detached: true, env: environment, stdio: "ignore" });
    const stopTimer = stopAfter && setTimeout(() => stopScriptProcessGroup(childProcess.pid), stopAfter);
    childProcess.once("error", reject);
    childProcess.once("close", (exitCode) => resolveProcessOutcome(resolve, stopTimer, exitCode));
  });
}

function stopScriptProcessGroup(processId) {
  process.kill(-processId, "SIGTERM");
}

function resolveProcessOutcome(resolve, stopTimer, exitCode) {
  clearTimeout(stopTimer);
  resolve({ exitCode });
}
