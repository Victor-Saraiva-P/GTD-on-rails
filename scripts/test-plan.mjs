import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validTypes = new Set(["all", "unit", "integration", "e2e", "check", "lint"]);
const validScopes = new Set(["all", "desktop", "api", "client", "scripts"]);

export function normalizeTestOptions(options = {}) {
  const type = options.type ?? "all";
  const scope = normalizeScope(options.scope ?? "all");
  if (!validTypes.has(type)) throw invalidValue("type", type, validTypes);
  if (!validScopes.has(scope)) throw invalidValue("scope", scope, validScopes);
  return { type, scope, test: blankToNull(options.test) };
}

export function buildTestPlan(options = {}) {
  const normalized = normalizeTestOptions(options);
  if (normalized.test) return buildSpecificPlan(normalized);
  return buildGeneralPlan(normalized);
}

function buildGeneralPlan({ type, scope }) {
  if (scope === "all") return rootPlan(type);
  if (scope === "desktop") return desktopPlan(type);
  if (scope === "api") return javaPlan("api", type);
  if (scope === "client") return javaPlan("sync-server", type);
  return scriptsPlan(type);
}

function rootPlan(type) {
  if (type === "all") {
    return [pnpmRoot("unitTest"), pnpmRoot("integrationTest"), pnpmRoot("e2e")];
  }
  return [pnpmRoot(typeCommand(type))];
}

function desktopPlan(type) {
  if (type === "all") return [pnpmFilter("desktop", "unitTest"), pnpmFilter("desktop", "e2e")];
  if (type === "integration") throw unsupported("desktop", type);
  return [pnpmFilter("desktop", typeCommand(type))];
}

function javaPlan(project, type) {
  if (type === "all") {
    if (project === "sync-server") return [gradle(project, "test")];
    return [gradle(project, "unitTest"), gradle(project, "integrationTest")];
  }
  if (type === "e2e") throw unsupported(project, type);
  return [gradle(project, javaTask(project, type))];
}

function scriptsPlan(type) {
  if (type !== "unit" && type !== "all") throw unsupported("scripts", type);
  return [nodeTests(listFiles(path.join(root, "scripts"), (file) => file.endsWith(".test.mjs")))];
}

function buildSpecificPlan(options) {
  const candidates = specificCandidates(options);
  if (candidates.length > 0) return candidates;
  throw new Error(
    `test pattern '${options.test}' matched no ${options.type} tests in scope '${options.scope}'`
  );
}

function specificCandidates({ type, scope, test }) {
  const scopes = scope === "all" ? ["desktop", "api", "client", "scripts"] : [scope];
  return scopes.flatMap((candidateScope) => specificForScope(candidateScope, type, test));
}

function specificForScope(scope, type, pattern) {
  if (scope === "desktop") return specificDesktop(type, pattern);
  if (scope === "api") return specificJava("api", type, pattern);
  if (scope === "client") return specificJava("sync-server", type, pattern);
  return specificScripts(type, pattern);
}

function specificDesktop(type, pattern) {
  if (type === "unit" || type === "all") {
    const matches = matchingFiles("apps/desktop/test", ".test.mts", pattern);
    if (matches.length > 0) return [desktopNodeTests(matches)];
  }
  if (type === "e2e" || type === "all") {
    const matches = matchingFiles("apps/desktop/e2e", ".spec.ts", pattern);
    if (matches.length > 0) return [playwright(matches)];
  }
  return [];
}

function specificJava(project, type, pattern) {
  if (type === "e2e" || type === "check" || type === "lint") return [];
  const matches = matchingFiles(`apps/${project}/src/test`, ".java", pattern);
  if (matches.length === 0) return [];
  const task = type === "all" ? "test" : javaTask(project, type);
  return [gradle(project, task, `*${pattern}*`)];
}

function specificScripts(type, pattern) {
  if (type !== "unit" && type !== "all") return [];
  const matches = matchingFiles("scripts", ".test.mjs", pattern);
  return matches.length > 0 ? [nodeTests(matches)] : [];
}

function matchingFiles(directory, suffix, pattern) {
  const absolute = path.join(root, directory);
  const lowerPattern = pattern.toLowerCase();
  return listFiles(absolute, (file) => file.endsWith(suffix) && file.toLowerCase().includes(lowerPattern));
}

function listFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function pnpmRoot(script) {
  return command("/usr/bin/pnpm", ["run", script], root);
}

function pnpmFilter(project, script) {
  return command("/usr/bin/pnpm", ["--filter", `@gtd-on-rails/${project}`, "run", script], root);
}

function gradle(project, task, testPattern = null) {
  const args = [task];
  if (testPattern) args.push("--tests", testPattern);
  return command("./gradlew", args, path.join(root, "apps", project));
}

function desktopNodeTests(files) {
  const args = [
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--experimental-strip-types",
    "--test",
    ...files
  ];
  return command(process.execPath, args, path.join(root, "apps/desktop"));
}

function playwright(files) {
  return command("/usr/bin/pnpm", ["exec", "playwright", "test", ...files], path.join(root, "apps/desktop"));
}

function nodeTests(files) {
  return command(process.execPath, ["--test", ...files], root);
}

function command(executable, args, cwd) {
  return { executable, args, cwd };
}

function javaTask(project, type) {
  if (type === "unit") return project === "sync-server" ? "test" : "unitTest";
  if (type === "integration") return project === "sync-server" ? "test" : "integrationTest";
  return typeCommand(type);
}

function typeCommand(type) {
  if (type === "check" || type === "lint" || type === "e2e") return type;
  if (type === "unit") return "unitTest";
  if (type === "integration") return "integrationTest";
  throw new Error(`test type '${type}' has no single command`);
}

function normalizeScope(scope) {
  return scope === "sync" || scope === "sync-server" ? "client" : scope;
}

function blankToNull(value) {
  return value && value.trim() ? value.trim() : null;
}

function invalidValue(name, value, expected) {
  return new Error(`${name} value '${value}' is invalid; expected one of ${[...expected].join(", ")}`);
}

function unsupported(scope, type) {
  return new Error(`test type '${type}' is unavailable for scope '${scope}'`);
}
