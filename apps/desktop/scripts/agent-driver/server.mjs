import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const driverName = "gtd-agent-driver";
const host = "127.0.0.1";
const defaultPort = 3199;
const defaultTargetUrl = "http://127.0.0.1:1420";
const requestLimitBytes = 1024 * 1024;
const allowedTargetHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

let browser = null;
let page = null;
let targetUrl = validateAgentTargetUrl(process.env.GTD_AGENT_TARGET_URL || defaultTargetUrl);
let consoleErrors = [];
let networkErrors = [];

assertDevelopmentRuntime();

export function assertDevelopmentRuntime(env = process.env) {
  if (env.NODE_ENV === "production") throw new Error("Agent driver cannot run with NODE_ENV='production'; expected a development runtime.");
  if (sidecarProfilesIncludeProduction(env)) throw new Error("Agent driver cannot run with GTD_SIDECAR_PROFILES containing 'prod'; expected a non-production profile.");
}

function sidecarProfilesIncludeProduction(env) {
  return (env.GTD_SIDECAR_PROFILES || "").split(",").map(profile => profile.trim()).includes("prod");
}

export function validateAgentTargetUrl(value) {
  const parsedUrl = new URL(value);
  if (allowedTargetHosts.has(parsedUrl.hostname)) return parsedUrl.toString();
  throw new Error(`Agent target URL '${value}' used host '${parsedUrl.hostname}'; expected localhost, 127.0.0.1, or ::1.`);
}

function configuredPort() {
  const rawPort = process.env.GTD_AGENT_DRIVER_PORT || `${defaultPort}`;
  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) return defaultPort;
  return port;
}

function configuredHeadless() {
  return process.env.GTD_AGENT_HEADLESS === "true";
}

