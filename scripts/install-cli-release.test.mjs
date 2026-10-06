import assert from "node:assert/strict";
import test from "node:test";

import { cliReleaseAssets } from "./release-installer-shared.mjs";

test("CLI installer selects the versioned archive and checksum", () => {
  const release = {
    tag_name: "v3.4.0",
    assets: [
      {
        name: "GTD.on.Rails.CLI_3.4.0_linux-x86_64.tar.gz",
        browser_download_url: "https://example.test/cli.tar.gz"
      },
      {
        name: "GTD.on.Rails.CLI_3.4.0_linux-x86_64.tar.gz.sha256",
        browser_download_url: "https://example.test/cli.tar.gz.sha256"
      }
    ]
  };

  assert.deepEqual(cliReleaseAssets(release), {
    version: "3.4.0",
    archiveName: "GTD.on.Rails.CLI_3.4.0_linux-x86_64.tar.gz",
    checksumName: "GTD.on.Rails.CLI_3.4.0_linux-x86_64.tar.gz.sha256",
    archiveUrl: "https://example.test/cli.tar.gz",
    checksumUrl: "https://example.test/cli.tar.gz.sha256"
  });
});

test("CLI installer rejects releases without CLI assets", () => {
  assert.throws(
    () => cliReleaseAssets({ tag_name: "v3.4.0", assets: [] }),
    /missing required CLI asset/
  );
});
