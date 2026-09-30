import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCompatibleServe,
  assertPrivateServe,
  configureMobileServe,
  installMobileRelease,
  mobileLocalUrl,
  tailscaleDnsName
} from "./install-mobile-release.mjs";

test("mobile installer uses the callback listener URL", () => {
  assert.equal(mobileLocalUrl({}), "http://127.0.0.1:7676/mobile/");
  assert.equal(
    mobileLocalUrl({ GTD_SYNC_SERVER_GOOGLE_CALLBACK_PORT: "9000" }),
    "http://127.0.0.1:9000/mobile/"
  );
});

test("tailscale DNS name removes the trailing dot", () => {
  const status = JSON.stringify({ Self: { DNSName: "client.tailnet.ts.net." } });
  assert.equal(tailscaleDnsName(status), "client.tailnet.ts.net");
});

test("tailscale DNS name requires a connected MagicDNS identity", () => {
  assert.throws(() => tailscaleDnsName("{}"), /MagicDNS name is unavailable/);
});

test("compatible serve accepts empty or matching mobile endpoint", () => {
  const serveAddress = "client.tailnet.ts.net:443";
  assert.doesNotThrow(() => assertCompatibleServe({}, "http://127.0.0.1:7676", serveAddress));
  assert.doesNotThrow(() => assertCompatibleServe({
    Web: {
      [serveAddress]: {
        Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
      }
    }
  }, "http://127.0.0.1:7676", serveAddress));
});

test("compatible serve rejects a conflicting mobile endpoint proxy", () => {
  const serveAddress = "client.tailnet.ts.net:443";
  assert.throws(() => assertCompatibleServe({
    Web: {
      [serveAddress]: {
        Handlers: { "/": { Proxy: "http://127.0.0.1:3000" } }
      }
    }
  }, "http://127.0.0.1:7676", serveAddress), /expected mobile target/);
});

test("private serve requires the mobile proxy and rejects Funnel on that endpoint", () => {
  const serveAddress = "client.tailnet.ts.net:443";
  const unrelatedAddress = "client.tailnet.ts.net:8443";
  const matching = {
    Web: {
      [serveAddress]: {
        Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
      }
    }
  };
  assert.doesNotThrow(() => assertPrivateServe(matching, "http://127.0.0.1:7676", serveAddress));
  assert.throws(
    () => assertPrivateServe(
      { ...matching, AllowFunnel: { [serveAddress]: true } },
      "http://127.0.0.1:7676",
      serveAddress
    ),
    /Funnel is enabled/
  );
  assert.doesNotThrow(() => assertPrivateServe(
    { ...matching, AllowFunnel: { [unrelatedAddress]: true } },
    "http://127.0.0.1:7676",
    serveAddress
  ));
});

test("configure mobile serve replaces Funnel with a private proxy", () => {
  const serveAddress = "client.tailnet.ts.net:443";
  const unrelatedAddress = "client.tailnet.ts.net:8443";
  const calls = [];
  const responses = [
    JSON.stringify({ Self: { DNSName: "client.tailnet.ts.net." } }),
    JSON.stringify({
      Web: {
        [serveAddress]: {
          Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
        }
      },
      AllowFunnel: { [serveAddress]: true }
    }),
    "",
    JSON.stringify({
      Web: {
        [serveAddress]: {
          Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
        },
        [unrelatedAddress]: {
          Handlers: { "/": { Proxy: "http://127.0.0.1:9000" } }
        }
      },
      AllowFunnel: { [serveAddress]: false, [unrelatedAddress]: true }
    })
  ];
  const runner = (args) => {
    calls.push(args);
    return responses.shift();
  };

  const url = configureMobileServe({}, runner);

  assert.equal(url, "https://client.tailnet.ts.net/mobile/");
  assert.deepEqual(calls, [
    ["status", "--json"],
    ["serve", "status", "--json"],
    ["serve", "--bg", "--yes", "http://127.0.0.1:7676"],
    ["serve", "status", "--json"]
  ]);
});

test("configure mobile serve creates private HTTPS access", () => {
  const calls = [];
  const responses = [
    JSON.stringify({ Self: { DNSName: "client.tailnet.ts.net." } }),
    JSON.stringify({ Web: {} }),
    "",
    JSON.stringify({
      Web: {
        "client.tailnet.ts.net:443": {
          Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
        }
      }
    })
  ];
  const runner = (args) => {
    calls.push(args);
    return responses.shift();
  };

  const url = configureMobileServe({}, runner);

  assert.equal(url, "https://client.tailnet.ts.net/mobile/");
  assert.deepEqual(calls[2], ["serve", "--bg", "--yes", "http://127.0.0.1:7676"]);
});

test("install mobile release installs client before configuring serve", async () => {
  const calls = [];
  const dependencies = {
    installClientRelease: async (tag) => calls.push(["install", tag]),
    waitForHttpReady: async (url) => calls.push(["wait", url]),
    configureMobileServe: () => {
      calls.push(["serve"]);
      return "https://client.tailnet.ts.net/mobile/";
    }
  };

  const url = await installMobileRelease("v3.2.0", {}, dependencies);

  assert.equal(url, "https://client.tailnet.ts.net/mobile/");
  assert.deepEqual(calls, [
    ["install", "v3.2.0"],
    ["wait", "http://127.0.0.1:7676/mobile/"],
    ["serve"]
  ]);
});