function jsonResponse(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function routeKey(request) {
  const url = new URL(request.url || "/", `http://${host}`);
  return `${request.method || "GET"} ${url.pathname}`;
}

function requestUrl(request) {
  return new URL(request.url || "/", `http://${host}`);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > requestLimitBytes) reject(new Error("request body exceeded 1mb; expected JSON below limit."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const body = await readRequestBody(request);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function compactError(error) {
  return error instanceof Error ? error.message : String(error);
}

function ensureBrowserEventHooks(openPage) {
  openPage.on("console", message => collectConsoleError(message));
  openPage.on("requestfailed", request => collectFailedRequest(request));
  openPage.on("response", response => collectErrorResponse(response));
}

function collectConsoleError(message) {
  if (message.type() !== "error") return;
  consoleErrors.push({ text: message.text(), timestamp: new Date().toISOString() });
}

function collectFailedRequest(request) {
  networkErrors.push({ url: request.url(), failure: request.failure()?.errorText || null });
}

function collectErrorResponse(response) {
  if (response.status() < 400) return;
  networkErrors.push({ url: response.url(), status: response.status() });
}

async function startSession(options = {}) {
  if (options.url) targetUrl = validateAgentTargetUrl(options.url);
  if (options.force) await closeSession(false);
  if (page && !page.isClosed()) return page;
  browser = await chromium.launch({ headless: configuredHeadless() });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  ensureBrowserEventHooks(page);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  return page;
}

async function closeSession(exitProcess) {
  if (browser) await browser.close();
  browser = null;
  page = null;
  if (exitProcess) setTimeout(() => process.exit(0), 10);
}

async function currentPage() {
  if (page && !page.isClosed()) return page;
  return startSession();
}

async function gotoUrl(url) {
  targetUrl = validateAgentTargetUrl(url);
  const openPage = await currentPage();
  await openPage.goto(targetUrl, { waitUntil: "domcontentloaded" });
  return observePage(openPage, false, true);
}

async function pressKey(body) {
  const key = requireString(body.key, "key");
  const repeat = normalizedRepeat(body.repeat);
  const delayMs = normalizedDelay(body.delayMs);
  const openPage = await currentPage();
  for (let index = 0; index < repeat; index += 1) await pressOneKey(openPage, key, delayMs);
  return { ...(await observePage(openPage, false, body.compact !== false)), action: "press", key, repeat };
}

async function pressOneKey(openPage, key, delayMs) {
  await openPage.keyboard.press(key);
  if (delayMs > 0) await openPage.waitForTimeout(delayMs);
}

async function typeText(body) {
  const text = requireString(body.text, "text");
  const delayMs = normalizedDelay(body.delayMs);
  const openPage = await currentPage();
  await openPage.keyboard.type(text, { delay: delayMs });
  return { ...(await observePage(openPage, false, body.compact !== false)), action: "type" };
}

async function waitForBody(body) {
  const ms = normalizedWait(body.ms);
  const openPage = await currentPage();
  await openPage.waitForTimeout(ms);
  return { ...(await observePage(openPage, false, body.compact !== false)), action: "wait", ms };
}

function requireString(value, fieldName) {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Field '${fieldName}' had value '${value}'; expected a non-empty string.`);
}

function normalizedRepeat(value) {
  if (value === undefined) return 1;
  const repeat = Number.parseInt(value, 10);
  if (Number.isNaN(repeat) || repeat < 1) return 1;
  return Math.min(repeat, 100);
}

function normalizedDelay(value) {
  if (value === undefined) return 0;
  const delay = Number.parseInt(value, 10);
  if (Number.isNaN(delay) || delay < 0) return 0;
  return Math.min(delay, 5000);
}

function normalizedWait(value) {
  const waitMs = Number.parseInt(value, 10);
  if (Number.isNaN(waitMs) || waitMs < 0) return 0;
  return Math.min(waitMs, 30000);
}

async function observePage(openPage, drainErrors, compact = false) {
  const browserState = await browserObservation(openPage);
  const pageState = await openPage.evaluate(collectPageObservation);
  const fullObservation = mergeObservation(browserState, pageState, drainErrors);
  return compact ? compactObservation(fullObservation) : fullObservation;
}

async function browserObservation(openPage) {
  return { ok: true, url: openPage.url(), title: await openPage.title(), timestamp: new Date().toISOString() };
}

function mergeObservation(browserState, pageState, drainErrors) {
  return {
    ...browserState,
    ...pageState,
    consoleErrorsSinceLastObserve: drainErrors ? drainConsoleErrors() : consoleErrors,
    networkErrorsSinceLastObserve: drainErrors ? drainNetworkErrors() : networkErrors
  };
}

function compactObservation(observation) {
  return {
    ok: observation.ok,
    url: observation.url,
    title: observation.title,
    timestamp: observation.timestamp,
    visibleTextPreview: observation.visibleTextPreview,
    activeElement: observation.activeElement,
    focusedText: observation.focusedText,
    selection: observation.selection,
    dialogs: observation.dialogs,
    toasts: observation.toasts,
    errors: observation.errors,
    consoleErrorCount: observation.consoleErrorsSinceLastObserve.length,
    networkErrorCount: observation.networkErrorsSinceLastObserve.length
  };
}

function drainConsoleErrors() {
  const errors = consoleErrors;
  consoleErrors = [];
  return errors;
}

function drainNetworkErrors() {
  const errors = networkErrors;
  networkErrors = [];
  return errors;
}

function collectPageObservation() {
  const describe = element => {
    if (!element) return null;
    return {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      text: (element.textContent || "").trim().slice(0, 500),
      ariaLabel: element.getAttribute("aria-label"),
      testId: element.getAttribute("data-testid")
    };
  };
  const texts = selector => Array.from(document.querySelectorAll(selector)).map(node => (node.textContent || "").trim()).filter(Boolean);
  const visibleText = document.body?.innerText || "";
  const activeElement = describe(document.activeElement);
  return {
    visibleText,
    visibleTextPreview: visibleText.slice(0, 1000),
    activeElement,
    focusedElement: activeElement,
    documentActiveElement: activeElement,
    focusedText: activeElement?.text || "",
    selection: window.getSelection()?.toString() || "",
    mainRegionText: document.querySelector("main")?.textContent?.trim() || "",
    toasts: texts('[role="status"], [aria-live]'),
    dialogs: texts('dialog, [role="dialog"]'),
    errors: texts('[role="alert"], .error, [data-testid*="error"]')
  };
}

async function agentState() {
  const openPage = await currentPage();
  const state = await openPage.evaluate(() => window.__GTD_AGENT_STATE__ ?? null);
  return { ok: true, available: state !== null, state };
}

function health() {
  return { ok: true, driver: driverName, targetUrl, hasPage: Boolean(page && !page.isClosed()) };
}

async function routeRequest(request) {
  const body = request.method === "POST" ? await readJsonBody(request) : {};
  const url = requestUrl(request);
  if (routeKey(request) === "GET /health") return health();
  if (routeKey(request) === "POST /start") return { ok: true, ...(await startResponse(body)) };
  if (routeKey(request) === "POST /goto") return gotoUrl(requireString(body.url, "url"));
  if (routeKey(request) === "POST /press") return pressKey(body);
  if (routeKey(request) === "POST /type") return typeText(body);
  if (routeKey(request) === "POST /wait") return waitForBody(body);
  if (routeKey(request) === "GET /observe") return observePage(await currentPage(), true, url.searchParams.get("compact") === "true");
  if (routeKey(request) === "GET /state") return agentState();
  if (routeKey(request) === "POST /close") return closeResponse(body);
  return null;
}

async function startResponse(body) {
  await startSession({ force: body.force === true, url: body.url });
  return health();
}

async function closeResponse(body) {
  await closeSession(body.exitProcess === true);
  return { ok: true, closed: true, exitProcess: body.exitProcess === true };
}

async function handleRequest(request, response) {
  try {
    const result = await routeRequest(request);
    if (!result) return jsonResponse(response, 404, { ok: false, error: "Route not found." });
    return jsonResponse(response, 200, result);
  } catch (error) {
    return jsonResponse(response, 400, { ok: false, error: compactError(error) });
  }
}

function startHttpServer() {
  const port = configuredPort();
  createServer(handleRequest).listen(port, host, () => {
    console.log(`${driverName} listening on http://${host}:${port}`);
    console.log(`targetUrl=${targetUrl}`);
    startInitialSession();
  });
}

async function startInitialSession() {
  try {
    await startSession();
  } catch (error) {
    console.error(`initial browser start failed: ${compactError(error)}`);
  }
}

function runningAsEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (runningAsEntrypoint()) startHttpServer();
