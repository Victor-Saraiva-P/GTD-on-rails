import { spawn } from "node:child_process";
import fs from "node:fs";
import { startClient } from "./run-client.mjs";
import { waitForHttpReady } from "./process-runner.mjs";
import {
  clientRuntimeEnvironment,
  normalizeRuntimeEnvironment
} from "./runtime-config.mjs";

export async function startMobile(environmentName = "dev") {
  const normalized = normalizeRuntimeEnvironment(environmentName);
  const environment = clientRuntimeEnvironment(normalized);
  const url = mobileUrl(environment);
  if (await mobileServerReady(url)) {
    printReusableMobile(normalized, url);
    openBrowser(url);
    return;
  }
  await startNewMobileServer(normalized);
}

async function startNewMobileServer(environmentName) {
  await startClient(environmentName, {
    afterStart: async (environment) => {
      const url = mobileUrl(environment);
      await waitForHttpReady(url);
      console.log(`Mobile PWA: ${url}`);
      openBrowser(url);
    }
  });
}

export async function mobileServerReady(url, fetcher = fetch) {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

function printReusableMobile(environmentName, url) {
  console.log(`GTD sync client environment: ${environmentName}`);
  console.log(`Reusing running sync server: ${url}`);
}

export function mobileUrl(environment) {
  return `http://127.0.0.1:${environment.GTD_SYNC_SERVER_PORT}/mobile/`;
}

function openBrowser(url) {
  const opener = "/usr/bin/xdg-open";
  if (process.env.GTD_MOBILE_OPEN_BROWSER === "false" || !fs.existsSync(opener)) {
    console.log("Open the Mobile PWA URL in your browser and enable device emulation in DevTools.");
    return;
  }
  const child = spawn(opener, [url], { detached: true, stdio: "ignore" });
  child.unref();
  console.log("Use DevTools device emulation to test the phone layout.");
}

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMobile(argumentValue("env", "dev")).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
