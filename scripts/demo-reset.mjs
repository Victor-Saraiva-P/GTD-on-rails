const defaultApiBaseUrl = "http://127.0.0.1:8080";

/**
 * Parses the destructive demo reset confirmation flag.
 *
 * @example parseDemoResetArgs(["--confirm"])
 */
export function parseDemoResetArgs(argv) {
  const confirmed = argv.includes("--confirm");
  return { confirmed };
}

/**
 * Normalizes the API base URL used by local development scripts.
 *
 * @example normalizeApiBaseUrl("http://127.0.0.1:8080/")
 */
export function normalizeApiBaseUrl(rawValue = defaultApiBaseUrl) {
  const trimmed = rawValue.trim();
  if (!trimmed) throw new Error(`GTD_API_BASE_URL value '${rawValue}' is invalid; expected absolute URL`);
  return new URL(trimmed).toString().replace(/\/$/, "");
}

/**
 * Builds the development demo reset endpoint URL.
 *
 * @example demoResetUrl("http://127.0.0.1:8080")
 */
export function demoResetUrl(baseUrl) {
  return `${normalizeApiBaseUrl(baseUrl)}/dev/demo/reset`;
}

/**
 * Calls the dev-only demo reset endpoint.
 *
 * @example await resetDemoData("http://127.0.0.1:8080", fetch)
 */
export async function resetDemoData(baseUrl, fetchFn = fetch) {
  const response = await fetchFn(demoResetUrl(baseUrl), { method: "POST" });
  if (!response.ok) throw new Error(`demo reset failed with HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const { confirmed } = parseDemoResetArgs(process.argv.slice(2));
  const baseUrl = normalizeApiBaseUrl(process.env.GTD_API_BASE_URL);
  if (!confirmed) return printConfirmationHint(baseUrl);
  const result = await resetDemoData(baseUrl);
  console.log(`Demo data reset: ${result.itemCount} items, ${result.contextCount} contexts.`);
}

function printConfirmationHint(baseUrl) {
  console.log("Demo data reset not run.");
  console.log(`Target API: ${demoResetUrl(baseUrl)}`);
  console.log("Run pnpm demo:reset --confirm to recreate development screenshot data.");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
