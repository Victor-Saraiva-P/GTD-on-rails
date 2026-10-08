import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultMainReleaseUrl,
  desktopMainReleaseAssets,
  desktopReleaseAssets,
  normalizeReleaseVersion,
  parseReleaseTagArgument,
  resolveReleaseEndpoint
} from "./release-installer-shared.mjs";

test("desktop installer normalizes version tags", () => {
  assert.equal(normalizeReleaseVersion("v3.0.1"), "3.0.1");
  assert.equal(normalizeReleaseVersion("app-v3.0.1"), "3.0.1");
  assert.equal(normalizeReleaseVersion("3.0.1"), "3.0.1");
  assert.throws(() => normalizeReleaseVersion("invalid-tag"), /invalid; expected semantic version/);
});

test("desktop installer resolves release endpoints by tag or default", () => {
  assert.equal(
    resolveReleaseEndpoint("v3.0.1"),
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/tags/v3.0.1"
  );
  assert.equal(
    resolveReleaseEndpoint("3.0.1"),
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/tags/v3.0.1"
  );
  assert.equal(
    resolveReleaseEndpoint(undefined, defaultMainReleaseUrl),
    "https://api.github.com/repos/Victor-Saraiva-P/GTD-on-rails/releases/tags/main-latest"
  );
  assert.equal(
    resolveReleaseEndpoint("https://example.test/custom"),
    "https://example.test/custom"
  );
});

test("desktop installer parses tag argument from CLI arguments", () => {
  assert.equal(parseReleaseTagArgument(["--tag=v3.0.1"]), "v3.0.1");
  assert.equal(parseReleaseTagArgument(["--tag", "v3.0.1"]), "v3.0.1");
  assert.equal(parseReleaseTagArgument(["v3.0.1"]), "v3.0.1");
  assert.equal(parseReleaseTagArgument([]), undefined);
});

test("desktop installer selects the versioned desktop archive and checksum", () => {
  const release = {
    tag_name: "v3.0.1",
    assets: [
      {
        name: "GTD.on.Rails_3.0.1_linux-x86_64.tar.gz",
        browser_download_url: "https://example.test/desktop.tar.gz"
      },
      {
        name: "GTD.on.Rails_3.0.1_linux-x86_64.tar.gz.sha256",
        browser_download_url: "https://example.test/desktop.tar.gz.sha256"
      }
    ]
  };

  assert.deepEqual(desktopReleaseAssets(release), {
    version: "3.0.1",
    archiveName: "GTD.on.Rails_3.0.1_linux-x86_64.tar.gz",
    checksumName: "GTD.on.Rails_3.0.1_linux-x86_64.tar.gz.sha256",
    archiveUrl: "https://example.test/desktop.tar.gz",
    checksumUrl: "https://example.test/desktop.tar.gz.sha256"
  });
});

test("desktop installer selects rolling main assets from the shared manifest", () => {
  const release = {
    tag_name: "main-latest",
    assets: [
      {
        name: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz",
        browser_download_url: "https://example.test/main-desktop.tar.gz"
      },
      {
        name: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz.sha256",
        browser_download_url: "https://example.test/main-desktop.tar.gz.sha256"
      }
    ]
  };
  const manifest = {
    version: "3.6.0",
    revision: "0123456789abcdef0123456789abcdef01234567",
    archiveName: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz",
    checksumName: "GTD.on.Rails_3.6.0_linux-x86_64.tar.gz.sha256"
  };

  assert.deepEqual(desktopMainReleaseAssets(release, manifest), {
    version: "3.6.0",
    revision: manifest.revision,
    archiveName: manifest.archiveName,
    checksumName: manifest.checksumName,
    archiveUrl: "https://example.test/main-desktop.tar.gz",
    checksumUrl: "https://example.test/main-desktop.tar.gz.sha256"
  });
});

test("desktop installer rejects releases without desktop assets", () => {
  assert.throws(
    () => desktopReleaseAssets({ tag_name: "v3.0.1", assets: [] }),
    /missing required desktop asset/
  );
});
