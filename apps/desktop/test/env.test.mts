import assert from "node:assert/strict";
import test from "node:test";

import {
  apiBaseUrl,
  dataRootDirectoryName,
  buildApiUrl,
  buildApiUrlWithVersion,
  buildDocumentAssetPath,
  setRuntimeApiBaseUrl
} from "../src/config/env.ts";

test("apiBaseUrl is a non-empty string", () => {
  assert.ok(apiBaseUrl.length > 0);
  assert.ok(apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://"));
});

test("buildApiUrl handles absolute URLs", () => {
  assert.equal(buildApiUrl("http://example.com/api"), "http://example.com/api");
  assert.equal(buildApiUrl("https://example.com/api"), "https://example.com/api");
});

test("buildApiUrl handles relative paths", () => {
  assert.equal(buildApiUrl("/inbox"), `${apiBaseUrl}/inbox`);
  assert.equal(buildApiUrl("contexts"), `${apiBaseUrl}/contexts`);
});

test("buildApiUrl handles empty paths", () => {
  assert.equal(buildApiUrl(""), apiBaseUrl);
});

test("buildApiUrl uses runtime API base URL override", () => {
  setRuntimeApiBaseUrl("http://127.0.0.1:43127/");
  assert.equal(buildApiUrl("/inbox"), "http://127.0.0.1:43127/inbox");
  setRuntimeApiBaseUrl(null);
});

test("buildApiUrlWithVersion adds version query param", () => {
  const url = buildApiUrlWithVersion("/assets/icon.png", 123);
  assert.equal(url, `${apiBaseUrl}/assets/icon.png?v=123`);
});

test("buildApiUrlWithVersion does not add version if undefined", () => {
  const url = buildApiUrlWithVersion("/assets/icon.png");
  assert.equal(url, `${apiBaseUrl}/assets/icon.png`);
});

test("buildDocumentAssetPath uses configured data root directory", () => {
  assert.equal(dataRootDirectoryName, "dev-gtd-on-rails");
  assert.equal(buildDocumentAssetPath("items/id/file.pdf"), "dev-gtd-on-rails/assets/items/id/file.pdf");
});
