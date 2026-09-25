import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

export async function assertPortAvailable(port, host = "127.0.0.1") {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => reject(portError(port, error)));
    server.listen({ host, port, exclusive: true }, () => server.close(resolve));
  });
}

export function runBuild(spec, environment) {
  const result = spawnSync(spec.command, spec.args, {
    cwd: spec.cwd,
    env: environment,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status === 0) return;
  throw new Error(`${spec.label} failed with status ${result.status ?? "unknown"}`);
}

export function spawnManagedProcess(spec, environment) {
  return spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: environment,
    stdio: "inherit",
    detached: true
  });
}

export async function waitForHttpReady(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpOk(url)) return;
    await sleep(250);
  }
  throw new Error(`backend readiness timed out at ${url}`);
}

async function httpOk(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function superviseProcesses(children) {
  let shuttingDown = false;
  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) stopProcessGroup(child);
    process.exit(code);
  };

  for (const child of children) {
    child.once("exit", (code) => shutdown(code ?? 1));
  }
  process.once("SIGINT", () => shutdown(130));
  process.once("SIGTERM", () => shutdown(143));
}

export function stopProcessGroup(child, signal = "SIGTERM") {
  if (!child.pid || child.killed) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function portError(port, error) {
  if (error?.code !== "EADDRINUSE") return error;
  return new Error(`port ${port} is already in use; stop the conflicting process before retrying`);
}
