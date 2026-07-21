import { chmod, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testSupportDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "test-support");

/**
 * Installs named fake Docker and pnpm executables for development tests.
 *
 * @example await installFakeDevelopmentCommands("/tmp/gtd-test")
 */
export async function installFakeDevelopmentCommands(sandboxDirectory) {
  await installFakeExecutable("fake-development-docker.cjs", sandboxDirectory, "docker");
  await installFakeExecutable("fake-development-pnpm.cjs", sandboxDirectory, "pnpm");
}

async function installFakeExecutable(sourceName, sandboxDirectory, executableName) {
  const sourcePath = path.join(testSupportDirectory, sourceName);
  const executablePath = path.join(sandboxDirectory, executableName);
  await copyFile(sourcePath, executablePath);
  await chmod(executablePath, 0o755);
}
