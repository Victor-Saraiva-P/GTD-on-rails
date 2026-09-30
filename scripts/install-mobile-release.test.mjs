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

test("compatible serve accepts empty or matching root proxy", () => {
  assert.doesNotThrow(() => assertCompatibleServe({}, "http://127.0.0.1:7676"));
  assert.doesNotThrow(() => assertCompatibleServe({
    Web: {
      "client.tailnet.ts.net:443": {
        Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
      }
    }
  }, "http://127.0.0.1:7676"));
});

test("compatible serve rejects a conflicting root proxy", () => {
  assert.throws(() => assertCompatibleServe({
    Web: {
      "client.tailnet.ts.net:443": {
        Handlers: { "/": { Proxy: "http://127.0.0.1:3000" } }
      }
    }
  }, "http://127.0.0.1:7676"), /conflicts with mobile target/);
});

test("private serve rejects Funnel and requires the mobile proxy", () => {
  const matching = {
    Web: {
      "client.tailnet.ts.net:443": {
        Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
      }
    }
  };
  assert.doesNotThrow(() => assertPrivateServe(matching, "http://127.0.0.1:7676"));
  assert.throws(
    () => assertPrivateServe({ ...matching, AllowFunnel: { "client.tailnet.ts.net:443": true } }, "http://127.0.0.1:7676"),
    /Funnel is enabled/
  );
});

test("configure mobile serve rejects Funnel before changing Serve", () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args);
    return JSON.stringify({
      Web: {
        "client.tailnet.ts.net:443": {
          Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
        }
      },
      AllowFunnel: { "client.tailnet.ts.net:443": true }
    });
  };

  assert.throws(() => configureMobileServe({}, runner), /Funnel is enabled/);
  assert.deepEqual(calls, [["serve", "status", "--json"]]);
});

test("configure mobile serve creates private HTTPS access", () => {
  const calls = [];
  const responses = [
    JSON.stringify({ Web: {} }),
    "",
    JSON.stringify({
      Web: {
        "client.tailnet.ts.net:443": {
          Handlers: { "/": { Proxy: "http://127.0.0.1:7676" } }
        }
      }
    }),
    JSON.stringify({ Self: { DNSName: "client.tailnet.ts.net." } })
  ];
  const runner = (args) => {
    calls.push(args);
    return responses.shift();
  };

  const url = configureMobileServe({}, runner);

  assert.equal(url, "https://client.tailnet.ts.net/mobile/");
  assert.deepEqual(calls[1], ["serve", "--bg", "--yes", "http://127.0.0.1:7676"]);
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
