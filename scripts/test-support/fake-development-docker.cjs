#!/usr/bin/env node
const fs = require("node:fs");

class FakeDevelopmentDocker {
  execute(argumentsList) {
    this.log(argumentsList);
    if (this.shouldFail(argumentsList)) return this.exitWithFailure();
    if (argumentsList.includes("exec")) return this.writeDatabaseIdentity();
    if (argumentsList.includes("--status")) return this.writeHealthyStatus();
    this.writeContainerIdentifier(argumentsList);
  }

  log(argumentsList) {
    const logPath = process.env.GTD_TEST_DOCKER_LOG ?? process.env.GTD_TEST_LOG;
    fs.appendFileSync(logPath, argumentsList.join(" ") + "\n");
  }

  shouldFail(argumentsList) {
    return argumentsList.includes(process.env.GTD_TEST_FAILED_DOCKER_COMMAND);
  }

  exitWithFailure() {
    process.exitCode = 1;
  }

  writeDatabaseIdentity() {
    process.stdout.write(process.env.GTD_TEST_DATABASE_IDENTITY + "\n");
  }

  writeHealthyStatus() {
    process.stdout.write("healthy\n");
  }

  writeContainerIdentifier(argumentsList) {
    if (argumentsList.includes("-aq") && postgresContainerExists()) process.stdout.write("postgres-container\n");
    if (argumentsList.includes("-q") && process.env.GTD_TEST_POSTGRES_RUNNING === "true") process.stdout.write("postgres-container\n");
  }
}

function postgresContainerExists() {
  return process.env.GTD_TEST_POSTGRES_EXISTS !== "false";
}

new FakeDevelopmentDocker().execute(process.argv.slice(2));
