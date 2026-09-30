import { spawnSync } from "node:child_process";
import {
  installClientRelease,
  parseReleaseTagArgument
} from "./release-installer-shared.mjs";
import { waitForHttpReady } from "./process-runner.mjs";

const DEFAULT_CALLBACK_PORT = "7676";
const DEFAULT_SERVE_PORT = "443";

export async function installMobileRelease(tag, environment = process.env, dependencies = {}) {
  const installClient = dependencies.installClientRelease ?? installClientRelease;
  const waitReady = dependencies.waitForHttpReady ?? waitForHttpReady;
  const configureServe = dependencies.configureMobileServe ?? configureMobileServe;
  await installClient(tag, environment);
  await waitReady(mobileLocalUrl(environment));
  return configureServe(environment);
}

export function mobileLocalUrl(environment = process.env) {
  const port = environment.GTD_SYNC_SERVER_GOOGLE_CALLBACK_PORT ?? DEFAULT_CALLBACK_PORT;
  return `http://127.0.0.1:${port}/mobile/`;
}

export function configureMobileServe(environment = process.env, run = runTailscale) {
  const port = environment.GTD_SYNC_SERVER_GOOGLE_CALLBACK_PORT ?? DEFAULT_CALLBACK_PORT;
  const target = `http://127.0.0.1:${port}`;
  const dnsName = tailscaleDnsName(run(["status", "--json"]));
  const serveAddress = `${dnsName}:${DEFAULT_SERVE_PORT}`;
  const status = parseJson(run(["serve", "status", "--json"]), "serve status");
  assertCompatibleServe(status, target, serveAddress);
  run(["serve", "--bg", "--yes", target]);
  assertPrivateServe(
    parseJson(run(["serve", "status", "--json"]), "serve status"),
    target,
    serveAddress
  );
  const url = `https://${dnsName}/mobile/`;
  console.log(`Mobile PWA: ${url}`);
  return url;
}

export function tailscaleDnsName(statusJson) {
  const status = parseJson(statusJson, "tailscale status");
  const dnsName = status?.Self?.DNSName?.replace(/\.$/, "");
  if (dnsName) return dnsName;
  throw new Error("Tailscale MagicDNS name is unavailable; expected connected client machine");
}

export function assertCompatibleServe(status, target, serveAddress) {
  const proxy = status?.Web?.[serveAddress]?.Handlers?.["/"]?.Proxy;
  if (!proxy || proxy === target) return;
  throw new Error(
    `Tailscale Serve endpoint '${serveAddress}' proxies to '${proxy}'; expected mobile target '${target}'`
  );
}

export function assertPrivateServe(status, target, serveAddress) {
  const proxy = status?.Web?.[serveAddress]?.Handlers?.["/"]?.Proxy;
  if (proxy !== target) {
    throw new Error(
      `Tailscale Serve endpoint '${serveAddress}' proxies to '${proxy ?? "missing"}'; expected '${target}'`
    );
  }
  if (status?.AllowFunnel?.[serveAddress]) {
    throw new Error(
      `Tailscale Funnel is enabled for '${serveAddress}'; expected private tailnet-only Serve`
    );
  }
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    throw new Error(`${label} output is invalid; expected JSON`, { cause: error });
  }
}

function runTailscale(args) {
  const result = spawnSync("tailscale", args, { encoding: "utf8" });
  if (result.status === 0) return result.stdout;
  const message = result.stderr?.trim() || result.stdout?.trim() || "unknown tailscale error";
  throw new Error(`tailscale ${args.join(" ")} failed: ${message}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installMobileRelease(parseReleaseTagArgument(), process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
