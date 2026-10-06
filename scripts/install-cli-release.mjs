import {
  cliReleaseAssets,
  installCliRelease,
  parseReleaseTagArgument
} from "./release-installer-shared.mjs";

export { cliReleaseAssets, installCliRelease };

if (import.meta.url === `file://${process.argv[1]}`) {
  const tag = parseReleaseTagArgument();
  installCliRelease(tag).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
