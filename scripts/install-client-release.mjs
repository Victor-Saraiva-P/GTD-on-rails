import {
  clientReleaseAssets,
  installClientRelease,
  normalizeReleaseVersion,
  parseReleaseTagArgument
} from "./release-installer-shared.mjs";

export { clientReleaseAssets, normalizeReleaseVersion, installClientRelease };

/**
 * Installs the latest sync client or the version specified by environment/tag argument.
 *
 * <p>Example: {@code await installLatestClient(process.env)}.</p>
 */
export async function installLatestClient(environment = process.env) {
  const tag = parseReleaseTagArgument();
  await installClientRelease(tag, environment);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installLatestClient().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
