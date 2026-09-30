import { spawnSync } from "node:child_process";
import {
  installClientRelease,
  parseReleaseTagArgument
} from "./release-installer-shared.mjs";
import { waitForHttpReady } from "./process-runner.mjs";

const DEFAULT_CALLBACK_PORT = "7676";

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
  const status = parseJson(run(["serve", "status", "--json"]), "serve status");
  assertCompatibleServe(status, target);
  assertNoFunnel(status);
  run(["serve", "--bg", "--yes", target]);
  assertPrivateServe(parseJson(run(["serve", "status", "--json"]), "serve status"), target);
  const dnsName = tailscaleDnsName(run(["status", "--json"]));
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

export function assertCompatibleServe(status, target) {
  const proxies = rootProxies(status);
  const conflict = proxies.find((proxy) => proxy !== target);
  if (!conflict) return;
  throw new Error(
    `Tailscale Serve root proxy '${conflict}' conflicts with mobile target '${target}'; expected empty or matching root proxy`
  );
}

export function assertPrivateServe(status, target) {
  const proxies = rootProxies(status);
  if (!proxies.includes(target)) {
    throw new Error(`Tailscale Serve target '${target}' is missing after configuration`);
  }
  assertNoFunnel(status);
}

export function assertNoFunnel(status) {
  const publicHosts = Object.values(status?.AllowFunnel ?? {}).filter(Boolean);
  if (publicHosts.length === 0) return;
  throw new Error("Tailscale Funnel is enabled; expected private tailnet-only Serve for mobile");
}

function rootProxies(status) {
  const web = status?.Web ?? {};
  return Object.values(web)
    .map((entry) => entry?.Handlers?.["/"]?.Proxy)
    .filter(Boolean);
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
