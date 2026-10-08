import assert from "node:assert/strict";
import test from "node:test";

import { clientReleaseAssets, normalizeReleaseVersion } from "./install-client-release.mjs";
import { clientMainReleaseAssets } from "./release-installer-shared.mjs";

test("client installer accepts app-prefixed release tags", () => {
  assert.equal(normalizeReleaseVersion("app-v2.5.0"), "2.5.0");
  assert.equal(normalizeReleaseVersion("v2.5.0"), "2.5.0");
});

test("client installer selects the versioned client archive and checksum", () => {
  const release = {
    tag_name: "app-v2.5.0",
    assets: [
      {
        name: "GTD.on.Rails.Client_2.5.0_linux-x86_64.tar.gz",
        browser_download_url: "https://example.test/client.tar.gz"
      },
      {
        name: "GTD.on.Rails.Client_2.5.0_linux-x86_64.tar.gz.sha256",
        browser_download_url: "https://example.test/client.tar.gz.sha256"
      }
    ]
  };

  assert.deepEqual(clientReleaseAssets(release), {
    version: "2.5.0",
    archiveName: "GTD.on.Rails.Client_2.5.0_linux-x86_64.tar.gz",
    checksumName: "GTD.on.Rails.Client_2.5.0_linux-x86_64.tar.gz.sha256",
    archiveUrl: "https://example.test/client.tar.gz",
    checksumUrl: "https://example.test/client.tar.gz.sha256"
  });
});

test("client installer selects rolling main assets from the shared manifest", () => {
  const release = {
    tag_name: "main-latest",
    assets: [
      {
        name: "GTD.on.Rails.Client_3.6.0_linux-x86_64.tar.gz",
        browser_download_url: "https://example.test/main-client.tar.gz"
      },
      {
        name: "GTD.on.Rails.Client_3.6.0_linux-x86_64.tar.gz.sha256",
        browser_download_url: "https://example.test/main-client.tar.gz.sha256"
      }
    ]
  };
  const manifest = {
    version: "3.6.0",
    revision: "0123456789abcdef0123456789abcdef01234567",
    clientArchiveName: "GTD.on.Rails.Client_3.6.0_linux-x86_64.tar.gz",
    clientChecksumName: "GTD.on.Rails.Client_3.6.0_linux-x86_64.tar.gz.sha256"
  };

  assert.deepEqual(clientMainReleaseAssets(release, manifest), {
    version: "3.6.0",
    revision: manifest.revision,
    archiveName: manifest.clientArchiveName,
    checksumName: manifest.clientChecksumName,
    archiveUrl: "https://example.test/main-client.tar.gz",
    checksumUrl: "https://example.test/main-client.tar.gz.sha256"
  });
});

test("client installer rejects releases without the client assets", () => {
  assert.throws(
    () => clientReleaseAssets({ tag_name: "app-v2.5.0", assets: [] }),
    /missing required client asset/
  );
});
