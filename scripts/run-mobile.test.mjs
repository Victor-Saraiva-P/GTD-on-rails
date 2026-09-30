import assert from "node:assert/strict";
import test from "node:test";
import { mobileServerReady, mobileUrl } from "./run-mobile.mjs";

test("mobile URL uses the sync server port", () => {
  assert.equal(
    mobileUrl({ GTD_SYNC_SERVER_PORT: "9473" }),
    "http://127.0.0.1:9473/mobile/"
  );
});

test("running mobile server is reusable when the page responds successfully", async () => {
  const fetcher = async () => ({ ok: true });

  assert.equal(await mobileServerReady("http://127.0.0.1:9473/mobile/", fetcher), true);
});

test("unavailable mobile server is not reusable", async () => {
  const failingStatus = async () => ({ ok: false });
  const failingRequest = async () => {
    throw new Error("connection refused");
  };

  assert.equal(await mobileServerReady("http://127.0.0.1:9473/mobile/", failingStatus), false);
  assert.equal(await mobileServerReady("http://127.0.0.1:9473/mobile/", failingRequest), false);
});
