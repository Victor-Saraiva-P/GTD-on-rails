import { spawnSync } from "node:child_process";
import { buildTestPlan } from "./test-plan.mjs";

export function parseTestArguments(argumentsList) {
  const options = {};
  for (const argument of argumentsList) assignArgument(options, argument);
  return options;
}

export function executeTestPlan(plan, run = spawnSync) {
  for (const step of plan) {
    const result = run(step.executable, step.args, {
      cwd: step.cwd,
      env: process.env,
      stdio: "inherit"
    });
    if (result.status !== 0) throw commandFailure(step, result.status);
  }
}

function assignArgument(options, argument) {
  const separator = argument.indexOf("=");
  if (!argument.startsWith("--") || separator < 3) {
    throw new Error(`test argument '${argument}' is invalid; expected --name=value`);
  }
  options[argument.slice(2, separator)] = argument.slice(separator + 1);
}

function commandFailure(step, status) {
  return new Error(
    `${step.executable} ${step.args.join(" ")} failed with status ${status ?? "unknown"}`
  );
}

function main() {
  const options = parseTestArguments(process.argv.slice(2));
  executeTestPlan(buildTestPlan(options));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
