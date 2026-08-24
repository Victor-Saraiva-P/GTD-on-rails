import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecutable = process.env.GTD_PNPM_EXECUTABLE ?? "/usr/bin/pnpm";

/**
 * Finds the compiled Spring Boot API JAR file.
 *
 * @param {string} [rootDir=repositoryRoot]
 * @returns {string} Absolute path to the API JAR file.
 * @example
 * const jarPath = findApiJarPath();
 */
export function findApiJarPath(rootDir = repositoryRoot) {
  const libsDir = path.join(rootDir, "apps/api/build/libs");
  if (fs.existsSync(libsDir)) {
    const files = fs.readdirSync(libsDir).filter((file) => file.startsWith("api-") && file.endsWith(".jar") && !file.endsWith("-plain.jar"));
    if (files.length > 0) {
      return path.join(libsDir, files[0]);
    }
  }
  const versionFile = path.join(rootDir, "VERSION");
  const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : "1.5.0";
  return path.join(libsDir, `api-${version}.jar`);
}

/**
 * Prepares the environment variables for the cutover process.
 *
 * @param {NodeJS.ProcessEnv} [environment=process.env]
 * @returns {NodeJS.ProcessEnv} Environment configuration with production identity and cutover profile.
 * @example
 * const env = cutoverEnvironment();
 */
export function cutoverEnvironment(environment = process.env) {
  return {
    ...environment,
    GTD_SIDECAR_PROFILES: "prod,cutover",
    GTD_DATABASE_ENVIRONMENT: "PRODUCTION",
  };
}

/**
 * Returns the command arguments for building the API bootJar.
 *
 * @returns {string[]} Arguments array for pnpm.
 * @example
 * const cmd = cutoverCommand();
 */
export function cutoverCommand() {
  return ["--filter", "@gtd-on-rails/api", "run", "bootJar"];
}

/**
 * Runs the API cutover build and executes the cutover process.
 *
 * @param {NodeJS.ProcessEnv} [environment=cutoverEnvironment()]
 * @param {Function} [executeCommand=spawnSync]
 * @example
 * runCutover();
 */
export function runCutover(environment = cutoverEnvironment(), executeCommand = spawnSync) {
  const buildResult = executeCommand(pnpmExecutable, cutoverCommand(), { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  if (buildResult.status !== 0) {
    throw new Error(`cutover build exit value '${buildResult.status ?? "unknown"}' is invalid; expected successful api build`);
  }

  const apiJarPath = findApiJarPath();
  const javaArgs = ["-jar", apiJarPath, "--spring.profiles.active=prod,cutover"];
  const runResult = executeCommand("java", javaArgs, { cwd: repositoryRoot, env: environment, stdio: "inherit" });
  if (runResult.status !== 0) {
    throw new Error(`cutover run exit value '${runResult.status ?? "unknown"}' is invalid; expected successful cutover execution`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCutover();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
