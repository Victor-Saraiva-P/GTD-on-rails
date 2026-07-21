import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Installs fake Docker and pnpm commands for development orchestration tests.
 *
 * @example await installFakeDevelopmentCommands("/tmp/gtd-test")
 */
export async function installFakeDevelopmentCommands(directory) {
  await writeFakeDocker(directory);
  await writeFakePnpm(directory);
}

async function writeFakeDocker(directory) {
  const command = `${nodeShebang()}\nconst fs = require("node:fs");\nconst log = process.env.GTD_TEST_DOCKER_LOG ?? process.env.GTD_TEST_LOG;\nfs.appendFileSync(log, process.argv.slice(2).join(" ") + "\\n");\nif (process.argv.includes("ps")) process.stdout.write("healthy\\n");\nif (process.argv.includes("exec")) process.stdout.write(process.env.GTD_TEST_DATABASE_IDENTITY + "\\n");\n`;
  await writeCommand(directory, "docker", command);
}

async function writeFakePnpm(directory) {
  const command = `${nodeShebang()}\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.GTD_TEST_PNPM_LOG, process.argv.slice(2).join(" ") + "\\n");\nsetInterval(() => {}, 1000);\n`;
  await writeCommand(directory, "pnpm", command);
}

async function writeCommand(directory, name, content) {
  const commandPath = path.join(directory, name);
  await writeFile(commandPath, content);
  await chmod(commandPath, 0o755);
}

function nodeShebang() {
  return `#!${process.execPath}`;
}
