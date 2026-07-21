import { readFile } from "node:fs/promises";
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

/**
 * Runs a Node script until its log contains the expected startup marker.
 *
 * @example await runScriptUntilLogContains("scripts/dev.mjs", process.env, "/tmp/pnpm.log", "api dev")
 */
export function runScriptUntilLogContains(scriptPath, environment, logPath, expectedText, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), detached: true, env: environment, stdio: "ignore" });
    let settled = false;
    let timeout;
    const settle = (callback) => { if (settled) return; settled = true; clearTimeout(timeout); callback(); };
    const settleWithError = (error) => settle(() => reject(error));
    timeout = setTimeout(() => {
      if (!childProcess.killed) stopScriptProcessGroup(childProcess.pid);
      settleWithError(new Error(`log file '${logPath}' did not contain '${expectedText}' within ${timeoutMs}ms`));
    }, timeoutMs);
    childProcess.once("error", settleWithError);
    childProcess.once("close", (exitCode) => settle(() => resolve({ exitCode })));
    pollLog(childProcess, logPath, expectedText, () => stopScriptProcessGroup(childProcess.pid), settleWithError);
  });
}

async function pollLog(childProcess, logPath, expectedText, onMatch, onError) {
  if (childProcess.killed) return;
  try {
    if ((await readFile(logPath, "utf8")).includes(expectedText)) return onMatch();
  } catch (error) {
    if (error.code !== "ENOENT") return onError(error);
  }
  setTimeout(() => pollLog(childProcess, logPath, expectedText, onMatch, onError), 25);
}

function stopScriptProcessGroup(processId) {
  process.kill(-processId, "SIGTERM");
}

function resolveProcessOutcome(resolve, stopTimer, exitCode) {
  clearTimeout(stopTimer);
  resolve({ exitCode });
}
