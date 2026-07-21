#!/usr/bin/env node
const fs = require("node:fs");

class FakeDevelopmentPnpm {
  execute(argumentsList) {
    fs.appendFileSync(process.env.GTD_TEST_PNPM_LOG, argumentsList.join(" ") + "\n");
    setInterval(() => {}, 1000);
  }
}

new FakeDevelopmentPnpm().execute(process.argv.slice(2));
