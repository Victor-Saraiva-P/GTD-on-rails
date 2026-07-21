import { spawn } from "node:child_process";

/**
 * Runs a Node script and optionally terminates it after a test interval.
 *
 * @example await runScriptUntilStopped("scripts/dev.mjs", process.env, 1000)
 */
export function runScriptUntilStopped(scriptPath, environment, stopAfter = 0) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), env: environment, stdio: "ignore" });
    const stopTimer = stopAfter && setTimeout(() => childProcess.kill("SIGTERM"), stopAfter);
    childProcess.once("error", reject);
    childProcess.once("close", (exitCode) => resolveProcessOutcome(resolve, stopTimer, exitCode));
  });
}

function resolveProcessOutcome(resolve, stopTimer, exitCode) {
  clearTimeout(stopTimer);
  resolve({ exitCode });
}
