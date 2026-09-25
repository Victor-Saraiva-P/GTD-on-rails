import {
  desktopReleaseAssets,
  installDesktopRelease,
  parseReleaseTagArgument
} from "./release-installer-shared.mjs";

export { desktopReleaseAssets, installDesktopRelease };

if (import.meta.url === `file://${process.argv[1]}`) {
  const tag = parseReleaseTagArgument();
  installDesktopRelease(tag).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
